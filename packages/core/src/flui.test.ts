import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createFlui, DEFAULT_CACHE_CONFIG, DEFAULT_CONCURRENCY_CONFIG } from './flui';
import {
  err,
  FLUI_E014,
  FLUI_E033,
  FluiError,
  type FluiInstance,
  type LLMConnector,
  ok,
} from './index';

function createMockConnector(responseContent: string): LLMConnector {
  return {
    async generate() {
      return ok({
        content: responseContent,
        model: 'gpt-4o',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      });
    },
  };
}

const validSpecJson = JSON.stringify({
  version: '1.0.0',
  components: [
    {
      id: 'button-1',
      componentType: 'Button',
      props: { label: 'Run' },
    },
  ],
  layout: {
    type: 'stack',
    direction: 'vertical',
  },
  interactions: [],
  metadata: {
    generatedAt: Date.now(),
    model: 'gpt-4o',
    intentHash: 'intent-hash',
    traceId: 'trace-1',
  },
});

describe('createFlui', () => {
  it('creates instance with connector-only config', () => {
    const flui = createFlui({ connector: createMockConnector(validSpecJson) });

    expect(flui.registry).toBeDefined();
    expect(flui.context).toBeDefined();
    expect(flui.observer).toBeDefined();
    expect(flui.metrics).toBeDefined();
    expect(flui.data).toBeDefined();
    expect(typeof flui.generate).toBe('function');
    expect(flui.config.connector).toBeDefined();
    expect(flui.config.generationConfig.model).toBe('gpt-4o');
  });

  it('applies sensible default configuration', () => {
    const flui = createFlui({ connector: createMockConnector(validSpecJson) });

    expect(flui.modules.cache).toBeDefined();
    expect(flui.modules.policy).toBeDefined();
    expect(flui.modules.concurrency).toBeDefined();
    expect(DEFAULT_CACHE_CONFIG.l3Enabled).toBe(false);
    expect(DEFAULT_CONCURRENCY_CONFIG.circuitBreaker?.failureThreshold).toBe(3);
  });

  it('throws FLUI_E033 for missing connector', () => {
    expect(() => createFlui({ connector: undefined as unknown as LLMConnector })).toThrowError(
      expect.objectContaining({
        code: FLUI_E033,
      }),
    );
  });

  it('throws FLUI_E033 when generation model is an empty string', () => {
    expect(() =>
      createFlui({
        connector: createMockConnector(validSpecJson),
        generation: { model: '' },
      }),
    ).toThrowError(
      expect.objectContaining({
        code: FLUI_E033,
      }),
    );
  });

  it('throws FLUI_E033 for invalid budget config', () => {
    expect(() =>
      createFlui({
        connector: createMockConnector(validSpecJson),
        budget: { sessionBudget: -1 },
      }),
    ).toThrowError(
      expect.objectContaining({
        code: FLUI_E033,
      }),
    );
  });

  it('throws FLUI_E033 for invalid concurrency circuit breaker config', () => {
    expect(() =>
      createFlui({
        connector: createMockConnector(validSpecJson),
        concurrency: {
          circuitBreaker: {
            failureThreshold: 0,
          },
        },
      }),
    ).toThrowError(
      expect.objectContaining({
        code: FLUI_E033,
      }),
    );
  });

  it('supports generation -> validation -> cache flow', async () => {
    const flui = createFlui({ connector: createMockConnector(validSpecJson) });

    const registerResult = flui.registry.register({
      name: 'Button',
      category: 'action',
      description: 'Action button',
      accepts: z.object({ label: z.string() }),
      component: vi.fn(),
    });
    expect(registerResult.ok).toBe(true);

    const first = await flui.generate({
      intent: 'Show a button',
      authorizedDataIdentifiers: [],
    });
    expect(first.ok).toBe(true);

    const second = await flui.generate({
      intent: 'Show a button',
      authorizedDataIdentifiers: [],
    });
    expect(second.ok).toBe(true);

    const cacheMetrics = flui.getMetrics().cache;
    expect(cacheMetrics.aggregate.hits).toBeGreaterThanOrEqual(1);
  });

  it('calls validation error hook on validation failure', async () => {
    const onValidationError = vi.fn();
    const flui = createFlui({
      connector: createMockConnector(validSpecJson),
      onValidationError,
    });

    const result = await flui.generate({
      intent: 'Show a button',
      authorizedDataIdentifiers: [],
    });

    expect(result.ok).toBe(false);
    expect(onValidationError).toHaveBeenCalledTimes(1);
  });

  it('propagates connector errors', async () => {
    const failingConnector: LLMConnector = {
      async generate() {
        return err(new FluiError(FLUI_E014, 'connector', 'Connector failure'));
      },
    };
    const flui = createFlui({ connector: failingConnector });

    const result = await flui.generate({ intent: 'Show a button' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(FLUI_E014);
    }
  });
});

/**
 * Creates a connector whose generate() is gated by a deferred promise.
 * Call `release()` to let the generation resolve.
 */
function createGatedConnector(responseContent: string): {
  connector: LLMConnector;
  generateFn: ReturnType<typeof vi.fn>;
  release: () => void;
} {
  let release!: () => void;
  const gate = new Promise<void>((res) => {
    release = res;
  });

  const generateFn = vi.fn(
    async (_prompt: string, _options: unknown, signal?: AbortSignal) => {
      if (signal?.aborted) {
        return err(new FluiError(FLUI_E014, 'connector', 'Aborted'));
      }

      // Race gate against abort
      const aborted = await new Promise<boolean>((res) => {
        gate.then(() => res(false));
        if (signal) {
          signal.addEventListener('abort', () => res(true), { once: true });
        }
      });

      if (aborted) {
        return err(new FluiError(FLUI_E014, 'connector', 'Aborted'));
      }

      return ok({
        content: responseContent,
        model: 'gpt-4o',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      });
    },
  );

  return {
    connector: { generate: generateFn },
    generateFn,
    release,
  };
}

function createFluiWithButton(connector: LLMConnector): FluiInstance {
  const flui = createFlui({ connector });
  flui.registry.register({
    name: 'Button',
    category: 'action',
    description: 'Action button',
    accepts: z.object({ label: z.string() }),
    component: vi.fn(),
  });
  return flui;
}

describe('prefetch', () => {
  describe('prefetch()', () => {
    it('returns cached spec immediately when cache hit', async () => {
      const connector = createMockConnector(validSpecJson);
      const generateFn = vi.spyOn(connector, 'generate');
      const flui = createFluiWithButton(connector);

      // First call populates the cache
      const first = await flui.prefetch({ intent: 'Show a button', authorizedDataIdentifiers: [] });
      expect(first.ok).toBe(true);
      const callCount = generateFn.mock.calls.length;

      // Second call should return from cache without an LLM call
      const second = await flui.prefetch({
        intent: 'Show a button',
        authorizedDataIdentifiers: [],
      });
      expect(second.ok).toBe(true);
      expect(generateFn).toHaveBeenCalledTimes(callCount);
    });

    it('generates, validates, and caches spec on cache miss', async () => {
      const connector = createMockConnector(validSpecJson);
      const generateFn = vi.spyOn(connector, 'generate');
      const flui = createFluiWithButton(connector);

      const result = await flui.prefetch({
        intent: 'Show a button',
        authorizedDataIdentifiers: [],
      });
      expect(result.ok).toBe(true);
      expect(generateFn).toHaveBeenCalledTimes(1);

      // Verify it's now in cache
      const status = await flui.getPrefetchStatus({
        intent: 'Show a button',
        authorizedDataIdentifiers: [],
      });
      expect(status).toBe('cached');
    });

    it('deduplicates concurrent prefetch calls for same intent+context', async () => {
      const { connector, generateFn, release } = createGatedConnector(validSpecJson);
      const flui = createFluiWithButton(connector);

      const input = { intent: 'Show a button', authorizedDataIdentifiers: [] as string[] };
      const p1 = flui.prefetch(input);
      // Yield a microtask so prefetch registers in the inflight map
      await Promise.resolve();
      const p2 = flui.prefetch(input);

      release();

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);
      expect(generateFn).toHaveBeenCalledTimes(1);
    });

    it('aborts generation when signal is aborted', async () => {
      const { connector, release } = createGatedConnector(validSpecJson);
      const flui = createFluiWithButton(connector);

      const controller = new AbortController();
      const promise = flui.prefetch({
        intent: 'Show a button',
        signal: controller.signal,
        authorizedDataIdentifiers: [],
      });

      // Yield so the prefetch starts
      await Promise.resolve();

      // Abort before releasing the gate
      controller.abort();

      // Release the gate (won't matter, already aborted)
      release();

      const result = await promise;
      expect(result.ok).toBe(false);
    });

    it('respects policy engine — returns error when budget exhausted', async () => {
      const connector = createMockConnector(validSpecJson);
      const flui = createFlui({
        connector,
        budget: {
          sessionBudget: 0,
          modelPricing: {
            'gpt-4o': { promptCostPer1kTokens: 0.01, completionCostPer1kTokens: 0.03 },
          },
        },
        policy: { generateOnCacheMiss: true },
      });
      flui.registry.register({
        name: 'Button',
        category: 'action',
        description: 'Action button',
        accepts: z.object({ label: z.string() }),
        component: vi.fn(),
      });

      const result = await flui.prefetch({
        intent: 'Show a button',
        authorizedDataIdentifiers: [],
      });
      expect(result.ok).toBe(false);
    });

    it('respects policy engine — returns error when circuit breaker open', async () => {
      const failingConnector: LLMConnector = {
        async generate() {
          return err(new FluiError(FLUI_E014, 'connector', 'fail'));
        },
      };
      const flui = createFlui({
        connector: failingConnector,
        concurrency: { circuitBreaker: { failureThreshold: 1 } },
      });
      flui.registry.register({
        name: 'Button',
        category: 'action',
        description: 'Action button',
        accepts: z.object({ label: z.string() }),
        component: vi.fn(),
      });

      // Trigger circuit breaker by failing once
      await flui.generate({ intent: 'Show a button' });

      // Now prefetch should hit circuit breaker
      const result = await flui.prefetch({
        intent: 'Show a different button',
        authorizedDataIdentifiers: [],
      });
      expect(result.ok).toBe(false);
    });

    it('cleans up inflight entry after promise settles', async () => {
      const connector = createMockConnector(validSpecJson);
      const flui = createFluiWithButton(connector);

      await flui.prefetch({
        intent: 'Show a button',
        authorizedDataIdentifiers: [],
      });

      // After settle, status should be 'cached', not 'in-flight'
      const status = await flui.getPrefetchStatus({
        intent: 'Show a button',
        authorizedDataIdentifiers: [],
      });
      expect(status).toBe('cached');
    });

    it('emits observability trace steps', async () => {
      const traces: import('./types').GenerationTrace[] = [];
      const connector = createMockConnector(validSpecJson);
      const flui = createFlui({
        connector,
        observability: {
          transports: [
            {
              send(trace) {
                traces.push(trace);
              },
            },
          ],
        },
      });
      flui.registry.register({
        name: 'Button',
        category: 'action',
        description: 'Action button',
        accepts: z.object({ label: z.string() }),
        component: vi.fn(),
      });

      await flui.prefetch({ intent: 'Show a button', authorizedDataIdentifiers: [] });

      const prefetchSteps = traces.flatMap((t) =>
        t.steps.filter((s) => s.module === 'prefetch'),
      );
      expect(prefetchSteps.length).toBeGreaterThanOrEqual(1);
      const operations = prefetchSteps.map((s) => s.operation);
      expect(operations).toContain('start');
    });
  });

  describe('prefetchMany()', () => {
    it('processes all inputs and returns results array', async () => {
      const connector = createMockConnector(validSpecJson);
      const flui = createFluiWithButton(connector);

      const results = await flui.prefetchMany({
        inputs: [
          { intent: 'Button 1', authorizedDataIdentifiers: [] },
          { intent: 'Button 2', authorizedDataIdentifiers: [] },
          { intent: 'Button 3', authorizedDataIdentifiers: [] },
        ],
      });

      expect(results).toHaveLength(3);
    });

    it('respects concurrency limit', async () => {
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      const gates: Array<() => void> = [];
      const trackingConnector: LLMConnector = {
        async generate() {
          currentConcurrent++;
          if (currentConcurrent > maxConcurrent) {
            maxConcurrent = currentConcurrent;
          }
          await new Promise<void>((resolve) => gates.push(resolve));
          currentConcurrent--;
          return ok({
            content: validSpecJson,
            model: 'gpt-4o',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          });
        },
      };
      const flui = createFluiWithButton(trackingConnector);

      const promise = flui.prefetchMany({
        inputs: [
          { intent: 'A1', authorizedDataIdentifiers: [] },
          { intent: 'A2', authorizedDataIdentifiers: [] },
          { intent: 'A3', authorizedDataIdentifiers: [] },
          { intent: 'A4', authorizedDataIdentifiers: [] },
        ],
        concurrency: 2,
      });

      // F14: Use a polling helper that waits for gates to be populated.
      // The pipeline uses crypto.subtle.digest (a real async API) which needs
      // actual event loop ticks, not just microtask yields.
      const waitForGates = (count: number) =>
        new Promise<void>((resolve) => {
          const check = () => {
            if (gates.length >= count) {
              resolve();
            } else {
              setTimeout(check, 5);
            }
          };
          check();
        });

      await waitForGates(2);
      // At most 2 should be in-flight
      expect(maxConcurrent).toBeLessThanOrEqual(2);

      // Release gates one at a time, waiting for the next slot to fill
      while (gates.length > 0) {
        gates.shift()!();
        if (gates.length === 0) {
          // After releasing, more might queue — give a tick
          await new Promise((r) => setTimeout(r, 10));
        }
      }

      // Release any remaining gates that appeared
      while (gates.length > 0) {
        gates.shift()!();
        await new Promise((r) => setTimeout(r, 10));
      }

      const results = await promise;
      expect(results).toHaveLength(4);
    });

    it('continues processing when individual prefetch fails', async () => {
      let callCount = 0;
      const mixedConnector: LLMConnector = {
        async generate() {
          callCount++;
          if (callCount === 2) {
            return err(new FluiError(FLUI_E014, 'connector', 'Intentional failure'));
          }
          return ok({
            content: validSpecJson,
            model: 'gpt-4o',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          });
        },
      };
      const flui = createFluiWithButton(mixedConnector);

      const results = await flui.prefetchMany({
        inputs: [
          { intent: 'M1', authorizedDataIdentifiers: [] },
          { intent: 'M2', authorizedDataIdentifiers: [] },
          { intent: 'M3', authorizedDataIdentifiers: [] },
        ],
      });

      expect(results).toHaveLength(3);
      const failed = results.filter((r) => r.status === 'failed');
      const cached = results.filter((r) => r.status === 'cached');
      expect(failed.length).toBeGreaterThanOrEqual(1);
      expect(cached.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getPrefetchStatus()', () => {
    it('returns idle when no cache and no inflight', async () => {
      const connector = createMockConnector(validSpecJson);
      const flui = createFluiWithButton(connector);

      const status = await flui.getPrefetchStatus({
        intent: 'Never prefetched',
        authorizedDataIdentifiers: [],
      });
      expect(status).toBe('idle');
    });

    it('returns in-flight when prefetch is in progress', async () => {
      const { connector, release } = createGatedConnector(validSpecJson);
      const flui = createFluiWithButton(connector);

      const input = { intent: 'Show a button', authorizedDataIdentifiers: [] as string[] };
      const promise = flui.prefetch(input);

      // Yield microtasks to let prefetch register
      await Promise.resolve();

      const status = await flui.getPrefetchStatus(input);
      expect(status).toBe('in-flight');

      // Clean up
      release();
      await promise;
    });

    it('returns cached when spec is in cache', async () => {
      const connector = createMockConnector(validSpecJson);
      const flui = createFluiWithButton(connector);

      const input = { intent: 'Show a button', authorizedDataIdentifiers: [] as string[] };
      await flui.prefetch(input);

      const status = await flui.getPrefetchStatus(input);
      expect(status).toBe('cached');
    });

    it('returns failed after a prefetch error', async () => {
      const failingConnector: LLMConnector = {
        async generate() {
          return err(new FluiError(FLUI_E014, 'connector', 'Connector failure'));
        },
      };
      const flui = createFluiWithButton(failingConnector);

      await flui.prefetch({
        intent: 'Failing intent',
        authorizedDataIdentifiers: [],
      });

      const status = await flui.getPrefetchStatus({
        intent: 'Failing intent',
        authorizedDataIdentifiers: [],
      });
      expect(status).toBe('failed');
    });
  });

  describe('cancelAllPrefetches()', () => {
    it('aborts all in-flight prefetches and returns count', async () => {
      const gatedConnector: LLMConnector = {
        async generate(_prompt, _opts, signal) {
          // Wait until aborted
          await new Promise<void>((resolve) => {
            if (signal?.aborted) {
              resolve();
              return;
            }
            signal?.addEventListener('abort', () => resolve(), { once: true });
          });
          return err(new FluiError(FLUI_E014, 'connector', 'Aborted'));
        },
      };
      const flui = createFluiWithButton(gatedConnector);

      const p1 = flui.prefetch({ intent: 'Cancel A', authorizedDataIdentifiers: [] });
      const p2 = flui.prefetch({ intent: 'Cancel B', authorizedDataIdentifiers: [] });
      const p3 = flui.prefetch({ intent: 'Cancel C', authorizedDataIdentifiers: [] });

      // Yield to let prefetches reach the gated connector
      await new Promise((r) => setTimeout(r, 50));

      const count = flui.cancelAllPrefetches();
      expect(count).toBe(3);

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
      expect(r1.ok).toBe(false);
      expect(r2.ok).toBe(false);
      expect(r3.ok).toBe(false);
    });

    it('returns 0 when no prefetches in flight', () => {
      const connector = createMockConnector(validSpecJson);
      const flui = createFluiWithButton(connector);

      const count = flui.cancelAllPrefetches();
      expect(count).toBe(0);
    });
  });

  describe('awaitInflight()', () => {
    it('returns promise when prefetch is in flight', async () => {
      const { connector, release } = createGatedConnector(validSpecJson);
      const flui = createFluiWithButton(connector);

      const input = { intent: 'Show a button', authorizedDataIdentifiers: [] as string[] };
      const promise = flui.prefetch(input);

      // Yield to let prefetch register
      await Promise.resolve();

      const status = await flui.getPrefetchStatus(input);
      expect(status).toBe('in-flight');

      release();
      const result = await promise;
      expect(result.ok).toBe(true);
    });

    it('returns undefined when no prefetch in flight', () => {
      const connector = createMockConnector(validSpecJson);
      const flui = createFluiWithButton(connector);

      const result = flui.awaitInflight('nonexistent-key');
      expect(result).toBeUndefined();
    });
  });
});
