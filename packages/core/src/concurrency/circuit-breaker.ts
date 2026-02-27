import { FLUI_E030, FluiError } from '../errors';
import type { GenerationTrace } from '../types';
import {
  DEFAULT_CIRCUIT_BREAKER_SCOPE,
  DEFAULT_FAILURE_THRESHOLD,
  DEFAULT_RESET_TIMEOUT,
} from './concurrency.constants';
import type {
  CircuitBreaker,
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitBreakerStatus,
} from './concurrency.types';

interface Tracker {
  state: CircuitBreakerState;
  consecutiveFailures: number;
  lastFailureTime: number | null;
  halfOpenProbeActive: boolean;
}

/**
 * Creates a circuit breaker that tracks consecutive failures and manages
 * state transitions: CLOSED → OPEN → HALF_OPEN → CLOSED/OPEN.
 *
 * @param config - Optional configuration (threshold, timeout, scope)
 * @param trace - Optional GenerationTrace for observability
 * @returns CircuitBreaker instance
 * @throws FluiError (FLUI_E030) on invalid configuration
 */
export function createCircuitBreaker(
  config?: CircuitBreakerConfig | undefined,
  trace?: GenerationTrace | undefined,
): CircuitBreaker {
  const threshold = config?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
  const timeout = config?.resetTimeout ?? DEFAULT_RESET_TIMEOUT;
  const scope = config?.scope ?? DEFAULT_CIRCUIT_BREAKER_SCOPE;

  if (threshold <= 0) {
    throw new FluiError(FLUI_E030, 'concurrency', 'Failure threshold must be positive', {
      context: { failureThreshold: threshold },
    });
  }
  if (timeout <= 0) {
    throw new FluiError(FLUI_E030, 'concurrency', 'Reset timeout must be positive', {
      context: { resetTimeout: timeout },
    });
  }

  const trackers = new Map<string, Tracker>();

  function resolveKey(key?: string | undefined): string {
    if (scope === 'global') return '__global__';
    return key ?? '__global__';
  }

  function getOrCreateTracker(resolvedKey: string): Tracker {
    let tracker = trackers.get(resolvedKey);
    if (!tracker) {
      tracker = {
        state: 'closed',
        consecutiveFailures: 0,
        lastFailureTime: null,
        halfOpenProbeActive: false,
      };
      trackers.set(resolvedKey, tracker);
    }
    return tracker;
  }

  function state(key?: string | undefined): CircuitBreakerState {
    const resolvedKey = resolveKey(key);
    const tracker = getOrCreateTracker(resolvedKey);
    // Check lazy transition from open → half-open
    if (
      tracker.state === 'open' &&
      tracker.lastFailureTime !== null &&
      Date.now() - tracker.lastFailureTime >= timeout
    ) {
      tracker.state = 'half-open';
      tracker.halfOpenProbeActive = false;
      trace?.addStep({
        module: 'circuit-breaker',
        operation: 'stateChange',
        durationMs: 0,
        metadata: { key: resolvedKey, from: 'open', to: 'half-open' },
      });
    }
    return tracker.state;
  }

  function status(key?: string | undefined): CircuitBreakerStatus {
    const resolvedKey = resolveKey(key);
    // Call state() to trigger any lazy transition
    const currentState = state(key);
    const tracker = getOrCreateTracker(resolvedKey);
    return {
      state: currentState,
      consecutiveFailures: tracker.consecutiveFailures,
      lastFailureTime: tracker.lastFailureTime,
      scope,
    };
  }

  function shouldAllow(key?: string | undefined): boolean {
    const resolvedKey = resolveKey(key);
    const tracker = getOrCreateTracker(resolvedKey);

    switch (tracker.state) {
      case 'closed':
        return true;

      case 'open': {
        const now = Date.now();
        if (tracker.lastFailureTime !== null && now - tracker.lastFailureTime >= timeout) {
          tracker.state = 'half-open';
          tracker.halfOpenProbeActive = false;
          trace?.addStep({
            module: 'circuit-breaker',
            operation: 'stateChange',
            durationMs: 0,
            metadata: { key: resolvedKey, from: 'open', to: 'half-open' },
          });
          // Fall through to half-open logic
        } else {
          return false;
        }
      }
      // falls through intentionally to half-open
      // eslint-disable-next-line no-fallthrough
      case 'half-open': {
        if (!tracker.halfOpenProbeActive) {
          tracker.halfOpenProbeActive = true;
          return true;
        }
        return false;
      }
    }
  }

  function recordFailure(key?: string | undefined): void {
    const resolvedKey = resolveKey(key);
    const tracker = getOrCreateTracker(resolvedKey);

    tracker.consecutiveFailures++;
    tracker.lastFailureTime = Date.now();

    if (tracker.state === 'half-open') {
      tracker.state = 'open';
      tracker.halfOpenProbeActive = false;
      trace?.addStep({
        module: 'circuit-breaker',
        operation: 'stateChange',
        durationMs: 0,
        metadata: { key: resolvedKey, from: 'half-open', to: 'open', reason: 'probe-failed' },
      });
    } else if (tracker.state === 'closed' && tracker.consecutiveFailures >= threshold) {
      tracker.state = 'open';
      trace?.addStep({
        module: 'circuit-breaker',
        operation: 'stateChange',
        durationMs: 0,
        metadata: {
          key: resolvedKey,
          from: 'closed',
          to: 'open',
          failures: tracker.consecutiveFailures,
        },
      });
    }
  }

  function recordSuccess(key?: string | undefined): void {
    const resolvedKey = resolveKey(key);
    const tracker = getOrCreateTracker(resolvedKey);

    if (tracker.state === 'half-open') {
      tracker.state = 'closed';
      tracker.consecutiveFailures = 0;
      tracker.halfOpenProbeActive = false;
      trace?.addStep({
        module: 'circuit-breaker',
        operation: 'stateChange',
        durationMs: 0,
        metadata: { key: resolvedKey, from: 'half-open', to: 'closed', reason: 'probe-succeeded' },
      });
    } else {
      tracker.consecutiveFailures = 0;
    }
  }

  function reset(key?: string | undefined): void {
    if (key !== undefined && scope !== 'global') {
      trackers.delete(key);
    } else {
      trackers.clear();
    }
  }

  return {
    state,
    status,
    recordFailure,
    recordSuccess,
    shouldAllow,
    reset,
  };
}
