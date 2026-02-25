import { createProvider } from '../context';
import { identityContextSchema } from '../context.schema';
import type { ContextProvider, ContextResolver, IdentityContext } from '../context.types';

/**
 * Creates a context provider that resolves identity information.
 * Accepts either static IdentityContext data or a resolver function.
 */
export function createIdentityProvider(
  input: ContextResolver<IdentityContext>,
): ContextProvider<IdentityContext> {
  return createProvider('identity', input, identityContextSchema);
}
