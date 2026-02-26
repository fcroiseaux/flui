# Story 7.1: Three-Level Cache System

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want generated specifications cached at three levels with configurable TTL and automatic corruption detection,
so that repeated requests are served instantly, reducing latency and LLM costs.

## Acceptance Criteria

1. **Cache Architecture & Key Generation** (FR39): Given the cache/ module in @flui/core, when a UISpecification is generated for an intent+context combination, then the spec is cached at L1 (in-memory Map), L2 (sessionStorage), and L3 (IndexedDB, if configured), and the cache key is a deterministic SHA-256 hash of intent + context + registryVersion + specVersion via Web Crypto API.

2. **L1 (In-Memory) Lookup Performance** (NFR-P3): Given a cached specification at L1, when a cache lookup is performed for the same intent+context, then the cached spec is returned in < 1ms.

3. **L2 (SessionStorage) Lookup & Promotion** (NFR-P4): Given a cached specification at L2 (L1 miss), when a cache lookup is performed, then the cached spec is returned in < 5ms, and the spec is promoted to L1 for future lookups.

4. **L3 (IndexedDB) Lookup & Promotion** (NFR-P5): Given a cached specification at L3 (L1 and L2 miss), when a cache lookup is performed, then the cached spec is returned in < 20ms, and the spec is promoted to L1 and L2.

5. **TTL Configuration & Expiration** (FR40): Given a developer configuring cache, when TTL is set per intent category, then cached specs expire after the configured TTL, and expired specs are evicted on next lookup.

6. **Cache Hit Within TTL** (FR41): Given a repeated intent+context combination within TTL, when a cache lookup is performed, then the cached spec is served directly without triggering an LLM call.

7. **Corruption Detection & Eviction** (NFR-R5): Given a corrupted cache entry (invalid stored spec), when the cache attempts to serve it, then the corruption is detected via schema validation, the entry is evicted, and the lookup returns a cache miss. The application does not crash.

8. **L3 Optional Configuration**: Given L3 IndexedDB cache, then it is optional and requires `idb-keyval` as a peer dependency. The cache system works correctly with only L1 and L2 if L3 is not configured.

9. **Testing Requirements**: Co-located tests cover L1/L2/L3 lookups, cache promotion, TTL expiration, corruption detection and eviction, SHA-256 key determinism, and L3-absent configuration. The GenerationTrace is enriched with cache hit/miss steps. All tests pass with >90% coverage.

## Tasks / Subtasks

