import type { FluiError } from './flui-error';

/**
 * Discriminated union for operation outcomes.
 * Success: { ok: true; value: T }
 * Failure: { ok: false; error: E }
 */
export type Result<T, E = FluiError> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Creates a success Result containing the given value.
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Creates a failure Result containing the given error.
 */
export function error<E>(errorValue: E): Result<never, E> {
  return { ok: false, error: errorValue };
}

/**
 * Creates a failure Result containing the given error.
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Factory object for Result pattern ergonomics.
 */
export const Result = {
  error,
  ok,
} as const;

/**
 * Type guard that narrows a Result to its success variant.
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

/**
 * Type guard that narrows a Result to its failure variant.
 */
export function isError<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}
