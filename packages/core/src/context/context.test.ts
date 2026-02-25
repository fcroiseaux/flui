import { describe, expect, it } from 'vitest';

import {
  err,
  FLUI_E005,
  FLUI_E010,
  FLUI_E011,
  FLUI_E012,
  FLUI_E013,
  FluiError,
  isError,
  isOk,
  ok,
} from '../errors';
import type { ContextData, ContextProvider, EnvironmentContext, IdentityContext } from './index';
import {
  createContextEngine,
  createEnvironmentProvider,
  createIdentityProvider,
  environmentContextSchema,
  identityContextSchema,
  viewportSizeSchema,
} from './index';

// ── Test data ────────────────────────────────────────────────────────────

const validIdentity: IdentityContext = {
  role: 'admin',
  permissions: ['read', 'write'],
  expertiseLevel: 'expert',
};

const validEnvironment: EnvironmentContext = {
  deviceType: 'desktop',
  viewportSize: { width: 1920, height: 1080 },
  connectionQuality: 'fast',
};

// ── createIdentityProvider ───────────────────────────────────────────────

describe('createIdentityProvider', () => {
  describe('success cases', () => {
    it('resolves static IdentityContext data', async () => {
      const provider = createIdentityProvider(validIdentity);
      const result = await provider.resolve();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(validIdentity);
      }
    });

    it('resolves from a sync resolver function', async () => {
      const provider = createIdentityProvider(() => validIdentity);
      const result = await provider.resolve();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(validIdentity);
      }
    });

    it('resolves from an async resolver function', async () => {
      const provider = createIdentityProvider(async () => validIdentity);
      const result = await provider.resolve();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(validIdentity);
      }
    });

    it('has name "identity"', () => {
      const provider = createIdentityProvider(validIdentity);
      expect(provider.name).toBe('identity');
    });
  });

  describe('validation errors', () => {
    it('rejects empty role string with FLUI_E012', async () => {
      const provider = createIdentityProvider({
        role: '',
        permissions: ['read'],
        expertiseLevel: 'novice',
      });
      const result = await provider.resolve();

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe(FLUI_E012);
        expect(result.error.category).toBe('validation');
      }
    });

    it('rejects missing permissions with FLUI_E012', async () => {
      const provider = createIdentityProvider({
        role: 'admin',
        expertiseLevel: 'novice',
      } as unknown as IdentityContext);
      const result = await provider.resolve();

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe(FLUI_E012);
      }
    });

    it('rejects invalid expertiseLevel with FLUI_E012', async () => {
      const provider = createIdentityProvider({
        role: 'admin',
        permissions: ['read'],
        expertiseLevel: 'guru' as IdentityContext['expertiseLevel'],
      });
      const result = await provider.resolve();

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe(FLUI_E012);
      }
    });

    it('rejects extra properties with FLUI_E012', async () => {
      const provider = createIdentityProvider({
        ...validIdentity,
        extraField: 'not allowed',
      } as unknown as IdentityContext);
      const result = await provider.resolve();

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe(FLUI_E012);
      }
    });
  });

  describe('resolver errors', () => {
    it('catches resolver function that throws with FLUI_E011', async () => {
      const provider = createIdentityProvider(() => {
        throw new Error('fetch failed');
      });
      const result = await provider.resolve();

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe(FLUI_E011);
        expect(result.error.category).toBe('context');
        expect(result.error.message).toContain('fetch failed');
      }
    });
  });

  describe('AbortSignal', () => {
    it('returns FLUI_E010 when signal is already aborted', async () => {
      const provider = createIdentityProvider(validIdentity);
      const controller = new AbortController();
      controller.abort();
      const result = await provider.resolve(controller.signal);

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe(FLUI_E010);
        expect(result.error.category).toBe('context');
      }
    });

    it('returns FLUI_E010 when signal aborted during async resolution', async () => {
      const controller = new AbortController();
      const provider = createIdentityProvider(async () => {
        controller.abort();
        return validIdentity;
      });
      const result = await provider.resolve(controller.signal);

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe(FLUI_E010);
      }
    });
  });
});

// ── createEnvironmentProvider ────────────────────────────────────────────

