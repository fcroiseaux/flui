import { describe, expect, it, vi } from 'vitest';
import type { AggregatedContext } from '../context/context.types';
import {
  FLUI_E009,
  FLUI_E010,
  FLUI_E014,
  FLUI_E015,
  FLUI_E016,
  FLUI_E017,
} from '../errors/error-codes';
import { FluiError } from '../errors/flui-error';
import { err, isError, isOk, ok } from '../errors/result';
import type { IntentObject } from '../intent/intent.types';
import type { SerializedRegistry } from '../registry/registry.types';
import { SPEC_VERSION } from '../spec';
import type { GenerationChunk, LLMConnector, LLMResponse, StreamingLLMConnector } from '../types';
import { createTrace } from '../types';
import type { GenerationConfig, GenerationInput } from './generation.types';
import { createStreamingOrchestrator } from './streaming-orchestrator';

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

function splitJsonIntoChunks(json: string, chunkSize: number): GenerationChunk[] {
  const chunks: GenerationChunk[] = [];
  for (let i = 0; i < json.length; i += chunkSize) {
    const isLast = i + chunkSize >= json.length;
    chunks.push({
      delta: json.slice(i, i + chunkSize),
      done: isLast,
      model: isLast ? 'gpt-4o' : undefined,
      usage: isLast ? { promptTokens: 100, completionTokens: 50, totalTokens: 150 } : undefined,
    });
  }
  return chunks;
}

