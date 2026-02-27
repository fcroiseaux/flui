import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationTrace } from '../types';
import { createTrace } from '../types';
import { createObservabilityCollector } from './collector';
import { createMetricsReporter } from './metrics';
import type { MetricsReporter } from './metrics.types';
import { createMetricsTransport } from './metrics-transport';

// --- Test helpers ---

function makeTraceWithCost(actualCost: number): GenerationTrace {
  const trace = createTrace({ id: 'test-trace' });
  trace.addStep({
    module: 'cost-manager',
    operation: 'recordCost',
    durationMs: 0,
    metadata: {
      model: 'gpt-4o',
      actualCost,
      estimatedCost: actualCost,
      totalUsage: 100,
      sessionSpent: actualCost,
      dailySpent: actualCost,
    },
  });
  return trace;
}

function makeTraceWithCacheHit(level: 'L1' | 'L2' | 'L3'): GenerationTrace {
  const trace = createTrace({ id: 'test-trace' });
  trace.addStep({
    module: 'cache',
    operation: 'lookup',
    durationMs: 1,
    metadata: { result: 'hit', level, key: 'test-key' },
  });
  return trace;
}

function makeTraceWithCacheMiss(): GenerationTrace {
  const trace = createTrace({ id: 'test-trace' });
  trace.addStep({
    module: 'cache',
    operation: 'lookup',
    durationMs: 5,
    metadata: { result: 'miss', key: 'test-key' },
  });
  return trace;
}

