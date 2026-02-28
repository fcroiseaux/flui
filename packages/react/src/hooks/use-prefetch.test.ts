import {
  ComponentRegistry,
  err,
  FLUI_E014,
  FluiError,
  type FluiInstance,
  ok,
  type Result,
  type UISpecification,
} from '@flui/core';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { FluiProvider } from '../FluiProvider';

import { usePrefetch } from './use-prefetch';

function createTestSpec(): UISpecification {
  return {
    version: '1.0',
    components: [{ id: 'c1', componentType: 'TestButton', props: { label: 'test' } }],
    layout: { type: 'stack' },
    interactions: [],
    metadata: { generatedAt: Date.now() },
  };
}

function createTestRegistry(): ComponentRegistry {
  const registry = new ComponentRegistry();
  registry.register({
    name: 'TestButton',
    category: 'input',
    description: 'A test button',
    accepts: z.object({ label: z.string() }),
    component: () => null,
  });
  return registry;
}

function createMockInstance(
  prefetchFn?: FluiInstance['prefetch'],
): FluiInstance {
  const testSpec = createTestSpec();
  const defaultPrefetch = vi.fn().mockResolvedValue(ok(testSpec));
  return {
    registry: createTestRegistry(),
    context: { resolveAll: vi.fn().mockResolvedValue(ok({})) } as unknown as FluiInstance['context'],
    observer: { collect: vi.fn() } as unknown as FluiInstance['observer'],
    metrics: { recordCacheEvent: vi.fn() } as unknown as FluiInstance['metrics'],
    data: {} as unknown as FluiInstance['data'],
    config: {
      connector: { generate: vi.fn() },
      generationConfig: { connector: { generate: vi.fn() }, model: 'test-model' },
      validationConfig: {},
    },
    modules: {
      generation: {} as unknown as FluiInstance['modules']['generation'],
      validation: {} as unknown as FluiInstance['modules']['validation'],
      cache: { get: vi.fn(), set: vi.fn() } as unknown as FluiInstance['modules']['cache'],
      policy: {} as unknown as FluiInstance['modules']['policy'],
      cost: {} as unknown as FluiInstance['modules']['cost'],
      concurrency: {} as unknown as FluiInstance['modules']['concurrency'],
    },
    getMetrics: vi.fn().mockReturnValue({ cost: {}, cache: {} }),
    generate: vi.fn().mockResolvedValue(ok(testSpec)),
    prefetch: prefetchFn ?? defaultPrefetch,
    prefetchMany: vi.fn().mockResolvedValue([]),
    getPrefetchStatus: vi.fn().mockResolvedValue('idle'),
    cancelAllPrefetches: vi.fn().mockReturnValue(0),
    awaitInflight: vi.fn().mockReturnValue(undefined),
  };
}

