import { describe, expect, it } from 'vitest';

import { FLUI_E010, FLUI_E011, FLUI_E012, isError, isOk } from '../errors';
import type { EnvironmentContext, IdentityContext } from './index';
import {
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
