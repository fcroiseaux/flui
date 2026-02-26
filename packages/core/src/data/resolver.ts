import { err, FLUI_E010, FLUI_E018, FLUI_E019, FluiError, ok, type Result } from '../errors';
import type { GenerationTrace } from '../types';
import type {
  DataResolutionResult,
  DataResolverConfig,
  DataResolverFn,
  DataResolverRegistry,
} from './data.types';

/**
 * Matches a data identifier against a resolver pattern.
 * Supports exact match and glob-like '*' wildcard patterns.
 */
function matchPattern(pattern: string, identifier: string): boolean {
  if (pattern === identifier) return true;
  if (!pattern.includes('*')) return false;

  const regex = new RegExp(
    `^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`,
  );
  return regex.test(identifier);
}

/**
 * Creates a data resolver registry for registering and resolving data identifiers.
 *
 * @param config - Optional configuration for the registry
 * @returns A DataResolverRegistry instance
 */
export function createDataResolverRegistry(config?: DataResolverConfig): DataResolverRegistry {
  const resolvers = new Map<string, DataResolverFn>();
  const maxConcurrency = Math.max(1, config?.maxConcurrency ?? 10);

  function findResolver(
    identifier: string,
  ): { pattern: string; resolver: DataResolverFn } | undefined {
    // Try exact match first
    const exact = resolvers.get(identifier);
    if (exact) return { pattern: identifier, resolver: exact };

    // Try pattern match
    for (const [pattern, resolver] of resolvers) {
      if (matchPattern(pattern, identifier)) {
        return { pattern, resolver };
      }
    }

    return undefined;
  }

  return {
    register<TData = unknown>(pattern: string, resolver: DataResolverFn<TData>): void {
      resolvers.set(pattern, resolver as DataResolverFn);
    },

    async resolve(
      identifiers: string[],
      authorizedIdentifiers: string[],
      trace: GenerationTrace,
      signal?: AbortSignal,
    ): Promise<Result<DataResolutionResult[]>> {
      const resolveAllStart = Date.now();

      // AbortSignal pre-check
      if (signal?.aborted) {
        return err(
          new FluiError(
            FLUI_E010,
            'generation',
            'Data resolution cancelled: AbortSignal already aborted',
            {
              context: { identifierCount: identifiers.length },
            },
          ),
        );
      }

      // Empty identifiers returns empty results
      if (identifiers.length === 0) {
        trace.addStep({
          module: 'data',
          operation: 'resolveAll',
          durationMs: Date.now() - resolveAllStart,
          metadata: { identifierCount: 0, resolvedCount: 0, rejectedCount: 0 },
        });
        return ok([]);
      }

      const authorizedSet = new Set(authorizedIdentifiers);
      const results: DataResolutionResult[] = [];
      const errors: FluiError[] = [];
      let resolvedCount = 0;
      let rejectedCount = 0;

      const resolveIdentifier = async (identifier: string) => {
        const stepStart = Date.now();

        // Security enforcement: check authorization
        if (!authorizedSet.has(identifier)) {
          rejectedCount++;
          const error = new FluiError(
            FLUI_E018,
            'generation',
            `Unauthorized data identifier: ${identifier} is not in the authorized context`,
            { context: { identifier } },
          );

          trace.addStep({
            module: 'data',
            operation: 'resolveIdentifier',
            durationMs: Date.now() - stepStart,
            metadata: { identifier, allowed: false, success: false },
          });

          return { identifier, error };
        }

        // Find resolver
        const match = findResolver(identifier);
        if (!match) {
          rejectedCount++;
          const error = new FluiError(
            FLUI_E019,
            'generation',
            `No resolver registered for data identifier: ${identifier}`,
            { context: { identifier } },
          );

          trace.addStep({
            module: 'data',
            operation: 'resolveIdentifier',
            durationMs: Date.now() - stepStart,
            metadata: { identifier, resolverPattern: null, success: false },
          });

          return { identifier, error };
        }

        // AbortSignal check before resolver call
        if (signal?.aborted) {
          return {
            identifier,
            error: new FluiError(
              FLUI_E010,
              'generation',
              `Data resolution cancelled for identifier: ${identifier}`,
              { context: { identifier } },
            ),
          };
        }

        // Call the resolver
        try {
          const result = await match.resolver(identifier, signal);

          // AbortSignal check after resolver call
          if (signal?.aborted) {
            return {
              identifier,
              error: new FluiError(
                FLUI_E010,
                'generation',
                `Data resolution cancelled after resolving: ${identifier}`,
                { context: { identifier } },
              ),
            };
          }

          if (!result.ok) {
            rejectedCount++;
            trace.addStep({
              module: 'data',
              operation: 'resolveIdentifier',
              durationMs: Date.now() - stepStart,
              metadata: { identifier, resolverPattern: match.pattern, success: false },
            });
            return { identifier, error: result.error };
          }

          resolvedCount++;
          trace.addStep({
            module: 'data',
            operation: 'resolveIdentifier',
            durationMs: Date.now() - stepStart,
            metadata: { identifier, resolverPattern: match.pattern, success: true },
          });

          return {
            identifier,
            result: {
              identifier,
              data: result.value,
              resolverPattern: match.pattern,
            } as DataResolutionResult,
          };
        } catch (thrown) {
          rejectedCount++;
          const cause = thrown instanceof Error ? thrown : new Error(String(thrown));
          const error = new FluiError(
            FLUI_E019,
            'generation',
            `Resolver error for data identifier: ${identifier}`,
            { context: { identifier, resolverPattern: match.pattern }, cause },
          );

          trace.addStep({
            module: 'data',
            operation: 'resolveIdentifier',
            durationMs: Date.now() - stepStart,
            metadata: { identifier, resolverPattern: match.pattern, success: false },
          });

          return { identifier, error };
        }
      };

      // Resolve identifiers with bounded concurrency.
      const settled: PromiseSettledResult<
        | { identifier: string; error: FluiError }
        | { identifier: string; result: DataResolutionResult }
      >[] = [];

      for (let i = 0; i < identifiers.length; i += maxConcurrency) {
        const batch = identifiers.slice(i, i + maxConcurrency);
        const batchSettled = await Promise.allSettled(
          batch.map((identifier) => resolveIdentifier(identifier)),
        );
        settled.push(...batchSettled);
      }

      for (const outcome of settled) {
        if (outcome.status === 'rejected') {
          // Should not happen since we catch inside, but handle defensively
          errors.push(
            new FluiError(FLUI_E019, 'generation', `Unexpected resolver failure`, {
              context: {},
            }),
          );
          continue;
        }

        const value = outcome.value;
        if ('error' in value && value.error) {
          errors.push(value.error);
        } else if ('result' in value && value.result) {
          results.push(value.result);
        }
      }

      // Add aggregate trace step
      trace.addStep({
        module: 'data',
        operation: 'resolveAll',
        durationMs: Date.now() - resolveAllStart,
        metadata: {
          identifierCount: identifiers.length,
          resolvedCount,
          rejectedCount,
        },
      });

      // If any errors, return aggregated error
      if (errors.length > 0) {
        const firstError = errors[0]!;
        const topLevelCode =
          errors.length === 1 || errors.every((error) => error.code === firstError.code)
            ? firstError.code
            : FLUI_E019;

        return err(
          new FluiError(
            topLevelCode,
            'generation',
            `Data resolution failed for ${errors.length} identifier(s): ${errors.map((e) => e.message).join('; ')}`,
            { context: { failedCount: errors.length, resolvedCount }, cause: firstError },
          ),
        );
      }

      return ok(results);
    },
  };
}
