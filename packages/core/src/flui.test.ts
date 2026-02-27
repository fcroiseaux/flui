import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createFlui, DEFAULT_CACHE_CONFIG, DEFAULT_CONCURRENCY_CONFIG } from './flui';
import { err, FLUI_E014, FLUI_E033, FluiError, type LLMConnector, ok } from './index';

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
