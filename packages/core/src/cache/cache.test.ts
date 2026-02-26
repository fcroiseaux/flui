import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { UISpecification } from '../spec';
import { createTrace } from '../types';

import { createCacheManager } from './cache';

// Mock sessionStorage for L2
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

// Mock idb-keyval for L3 tests
const mockIdbStore = new Map<string, unknown>();

vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(mockIdbStore.get(key) ?? undefined)),
  set: vi.fn((key: string, value: unknown) => {
    mockIdbStore.set(key, value);
    return Promise.resolve();
  }),
  del: vi.fn((key: string) => {
    mockIdbStore.delete(key);
    return Promise.resolve();
  }),
  clear: vi.fn(() => {
    mockIdbStore.clear();
    return Promise.resolve();
  }),
  keys: vi.fn(() => Promise.resolve(Array.from(mockIdbStore.keys()))),
  createStore: vi.fn(() => 'mock-store'),
}));

function makeValidSpec(): UISpecification {
  return {
    version: '1.0.0',
    components: [{ id: 'c1', componentType: 'Button', props: { label: 'Click' } }],
    layout: { type: 'stack' },
    interactions: [],
    metadata: { generatedAt: Date.now() },
  };
}

describe('CacheManager', () => {
  let mockSessionStorage: Storage;

  beforeEach(() => {
    vi.useFakeTimers();
    mockSessionStorage = createMockSessionStorage();
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
      configurable: true,
    });
    mockIdbStore.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('L1 hit', () => {
    it('returns L1 hit immediately', async () => {
      const manager = createCacheManager();
      const spec = makeValidSpec();
      await manager.set('k1', spec);

      const result = await manager.get('k1');
      expect(result.hit).toBe(true);
      expect(result.level).toBe('L1');
      expect(result.value).toEqual(spec);
    });
  });

  describe('L2 hit with promotion', () => {
    it('returns L2 hit and promotes to L1', async () => {
      const manager = createCacheManager();
      const spec = makeValidSpec();
      await manager.set('k1', spec);

      // Evict from L1 by filling with other entries (maxEntries default = 100)
      for (let i = 0; i < 101; i++) {
        await manager.set(`evict_${i}`, makeValidSpec());
      }

      // k1 should be evicted from L1 but still in L2
      const result = await manager.get('k1');
      expect(result.hit).toBe(true);
      expect(result.level).toBe('L2');

      // After promotion, next get should be L1
      const result2 = await manager.get('k1');
      expect(result2.hit).toBe(true);
      expect(result2.level).toBe('L1');
    });
  });

  describe('L3 hit with promotion', () => {
    it('returns L3 hit and promotes to L1 + L2', async () => {
      const manager = createCacheManager({ l3Enabled: true });
      const spec = makeValidSpec();
      await manager.set('k1', spec);

      // Evict from L1
      for (let i = 0; i < 101; i++) {
        await manager.set(`evict_${i}`, makeValidSpec());
      }

      // Clear L2 (sessionStorage)
      mockSessionStorage.clear();

      // k1 should now only be in L3
      const result = await manager.get('k1');
      expect(result.hit).toBe(true);
      expect(result.level).toBe('L3');

      // After promotion, next get should be L1
      const result2 = await manager.get('k1');
      expect(result2.hit).toBe(true);
      expect(result2.level).toBe('L1');
    });
  });

  describe('complete miss', () => {
    it('returns { hit: false } when key not found at any level', async () => {
      const manager = createCacheManager();
      const result = await manager.get('nonexistent');
      expect(result).toEqual({ hit: false });
    });
  });

  describe('corruption detection', () => {
    it('evicts corrupted entry and returns miss', async () => {
      const manager = createCacheManager();
      const spec = makeValidSpec();
      await manager.set('k1', spec);

      // Corrupt the L2 entry (sessionStorage) and clear L1
      const rawKey = 'flui_cache_k1';
      const raw = mockSessionStorage.getItem(rawKey);
      if (raw) {
        const entry = JSON.parse(raw);
        entry.value = { corrupted: true }; // Invalid UISpecification
        (mockSessionStorage.setItem as ReturnType<typeof vi.fn>)(rawKey, JSON.stringify(entry));
      }

      // Evict from L1
      for (let i = 0; i < 101; i++) {
        await manager.set(`evict_${i}`, makeValidSpec());
      }

      // Now k1 is only in L2 but corrupted
      const result = await manager.get('k1');
      // Should be a miss since L2 entry is corrupted and no L3
      expect(result.hit).toBe(false);
    });
  });

  describe('TTL expiration', () => {
    it('returns miss when all levels have expired entries', async () => {
      const manager = createCacheManager({ ttl: 1000 });
      await manager.set('k1', makeValidSpec());

      vi.advanceTimersByTime(1001);

      const result = await manager.get('k1');
      expect(result.hit).toBe(false);
    });

    it('returns hit within TTL', async () => {
      const manager = createCacheManager({ ttl: 5000 });
      await manager.set('k1', makeValidSpec());

      vi.advanceTimersByTime(4999);

      const result = await manager.get('k1');
      expect(result.hit).toBe(true);
    });

    it('respects per-entry TTL override', async () => {
      const manager = createCacheManager({ ttl: 10000 });
      await manager.set('k1', makeValidSpec(), 1000); // Override with shorter TTL

      vi.advanceTimersByTime(1001);

      const result = await manager.get('k1');
      expect(result.hit).toBe(false);
    });
  });

  describe('invalidate', () => {
    it('invalidates a specific key', async () => {
      const manager = createCacheManager();
      await manager.set('k1', makeValidSpec());
      await manager.set('k2', makeValidSpec());
      await manager.invalidate('k1');

      expect((await manager.get('k1')).hit).toBe(false);
      expect((await manager.get('k2')).hit).toBe(true);
    });

    it('invalidates all entries when no key specified', async () => {
      const manager = createCacheManager();
      await manager.set('k1', makeValidSpec());
      await manager.set('k2', makeValidSpec());
      await manager.invalidate();

      expect((await manager.get('k1')).hit).toBe(false);
      expect((await manager.get('k2')).hit).toBe(false);
    });
  });

  describe('clear', () => {
    it('clears all levels', async () => {
      const manager = createCacheManager({ l3Enabled: true });
      await manager.set('k1', makeValidSpec());
      await manager.clear();

      expect((await manager.get('k1')).hit).toBe(false);
      expect(manager.stats().l1Size).toBe(0);
    });
  });

  describe('stats', () => {
    it('tracks hits and misses', async () => {
      const manager = createCacheManager();
      await manager.set('k1', makeValidSpec());

      await manager.get('k1'); // hit
      await manager.get('k1'); // hit
      await manager.get('missing'); // miss

      const s = manager.stats();
      expect(s.hits).toBe(2);
      expect(s.misses).toBe(1);
    });

    it('reports L1 and L2 sizes', async () => {
      const manager = createCacheManager();
      await manager.set('k1', makeValidSpec());
      await manager.set('k2', makeValidSpec());

      const s = manager.stats();
      expect(s.l1Size).toBe(2);
      expect(s.l2Size).toBe(2);
    });

    it('reports L3 size when enabled', async () => {
      const manager = createCacheManager({ l3Enabled: true });
      await manager.set('k1', makeValidSpec());
      await manager.set('k2', makeValidSpec());

      const s = manager.stats();
      expect(s.l3Size).toBe(2);
    });
  });

  describe('L3-disabled configuration', () => {
    it('works correctly with only L1 + L2', async () => {
      const manager = createCacheManager({ l3Enabled: false });
      await manager.set('k1', makeValidSpec());

      const result = await manager.get('k1');
      expect(result.hit).toBe(true);
      expect(result.level).toBe('L1');
    });

    it('defaults to L3 disabled', async () => {
      const manager = createCacheManager();
      await manager.set('k1', makeValidSpec());

      // Should work fine without L3
      const result = await manager.get('k1');
      expect(result.hit).toBe(true);
    });
  });

  describe('GenerationTrace enrichment', () => {
    it('records cache hit in trace', async () => {
      const trace = createTrace({ id: 'test-trace' });
      const manager = createCacheManager(undefined, trace);
      await manager.set('k1', makeValidSpec());
      await manager.get('k1');

      const cacheSteps = trace.steps.filter((s) => s.module === 'cache');
      expect(cacheSteps.length).toBeGreaterThan(0);
      const hitStep = cacheSteps.find(
        (s) => (s.metadata as Record<string, unknown>)['result'] === 'hit',
      );
      expect(hitStep).toBeDefined();
      expect(hitStep!.operation).toBe('lookup');
      expect((hitStep!.metadata as Record<string, unknown>)['level']).toBe('L1');
    });

    it('records cache miss in trace', async () => {
      const trace = createTrace({ id: 'test-trace' });
      const manager = createCacheManager(undefined, trace);
      await manager.get('nonexistent');

      const cacheSteps = trace.steps.filter((s) => s.module === 'cache');
      expect(cacheSteps.length).toBe(1);
      expect((cacheSteps[0]!.metadata as Record<string, unknown>)['result']).toBe('miss');
    });

    it('includes duration in trace steps', async () => {
      const trace = createTrace({ id: 'test-trace' });
      const manager = createCacheManager(undefined, trace);
      await manager.get('k1');

      const cacheSteps = trace.steps.filter((s) => s.module === 'cache');
      expect(cacheSteps[0]!.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('truncates cache key in trace metadata', async () => {
      const trace = createTrace({ id: 'test-trace' });
      const manager = createCacheManager(undefined, trace);
      await manager.get('a_very_long_cache_key_that_should_be_truncated');

      const cacheSteps = trace.steps.filter((s) => s.module === 'cache');
      const key = (cacheSteps[0]!.metadata as Record<string, unknown>)['key'] as string;
      expect(key).toContain('...');
      expect(key.length).toBeLessThan('a_very_long_cache_key_that_should_be_truncated'.length);
    });
  });
});
