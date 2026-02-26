import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CacheEntry } from '../cache.types';
import type { UISpecification } from '../../spec';
import { createSessionStorage } from './session';

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

function createMockSessionStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
}

describe('SessionStorage', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    vi.useFakeTimers();
    mockStorage = createMockSessionStorage();
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('set and get', () => {
    it('stores and retrieves a cache entry via sessionStorage', async () => {
      const storage = createSessionStorage();
      const entry = makeEntry('k1');
      storage.set('k1', entry);

      const result = await storage.get('k1');
      expect(result).not.toBeNull();
      expect(result!.key).toBe('k1');
      expect(result!.value.version).toBe('1.0.0');
    });

    it('returns null for a missing key', async () => {
      const storage = createSessionStorage();
      expect(await storage.get('missing')).toBeNull();
    });

    it('uses flui_cache_ key prefix', () => {
      const storage = createSessionStorage();
      storage.set('k1', makeEntry('k1'));
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'flui_cache_k1',
        expect.any(String),
      );
    });
  });

  describe('TTL expiration', () => {
    it('returns null and evicts when entry has expired', () => {
      const storage = createSessionStorage();
      const entry = makeEntry('k1', 1000);
      storage.set('k1', entry);

      vi.advanceTimersByTime(1001);

      expect(storage.get('k1')).toBeNull();
      expect(mockStorage.removeItem).toHaveBeenCalledWith('flui_cache_k1');
    });

    it('returns entry within TTL', () => {
      const storage = createSessionStorage();
      const entry = makeEntry('k1', 5000);
      storage.set('k1', entry);

      vi.advanceTimersByTime(4999);

      expect(storage.get('k1')).not.toBeNull();
    });
  });

  describe('graceful degradation', () => {
    it('returns null when sessionStorage is unavailable', () => {
      Object.defineProperty(globalThis, 'sessionStorage', {
        get() {
          throw new Error('SecurityError: access denied');
        },
        configurable: true,
      });

      const storage = createSessionStorage();
      expect(storage.get('k1')).toBeNull();
    });

    it('no-ops on set when sessionStorage is unavailable', () => {
      Object.defineProperty(globalThis, 'sessionStorage', {
        get() {
          throw new Error('SecurityError: access denied');
        },
        configurable: true,
      });

      const storage = createSessionStorage();
      // Should not throw
      expect(() => storage.set('k1', makeEntry('k1'))).not.toThrow();
    });

    it('handles quota exceeded on set without throwing', () => {
      const errorStorage = createMockSessionStorage();
      (errorStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      });
      Object.defineProperty(globalThis, 'sessionStorage', {
        value: errorStorage,
        writable: true,
        configurable: true,
      });

      const storage = createSessionStorage();
      expect(() => storage.set('k1', makeEntry('k1'))).not.toThrow();
    });
  });

  describe('delete and clear', () => {
    it('deletes a specific entry', () => {
      const storage = createSessionStorage();
      storage.set('k1', makeEntry('k1'));
      storage.delete('k1');
      expect(mockStorage.removeItem).toHaveBeenCalledWith('flui_cache_k1');
    });

    it('clears all flui_cache_ entries', () => {
      const storage = createSessionStorage();
      storage.set('k1', makeEntry('k1'));
      storage.set('k2', makeEntry('k2'));
      storage.clear();
      expect(storage.get('k1')).toBeNull();
      expect(storage.get('k2')).toBeNull();
    });
  });

  describe('size', () => {
    it('returns count of flui_cache_ entries', () => {
      const storage = createSessionStorage();
      storage.set('k1', makeEntry('k1'));
      storage.set('k2', makeEntry('k2'));
      expect(storage.size()).toBe(2);
    });

    it('returns 0 when no entries', () => {
      const storage = createSessionStorage();
      expect(storage.size()).toBe(0);
    });
  });
});
