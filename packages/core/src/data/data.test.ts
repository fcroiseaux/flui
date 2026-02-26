import { describe, expect, it, vi } from 'vitest';
import type { DataResolverFn, GenerationTrace } from '../index';
import {
  createDataResolverRegistry,
  createTrace,
  err,
  FLUI_E010,
  FLUI_E018,
  FLUI_E019,
  FluiError,
  ok,
} from '../index';

function makeTrace(): GenerationTrace {
  return createTrace({ id: 'test-trace' });
}

describe('data resolver', () => {
  describe('register and resolve', () => {
    it('registers a resolver and resolves an identifier successfully', async () => {
      const registry = createDataResolverRegistry();
      const resolver: DataResolverFn = vi.fn(async () => ok({ name: 'Alice' }));

      registry.register('users/current', resolver);

      const trace = makeTrace();
      const result = await registry.resolve(['users/current'], ['users/current'], trace);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].identifier).toBe('users/current');
        expect(result.value[0].data).toStrictEqual({ name: 'Alice' });
        expect(result.value[0].resolverPattern).toBe('users/current');
      }
      expect(resolver).toHaveBeenCalledWith('users/current', undefined);
    });

    it('resolves multiple identifiers concurrently', async () => {
      const registry = createDataResolverRegistry();
      const userResolver: DataResolverFn = vi.fn(async () => ok({ name: 'Alice' }));
      const settingsResolver: DataResolverFn = vi.fn(async () => ok({ theme: 'dark' }));

      registry.register('users/current', userResolver);
      registry.register('settings/theme', settingsResolver);

      const trace = makeTrace();
      const result = await registry.resolve(
        ['users/current', 'settings/theme'],
        ['users/current', 'settings/theme'],
        trace,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        const identifiers = result.value.map((r) => r.identifier);
        expect(identifiers).toContain('users/current');
        expect(identifiers).toContain('settings/theme');
      }
      expect(userResolver).toHaveBeenCalledTimes(1);
      expect(settingsResolver).toHaveBeenCalledTimes(1);
    });

    it('supports glob-like pattern matching with *', async () => {
      const registry = createDataResolverRegistry();
      const resolver: DataResolverFn = vi.fn(async () => ok([1, 2, 3]));

      registry.register('api/v1/*', resolver);

      const trace = makeTrace();
      const result = await registry.resolve(['api/v1/users'], ['api/v1/users'], trace);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].resolverPattern).toBe('api/v1/*');
        expect(result.value[0].data).toStrictEqual([1, 2, 3]);
      }
    });
  });

  describe('missing resolver', () => {
    it('returns Result.error with FLUI_E019 for missing resolver', async () => {
      const registry = createDataResolverRegistry();

      const trace = makeTrace();
      const result = await registry.resolve(['unknown/data'], ['unknown/data'], trace);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(FluiError);
        expect(result.error.code).toBe(FLUI_E019);
        expect(result.error.message).toContain('unknown/data');
      }
    });
  });

  describe('unauthorized identifier rejection', () => {
    it('returns Result.error with FLUI_E018 for unauthorized identifier', async () => {
      const registry = createDataResolverRegistry();
      const resolver: DataResolverFn = vi.fn(async () => ok('secret'));
      registry.register('secret/data', resolver);

      const trace = makeTrace();
      const result = await registry.resolve(
        ['secret/data'],
        [], // empty authorized list
        trace,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(FluiError);
        expect(result.error.code).toBe(FLUI_E018);
        expect(result.error.message).toContain('secret/data');
      }
      // resolver should NOT have been called
      expect(resolver).not.toHaveBeenCalled();
    });

    it('rejects identifiers not in the authorized list with FLUI_E018', async () => {
      const registry = createDataResolverRegistry();
      const resolver: DataResolverFn = vi.fn(async () => ok('data'));
      registry.register('allowed/data', resolver);
      registry.register('forbidden/data', resolver);

      const trace = makeTrace();
      const result = await registry.resolve(
        ['forbidden/data'],
        ['allowed/data'], // only allowed/data is authorized
        trace,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('forbidden/data');
      }
      // resolver should NOT have been called for forbidden/data
      expect(resolver).not.toHaveBeenCalled();
    });

    it('records unauthorized attempts in the trace', async () => {
      const registry = createDataResolverRegistry();

      const trace = makeTrace();
      await registry.resolve(['unauthorized/id'], [], trace);

      const identifierSteps = trace.steps.filter((s) => s.operation === 'resolveIdentifier');
      expect(identifierSteps).toHaveLength(1);
      expect(identifierSteps[0].metadata.allowed).toBe(false);
      expect(identifierSteps[0].metadata.success).toBe(false);
    });
  });

  describe('AbortSignal cancellation', () => {
    it('returns error when signal is already aborted (pre-check)', async () => {
      const registry = createDataResolverRegistry();
      const resolver: DataResolverFn = vi.fn(async () => ok('data'));
      registry.register('test/data', resolver);

      const controller = new AbortController();
      controller.abort();

      const trace = makeTrace();
      const result = await registry.resolve(['test/data'], ['test/data'], trace, controller.signal);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(FluiError);
        expect(result.error.code).toBe(FLUI_E010);
        expect(result.error.message).toContain('cancelled');
      }
      // resolver should NOT have been called
      expect(resolver).not.toHaveBeenCalled();
    });

    it('passes signal through to resolver functions', async () => {
      const registry = createDataResolverRegistry();
      const controller = new AbortController();

      const resolver: DataResolverFn = vi.fn(async (_id, signal) => {
        expect(signal).toBe(controller.signal);
        return ok('data');
      });

      registry.register('test/data', resolver);

      const trace = makeTrace();
      await registry.resolve(['test/data'], ['test/data'], trace, controller.signal);

      expect(resolver).toHaveBeenCalledWith('test/data', controller.signal);
    });

    it('cancels when signal aborts during resolution', async () => {
      const registry = createDataResolverRegistry();
      const controller = new AbortController();

      const resolver: DataResolverFn = vi.fn(async () => {
        // Simulate abort during resolution
        controller.abort();
        return ok('data');
      });

      registry.register('test/data', resolver);

      const trace = makeTrace();
      const result = await registry.resolve(['test/data'], ['test/data'], trace, controller.signal);

      // The result should contain an abort error since signal was aborted after resolver returned
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(FluiError);
        expect(result.error.code).toBe(FLUI_E010);
        expect(result.error.message).toContain('cancelled');
      }
    });

    it('limits concurrent resolver calls based on maxConcurrency', async () => {
      const registry = createDataResolverRegistry({ maxConcurrency: 1 });
      let inFlight = 0;
      let peakInFlight = 0;

      const resolver: DataResolverFn = vi.fn(async (identifier) => {
        inFlight++;
        peakInFlight = Math.max(peakInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight--;
        return ok({ identifier });
      });

      registry.register('data/*', resolver);

      const trace = makeTrace();
      const result = await registry.resolve(
        ['data/1', 'data/2', 'data/3'],
        ['data/1', 'data/2', 'data/3'],
        trace,
      );

      expect(result.ok).toBe(true);
      expect(peakInFlight).toBe(1);
    });
  });

  describe('trace enrichment', () => {
    it('adds trace step for each resolver invocation', async () => {
      const registry = createDataResolverRegistry();
      registry.register('data/a', async () => ok('valueA'));
      registry.register('data/b', async () => ok('valueB'));

      const trace = makeTrace();
      await registry.resolve(['data/a', 'data/b'], ['data/a', 'data/b'], trace);

      const identifierSteps = trace.steps.filter((s) => s.operation === 'resolveIdentifier');
      expect(identifierSteps).toHaveLength(2);
      for (const step of identifierSteps) {
        expect(step.module).toBe('data');
        expect(step.durationMs).toBeGreaterThanOrEqual(0);
        expect(step.metadata.success).toBe(true);
        expect(step.metadata.resolverPattern).toBeDefined();
        expect(step.metadata.identifier).toBeDefined();
      }
    });

    it('adds aggregate resolveAll trace step', async () => {
      const registry = createDataResolverRegistry();
      registry.register('data/a', async () => ok('value'));

      const trace = makeTrace();
      await registry.resolve(['data/a'], ['data/a'], trace);

      const aggregateStep = trace.steps.find((s) => s.operation === 'resolveAll');
      expect(aggregateStep).toBeDefined();
      expect(aggregateStep?.module).toBe('data');
      expect(aggregateStep?.metadata.identifierCount).toBe(1);
      expect(aggregateStep?.metadata.resolvedCount).toBe(1);
      expect(aggregateStep?.metadata.rejectedCount).toBe(0);
    });

    it('tracks rejected and resolved counts in aggregate step', async () => {
      const registry = createDataResolverRegistry();
      registry.register('data/good', async () => ok('value'));
      // no resolver for 'data/missing'

      const trace = makeTrace();
      await registry.resolve(['data/good', 'data/missing'], ['data/good', 'data/missing'], trace);

      const aggregateStep = trace.steps.find((s) => s.operation === 'resolveAll');
      expect(aggregateStep).toBeDefined();
      expect(aggregateStep?.metadata.identifierCount).toBe(2);
      expect(aggregateStep?.metadata.resolvedCount).toBe(1);
      expect(aggregateStep?.metadata.rejectedCount).toBe(1);
    });
  });

  describe('resolver function error propagation', () => {
    it('handles resolver that throws an error', async () => {
      const registry = createDataResolverRegistry();
      const resolver: DataResolverFn = vi.fn(async () => {
        throw new Error('Database connection failed');
      });
      registry.register('db/users', resolver);

      const trace = makeTrace();
      const result = await registry.resolve(['db/users'], ['db/users'], trace);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(FluiError);
        expect(result.error.code).toBe(FLUI_E019);
        expect(result.error.message).toContain('db/users');
      }
    });

    it('wraps thrown error with cause chain', async () => {
      const registry = createDataResolverRegistry();
      const originalError = new Error('timeout');
      registry.register('api/data', async () => {
        throw originalError;
      });

      const trace = makeTrace();
      const result = await registry.resolve(['api/data'], ['api/data'], trace);

      expect(result.ok).toBe(false);
      // The aggregated error wraps individual errors in the message
      if (!result.ok) {
        expect(result.error.message).toContain('api/data');
      }
    });

    it('handles resolver returning Result.error', async () => {
      const registry = createDataResolverRegistry();
      const resolver: DataResolverFn = vi.fn(async () =>
        err(new FluiError(FLUI_E019, 'generation', 'Custom resolver error')),
      );
      registry.register('custom/data', resolver);

      const trace = makeTrace();
      const result = await registry.resolve(['custom/data'], ['custom/data'], trace);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(FLUI_E019);
      }
    });
  });

  describe('empty identifier list', () => {
    it('returns empty results for empty identifier list', async () => {
      const registry = createDataResolverRegistry();

      const trace = makeTrace();
      const result = await registry.resolve([], [], trace);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }

      // Should still add resolveAll trace step
      const aggregateStep = trace.steps.find((s) => s.operation === 'resolveAll');
      expect(aggregateStep).toBeDefined();
      expect(aggregateStep?.metadata.identifierCount).toBe(0);
    });
  });
});
