import { describe, expect, it } from 'vitest';
import { FLUI_E015, FLUI_E016 } from '../errors/error-codes';
import type { FluiError } from '../errors/flui-error';
import { isError, isOk } from '../errors/result';
import { SPEC_VERSION } from '../spec';
import type { LLMResponse } from '../types';
import { createSpecParser } from './spec-parser';

function makeValidSpec(): object {
  return {
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
    metadata: { generatedAt: Date.now() },
  };
}

function makeLLMResponse(content: string): LLMResponse {
  return {
    content,
    model: 'gpt-4o',
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
  };
}

describe('SpecParser', () => {
  const parser = createSpecParser();

  it('successfully parses valid UISpecification JSON', () => {
    const spec = makeValidSpec();
    const response = makeLLMResponse(JSON.stringify(spec));
    const result = parser.parse(response);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.version).toBe(SPEC_VERSION);
    expect(result.value.components).toHaveLength(1);
    expect(result.value.components[0]?.componentType).toBe('Button');
  });

  it('parses JSON wrapped in markdown code fences', () => {
    const spec = makeValidSpec();
    const wrapped = `\`\`\`json\n${JSON.stringify(spec, null, 2)}\n\`\`\``;
    const response = makeLLMResponse(wrapped);
    const result = parser.parse(response);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.version).toBe(SPEC_VERSION);
  });

  it('parses JSON wrapped in plain code fences', () => {
    const spec = makeValidSpec();
    const wrapped = `\`\`\`\n${JSON.stringify(spec, null, 2)}\n\`\`\``;
    const response = makeLLMResponse(wrapped);
    const result = parser.parse(response);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.version).toBe(SPEC_VERSION);
  });

  it('returns FLUI_E015 on malformed JSON', () => {
    const response = makeLLMResponse('{ invalid json }');
    const result = parser.parse(response);

    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.error.code).toBe(FLUI_E015);
    expect(result.error.category).toBe('generation');
  });

  it('returns FLUI_E015 on empty response content', () => {
    const response = makeLLMResponse('');
    const result = parser.parse(response);

    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.error.code).toBe(FLUI_E015);
    expect(result.error.category).toBe('generation');
  });

  it('returns FLUI_E016 on JSON that fails UISpecification schema validation', () => {
    const invalidSpec = {
      version: SPEC_VERSION,
      components: 'not-an-array',
      layout: { type: 'stack' },
      interactions: [],
      metadata: { generatedAt: Date.now() },
    };
    const response = makeLLMResponse(JSON.stringify(invalidSpec));
    const result = parser.parse(response);

    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.error.code).toBe(FLUI_E016);
    expect(result.error.category).toBe('generation');
  });

  it('strips unknown fields and parses successfully', () => {
    const specWithExtra = {
      version: SPEC_VERSION,
      components: [
        {
          id: 'btn-1',
          componentType: 'Button',
          props: { label: 'ok' },
          unknownField: true,
        },
      ],
      layout: { type: 'stack' },
      interactions: [],
      metadata: { generatedAt: Date.now() },
    };
    const response = makeLLMResponse(JSON.stringify(specWithExtra));
    const result = parser.parse(response);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect((result.value.components[0] as Record<string, unknown>)['unknownField']).toBeUndefined();
  });

  it('converts null optional fields to undefined (OpenAI Structured Outputs compat)', () => {
    const spec = {
      version: SPEC_VERSION,
      components: [
        {
          id: 'btn-1',
          componentType: 'Button',
          props: { label: 'Click me' },
          key: null,
          children: null,
        },
      ],
      layout: { type: 'stack', direction: null, spacing: null, alignment: null, children: null },
      interactions: [
        { source: 'a', target: 'b', event: 'click', dataMapping: null },
      ],
      metadata: {
        generatedAt: Date.now(),
        model: null,
        intentHash: null,
        traceId: null,
        custom: null,
      },
    };
    const response = makeLLMResponse(JSON.stringify(spec));
    const result = parser.parse(response);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.version).toBe(SPEC_VERSION);
    expect(result.value.components[0]?.children).toBeUndefined();
    expect(result.value.metadata.model).toBeUndefined();
    expect(result.value.metadata.intentHash).toBeUndefined();
    expect(result.value.metadata.traceId).toBeUndefined();
    expect(result.value.metadata.custom).toBeUndefined();
  });

  it('extracts JSON preceded by text', () => {
    const spec = makeValidSpec();
    const withText = `Here is your specification:\n${JSON.stringify(spec)}`;
    const response = makeLLMResponse(withText);
    const result = parser.parse(response);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.version).toBe(SPEC_VERSION);
  });
});
