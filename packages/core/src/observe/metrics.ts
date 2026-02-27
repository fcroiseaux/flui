import type {
  CacheLevelMetrics,
  CacheMetrics,
  CostMetrics,
  MetricsReporter,
  MetricsSnapshot,
} from './metrics.types';

/**
 * Creates a MetricsReporter that aggregates cost and cache data
 * from GenerationTrace step metadata into queryable metrics.
 */
export function createMetricsReporter(): MetricsReporter {
  let lastGenerationCost = 0;
  let sessionTotal = 0;
  let generationCount = 0;
  const dailyBuckets = new Map<string, number>();

  const cacheLevels = {
    L1: { hits: 0, misses: 0 },
    L2: { hits: 0, misses: 0 },
    L3: { hits: 0, misses: 0 },
  };
  let evictionCount = 0;

  function todayKey(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function hitRate(hits: number, misses: number): number {
    const total = hits + misses;
    return total === 0 ? 0 : (hits / total) * 100;
  }

  function recordCost(actualCost: number): void {
    lastGenerationCost = actualCost;
    sessionTotal += actualCost;
    generationCount++;
    const key = todayKey();
    dailyBuckets.set(key, (dailyBuckets.get(key) ?? 0) + actualCost);
  }

  function recordCacheEvent(level: 'L1' | 'L2' | 'L3', result: 'hit' | 'miss'): void {
    if (result === 'hit') {
      cacheLevels[level].hits++;
    } else {
      cacheLevels[level].misses++;
    }
  }

  function recordEviction(_level: 'L1' | 'L2' | 'L3'): void {
    evictionCount++;
  }

  function getCostMetrics(): CostMetrics {
    return {
      lastGenerationCost,
      sessionTotal,
      dailyTotal: dailyBuckets.get(todayKey()) ?? 0,
      generationCount,
      averageCost: generationCount > 0 ? sessionTotal / generationCount : 0,
    };
  }

  function getCacheMetrics(): CacheMetrics {
    const l1: CacheLevelMetrics = {
      hits: cacheLevels.L1.hits,
      misses: cacheLevels.L1.misses,
      hitRate: hitRate(cacheLevels.L1.hits, cacheLevels.L1.misses),
      missRate: hitRate(cacheLevels.L1.misses, cacheLevels.L1.hits),
    };
    const l2: CacheLevelMetrics = {
      hits: cacheLevels.L2.hits,
      misses: cacheLevels.L2.misses,
      hitRate: hitRate(cacheLevels.L2.hits, cacheLevels.L2.misses),
      missRate: hitRate(cacheLevels.L2.misses, cacheLevels.L2.hits),
    };
    const l3: CacheLevelMetrics = {
      hits: cacheLevels.L3.hits,
      misses: cacheLevels.L3.misses,
      hitRate: hitRate(cacheLevels.L3.hits, cacheLevels.L3.misses),
      missRate: hitRate(cacheLevels.L3.misses, cacheLevels.L3.hits),
    };

    const totalHits = l1.hits + l2.hits + l3.hits;
    const totalMisses = l1.misses + l2.misses + l3.misses;

    return {
      l1,
      l2,
      l3,
      aggregate: {
        hits: totalHits,
        misses: totalMisses,
        hitRate: hitRate(totalHits, totalMisses),
        missRate: hitRate(totalMisses, totalHits),
        evictionCount,
      },
    };
  }

  function exportMetrics(): MetricsSnapshot {
    return { cost: getCostMetrics(), cache: getCacheMetrics(), timestamp: Date.now() };
  }

  function reset(): void {
    lastGenerationCost = 0;
    sessionTotal = 0;
    generationCount = 0;
    dailyBuckets.clear();
    cacheLevels.L1 = { hits: 0, misses: 0 };
    cacheLevels.L2 = { hits: 0, misses: 0 };
    cacheLevels.L3 = { hits: 0, misses: 0 };
    evictionCount = 0;
  }

  return {
    recordCost,
    recordCacheEvent,
    recordEviction,
    getCostMetrics,
    getCacheMetrics,
    exportMetrics,
    reset,
  };
}
