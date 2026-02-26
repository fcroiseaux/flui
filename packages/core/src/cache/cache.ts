import { FLUI_E024, FluiError } from '../errors';
import type { UISpecification } from '../spec';
import { uiSpecificationSchema } from '../spec';
import type { GenerationTrace } from '../types';

import type {
  CacheConfig,
  CacheEntry,
  CacheManager,
  CacheResult,
  CacheStats,
  CacheStorage,
} from './cache.types';
import { createIndexedDBStorage } from './storage/indexeddb';
import { createMemoryStorage } from './storage/memory';
import { createSessionStorage } from './storage/session';

const DEFAULT_TTL = 300_000; // 5 minutes

function isExpired(entry: CacheEntry<UISpecification>): boolean {
  return Date.now() > entry.createdAt + entry.ttl;
}

function validateSpec(spec: unknown): UISpecification | null {
  const result = uiSpecificationSchema.safeParse(spec);
  if (result.success) {
    return result.data;
  }
  return null;
}

/**
 * Creates a three-level cache manager with tiered lookup and automatic promotion.
 *
 * - L1: In-memory Map (always enabled)
 * - L2: sessionStorage (always enabled, graceful degradation)
 * - L3: IndexedDB via idb-keyval (optional, requires l3Enabled config)
 *
 * @param config - Cache configuration options
 * @param trace - Optional GenerationTrace for recording cache operations
 */
export function createCacheManager(config?: CacheConfig, trace?: GenerationTrace): CacheManager {
  const l1: CacheStorage = createMemoryStorage(config?.maxEntries);
  const l2: CacheStorage = createSessionStorage();
  const l3: CacheStorage | null = config?.l3Enabled ? createIndexedDBStorage() : null;
  const defaultTtl = config?.ttl ?? DEFAULT_TTL;

  const stats: CacheStats = {
    l1Size: 0,
    l2Size: 0,
    l3Size: 0,
    hits: 0,
    misses: 0,
  };

  function addTraceStep(
    operation: string,
    durationMs: number,
    metadata: Record<string, unknown>,
  ): void {
    if (trace) {
      trace.addStep({
        module: 'cache',
        operation,
        durationMs,
        metadata,
      });
    }
  }

  async function refreshL3Size(): Promise<void> {
    if (!l3) {
      stats.l3Size = 0;
      return;
    }

    const maybeSize = await l3.size();
    stats.l3Size = typeof maybeSize === 'number' ? maybeSize : 0;
  }

  async function handleCorruption(
    level: 'L1' | 'L2' | 'L3',
    key: string,
    storage: CacheStorage,
  ): Promise<void> {
    await storage.delete(key);
    if (level === 'L3') {
      await refreshL3Size();
    }

    // Log as FluiError context but don't throw — cache failures never crash
    new FluiError(
      FLUI_E024,
      'cache',
      `Cache corruption detected at ${level} for key ${key.substring(0, 12)}...`,
      {
        context: { level, key: key.substring(0, 12) + '...' },
      },
    );
  }

  return {
    async get(key: string): Promise<CacheResult> {
      const start = performance.now();

      // L1 — synchronous, fastest
      const l1Hit = l1.get(key) as CacheEntry<UISpecification> | null;
      if (l1Hit && !isExpired(l1Hit)) {
        const validated = validateSpec(l1Hit.value);
        if (validated) {
          stats.hits++;
          const durationMs = performance.now() - start;
          addTraceStep('lookup', durationMs, {
            result: 'hit',
            level: 'L1',
            key: key.substring(0, 12) + '...',
          });
          return { hit: true, level: 'L1', value: validated };
        }
        await handleCorruption('L1', key, l1);
      }

      // L2 — sessionStorage
      const l2Hit = l2.get(key) as CacheEntry<UISpecification> | null;
      if (l2Hit && !isExpired(l2Hit)) {
        const validated = validateSpec(l2Hit.value);
        if (validated) {
          l1.set(key, l2Hit); // Promote to L1
          stats.hits++;
          const durationMs = performance.now() - start;
          addTraceStep('lookup', durationMs, {
            result: 'hit',
            level: 'L2',
            key: key.substring(0, 12) + '...',
          });
          return { hit: true, level: 'L2', value: validated };
        }
        await handleCorruption('L2', key, l2);
      }

      // L3 — IndexedDB (async, optional)
      if (l3) {
        const l3Hit = await l3.get(key);
        if (l3Hit && !isExpired(l3Hit)) {
          const validated = validateSpec(l3Hit.value);
          if (validated) {
            l1.set(key, l3Hit); // Promote to L1
            l2.set(key, l3Hit); // Promote to L2
            stats.hits++;
            const durationMs = performance.now() - start;
            addTraceStep('lookup', durationMs, {
              result: 'hit',
              level: 'L3',
              key: key.substring(0, 12) + '...',
            });
            return { hit: true, level: 'L3', value: validated };
          }
          await handleCorruption('L3', key, l3);
        }
      }

      stats.misses++;
      const durationMs = performance.now() - start;
      addTraceStep('lookup', durationMs, {
        result: 'miss',
        key: key.substring(0, 12) + '...',
      });
      return { hit: false };
    },

    async set(key: string, spec: UISpecification, ttl?: number): Promise<void> {
      const entry: CacheEntry<UISpecification> = {
        value: spec,
        createdAt: Date.now(),
        ttl: ttl ?? defaultTtl,
        key,
      };

      l1.set(key, entry);
      l2.set(key, entry);
      if (l3) {
        await l3.set(key, entry);
        await refreshL3Size();
      }
    },

    async invalidate(key?: string): Promise<void> {
      if (key !== undefined) {
        l1.delete(key);
        l2.delete(key);
        if (l3) {
          await l3.delete(key);
          await refreshL3Size();
        }
      } else {
        l1.clear();
        l2.clear();
        if (l3) {
          await l3.clear();
          await refreshL3Size();
        }
      }
    },

    async clear(): Promise<void> {
      l1.clear();
      l2.clear();
      if (l3) {
        await l3.clear();
        await refreshL3Size();
      }
    },

    stats(): CacheStats {
      const l1Size = l1.size() as number;
      const l2Size = l2.size() as number;
      return {
        ...stats,
        l1Size,
        l2Size,
        l3Size: stats.l3Size, // L3 size requires async; use last known
      };
    },
  };
}
