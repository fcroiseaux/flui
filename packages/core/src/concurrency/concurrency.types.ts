import type { FluiError } from '../errors';
import type { Result } from '../errors/result';

/**
 * Circuit breaker state: closed (normal), open (blocking), or half-open (probe).
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Granularity of circuit breaker failure tracking.
 * - 'global': single failure counter for all requests
 * - 'per-view': failure counter keyed by view ID
 * - 'per-intent': failure counter keyed by intent hash
 */
export type CircuitBreakerScope = 'global' | 'per-view' | 'per-intent';

/**
 * Configuration for the circuit breaker.
 */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures to open the circuit. Default: 3 */
  failureThreshold?: number | undefined;
  /** Time the circuit stays open before trying again (ms). Default: 60_000 */
  resetTimeout?: number | undefined;
  /** Granularity of circuit tracking. Default: 'global' */
  scope?: CircuitBreakerScope | undefined;
}

/**
 * Current status of the circuit breaker for a given scope key.
 */
export interface CircuitBreakerStatus {
  state: CircuitBreakerState;
  consecutiveFailures: number;
  lastFailureTime: number | null;
  scope: CircuitBreakerScope;
}

/**
 * Configuration for the concurrency controller.
 */
export interface ConcurrencyConfig {
  /** Latest-wins cancellation scope. 'global' shares one in-flight request across all keys. */
  scope?: 'global' | 'per-view' | undefined;
  /** Circuit breaker configuration. Undefined uses defaults. */
  circuitBreaker?: CircuitBreakerConfig | undefined;
}

/**
 * Result of a cancellation operation.
 */
export interface CancellationResult {
  cancelled: boolean;
  reason?: string | undefined;
}

/**
 * Concurrency controller managing request lifecycle with latest-wins semantics.
 * Composes a circuit breaker internally.
 */
export interface ConcurrencyController {
  /** Execute a function with concurrency control and circuit breaker protection. */
  execute<T>(key: string, fn: (signal: AbortSignal) => Promise<T>): Promise<Result<T, FluiError>>;
  /** Cancel the in-flight request for the given key. */
  cancel(key: string): CancellationResult;
  /** Cancel all in-flight requests. Returns the count of cancelled requests. */
  cancelAll(): number;
  /** Get current circuit breaker status for a key. */
  getCircuitBreakerStatus(key?: string | undefined): CircuitBreakerStatus;
  /** Record a failure against the circuit breaker for a key. */
  recordFailure(key?: string | undefined): void;
  /** Record a success against the circuit breaker for a key. */
  recordSuccess(key?: string | undefined): void;
  /** Reset all concurrency controller and circuit breaker state. */
  reset(): void;
}

/**
 * Circuit breaker tracks consecutive failures and manages state transitions.
 * CLOSED → OPEN → HALF_OPEN → CLOSED/OPEN
 */
export interface CircuitBreaker {
  /** Get the current state for a scope key. */
  state(key?: string | undefined): CircuitBreakerState;
  /** Get full status for a scope key. */
  status(key?: string | undefined): CircuitBreakerStatus;
  /** Record a failure. May trigger CLOSED→OPEN or HALF_OPEN→OPEN transition. */
  recordFailure(key?: string | undefined): void;
  /** Record a success. May trigger HALF_OPEN→CLOSED transition. */
  recordSuccess(key?: string | undefined): void;
  /** Check if a request should be allowed through. */
  shouldAllow(key?: string | undefined): boolean;
  /** Reset state for a key (or all keys if no key given). */
  reset(key?: string | undefined): void;
}