describe('MetricsReporter', () => {
  let reporter: MetricsReporter;

  beforeEach(() => {
    reporter = createMetricsReporter();
  });

  describe('getCostMetrics', () => {
    it('returns all-zero cost metrics for fresh reporter', () => {
      const metrics = reporter.getCostMetrics();
      expect(metrics).toEqual({
        lastGenerationCost: 0,
        sessionTotal: 0,
        dailyTotal: 0,
        generationCount: 0,
        averageCost: 0,
      });
    });

    it('records and returns last generation cost', () => {
      reporter.recordCost(0.05);
      reporter.recordCost(0.12);
      expect(reporter.getCostMetrics().lastGenerationCost).toBe(0.12);
    });

    it('accumulates session total across multiple calls', () => {
      reporter.recordCost(0.05);
      reporter.recordCost(0.1);
      reporter.recordCost(0.03);
      expect(reporter.getCostMetrics().sessionTotal).toBeCloseTo(0.18);
    });

    it('returns correct average cost', () => {
      reporter.recordCost(0.1);
      reporter.recordCost(0.2);
      reporter.recordCost(0.3);
      expect(reporter.getCostMetrics().averageCost).toBeCloseTo(0.2);
    });

    it('returns daily total for current date', () => {
      reporter.recordCost(0.05);
      reporter.recordCost(0.07);
      expect(reporter.getCostMetrics().dailyTotal).toBeCloseTo(0.12);
    });

    it('resets daily total when date rolls over', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 1, 27, 23, 59, 59));

      reporter.recordCost(0.1);
      expect(reporter.getCostMetrics().dailyTotal).toBeCloseTo(0.1);

      vi.setSystemTime(new Date(2026, 1, 28, 0, 0, 1));

      reporter.recordCost(0.05);
      expect(reporter.getCostMetrics().dailyTotal).toBeCloseTo(0.05);
      // Session total still accumulates across days
      expect(reporter.getCostMetrics().sessionTotal).toBeCloseTo(0.15);

      vi.useRealTimers();
    });
  });

  describe('getCacheMetrics', () => {
    it('returns all-zero cache metrics for fresh reporter', () => {
      const metrics = reporter.getCacheMetrics();
      expect(metrics).toEqual({
        l1: { hits: 0, misses: 0, hitRate: 0, missRate: 0 },
        l2: { hits: 0, misses: 0, hitRate: 0, missRate: 0 },
        l3: { hits: 0, misses: 0, hitRate: 0, missRate: 0 },
        aggregate: { hits: 0, misses: 0, hitRate: 0, missRate: 0, evictionCount: 0 },
      });
    });

    it('tracks L1 hits and misses separately', () => {
      reporter.recordCacheEvent('L1', 'hit');
      reporter.recordCacheEvent('L1', 'hit');
      reporter.recordCacheEvent('L1', 'miss');

      const metrics = reporter.getCacheMetrics();
      expect(metrics.l1.hits).toBe(2);
      expect(metrics.l1.misses).toBe(1);
    });

    it('tracks L2 hits and misses separately', () => {
      reporter.recordCacheEvent('L2', 'hit');
      reporter.recordCacheEvent('L2', 'miss');
      reporter.recordCacheEvent('L2', 'miss');

      const metrics = reporter.getCacheMetrics();
      expect(metrics.l2.hits).toBe(1);
      expect(metrics.l2.misses).toBe(2);
    });

    it('tracks L3 hits and misses separately', () => {
      reporter.recordCacheEvent('L3', 'hit');
      reporter.recordCacheEvent('L3', 'hit');
      reporter.recordCacheEvent('L3', 'hit');
      reporter.recordCacheEvent('L3', 'miss');

      const metrics = reporter.getCacheMetrics();
      expect(metrics.l3.hits).toBe(3);
      expect(metrics.l3.misses).toBe(1);
    });

    it('calculates hit rate correctly', () => {
      reporter.recordCacheEvent('L1', 'hit');
      reporter.recordCacheEvent('L1', 'hit');
      reporter.recordCacheEvent('L1', 'hit');
      reporter.recordCacheEvent('L1', 'miss');

      const metrics = reporter.getCacheMetrics();
      expect(metrics.l1.hitRate).toBe(75);
      expect(metrics.l1.missRate).toBe(25);
    });

    it('aggregates hits and misses across all levels', () => {
      reporter.recordCacheEvent('L1', 'hit');
      reporter.recordCacheEvent('L2', 'hit');
      reporter.recordCacheEvent('L3', 'miss');

      const metrics = reporter.getCacheMetrics();
      expect(metrics.aggregate.hits).toBe(2);
      expect(metrics.aggregate.misses).toBe(1);
      expect(metrics.aggregate.hitRate).toBeCloseTo(66.67, 1);
    });

    it('increments aggregate eviction count', () => {
      reporter.recordEviction('L1');
      reporter.recordEviction('L1');
      reporter.recordEviction('L2');

      const metrics = reporter.getCacheMetrics();
      expect(metrics.aggregate.evictionCount).toBe(3);
    });
  });

  describe('exportMetrics', () => {
    it('returns complete snapshot with timestamp', () => {
      reporter.recordCost(0.05);
      reporter.recordCacheEvent('L1', 'hit');

      const before = Date.now();
      const snapshot = reporter.exportMetrics();
      const after = Date.now();

      expect(snapshot.cost.sessionTotal).toBeCloseTo(0.05);
      expect(snapshot.cache.l1.hits).toBe(1);
      expect(snapshot.timestamp).toBeGreaterThanOrEqual(before);
      expect(snapshot.timestamp).toBeLessThanOrEqual(after);
    });

    it('returns JSON-serializable snapshot', () => {
      reporter.recordCost(0.1);
      reporter.recordCacheEvent('L2', 'miss');

      const snapshot = reporter.exportMetrics();
      const json = JSON.stringify(snapshot);
      const parsed = JSON.parse(json);

      expect(parsed.cost.sessionTotal).toBeCloseTo(0.1);
      expect(parsed.cache.l2.misses).toBe(1);
    });
  });

  describe('reset', () => {
    it('clears all metrics back to zero', () => {
      reporter.recordCost(0.5);
      reporter.recordCacheEvent('L1', 'hit');
      reporter.recordCacheEvent('L2', 'miss');
      reporter.recordEviction('L1');

      reporter.reset();

      expect(reporter.getCostMetrics()).toEqual({
        lastGenerationCost: 0,
        sessionTotal: 0,
        dailyTotal: 0,
        generationCount: 0,
        averageCost: 0,
      });
      expect(reporter.getCacheMetrics()).toEqual({
        l1: { hits: 0, misses: 0, hitRate: 0, missRate: 0 },
        l2: { hits: 0, misses: 0, hitRate: 0, missRate: 0 },
        l3: { hits: 0, misses: 0, hitRate: 0, missRate: 0 },
        aggregate: { hits: 0, misses: 0, hitRate: 0, missRate: 0, evictionCount: 0 },
      });
    });

    it('does not affect subsequent recording', () => {
      reporter.recordCost(1.0);
      reporter.reset();
      reporter.recordCost(0.25);

      const metrics = reporter.getCostMetrics();
      expect(metrics.sessionTotal).toBeCloseTo(0.25);
      expect(metrics.generationCount).toBe(1);
      expect(metrics.lastGenerationCost).toBe(0.25);
    });
  });
});

