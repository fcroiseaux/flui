import { describe, expect, it } from 'vitest';
import { FLUI_E015, FLUI_E016 } from '../errors/error-codes';
import { isError, isOk } from '../errors/result';
import { SPEC_VERSION } from '../spec';
import { createStreamingSpecParser } from './streaming-spec-parser';

function makeValidSpecJson(): string {
  return JSON.stringify({
    version: SPEC_VERSION,
    components: [
      {
        id: 'btn-1',
        componentType: 'Button',
        props: { label: 'Click me' },
      },
    ],
    layout: { type: 'stack' },
    interactions: [],
    metadata: { generatedAt: 0 },
  });
}

function splitIntoChunks(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

describe('StreamingSpecParser', () => {
  it('finalize returns Result.ok for complete valid UISpecification', () => {
    const parser = createStreamingSpecParser();
    const json = makeValidSpecJson();
    const chunks = splitIntoChunks(json, 20);

    for (const chunk of chunks) {
      parser.processChunk(chunk);
    }

    const result = parser.finalize();
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.version).toBe(SPEC_VERSION);
    expect(result.value.components).toHaveLength(1);
    expect(result.value.components[0]?.componentType).toBe('Button');
  });

  it('processChunk returns undefined when no new structure detected', () => {
    const parser = createStreamingSpecParser();

    // Feed just the beginning of a JSON object — no complete component yet
    const result = parser.processChunk('{"version":"1.0.0","comp');
    expect(result).toBeUndefined();
  });

  it('processChunk returns Partial<UISpecification> when a new component is fully received', () => {
    const parser = createStreamingSpecParser();

    // Feed version and start of components array
    parser.processChunk(`{"version":"${SPEC_VERSION}","components":[`);

    // Feed a complete component object
    const result = parser.processChunk(
      '{"id":"btn-1","componentType":"Button","props":{"label":"Click me"}}',
    );

    expect(result).toBeDefined();
    if (!result) return;
    expect(result.version).toBe(SPEC_VERSION);
    expect(result.components).toHaveLength(1);
    expect(result.components?.[0]?.id).toBe('btn-1');
  });

  it('progressive detection: partial spec grows as components arrive', () => {
    const parser = createStreamingSpecParser();

    // Feed version and start of components
    parser.processChunk(`{"version":"${SPEC_VERSION}","components":[`);

    // First complete component
    const partial1 = parser.processChunk(
      '{"id":"c1","componentType":"Button","props":{"label":"A"}}',
    );
    expect(partial1).toBeDefined();
    expect(partial1?.components).toHaveLength(1);
    expect(partial1?.components?.[0]?.id).toBe('c1');

    // Comma separator
    parser.processChunk(',');

    // Second complete component
    const partial2 = parser.processChunk(
      '{"id":"c2","componentType":"Input","props":{"placeholder":"B"}}',
    );
    expect(partial2).toBeDefined();
    expect(partial2?.components).toHaveLength(2);
    expect(partial2?.components?.[1]?.id).toBe('c2');
  });

  it('emits section updates when layout and interactions become complete', () => {
    const parser = createStreamingSpecParser();

    parser.processChunk(`{"version":"${SPEC_VERSION}","components":[`);
    parser.processChunk('{"id":"c1","componentType":"Button","props":{"label":"A"}}');
    parser.processChunk('],"layout":{"type":"stack"}');
    const withInteractions = parser.processChunk(',"interactions":[');
    expect(withInteractions).toBeUndefined();

    const sectionPartial = parser.processChunk('{"source":"c1","target":"c1","event":"click"}]');

    expect(sectionPartial).toBeDefined();
    expect(sectionPartial?.layout?.type).toBe('stack');
    expect(sectionPartial?.interactions).toHaveLength(1);
    expect(sectionPartial?.interactions?.[0]?.event).toBe('click');
  });

  it('finalize on empty buffer returns FLUI_E015', () => {
    const parser = createStreamingSpecParser();

    const result = parser.finalize();

    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.error.code).toBe(FLUI_E015);
    expect(result.error.category).toBe('generation');
  });

  it('finalize on malformed JSON returns FLUI_E015', () => {
    const parser = createStreamingSpecParser();
    parser.processChunk('{not valid json at all!!!');

    const result = parser.finalize();

    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.error.code).toBe(FLUI_E015);
    expect(result.error.category).toBe('generation');
  });

  it('finalize on JSON that fails schema validation returns FLUI_E016 with Zod error details', () => {
    const parser = createStreamingSpecParser();
    const invalidSpec = JSON.stringify({
      version: SPEC_VERSION,
      components: 'not-an-array',
      layout: { type: 'stack' },
      interactions: [],
      metadata: { generatedAt: 0 },
    });
    parser.processChunk(invalidSpec);

    const result = parser.finalize();

    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.error.code).toBe(FLUI_E016);
    expect(result.error.category).toBe('generation');
    expect(result.error.context).toBeDefined();
    expect(result.error.context?.zodErrors).toBeDefined();
  });

  it('JSON extraction handles markdown code fences in stream', () => {
    const parser = createStreamingSpecParser();
    const json = makeValidSpecJson();
    parser.processChunk('```json\n');
    parser.processChunk(json);
    parser.processChunk('\n```');

    const result = parser.finalize();

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.version).toBe(SPEC_VERSION);
  });

  it('finalize on incomplete JSON (stream cut short) returns FLUI_E015', () => {
    const parser = createStreamingSpecParser();
    // Feed partial JSON — missing closing braces
    parser.processChunk('{"version":"1.0.0","components":[{"id":"btn-1"');

    const result = parser.finalize();

    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.error.code).toBe(FLUI_E015);
  });

  it('handles single-character chunks correctly', () => {
    const parser = createStreamingSpecParser();
    const json = makeValidSpecJson();

    for (const char of json) {
      parser.processChunk(char);
    }

    const result = parser.finalize();
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.version).toBe(SPEC_VERSION);
  });

  it('handles entire content in a single chunk', () => {
    const parser = createStreamingSpecParser();
    const json = makeValidSpecJson();
    parser.processChunk(json);

    const result = parser.finalize();
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.version).toBe(SPEC_VERSION);
  });
});
