import * as idbKeyval from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UISpecification } from '../../spec';
import type { CacheEntry } from '../cache.types';
import { createIndexedDBStorage } from './indexeddb';

const mockStore = new Map<string, unknown>();

vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(mockStore.get(key) ?? undefined)),
  set: vi.fn((key: string, value: unknown) => {
    mockStore.set(key, value);
    return Promise.resolve();
  }),
  del: vi.fn((key: string) => {
    mockStore.delete(key);
    return Promise.resolve();
  }),
  clear: vi.fn(() => {
    mockStore.clear();
    return Promise.resolve();
  }),
  keys: vi.fn(() => Promise.resolve(Array.from(mockStore.keys()))),
  createStore: vi.fn(() => 'mock-store'),
}));

function makeEntry(key: string, ttl = 300_000, createdAt?: number): CacheEntry<UISpecification> {
  return {
    key,
    ttl,
    createdAt: createdAt ?? Date.now(),
    value: {
      version: '1.0.0',
      components: [{ id: 'c1', componentType: 'Button', props: { label: 'Click' } }],
      layout: { type: 'stack' },
      interactions: [],
      metadata: { generatedAt: Date.now() },
    },
  };
}

describe('IndexedDBStorage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockStore.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('set and get', () => {
    it('uses a dedicated flui-cache/specs object store', async () => {
      const storage = createIndexedDBStorage();

      await storage.get('missing');

      expect(idbKeyval.createStore).toHaveBeenCalledWith('flui-cache', 'specs');
      expect(idbKeyval.get).toHaveBeenCalledWith('missing', 'mock-store');
    });

    it('stores and retrieves a cache entry', async () => {
      const storage = createIndexedDBStorage();
      const entry = makeEntry('k1');
      await storage.set('k1', entry);

      const result = await storage.get('k1');
      expect(result).not.toBeNull();
      expect(result!.key).toBe('k1');
    });

    it('returns null for a missing key', async () => {
      const storage = createIndexedDBStorage();
      expect(await storage.get('missing')).toBeNull();
    });
  });

  describe('TTL expiration', () => {
    it('returns null and evicts when entry has expired', async () => {
      const storage = createIndexedDBStorage();
      const entry = makeEntry('k1', 1000);
      await storage.set('k1', entry);

      vi.advanceTimersByTime(1001);

      expect(await storage.get('k1')).toBeNull();
    });

    it('returns entry within TTL', async () => {
      const storage = createIndexedDBStorage();
      const entry = makeEntry('k1', 5000);
      await storage.set('k1', entry);

      vi.advanceTimersByTime(4999);

      expect(await storage.get('k1')).not.toBeNull();
    });
  });

  describe('delete and clear', () => {
    it('deletes a specific entry', async () => {
      const storage = createIndexedDBStorage();
      await storage.set('k1', makeEntry('k1'));
      await storage.delete('k1');
      expect(await storage.get('k1')).toBeNull();
    });

    it('clears all entries', async () => {
      const storage = createIndexedDBStorage();
      await storage.set('k1', makeEntry('k1'));
      await storage.set('k2', makeEntry('k2'));
      await storage.clear();
      expect(await storage.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('returns count of entries', async () => {
      const storage = createIndexedDBStorage();
      await storage.set('k1', makeEntry('k1'));
      await storage.set('k2', makeEntry('k2'));
      expect(await storage.size()).toBe(2);
    });
  });

  describe('graceful no-op when idb-keyval unavailable', () => {
    it('returns null when import fails', async () => {
      vi.resetModules();

      vi.doMock('idb-keyval', () => {
        throw new Error('Module not found');
      });

      // Re-import to get fresh module with failed import
      const { createIndexedDBStorage: freshCreate } = await import('./indexeddb');
      const storage = freshCreate();

      expect(await storage.get('k1')).toBeNull();
      expect(await storage.get('k2')).toBeNull();

      vi.doUnmock('idb-keyval');
    });
  });
});