function createMockStreamingConnector(chunks: GenerationChunk[]): StreamingLLMConnector {
  return {
    generate: vi.fn().mockResolvedValue(
      ok({
        content: chunks.map((c) => c.delta).join(''),
        model: 'gpt-4o',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      } satisfies LLMResponse),
    ),
    streamGenerate: vi.fn().mockResolvedValue(
      ok(
        (async function* () {
          for (const chunk of chunks) {
            yield chunk;
          }
        })(),
      ),
    ),
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

function makeStreamingConfig(connectorOverride?: Partial<StreamingLLMConnector>): GenerationConfig {
  const chunks = splitJsonIntoChunks(makeValidSpecJson(), 30);
  const connector = {
    ...createMockStreamingConnector(chunks),
    ...connectorOverride,
  };
  return {
    connector,
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4096,
  };
}

describe('StreamingOrchestrator', () => {
  it('returns Result.ok(UISpecification) on successful streaming generation', async () => {
    const chunks = splitJsonIntoChunks(makeValidSpecJson(), 30);
    const connector = createMockStreamingConnector(chunks);
    const config: GenerationConfig = { connector, model: 'gpt-4o' };
    const orchestrator = createStreamingOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();

    const result = await orchestrator.generateStream(input, trace);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.version).toBe(SPEC_VERSION);
    expect(result.value.components).toHaveLength(1);
    expect(result.value.components[0]?.componentType).toBe('Button');
  });

  it('invokes onProgress callbacks with progressive partial specs', async () => {
    // Create a spec with two components to get progressive callbacks
    const twoComponentSpec = JSON.stringify({
      version: SPEC_VERSION,
      components: [
        { id: 'btn-1', componentType: 'Button', props: { label: 'A' } },
        { id: 'btn-2', componentType: 'Button', props: { label: 'B' } },
      ],
      layout: { type: 'stack' },
      interactions: [],
      metadata: { generatedAt: 0 },
    });
    // Use small chunks so components arrive progressively
    const chunks = splitJsonIntoChunks(twoComponentSpec, 15);
    const connector = createMockStreamingConnector(chunks);
    const config: GenerationConfig = { connector, model: 'gpt-4o' };
    const orchestrator = createStreamingOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();
    const onProgress = vi.fn();

    const result = await orchestrator.generateStream(input, trace, { onProgress });

    expect(isOk(result)).toBe(true);
    // onProgress should have been called at least once (progressive detection is best-effort)
    expect(onProgress.mock.calls.length).toBeGreaterThanOrEqual(1);
    // Each call should receive a Partial<UISpecification>
    for (const call of onProgress.mock.calls) {
      expect(call[0]).toBeDefined();
    }
    const firstPartial = onProgress.mock.calls[0]?.[0] as { components?: unknown[] } | undefined;
    expect(firstPartial?.components?.length).toBeGreaterThanOrEqual(1);
  });

  it('works without onProgress callback (no error)', async () => {
    const chunks = splitJsonIntoChunks(makeValidSpecJson(), 30);
    const connector = createMockStreamingConnector(chunks);
    const config: GenerationConfig = { connector, model: 'gpt-4o' };
    const orchestrator = createStreamingOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();

    const result = await orchestrator.generateStream(input, trace);

    expect(isOk(result)).toBe(true);
  });

  it('time-to-first-progress-callback P50 < 100ms (excluding mock network time)', async () => {
    const twoComponentSpec = JSON.stringify({
      version: SPEC_VERSION,
      components: [
        { id: 'btn-1', componentType: 'Button', props: { label: 'A' } },
        { id: 'btn-2', componentType: 'Button', props: { label: 'B' } },
      ],
      layout: { type: 'stack' },
      interactions: [],
      metadata: { generatedAt: 0 },
    });

    const durations: number[] = [];

    for (let i = 0; i < 50; i++) {
      const chunks = splitJsonIntoChunks(twoComponentSpec, 15);
      const connector = createMockStreamingConnector(chunks);
      const config: GenerationConfig = { connector, model: 'gpt-4o' };
      const orchestrator = createStreamingOrchestrator(config);
      const trace = createTrace();
      const input = makeInput();

      let firstCallbackTime: number | undefined;
      const startTime = Date.now();
      const onProgress = vi.fn().mockImplementation(() => {
        if (firstCallbackTime === undefined) {
          firstCallbackTime = Date.now() - startTime;
        }
      });

      await orchestrator.generateStream(input, trace, { onProgress });

      if (firstCallbackTime !== undefined) {
        durations.push(firstCallbackTime);
      }
    }

    if (durations.length > 0) {
      const sorted = [...durations].sort((a, b) => a - b);
      const p50Index = Math.min(sorted.length - 1, Math.ceil(0.5 * sorted.length) - 1);
      const p50 = sorted[p50Index] ?? 0;
      expect(p50).toBeLessThan(100);
    }
  });

  it('subsequent progress callback intervals are < 50ms in a local stream run', async () => {
    const threeComponentSpec = JSON.stringify({
      version: SPEC_VERSION,
      components: [
        { id: 'btn-1', componentType: 'Button', props: { label: 'A' } },
        { id: 'btn-2', componentType: 'Button', props: { label: 'B' } },
        { id: 'btn-3', componentType: 'Button', props: { label: 'C' } },
      ],
      layout: { type: 'stack' },
      interactions: [{ source: 'btn-1', target: 'btn-2', event: 'click' }],
      metadata: { generatedAt: 0 },
    });

    const chunks = splitJsonIntoChunks(threeComponentSpec, 10);
    const connector = createMockStreamingConnector(chunks);
    const config: GenerationConfig = { connector, model: 'gpt-4o' };
    const orchestrator = createStreamingOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();
    const callbackTimes: number[] = [];

    const result = await orchestrator.generateStream(input, trace, {
      onProgress: () => {
        callbackTimes.push(Date.now());
      },
    });

    expect(isOk(result)).toBe(true);
    expect(callbackTimes.length).toBeGreaterThanOrEqual(2);

    for (let i = 1; i < callbackTimes.length; i++) {
      const interval = (callbackTimes[i] ?? 0) - (callbackTimes[i - 1] ?? 0);
      expect(interval).toBeLessThan(50);
    }
  });

  it('returns FLUI_E010 when AbortSignal is pre-aborted', async () => {
    const config = makeStreamingConfig();
    const orchestrator = createStreamingOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();
    const controller = new AbortController();
    controller.abort();

    const result = await orchestrator.generateStream(input, trace, undefined, controller.signal);

    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.error.code).toBe(FLUI_E010);
    expect(result.error.category).toBe('generation');
  });

  it('returns FLUI_E010 when AbortSignal is aborted mid-stream', async () => {
    const controller = new AbortController();
    const chunks: GenerationChunk[] = [
      { delta: '{"version":', done: false },
      { delta: '"1.0.0"', done: false },
    ];

    const connector: StreamingLLMConnector = {
      generate: vi.fn(),
      streamGenerate: vi.fn().mockResolvedValue(
        ok(
          (async function* () {
            yield chunks[0] as GenerationChunk;
            controller.abort();
            yield chunks[1] as GenerationChunk;
          })(),
        ),
      ),
    };

    const config: GenerationConfig = { connector, model: 'gpt-4o' };
    const orchestrator = createStreamingOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();

    const result = await orchestrator.generateStream(input, trace, undefined, controller.signal);

    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.error.code).toBe(FLUI_E010);
  });

  it('returns FLUI_E009 for non-streaming connector', async () => {
    const nonStreamingConnector: LLMConnector = {
      generate: vi.fn(),
    };
    const config: GenerationConfig = { connector: nonStreamingConnector, model: 'gpt-4o' };
    const orchestrator = createStreamingOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();

    const result = await orchestrator.generateStream(input, trace);

    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.error.code).toBe(FLUI_E009);
    expect(result.error.category).toBe('generation');
  });

  it('returns FLUI_E017 when stream throws an error during iteration', async () => {
    const connector: StreamingLLMConnector = {
      generate: vi.fn(),
      streamGenerate: vi.fn().mockResolvedValue(
        ok(
          (async function* () {
            yield { delta: '{"version":', done: false };
            throw new Error('Network connection lost');
          })(),
        ),
      ),
    };

    const config: GenerationConfig = { connector, model: 'gpt-4o' };
    const orchestrator = createStreamingOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();

    const result = await orchestrator.generateStream(input, trace);

    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.error.code).toBe(FLUI_E017);
    expect(result.error.category).toBe('generation');
    expect(trace.steps).toHaveLength(2);
    expect(trace.steps[1]?.operation).toBe('streamConsume');
    expect(trace.steps[1]?.metadata.failurePoint).toBe('stream-iteration');
  });

  it('returns FLUI_E015 or FLUI_E016 for valid stream with invalid JSON content', async () => {
    const chunks: GenerationChunk[] = [
      { delta: 'this is not valid json', done: true, model: 'gpt-4o' },
    ];
    const connector = createMockStreamingConnector(chunks);
    const config: GenerationConfig = { connector, model: 'gpt-4o' };
    const orchestrator = createStreamingOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();

    const result = await orchestrator.generateStream(input, trace);

    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect([FLUI_E015, FLUI_E016]).toContain(result.error.code);
  });

  it('propagates connector error when streamGenerate returns Result.error', async () => {
    const connectorError = new FluiError(FLUI_E014, 'connector', 'API timeout');
    const connector: StreamingLLMConnector = {
      generate: vi.fn(),
      streamGenerate: vi.fn().mockResolvedValue(err(connectorError)),
    };
    const config: GenerationConfig = { connector, model: 'gpt-4o' };
    const orchestrator = createStreamingOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();

    const result = await orchestrator.generateStream(input, trace);

    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.error.code).toBe(FLUI_E014);
    expect(result.error).toBe(connectorError);
  });

  it('adds 3 trace steps (constructPrompt, streamConsume, parseResponse) on success', async () => {
    const chunks = splitJsonIntoChunks(makeValidSpecJson(), 30);
    const connector = createMockStreamingConnector(chunks);
    const config: GenerationConfig = { connector, model: 'gpt-4o' };
    const orchestrator = createStreamingOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();

    await orchestrator.generateStream(input, trace);

    expect(trace.steps).toHaveLength(3);
    expect(trace.steps[0]?.operation).toBe('constructPrompt');
    expect(trace.steps[1]?.operation).toBe('streamConsume');
    expect(trace.steps[2]?.operation).toBe('parseResponse');
  });

  it('trace steps have correct module ("generation") and durationMs >= 0', async () => {
    const chunks = splitJsonIntoChunks(makeValidSpecJson(), 30);
    const connector = createMockStreamingConnector(chunks);
    const config: GenerationConfig = { connector, model: 'gpt-4o' };
    const orchestrator = createStreamingOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();

    await orchestrator.generateStream(input, trace);

    for (const step of trace.steps) {
      expect(step.module).toBe('generation');
      expect(step.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('does not include API keys or raw responses in trace metadata (NFR-S6)', async () => {
    const chunks = splitJsonIntoChunks(makeValidSpecJson(), 30);
    const connector = createMockStreamingConnector(chunks);
    const config: GenerationConfig = { connector, model: 'gpt-4o' };
    const orchestrator = createStreamingOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();

    await orchestrator.generateStream(input, trace);

    for (const step of trace.steps) {
      const metadataStr = JSON.stringify(step.metadata);
      expect(metadataStr).not.toMatch(/api[_\s]*key/i);
      expect(metadataStr).not.toMatch(/secret/i);
      expect(metadataStr).not.toMatch(/authorization/i);
      expect(metadataStr).not.toMatch(/rawResponse/i);
    }
  });

  it('enriches metadata (model, traceId, generatedAt, usage) on successful result', async () => {
    const chunks = splitJsonIntoChunks(makeValidSpecJson(), 30);
    const connector = createMockStreamingConnector(chunks);
    const config: GenerationConfig = { connector, model: 'gpt-4o' };
    const orchestrator = createStreamingOrchestrator(config);
    const trace = createTrace({ id: 'test-trace-456' });
    const input = makeInput();
    const beforeTime = Date.now();

    const result = await orchestrator.generateStream(input, trace);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.metadata.model).toBe('gpt-4o');
    expect(result.value.metadata.traceId).toBe('test-trace-456');
    expect(result.value.metadata.generatedAt).toBeGreaterThanOrEqual(beforeTime);
    expect(result.value.metadata.custom).toBeDefined();
    expect(result.value.metadata.custom?.usage).toStrictEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
  });

  it('generate() method delegates to non-streaming orchestrator correctly', async () => {
    const chunks = splitJsonIntoChunks(makeValidSpecJson(), 30);
    const connector = createMockStreamingConnector(chunks);
    const config: GenerationConfig = { connector, model: 'gpt-4o' };
    const orchestrator = createStreamingOrchestrator(config);
    const trace = createTrace();
    const input = makeInput();

    const result = await orchestrator.generate(input, trace);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.version).toBe(SPEC_VERSION);
    // Should have called generate, not streamGenerate
    expect(connector.generate).toHaveBeenCalledOnce();
    expect(connector.streamGenerate).not.toHaveBeenCalled();
  });
});
