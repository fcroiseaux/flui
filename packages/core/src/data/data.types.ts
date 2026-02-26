import type { Result } from '../errors';

/**
 * Represents a data reference identifier used in UISpecification.
 * Data identifiers are strings that map to registered resolver functions.
 */
export type DataIdentifier = string;

/**
 * A resolver function that fetches data for a given identifier.
 * Returns a Result to follow the never-throw pattern.
 *
 * @param identifier - The data identifier to resolve
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to the fetched data or a FluiError
 */
export type DataResolverFn<TData = unknown> = (
  identifier: string,
  signal?: AbortSignal,
) => Promise<Result<TData>>;

/**
 * Configuration for creating a data resolver registry.
 */
export interface DataResolverConfig {
  /** Maximum concurrent resolver calls. Defaults to 10. */
  maxConcurrency?: number | undefined;
}

/**
 * Result of resolving a single data identifier.
 */
export interface DataResolutionResult<TData = unknown> {
  /** The identifier that was resolved. */
  identifier: string;
  /** The resolved data value. */
  data: TData;
  /** The resolver pattern that matched. */
  resolverPattern: string;
}

/**
 * The data resolver registry interface.
 * Manages registration and resolution of data identifiers.
 */
export interface DataResolverRegistry {
  /**
   * Register a resolver function for a pattern.
   * Patterns can be exact strings or glob-like patterns using '*'.
   *
   * @param pattern - Pattern to match against identifiers
   * @param resolver - Function that resolves data for matching identifiers
   */
  register<TData = unknown>(pattern: string, resolver: DataResolverFn<TData>): void;

  /**
   * Resolve data identifiers using registered resolvers.
   *
   * @param identifiers - Data identifiers to resolve
   * @param authorizedIdentifiers - Identifiers allowed by context (security enforcement)
   * @param trace - Generation trace for recording resolution steps
   * @param signal - Optional AbortSignal for cancellation
   * @returns Result with resolved data or error details
   */
  resolve(
    identifiers: string[],
    authorizedIdentifiers: string[],
    trace: import('../types').GenerationTrace,
    signal?: AbortSignal,
  ): Promise<Result<DataResolutionResult[]>>;
}
