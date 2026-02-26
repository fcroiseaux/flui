# Story 7.2: Cost Manager & Budget Enforcement

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to configure cost budgets and have the system enforce them before making LLM calls,
so that I can control spending and prevent unexpected costs in production.

## Acceptance Criteria

1. **Budget Configuration** (FR35): Given the policy/ module in @flui/core, when a developer configures a cost budget per session and per time period (e.g., daily), then the budget is stored and enforced for all subsequent generation requests.

2. **Cost Estimation Before LLM Call** (FR36): Given a generation request, when the cost manager estimates the cost based on prompt size and model pricing, then the estimate is available before the LLM call is made, and the estimate is recorded in the GenerationTrace.

3. **Budget Enforcement — Blocked Call** (FR37): Given a generation request that would exceed the configured budget, when the budget check runs synchronously before the LLM call, then the LLM call is prevented, and the system returns a `BudgetCheckResult` indicating budget exhaustion with details (remaining budget, estimated cost, budget type).

4. **Graceful Degradation Signal** (FR38): Given a budget-exhausted check result, then the result includes enough context for the caller (Story 7.4 policy engine) to degrade gracefully to a cached specification if one is available, or return `Result.error` with a FluiError (`FLUI_E026`) indicating budget exhaustion if no cached spec exists.

5. **Cost Recording After LLM Call** (FR35, FR36): Given a generation request within budget, when the LLM call completes, then the actual cost is recorded and deducted from the remaining budget, and the cost is added to the GenerationTrace.

6. **Session Budget Tracking**: Given a session budget is configured, when multiple generation requests are made within the same session, then each request's cost (estimated before, actual after) is tracked cumulatively, and the remaining session budget is accurately maintained.

7. **Time-Period Budget Tracking**: Given a time-period budget (e.g., daily) is configured, when generation requests span the time period boundary, then the budget resets automatically at the period boundary, and historical cost records are maintained.

8. **Budget Stats & Introspection**: Given a configured cost manager, when `stats()` is called, then it returns current budget utilization including remaining budget per type, total spent, number of generations, and average cost per generation.

9. **Testing Requirements**: Co-located tests cover budget configuration, cost estimation (with known model pricing), budget enforcement (blocked call), graceful degradation signal, budget exhaustion with no fallback, cost recording after LLM call, session budget cumulative tracking, time-period budget reset, stats reporting, and GenerationTrace enrichment. All tests pass with >90% coverage.

## Tasks / Subtasks

