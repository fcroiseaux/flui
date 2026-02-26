import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CacheEntry } from '../cache.types';
import type { UISpecification } from '../../spec';
import { createMemoryStorage } from './memory';

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

describe('MemoryStorage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('set and get', () => {
    it('stores and retrieves a cache entry', () => {
      const storage = createMemoryStorage();
      const entry = makeEntry('k1');
      storage.set('k1', entry);
      expect(storage.get('k1')).toEqual(entry);
    });

    it('returns null for a missing key', () => {
      const storage = createMemoryStorage();
      expect(storage.get('missing')).toBeNull();
    });
  });

  describe('TTL expiration', () => {
    it('returns null and evicts when entry has expired', () => {
      const storage = createMemoryStorage();
      const entry = makeEntry('k1', 1000);
      storage.set('k1', entry);

      vi.advanceTimersByTime(1001);

      expect(storage.get('k1')).toBeNull();
      expect(storage.size()).toBe(0);
    });

    it('returns entry within TTL', () => {
      const storage = createMemoryStorage();
      const entry = makeEntry('k1', 5000);
      storage.set('k1', entry);

      vi.advanceTimersByTime(4999);

      expect(storage.get('k1')).not.toBeNull();
    });
  });

  describe('LRU eviction', () => {
    it('evicts oldest entry when maxEntries exceeded', () => {
      const storage = createMemoryStorage(2);
      storage.set('k1', makeEntry('k1'));
      storage.set('k2', makeEntry('k2'));
      storage.set('k3', makeEntry('k3'));

      expect(storage.get('k1')).toBeNull();
      expect(storage.get('k2')).not.toBeNull();
      expect(storage.get('k3')).not.toBeNull();
      expect(storage.size()).toBe(2);
    });

    it('uses default maxEntries of 100', () => {
      const storage = createMemoryStorage();
      for (let i = 0; i < 101; i++) {
        storage.set(`k${i}`, makeEntry(`k${i}`));
      }
      expect(storage.get('k0')).toBeNull();
      expect(storage.get('k100')).not.toBeNull();
      expect(storage.size()).toBe(100);
    });
  });

  describe('delete and clear', () => {
    it('deletes a specific entry', () => {
      const storage = createMemoryStorage();
      storage.set('k1', makeEntry('k1'));
      storage.set('k2', makeEntry('k2'));
      storage.delete('k1');

      expect(storage.get('k1')).toBeNull();
      expect(storage.get('k2')).not.toBeNull();
      expect(storage.size()).toBe(1);
    });

    it('clears all entries', () => {
      const storage = createMemoryStorage();
      storage.set('k1', makeEntry('k1'));
      storage.set('k2', makeEntry('k2'));
      storage.clear();

      expect(storage.size()).toBe(0);
      expect(storage.get('k1')).toBeNull();
    });
  });

  describe('size', () => {
    it('returns 0 for empty storage', () => {
      const storage = createMemoryStorage();
      expect(storage.size()).toBe(0);
    });

    it('tracks entry count correctly', () => {
      const storage = createMemoryStorage();
      storage.set('k1', makeEntry('k1'));
      storage.set('k2', makeEntry('k2'));
      expect(storage.size()).toBe(2);
    });
  });
});
