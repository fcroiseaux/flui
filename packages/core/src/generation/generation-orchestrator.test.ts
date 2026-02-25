import { describe, expect, it, vi } from 'vitest';
import type { AggregatedContext } from '../context/context.types';
import { FLUI_E010, FLUI_E014, FLUI_E015, FLUI_E016 } from '../errors/error-codes';
import { FluiError } from '../errors/flui-error';
import { err, isError, isOk, ok } from '../errors/result';
import type { IntentObject } from '../intent/intent.types';
import type { SerializedRegistry } from '../registry/registry.types';
import { SPEC_VERSION } from '../spec';
import type { LLMConnector, LLMResponse } from '../types';
import { createTrace } from '../types';
import type { GenerationConfig, GenerationInput } from './generation.types';
import { createGenerationOrchestrator } from './generation-orchestrator';

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
}

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

function makeLLMResponse(content: string): LLMResponse {
  return {
    content,
    model: 'gpt-4o',
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
  };
}

function makeInput(): GenerationInput {
  const intent: IntentObject = {
    originalText: 'show a button',
    sanitizedText: 'show a button',
    signals: {},
    source: 'text',
  };

  const context: AggregatedContext = {
    identity: { role: 'user' },
  };

  const registry: SerializedRegistry = {
    version: 1,
    components: [
      {
        name: 'Button',
        category: 'input',
        description: 'A clickable button',
        propsSchema: { type: 'object' },
      },
    ],
  };

  return { intent, context, registry };
}

function makeConfig(connectorOverride?: Partial<LLMConnector>): GenerationConfig {
  const connector: LLMConnector = {
    generate: vi.fn().mockResolvedValue(ok(makeLLMResponse(makeValidSpecJson()))),
    ...connectorOverride,
  };
  return {
    connector,
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4096,
  };
}

