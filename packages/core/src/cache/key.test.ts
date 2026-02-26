import { describe, expect, it } from 'vitest';

import { buildCacheKey } from './key';

describe('buildCacheKey', () => {
  const intent = 'show-dashboard';
  const context = { userId: 'u1', theme: 'dark', locale: 'en' };
  const registryVersion = '1.0.0';
  const specVersion = '1.0.0';

  describe('deterministic hashing', () => {
    it('returns the same hash for identical inputs', async () => {
      const key1 = await buildCacheKey(intent, context, registryVersion, specVersion);
      const key2 = await buildCacheKey(intent, context, registryVersion, specVersion);
      expect(key1).toBe(key2);
    });

    it('returns different hashes for different intents', async () => {
      const key1 = await buildCacheKey(intent, context, registryVersion, specVersion);
      const key2 = await buildCacheKey('show-settings', context, registryVersion, specVersion);
      expect(key1).not.toBe(key2);
    });

    it('returns different hashes for different contexts', async () => {
      const key1 = await buildCacheKey(intent, context, registryVersion, specVersion);
      const key2 = await buildCacheKey(
        intent,
        { userId: 'u2', theme: 'light', locale: 'fr' },
        registryVersion,
        specVersion,
      );
      expect(key1).not.toBe(key2);
    });

    it('returns different hashes for different registry versions', async () => {
      const key1 = await buildCacheKey(intent, context, registryVersion, specVersion);
      const key2 = await buildCacheKey(intent, context, '2.0.0', specVersion);
      expect(key1).not.toBe(key2);
    });

    it('returns different hashes for different spec versions', async () => {
      const key1 = await buildCacheKey(intent, context, registryVersion, specVersion);
      const key2 = await buildCacheKey(intent, context, registryVersion, '2.0.0');
      expect(key1).not.toBe(key2);
    });
  });

  describe('input normalization', () => {
    it('produces the same hash regardless of context key order', async () => {
      const ctx1 = { alpha: 1, beta: 2, gamma: 3 };
      const ctx2 = { gamma: 3, alpha: 1, beta: 2 };
      const key1 = await buildCacheKey(intent, ctx1, registryVersion, specVersion);
      const key2 = await buildCacheKey(intent, ctx2, registryVersion, specVersion);
      expect(key1).toBe(key2);
    });
  });

  describe('context signal filtering', () => {
    it('only includes specified signals in the hash', async () => {
      const fullCtx = { userId: 'u1', theme: 'dark', locale: 'en', debug: true };
      const signals = ['userId', 'theme'];

      const keyFiltered = await buildCacheKey(
        intent,
        fullCtx,
        registryVersion,
        specVersion,
        signals,
      );

      // Same result as a context containing only those keys
      const partialCtx = { userId: 'u1', theme: 'dark' };
      const keyPartial = await buildCacheKey(
        intent,
        partialCtx,
        registryVersion,
        specVersion,
      );

      expect(keyFiltered).toBe(keyPartial);
    });

    it('uses all context keys when no signals specified', async () => {
      const key1 = await buildCacheKey(intent, context, registryVersion, specVersion);
      const key2 = await buildCacheKey(intent, context, registryVersion, specVersion, undefined);
      expect(key1).toBe(key2);
    });
  });

  describe('hash format', () => {
    it('returns a hex-encoded string', async () => {
      const key = await buildCacheKey(intent, context, registryVersion, specVersion);
      expect(key).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns a 64-character string (SHA-256 hex)', async () => {
      const key = await buildCacheKey(intent, context, registryVersion, specVersion);
      expect(key).toHaveLength(64);
    });
  });
});
