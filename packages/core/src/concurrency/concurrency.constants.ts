import type { CircuitBreakerScope } from './concurrency.types';

/** Default consecutive failure count to open the circuit breaker (NFR-R2). */
export const DEFAULT_FAILURE_THRESHOLD = 3;

/** Default cooldown period before half-open probe (ms). 60 seconds per ADR-011. */
export const DEFAULT_RESET_TIMEOUT = 60_000;

/** Default circuit breaker scope: global tracking. */
export const DEFAULT_CIRCUIT_BREAKER_SCOPE: CircuitBreakerScope = 'global';
