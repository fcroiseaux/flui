# Story 7.4: Generation Policy Engine

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a unified policy engine that decides when to generate, serve from cache, or show fallback,
so that the system makes intelligent decisions balancing freshness, cost, and reliability automatically.

## Acceptance Criteria

1. **Policy Decision Evaluation** (FR43): Given the policy/ module in @flui/core, when a generation request arrives, then the policy engine evaluates cache state, budget state, and circuit breaker state to decide the action, and the decision is one of: `generate` (call LLM), `serve-from-cache`, or `show-fallback`.

2. **Cache Hit Path**: Given a cache hit within TTL and budget available, when the policy evaluates, then the decision is `serve-from-cache` (fastest, cheapest path).

3. **Cache Miss with Budget Available**: Given a cache miss with budget available and circuit breaker inactive (closed), when the policy evaluates, then the decision is `generate` (call LLM).

4. **Cache Miss with Budget Exhausted**: Given a cache miss with budget exhausted, when the policy evaluates, then the decision is `show-fallback` (cannot generate, nothing cached).

5. **Circuit Breaker Override**: Given a circuit breaker in active (open) state, when the policy evaluates regardless of cache or budget, then the decision is `show-fallback` (circuit breaker overrides all other signals).

6. **Trace Enrichment**: Given any policy decision, then the decision reasoning is recorded in the GenerationTrace with the evaluated inputs (cache state, budget remaining, circuit breaker state), and the policy is deterministic for the same input state.

7. **Testing Requirements**: Co-located tests cover all decision matrix combinations (cache hit/miss × budget available/exhausted × circuit breaker active/inactive), and all tests pass with >90% coverage.

## Tasks / Subtasks

