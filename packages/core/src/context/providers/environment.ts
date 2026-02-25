import { createProvider } from '../context';
import { environmentContextSchema } from '../context.schema';
import type { ContextProvider, ContextResolver, EnvironmentContext } from '../context.types';

/**
 * Creates a context provider that resolves environment information.
 * Accepts either static EnvironmentContext data or a resolver function.
 */
export function createEnvironmentProvider(
  input: ContextResolver<EnvironmentContext>,
): ContextProvider<EnvironmentContext> {
  return createProvider('environment', input, environmentContextSchema);
}