describe('GenerationOrchestrator', () => {
  it('returns Result.ok(UISpecification) on successful generation', async () => {
    const config = makeConfig();
    const orchestrator = createGenerationOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();

    const result = await orchestrator.generate(input, trace);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.version).toBe(SPEC_VERSION);
    expect(result.value.components).toHaveLength(1);
    expect(result.value.components[0]?.componentType).toBe('Button');
  });

  it('enriches metadata with model, traceId, and generatedAt', async () => {
    const config = makeConfig();
    const orchestrator = createGenerationOrchestrator(config);
    const trace = createTrace({ id: 'test-trace-123' });
    const input = makeInput();
    const beforeTime = Date.now();

    const result = await orchestrator.generate(input, trace);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.metadata.model).toBe('gpt-4o');
    expect(result.value.metadata.traceId).toBe('test-trace-123');
    expect(result.value.metadata.generatedAt).toBeGreaterThanOrEqual(beforeTime);
    expect(result.value.metadata.custom).toBeDefined();
    expect(result.value.metadata.custom?.usage).toStrictEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
  });

  it('returns FLUI_E010 when AbortSignal is pre-aborted', async () => {
    const config = makeConfig();
    const orchestrator = createGenerationOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();
    const controller = new AbortController();
    controller.abort();

    const result = await orchestrator.generate(input, trace, controller.signal);

    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.error.code).toBe(FLUI_E010);
    expect(result.error.category).toBe('generation');
    // Connector should NOT have been called
    expect(config.connector.generate).not.toHaveBeenCalled();
  });

  it('returns FLUI_E010 when AbortSignal is aborted mid-flight', async () => {
    const controller = new AbortController();
    const connector: LLMConnector = {
      generate: vi.fn().mockImplementation(async () => {
        controller.abort();
        return ok(makeLLMResponse(makeValidSpecJson()));
      }),
    };
    const config: GenerationConfig = { connector, model: 'gpt-4o' };
    const orchestrator = createGenerationOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();

    const result = await orchestrator.generate(input, trace, controller.signal);

    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.error.code).toBe(FLUI_E010);
  });

  it('propagates connector error as-is', async () => {
    const connectorError = new FluiError(FLUI_E014, 'connector', 'API timeout');
    const connector: LLMConnector = {
      generate: vi.fn().mockResolvedValue(err(connectorError)),
    };
    const config: GenerationConfig = { connector, model: 'gpt-4o' };
    const orchestrator = createGenerationOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();

    const result = await orchestrator.generate(input, trace);

    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.error.code).toBe(FLUI_E014);
    expect(result.error).toBe(connectorError);
  });

  it('propagates parse failure (FLUI_E015) for malformed JSON', async () => {
    const connector: LLMConnector = {
      generate: vi.fn().mockResolvedValue(ok(makeLLMResponse('not json at all'))),
    };
    const config: GenerationConfig = { connector, model: 'gpt-4o' };
    const orchestrator = createGenerationOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();

    const result = await orchestrator.generate(input, trace);

    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.error.code).toBe(FLUI_E015);
  });

  it('propagates parse failure (FLUI_E016) for schema mismatch', async () => {
    const invalidSpec = JSON.stringify({
      version: SPEC_VERSION,
      components: 'not-an-array',
      layout: { type: 'stack' },
      interactions: [],
      metadata: { generatedAt: 0 },
    });
    const connector: LLMConnector = {
      generate: vi.fn().mockResolvedValue(ok(makeLLMResponse(invalidSpec))),
    };
    const config: GenerationConfig = { connector, model: 'gpt-4o' };
    const orchestrator = createGenerationOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();

    const result = await orchestrator.generate(input, trace);

    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.error.code).toBe(FLUI_E016);
  });

  it('adds 3 trace steps (constructPrompt, callConnector, parseResponse) on success', async () => {
    const config = makeConfig();
    const orchestrator = createGenerationOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();

    await orchestrator.generate(input, trace);

    expect(trace.steps).toHaveLength(3);
    expect(trace.steps[0]?.operation).toBe('constructPrompt');
    expect(trace.steps[1]?.operation).toBe('callConnector');
    expect(trace.steps[2]?.operation).toBe('parseResponse');
  });

  it('trace steps have correct module ("generation") and durationMs >= 0', async () => {
    const config = makeConfig();
    const orchestrator = createGenerationOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();

    await orchestrator.generate(input, trace);

    for (const step of trace.steps) {
      expect(step.module).toBe('generation');
      expect(step.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('does not include API keys or raw responses in trace metadata (NFR-S6)', async () => {
    const config = makeConfig();
    const orchestrator = createGenerationOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();

    await orchestrator.generate(input, trace);

    for (const step of trace.steps) {
      const metadataStr = JSON.stringify(step.metadata);
      expect(metadataStr).not.toMatch(/api[_\s]*key/i);
      expect(metadataStr).not.toMatch(/secret/i);
      expect(metadataStr).not.toMatch(/authorization/i);
      expect(metadataStr).not.toMatch(/rawResponse/i);
      // Should not contain the raw LLM response content
      expect(metadataStr).not.toContain(makeValidSpecJson());
    }
  });

  it('passes correct LLMRequestOptions to connector', async () => {
    const config = makeConfig();
    config.temperature = 0.5;
    config.maxTokens = 2048;
    const orchestrator = createGenerationOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();

    await orchestrator.generate(input, trace);

    expect(config.connector.generate).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(config.connector.generate).mock.calls[0];
    expect(callArgs).toBeDefined();
    const options = callArgs?.[1];
    expect(options?.model).toBe('gpt-4o');
    expect(options?.temperature).toBe(0.5);
    expect(options?.maxTokens).toBe(2048);
    expect(options?.responseFormat).toBe('json');
  });

  it('keeps orchestration overhead under AC6 latency targets (excluding network time)', async () => {
    const config = makeConfig();
    const orchestrator = createGenerationOrchestrator(config);
    const input = makeInput();
    const durations: number[] = [];

    for (let i = 0; i < 100; i += 1) {
      const trace = createTrace();
      const start = Date.now();
      const result = await orchestrator.generate(input, trace);
      const duration = Date.now() - start;
      expect(isOk(result)).toBe(true);
      durations.push(duration);
    }

    const p50 = percentile(durations, 50);
    const p99 = percentile(durations, 99);
    expect(p50).toBeLessThan(500);
    expect(p99).toBeLessThan(2000);
  });
});
