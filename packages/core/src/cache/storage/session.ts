import type { UISpecification } from '../../spec';
import type { CacheEntry, CacheStorage } from '../cache.types';

const KEY_PREFIX = 'flui_cache_';

function getSessionStorage(): Storage | null {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * L2 session storage cache using sessionStorage.
 * Gracefully degrades to no-op when sessionStorage is unavailable (SSR, privacy mode).
 */
export function createSessionStorage(): CacheStorage {
  return {
    get(key: string): CacheEntry<UISpecification> | null {
      const ss = getSessionStorage();
      if (!ss) return null;

      try {
        const raw = ss.getItem(KEY_PREFIX + key);
        if (raw === null) return null;

        const entry = JSON.parse(raw) as CacheEntry<UISpecification>;

        if (Date.now() > entry.createdAt + entry.ttl) {
          ss.removeItem(KEY_PREFIX + key);
          return null;
        }

        return entry;
      } catch {
        return null;
      }
    },

    set(key: string, entry: CacheEntry<UISpecification>): void {
      const ss = getSessionStorage();
      if (!ss) return;

      try {
        ss.setItem(KEY_PREFIX + key, JSON.stringify(entry));
      } catch {
        // Quota exceeded or other storage error — skip silently
      }
    },

    delete(key: string): void {
      const ss = getSessionStorage();
      if (!ss) return;

      try {
        ss.removeItem(KEY_PREFIX + key);
      } catch {
        // Ignore errors
      }
    },

    clear(): void {
      const ss = getSessionStorage();
      if (!ss) return;

      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < ss.length; i++) {
          const k = ss.key(i);
          if (k !== null && k.startsWith(KEY_PREFIX)) {
            keysToRemove.push(k);
          }
        }
        for (const k of keysToRemove) {
          ss.removeItem(k);
        }
      } catch {
        // Ignore errors
      }
    },

    size(): number {
      const ss = getSessionStorage();
      if (!ss) return 0;

      try {
        let count = 0;
        for (let i = 0; i < ss.length; i++) {
          const k = ss.key(i);
          if (k !== null && k.startsWith(KEY_PREFIX)) {
            count++;
          }
        }
        return count;
      } catch {
        return 0;
      }
    },
  };
}