- [x] Task 1: Define generation policy types (AC: #1, #2, #3, #4, #5, #6)
  - [x] 1.1 Create `packages/core/src/policy/generation-policy.types.ts` with all policy type definitions:
    - `PolicyAction` type: `'generate' | 'serve-from-cache' | 'show-fallback'`
    - `PolicyInput` interface: `{ cacheResult: CacheResult; budgetCheck: BudgetCheckResult; circuitBreakerState: CircuitBreakerState }`
    - `PolicyDecision` interface: `{ action: PolicyAction; reason: string; inputs: PolicyInput }`
    - `GenerationPolicyEngine` interface: `{ evaluate(input: PolicyInput): PolicyDecision }`
    - `GenerationPolicyConfig` interface: `{ /* Reserved for future per-view/per-intent customization — no fields needed for Story 7.4 */ }`
  - [x] 1.2 Export all new types from `policy/index.ts`

- [x] Task 2: Implement generation policy engine (AC: #1, #2, #3, #4, #5, #6)
  - [x] 2.1 Create `packages/core/src/policy/generation-policy.ts`
  - [x] 2.2 Implement `createGenerationPolicyEngine(config?: GenerationPolicyConfig | undefined, trace?: GenerationTrace | undefined): GenerationPolicyEngine`
  - [x] 2.3 Implement `evaluate(input: PolicyInput): PolicyDecision` with deterministic decision matrix:
    - **Circuit breaker OPEN → `show-fallback`** (always — circuit breaker overrides everything)
    - **Cache hit (result.hit === true) → `serve-from-cache`** (fastest path, regardless of budget)
    - **Cache miss + budget allowed (budgetCheck.allowed === true) + circuit breaker CLOSED → `generate`**
    - **Cache miss + budget exhausted (budgetCheck.allowed === false) → `show-fallback`**
    - **Circuit breaker HALF-OPEN + cache miss + budget available → `generate`** (probe request allowed by circuit breaker)
  - [x] 2.4 Enrich GenerationTrace with `trace?.addStep({ module: 'generation-policy', operation: 'evaluate', durationMs: 0, metadata: { action, reason, cacheHit, budgetAllowed, circuitBreakerState } })`

- [x] Task 3: Update barrel exports (AC: all)
  - [x] 3.1 Update `packages/core/src/policy/index.ts` to export `createGenerationPolicyEngine` and new types (`PolicyAction`, `PolicyInput`, `PolicyDecision`, `GenerationPolicyEngine`, `GenerationPolicyConfig`)
  - [x] 3.2 Update `packages/core/src/index.ts` to export new policy types and factory from core barrel
  - [x] 3.3 Verify TypeScript compilation succeeds with all exports

- [x] Task 4: Write comprehensive tests (AC: #1, #2, #3, #4, #5, #6, #7)
  - [x] 4.1 Create `packages/core/src/policy/generation-policy.test.ts`:
    - **Decision Matrix Tests (full combinatorial coverage):**
      - Test: cache hit + budget available + circuit CLOSED → `serve-from-cache`
      - Test: cache hit + budget available + circuit OPEN → `show-fallback` (circuit breaker overrides)
      - Test: cache hit + budget exhausted + circuit CLOSED → `serve-from-cache` (cache hit doesn't need budget)
      - Test: cache hit + budget exhausted + circuit OPEN → `show-fallback` (circuit breaker overrides)
      - Test: cache miss + budget available + circuit CLOSED → `generate`
      - Test: cache miss + budget available + circuit OPEN → `show-fallback` (circuit breaker overrides)
      - Test: cache miss + budget exhausted + circuit CLOSED → `show-fallback`
      - Test: cache miss + budget exhausted + circuit OPEN → `show-fallback` (circuit breaker overrides)
      - Test: cache miss + budget available + circuit HALF-OPEN → `generate` (probe allowed)
      - Test: cache hit + budget available + circuit HALF-OPEN → `serve-from-cache` (cache hit wins)
      - Test: cache miss + budget exhausted + circuit HALF-OPEN → `show-fallback`
    - **Determinism Tests:**
      - Test: same inputs always produce same decision
      - Test: decision includes all input states in reasoning
    - **Trace Integration Tests:**
      - Test: evaluate records trace step with module 'generation-policy'
      - Test: trace metadata includes action, reason, cache state, budget state, circuit breaker state
      - Test: evaluate works correctly without trace (trace is optional)
    - **Factory Tests:**
      - Test: createGenerationPolicyEngine returns a valid GenerationPolicyEngine
      - Test: createGenerationPolicyEngine accepts optional config and trace
  - [x] 4.2 All tests pass with >90% statement coverage

## Dev Notes

### Architecture Compliance

**Package:** `@flui/core` — `policy/` module extension (ADR-004, ADR-006)

**New files (architecture-specified):**
```
packages/core/src/policy/
  ├── generation-policy.ts          # GenerationPolicyEngine factory and decision logic
  ├── generation-policy.types.ts    # Policy type definitions (PolicyAction, PolicyInput, PolicyDecision)
  └── generation-policy.test.ts     # Co-located tests for generation policy engine
```

**Modified files:**
```
packages/core/src/
  ├── policy/index.ts               # Export new types and factory
  └── index.ts                      # Export policy types and factory from core barrel
```

**Do NOT create these files** (they belong to future stories):
- `flui.ts` — Factory wiring that composes all modules (Story 8.5: zero-config DX)
- Any React hooks or LiquidView changes — React integration is in @flui/react (already done in Epic 6)
- Any observability collector — that's Story 8.1
- Any re-generation trigger logic (debounce, rate limiting, trigger matching from ADR-004's `GenerationPolicy` interface) — that's future Phase 2 work
- `RetryConfig` or retry strategy — retry is already done in Story 5.3

**What this story IS vs IS NOT:**
- **IS:** A pure decision engine that takes cache state, budget state, and circuit breaker state as inputs and returns a deterministic action (`generate`, `serve-from-cache`, `show-fallback`)
- **IS NOT:** The full `GenerationPolicy` from ADR-004 (which includes triggers, debounce, rate limiting, stability checks). The trigger/debounce/rate-limit aspects are Phase 2 concerns. Story 7.4 only implements the *decision* part of FR43.
- **IS NOT:** An integration story — the policy engine does NOT call CacheManager, CostManager, or ConcurrencyController directly. It receives their outputs as inputs (PolicyInput). The wiring happens in Story 8.5 (`flui.ts` factory).

**Package dependency rules:**
- Import `CacheResult` from `../cache` (type-only import)
- Import `BudgetCheckResult` from `./policy.types` (same module, type-only)
- Import `CircuitBreakerState` from `../concurrency` (type-only import)
- Import `GenerationTrace` from `../types` (type-only for interface, value for trace?.addStep)
- Zero new runtime dependencies
- Zero new peer dependencies
- `sideEffects: false` must be maintained in package.json
- Module boundary: `policy/ → imports generation/, cache/, errors/` (architecture spec)

### Implementation Patterns (MUST follow)

**Factory pattern (established codebase convention):**
```typescript
// Follow the create* factory pattern established in createCostManager, createConcurrencyController
export function createGenerationPolicyEngine(
  config?: GenerationPolicyConfig | undefined,
  trace?: GenerationTrace | undefined,
): GenerationPolicyEngine {
  function evaluate(input: PolicyInput): PolicyDecision {
    // Decision matrix — deterministic, no side effects

    // 1. Circuit breaker OPEN always overrides everything → show-fallback
    if (input.circuitBreakerState === 'open') {
      const decision: PolicyDecision = {
        action: 'show-fallback',
        reason: 'Circuit breaker is open — LLM calls blocked',
        inputs: input,
      };
      traceDecision(decision);
      return decision;
    }

    // 2. Cache hit → serve from cache (regardless of budget)
    if (input.cacheResult.hit) {
      const decision: PolicyDecision = {
        action: 'serve-from-cache',
        reason: 'Cache hit — serving cached specification',
        inputs: input,
      };
      traceDecision(decision);
      return decision;
    }

    // 3. Cache miss + budget available + circuit closed or half-open → generate
    if (input.budgetCheck.allowed) {
      const decision: PolicyDecision = {
        action: 'generate',
        reason: input.circuitBreakerState === 'half-open'
          ? 'Cache miss, budget available, circuit breaker half-open — probe generation'
          : 'Cache miss, budget available — generating via LLM',
        inputs: input,
      };
      traceDecision(decision);
      return decision;
    }

    // 4. Cache miss + budget exhausted → show fallback
    const decision: PolicyDecision = {
      action: 'show-fallback',
      reason: `Cache miss, budget exhausted — ${input.budgetCheck.exhaustedReason ?? 'no budget remaining'}`,
      inputs: input,
    };
    traceDecision(decision);
    return decision;
  }

  function traceDecision(decision: PolicyDecision): void {
    trace?.addStep({
      module: 'generation-policy',
      operation: 'evaluate',
      durationMs: 0,
      metadata: {
        action: decision.action,
        reason: decision.reason,
        cacheHit: decision.inputs.cacheResult.hit,
        budgetAllowed: decision.inputs.budgetCheck.allowed,
        circuitBreakerState: decision.inputs.circuitBreakerState,
      },
    });
  }

  return { evaluate };
}
```

**PolicyInput composition pattern — the engine consumes outputs from other modules:**
```typescript
// The policy engine does NOT call CacheManager, CostManager, or ConcurrencyController.
// Instead, the orchestration layer (Story 8.5 flui.ts) calls them and passes results:
const cacheResult = await cacheManager.get(cacheKey);
const budgetCheck = costManager.checkBudget(estimatedCost);
const cbState = concurrencyController.getCircuitBreakerStatus().state;

const decision = policyEngine.evaluate({
  cacheResult,
  budgetCheck,
  circuitBreakerState: cbState,
});

switch (decision.action) {
  case 'serve-from-cache':
    return cacheResult.value!;
  case 'generate':
    return await concurrencyController.execute(viewId, (signal) =>
      orchestrator.generate(request, { signal })
    );
  case 'show-fallback':
    return null; // LiquidView renders fallback
}
```

### Error Handling

**No new error codes needed for this story.** The generation policy engine is a pure decision function:
- It does NOT throw on any input combination — all inputs are valid (it always produces a decision)
- It does NOT use Result<T> because every call produces a PolicyDecision — there's no failure case
- Configuration validation is not needed for Story 7.4 (`GenerationPolicyConfig` is an empty placeholder)
- If config validation is needed in the future (Phase 2 triggers/debounce), error codes can be added then

**Existing error codes used:**
- None consumed directly — the policy engine doesn't throw or return errors
- The `BudgetCheckResult.exhaustedReason` from the cost manager is included in the PolicyDecision reason string for traceability

### Existing Code to Reuse (DO NOT reinvent)

| What | Where | How to use |
|------|-------|------------|
| `CacheResult` type | `@flui/core` cache barrel | Type-only import for PolicyInput |
| `BudgetCheckResult` type | `@flui/core` policy types | Type-only import for PolicyInput (same module) |
| `CircuitBreakerState` type | `@flui/core` concurrency barrel | Type-only import for PolicyInput |
| `GenerationTrace` | `@flui/core` types barrel | Pass to factory, call `addStep()` for trace enrichment |
| `createTrace()` | `@flui/core` types barrel | For testing trace enrichment |
| `CostManager` | `@flui/core` policy barrel | NOT called — policy receives `BudgetCheckResult` as input |
| `CacheManager` | `@flui/core` cache barrel | NOT called — policy receives `CacheResult` as input |
| `ConcurrencyController` | `@flui/core` concurrency barrel | NOT called — policy receives `CircuitBreakerState` as input |

### Design Decisions

**Pure decision function, not an orchestrator:**
The policy engine is a pure function that maps `PolicyInput → PolicyDecision`. It does NOT call other modules. This follows the single-responsibility principle — the policy decides, the orchestration layer (flui.ts, Story 8.5) acts on the decision. This makes the policy engine trivially testable (no mocks needed for dependencies).

**Deterministic decision matrix:**
For the same `PolicyInput`, the engine ALWAYS returns the same `PolicyDecision`. No randomness, no timestamps, no internal state. This makes the engine predictable and easy to reason about. The decision priority is:
1. Circuit breaker OPEN → `show-fallback` (safety override)
2. Cache hit → `serve-from-cache` (performance optimization)
3. Budget available → `generate` (normal path)
4. Budget exhausted → `show-fallback` (cost protection)

**Circuit breaker in HALF-OPEN state:**
When the circuit breaker is `half-open`, the policy allows generation (if budget permits) because the circuit breaker's `shouldAllow()` has already gated the probe. The policy engine trusts that the concurrency controller only allows one probe — the policy doesn't need to duplicate that logic.

**No separate constants file:**
Unlike the cost manager and circuit breaker, the generation policy engine has no configurable thresholds or defaults. The decision matrix is fixed logic, not parameterized. A constants file would be empty. If Phase 2 introduces configurable policies, constants can be added then.

**`GenerationPolicyConfig` is intentionally empty:**
Story 7.4 implements the core decision engine. The config placeholder exists for forward compatibility with Phase 2's trigger, debounce, and rate-limiting configurations (ADR-004). Creating the config parameter now prevents a breaking API change later.

### Previous Story Intelligence

**From Story 7-3 (Concurrency Controller & Circuit Breaker — DONE, previous story in this epic):**
- `CircuitBreakerState` is `'closed' | 'open' | 'half-open'` — use type-only import from `../concurrency`
- `CircuitBreakerStatus` has `.state` property of type `CircuitBreakerState`
- `ConcurrencyController.getCircuitBreakerStatus()` returns `CircuitBreakerStatus`
- `exactOptionalPropertyTypes` strictness is enabled — all optional properties need explicit `| undefined`
- Trace enrichment pattern: `trace?.addStep({ module: '...', operation: '...', durationMs: ..., metadata: {...} })` — follow identically with module `'generation-policy'`
- 550 tests in @flui/core, 129 in @flui/react — maintain zero regressions
- Sprint status file must be updated after story creation
- `sanitizeTraceMetadata()` strips keys matching `/token/i` — avoid using "token" in metadata keys
- Story 7-3 had a senior code review that caught scope configuration issues — ensure the policy engine's API surface is complete from the start

**From Story 7-2 (Cost Manager & Budget Enforcement — DONE):**
- `BudgetCheckResult` interface: `{ allowed: boolean; budgetType?: ...; remainingBudget?: ...; estimatedCost?: ...; exhaustedReason?: ... }`
- The cost manager `checkBudget()` returns `BudgetCheckResult` — this is the exact input the policy engine needs
- Factory pattern: `createCostManager(config, trace?)` — follow same pattern
- The `'policy'` ErrorCategory already exists — the generation policy engine lives in the same module

**From Story 7-1 (Three-Level Cache System — DONE):**
- `CacheResult` interface: `{ hit: boolean; level?: ...; value?: UISpecification; stale?: boolean }`
- `CacheManager.get()` returns `Promise<CacheResult>` — the resolved result is the exact input the policy engine needs
- The `stale` flag exists on `CacheResult` for future stale-while-revalidate support (reserved in CacheConfig)

### Git Intelligence

**Recent commit patterns:**
- `cdedb77` — `feat: implement cost manager and budget enforcement (story 7-2)` (latest)
- `e9b389b` — `feat: implement three-level cache system with memory, session, and IndexedDB storage (story 7-1)`
- All commits follow: `feat: implement <description> (story X-Y)`
- Implementation order: types → implementation → tests → barrel exports

**Files most recently modified in `@flui/core` (Story 7-3):**
- `packages/core/src/concurrency/` — complete module (latest-wins + circuit breaker)
- `packages/core/src/errors/error-codes.ts` — added FLUI_E028-E030, added 'concurrency' ErrorCategory
- `packages/core/src/errors/errors.test.ts` — updated count to 30
- `packages/core/src/errors/index.ts` — exported new codes
- `packages/core/src/index.ts` — added concurrency exports

### Testing Standards

- **Framework:** Vitest 4.0.18 with `node` environment (core package, NOT jsdom)
- **Test structure:** `describe('GenerationPolicyEngine') > describe('evaluate') > it('specific behavior')`
- **Coverage:** >90% statement coverage required
- **No mocks needed:** The policy engine is a pure function — create `PolicyInput` objects directly in tests
- **Import pattern:** Import from relative paths within same package, never from barrel in tests
- **Test data construction pattern:**
```typescript
// Helper to create PolicyInput for tests
function makeInput(overrides: {
  cacheHit?: boolean;
  budgetAllowed?: boolean;
  circuitState?: CircuitBreakerState;
} = {}): PolicyInput {
  return {
    cacheResult: {
      hit: overrides.cacheHit ?? false,
      level: overrides.cacheHit ? 'L1' : undefined,
      value: overrides.cacheHit ? mockSpec : undefined,
    },
    budgetCheck: {
      allowed: overrides.budgetAllowed ?? true,
      exhaustedReason: overrides.budgetAllowed === false ? 'Session budget exhausted' : undefined,
    },
    circuitBreakerState: overrides.circuitState ?? 'closed',
  };
}

// Use in tests:
it('returns serve-from-cache when cache hits', () => {
  const engine = createGenerationPolicyEngine();
  const decision = engine.evaluate(makeInput({ cacheHit: true }));
  expect(decision.action).toBe('serve-from-cache');
});
```

### Performance Considerations

- `evaluate()` is a synchronous pure function — O(1), no I/O, no state
- No Map lookups, no timers, no async operations
- Expected execution time: < 0.01ms per call
- No internal state — no memory growth over time
- Bundle impact: ~0.5KB for the generation policy module (minimal code, pure logic)
- No runtime dependencies added

### Library/Framework Requirements

| Library | Version | Purpose | Already in package.json? |
|---------|---------|---------|-------------------------|
| None | — | No new dependencies needed | N/A |

The generation policy engine is pure TypeScript with zero dependencies. It only imports types from other @flui/core modules.

### Project Structure Notes

- This story adds files to the existing `policy/` module directory (alongside `cost-manager.ts`)
- Architecture specifies: `policy/ → imports generation/, cache/, errors/` — for this story, we type-import from `cache/` and `concurrency/` only
- The `generation-policy.types.ts` file is separate from `policy.types.ts` (which has cost manager types) to maintain single-responsibility per file
- All files follow existing naming: kebab-case with co-located tests
- No changes to `@flui/react` package in this story
- No changes to build configuration (tsup/vitest) needed — existing config covers the policy directory
- `sideEffects: false` must remain in `package.json` for tree-shaking
- No new error codes needed — the policy engine never throws or returns errors

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.4] - User story, acceptance criteria, BDD scenarios
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7] - Epic objectives: caching, cost control, concurrency, generation policy
- [Source: docs/flui-architecture-decisions.md#ADR-004] - Re-generation Strategy and Triggers: GenerationPolicy interface, triggers, debounce, stability check (Phase 2 scope — Story 7.4 only implements the decision part)
- [Source: docs/flui-architecture-decisions.md#ADR-006] - Cost Control and Budgeting: budget enforcement before LLM call
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Directory Structure] - `packages/core/src/policy/` layout with generation-policy.ts, cost-manager.ts, policy.types.ts
- [Source: _bmad-output/planning-artifacts/architecture.md#Module Dependencies] - `policy/ → imports generation/, cache/, errors/`
- [Source: _bmad-output/planning-artifacts/architecture.md#Requirements to Structure Mapping] - Cost & Performance Control (FR35-43) maps to `policy/`, `cache/`, `concurrency/`
- [Source: _bmad-output/planning-artifacts/prd.md#FR43] - Control generation policy (when to generate vs. serve from cache vs. show fallback)
- [Source: packages/core/src/cache/cache.types.ts] - CacheResult interface (hit, level, value, stale)
- [Source: packages/core/src/policy/policy.types.ts] - BudgetCheckResult interface (allowed, budgetType, remainingBudget, exhaustedReason)
- [Source: packages/core/src/concurrency/concurrency.types.ts] - CircuitBreakerState type ('closed' | 'open' | 'half-open')
- [Source: packages/core/src/types.ts] - GenerationTrace, TraceStep, createTrace
- [Source: packages/core/src/policy/cost-manager.ts] - Factory pattern reference, trace enrichment pattern
- [Source: _bmad-output/implementation-artifacts/7-3-concurrency-controller-and-circuit-breaker.md] - Previous story intelligence: circuit breaker state machine, AbortSignal patterns, trace enrichment
- [Source: _bmad-output/implementation-artifacts/7-2-cost-manager-and-budget-enforcement.md] - Previous story intelligence: factory pattern, BudgetCheckResult, exactOptionalPropertyTypes

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

No debug issues encountered. Pure implementation — all tests passed on first run.

### Completion Notes List

- Implemented `GenerationPolicyEngine` as a pure deterministic decision function following the established `create*` factory pattern
- Decision priority: circuit breaker OPEN → cache hit → budget available → budget exhausted (fallback)
- Zero new runtime dependencies — type-only imports from `../cache`, `../concurrency`, and `./policy.types`
- Trace enrichment follows the same pattern as Story 7-3 (concurrency controller) with module `'generation-policy'`
- 22 tests covering full 11-combination decision matrix + determinism + trace integration + factory + exhaustedReason propagation
- 100% code coverage on `generation-policy.ts` (statements, branches, functions, lines)
- 576 total tests pass in @flui/core (22 new + 554 existing) — zero regressions
- `sideEffects: false` preserved in package.json
- `GenerationPolicyConfig` left intentionally empty as placeholder for Phase 2 (triggers, debounce, rate limiting)
- Code review follow-up: trace metadata now includes `budgetRemaining` to fully capture evaluated policy inputs required by AC #6
- Git transparency note: current worktree contains additional in-progress files from Story 7.3 and foundational error code updates outside Story 7.4 scope

### File List

New files:

- `packages/core/src/policy/generation-policy.types.ts` — PolicyAction, PolicyInput, PolicyDecision, GenerationPolicyEngine, GenerationPolicyConfig type definitions
- `packages/core/src/policy/generation-policy.ts` — createGenerationPolicyEngine factory with deterministic evaluate() decision matrix
- `packages/core/src/policy/generation-policy.test.ts` — 22 co-located tests covering decision matrix, determinism, trace integration, and factory

Modified files:

- `packages/core/src/policy/index.ts` — Added exports for new types and createGenerationPolicyEngine factory
- `packages/core/src/index.ts` — Added policy types and factory to core barrel exports

Additional worktree changes observed during review (outside Story 7.4 scope, documented for transparency):

- `packages/core/src/concurrency/` — Story 7.3 concurrency controller and circuit breaker module files
- `packages/core/src/errors/error-codes.ts` — Added FLUI_E028-FLUI_E030 and `concurrency` error category
- `packages/core/src/errors/errors.test.ts` — Updated error code/category coverage assertions for 30 codes
- `packages/core/src/errors/index.ts` — Exported FLUI_E028-FLUI_E030 constants

## Change Log

- 2026-02-27: Implemented generation policy engine (Story 7.4) — pure decision function evaluating cache, budget, and circuit breaker state to decide generate/serve-from-cache/show-fallback action
- 2026-02-27: Code review fixes — added `budgetRemaining` to policy trace metadata and expanded implementation transparency for worktree-level file changes

## Senior Developer Review (AI)

### Reviewer

Fabrice (AI review workflow)

### Date

2026-02-27

### Outcome

Approved

### Findings Summary

- High issue fixed: AC #6 trace enrichment was missing `budgetRemaining` metadata
- Medium issues fixed: story documentation now reflects worktree-level file discrepancies and uncommitted change transparency
- Low issues noted: non-blocking style/maintainability observations retained for future cleanup

### Verified Fixes Applied

- Updated `packages/core/src/policy/generation-policy.ts` trace metadata with `budgetRemaining`
- Updated `packages/core/src/policy/generation-policy.test.ts` to assert `budgetRemaining` is recorded in trace metadata
- Updated this story file's Dev Agent Record and Change Log for git/story transparency and review closure
