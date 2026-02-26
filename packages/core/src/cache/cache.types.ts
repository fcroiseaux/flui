import type { UISpecification } from '../spec';

/**
 * Composite cache key components used to build a deterministic hash.
 */
export interface CacheKey {
  intentHash: string;
  contextHash: string;
  registryVersion: string;
  specVersion: string;
}

/**
 * Configuration for the three-level cache system.
 */
export interface CacheConfig {
  /** Subset of context keys to include in cache key. Default: all keys. */
  contextKeySignals?: string[] | undefined;
  /** Default TTL in milliseconds. Default: 300_000 (5 minutes). */
  ttl?: number | undefined;
  /** Maximum entries in L1 memory cache. Default: 100. */
  maxEntries?: number | undefined;
  /** Enable L3 IndexedDB cache (requires idb-keyval peer dependency). */
  l3Enabled?: boolean | undefined;
  /** Reserved for Story 7.4 — not implemented in this story. */
  staleWhileRevalidate?: boolean | undefined;
}

/**
 * A cached entry wrapping a value with metadata.
 */
export interface CacheEntry<T> {
  value: T;
  createdAt: number;
  ttl: number;
  key: string;
}

/**
 * Result of a cache lookup operation.
 * Cache misses are expected control flow, not errors.
 */
export interface CacheResult {
  hit: boolean;
  level?: 'L1' | 'L2' | 'L3' | undefined;
  value?: UISpecification | undefined;
  stale?: boolean | undefined;
}

/**
 * Public interface for the cache manager.
 */
export interface CacheManager {
  get(key: string): Promise<CacheResult>;
  set(key: string, spec: UISpecification, ttl?: number): Promise<void>;
  invalidate(key?: string): Promise<void>;
  clear(): Promise<void>;
  stats(): CacheStats;
}

/**
 * Cache statistics for observability.
 */
export interface CacheStats {
  l1Size: number;
  l2Size: number;
  l3Size: number;
  hits: number;
  misses: number;
}

/**
 * Pluggable storage backend interface for cache levels.
 */
export interface CacheStorage {
  get(key: string): Promise<CacheEntry<UISpecification> | null> | CacheEntry<UISpecification> | null;
  set(key: string, entry: CacheEntry<UISpecification>): Promise<void> | void;
  delete(key: string): Promise<void> | void;
  clear(): Promise<void> | void;
  size(): Promise<number> | number;
}
