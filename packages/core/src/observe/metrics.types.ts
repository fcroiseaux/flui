/**
 * Cost metrics aggregated from generation traces.
 * Reports per-generation, session, and daily cost data.
 */
export interface CostMetrics {
  lastGenerationCost: number;
  sessionTotal: number;
  dailyTotal: number;
  generationCount: number;
  averageCost: number;
}

/**
 * Cache performance metrics for a single cache level.
 * hitRate is a 0–100 percentage.
 */
export interface CacheLevelMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  missRate: number;
}

/**
 * Cache metrics broken down by level with aggregate summary.
 */
export interface CacheMetrics {
  l1: CacheLevelMetrics;
  l2: CacheLevelMetrics;
  l3: CacheLevelMetrics;
  aggregate: CacheLevelMetrics & { evictionCount: number };
}

/**
 * Point-in-time snapshot of all metrics.
 */
export interface MetricsSnapshot {
  cost: CostMetrics;
  cache: CacheMetrics;
  timestamp: number;
}

/**
 * Interface for recording and querying cost and cache metrics.
 * Fed by a metrics transport that extracts data from GenerationTrace steps.
 */
export interface MetricsReporter {
  recordCost(actualCost: number): void;
  recordCacheEvent(level: 'L1' | 'L2' | 'L3', result: 'hit' | 'miss'): void;
  recordEviction(level: 'L1' | 'L2' | 'L3'): void;
  getCostMetrics(): CostMetrics;
  getCacheMetrics(): CacheMetrics;
  exportMetrics(): MetricsSnapshot;
  reset(): void;
}