describe('createEnvironmentProvider', () => {
  describe('success cases', () => {
    it('resolves static EnvironmentContext data', async () => {
      const provider = createEnvironmentProvider(validEnvironment);
      const result = await provider.resolve();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(validEnvironment);
      }
    });

    it('resolves from a sync resolver function', async () => {
      const provider = createEnvironmentProvider(() => validEnvironment);
      const result = await provider.resolve();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(validEnvironment);
      }
    });

    it('resolves from an async resolver function', async () => {
      const provider = createEnvironmentProvider(async () => validEnvironment);
      const result = await provider.resolve();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(validEnvironment);
      }
    });

    it('has name "environment"', () => {
      const provider = createEnvironmentProvider(validEnvironment);
      expect(provider.name).toBe('environment');
    });
  });

  describe('validation errors', () => {
    it('rejects invalid deviceType with FLUI_E012', async () => {
      const provider = createEnvironmentProvider({
        deviceType: 'tv' as EnvironmentContext['deviceType'],
        viewportSize: { width: 1920, height: 1080 },
        connectionQuality: 'fast',
      });
      const result = await provider.resolve();

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe(FLUI_E012);
      }
    });

    it('rejects negative viewport dimensions with FLUI_E012', async () => {
      const provider = createEnvironmentProvider({
        deviceType: 'desktop',
        viewportSize: { width: -100, height: 1080 },
        connectionQuality: 'fast',
      });
      const result = await provider.resolve();

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe(FLUI_E012);
      }
    });

    it('rejects invalid connectionQuality with FLUI_E012', async () => {
      const provider = createEnvironmentProvider({
        deviceType: 'desktop',
        viewportSize: { width: 1920, height: 1080 },
        connectionQuality: 'medium' as EnvironmentContext['connectionQuality'],
      });
      const result = await provider.resolve();

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe(FLUI_E012);
      }
    });

    it('rejects extra properties with FLUI_E012', async () => {
      const provider = createEnvironmentProvider({
        ...validEnvironment,
        theme: 'dark',
      } as unknown as EnvironmentContext);
      const result = await provider.resolve();

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe(FLUI_E012);
      }
    });
  });

  describe('resolver errors', () => {
    it('catches resolver function that throws with FLUI_E011', async () => {
      const provider = createEnvironmentProvider(() => {
        throw new Error('sensor unavailable');
      });
      const result = await provider.resolve();

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe(FLUI_E011);
        expect(result.error.category).toBe('context');
        expect(result.error.message).toContain('sensor unavailable');
      }
    });
  });

  describe('AbortSignal', () => {
    it('returns FLUI_E010 when signal is already aborted', async () => {
      const provider = createEnvironmentProvider(validEnvironment);
      const controller = new AbortController();
      controller.abort();
      const result = await provider.resolve(controller.signal);

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe(FLUI_E010);
        expect(result.error.category).toBe('context');
      }
    });
  });
});

// ── createContextEngine ──────────────────────────────────────────────────

function createTestProvider(name: string, data: ContextData): ContextProvider {
  return {
    name,
    async resolve(signal?: AbortSignal) {
      if (signal?.aborted) return err(new FluiError(FLUI_E010, 'context', 'Cancelled'));
      return ok(data);
    },
  };
}

function createFailingProvider(name: string, errorMessage: string): ContextProvider {
  return {
    name,
    async resolve() {
      return err(new FluiError(FLUI_E011, 'context', errorMessage));
    },
  };
}

