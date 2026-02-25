import { err, FLUI_E005, FLUI_E010, FLUI_E011, FLUI_E013, FluiError, isOk, ok } from '../errors';
import type { AggregatedContext, ContextEngine, ContextProvider } from './context.types';

/**
 * Creates a new ContextEngine instance for managing context provider
 * registration and concurrent resolution.
 *
 * Each call produces an independent engine with its own state.
 */
export function createContextEngine(): ContextEngine {
  const providers = new Map<string, ContextProvider>();

  return {
    registerProvider(provider) {
      if (provider.name.trim().length === 0) {
        return err(
          new FluiError(FLUI_E005, 'validation', 'Provider name must be a non-empty string'),
        );
      }

      if (providers.has(provider.name)) {
        return err(
          new FluiError(
            FLUI_E013,
            'context',
            `Duplicate context provider: '${provider.name}' is already registered`,
          ),
        );
      }

      providers.set(provider.name, provider);
      return ok(undefined);
    },

    async resolveAll(signal?) {
      if (signal?.aborted) {
        return err(new FluiError(FLUI_E010, 'context', 'Context aggregation cancelled'));
      }

      if (providers.size === 0) {
        return ok({});
      }

      const entries = Array.from(providers.entries());
      const settledPromise = Promise.allSettled(
        entries.map(([, provider]) => provider.resolve(signal)),
      );

      let settled:
        | PromiseSettledResult<Awaited<ReturnType<ContextProvider['resolve']>>>[]
        | undefined;

      if (signal) {
        settled = await new Promise((resolve) => {
          const onAbort = () => resolve(undefined);

          signal.addEventListener('abort', onAbort, { once: true });

          settledPromise
            .then((results) => {
              signal.removeEventListener('abort', onAbort);
              resolve(results);
            })
            .catch(() => {
              signal.removeEventListener('abort', onAbort);
              resolve(undefined);
            });
        });
      } else {
        settled = await settledPromise;
      }

      if (signal?.aborted || !settled) {
        return err(new FluiError(FLUI_E010, 'context', 'Context aggregation cancelled'));
      }

      const aggregated: AggregatedContext = {};
      const failures: Array<{ name: string; error: FluiError }> = [];

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const settlement = settled[i];

        if (!entry || !settlement) {
          continue;
        }

        const [name] = entry;

        if (settlement.status === 'rejected') {
          failures.push({
            name,
            error: new FluiError(
              FLUI_E011,
              'context',
              `${name} provider threw unexpectedly: ${settlement.reason}`,
            ),
          });
        } else {
          const result = settlement.value;
          if (isOk(result)) {
            aggregated[name] = result.value;
          } else {
            failures.push({ name, error: result.error });
          }
        }
      }

      if (failures.length > 0) {
        return err(
          new FluiError(
            FLUI_E011,
            'context',
            `Context aggregation failed: ${failures.map((f) => `'${f.name}'`).join(', ')} provider(s) returned errors`,
            {
              context: {
                failedProviders: failures.map((f) => f.name),
                successfulResults: aggregated,
              },
            },
          ),
        );
      }

      return ok(aggregated);
    },

    getProviderNames() {
      return Array.from(providers.keys());
    },
  };
}