function createWrapper(instance: FluiInstance) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(FluiProvider, { instance }, children);
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePrefetch', () => {
  it('calls prefetch when intent is provided', async () => {
    const instance = createMockInstance();
    const wrapper = createWrapper(instance);

    renderHook(() => usePrefetch({ intent: 'show a button' }), { wrapper });

    await vi.waitFor(() => {
      expect(instance.prefetch).toHaveBeenCalledWith(
        expect.objectContaining({ intent: 'show a button' }),
      );
    });
  });

  it('does not call prefetch when intent is undefined', () => {
    const instance = createMockInstance();
    const wrapper = createWrapper(instance);

    const { result } = renderHook(() => usePrefetch({}), { wrapper });

    expect(instance.prefetch).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('does not call prefetch when enabled is false', () => {
    const instance = createMockInstance();
    const wrapper = createWrapper(instance);

    const { result } = renderHook(
      () => usePrefetch({ intent: 'show a button', enabled: false }),
      { wrapper },
    );

    expect(instance.prefetch).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('updates status to cached on success', async () => {
    const testSpec = createTestSpec();
    const prefetchFn = vi.fn().mockResolvedValue(ok(testSpec));
    const instance = createMockInstance(prefetchFn);
    const wrapper = createWrapper(instance);

    const { result } = renderHook(
      () => usePrefetch({ intent: 'show a button' }),
      { wrapper },
    );

    await vi.waitFor(() => {
      expect(result.current.status).toBe('cached');
    });
    expect(result.current.error).toBeUndefined();
  });

  it('updates status to failed on error', async () => {
    const prefetchFn = vi.fn().mockResolvedValue(
      err(new FluiError(FLUI_E014, 'connector', 'LLM error')),
    );
    const instance = createMockInstance(prefetchFn);
    const wrapper = createWrapper(instance);

    const { result } = renderHook(
      () => usePrefetch({ intent: 'show a button' }),
      { wrapper },
    );

    await vi.waitFor(() => {
      expect(result.current.status).toBe('failed');
    });
    expect(result.current.error).toBeDefined();
    expect(result.current.error!.message).toBe('LLM error');
  });

  it('aborts prefetch on unmount', async () => {
    let capturedSignal: AbortSignal | undefined;
    const prefetchFn = vi.fn().mockImplementation(
      async (input: { signal?: AbortSignal }) => {
        capturedSignal = input.signal;
        // Return a promise that never resolves until abort
        return new Promise<Result<UISpecification>>((resolve) => {
          input.signal?.addEventListener('abort', () => {
            resolve(err(new FluiError(FLUI_E014, 'connector', 'Aborted')));
          }, { once: true });
        });
      },
    );
    const instance = createMockInstance(prefetchFn);
    const wrapper = createWrapper(instance);

    const { unmount } = renderHook(
      () => usePrefetch({ intent: 'show a button' }),
      { wrapper },
    );

    await vi.waitFor(() => {
      expect(prefetchFn).toHaveBeenCalled();
    });

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });

  it('aborts previous prefetch when intent changes', async () => {
    let firstSignal: AbortSignal | undefined;
    let callCount = 0;
    const testSpec = createTestSpec();
    const prefetchFn = vi.fn().mockImplementation(
      async (input: { signal?: AbortSignal }) => {
        callCount++;
        if (callCount === 1) {
          firstSignal = input.signal;
          return new Promise<Result<UISpecification>>((resolve) => {
            input.signal?.addEventListener('abort', () => {
              resolve(err(new FluiError(FLUI_E014, 'connector', 'Aborted')));
            }, { once: true });
          });
        }
        return ok(testSpec);
      },
    );
    const instance = createMockInstance(prefetchFn);
    const wrapper = createWrapper(instance);

    const { rerender } = renderHook(
      ({ intent }: { intent: string }) => usePrefetch({ intent }),
      { wrapper, initialProps: { intent: 'first intent' } },
    );

    await vi.waitFor(() => {
      expect(prefetchFn).toHaveBeenCalledTimes(1);
    });

    rerender({ intent: 'second intent' });

    await vi.waitFor(() => {
      expect(firstSignal?.aborted).toBe(true);
    });
  });

  it('cancel() aborts current prefetch', async () => {
    let capturedSignal: AbortSignal | undefined;
    const prefetchFn = vi.fn().mockImplementation(
      async (input: { signal?: AbortSignal }) => {
        capturedSignal = input.signal;
        return new Promise<Result<UISpecification>>((resolve) => {
          input.signal?.addEventListener('abort', () => {
            resolve(err(new FluiError(FLUI_E014, 'connector', 'Aborted')));
          }, { once: true });
        });
      },
    );
    const instance = createMockInstance(prefetchFn);
    const wrapper = createWrapper(instance);

    const { result } = renderHook(
      () => usePrefetch({ intent: 'show a button' }),
      { wrapper },
    );

    await vi.waitFor(() => {
      expect(prefetchFn).toHaveBeenCalled();
    });

    act(() => {
      result.current.cancel();
    });

    expect(capturedSignal?.aborted).toBe(true);
  });

  // F15: Verify cancel() does not trigger spurious state updates (status stays in-flight
  // because the abort guard prevents setState after cancellation — this is intentional)
  it('cancel() does not update status after abort (abort guard prevents setState)', async () => {
    const prefetchFn = vi.fn().mockImplementation(
      async (input: { signal?: AbortSignal }) => {
        return new Promise<Result<UISpecification>>((resolve) => {
          input.signal?.addEventListener('abort', () => {
            resolve(err(new FluiError(FLUI_E014, 'connector', 'Aborted')));
          }, { once: true });
        });
      },
    );
    const instance = createMockInstance(prefetchFn);
    const wrapper = createWrapper(instance);

    const { result } = renderHook(
      () => usePrefetch({ intent: 'show a button' }),
      { wrapper },
    );

    await vi.waitFor(() => {
      expect(result.current.status).toBe('in-flight');
    });

    act(() => {
      result.current.cancel();
    });

    // After cancel, the abort guard in usePrefetch's .then() prevents state updates,
    // so status remains 'in-flight' (no spurious setState after cancel)
    expect(result.current.status).toBe('in-flight');
    expect(result.current.error).toBeUndefined();
  });
});