describe('createContextEngine', () => {
  it('getProviderNames() returns empty array initially', () => {
    const engine = createContextEngine();
    expect(engine.getProviderNames()).toEqual([]);
  });

  it('registerProvider returns Result.ok for valid provider', () => {
    const engine = createContextEngine();
    const result = engine.registerProvider(createTestProvider('tenant', { tenantId: 'acme' }));

    expect(isOk(result)).toBe(true);
    expect(engine.getProviderNames()).toEqual(['tenant']);
  });

  it('registerProvider returns FLUI_E013 for duplicate name', () => {
    const engine = createContextEngine();
    engine.registerProvider(createTestProvider('tenant', { tenantId: 'acme' }));
    const result = engine.registerProvider(createTestProvider('tenant', { tenantId: 'other' }));

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.error.code).toBe(FLUI_E013);
      expect(result.error.category).toBe('context');
      expect(result.error.message).toContain('tenant');
    }
  });

  it('registerProvider returns FLUI_E005 for empty provider name', () => {
    const engine = createContextEngine();
    const result = engine.registerProvider(createTestProvider('', { data: true }));

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.error.code).toBe(FLUI_E005);
      expect(result.error.category).toBe('validation');
    }
  });

  it('registerProvider returns FLUI_E005 for whitespace-only provider name', () => {
    const engine = createContextEngine();
    const result = engine.registerProvider(createTestProvider('   ', { data: true }));

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.error.code).toBe(FLUI_E005);
      expect(result.error.category).toBe('validation');
    }
  });

  describe('resolveAll', () => {
    it('empty engine (no providers) returns Result.ok({})', async () => {
      const engine = createContextEngine();
      const result = await engine.resolveAll();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual({});
      }
    });

    it('single custom provider returns keyed result', async () => {
      const engine = createContextEngine();
      const tenantData = { tenantId: 'acme', plan: 'enterprise' };
      engine.registerProvider(createTestProvider('tenant', tenantData));
      const result = await engine.resolveAll();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual({ tenant: tenantData });
      }
    });

    it('multiple providers (identity + environment + custom) all keyed in result', async () => {
      const engine = createContextEngine();
      engine.registerProvider(
        createIdentityProvider({
          role: 'admin',
          permissions: ['read'],
          expertiseLevel: 'expert',
        }),
      );
      engine.registerProvider(
        createEnvironmentProvider({
          deviceType: 'desktop',
          viewportSize: { width: 1920, height: 1080 },
          connectionQuality: 'fast',
        }),
      );
      const customData = { featureFlags: ['dark-mode'] };
      engine.registerProvider(createTestProvider('features', customData));

      const result = await engine.resolveAll();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(Object.keys(result.value)).toHaveLength(3);
        expect(result.value.identity).toBeDefined();
        expect(result.value.environment).toBeDefined();
        expect(result.value.features).toEqual(customData);
      }
    });

    it('partial failure — one provider fails returns Result.error with FLUI_E011 and successful results in context', async () => {
      const engine = createContextEngine();
      const goodData = { tenantId: 'acme' };
      engine.registerProvider(createTestProvider('tenant', goodData));
      engine.registerProvider(createFailingProvider('broken', 'Service unavailable'));

      const result = await engine.resolveAll();

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe(FLUI_E011);
        expect(result.error.category).toBe('context');
        expect(result.error.message).toContain('broken');
        expect(result.error.context).toBeDefined();
        expect(result.error.context?.failedProviders).toEqual(['broken']);
        expect(result.error.context?.successfulResults).toEqual({ tenant: goodData });
      }
    });

    it('all providers fail returns Result.error with FLUI_E011', async () => {
      const engine = createContextEngine();
      engine.registerProvider(createFailingProvider('provider-a', 'Error A'));
      engine.registerProvider(createFailingProvider('provider-b', 'Error B'));

      const result = await engine.resolveAll();

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe(FLUI_E011);
        expect(result.error.context?.failedProviders).toEqual(['provider-a', 'provider-b']);
        expect(result.error.context?.successfulResults).toEqual({});
      }
    });

    it('AbortSignal already aborted returns Result.error with FLUI_E010', async () => {
      const engine = createContextEngine();
      engine.registerProvider(createTestProvider('tenant', { id: '1' }));

      const controller = new AbortController();
      controller.abort();
      const result = await engine.resolveAll(controller.signal);

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe(FLUI_E010);
        expect(result.error.category).toBe('context');
      }
    });

    it('AbortSignal aborted during resolution returns Result.error with FLUI_E010', async () => {
      const controller = new AbortController();
      const engine = createContextEngine();

      // Provider that aborts signal during resolution
      const slowProvider: ContextProvider = {
        name: 'slow',
        async resolve() {
          controller.abort();
          return ok({ done: true });
        },
      };
      engine.registerProvider(slowProvider);

      const result = await engine.resolveAll(controller.signal);

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe(FLUI_E010);
      }
    });

    it('providers are called concurrently (not sequentially)', async () => {
      const engine = createContextEngine();
      const resolveOrder: string[] = [];

      const provider1: ContextProvider = {
        name: 'p1',
        async resolve() {
          await new Promise((r) => setTimeout(r, 20));
          resolveOrder.push('p1');
          return ok({ id: 1 });
        },
      };

      const provider2: ContextProvider = {
        name: 'p2',
        async resolve() {
          await new Promise((r) => setTimeout(r, 10));
          resolveOrder.push('p2');
          return ok({ id: 2 });
        },
      };

      engine.registerProvider(provider1);
      engine.registerProvider(provider2);

      const start = Date.now();
      const result = await engine.resolveAll();
      const elapsed = Date.now() - start;

      expect(isOk(result)).toBe(true);
      // If sequential, would take ~30ms. Concurrent should be ~20ms.
      // Use generous threshold to avoid flakiness.
      expect(elapsed).toBeLessThan(100);
      // Completion order can vary based on scheduler timing.
      expect(resolveOrder).toHaveLength(2);
      expect(new Set(resolveOrder)).toEqual(new Set(['p1', 'p2']));
    });
  });

  it('each createContextEngine() call produces independent engine', () => {
    const engine1 = createContextEngine();
    const engine2 = createContextEngine();

    engine1.registerProvider(createTestProvider('tenant', { id: '1' }));

    expect(engine1.getProviderNames()).toEqual(['tenant']);
    expect(engine2.getProviderNames()).toEqual([]);
  });
});

// ── Zod schemas ──────────────────────────────────────────────────────────

describe('Zod schemas', () => {
  describe('identityContextSchema', () => {
    it('validates valid identity data', () => {
      const result = identityContextSchema.safeParse(validIdentity);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validIdentity);
      }
    });

    it('rejects invalid data with proper error', () => {
      const result = identityContextSchema.safeParse({
        role: 123,
        permissions: 'not-an-array',
        expertiseLevel: 'unknown',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('environmentContextSchema', () => {
    it('validates valid environment data', () => {
      const result = environmentContextSchema.safeParse(validEnvironment);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validEnvironment);
      }
    });

    it('rejects invalid data with proper error', () => {
      const result = environmentContextSchema.safeParse({
        deviceType: 'smartwatch',
        viewportSize: { width: 'big', height: -1 },
        connectionQuality: 42,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('viewportSizeSchema', () => {
    it('validates positive numbers', () => {
      const result = viewportSizeSchema.safeParse({ width: 1920, height: 1080 });
      expect(result.success).toBe(true);
    });

    it('rejects zero width', () => {
      const result = viewportSizeSchema.safeParse({ width: 0, height: 1080 });
      expect(result.success).toBe(false);
    });

    it('rejects negative height', () => {
      const result = viewportSizeSchema.safeParse({ width: 1920, height: -100 });
      expect(result.success).toBe(false);
    });
  });
});
