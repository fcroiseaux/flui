import { error, FLUI_E014, FLUI_E028, FLUI_E029, FluiError, ok } from '../errors';
import type { Result } from '../errors/result';
import type { GenerationTrace } from '../types';
import { createCircuitBreaker } from './circuit-breaker';
import type {
  CancellationResult,
  CircuitBreakerStatus,
  ConcurrencyConfig,
  ConcurrencyController,
} from './concurrency.types';

/**
 * Creates a concurrency controller with latest-wins semantics and
 * integrated circuit breaker protection.
 *
 * Each request key (typically a view ID) maps to at most one in-flight request.
 * When a new request arrives for the same key, the previous request is cancelled
 * via AbortSignal.
 *
 * @param config - Optional configuration (circuit breaker settings)
 * @param trace - Optional GenerationTrace for observability
 * @returns ConcurrencyController instance
 */
export function createConcurrencyController(
  config?: ConcurrencyConfig | undefined,
  trace?: GenerationTrace | undefined,
): ConcurrencyController {
  const circuitBreaker = createCircuitBreaker(config?.circuitBreaker, trace);
  const activeRequests = new Map<string, AbortController>();

  function resolveLatestWinsKey(key: string): string {
    if (config?.scope === 'global') {
      return '__global__';
    }
    return key;
  }

  async function execute<T>(
    key: string,
    fn: (signal: AbortSignal) => Promise<T>,
  ): Promise<Result<T, FluiError>> {
    const latestWinsKey = resolveLatestWinsKey(key);

    // 1. Check circuit breaker FIRST
    if (!circuitBreaker.shouldAllow(key)) {
      trace?.addStep({
        module: 'concurrency-controller',
        operation: 'execute',
        durationMs: 0,
        metadata: { key, blocked: true, reason: 'circuit-breaker-open' },
      });
      return error(
        new FluiError(FLUI_E029, 'concurrency', 'Circuit breaker is open', {
          context: { key, circuitState: circuitBreaker.state(key) },
        }),
      );
    }

    // 2. Cancel any existing request for this key (latest-wins)
    const existing = activeRequests.get(latestWinsKey);
    if (existing) {
      existing.abort();
      trace?.addStep({
        module: 'concurrency-controller',
        operation: 'cancel',
        durationMs: 0,
        metadata: { key, latestWinsKey, reason: 'superseded-by-new-request' },
      });
    }

    // 3. Create new AbortController
    const controller = new AbortController();
    activeRequests.set(latestWinsKey, controller);

    const startTime = Date.now();
    try {
      const result = await fn(controller.signal);

      // Check if we were cancelled during execution
      if (controller.signal.aborted) {
        return error(
          new FluiError(FLUI_E028, 'concurrency', 'Request cancelled', {
            context: { key },
          }),
        );
      }

      circuitBreaker.recordSuccess(key);

      trace?.addStep({
        module: 'concurrency-controller',
        operation: 'execute',
        durationMs: Date.now() - startTime,
        metadata: { key, outcome: 'success' },
      });

      return ok(result);
    } catch (err) {
      if (controller.signal.aborted) {
        trace?.addStep({
          module: 'concurrency-controller',
          operation: 'execute',
          durationMs: Date.now() - startTime,
          metadata: { key, latestWinsKey, outcome: 'cancelled' },
        });
        return error(
          new FluiError(FLUI_E028, 'concurrency', 'Request cancelled', {
            context: { key },
          }),
        );
      }

      circuitBreaker.recordFailure(key);

      const fluiErr =
        err instanceof FluiError
          ? err
          : new FluiError(FLUI_E014, 'connector', 'Generation failed', {
              cause: err instanceof Error ? err : undefined,
              context: { key },
            });

      trace?.addStep({
        module: 'concurrency-controller',
        operation: 'execute',
        durationMs: Date.now() - startTime,
        metadata: { key, latestWinsKey, outcome: 'error', errorCode: fluiErr.code },
      });

      return error(fluiErr);
    } finally {
      // Clean up: only if this is still the active controller for this key
      if (activeRequests.get(latestWinsKey) === controller) {
        activeRequests.delete(latestWinsKey);
      }
    }
  }

  function cancel(key: string): CancellationResult {
    const latestWinsKey = resolveLatestWinsKey(key);
    const controller = activeRequests.get(latestWinsKey);
    if (!controller) {
      return { cancelled: false, reason: 'no-active-request' };
    }
    controller.abort();
    activeRequests.delete(latestWinsKey);
    trace?.addStep({
      module: 'concurrency-controller',
      operation: 'cancel',
      durationMs: 0,
      metadata: { key, latestWinsKey, reason: 'explicit-cancellation' },
    });
    return { cancelled: true };
  }

  function cancelAll(): number {
    const count = activeRequests.size;
    for (const [key, controller] of activeRequests) {
      controller.abort();
      trace?.addStep({
        module: 'concurrency-controller',
        operation: 'cancel',
        durationMs: 0,
        metadata: { key, reason: 'cancel-all' },
      });
    }
    activeRequests.clear();
    return count;
  }

  function getCircuitBreakerStatus(key?: string | undefined): CircuitBreakerStatus {
    return circuitBreaker.status(key);
  }

  function recordFailure(key?: string | undefined): void {
    circuitBreaker.recordFailure(key);
  }

  function recordSuccess(key?: string | undefined): void {
    circuitBreaker.recordSuccess(key);
  }

  function reset(): void {
    // Cancel all active requests
    for (const controller of activeRequests.values()) {
      controller.abort();
    }
    activeRequests.clear();
    circuitBreaker.reset();
  }

  return {
    execute,
    cancel,
    cancelAll,
    getCircuitBreakerStatus,
    recordFailure,
    recordSuccess,
    reset,
  };
}
