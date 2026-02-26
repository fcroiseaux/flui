import type { UISpecification } from '../../spec';
import type { CacheEntry, CacheStorage } from '../cache.types';

interface IdbKeyvalLike {
  createStore(dbName: string, storeName: string): unknown;
  get(key: string, customStore?: unknown): Promise<unknown>;
  set(key: string, value: unknown, customStore?: unknown): Promise<void>;
  del(key: string, customStore?: unknown): Promise<void>;
  clear(customStore?: unknown): Promise<void>;
  keys(customStore?: unknown): Promise<unknown[]>;
}

const DB_NAME = 'flui-cache';
const STORE_NAME = 'specs';

let sharedModule: IdbKeyvalLike | null = null;
let sharedStore: unknown | null = null;
let sharedLoadAttempted = false;
let sharedLoadPromise: Promise<IdbKeyvalLike | null> | null = null;
let unavailableLogged = false;

function logUnavailableOnce(): void {
  if (unavailableLogged) {
    return;
  }
  unavailableLogged = true;
  console.info(
    '[@flui/core/cache] L3 cache disabled: optional peer dependency idb-keyval is not installed.',
  );
}

async function loadIdbKeyval(): Promise<IdbKeyvalLike | null> {
  if (sharedModule) return sharedModule;
  if (sharedLoadPromise) {
    return sharedLoadPromise;
  }
  if (sharedLoadAttempted) return null;

  sharedLoadAttempted = true;
  sharedLoadPromise = (async () => {
    try {
      // @ts-expect-error -- idb-keyval is an optional peer dependency
      sharedModule = (await import('idb-keyval')) as IdbKeyvalLike;
      sharedStore = sharedModule.createStore(DB_NAME, STORE_NAME);
      return sharedModule;
    } catch {
      logUnavailableOnce();
      return null;
    } finally {
      sharedLoadPromise = null;
    }
  })();

  return sharedLoadPromise;
}

/**
 * L3 IndexedDB cache storage via lazy-loaded idb-keyval.
 * Gracefully degrades to no-op when idb-keyval is not installed.
 */
export function createIndexedDBStorage(): CacheStorage {
  let instanceModule: IdbKeyvalLike | null = null;
  let instanceStore: unknown | null = null;
  let instanceLoadAttempted = false;
  let instanceLoadPromise: Promise<{ module: IdbKeyvalLike; store: unknown } | null> | null = null;

  async function getStorage(): Promise<{ module: IdbKeyvalLike; store: unknown } | null> {
    if (instanceModule && instanceStore) {
      return { module: instanceModule, store: instanceStore };
    }
    if (instanceLoadPromise) {
      return instanceLoadPromise;
    }
    if (instanceLoadAttempted) return null;

    instanceLoadAttempted = true;
    instanceLoadPromise = (async () => {
      try {
        const shared = await loadIdbKeyval();
        if (shared) {
          instanceModule = shared;
          instanceStore = sharedStore;
          if (instanceStore) {
            return { module: shared, store: instanceStore };
          }
          return null;
        }
        return null;
      } catch {
        logUnavailableOnce();
        return null;
      } finally {
        instanceLoadPromise = null;
      }
    })();

    return instanceLoadPromise;
  }

  return {
    async get(key: string): Promise<CacheEntry<UISpecification> | null> {
      const storage = await getStorage();
      if (!storage) return null;

      try {
        const entry = (await storage.module.get(key, storage.store)) as
          | CacheEntry<UISpecification>
          | undefined;
        if (!entry) return null;

        if (Date.now() > entry.createdAt + entry.ttl) {
          await storage.module.del(key, storage.store);
          return null;
        }

        return entry;
      } catch {
        return null;
      }
    },

    async set(key: string, entry: CacheEntry<UISpecification>): Promise<void> {
      const storage = await getStorage();
      if (!storage) return;

      try {
        await storage.module.set(key, entry, storage.store);
      } catch {
        // Quota exceeded or other storage error — skip silently
      }
    },

    async delete(key: string): Promise<void> {
      const storage = await getStorage();
      if (!storage) return;

      try {
        await storage.module.del(key, storage.store);
      } catch {
        // Ignore errors
      }
    },

    async clear(): Promise<void> {
      const storage = await getStorage();
      if (!storage) return;

      try {
        await storage.module.clear(storage.store);
      } catch {
        // Ignore errors
      }
    },

    async size(): Promise<number> {
      const storage = await getStorage();
      if (!storage) return 0;

      try {
        const allKeys = await storage.module.keys(storage.store);
        return allKeys.length;
      } catch {
        return 0;
      }
    },
  };
}
