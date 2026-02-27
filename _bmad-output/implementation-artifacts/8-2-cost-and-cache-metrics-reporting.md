# Story 8.2: Cost & Cache Metrics Reporting

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to view cost and cache performance metrics through the observability system,
so that I can optimize spending and cache configuration based on real usage data.

## Acceptance Criteria

1. **Cost Metrics Reporting** (FR49): Given the observability system with a `MetricsReporter`, when `getCostMetrics()` is called after one or more generations, then the system reports per-generation cost (last generation's actual cost), cumulative session cost (total since session start), and daily cost (total for current calendar day). Metrics are derived from `GenerationTrace` step metadata enriched by `cost-manager`. When no generations have occurred, all cost values return `0`.

2. **Cache Metrics Reporting** (FR50): Given the observability system with a `MetricsReporter`, when `getCacheMetrics()` is called, then the system reports cache hit rate, miss rate, and eviction count. Metrics are broken down by cache level (L1, L2, L3) with per-level hit count, miss count, and hit rate percentage. An aggregate section provides overall hit rate across all levels. When no cache events have been recorded, hit rate is `0` and counts are `0` (not errors).

3. **Metrics Transport Integration** (FR51): Given a `MetricsReporter` and the `ObservabilityCollector`, when metrics are exported via `createMetricsTransport(reporter)`, then the returned `TraceTransport` extracts cost and cache data from each `GenerationTrace` and feeds it to the reporter automatically. This transport can be registered with the collector via `addTransport()`.

4. **Fresh Session Defaults**: Given a fresh `MetricsReporter` with no recorded events, when `getCostMetrics()` or `getCacheMetrics()` is called, then zero values are returned (not errors or `null`). `exportMetrics()` returns a valid snapshot with all-zero metrics and a current timestamp.

5. **Testing Requirements**: Co-located tests cover metric accumulation across multiple generations, per-level cache metrics, metric export via transport, fresh session zero defaults, daily cost date-boundary rollover, and metrics reset. All tests pass with >90% statement coverage.

## Tasks / Subtasks

- [x] Task 1: Define metrics types (AC: #1, #2, #3, #4)
  - [x] 1.1 Create `packages/core/src/observe/metrics.types.ts` with type definitions:
    - `CostMetrics` interface: `{ lastGenerationCost: number; sessionTotal: number; dailyTotal: number; generationCount: number; averageCost: number }`
    - `CacheLevelMetrics` interface: `{ hits: number; misses: number; hitRate: number }` — hitRate is 0–100 percentage
    - `CacheMetrics` interface: `{ l1: CacheLevelMetrics; l2: CacheLevelMetrics; l3: CacheLevelMetrics; aggregate: CacheLevelMetrics & { evictionCount: number } }`
    - `MetricsSnapshot` interface: `{ cost: CostMetrics; cache: CacheMetrics; timestamp: number }`
    - `MetricsReporter` interface: `{ recordCost(actualCost: number): void; recordCacheEvent(level: 'L1' | 'L2' | 'L3', result: 'hit' | 'miss'): void; recordEviction(level: 'L1' | 'L2' | 'L3'): void; getCostMetrics(): CostMetrics; getCacheMetrics(): CacheMetrics; exportMetrics(): MetricsSnapshot; reset(): void }`
  - [x] 1.2 Export all new types from `observe/index.ts`

- [x] Task 2: Implement MetricsReporter factory (AC: #1, #2, #4)
  - [x] 2.1 Create `packages/core/src/observe/metrics.ts`
  - [x] 2.2 Implement `createMetricsReporter(): MetricsReporter`
  - [x] 2.3 `recordCost(actualCost)` flow:
    1. Store `actualCost` as `lastGenerationCost`
    2. Add to `sessionTotal`
    3. Add to daily bucket keyed by current date (ISO `YYYY-MM-DD`)
    4. Increment `generationCount`
  - [x] 2.4 `recordCacheEvent(level, result)` flow:
    1. Increment `hits` or `misses` counter for specified level
    2. Recalculate `hitRate` as `(hits / (hits + misses)) * 100`
    3. Recalculate aggregate across all levels
  - [x] 2.5 `recordEviction(level)` increments `evictionCount` in aggregate
  - [x] 2.6 `getCostMetrics()` returns current cost snapshot; `dailyTotal` uses current date key from daily buckets (old date keys are retained but not reported as "daily")
  - [x] 2.7 `getCacheMetrics()` returns current cache snapshot with computed hit rates
  - [x] 2.8 `exportMetrics()` returns `{ cost: getCostMetrics(), cache: getCacheMetrics(), timestamp: Date.now() }`
  - [x] 2.9 `reset()` clears all internal counters and daily buckets back to zero

- [x] Task 3: Implement metrics transport (AC: #3)
  - [x] 3.1 Create `packages/core/src/observe/metrics-transport.ts`
  - [x] 3.2 Implement `createMetricsTransport(reporter: MetricsReporter): TraceTransport`
  - [x] 3.3 Transport name: `'metrics'`
  - [x] 3.4 `send(trace)` extracts cost from trace steps where `step.module === 'cost-manager'` and `step.operation === 'recordCost'`:
    - Read `step.metadata.actualCost` (number) → call `reporter.recordCost(actualCost)`
  - [x] 3.5 `send(trace)` extracts cache events from trace steps where `step.module === 'cache'` and `step.operation === 'lookup'`:
    - If `step.metadata.result === 'hit'` → call `reporter.recordCacheEvent(step.metadata.level, 'hit')`
    - If `step.metadata.result === 'miss'` → call `reporter.recordCacheEvent('L1', 'miss')` (miss means all levels missed; attribute to L1 as the first level attempted)
  - [x] 3.6 Transport resolves its Promise immediately after recording — no async work needed

- [x] Task 4: Update barrel exports (AC: all)
  - [x] 4.1 Update `packages/core/src/observe/index.ts` to export:
    - Types: `CostMetrics`, `CacheLevelMetrics`, `CacheMetrics`, `MetricsSnapshot`, `MetricsReporter`
    - Values: `createMetricsReporter`, `createMetricsTransport`
  - [x] 4.2 Update `packages/core/src/index.ts` to add observe metrics exports:
    - Type exports: `CostMetrics`, `CacheLevelMetrics`, `CacheMetrics`, `MetricsSnapshot`, `MetricsReporter`
    - Value exports: `createMetricsReporter`, `createMetricsTransport`
  - [x] 4.3 Verify TypeScript compilation succeeds with all exports

- [x] Task 5: Write comprehensive tests (AC: #1, #2, #3, #4, #5)
  - [x] 5.1 Create `packages/core/src/observe/metrics.test.ts`:
    - **MetricsReporter - Cost Tests:**
      - Test: `recordCost` accumulates session total across multiple calls
      - Test: `getCostMetrics` returns last generation cost
      - Test: `getCostMetrics` returns correct average cost
      - Test: `getCostMetrics` returns daily total for current date
      - Test: daily total resets when date rolls over (mock `Date.now()`)
      - Test: fresh reporter returns all-zero cost metrics
    - **MetricsReporter - Cache Tests:**
      - Test: `recordCacheEvent` tracks L1 hits and misses separately
      - Test: `recordCacheEvent` tracks L2 hits and misses separately
      - Test: `recordCacheEvent` tracks L3 hits and misses separately
      - Test: hit rate calculates correctly (e.g., 3 hits + 1 miss = 75%)
      - Test: aggregate combines hits/misses across all levels
      - Test: `recordEviction` increments aggregate eviction count
      - Test: fresh reporter returns all-zero cache metrics with 0 hit rate
    - **MetricsReporter - Export & Reset Tests:**
      - Test: `exportMetrics` returns complete snapshot with timestamp
      - Test: `exportMetrics` snapshot is JSON-serializable
      - Test: `reset` clears all metrics back to zero
      - Test: `reset` does not affect subsequent recording
    - **Metrics Transport Tests:**
      - Test: `createMetricsTransport` returns transport with name `'metrics'`
      - Test: transport extracts cost from `cost-manager.recordCost` trace steps
      - Test: transport extracts cache hits from `cache.lookup` trace steps with `result: 'hit'`
      - Test: transport records cache miss from `cache.lookup` trace steps with `result: 'miss'`
      - Test: transport ignores trace steps from other modules
      - Test: transport handles traces with no cost/cache steps gracefully
    - **Integration Tests:**
      - Test: metrics transport wired to collector receives traces and updates reporter
      - Test: multiple traces accumulate metrics correctly
  - [x] 5.2 All tests pass with >90% statement coverage

## Dev Notes

### Architecture Compliance

**Package:** `@flui/core` — extending existing `observe/` module

**New files:**
```
packages/core/src/observe/
  ├── metrics.types.ts          # Type definitions (CostMetrics, CacheMetrics, MetricsReporter, etc.)
  ├── metrics.ts                # MetricsReporter factory implementation
  ├── metrics-transport.ts      # TraceTransport that feeds trace data into MetricsReporter
  └── metrics.test.ts           # Co-located tests for all metrics components
```

**Modified files:**
```
packages/core/src/
  ├── observe/index.ts          # Add metrics type and value exports
  └── index.ts                  # Add metrics exports to core barrel
```

**Do NOT create or modify these files** (they belong to other stories):
- Any file in `observe/` other than the new metrics files — do NOT modify `collector.ts`, `redaction.ts`, `observe.types.ts`, etc.
- Any `@flui/react/debug/` files — Debug overlay UI (Story 8.3)
- `flui.ts` or any factory wiring file — composing all modules (Story 8.5)
- `cache/cache.ts` or `policy/cost-manager.ts` — metrics extracts data from traces, not by importing these modules
- `errors/error-codes.ts` — no new error codes needed for this story
- `types.ts` — do NOT modify the GenerationTrace or TraceStep structures

**What this story IS vs IS NOT:**
- **IS:** A `MetricsReporter` that aggregates cost and cache data from `GenerationTrace` step metadata into queryable metrics
- **IS:** A `TraceTransport` that bridges the `ObservabilityCollector` with the `MetricsReporter` — registered as a transport, it receives completed traces and extracts cost/cache data automatically
- **IS NOT:** A modification to the existing trace system — traces are already enriched by `cost-manager` and `cache` modules via `addStep()`; the metrics reporter reads this existing data
- **IS NOT:** A replacement for `CostManager.stats()` or `CacheManager.stats()` — those are module-specific stats; the metrics reporter is an observability-level aggregation layer that works from trace data
- **IS NOT:** A debug overlay or dashboard UI — that's Story 8.3
- **IS NOT:** A factory wiring story — Story 8.5 wires `createMetricsTransport` into the collector

**Module dependency rules:**
- `observe/metrics.ts` imports ONLY from `./metrics.types` and `./observe.types` (for `TraceTransport`)
- `observe/metrics-transport.ts` imports from `./metrics.types` (for `MetricsReporter`) and `./observe.types` (for `TraceTransport`)
- `observe/metrics.types.ts` has ZERO imports — all types are self-contained
- Do NOT import from `../cache`, `../policy`, `../generation`, or any non-observe module
- Type-only import from `../types` is acceptable ONLY for `GenerationTrace` in the transport (needed for `send(trace)` parameter)
- Zero new runtime dependencies
- `sideEffects: false` must be maintained in package.json

### Implementation Patterns (MUST follow)

**Factory pattern (established codebase convention):**
```typescript
// Follow the create* factory pattern from createCostManager, createObservabilityCollector
export function createMetricsReporter(): MetricsReporter {
  let lastGenerationCost = 0;
  let sessionTotal = 0;
  let generationCount = 0;
  const dailyBuckets = new Map<string, number>(); // 'YYYY-MM-DD' → total cost

  const cacheLevels = {
    L1: { hits: 0, misses: 0 },
    L2: { hits: 0, misses: 0 },
    L3: { hits: 0, misses: 0 },
  };
  let evictionCount = 0;

  function todayKey(): string {
    return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
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

  function recordCacheEvent(
    level: 'L1' | 'L2' | 'L3',
    result: 'hit' | 'miss',
  ): void {
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
    // Build per-level + aggregate
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

  return { recordCost, recordCacheEvent, recordEviction, getCostMetrics, getCacheMetrics, exportMetrics, reset };
}
```

**Metrics transport — bridges collector to reporter:**
```typescript
import type { GenerationTrace } from '../types';
import type { MetricsReporter } from './metrics.types';
import type { TraceTransport } from './observe.types';

export function createMetricsTransport(reporter: MetricsReporter): TraceTransport {
  return {
    name: 'metrics',
    async send(trace: GenerationTrace): Promise<void> {
      for (const step of trace.steps) {
        // Extract cost data from cost-manager recordCost steps
        if (step.module === 'cost-manager' && step.operation === 'recordCost') {
          const actualCost = step.metadata.actualCost;
          if (typeof actualCost === 'number') {
            reporter.recordCost(actualCost);
          }
        }

        // Extract cache data from cache lookup steps
        if (step.module === 'cache' && step.operation === 'lookup') {
          const result = step.metadata.result;
          const level = step.metadata.level;
          if (result === 'hit' && (level === 'L1' || level === 'L2' || level === 'L3')) {
            reporter.recordCacheEvent(level, 'hit');
          } else if (result === 'miss') {
            reporter.recordCacheEvent('L1', 'miss');
          }
        }
      }
    },
  };
}
```

**How trace data flows to metrics (existing enrichment patterns):**
```typescript
// cost-manager.ts line 215-227 — already enriches trace with:
trace.addStep({
  module: 'cost-manager',
  operation: 'recordCost',
  durationMs: 0,
  metadata: { model, actualCost, estimatedCost, totalUsage, sessionSpent, dailySpent },
});

// cache.ts lines 113-117, 131-135, 151-155 — already enriches trace with:
trace.addStep({
  module: 'cache',
  operation: 'lookup',
  durationMs,
  metadata: { result: 'hit', level: 'L1', key: '...' },
});

// cache.ts line 164-167 — cache miss:
trace.addStep({
  module: 'cache',
  operation: 'lookup',
  durationMs,
  metadata: { result: 'miss', key: '...' },
});
```

### Existing Code to Reuse (DO NOT reinvent)

| What | Where | How to use |
|------|-------|------------|
| `GenerationTrace` interface | `packages/core/src/types.ts:108-115` | Type-only import in metrics-transport for `send(trace)` parameter |
| `TraceStep` interface | `packages/core/src/types.ts:90-102` | Type-only import — used when iterating trace.steps |
| `TraceTransport` interface | `packages/core/src/observe/observe.types.ts:7-10` | Import for `createMetricsTransport` return type |
| `createTrace()` | `packages/core/src/types.ts:178-202` | For test setup ONLY — create traces with cost/cache steps |
| `ObservabilityCollector` | `packages/core/src/observe/collector.ts` | For integration test — register metrics transport with collector |
| `createObservabilityCollector()` | `packages/core/src/observe/collector.ts` | For integration test setup |
| `CostManager.stats()` | `packages/core/src/policy/cost-manager.ts:232-247` | Reference ONLY — do NOT import; metrics works from trace data |
| `CacheManager.stats()` | `packages/core/src/cache/cache.ts:214-223` | Reference ONLY — do NOT import; metrics works from trace data |

### Design Decisions

**Metrics Reporter reads trace step metadata, NOT module internals:**
The `MetricsReporter` does NOT import or call `CostManager.stats()` or `CacheManager.stats()`. Instead, it receives `GenerationTrace` objects via the metrics transport and extracts cost/cache data from trace step metadata. This preserves the architecture's module isolation rule — `observe/` imports only from `errors/` and accepts trace data as parameters.

**Daily cost uses date-keyed Map, not timer-based reset:**
Daily cost tracking uses a `Map<string, number>` keyed by ISO date string (`YYYY-MM-DD`). When `getCostMetrics()` is called, it returns the total for the current date key. This avoids timer complexity and naturally handles date rollovers. Old date keys are retained in the Map (they are small — just a number per day) and are cleared on `reset()`.

**Cache miss attributed to L1:**
When the trace records a cache miss (no level in metadata because all levels were checked), the metrics transport attributes it to L1 (the first level attempted). This is consistent with how the cache manager works — L1 is always checked first, and a miss means all levels missed. The aggregate hit rate correctly reflects the overall cache effectiveness.

**Eviction tracking via `recordEviction()` — not from trace data yet:**
Currently, the cache module does NOT add a trace step for evictions (evictions happen as a side effect of `set()` in L1 memory storage when `maxEntries` is exceeded). The `recordEviction()` method exists on `MetricsReporter` for future use when Story 8.5 wires eviction events. For now, eviction count will remain `0` unless explicitly called. The aggregate `evictionCount` field is part of the interface to avoid a breaking change later.

**No new error codes needed:**
The metrics module is purely observability — it aggregates data and returns snapshots. There are no failure modes that warrant error codes. Invalid inputs (e.g., negative cost) are handled gracefully (recorded as-is). The existing `FLUI_E031` (transport send failed) covers transport errors if the metrics transport itself fails.

**`exactOptionalPropertyTypes` compliance:**
All optional properties in new types use explicit `| undefined` suffix, following the project's TypeScript strictness established in Story 7-4.

### Previous Story Intelligence

**From Story 8-1 (Observability Collector & Trace Transports — DONE):**
- `ObservabilityCollector.collect()` is synchronous with async `Promise.allSettled` transport fan-out — the metrics transport's `send()` will be called asynchronously
- Transport failures are swallowed silently with `console.error` — the metrics transport should never throw, but even if it does, the collector handles it
- `redactTrace()` is applied BEFORE transports receive the trace — metrics transport may receive redacted metadata. Cost data (`actualCost`) and cache data (`result`, `level`) are NOT PII fields and will NOT be redacted in normal usage
- Buffer transport pattern: `createBufferTransport(maxSize?)` returns `TraceTransport & { getTraces(), clear() }` — follow same extension pattern if metrics transport needs extra methods
- 613 total tests in `@flui/core` at end of Story 8.1 — maintain zero regressions
- Code review caught: redacted trace `addStep`/`steps` inconsistency, negative buffer sizes — be careful with edge cases
- `observe/` module uses NO `FluiError` throws in normal operation — follow this pattern

**From Story 7-2 (Cost Manager & Budget Enforcement — DONE):**
- `CostManager.recordCost()` enriches trace with `{ module: 'cost-manager', operation: 'recordCost', metadata: { model, actualCost, estimatedCost, totalUsage, sessionSpent, dailySpent } }` — this is the exact metadata the metrics transport reads
- `actualCost` is always a `number` (calculated from pricing config) — safe to read as `typeof actualCost === 'number'`
- `DAILY_RESET_INTERVAL_MS = 86_400_000` — the cost manager uses timer-based daily reset; metrics uses date-key-based tracking (independent mechanisms)
- `BudgetStats.records` array contains all `CostRecord` entries — metrics reporter does NOT need this; it works from aggregate trace data

**From Story 7-1 (Three-Level Cache System — DONE):**
- `CacheManager.get()` enriches trace with `{ module: 'cache', operation: 'lookup', metadata: { result: 'hit'|'miss', level?: 'L1'|'L2'|'L3', key: '...' } }`
- Cache miss metadata does NOT include `level` (because all levels were checked) — only `{ result: 'miss', key: '...' }`
- Cache hit metadata includes `level: 'L1'|'L2'|'L3'` — the specific level that served the result
- `CacheStats` interface: `{ l1Size, l2Size, l3Size, hits, misses }` — note: no per-level hit/miss breakdown in the cache module itself; the metrics reporter can provide per-level breakdown from trace data because each trace step records which level served the hit

### Git Intelligence

**Recent commit patterns:**
- `3e73c13` — `feat: implement observability collector and trace transports (story 8-1)`
- `328455d` — `feat: implement concurrency controller, circuit breaker, and generation policy engine (stories 7-3, 7-4)`
- `cdedb77` — `feat: implement cost manager and budget enforcement (story 7-2)`
- `e9b389b` — `feat: implement three-level cache system with memory, session, and IndexedDB storage (story 7-1)`
- All follow: `feat: implement <description> (story X-Y)`
- Implementation order: types → implementation → tests → barrel exports

**Files most recently modified in `@flui/core` (Story 8.1):**
- `packages/core/src/observe/` — complete module (collector, transports, redaction, types, tests)
- `packages/core/src/errors/error-codes.ts` — added FLUI_E031-E032, 'observe' ErrorCategory
- `packages/core/src/index.ts` — added observe module exports

### Testing Standards

- **Framework:** Vitest 4.0.18 with `node` environment (core package)
- **Test structure:** `describe('MetricsReporter') > describe('getCostMetrics') > it('specific behavior')`
- **Coverage:** >90% statement coverage required
- **Import pattern:** Import from relative paths within same package, never from barrel in tests
- **Date mocking pattern for daily rollover tests:**
```typescript
// Mock Date.now() for daily boundary testing
const originalNow = Date.now;
vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-02-27T23:59:59Z').getTime());
// ... record costs for "today"
vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-02-28T00:00:01Z').getTime());
// ... verify dailyTotal reset for new date
// After test:
vi.restoreAllMocks();
```

- **Also mock `new Date()` for `todayKey()` since it uses `new Date().toISOString()`:**
```typescript
vi.useFakeTimers();
vi.setSystemTime(new Date('2026-02-27T15:00:00Z'));
// ... test code
vi.useRealTimers();
```

- **Trace creation for test setup:**
```typescript
import { createTrace } from '../types';

function makeTraceWithCost(actualCost: number): GenerationTrace {
  const trace = createTrace({ id: 'test-trace' });
  trace.addStep({
    module: 'cost-manager',
    operation: 'recordCost',
    durationMs: 0,
    metadata: { model: 'gpt-4o', actualCost, estimatedCost: actualCost, totalUsage: 100, sessionSpent: actualCost, dailySpent: actualCost },
  });
  return trace;
}

function makeTraceWithCacheHit(level: 'L1' | 'L2' | 'L3'): GenerationTrace {
  const trace = createTrace({ id: 'test-trace' });
  trace.addStep({
    module: 'cache',
    operation: 'lookup',
    durationMs: 1,
    metadata: { result: 'hit', level, key: 'test-key...' },
  });
  return trace;
}

function makeTraceWithCacheMiss(): GenerationTrace {
  const trace = createTrace({ id: 'test-trace' });
  trace.addStep({
    module: 'cache',
    operation: 'lookup',
    durationMs: 5,
    metadata: { result: 'miss', key: 'test-key...' },
  });
  return trace;
}
```

### Performance Considerations

- `recordCost()` is O(1) — single addition + Map lookup/set
- `recordCacheEvent()` is O(1) — single increment
- `getCostMetrics()` is O(1) — reads cached values, one Map lookup for daily
- `getCacheMetrics()` is O(1) — computes hit rates from counters (3 levels = 6 divisions)
- `exportMetrics()` is O(1) — combines two O(1) calls + timestamp
- Metrics transport `send()` is O(n) where n = trace steps (typically < 20)
- Daily buckets Map grows at O(1) per calendar day — negligible memory
- Bundle impact: ~1-2KB for metrics module (within observe/ budget)
- No runtime dependencies added
- Tree-shakeable: `createMetricsReporter` and `createMetricsTransport` are independent imports

### Library/Framework Requirements

| Library | Version | Purpose | Already in package.json? |
|---------|---------|---------|-------------------------|
| None | — | No new dependencies needed | N/A |

The metrics module is pure TypeScript with zero dependencies. It type-imports `GenerationTrace` from `../types` and `TraceTransport` from `./observe.types`.

### Project Structure Notes

- This story extends the existing `observe/` module with 3 new files + 1 test file
- Architecture specifies `observe/metrics.ts` as part of the module structure
- All files follow existing naming: kebab-case with co-located tests
- No changes to `@flui/react` package
- No changes to build configuration (tsup/vitest) — existing config covers new files automatically
- `sideEffects: false` must remain in `package.json` for tree-shaking
- No new error codes — reuse existing `FLUI_E031` if transport errors occur

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.2] - User story, acceptance criteria
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 8] - Epic objectives: observability, developer tooling, testing package
- [Source: _bmad-output/planning-artifacts/prd.md#FR49] - Cost metrics: per-generation cost, cumulative session cost, daily cost
- [Source: _bmad-output/planning-artifacts/prd.md#FR50] - Cache metrics: hit rate, miss rate, eviction count
- [Source: _bmad-output/planning-artifacts/prd.md#FR51] - Export traces via transport interface for external systems
- [Source: _bmad-output/planning-artifacts/architecture.md#Module Dependencies] - observe/ → imports errors/ (accepts trace data from any module)
- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting Concerns] - GenerationTrace enrichment by every module, collector aggregation
- [Source: _bmad-output/planning-artifacts/architecture.md#Bundle Size Strategy] - observe/ module allocated ~2KB budget
- [Source: packages/core/src/policy/cost-manager.ts:215-227] - Cost trace enrichment metadata: actualCost, estimatedCost, sessionSpent, dailySpent
- [Source: packages/core/src/cache/cache.ts:113-117,131-135,151-155,164-167] - Cache trace enrichment metadata: result, level, key
- [Source: packages/core/src/observe/observe.types.ts:7-10] - TraceTransport interface
- [Source: packages/core/src/observe/collector.ts] - ObservabilityCollector implementation (transport fan-out pattern)
- [Source: packages/core/src/types.ts:90-115] - TraceStep, GenerationTrace interfaces
- [Source: _bmad-output/implementation-artifacts/8-1-observability-collector-and-trace-transports.md] - Previous story intelligence: factory pattern, transport patterns, test patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No debug issues encountered. All implementations followed the story spec patterns exactly.

### Completion Notes List

- Implemented `CostMetrics`, `CacheLevelMetrics`, `CacheMetrics`, `MetricsSnapshot`, `MetricsReporter` interfaces in `metrics.types.ts` — all self-contained with zero imports
- Implemented `createMetricsReporter()` factory in `metrics.ts` following the established `create*` factory pattern with closure-based state
- `recordCost()` uses date-keyed `Map<string, number>` for daily buckets; `getCostMetrics().dailyTotal` returns current-date bucket
- `getCacheMetrics()` computes per-level and aggregate hit rates on-the-fly from counters
- `recordEviction()` increments aggregate eviction count (ready for future Story 8.5 wiring)
- Implemented `createMetricsTransport()` returning `TraceTransport` named `'metrics'` — extracts cost from `cost-manager.recordCost` steps and cache data from `cache.lookup` steps
- Cache misses attributed to L1 per design decision (all levels checked, L1 is first)
- Updated `observe/index.ts` and `core/src/index.ts` barrel exports with all 5 type exports and 2 value exports
- 25 tests covering: cost accumulation, daily rollover, cache per-level tracking, hit rate calculation, aggregate metrics, eviction count, export/reset, transport extraction, collector integration, multi-trace accumulation
- Coverage: `metrics.ts` 100% all categories, `metrics-transport.ts` 100% stmts/funcs/lines, 83.33% branch
- Full regression suite: 642 tests pass (25 test files), zero regressions from 613 baseline

### File List

New files:
- packages/core/src/observe/metrics.types.ts
- packages/core/src/observe/metrics.ts
- packages/core/src/observe/metrics-transport.ts
- packages/core/src/observe/metrics.test.ts

Modified files:
- packages/core/src/observe/metrics.types.ts
- packages/core/src/observe/metrics.ts
- packages/core/src/observe/metrics.test.ts
- packages/core/src/observe/index.ts
- packages/core/src/index.ts
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-02-27: Implemented cost and cache metrics reporting (Story 8.2) — MetricsReporter factory, MetricsTransport, types, barrel exports, and 25 comprehensive tests
- 2026-02-27: Senior code review fixes applied — added cache miss-rate metrics, switched daily cost bucketing to local calendar day, stabilized integration tests by removing timer waits, and synced sprint tracking to done

### Senior Developer Review (AI)

Date: 2026-02-27
Reviewer: Fabrice
Outcome: Approve

High and medium findings from adversarial review were fixed in this pass.

Issues fixed:

- [HIGH] Implemented cache miss-rate reporting alongside hit-rate reporting in `CacheLevelMetrics` and aggregate cache metrics.
- [MEDIUM] Updated daily cost bucketing to use local calendar date keys instead of UTC date slicing.
- [MEDIUM] Removed timing-fragile `setTimeout` waits from collector integration tests.
- [MEDIUM] Updated story File List to include all modified files and sprint tracking sync file.

Validation evidence:

- Ran: `pnpm --filter @flui/core test -- metrics.test.ts`
- Result: 25/25 test files passed, 642/642 tests passed.
