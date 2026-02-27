import { afterEach, describe, expect, it, vi } from 'vitest';
import { FLUI_E014, FLUI_E028, FLUI_E029, FluiError } from '../errors';
import { createTrace } from '../types';
import { createConcurrencyController } from './controller';

describe('ConcurrencyController', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Single Request Execution', () => {
    it('executes a single request normally and returns ok result', async () => {
      const controller = createConcurrencyController();
      const result = await controller.execute('view-1', async () => 'hello');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('hello');
      }
    });

    it('passes AbortSignal to the function', async () => {
      const controller = createConcurrencyController();
      let receivedSignal: AbortSignal | undefined;

      await controller.execute('view-1', async (signal) => {
        receivedSignal = signal;
        return 'done';
      });

      expect(receivedSignal).toBeDefined();
      expect(receivedSignal!.aborted).toBe(false);
    });
  });

  describe('Latest-Wins Cancellation', () => {
    it('uses global latest-wins scope when configured', async () => {
      const controller = createConcurrencyController({ scope: 'global' });
      let resolve1: (() => void) | undefined;

      const promise1 = controller.execute('view-1', async (signal) => {
        await new Promise<void>((r) => {
          resolve1 = r;
        });
        if (signal.aborted) throw new Error('Aborted');
        return 'result-1';
      });

      const promise2 = controller.execute('view-2', async () => {
        resolve1?.();
        return 'result-2';
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1.ok).toBe(false);
      if (!result1.ok) {
        expect(result1.error.code).toBe(FLUI_E028);
      }
      expect(result2.ok).toBe(true);
    });

    it('uses per-view latest-wins scope by default', async () => {
      const controller = createConcurrencyController();
      let resolve1: (() => void) | undefined;

      const promise1 = controller.execute('view-1', async (signal) => {
        await new Promise<void>((r) => {
          resolve1 = r;
        });
        if (signal.aborted) throw new Error('Aborted');
        return 'result-1';
      });

      const promise2 = controller.execute('view-2', async () => {
        resolve1?.();
        return 'result-2';
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
    });

    it('cancels in-flight request when new request arrives for same key', async () => {
      const controller = createConcurrencyController();
      const signals: AbortSignal[] = [];
      let resolve1: (() => void) | undefined;

      const promise1 = controller.execute('view-1', async (signal) => {
        signals.push(signal);
        await new Promise<void>((r) => {
          resolve1 = r;
        });
        if (signal.aborted) throw new Error('Aborted');
        return 'result-1';
      });

      // Start another request for same key immediately
      const promise2 = controller.execute('view-1', async (signal) => {
        signals.push(signal);
        // Resolve the first promise so it can complete
        resolve1?.();
        return 'result-2';
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // First request should be cancelled
      expect(result1.ok).toBe(false);
      if (!result1.ok) {
        expect(result1.error).toBeInstanceOf(FluiError);
        expect(result1.error.code).toBe(FLUI_E028);
      }
      expect(signals[0]!.aborted).toBe(true);

      // Second request should succeed
      expect(result2.ok).toBe(true);
      if (result2.ok) {
        expect(result2.value).toBe('result-2');
      }
    });

    it('does not cancel requests for different keys', async () => {
      const controller = createConcurrencyController();
      let resolve1: (() => void) | undefined;

      const promise1 = controller.execute('view-1', async (signal) => {
        await new Promise<void>((r) => {
          resolve1 = r;
        });
        if (signal.aborted) throw new Error('Aborted');
        return 'result-1';
      });

      const promise2 = controller.execute('view-2', async () => {
        resolve1?.();
        return 'result-2';
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1.ok).toBe(true);
      if (result1.ok) expect(result1.value).toBe('result-1');
      expect(result2.ok).toBe(true);
      if (result2.ok) expect(result2.value).toBe('result-2');
    });

    it('handles rapid successive requests: only latest proceeds', async () => {
      const controller = createConcurrencyController();
      const completions: string[] = [];
      const resolvers: Array<() => void> = [];

      // Launch 5 rapid requests for same key
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          controller.execute(`view-1`, async (signal) => {
            await new Promise<void>((r) => {
              resolvers.push(r);
            });
            if (signal.aborted) throw new Error('Aborted');
            completions.push(`result-${i}`);
            return `result-${i}`;
          }),
        );
      }

      // Resolve all pending promises
      for (const resolve of resolvers) {
        resolve();
      }

      const results = await Promise.all(promises);

      // Only the last request should succeed
      const successResults = results.filter((r) => r.ok);
      expect(successResults).toHaveLength(1);
      if (successResults[0]!.ok) {
        expect(successResults[0]!.value).toBe('result-4');
      }

      // Previous 4 should be cancelled
      const errorResults = results.filter((r) => !r.ok);
      expect(errorResults).toHaveLength(4);
    });
  });

  describe('AbortSignal', () => {
    it('AbortSignal is aborted when request is cancelled by newer request', async () => {
      const controller = createConcurrencyController();
      let capturedSignal: AbortSignal | undefined;
      let resolve1: (() => void) | undefined;

      const promise1 = controller.execute('view-1', async (signal) => {
        capturedSignal = signal;
        await new Promise<void>((r) => {
          resolve1 = r;
        });
        if (signal.aborted) throw new Error('Aborted');
        return 'first';
      });

      // New request cancels the first
      const promise2 = controller.execute('view-1', async () => {
        resolve1?.();
        return 'second';
      });

      await Promise.all([promise1, promise2]);

      expect(capturedSignal).toBeDefined();
      expect(capturedSignal!.aborted).toBe(true);
    });

    it('function can check signal.aborted during execution', async () => {
      const controller = createConcurrencyController();

      const result = await controller.execute('view-1', async (signal) => {
        expect(signal.aborted).toBe(false);
        return 'ok';
      });

      expect(result.ok).toBe(true);
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('blocks execution when circuit is open (returns FLUI_E029)', async () => {
      const controller = createConcurrencyController({
        circuitBreaker: { failureThreshold: 2 },
      });

      // Open the circuit with failures
      controller.recordFailure();
      controller.recordFailure();

      const result = await controller.execute('view-1', async () => 'should-not-run');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(FLUI_E029);
        expect(result.error.category).toBe('concurrency');
      }
    });

    it('allows probe when circuit is half-open', async () => {
      vi.useFakeTimers();
      const controller = createConcurrencyController({
        circuitBreaker: { failureThreshold: 2, resetTimeout: 10_000 },
      });

      // Open the circuit
      controller.recordFailure();
      controller.recordFailure();

      // Advance past cooldown
      vi.advanceTimersByTime(10_000);

      // Probe should be allowed
      const result = await controller.execute('view-1', async () => 'probe-result');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('probe-result');
      }

      // Circuit should be closed now
      const status = controller.getCircuitBreakerStatus();
      expect(status.state).toBe('closed');
    });

    it('half-open allows one real probe request and blocks concurrent second probe', async () => {
      vi.useFakeTimers();
      const controller = createConcurrencyController({
        circuitBreaker: { failureThreshold: 2, resetTimeout: 10_000 },
      });

      controller.recordFailure();
      controller.recordFailure();
      vi.advanceTimersByTime(10_000);

      let probeExecutions = 0;
      let releaseProbe: (() => void) | undefined;

      const probe1 = controller.execute('view-1', async () => {
        probeExecutions += 1;
        await new Promise<void>((r) => {
          releaseProbe = r;
        });
        return 'probe-ok';
      });

      const probe2 = controller.execute('view-1', async () => {
        probeExecutions += 1;
        return 'should-not-run';
      });

      const blockedResult = await probe2;
      expect(blockedResult.ok).toBe(false);
      if (!blockedResult.ok) {
        expect(blockedResult.error.code).toBe(FLUI_E029);
      }

      releaseProbe?.();
      const allowedResult = await probe1;
      expect(allowedResult.ok).toBe(true);
      expect(probeExecutions).toBe(1);
    });

    it('opens circuit during provider outage and blocks repeated calls', async () => {
      const controller = createConcurrencyController({
        circuitBreaker: { failureThreshold: 3 },
      });

      let callCount = 0;
      const failingCall = async () => {
        callCount += 1;
        throw new Error('provider unavailable');
      };

      await controller.execute('view-1', failingCall);
      await controller.execute('view-1', failingCall);
      await controller.execute('view-1', failingCall);

      const blocked = await controller.execute('view-1', failingCall);
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) {
        expect(blocked.error.code).toBe(FLUI_E029);
      }
      expect(callCount).toBe(3);
    });

    it('successful execution records success with circuit breaker', async () => {
      const controller = createConcurrencyController({
        circuitBreaker: { failureThreshold: 3 },
      });

      // Record some failures
      controller.recordFailure();
      controller.recordFailure();

      // Successful execution should reset failure count
      await controller.execute('view-1', async () => 'success');

      const status = controller.getCircuitBreakerStatus();
      expect(status.consecutiveFailures).toBe(0);
    });

    it('failed execution records failure with circuit breaker', async () => {
      const controller = createConcurrencyController({
        circuitBreaker: { failureThreshold: 3 },
      });

      await controller.execute('view-1', async () => {
        throw new Error('LLM failed');
      });

      const status = controller.getCircuitBreakerStatus();
      expect(status.consecutiveFailures).toBe(1);
    });
  });

  describe('Memory Leak Prevention', () => {
    it('completed requests are cleaned up from active map', async () => {
      const controller = createConcurrencyController();

      await controller.execute('view-1', async () => 'done');

      // Cancelling a non-existent request should return cancelled: false
      const result = controller.cancel('view-1');
      expect(result.cancelled).toBe(false);
      expect(result.reason).toBe('no-active-request');
    });

    it('cancelled requests are cleaned up from active map', async () => {
      const controller = createConcurrencyController();
      let resolve1: (() => void) | undefined;

      const promise1 = controller.execute('view-1', async (signal) => {
        await new Promise<void>((r) => {
          resolve1 = r;
        });
        if (signal.aborted) throw new Error('Aborted');
        return 'done';
      });

      // Cancel via new request
      const promise2 = controller.execute('view-1', async () => {
        resolve1?.();
        return 'new';
      });

      await Promise.all([promise1, promise2]);

      // After both complete, no active requests should remain
      const cancelResult = controller.cancel('view-1');
      expect(cancelResult.cancelled).toBe(false);
    });

    it('cancelAll clears all active requests', async () => {
      const controller = createConcurrencyController();
      const resolvers: Array<() => void> = [];

      // Start multiple requests
      const promises = [];
      for (const key of ['view-1', 'view-2', 'view-3']) {
        promises.push(
          controller.execute(key, async (signal) => {
            await new Promise<void>((r) => {
              resolvers.push(r);
            });
            if (signal.aborted) throw new Error('Aborted');
            return key;
          }),
        );
      }

      // Cancel all
      const count = controller.cancelAll();
      expect(count).toBe(3);

      // Resolve all so promises settle
      for (const resolve of resolvers) {
        resolve();
      }

      const results = await Promise.all(promises);
      for (const result of results) {
        expect(result.ok).toBe(false);
      }
    });
  });

  describe('Error Handling', () => {
    it('function throwing error returns Result.error', async () => {
      const controller = createConcurrencyController();

      const result = await controller.execute('view-1', async () => {
        throw new Error('Something went wrong');
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(FluiError);
        expect(result.error.code).toBe(FLUI_E014);
      }
    });

    it('function throwing FluiError preserves original error', async () => {
      const controller = createConcurrencyController();
      const original = new FluiError('FLUI_E014', 'connector', 'LLM provider error');

      const result = await controller.execute('view-1', async () => {
        throw original;
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(original);
        expect(result.error.code).toBe('FLUI_E014');
      }
    });

    it('cancel returns cancelled: false for non-existent key', () => {
      const controller = createConcurrencyController();
      const result = controller.cancel('nonexistent');
      expect(result.cancelled).toBe(false);
      expect(result.reason).toBe('no-active-request');
    });

    it('explicit cancel aborts the in-flight request', async () => {
      const controller = createConcurrencyController();
      let resolve1: (() => void) | undefined;

      const promise = controller.execute('view-1', async (signal) => {
        await new Promise<void>((r) => {
          resolve1 = r;
        });
        if (signal.aborted) throw new Error('Aborted');
        return 'done';
      });

      const cancelResult = controller.cancel('view-1');
      expect(cancelResult.cancelled).toBe(true);

      resolve1?.();

      const result = await promise;
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(FLUI_E028);
      }
    });
  });

  describe('Reset', () => {
    it('reset cancels active requests and clears circuit breaker', async () => {
      const controller = createConcurrencyController({
        circuitBreaker: { failureThreshold: 2 },
      });

      // Open circuit
      controller.recordFailure();
      controller.recordFailure();
      expect(controller.getCircuitBreakerStatus().state).toBe('open');

      controller.reset();
      expect(controller.getCircuitBreakerStatus().state).toBe('closed');
      expect(controller.getCircuitBreakerStatus().consecutiveFailures).toBe(0);
    });
  });

  describe('Trace Integration', () => {
    it('records execute trace steps with module concurrency-controller', async () => {
      const trace = createTrace();
      const controller = createConcurrencyController(undefined, trace);

      await controller.execute('view-1', async () => 'result');

      const steps = trace.steps.filter((s) => s.module === 'concurrency-controller');
      expect(steps.length).toBeGreaterThan(0);
      const executeStep = steps.find((s) => s.operation === 'execute');
      expect(executeStep).toBeDefined();
      expect(executeStep!.metadata['key']).toBe('view-1');
      expect(executeStep!.metadata['outcome']).toBe('success');
    });

    it('records cancel trace step on latest-wins cancellation', async () => {
      const trace = createTrace();
      const controller = createConcurrencyController(undefined, trace);
      let resolve1: (() => void) | undefined;

      const promise1 = controller.execute('view-1', async (signal) => {
        await new Promise<void>((r) => {
          resolve1 = r;
        });
        if (signal.aborted) throw new Error('Aborted');
        return 'first';
      });

      const promise2 = controller.execute('view-1', async () => {
        resolve1?.();
        return 'second';
      });

      await Promise.all([promise1, promise2]);

      const cancelSteps = trace.steps.filter(
        (s) => s.module === 'concurrency-controller' && s.operation === 'cancel',
      );
      expect(cancelSteps.length).toBeGreaterThan(0);
      expect(cancelSteps[0]!.metadata['reason']).toBe('superseded-by-new-request');
    });

    it('records circuit breaker block in trace', async () => {
      const trace = createTrace();
      const controller = createConcurrencyController(
        { circuitBreaker: { failureThreshold: 2 } },
        trace,
      );

      controller.recordFailure();
      controller.recordFailure();

      await controller.execute('view-1', async () => 'should-not-run');

      const blockStep = trace.steps.find(
        (s) =>
          s.module === 'concurrency-controller' &&
          s.operation === 'execute' &&
          s.metadata['blocked'] === true,
      );
      expect(blockStep).toBeDefined();
      expect(blockStep!.metadata['reason']).toBe('circuit-breaker-open');
    });

    it('records explicit cancel in trace', () => {
      const trace = createTrace();
      const controller = createConcurrencyController(undefined, trace);

      // Start a request (we won't await it)
      let resolve1: (() => void) | undefined;
      const promise = controller.execute('view-1', async (signal) => {
        await new Promise<void>((r) => {
          resolve1 = r;
        });
        if (signal.aborted) throw new Error('Aborted');
        return 'done';
      });

      controller.cancel('view-1');
      resolve1?.();

      // Let promise settle
      return promise.then(() => {
        const cancelSteps = trace.steps.filter(
          (s) =>
            s.module === 'concurrency-controller' &&
            s.operation === 'cancel' &&
            s.metadata['reason'] === 'explicit-cancellation',
        );
        expect(cancelSteps.length).toBeGreaterThan(0);
      });
    });
  });
});
