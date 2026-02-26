import type { UISpecification } from '../../spec';
import type { CacheEntry, CacheStorage } from '../cache.types';

const DEFAULT_MAX_ENTRIES = 100;

/**
 * L1 in-memory cache storage using Map.
 * Provides O(1) lookups with TTL expiration and LRU eviction.
 */
export function createMemoryStorage(maxEntries = DEFAULT_MAX_ENTRIES): CacheStorage {
  const store = new Map<string, CacheEntry<UISpecification>>();

  return {
    get(key: string): CacheEntry<UISpecification> | null {
      const entry = store.get(key);
      if (!entry) return null;

      if (Date.now() > entry.createdAt + entry.ttl) {
        store.delete(key);
        return null;
      }

      return entry;
    },

    set(key: string, entry: CacheEntry<UISpecification>): void {
      // Delete first so re-insertion moves to end (Map insertion order)
      store.delete(key);
      store.set(key, entry);

      // LRU eviction: remove oldest entry when limit exceeded
      if (store.size > maxEntries) {
        const oldestKey = store.keys().next().value;
        if (oldestKey !== undefined) {
          store.delete(oldestKey);
        }
      }
    },

    delete(key: string): void {
      store.delete(key);
    },

    clear(): void {
      store.clear();
    },

    size(): number {
      return store.size;
    },
  };
}