- [x] Task 1: Define cache types and interfaces (AC: #1, #5, #8)
  - [x] 1.1 Create `packages/core/src/cache/cache.types.ts` with all type definitions
  - [x] 1.2 Define `CacheKey` type: `{ intentHash: string; contextHash: string; registryVersion: string; specVersion: string }`
  - [x] 1.3 Define `CacheConfig` interface: `{ contextKeySignals?: string[]; ttl?: number; maxEntries?: number; l3Enabled?: boolean; staleWhileRevalidate?: boolean }`
  - [x] 1.4 Define `CacheEntry<T>` type: `{ value: T; createdAt: number; ttl: number; key: string }`
  - [x] 1.5 Define `CacheResult` type: `{ hit: boolean; level?: 'L1' | 'L2' | 'L3'; value?: UISpecification; stale?: boolean }`
  - [x] 1.6 Define `CacheManager` interface: `{ get(key: string): Promise<CacheResult>; set(key: string, spec: UISpecification, ttl?: number): Promise<void>; invalidate(key?: string): Promise<void>; clear(): Promise<void>; stats(): CacheStats }`
  - [x] 1.7 Define `CacheStats` type: `{ l1Size: number; l2Size: number; l3Size: number; hits: number; misses: number }`
  - [x] 1.8 Define `CacheStorage` interface for pluggable L3 backends
  - [x] 1.9 Export all types from cache barrel

- [x] Task 2: Implement cache key generation with SHA-256 (AC: #1)
  - [x] 2.1 Create `packages/core/src/cache/key.ts`
  - [x] 2.2 Implement `buildCacheKey(intent, context, registryVersion, specVersion)` → deterministic string
  - [x] 2.3 Use Web Crypto API (`crypto.subtle.digest('SHA-256', ...)`) for browser environments
  - [x] 2.4 Use `node:crypto` `createHash('sha256')` for Node.js environments via isomorphic detection
  - [x] 2.5 Normalize inputs before hashing: sort context keys alphabetically, JSON.stringify consistently
  - [x] 2.6 Context key filtering: only include signals listed in `CacheConfig.contextKeySignals` (default: all)
  - [x] 2.7 Return hex-encoded hash string

- [x] Task 3: Implement L1 in-memory cache storage (AC: #1, #2, #5)
  - [x] 3.1 Create `packages/core/src/cache/storage/memory.ts`
  - [x] 3.2 Implement `MemoryStorage` using `Map<string, CacheEntry<UISpecification>>`
  - [x] 3.3 TTL check on get: if `Date.now() > entry.createdAt + entry.ttl` → evict and return miss
  - [x] 3.4 LRU eviction: when `maxEntries` exceeded on set, evict oldest entry
  - [x] 3.5 Methods: `get(key)`, `set(key, entry)`, `delete(key)`, `clear()`, `size()`

- [x] Task 4: Implement L2 sessionStorage cache storage (AC: #1, #3, #5)
  - [x] 4.1 Create `packages/core/src/cache/storage/session.ts`
  - [x] 4.2 Implement `SessionStorage` using `globalThis.sessionStorage` with `flui_cache_` key prefix
  - [x] 4.3 Serialize/deserialize CacheEntry via `JSON.stringify`/`JSON.parse`
  - [x] 4.4 TTL check on get (same as L1)
  - [x] 4.5 Graceful degradation: if sessionStorage unavailable (SSR, privacy mode) → no-op storage that always returns miss
  - [x] 4.6 Methods: same interface as MemoryStorage

- [x] Task 5: Implement L3 IndexedDB cache storage (AC: #1, #4, #8)
  - [x] 5.1 Create `packages/core/src/cache/storage/indexeddb.ts`
  - [x] 5.2 Implement `IndexedDBStorage` using lazy `import('idb-keyval')` pattern
  - [x] 5.3 If `idb-keyval` not installed → graceful no-op (log warning, return miss always)
  - [x] 5.4 Use `idb-keyval` 6.2.2 API: `get()`, `set()`, `del()`, `clear()`, `keys()` from custom store
  - [x] 5.5 Custom store: `createStore('flui-cache', 'specs')`
  - [x] 5.6 TTL check on get (same as L1/L2)
  - [x] 5.7 Methods: same interface as MemoryStorage but all async

- [x] Task 6: Implement CacheManager with tiered lookup and promotion (AC: #1, #2, #3, #4, #5, #6, #7)
  - [x] 6.1 Create `packages/core/src/cache/cache.ts`
  - [x] 6.2 Implement `createCacheManager(config: CacheConfig): CacheManager` factory
  - [x] 6.3 Initialize L1 (always), L2 (always), L3 (only if `config.l3Enabled`)
  - [x] 6.4 `get(key)` lookup order: L1 → L2 → L3 → miss
  - [x] 6.5 Promotion on hit: L2 hit → promote to L1; L3 hit → promote to L1 + L2
  - [x] 6.6 `set(key, spec, ttl?)` writes to all configured levels
  - [x] 6.7 Corruption detection: validate retrieved spec against `uiSpecificationSchema` (Zod) before returning; evict if invalid
  - [x] 6.8 `invalidate(key?)` removes specific key or all entries
  - [x] 6.9 `clear()` clears all levels
  - [x] 6.10 `stats()` returns hit/miss counters and sizes per level
  - [x] 6.11 Record cache operations in GenerationTrace via `addStep()` with module `'cache'`

- [x] Task 7: Add new error codes for cache module (AC: #7)
  - [x] 7.1 Add `FLUI_E024` — Cache corruption detected: stored specification failed schema validation
  - [x] 7.2 Add `FLUI_E025` — Cache storage unavailable: L2/L3 storage backend not accessible
  - [x] 7.3 Update `DefinedFluiErrorCode` union type and `ERROR_CODE_DESCRIPTIONS` map
  - [x] 7.4 Export new error codes from errors barrel and core barrel

- [x] Task 8: Create barrel exports (AC: all)
  - [x] 8.1 Create `packages/core/src/cache/index.ts` exporting all public types and `createCacheManager`
  - [x] 8.2 Update `packages/core/src/index.ts` to export cache module types and factory
  - [x] 8.3 Verify TypeScript compilation succeeds with all exports

- [x] Task 9: Write comprehensive tests (AC: #1, #2, #3, #4, #5, #6, #7, #8, #9)
  - [x] 9.1 Create `packages/core/src/cache/key.test.ts`:
    - Test deterministic hash: same inputs → same hash
    - Test different inputs → different hashes
    - Test context signal filtering with `contextKeySignals`
    - Test input normalization (key order independence)
    - Test hash format (hex string)
  - [x] 9.2 Create `packages/core/src/cache/storage/memory.test.ts`:
    - Test set and get
    - Test TTL expiration
    - Test LRU eviction at maxEntries
    - Test delete and clear
  - [x] 9.3 Create `packages/core/src/cache/storage/session.test.ts`:
    - Test set and get with sessionStorage mock
    - Test TTL expiration
    - Test graceful degradation when sessionStorage unavailable
    - Test key prefix isolation (`flui_cache_`)
  - [x] 9.4 Create `packages/core/src/cache/storage/indexeddb.test.ts`:
    - Test set and get with idb-keyval mock
    - Test TTL expiration
    - Test graceful no-op when idb-keyval not available
  - [x] 9.5 Create `packages/core/src/cache/cache.test.ts`:
    - Test L1 hit returns immediately
    - Test L2 hit promotes to L1
    - Test L3 hit promotes to L1 + L2
    - Test complete miss returns `{ hit: false }`
    - Test corruption detection: invalid spec evicted, returns miss
    - Test TTL expiration across all levels
    - Test invalidate specific key
    - Test invalidate all (clear)
    - Test stats tracking (hits/misses/sizes)
    - Test L3-disabled configuration (only L1 + L2)
    - Test GenerationTrace enrichment with cache steps
  - [x] 9.6 All tests pass with >90% statement coverage

## Dev Notes

### Architecture Compliance

**Package:** `@flui/core` — new `cache/` module (ADR-003, ADR-015, ADR-018)

**New files (architecture-specified):**
```
packages/core/src/cache/
  ├── index.ts                  # Public API barrel
  ├── cache.ts                  # CacheManager factory and tiered lookup
  ├── cache.types.ts            # All cache type definitions
  ├── key.ts                    # Deterministic SHA-256 cache key generation
  ├── key.test.ts               # Key generation tests
  ├── cache.test.ts             # CacheManager integration tests
  └── storage/
      ├── memory.ts             # L1 — Map-based in-memory storage
      ├── memory.test.ts        # L1 storage tests
      ├── session.ts            # L2 — sessionStorage wrapper
      ├── session.test.ts       # L2 storage tests
      ├── indexeddb.ts           # L3 — IndexedDB via idb-keyval (optional)
      └── indexeddb.test.ts      # L3 storage tests
```

**Modified files:**
```
packages/core/src/
  ├── errors/error-codes.ts     # Add FLUI_E024, FLUI_E025
  ├── errors/index.ts           # Export new error codes
  ├── index.ts                  # Export cache module
```

**Do NOT create these files** (they belong to future stories in this epic):
- `policy/` directory — Generation policy engine (Story 7.4)
- `policy/cost-manager.ts` — Cost manager and budgeting (Story 7.2)
- `policy/generation-policy.ts` — Generation policy (Story 7.4)
- `concurrency/` directory — Concurrency controller and circuit breaker (Story 7.3)
- Any integration with GenerationOrchestrator — that belongs to Story 7.4 (policy engine wires cache into the generation pipeline)

**Package dependency rules:**
- `@flui/core` → `zod@4.x` (only runtime dependency)
- `idb-keyval@6.x` is an OPTIONAL peer dependency for L3 cache — NOT a hard dependency
- Import `uiSpecificationSchema` from `../spec` for corruption detection
- Import `FluiError`, error codes from `../errors`
- Import `GenerationTrace`, `TraceStep` from `../types`
- Zero new required runtime dependencies
- `sideEffects: false` must be maintained in package.json

### Implementation Patterns (MUST follow)

**Factory pattern (established codebase convention):**
```typescript
// Follow the create* factory pattern used throughout @flui/core
export function createCacheManager(config?: CacheConfig): CacheManager {
  const l1 = createMemoryStorage(config?.maxEntries);
  const l2 = createSessionStorage();
  const l3 = config?.l3Enabled ? createIndexedDBStorage() : null;
  // ... return CacheManager implementation
}
```

**Result pattern — cache does NOT use Result<T> for lookups:**
Cache lookups return `CacheResult` directly (not wrapped in Result). Cache misses are expected control flow, not errors. Only use `FluiError` for actual failures (corruption, storage unavailable).

**SHA-256 key generation (isomorphic):**
```typescript
// Browser + Node.js compatible SHA-256 hashing
async function sha256(input: string): Promise<string> {
  // Check for Web Crypto API (browser + Node 15+)
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback: Node.js crypto module
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(input).digest('hex');
}
```

**Input normalization for deterministic keys:**
```typescript
function normalizeForKey(
  intent: string,
  context: Record<string, unknown>,
  registryVersion: string,
  specVersion: string,
  contextKeySignals?: string[],
): string {
  // Filter context signals if contextKeySignals specified
  const filteredContext = contextKeySignals
    ? Object.fromEntries(
        Object.entries(context)
          .filter(([key]) => contextKeySignals.includes(key))
      )
    : context;

  // Sort keys for determinism
  const sortedContext = JSON.stringify(filteredContext, Object.keys(filteredContext).sort());

  return JSON.stringify({
    intent,
    context: sortedContext,
    registryVersion,
    specVersion,
  });
}
```

**Tiered lookup with promotion:**
```typescript
async function get(key: string): Promise<CacheResult> {
  // L1 — synchronous, fastest
  const l1Hit = l1.get(key);
  if (l1Hit && !isExpired(l1Hit)) {
    stats.hits++;
    return { hit: true, level: 'L1', value: validateSpec(l1Hit.value) };
  }

  // L2 — sessionStorage
  const l2Hit = l2.get(key);
  if (l2Hit && !isExpired(l2Hit)) {
    l1.set(key, l2Hit); // Promote to L1
    stats.hits++;
    return { hit: true, level: 'L2', value: validateSpec(l2Hit.value) };
  }

  // L3 — IndexedDB (async, optional)
  if (l3) {
    const l3Hit = await l3.get(key);
    if (l3Hit && !isExpired(l3Hit)) {
      l1.set(key, l3Hit); // Promote to L1
      l2.set(key, l3Hit); // Promote to L2
      stats.hits++;
      return { hit: true, level: 'L3', value: validateSpec(l3Hit.value) };
    }
  }

  stats.misses++;
  return { hit: false };
}
```

**Corruption detection via Zod validation:**
```typescript
import { uiSpecificationSchema } from '../spec';

function validateSpec(spec: unknown): UISpecification | null {
  const result = uiSpecificationSchema.safeParse(spec);
  if (result.success) {
    return result.data;
  }
  // Corrupted — will be evicted by caller
  return null;
}
```

**L3 lazy loading (tree-shaking friendly):**
```typescript
// In storage/indexeddb.ts
let idbModule: typeof import('idb-keyval') | null = null;

async function getIdbKeyval(): Promise<typeof import('idb-keyval') | null> {
  if (idbModule) return idbModule;
  try {
    idbModule = await import('idb-keyval');
    return idbModule;
  } catch {
    // idb-keyval not installed — graceful no-op
    return null;
  }
}
```

**GenerationTrace enrichment:**
```typescript
// When reporting cache results to trace
trace.addStep({
  module: 'cache',
  operation: 'lookup',
  durationMs: lookupDurationMs,
  metadata: {
    result: 'hit', // or 'miss', 'expired', 'corrupted'
    level: 'L1',   // only on hit
    key: cacheKey.substring(0, 12) + '...', // truncated for safety
    ttlRemaining: ttlRemainingMs,
  },
});
```

### Error Handling

**New error codes:**
- `FLUI_E024` — Cache corruption detected: stored specification failed schema validation (category: `'cache'`)
- `FLUI_E025` — Cache storage unavailable: L2/L3 storage backend not accessible (category: `'cache'`)

**Error scenarios:**
- Corrupted L1 entry → evict from L1, continue to L2. Log warning. Return FluiError context with `{ code: FLUI_E024, key, level: 'L1' }`.
- Corrupted L2 entry → evict from L2, continue to L3. Same handling.
- Corrupted L3 entry → evict from L3, return miss. Same handling.
- sessionStorage unavailable (SSR / privacy mode) → L2 becomes no-op. No error, just skip.
- idb-keyval not installed → L3 becomes no-op. Log info message once, never error.
- sessionStorage quota exceeded on set → catch, log warning, skip L2 write. Do not throw.
- IndexedDB quota exceeded on set → catch, log warning, skip L3 write. Do not throw.

**Critical: cache failures NEVER crash the application.** All storage operations are wrapped in try/catch. A complete cache failure means the system degrades to always-generate (no caching), which is valid operation.

### Existing Code to Reuse (DO NOT reinvent)

| What | Where | How to use |
|------|-------|------------|
| `UISpecification` type | `@flui/core` spec barrel | Type for cached values |
| `uiSpecificationSchema` | `@flui/core` spec barrel | Zod schema for corruption detection |
| `SPEC_VERSION` | `@flui/core` spec barrel | Part of cache key |
| `FluiError` class | `@flui/core` errors barrel | Error reporting for cache corruption |
| `Result<T>` type | `@flui/core` errors barrel | NOT used for cache lookups — use CacheResult |
| `GenerationTrace` | `@flui/core` types | Enriching trace with cache steps |
| `TraceStep` | `@flui/core` types | Structure for trace step metadata |
| `createTrace()` | `@flui/core` types | For testing trace enrichment |

### Design Decisions

**Three-level architecture rationale:**
- L1 (Map): O(1) lookup, zero serialization overhead, lost on page refresh. Perfect for SPA navigation.
- L2 (sessionStorage): Survives soft navigation within same tab. ~5KB per entry serialized. Limited to ~5MB total.
- L3 (IndexedDB): Persists across sessions. Arbitrary size. Async. Optional to avoid forcing the dependency.

**SHA-256 via Web Crypto (not a library):**
Web Crypto API is available in all modern browsers and Node.js 15+. Using it avoids adding a crypto library dependency. The async nature of `crypto.subtle.digest()` is acceptable since cache key computation happens before the (much slower) LLM call.

**CacheResult instead of Result<T>:**
Cache misses are normal control flow, not errors. Using a dedicated `CacheResult` type with `hit: boolean` is cleaner than `Result<UISpecification>` where `err` would be ambiguous (miss vs. corruption vs. storage failure).

**Lazy idb-keyval import:**
`idb-keyval` is loaded via dynamic `import()` only when L3 is configured. Developers who don't use L3 pay zero bundle cost. The `idb-keyval` package is 6.2.2 (latest stable), ~600 bytes gzipped — extremely lightweight.

**LRU eviction for L1:**
L1 uses maxEntries (default 100) with LRU eviction. This prevents unbounded memory growth in long-running SPAs. L2 is bounded by sessionStorage quota (~5MB). L3 is bounded by IndexedDB quota (typically 50-100MB+).

**No stale-while-revalidate in this story:**
The `staleWhileRevalidate` configuration option is defined in types but NOT implemented in this story. It requires integration with the GenerationOrchestrator (Story 7.4). This story only implements the cache lookup/set/invalidate mechanics.

### Project Structure Notes

- This is the FIRST story in Epic 7 — establishing the `cache/` module in `@flui/core`
- All existing modules in core follow the pattern: `module/index.ts` (barrel) + `module/types.ts` + `module/implementation.ts` + `module/tests.ts`
- Storage subdirectory (`cache/storage/`) is new but follows the architecture's file structure specification
- Test files are co-located: `{source}.test.ts` in the same directory
- No changes to `@flui/react` package in this story — cache is a core concern
- No changes to build configuration (tsup/vitest) needed — existing config covers new directory
- `sideEffects: false` must remain in `package.json` for tree-shaking

### Previous Story Intelligence

**From Story 6-3 (Visual Transitions & Accessibility — DONE, last completed story):**
- `exactOptionalPropertyTypes` strictness is enabled — all optional properties need explicit `| undefined`
- Test setup in `test-setup.ts` handles DOM mocks (matchMedia) — may need similar mocks for `sessionStorage` and `crypto.subtle`
- `vi.useFakeTimers()` used successfully for timeout testing — use for TTL expiration tests
- 127 tests across @flui/react, 94.53% coverage — maintain zero regressions
- No cross-package dependencies introduced in React stories — cache is core-only

**From Story 4-2 (Generation Orchestrator — DONE):**
- `GenerationOrchestrator` currently does NOT check cache — Story 7.4 will integrate cache into the pipeline
- `GenerationTrace.addStep()` already sanitizes metadata — follow same pattern for cache steps
- `makeConfig()`, `makeInput()` test helpers exist — consider similar helpers for cache tests
- The orchestrator passes `signal?: AbortSignal` — cache operations should respect abort signals where applicable

**From Story 1-3 (FluiError & Result Pattern — DONE):**
- `FluiError` constructor: `new FluiError(code, message, options?)` where options has `{ category?, cause?, context? }`
- Error codes are string constants exported from `error-codes.ts`
- `DefinedFluiErrorCode` union must include new codes
- `ERROR_CODE_DESCRIPTIONS` record must include new descriptions

### Git Intelligence

**Recent commit patterns:**
- `7071d52` — `feat: implement visual transitions and accessibility for LiquidView (story 6-3)` (latest)
- `a9d0909` — `feat: implement interaction wiring and view state management (story 6-2)`
- All commits follow: `feat: implement <description> (story X-Y)`
- Implementation order: types → implementation → tests → barrel exports

**Files most recently modified in `@flui/core`:**
- Validation module files (Story 5-3)
- Data resolver files (Story 4-4)
- Generation module files (Story 4-2, 4-3)

### Testing Standards

- **Framework:** Vitest 4.0.18 with `node` environment (core package, NOT jsdom)
- **Test structure:** `describe('ModuleName') > describe('feature') > it('specific behavior')`
- **Coverage:** >90% statement coverage required
- **Mock pattern:** Use `vi.fn()` for callbacks, `vi.spyOn()` for module mocks
- **Async tests:** Use `async/await` directly (no waitFor needed in node environment)
- **Import pattern:** Import from relative paths within same package, never from barrel in tests

**Testing environment-specific APIs (sessionStorage, crypto, IndexedDB):**
```typescript
// Mock sessionStorage for L2 tests
const mockSessionStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
})();
Object.defineProperty(globalThis, 'sessionStorage', { value: mockSessionStorage, writable: true });

// Mock crypto.subtle for SHA-256 tests
// In node environment, crypto.subtle is available natively (Node 15+)
// Tests should verify deterministic output with known inputs

// Mock idb-keyval for L3 tests
vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  clear: vi.fn(),
  keys: vi.fn(),
  createStore: vi.fn(() => 'mock-store'),
}));
```

**Test timing for performance assertions:**
```typescript
// L1 performance test
it('returns L1 hit in < 1ms', async () => {
  await manager.set(key, validSpec);
  const start = performance.now();
  const result = await manager.get(key);
  const elapsed = performance.now() - start;
  expect(result.hit).toBe(true);
  expect(result.level).toBe('L1');
  expect(elapsed).toBeLessThan(1);
});
```

### Performance Considerations

- L1 Map lookup is O(1) — meets < 1ms budget easily
- L2 sessionStorage `getItem` + `JSON.parse` — typically < 2ms for ~5KB entries
- L3 IndexedDB async read — typically < 10ms, well within 20ms budget
- SHA-256 hash computation: ~0.1ms for typical intent+context strings via Web Crypto
- Corruption detection via Zod `safeParse`: ~0.5ms for UISpecification — negligible
- LRU eviction: O(1) with Map (insertion order tracking) — no performance concern
- Bundle impact: ~3KB for cache module (within core's 25KB budget, ~16.4KB current estimated)
- No additional required runtime dependencies — Web Crypto + Map + sessionStorage are platform APIs

### Library/Framework Requirements

| Library | Version | Purpose | Already in package.json? |
|---------|---------|---------|-------------------------|
| `zod` | 4.3.6 | Schema validation for corruption detection | Yes (dependency) |
| `idb-keyval` | ^6.2.2 | L3 IndexedDB cache backend | No — add as OPTIONAL peer dependency |

**idb-keyval peer dependency setup:**
```json
// In packages/core/package.json
{
  "peerDependencies": {
    "idb-keyval": "^6.2.0"
  },
  "peerDependenciesMeta": {
    "idb-keyval": {
      "optional": true
    }
  }
}
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.1] - User story, acceptance criteria, BDD scenarios
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7] - Epic objectives: caching, cost control, concurrency
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-003] - Caching as core module, three-level architecture, cache key strategy, invalidation
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-015] - Performance budgets: L1 < 1ms, L2 < 5ms, L3 < 20ms, core bundle < 25KB
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-018] - Bundle size strategy, tree-shaking, lazy loading for optional deps
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Directory Structure] - packages/core/src/cache/ layout
- [Source: _bmad-output/planning-artifacts/architecture.md#Module Boundary Rules] - Import from barrel files only, sideEffects: false
- [Source: _bmad-output/planning-artifacts/prd.md#FR39] - 3-level cache (memory, session, persistent)
- [Source: _bmad-output/planning-artifacts/prd.md#FR40] - Configure cache TTL per intent category
- [Source: _bmad-output/planning-artifacts/prd.md#FR41] - Serve cached specs for repeated intent+context within TTL
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-P3] - L1 cache lookup < 1ms
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-P4] - L2 cache lookup < 5ms
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-P5] - L3 cache lookup < 20ms
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-R5] - Corrupted cache entries detected via schema validation
- [Source: packages/core/src/spec/spec.types.ts] - UISpecification, ComponentSpec, UISpecificationMetadata types
- [Source: packages/core/src/types.ts] - GenerationTrace, TraceStep, LLMUsage interfaces
- [Source: packages/core/src/errors/error-codes.ts] - Existing error codes FLUI_E001–FLUI_E023, pattern for new codes
- [Source: packages/core/src/index.ts] - Core barrel export pattern
- [Source: _bmad-output/implementation-artifacts/6-3-visual-transitions-and-accessibility.md] - Previous story intelligence
- [Source: https://www.npmjs.com/package/idb-keyval] - idb-keyval 6.2.2 latest stable
- [Source: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest] - Web Crypto API SHA-256

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean implementation with no blocking issues.

### Completion Notes List

- Implemented complete three-level cache system (L1 Map, L2 sessionStorage, L3 IndexedDB) in `packages/core/src/cache/`
- SHA-256 key generation using Web Crypto API with node:crypto fallback for isomorphic support
- L1 MemoryStorage: O(1) lookup, LRU eviction, TTL expiration
- L2 SessionStorage: sessionStorage wrapper with `flui_cache_` prefix, graceful degradation for SSR/privacy mode
- L3 IndexedDBStorage: Lazy idb-keyval import, graceful no-op when not installed
- CacheManager: Tiered lookup (L1→L2→L3), automatic promotion on hit, corruption detection via Zod validation
- Added FLUI_E024 (cache corruption) and FLUI_E025 (storage unavailable) error codes
- GenerationTrace enrichment for cache hit/miss operations
- idb-keyval added as optional peer dependency in package.json
- 59 cache-specific tests, 451 total @flui/core tests, 129 @flui/react tests — all passing (580 total, 0 regressions)
- Cache module coverage: 93.25% statements, 93.18% lines (>90% requirement met)
- Senior review fixes applied: L3 now uses dedicated IndexedDB store `flui-cache/specs` via `createStore()` and logs once when optional `idb-keyval` is unavailable
- Senior review fixes applied: L3 loading race condition removed, L3 hit path stabilized, and CacheManager now keeps `l3Size` stats synchronized after set/invalidate/clear/corruption paths
- Senior review fixes applied: cache tests expanded for dedicated L3 store wiring and L3 size reporting

### Change Log

- 2026-02-26: Story 7.1 implemented — Three-level cache system with all 9 tasks complete
- 2026-02-26: Senior code review fixes applied — addressed HIGH and MEDIUM findings (L3 store wiring, logging, L3 stats, and story file list transparency)

### File List

**New files:**
- packages/core/src/cache/cache.types.ts
- packages/core/src/cache/cache.ts
- packages/core/src/cache/cache.test.ts
- packages/core/src/cache/key.ts
- packages/core/src/cache/key.test.ts
- packages/core/src/cache/index.ts
- packages/core/src/cache/storage/memory.ts
- packages/core/src/cache/storage/memory.test.ts
- packages/core/src/cache/storage/session.ts
- packages/core/src/cache/storage/session.test.ts
- packages/core/src/cache/storage/indexeddb.ts
- packages/core/src/cache/storage/indexeddb.test.ts

**Modified files:**
- packages/core/src/errors/error-codes.ts (added FLUI_E024, FLUI_E025)
- packages/core/src/errors/index.ts (exported new error codes)
- packages/core/src/errors/errors.test.ts (updated count from 23 to 25)
- packages/core/src/index.ts (added cache module exports + new error codes)
- packages/core/package.json (added idb-keyval optional peer dependency)
- _bmad-output/implementation-artifacts/sprint-status.yaml (story status sync)

## Senior Developer Review (AI)

### Reviewer

- Reviewer: Fabrice (AI-assisted)
- Date: 2026-02-26
- Outcome: Changes Requested -> Fixed -> Approved

### Findings Resolved

- HIGH: Implemented required custom IndexedDB store (`createStore('flui-cache', 'specs')`) and routed all L3 operations through that store.
- HIGH: Fixed L3 stats reporting by synchronizing `l3Size` after L3 mutations and corruption eviction.
- MEDIUM: Added one-time informational log when optional `idb-keyval` dependency is unavailable.
- MEDIUM: Updated story documentation to include sprint status file synchronization in modified files.

### Validation Evidence

- Ran `pnpm --filter @flui/core test` after fixes.
- Result: 19 test files passed, 453 tests passed.
