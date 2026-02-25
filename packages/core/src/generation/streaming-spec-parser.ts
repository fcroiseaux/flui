import { err, FLUI_E015, FLUI_E016, FluiError, ok } from '../errors';
import type { ComponentSpec, InteractionSpec, LayoutSpec, UISpecification } from '../spec';
import { uiSpecificationSchema } from '../spec';
import type { StreamingSpecParser } from './generation.types';

/**
 * Extracts JSON from content that may include markdown fences or surrounding text.
 * Reuses the same strategy as spec-parser.ts extractJson.
 */
function extractJson(content: string): string {
  // 1. Try code fence extraction
  const fenceMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();

  // 2. Try finding outermost JSON object
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return content.slice(firstBrace, lastBrace + 1);
  }

  // 3. Return as-is and let JSON.parse fail with descriptive error
  return content;
}

/**
 * Creates a StreamingSpecParser that incrementally parses streaming LLM output.
 *
 * The parser accumulates text chunks and uses brace-depth tracking to detect
 * when complete component objects appear in the stream, emitting partial
 * UISpecification objects as they are detected.
 */
export function createStreamingSpecParser(): StreamingSpecParser {
  let buffer = '';

  let parsedComponents: ComponentSpec[] = [];
  let parsedLayout: LayoutSpec | undefined;
  let parsedInteractions: InteractionSpec[] | undefined;

  let emittedComponentCount = 0;
  let layoutEmitted = false;
  let interactionsEmitted = false;

  let detectedVersion: string | undefined;

  interface KeyLocation {
    keyStart: number;
    valueStart: number;
  }

  function tryExtractVersion(): void {
    if (detectedVersion !== undefined) return;
    const versionMatch = buffer.match(/"version"\s*:\s*"([^"]+)"/);
    if (versionMatch?.[1]) {
      detectedVersion = versionMatch[1];
    }
  }

  function skipWhitespace(fromIndex: number): number {
    let i = fromIndex;
    while (i < buffer.length && /\s/.test(buffer[i] as string)) {
      i++;
    }

    return i;
  }

  function findKeyLocation(key: string): KeyLocation | undefined {
    let inString = false;
    let escapeNext = false;
    let stringStart = -1;

    for (let i = 0; i < buffer.length; i++) {
      const char = buffer[i] as string;

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        if (inString) {
          const token = buffer.slice(stringStart + 1, i);
          inString = false;

          if (token !== key) {
            continue;
          }

          const afterKey = skipWhitespace(i + 1);
          if ((buffer[afterKey] as string) !== ':') {
            continue;
          }

          const valueStart = skipWhitespace(afterKey + 1);
          return { keyStart: stringStart, valueStart };
        }

        inString = true;
        stringStart = i;
      }
    }

    return undefined;
  }

  function findMatchingBoundary(
    startIndex: number,
    openChar: '{' | '[',
    closeChar: '}' | ']',
  ): number | undefined {
    if ((buffer[startIndex] as string) !== openChar) {
      return undefined;
    }

    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = startIndex; i < buffer.length; i++) {
      const char = buffer[i] as string;

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === openChar) {
        depth++;
      } else if (char === closeChar) {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }

    return undefined;
  }

  function extractTopLevelObjectRangesInArray(
    arrayStart: number,
  ): Array<{ start: number; end: number }> {
    const ranges: Array<{ start: number; end: number }> = [];
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    let objectStart = -1;

    for (let i = arrayStart + 1; i < buffer.length; i++) {
      const char = buffer[i] as string;

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === '[' && depth === 0) {
        continue;
      }

      if (char === '{') {
        if (depth === 0) {
          objectStart = i;
        }
        depth++;
      } else if (char === '}') {
        depth--;

        if (depth === 0 && objectStart !== -1) {
          ranges.push({ start: objectStart, end: i });
          objectStart = -1;
        }
      } else if (char === ']' && depth === 0) {
        break;
      }
    }

    return ranges;
  }

  function parseKnownSections(): void {
    const componentsLocation = findKeyLocation('components');
    if (componentsLocation && (buffer[componentsLocation.valueStart] as string) === '[') {
      const componentRanges = extractTopLevelObjectRangesInArray(componentsLocation.valueStart);
      const nextComponents: ComponentSpec[] = [];

      for (const range of componentRanges) {
        const json = buffer.slice(range.start, range.end + 1);
        try {
          const parsed = JSON.parse(json) as ComponentSpec;
          nextComponents.push(parsed);
        } catch {
          break;
        }
      }

      parsedComponents = nextComponents;
    }

    const layoutLocation = findKeyLocation('layout');
    if (layoutLocation && (buffer[layoutLocation.valueStart] as string) === '{') {
      const layoutEnd = findMatchingBoundary(layoutLocation.valueStart, '{', '}');
      if (layoutEnd !== undefined) {
        const layoutJson = buffer.slice(layoutLocation.valueStart, layoutEnd + 1);
        try {
          parsedLayout = JSON.parse(layoutJson) as LayoutSpec;
        } catch {
          // Ignore until more chunks arrive.
        }
      }
    }

    const interactionsLocation = findKeyLocation('interactions');
    if (interactionsLocation && (buffer[interactionsLocation.valueStart] as string) === '[') {
      const interactionsEnd = findMatchingBoundary(interactionsLocation.valueStart, '[', ']');
      if (interactionsEnd !== undefined) {
        const interactionsJson = buffer.slice(interactionsLocation.valueStart, interactionsEnd + 1);
        try {
          parsedInteractions = JSON.parse(interactionsJson) as InteractionSpec[];
        } catch {
          // Ignore until more chunks arrive.
        }
      }
    }
  }

  function buildPartialSpec(): Partial<UISpecification> | undefined {
    const hasNewComponents = parsedComponents.length > emittedComponentCount;
    const hasNewLayout = parsedLayout !== undefined && !layoutEmitted;
    const hasNewInteractions = parsedInteractions !== undefined && !interactionsEmitted;

    if (!hasNewComponents && !hasNewLayout && !hasNewInteractions) {
      return undefined;
    }

    emittedComponentCount = parsedComponents.length;
    if (parsedLayout !== undefined) {
      layoutEmitted = true;
    }
    if (parsedInteractions !== undefined) {
      interactionsEmitted = true;
    }

    const partial: Partial<UISpecification> = {};

    if (detectedVersion !== undefined) {
      partial.version = detectedVersion;
    }

    if (parsedComponents.length > 0) {
      partial.components = parsedComponents.slice();
    }

    if (parsedLayout !== undefined) {
      partial.layout = parsedLayout;
    }

    if (parsedInteractions !== undefined) {
      partial.interactions = parsedInteractions.slice();
    }

    return partial;
  }

  return {
    processChunk(delta: string): Partial<UISpecification> | undefined {
      buffer += delta;

      tryExtractVersion();
      parseKnownSections();

      return buildPartialSpec();
    },

    finalize() {
      if (buffer.trim().length === 0) {
        return err(
          new FluiError(FLUI_E015, 'generation', 'LLM response parse failed: empty stream', {
            context: { contentLength: 0 },
          }),
        );
      }

      const extracted = extractJson(buffer);

      let parsed: unknown;
      try {
        parsed = JSON.parse(extracted);
      } catch (cause) {
        return err(
          new FluiError(FLUI_E015, 'generation', 'LLM response parse failed: malformed JSON', {
            cause: cause instanceof Error ? cause : undefined,
            context: { contentLength: buffer.length },
          }),
        );
      }

      const result = uiSpecificationSchema.safeParse(parsed);
      if (!result.success) {
        return err(
          new FluiError(
            FLUI_E016,
            'generation',
            'UISpecification validation failed: schema mismatch',
            {
              context: {
                zodErrors: result.error.issues.map((issue) => ({
                  path: issue.path.join('.'),
                  message: issue.message,
                })),
              },
            },
          ),
        );
      }

      return ok(result.data);
    },
  };
}
