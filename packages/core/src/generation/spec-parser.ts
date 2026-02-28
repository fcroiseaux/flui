import { err, FLUI_E015, FLUI_E016, FluiError, ok } from '../errors';
import { uiSpecificationSchema } from '../spec';
import type { LLMResponse } from '../types';
import type { SpecParser } from './generation.types';

/**
 * Recursively converts all `null` values to `undefined` in a parsed JSON tree.
 *
 * OpenAI Structured Outputs uses `anyOf: [{type}, {type: 'null'}]` for optional fields,
 * so the LLM returns explicit `null` values. Zod `.optional()` accepts `undefined` but
 * not `null`, so we normalise before validation.
 */
function nullToUndefined(value: unknown): unknown {
  if (value === null) return undefined;
  if (Array.isArray(value)) return value.map(nullToUndefined);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = nullToUndefined(v);
    }
    return out;
  }
  return value;
}

/**
 * Extracts JSON from LLM response content that may include markdown fences or surrounding text.
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
 * Creates a SpecParser that extracts, parses, and validates UISpecification from LLM responses.
 */
export function createSpecParser(): SpecParser {
  return {
    parse(response: LLMResponse) {
      const extracted = extractJson(response.content);

      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(extracted);
      } catch (cause) {
        return err(
          new FluiError(FLUI_E015, 'generation', 'LLM response parse failed: malformed JSON', {
            cause: cause instanceof Error ? cause : undefined,
            context: { contentLength: response.content.length },
          }),
        );
      }

      // Normalise null → undefined for OpenAI Structured Outputs compatibility
      const normalised = nullToUndefined(parsed);

      // Validate against UISpecification schema
      const result = uiSpecificationSchema.safeParse(normalised);
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
