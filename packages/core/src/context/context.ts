import { z } from 'zod';
import type { Result } from '../errors';
import { err, FLUI_E010, FLUI_E011, FLUI_E012, FluiError, ok } from '../errors';
import type { ContextData, ContextProvider, ContextResolver } from './context.types';

/**
 * Internal factory that creates a ContextProvider from a resolver and Zod schema.
 *
 * The returned provider:
 * 1. Checks AbortSignal before resolution
 * 2. Resolves data (calls function or uses static value)
 * 3. Checks AbortSignal after async resolution (cooperative cancellation)
 * 4. Validates resolved data against the Zod schema
 * 5. Returns Result<T>
 */
export function createProvider<T extends ContextData>(
  name: string,
  resolver: ContextResolver<T>,
  schema: z.ZodType<T>,
): ContextProvider<T> {
  return {
    name,
    async resolve(signal?: AbortSignal): Promise<Result<T>> {
      try {
        // Check 1: Before resolution
        if (signal?.aborted) {
          return err(new FluiError(FLUI_E010, 'context', 'Context resolution cancelled'));
        }

        // Resolve data (may be async)
        const data =
          typeof resolver === 'function' ? await (resolver as () => T | Promise<T>)() : resolver;

        // Check 2: After async resolution (cooperative cancellation)
        if (signal?.aborted) {
          return err(new FluiError(FLUI_E010, 'context', 'Context resolution cancelled'));
        }

        // Validate against Zod schema
        const parseResult = schema.safeParse(data);
        if (!parseResult.success) {
          const tree = z.treeifyError(parseResult.error);
          return err(
            new FluiError(FLUI_E012, 'validation', `Invalid context data: ${JSON.stringify(tree)}`),
          );
        }

        return ok(parseResult.data);
      } catch (caught: unknown) {
        const message =
          caught instanceof Error ? caught.message : 'Unknown error during context resolution';
        return err(
          new FluiError(FLUI_E011, 'context', `${name} provider failed: ${message}`, {
            cause: caught instanceof Error ? caught : undefined,
          }),
        );
      }
    },
  };
}