describe('createMetricsTransport', () => {
  let reporter: MetricsReporter;

  beforeEach(() => {
    reporter = createMetricsReporter();
  });

  it('returns transport with name "metrics"', () => {
    const transport = createMetricsTransport(reporter);
    expect(transport.name).toBe('metrics');
  });

  it('extracts cost from cost-manager.recordCost trace steps', async () => {
    const transport = createMetricsTransport(reporter);
    const trace = makeTraceWithCost(0.08);

    await transport.send(trace);

    expect(reporter.getCostMetrics().lastGenerationCost).toBe(0.08);
    expect(reporter.getCostMetrics().sessionTotal).toBeCloseTo(0.08);
  });

  it('extracts cache hits from cache.lookup trace steps with result: hit', async () => {
    const transport = createMetricsTransport(reporter);
    const trace = makeTraceWithCacheHit('L2');

    await transport.send(trace);

    expect(reporter.getCacheMetrics().l2.hits).toBe(1);
  });

  it('records cache miss from cache.lookup trace steps with result: miss', async () => {
    const transport = createMetricsTransport(reporter);
    const trace = makeTraceWithCacheMiss();

    await transport.send(trace);

    // Misses are attributed to L1 (first level attempted)
    expect(reporter.getCacheMetrics().l1.misses).toBe(1);
  });

  it('ignores trace steps from other modules', async () => {
    const transport = createMetricsTransport(reporter);
    const trace = createTrace({ id: 'test-trace' });
    trace.addStep({
      module: 'intent-parser',
      operation: 'parseIntent',
      durationMs: 5,
      metadata: { type: 'text' },
    });

    await transport.send(trace);

    expect(reporter.getCostMetrics().generationCount).toBe(0);
    expect(reporter.getCacheMetrics().aggregate.hits).toBe(0);
  });

  it('handles traces with no cost/cache steps gracefully', async () => {
    const transport = createMetricsTransport(reporter);
    const trace = createTrace({ id: 'empty-trace' });

    await transport.send(trace);

    expect(reporter.getCostMetrics().generationCount).toBe(0);
    expect(reporter.getCacheMetrics().aggregate.hits).toBe(0);
  });
});

describe('Metrics Integration', () => {
  it('metrics transport wired to collector receives traces and updates reporter', async () => {
    const reporter = createMetricsReporter();
    const metricsTransport = createMetricsTransport(reporter);
    const collector = createObservabilityCollector({
      transports: [metricsTransport],
    });

    const trace = makeTraceWithCost(0.15);
    collector.collect(trace);

    expect(reporter.getCostMetrics().lastGenerationCost).toBe(0.15);
    expect(reporter.getCostMetrics().sessionTotal).toBeCloseTo(0.15);
  });

  it('multiple traces accumulate metrics correctly', async () => {
    const reporter = createMetricsReporter();
    const metricsTransport = createMetricsTransport(reporter);
    const collector = createObservabilityCollector({
      transports: [metricsTransport],
    });

    collector.collect(makeTraceWithCost(0.1));
    collector.collect(makeTraceWithCost(0.2));
    collector.collect(makeTraceWithCacheHit('L1'));
    collector.collect(makeTraceWithCacheMiss());

    const costMetrics = reporter.getCostMetrics();
    expect(costMetrics.sessionTotal).toBeCloseTo(0.3);
    expect(costMetrics.generationCount).toBe(2);
    expect(costMetrics.lastGenerationCost).toBe(0.2);
    expect(costMetrics.averageCost).toBeCloseTo(0.15);

    const cacheMetrics = reporter.getCacheMetrics();
    expect(cacheMetrics.l1.hits).toBe(1);
    expect(cacheMetrics.l1.misses).toBe(1);
    expect(cacheMetrics.aggregate.hits).toBe(1);
    expect(cacheMetrics.aggregate.misses).toBe(1);
    expect(cacheMetrics.aggregate.hitRate).toBe(50);
  });
});