- [x] Task 1: Create policy module directory and type definitions (AC: #1, #2, #3, #6, #7, #8)
  - [x] 1.1 Create `packages/core/src/policy/` directory
  - [x] 1.2 Create `packages/core/src/policy/policy.types.ts` with all type definitions:
    - `ModelPricing` interface: `{ promptCostPer1kTokens: number; completionCostPer1kTokens: number }`
    - `BudgetConfig` interface: `{ sessionBudget?: number | undefined; dailyBudget?: number | undefined; modelPricing: Record<string, ModelPricing>; defaultModelPricing?: ModelPricing | undefined; onBudgetExhausted?: 'error' | 'warn' | undefined }`
    - `CostEstimate` interface: `{ estimatedPromptTokens: number; estimatedCost: number; model: string; budgetType: 'session' | 'daily'; remainingBudget: number }`
    - `CostRecord` interface: `{ timestamp: number; model: string; promptTokens: number; completionTokens: number; totalTokens: number; estimatedCost: number; actualCost: number; budgetType: 'session' | 'daily' }`
    - `BudgetCheckResult` interface: `{ allowed: boolean; budgetType?: 'session' | 'daily' | undefined; remainingBudget?: number | undefined; estimatedCost?: number | undefined; exhaustedReason?: string | undefined }`
    - `BudgetStats` interface: `{ sessionBudget: number | null; dailyBudget: number | null; sessionSpent: number; dailySpent: number; sessionRemaining: number | null; dailyRemaining: number | null; totalGenerations: number; averageCostPerGeneration: number; records: readonly CostRecord[] }`
    - `CostManager` interface: `{ estimateCost(promptTokens: number, model: string): CostEstimate; checkBudget(estimatedCost: number): BudgetCheckResult; recordCost(usage: LLMUsage, model: string, estimatedCost: number): CostRecord; stats(): BudgetStats; resetSession(): void; resetDaily(): void }`
  - [x] 1.3 Export all types from `policy.types.ts`

- [x] Task 2: Create cost manager constants (AC: #1, #2)
  - [x] 2.1 Create `packages/core/src/policy/cost-manager.constants.ts`
  - [x] 2.2 Define `DEFAULT_SESSION_BUDGET` = undefined (no limit by default)
  - [x] 2.3 Define `DEFAULT_DAILY_BUDGET` = undefined (no limit by default)
  - [x] 2.4 Define `TOKENS_PER_1K` = 1000 (for cost calculation clarity)
  - [x] 2.5 Define `DAILY_RESET_INTERVAL_MS` = 86_400_000 (24 hours in ms)

- [x] Task 3: Implement cost estimation logic (AC: #2, #6)
  - [x] 3.1 Create `packages/core/src/policy/cost-manager.ts`
  - [x] 3.2 Implement `estimateCost(promptTokens, model)`:
    - Look up model pricing from `BudgetConfig.modelPricing[model]` or fall back to `defaultModelPricing`
    - If no pricing found, use zero cost (allow the call — fail open)
    - Calculate: `estimatedCost = (promptTokens / 1000) * promptCostPer1kTokens`
    - Note: completion cost is excluded from estimate since it's unknown pre-call; only prompt tokens are estimable
    - Return `CostEstimate` with remaining budget from the most constrained budget type
  - [x] 3.3 Record estimation in GenerationTrace via `addStep()` with module `'cost-manager'`, operation `'estimateCost'`

- [x] Task 4: Implement budget check logic (AC: #3, #4, #6, #7)
  - [x] 4.1 Implement `checkBudget(estimatedCost)`:
    - Check session budget: if `sessionBudget` configured and `sessionSpent + estimatedCost > sessionBudget` → blocked
    - Check daily budget: if `dailyBudget` configured and `dailySpent + estimatedCost > dailyBudget` → blocked
    - If both configured, the MORE restrictive budget wins (check both, report the exhausted one)
    - Return `BudgetCheckResult` with `allowed: true/false` and details
  - [x] 4.2 Budget check is synchronous — no async operations
  - [x] 4.3 Record budget check in GenerationTrace via `addStep()` with module `'cost-manager'`, operation `'checkBudget'`

- [x] Task 5: Implement cost recording after LLM call (AC: #5, #6, #7)
  - [x] 5.1 Implement `recordCost(usage, model, estimatedCost)`:
    - Look up model pricing (same as estimation)
    - Calculate actual cost: `(usage.promptTokens / 1000) * promptCostPer1kTokens + (usage.completionTokens / 1000) * completionCostPer1kTokens`
    - Create `CostRecord` with timestamp, model, tokens, estimated vs actual cost
    - Add actual cost to `sessionSpent` and `dailySpent` counters
    - Store record in internal records array
    - Return the `CostRecord`
  - [x] 5.2 Record cost in GenerationTrace via `addStep()` with module `'cost-manager'`, operation `'recordCost'`

- [x] Task 6: Implement time-period budget management (AC: #7)
  - [x] 6.1 Track daily budget period start time (`dailyPeriodStart`)
  - [x] 6.2 On every `checkBudget()` and `recordCost()` call, check if current time exceeds `dailyPeriodStart + DAILY_RESET_INTERVAL_MS`
  - [x] 6.3 If period expired: auto-reset `dailySpent` to 0, update `dailyPeriodStart` to current time
  - [x] 6.4 Historical cost records are NOT cleared on daily reset (they accumulate for stats)
  - [x] 6.5 Implement `resetSession()` to manually reset session budget counters
  - [x] 6.6 Implement `resetDaily()` to manually reset daily budget counters

- [x] Task 7: Implement budget stats and introspection (AC: #8)
  - [x] 7.1 Implement `stats()` returning `BudgetStats`:
    - Session budget: configured amount, spent, remaining (null if not configured)
    - Daily budget: configured amount, spent, remaining (null if not configured)
    - Total generations count
    - Average cost per generation
    - Read-only copy of all cost records

- [x] Task 8: Implement `createCostManager` factory function (AC: #1, #2, #3, #4, #5)
  - [x] 8.1 `createCostManager(config: BudgetConfig, trace?: GenerationTrace): CostManager`
  - [x] 8.2 Validate config at creation time:
    - If `sessionBudget` is negative → throw FluiError with `FLUI_E027`
    - If `dailyBudget` is negative → throw FluiError with `FLUI_E027`
    - If `modelPricing` is empty AND `defaultModelPricing` is undefined → log warning (pricing will be zero, all calls allowed)
  - [x] 8.3 Initialize internal state: `sessionSpent = 0`, `dailySpent = 0`, `dailyPeriodStart = Date.now()`, `records = []`

- [x] Task 9: Add new error codes for policy module (AC: #4)
  - [x] 9.1 Add `FLUI_E026` — Budget exhausted: generation would exceed configured cost budget
  - [x] 9.2 Add `FLUI_E027` — Invalid budget configuration: negative budget or conflicting constraints
  - [x] 9.3 Add `'policy'` to `ErrorCategory` union type
  - [x] 9.4 Update `DefinedFluiErrorCode` union type and `ERROR_CODE_DESCRIPTIONS` map
  - [x] 9.5 Export new error codes from `errors/index.ts` and core barrel

- [x] Task 10: Create barrel exports (AC: all)
  - [x] 10.1 Create `packages/core/src/policy/index.ts` exporting all public types and `createCostManager`
  - [x] 10.2 Update `packages/core/src/index.ts` to export policy module types and factory
  - [x] 10.3 Export new error codes `FLUI_E026`, `FLUI_E027` from core barrel
  - [x] 10.4 Verify TypeScript compilation succeeds with all exports

- [x] Task 11: Write comprehensive tests (AC: #1, #2, #3, #4, #5, #6, #7, #8, #9)
  - [x] 11.1 Create `packages/core/src/policy/cost-manager.test.ts`:
    - **Budget Configuration Tests:**
      - Test creating cost manager with session budget only
      - Test creating cost manager with daily budget only
      - Test creating cost manager with both budgets
      - Test creating cost manager with no budgets (all calls allowed)
      - Test invalid config: negative session budget throws FLUI_E027
      - Test invalid config: negative daily budget throws FLUI_E027
    - **Cost Estimation Tests:**
      - Test cost estimate with known model pricing
      - Test cost estimate with default model pricing fallback
      - Test cost estimate with unknown model (no pricing) returns zero cost
      - Test cost estimate records TraceStep with module 'cost-manager'
      - Test estimate reflects remaining budget from most constrained type
    - **Budget Check Tests:**
      - Test budget check allows call within session budget
      - Test budget check allows call within daily budget
      - Test budget check blocks call exceeding session budget
      - Test budget check blocks call exceeding daily budget
      - Test budget check with both budgets: more restrictive wins
      - Test budget check returns correct `BudgetCheckResult` fields
      - Test budget check records TraceStep
    - **Cost Recording Tests:**
      - Test record cost deducts from session budget
      - Test record cost deducts from daily budget
      - Test record cost creates accurate CostRecord (estimated vs actual)
      - Test record cost with actual cost different from estimate
      - Test record cost records TraceStep
      - Test cumulative cost tracking across multiple generations
    - **Time-Period Budget Tests:**
      - Test daily budget resets after 24 hours (use `vi.useFakeTimers()`)
      - Test daily budget does NOT reset before period expires
      - Test historical records persist after daily reset
      - Test manual `resetSession()` clears session counters
      - Test manual `resetDaily()` clears daily counters
    - **Stats Tests:**
      - Test stats with no generations returns zeros
      - Test stats reflects correct budget utilization after multiple generations
      - Test stats returns read-only copy of records
      - Test average cost per generation calculation
    - **GenerationTrace Enrichment Tests:**
      - Test all three operations (estimate, check, record) add trace steps
      - Test trace metadata includes relevant cost information
      - Test trace step module is 'cost-manager'
  - [x] 11.2 All tests pass with >90% statement coverage

## Dev Notes

### Architecture Compliance

**Package:** `@flui/core` — new `policy/` module (ADR-004, ADR-006)

**New files (architecture-specified):**
```
packages/core/src/policy/
  ├── index.ts                    # Public API barrel
  ├── cost-manager.ts             # CostManager factory and budget logic
  ├── cost-manager.constants.ts   # Budget constants (DAILY_RESET_INTERVAL_MS, etc.)
  ├── cost-manager.test.ts        # Co-located tests
  └── policy.types.ts             # All policy type definitions (shared with Story 7.4)
```

**Modified files:**
```
packages/core/src/
  ├── errors/error-codes.ts       # Add FLUI_E026, FLUI_E027, add 'policy' to ErrorCategory
  ├── errors/index.ts             # Export new error codes
  ├── index.ts                    # Export policy module types and factory
```

**Do NOT create these files** (they belong to future stories in this epic):
- `policy/generation-policy.ts` — Generation policy engine (Story 7.4)
- `concurrency/` directory — Concurrency controller and circuit breaker (Story 7.3)
- Any integration with `GenerationOrchestrator` — that belongs to Story 7.4 (policy engine wires cost manager, cache, and circuit breaker into the generation pipeline)
- Any direct import of `CacheManager` — cache-based degradation is orchestrated by Story 7.4's policy engine, not by the cost manager itself

**Package dependency rules:**
- `@flui/core` → `zod@4.x` (only runtime dependency — NOT needed by cost manager itself)
- Import `FluiError`, error codes from `../errors`
- Import `GenerationTrace`, `TraceStep`, `LLMUsage` from `../types`
- Zero new runtime dependencies
- Zero new peer dependencies
- `sideEffects: false` must be maintained in package.json

### Implementation Patterns (MUST follow)

**Factory pattern (established codebase convention):**
```typescript
// Follow the create* factory pattern used throughout @flui/core
export function createCostManager(config: BudgetConfig, trace?: GenerationTrace): CostManager {
  // Validate config at creation time
  if (config.sessionBudget !== undefined && config.sessionBudget < 0) {
    throw new FluiError(FLUI_E027, 'Session budget cannot be negative', { category: 'policy' });
  }
  if (config.dailyBudget !== undefined && config.dailyBudget < 0) {
    throw new FluiError(FLUI_E027, 'Daily budget cannot be negative', { category: 'policy' });
  }

  let sessionSpent = 0;
  let dailySpent = 0;
  let dailyPeriodStart = Date.now();
  const records: CostRecord[] = [];

  // ... return CostManager implementation
}
```

**Cost estimation (prompt-only, fail-open):**
```typescript
function estimateCost(promptTokens: number, model: string): CostEstimate {
  const pricing = config.modelPricing[model] ?? config.defaultModelPricing;
  const estimatedCost = pricing
    ? (promptTokens / TOKENS_PER_1K) * pricing.promptCostPer1kTokens
    : 0; // No pricing = zero cost estimate = allow the call

  // Determine most constrained budget
  const sessionRemaining = config.sessionBudget !== undefined
    ? config.sessionBudget - sessionSpent
    : Infinity;
  const dailyRemaining = config.dailyBudget !== undefined
    ? config.dailyBudget - dailySpent
    : Infinity;

  const budgetType = sessionRemaining <= dailyRemaining ? 'session' : 'daily';
  const remainingBudget = Math.min(sessionRemaining, dailyRemaining);

  return { estimatedPromptTokens: promptTokens, estimatedCost, model, budgetType, remainingBudget };
}
```

**Budget check (synchronous, deterministic):**
```typescript
function checkBudget(estimatedCost: number): BudgetCheckResult {
  // Auto-reset daily budget if period expired
  maybeResetDailyPeriod();

  // Check session budget
  if (config.sessionBudget !== undefined) {
    if (sessionSpent + estimatedCost > config.sessionBudget) {
      return {
        allowed: false,
        budgetType: 'session',
        remainingBudget: config.sessionBudget - sessionSpent,
        estimatedCost,
        exhaustedReason: `Session budget exhausted: $${sessionSpent.toFixed(4)} spent of $${config.sessionBudget.toFixed(4)} budget`,
      };
    }
  }

  // Check daily budget
  if (config.dailyBudget !== undefined) {
    if (dailySpent + estimatedCost > config.dailyBudget) {
      return {
        allowed: false,
        budgetType: 'daily',
        remainingBudget: config.dailyBudget - dailySpent,
        estimatedCost,
        exhaustedReason: `Daily budget exhausted: $${dailySpent.toFixed(4)} spent of $${config.dailyBudget.toFixed(4)} budget`,
      };
    }
  }

  return { allowed: true };
}
```

**Actual cost recording:**
```typescript
function recordCost(usage: LLMUsage, model: string, estimatedCost: number): CostRecord {
  const pricing = config.modelPricing[model] ?? config.defaultModelPricing;
  const actualCost = pricing
    ? (usage.promptTokens / TOKENS_PER_1K) * pricing.promptCostPer1kTokens
      + (usage.completionTokens / TOKENS_PER_1K) * pricing.completionCostPer1kTokens
    : 0;

  sessionSpent += actualCost;
  dailySpent += actualCost;

  const record: CostRecord = {
    timestamp: Date.now(),
    model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    estimatedCost,
    actualCost,
    budgetType: /* most constrained */ 'session',
  };

  records.push(record);
  return record;
}
```

**Daily period auto-reset:**
```typescript
function maybeResetDailyPeriod(): void {
  if (config.dailyBudget === undefined) return;
  const now = Date.now();
  if (now - dailyPeriodStart >= DAILY_RESET_INTERVAL_MS) {
    dailySpent = 0;
    dailyPeriodStart = now;
  }
}
```

**GenerationTrace enrichment:**
```typescript
// When reporting cost operations to trace
trace?.addStep({
  module: 'cost-manager',
  operation: 'estimateCost',
  durationMs: 0, // Synchronous, negligible
  metadata: {
    model,
    estimatedPromptTokens: promptTokens,
    estimatedCost,
    remainingBudget,
    budgetType,
  },
});

trace?.addStep({
  module: 'cost-manager',
  operation: 'checkBudget',
  durationMs: 0,
  metadata: {
    allowed: result.allowed,
    estimatedCost,
    budgetType: result.budgetType,
    remainingBudget: result.remainingBudget,
  },
});

trace?.addStep({
  module: 'cost-manager',
  operation: 'recordCost',
  durationMs: 0,
  metadata: {
    model,
    actualCost: record.actualCost,
    estimatedCost: record.estimatedCost,
    totalTokens: usage.totalTokens,
    sessionSpent,
    dailySpent,
  },
});
```

### Error Handling

**New error codes:**
- `FLUI_E026` — Budget exhausted: generation would exceed configured cost budget (category: `'policy'`)
- `FLUI_E027` — Invalid budget configuration: negative budget or conflicting constraints (category: `'policy'`)

**New ErrorCategory:**
- Add `'policy'` to the `ErrorCategory` union in `error-codes.ts`

**Error scenarios:**
- Negative session budget in config → throw `FluiError(FLUI_E027)` at creation time (programmer error, not async)
- Negative daily budget in config → throw `FluiError(FLUI_E027)` at creation time
- Budget exhausted on check → return `BudgetCheckResult { allowed: false }` (NOT a thrown error — this is expected control flow)
- Unknown model pricing → fail open (zero cost, allow the call). Log info once.
- The caller (Story 7.4 policy engine) converts budget exhaustion into either a cached spec lookup or `Result.error(new FluiError(FLUI_E026, ...))` — the cost manager itself does NOT create this error directly

**Critical: budget checks NEVER throw.** The `checkBudget()` method returns a typed result. Only `createCostManager()` throws on invalid configuration (fail-fast on programmer errors).

### Existing Code to Reuse (DO NOT reinvent)

| What | Where | How to use |
|------|-------|------------|
| `LLMUsage` type | `@flui/core` types barrel | Input to `recordCost()` for actual token counts |
| `LLMResponse` type | `@flui/core` types barrel | Contains `usage: LLMUsage` and `model: string` |
| `GenerationTrace` | `@flui/core` types barrel | Pass to factory, call `addStep()` for trace enrichment |
| `TraceStep` | `@flui/core` types barrel | Structure for trace step metadata |
| `createTrace()` | `@flui/core` types barrel | For testing trace enrichment |
| `FluiError` class | `@flui/core` errors barrel | Thrown on invalid config (`FLUI_E027`) |
| `Result<T>` type | `@flui/core` errors barrel | NOT directly used by CostManager — BudgetCheckResult is used instead |
| `CacheManager` | `@flui/core` cache barrel | NOT imported — cache degradation is Story 7.4's responsibility |

### Design Decisions

**BudgetCheckResult instead of Result<T>:**
Budget checks return a typed `BudgetCheckResult` with `allowed: boolean`, not `Result<T>`. Budget exhaustion is expected control flow, not an error. This mirrors the `CacheResult` pattern established in Story 7-1 where cache misses are not errors. The caller (policy engine in Story 7.4) decides what to do with a "not allowed" result.

**Prompt-only cost estimation:**
Pre-call cost estimation uses only prompt tokens because completion token count is unknown before the LLM responds. This is a conservative underestimate — the actual cost (recorded post-call) includes both prompt and completion costs. This means a budget can be slightly overrun by the completion cost of the last allowed call, which is acceptable and expected behavior.

**Fail-open on unknown model pricing:**
If no pricing is configured for a model and no default pricing exists, the cost manager estimates zero cost and allows the call. This prevents the cost manager from blocking ALL calls when a developer forgets to configure pricing for a new model. A warning is logged.

**Synchronous budget checks:**
`checkBudget()` and `estimateCost()` are synchronous. They involve only in-memory arithmetic (no I/O, no async). This satisfies FR37's requirement that budget enforcement is synchronous.

**Daily budget auto-reset:**
The daily budget period is tracked by `dailyPeriodStart` timestamp. On every budget check, if `Date.now() - dailyPeriodStart >= 24h`, the daily spent counter resets. This is a simple sliding window approach. Historical cost records are preserved for stats.

**CostManager is standalone:**
Story 7-2 creates the `CostManager` as a standalone module. It does NOT wire into `GenerationOrchestrator` or coordinate with `CacheManager`. That integration is Story 7.4's responsibility (policy engine). The cost manager is a pure budget-tracking primitive.

**Token pricing as configuration, not hardcoded:**
Model pricing is provided via `BudgetConfig.modelPricing` (a `Record<string, ModelPricing>`), not hardcoded. This allows developers to set accurate pricing for their specific models and keeps the library agnostic of specific LLM provider pricing. A `defaultModelPricing` fallback is available for convenience.

### Project Structure Notes

- This story creates the `policy/` module directory in `@flui/core`
- Story 7.4 will add `generation-policy.ts` to the same directory — the `policy.types.ts` file should be designed to accommodate future types (but only define what Story 7-2 needs now)
- All existing modules in core follow the pattern: `module/index.ts` (barrel) + `module/{impl}.ts` + `module/{module}.types.ts` + `module/{impl}.test.ts`
- Constants file follows the naming pattern: `cost-manager.constants.ts` (per architecture naming conventions)
- Test files are co-located: `cost-manager.test.ts` in the same directory
- No changes to `@flui/react` package in this story — cost management is a core concern
- No changes to build configuration (tsup/vitest) needed — existing config covers new directory
- `sideEffects: false` must remain in `package.json` for tree-shaking

### Previous Story Intelligence

**From Story 7-1 (Three-Level Cache System — DONE, previous story in this epic):**
- `exactOptionalPropertyTypes` strictness is enabled — all optional properties need explicit `| undefined`
- Factory pattern: `createCacheManager(config?, trace?)` — follow same pattern for `createCostManager(config, trace?)`
- Trace enrichment pattern: `trace?.addStep({ module: 'cache', operation: '...', durationMs: ..., metadata: {...} })` — follow identically with module `'cost-manager'`
- Error code pattern: added FLUI_E024, FLUI_E025 with category `'cache'` — follow same pattern for FLUI_E026, FLUI_E027 with category `'policy'`
- The `'cache'` category was already in `ErrorCategory` union before Story 7-1 — but `'policy'` is NOT yet in the union and MUST be added
- 453 tests in @flui/core, 129 in @flui/react — maintain zero regressions
- Sprint status file must be updated after story creation

**From Story 4-2 (Generation Orchestrator — DONE):**
- `GenerationOrchestrator.generate()` does NOT currently check budgets — Story 7.4 will integrate
- The orchestrator's `GenerationConfig` interface will need an optional `costManager?: CostManager` field — but that's Story 7.4's change
- `LLMResponse.usage` contains actual token counts after the call — this is the input to `recordCost()`
- The orchestrator already enriches metadata: `spec.metadata.custom = { usage: llmResult.value.usage }` — cost manager adds parallel trace data

**From Story 1-3 (FluiError & Result Pattern — DONE):**
- `FluiError` constructor: `new FluiError(code, message, options?)` where options has `{ category?, cause?, context? }`
- Error codes are string constants exported from `error-codes.ts`
- `DefinedFluiErrorCode` union must include new codes
- `ERROR_CODE_DESCRIPTIONS` record must include new descriptions

### Git Intelligence

**Recent commit patterns:**
- `e9b389b` — `feat: implement three-level cache system with memory, session, and IndexedDB storage (story 7-1)` (latest)
- `7071d52` — `feat: implement visual transitions and accessibility for LiquidView (story 6-3)`
- All commits follow: `feat: implement <description> (story X-Y)`
- Implementation order: types → constants → implementation → tests → barrel exports → error codes

**Files most recently modified in `@flui/core` (Story 7-1):**
- `packages/core/src/cache/` — entire new module
- `packages/core/src/errors/error-codes.ts` — added FLUI_E024, FLUI_E025
- `packages/core/src/errors/index.ts` — exported new codes
- `packages/core/src/index.ts` — added cache exports
- `packages/core/package.json` — added idb-keyval optional peer dep

### Testing Standards

- **Framework:** Vitest 4.0.18 with `node` environment (core package, NOT jsdom)
- **Test structure:** `describe('ModuleName') > describe('feature') > it('specific behavior')`
- **Coverage:** >90% statement coverage required
- **Mock pattern:** Use `vi.fn()` for callbacks, `vi.spyOn()` for module mocks
- **Timer mocks:** Use `vi.useFakeTimers()` for daily budget period tests (proven in Story 7-1 TTL tests)
- **Import pattern:** Import from relative paths within same package, never from barrel in tests

**Testing cost manager specifics:**
```typescript
// Setup: known model pricing for deterministic tests
const TEST_PRICING: Record<string, ModelPricing> = {
  'gpt-4o': { promptCostPer1kTokens: 0.005, completionCostPer1kTokens: 0.015 },
  'claude-sonnet': { promptCostPer1kTokens: 0.003, completionCostPer1kTokens: 0.015 },
};

// Test budget enforcement
it('blocks call when session budget would be exceeded', () => {
  const manager = createCostManager({
    sessionBudget: 0.01,
    modelPricing: TEST_PRICING,
  });

  // First call estimate: 500 prompt tokens * $0.005/1k = $0.0025
  const estimate = manager.estimateCost(500, 'gpt-4o');
  expect(estimate.estimatedCost).toBe(0.0025);

  // Record cost consuming most of budget
  manager.recordCost({ promptTokens: 500, completionTokens: 200, totalTokens: 700 }, 'gpt-4o', 0.0025);
  // Actual: (500/1000)*0.005 + (200/1000)*0.015 = 0.0025 + 0.003 = 0.0055

  // Next call estimate: 2000 tokens * $0.005/1k = $0.01
  const check = manager.checkBudget(0.01);
  expect(check.allowed).toBe(false);
  expect(check.budgetType).toBe('session');
});

// Test daily reset with fake timers
it('resets daily budget after 24 hours', () => {
  vi.useFakeTimers();
  const manager = createCostManager({
    dailyBudget: 0.10,
    modelPricing: TEST_PRICING,
  });

  // Spend $0.08 of $0.10 daily budget
  manager.recordCost({ promptTokens: 5000, completionTokens: 2000, totalTokens: 7000 }, 'gpt-4o', 0.025);
  // Actual: (5000/1000)*0.005 + (2000/1000)*0.015 = 0.025 + 0.03 = 0.055

  // Advance 24 hours
  vi.advanceTimersByTime(86_400_000);

  // Budget should be reset
  const check = manager.checkBudget(0.05);
  expect(check.allowed).toBe(true);

  vi.useRealTimers();
});

// Test trace enrichment
it('records cost estimation in GenerationTrace', () => {
  const trace = createTrace();
  const manager = createCostManager({ modelPricing: TEST_PRICING }, trace);

  manager.estimateCost(1000, 'gpt-4o');

  const steps = trace.steps.filter(s => s.module === 'cost-manager');
  expect(steps).toHaveLength(1);
  expect(steps[0].operation).toBe('estimateCost');
  expect(steps[0].metadata).toMatchObject({
    model: 'gpt-4o',
    estimatedCost: 0.005,
  });
});
```

### Performance Considerations

- All cost manager operations are synchronous in-memory arithmetic — effectively O(1)
- `estimateCost()`: single Map lookup + multiplication — < 0.01ms
- `checkBudget()`: 1-2 comparisons — < 0.01ms
- `recordCost()`: Map lookup + arithmetic + array push — < 0.01ms
- `stats()`: creates read-only copy of records array — O(n) where n is number of generations
- No runtime dependencies added
- Bundle impact: ~1-2KB for cost manager module (well within core's 25KB budget, ~16.4KB current estimated + ~3KB cache = ~19.4KB)
- Memory: cost records accumulate in-memory. For long-running sessions, records array grows. This is bounded by budget — once exhausted, no new records. A future optimization could cap records (not in scope for this story).

### Library/Framework Requirements

| Library | Version | Purpose | Already in package.json? |
|---------|---------|---------|-------------------------|
| None | — | No new dependencies needed | N/A |

The cost manager is pure TypeScript with no external dependencies. Model pricing is developer-configured. All calculations use standard JavaScript arithmetic.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.2] - User story, acceptance criteria, BDD scenarios
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7] - Epic objectives: caching, cost control, concurrency
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Directory Structure] - `packages/core/src/policy/` layout with `cost-manager.ts`, `policy.types.ts`
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns] - `cost-manager.constants.ts` naming convention
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns] - Module internal structure (index.ts barrel, types, implementation, test)
- [Source: _bmad-output/planning-artifacts/architecture.md#Format Patterns] - FluiError structure, Result pattern, ErrorCategory union
- [Source: _bmad-output/planning-artifacts/architecture.md#Architectural Boundaries] - `@flui/core` → `zod` only runtime dependency
- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting Concerns] - Cost awareness: budget checks before LLM call, cost recorded after
- [Source: _bmad-output/planning-artifacts/prd.md#FR35] - Configure cost budgets per session and per time period
- [Source: _bmad-output/planning-artifacts/prd.md#FR36] - Estimate generation cost before making an LLM call based on prompt size
- [Source: _bmad-output/planning-artifacts/prd.md#FR37] - Enforce budget limits synchronously, preventing LLM calls that would exceed budget
- [Source: _bmad-output/planning-artifacts/prd.md#FR38] - Gracefully degrade to cached specifications when budget limits are reached
- [Source: _bmad-output/planning-artifacts/prd.md#Journey 4 - Marco] - Cost-conscious launch path: session + daily budgets, graceful degradation
- [Source: _bmad-output/planning-artifacts/prd.md#Success Metrics] - Budget overruns when Cost Manager configured = 0 overruns
- [Source: packages/core/src/types.ts] - LLMUsage, LLMResponse, GenerationTrace, TraceStep, createTrace
- [Source: packages/core/src/errors/error-codes.ts] - Existing error codes FLUI_E001-FLUI_E025, ErrorCategory union, DefinedFluiErrorCode
- [Source: _bmad-output/implementation-artifacts/7-1-three-level-cache-system.md] - Previous story intelligence: factory pattern, trace enrichment, error code patterns
- [Source: packages/core/src/cache/cache.ts] - createCacheManager factory pattern reference
- [Source: packages/core/src/generation/generation-orchestrator.ts] - GenerationOrchestrator pipeline (integration point for Story 7.4, NOT this story)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Trace metadata key names `estimatedPromptTokens` and `totalTokens` were filtered by `sanitizeTraceMetadata()` which strips keys matching `/token/i`. Renamed to `promptCount` and `totalUsage` respectively.
- Existing error test `errors.test.ts` had hardcoded count of 25 error code descriptions; updated to 27 after adding FLUI_E026/E027.
- Added `'policy'` to ErrorCategory test coverage in `errors.test.ts`.

### Completion Notes List

- Implemented complete CostManager module in `packages/core/src/policy/`
- Factory pattern via `createCostManager(config, trace?)` consistent with `createCacheManager`
- Budget enforcement: session + daily budgets with synchronous checks (no async)
- Cost estimation: prompt-only pre-call estimates, fail-open on unknown models
- Cost recording: actual cost (prompt + completion) deducted from budgets post-call
- Time-period management: daily budget auto-resets after 24h, manual reset methods
- Stats introspection: budget utilization, generation count, average cost, read-only records
- GenerationTrace enrichment: all 3 operations add trace steps with module `'cost-manager'`
- Error codes: FLUI_E026 (budget exhausted), FLUI_E027 (invalid config) with category `'policy'`
- 47 tests with 100% statement/branch/function/line coverage on policy module
- 500 total core tests pass, 129 React tests pass — zero regressions
- Zero new runtime dependencies
- Senior review fixes applied: enforced "most restrictive budget wins" when both budgets are exceeded
- Senior review fixes applied: reject invalid negative/non-finite estimated costs in `checkBudget()`
- Senior review fixes applied: stats average cost now computed from historical records (stable across session resets)

### Change Log

- 2026-02-26: Implemented Story 7-2 — Cost Manager & Budget Enforcement. Created policy module with types, constants, factory, and comprehensive tests. Added error codes FLUI_E026/E027. Exported all public API from core barrel.
- 2026-02-26: Senior AI code review remediation — fixed budget tie-break correctness, hardened budget input validation, corrected stats averaging behavior, and expanded error-code regression coverage/tests.

### File List

**New files:**

- packages/core/src/policy/policy.types.ts
- packages/core/src/policy/cost-manager.constants.ts
- packages/core/src/policy/cost-manager.ts
- packages/core/src/policy/cost-manager.test.ts
- packages/core/src/policy/index.ts

**Modified files:**

- packages/core/src/policy/cost-manager.ts (fixed dual-budget restrictive selection, added invalid estimate guard, corrected average cost calculation source)
- packages/core/src/policy/cost-manager.test.ts (added regression tests for dual-budget selection, invalid estimate rejection, and post-reset average stability)
- packages/core/src/errors/error-codes.ts (added FLUI_E026, FLUI_E027, 'policy' to ErrorCategory)
- packages/core/src/errors/index.ts (exported FLUI_E026, FLUI_E027)
- packages/core/src/errors/errors.test.ts (expanded exported code list and sequential coverage through FLUI_E027; includes 'policy' category)
- packages/core/src/index.ts (added policy module exports, FLUI_E026/E027)
- _bmad-output/implementation-artifacts/7-2-cost-manager-and-budget-enforcement.md (status, changelog, review notes, file list updates)
- _bmad-output/implementation-artifacts/sprint-status.yaml (status updates)

### Senior Developer Review (AI)

- Reviewer: Fabrice (AI-assisted)
- Date: 2026-02-26
- Outcome: Changes Requested addressed; HIGH and MEDIUM findings remediated.
- Verified fix: Dual-budget exhaustion now selects the actually more restrictive budget type and remaining budget.
- Verified fix: Invalid estimated costs are rejected deterministically (no fail-open path for negative/non-finite input).
- Verified fix: `averageCostPerGeneration` now reflects historical records even after session resets.
- Verified fix: Error-code regression tests now validate the full defined range through `FLUI_E027`.
- Validation run: `pnpm --filter @flui/core test -- src/policy/cost-manager.test.ts src/errors/errors.test.ts` (pass)
