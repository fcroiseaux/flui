# Story 7.3: Concurrency Controller & Circuit Breaker

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want stale generation requests cancelled automatically and repeated failures to trigger a circuit breaker,
so that the system stays responsive under load and recovers gracefully from persistent LLM issues.

## Acceptance Criteria

1. **Latest-Wins Request Cancellation** (FR42): Given the concurrency/ module in @flui/core, when a new generation request is made while a previous request is still in-flight, then the previous request is cancelled via AbortSignal (latest-wins semantics), and cancelled requests are cleaned up with no orphaned promises or memory leaks (NFR-R4).

2. **Rapid Successive Requests**: Given rapid successive generation requests, when multiple requests are submitted in quick succession, then only the latest request proceeds to the LLM, and all previous requests are cancelled cleanly.

3. **Circuit Breaker Activation** (FR34, NFR-R2): Given the circuit breaker, when 3 consecutive generation failures occur, then the circuit breaker activates (transitions to OPEN state) and locks to fallback mode, and subsequent generation requests immediately return the fallback without attempting LLM calls.

4. **Circuit Breaker Half-Open State & Probe Recovery**: Given an active (OPEN) circuit breaker, when a configurable cooldown period elapses, then the circuit breaker transitions to HALF_OPEN state and allows a single probe request to test recovery, and the probe is a real generation request (not synthetic) using the current intent+context, and its cost counts toward the budget, and if the probe succeeds (valid UISpecification returned), the circuit breaker deactivates (returns to CLOSED) and normal generation resumes, and if the probe fails, the circuit breaker returns to OPEN state and resets the cooldown timer.

5. **Complete LLM Provider Outage Resilience** (NFR-R3): Given a complete LLM provider outage, then the application continues functioning with cached and fallback UIs, and the circuit breaker prevents repeated failed calls.

6. **Circuit Breaker Scope Configuration**: Given a circuit breaker configuration, when the scope is set to `'global'`, `'per-view'`, or `'per-intent'`, then the circuit breaker tracks failures at the configured granularity level. Default scope is `'global'`.

7. **Concurrency Controller Configuration**: Given a concurrency controller, when created with a `ConcurrencyConfig`, then the controller respects the configured parameters including scope (per-view or global latest-wins).

8. **AbortSignal Propagation**: Given a cancellation via the concurrency controller, when a request is aborted, then the AbortSignal is propagated to downstream consumers (generation orchestrator, LLM connectors) enabling them to terminate in-flight LLM calls.

9. **Testing Requirements**: Co-located tests cover: latest-wins cancellation, rapid request sequences, memory leak verification (no orphaned promises), circuit breaker activation at 3 failures, cooldown probe success/failure, provider outage scenario, scope-based tracking, AbortSignal propagation, GenerationTrace enrichment. All tests pass with >90% coverage.

## Tasks / Subtasks

- [x] Task 1: Create concurrency module directory and type definitions (AC: #1, #2, #3, #4, #6, #7, #8)
  - [x] 1.1 Create `packages/core/src/concurrency/` directory
  - [x] 1.2 Create `packages/core/src/concurrency/concurrency.types.ts` with all type definitions:
    - `CircuitBreakerState` type: `'closed' | 'open' | 'half-open'`
    - `CircuitBreakerScope` type: `'global' | 'per-view' | 'per-intent'`
    - `CircuitBreakerConfig` interface: `{ failureThreshold?: number | undefined; resetTimeout?: number | undefined; scope?: CircuitBreakerScope | undefined }`
    - `CircuitBreakerStatus` interface: `{ state: CircuitBreakerState; consecutiveFailures: number; lastFailureTime: number | null; scope: CircuitBreakerScope }`
    - `ConcurrencyConfig` interface: `{ circuitBreaker?: CircuitBreakerConfig | undefined }`
    - `CancellationResult` interface: `{ cancelled: boolean; reason?: string | undefined }`
    - `ConcurrencyController` interface: `{ execute<T>(key: string, fn: (signal: AbortSignal) => Promise<T>): Promise<Result<T, FluiError>>; cancel(key: string): CancellationResult; cancelAll(): number; getCircuitBreakerStatus(key?: string | undefined): CircuitBreakerStatus; recordFailure(key?: string | undefined): void; recordSuccess(key?: string | undefined): void; reset(): void }`
    - `CircuitBreaker` interface: `{ state(key?: string | undefined): CircuitBreakerState; status(key?: string | undefined): CircuitBreakerStatus; recordFailure(key?: string | undefined): void; recordSuccess(key?: string | undefined): void; shouldAllow(key?: string | undefined): boolean; reset(key?: string | undefined): void }`
  - [x] 1.3 Export all types from `concurrency.types.ts`

- [x] Task 2: Create concurrency module constants (AC: #3, #4, #6)
  - [x] 2.1 Create `packages/core/src/concurrency/concurrency.constants.ts`
  - [x] 2.2 Define `DEFAULT_FAILURE_THRESHOLD` = 3 (NFR-R2: 3 consecutive failures)
  - [x] 2.3 Define `DEFAULT_RESET_TIMEOUT` = 60_000 (60 seconds cooldown, per ADR-011)
  - [x] 2.4 Define `DEFAULT_CIRCUIT_BREAKER_SCOPE`: `'global'` as CircuitBreakerScope

- [x] Task 3: Implement circuit breaker (AC: #3, #4, #5, #6)
  - [x] 3.1 Create `packages/core/src/concurrency/circuit-breaker.ts`
  - [x] 3.2 Implement `createCircuitBreaker(config?: CircuitBreakerConfig, trace?: GenerationTrace): CircuitBreaker`
  - [x] 3.3 Validate config at creation time:
    - If `failureThreshold` is defined and <= 0 → throw FluiError with `FLUI_E030`
    - If `resetTimeout` is defined and <= 0 → throw FluiError with `FLUI_E030`
  - [x] 3.4 Circuit breaker state machine implementation:
    - CLOSED → OPEN: when consecutive failures >= failureThreshold
    - OPEN → HALF_OPEN: when resetTimeout has elapsed since last failure
    - HALF_OPEN → CLOSED: on probe success (recordSuccess)
    - HALF_OPEN → OPEN: on probe failure (recordFailure), reset cooldown timer
  - [x] 3.5 Implement scope-based tracking:
    - `'global'`: single failure counter for all requests
    - `'per-view'`: failure counter keyed by view ID
    - `'per-intent'`: failure counter keyed by intent hash
  - [x] 3.6 `shouldAllow(key?)`: returns true (CLOSED), false (OPEN, before cooldown), or true (HALF_OPEN, one probe allowed)
  - [x] 3.7 Enrich GenerationTrace with `trace?.addStep({ module: 'circuit-breaker', operation: '...', ... })`

- [x] Task 4: Implement concurrency controller with latest-wins semantics (AC: #1, #2, #7, #8)
  - [x] 4.1 Create `packages/core/src/concurrency/controller.ts`
  - [x] 4.2 Implement `createConcurrencyController(config?: ConcurrencyConfig, trace?: GenerationTrace): ConcurrencyController`
  - [x] 4.3 Latest-wins cancellation implementation:
    - Maintain a Map of active requests keyed by request key (view ID or intent key)
    - On new `execute(key, fn)`: if existing request for key is in-flight, abort it via AbortController.abort()
    - Create new AbortController for new request
    - Pass AbortSignal to the provided function
    - On completion: clean up the request entry from the map
  - [x] 4.4 Handle cancellation: when AbortSignal fires, return `Result.error(new FluiError(FLUI_E010, 'generation', 'Generation cancelled'))`
  - [x] 4.5 Handle function errors: wrap in Result.error
  - [x] 4.6 Integrate circuit breaker into execute flow:
    - Before executing fn, check `circuitBreaker.shouldAllow(key)`
    - If circuit is OPEN and not allowing probe → return `Result.error(new FluiError(FLUI_E029, 'concurrency', 'Circuit breaker is open'))`
    - On success → `circuitBreaker.recordSuccess(key)`
    - On failure → `circuitBreaker.recordFailure(key)`
  - [x] 4.7 Implement `cancel(key)` and `cancelAll()` methods
  - [x] 4.8 Enrich GenerationTrace with `trace?.addStep({ module: 'concurrency-controller', operation: '...', ... })`

- [x] Task 5: Add new error codes for concurrency module (AC: #3, #4)
  - [x] 5.1 Add `FLUI_E028` — Request cancelled: generation superseded by newer request
  - [x] 5.2 Add `FLUI_E029` — Circuit breaker open: LLM calls blocked due to consecutive failures
  - [x] 5.3 Add `FLUI_E030` — Invalid concurrency configuration: invalid threshold or timeout
  - [x] 5.4 Add `'concurrency'` to `ErrorCategory` union type
  - [x] 5.5 Update `DefinedFluiErrorCode` union type and `ERROR_CODE_DESCRIPTIONS` map
  - [x] 5.6 Export new error codes from `errors/index.ts` and core barrel

- [x] Task 6: Create barrel exports (AC: all)
  - [x] 6.1 Create `packages/core/src/concurrency/index.ts` exporting all public types, `createConcurrencyController`, and `createCircuitBreaker`
  - [x] 6.2 Update `packages/core/src/index.ts` to export concurrency module types and factories
  - [x] 6.3 Export new error codes `FLUI_E028`, `FLUI_E029`, `FLUI_E030` from core barrel
  - [x] 6.4 Verify TypeScript compilation succeeds with all exports

- [x] Task 7: Write comprehensive tests (AC: #1, #2, #3, #4, #5, #6, #7, #8, #9)
  - [x] 7.1 Create `packages/core/src/concurrency/circuit-breaker.test.ts`:
    - **Configuration Tests:**
      - Test creating circuit breaker with default config
      - Test creating circuit breaker with custom thresholds
      - Test invalid config: non-positive failureThreshold throws FLUI_E030
      - Test invalid config: non-positive resetTimeout throws FLUI_E030
    - **State Machine Tests:**
      - Test initial state is CLOSED
      - Test state transitions: CLOSED → OPEN after failureThreshold failures
      - Test state transitions: OPEN → HALF_OPEN after resetTimeout (use `vi.useFakeTimers()`)
      - Test state transitions: HALF_OPEN → CLOSED on probe success
      - Test state transitions: HALF_OPEN → OPEN on probe failure (cooldown reset)
      - Test shouldAllow returns true when CLOSED
      - Test shouldAllow returns false when OPEN (before cooldown)
      - Test shouldAllow returns true once when HALF_OPEN (probe)
      - Test shouldAllow returns false for second call in HALF_OPEN (only one probe)
    - **Scope Tests:**
      - Test global scope: all keys share same counter
      - Test per-view scope: different keys have independent counters
      - Test per-intent scope: different keys have independent counters
    - **Reset Tests:**
      - Test reset clears all state back to CLOSED
      - Test reset with key only clears that key's state
    - **Trace Integration Tests:**
      - Test state transitions record trace steps with module 'circuit-breaker'
  - [x] 7.2 Create `packages/core/src/concurrency/controller.test.ts`:
    - **Latest-Wins Cancellation Tests:**
      - Test single request executes normally
      - Test new request cancels in-flight request for same key
      - Test cancelled request returns FLUI_E010 or FLUI_E028 error
      - Test different keys do not cancel each other
      - Test rapid successive requests: only latest proceeds
    - **AbortSignal Tests:**
      - Test AbortSignal is passed to the function
      - Test AbortSignal is aborted when request is cancelled
      - Test function can check signal.aborted
    - **Circuit Breaker Integration Tests:**
      - Test execute blocks when circuit is open (returns FLUI_E029)
      - Test execute allows probe when circuit is half-open
      - Test successful execution records success with circuit breaker
      - Test failed execution records failure with circuit breaker
    - **Memory Leak Tests:**
      - Test completed requests are cleaned up from active map
      - Test cancelled requests are cleaned up from active map
      - Test cancelAll clears all active requests
    - **Error Handling Tests:**
      - Test function throwing error returns Result.error
      - Test function rejection returns Result.error
    - **Trace Integration Tests:**
      - Test execute records trace steps with module 'concurrency-controller'
      - Test cancel records trace step
  - [x] 7.3 All tests pass with >90% statement coverage

## Dev Notes

### Architecture Compliance

**Package:** `@flui/core` — new `concurrency/` module (ADR-005, ADR-011)

**New files (architecture-specified):**
```
packages/core/src/concurrency/
  ├── index.ts                    # Public API barrel
  ├── controller.ts               # ConcurrencyController factory and latest-wins logic
  ├── circuit-breaker.ts          # CircuitBreaker factory and state machine
  ├── concurrency.types.ts        # All concurrency type definitions
  ├── concurrency.constants.ts    # Concurrency constants (thresholds, timeouts)
  ├── controller.test.ts          # Co-located tests for controller
  └── circuit-breaker.test.ts     # Co-located tests for circuit breaker
```

**Modified files:**
```
packages/core/src/
  ├── errors/error-codes.ts       # Add FLUI_E028, FLUI_E029, FLUI_E030, add 'concurrency' to ErrorCategory
  ├── errors/index.ts             # Export new error codes
  ├── index.ts                    # Export concurrency module types and factories
```

**Do NOT create these files** (they belong to future stories):
- `policy/generation-policy.ts` — Generation policy engine (Story 7.4)
- Any integration with `GenerationOrchestrator.generate()` — that belongs to Story 7.4 (policy engine wires concurrency, cost, cache into the generation pipeline)
- Any React hooks or component changes — those are in Epic 8 or already done in Epic 6
- `RetryConfig` or retry strategy types — retry logic is part of Story 5.3 (already done) and Story 7.4's policy engine

**Package dependency rules:**
- `@flui/core` → `zod@4.x` (only runtime dependency — NOT needed by concurrency module itself)
- Import `FluiError`, `FLUI_E010`, error codes from `../errors`
- Import `GenerationTrace`, `TraceStep` from `../types`
- Import `Result`, `ok`, `error` from `../errors` (for Result pattern)
- Zero new runtime dependencies
- Zero new peer dependencies
- `sideEffects: false` must be maintained in package.json

### Implementation Patterns (MUST follow)

**Factory pattern (established codebase convention):**
```typescript
// Circuit Breaker - follow the create* factory pattern
export function createCircuitBreaker(
  config?: CircuitBreakerConfig | undefined,
  trace?: GenerationTrace | undefined,
): CircuitBreaker {
  const threshold = config?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
  const timeout = config?.resetTimeout ?? DEFAULT_RESET_TIMEOUT;
  const scope = config?.scope ?? DEFAULT_CIRCUIT_BREAKER_SCOPE;

  // Validate config at creation time
  if (threshold <= 0) {
    throw new FluiError(FLUI_E030, 'concurrency', 'Failure threshold must be positive', {
      context: { failureThreshold: threshold },
    });
  }
  if (timeout <= 0) {
    throw new FluiError(FLUI_E030, 'concurrency', 'Reset timeout must be positive', {
      context: { resetTimeout: timeout },
    });
  }

  // Internal state: Map for scope-based tracking
  // For 'global' scope, use a single key like '__global__'
  const trackers = new Map<string, {
    state: CircuitBreakerState;
    consecutiveFailures: number;
    lastFailureTime: number | null;
    halfOpenProbeActive: boolean;
  }>();

  function resolveKey(key?: string | undefined): string {
    if (scope === 'global') return '__global__';
    return key ?? '__global__';
  }

  // ... return CircuitBreaker implementation
}
```

**Concurrency Controller - latest-wins with AbortController:**
```typescript
export function createConcurrencyController(
  config?: ConcurrencyConfig | undefined,
  trace?: GenerationTrace | undefined,
): ConcurrencyController {
  const circuitBreaker = createCircuitBreaker(config?.circuitBreaker, trace);
  const activeRequests = new Map<string, AbortController>();

  async function execute<T>(
    key: string,
    fn: (signal: AbortSignal) => Promise<T>,
  ): Promise<Result<T, FluiError>> {
    // 1. Check circuit breaker FIRST
    if (!circuitBreaker.shouldAllow(key)) {
      trace?.addStep({
        module: 'concurrency-controller',
        operation: 'execute',
        durationMs: 0,
        metadata: { key, blocked: true, reason: 'circuit-breaker-open' },
      });
      return error(new FluiError(FLUI_E029, 'concurrency', 'Circuit breaker is open', {
        context: { key, state: circuitBreaker.state(key) },
      }));
    }

    // 2. Cancel any existing request for this key (latest-wins)
    const existing = activeRequests.get(key);
    if (existing) {
      existing.abort();
      trace?.addStep({
        module: 'concurrency-controller',
        operation: 'cancel',
        durationMs: 0,
        metadata: { key, reason: 'superseded-by-new-request' },
      });
    }

    // 3. Create new AbortController
    const controller = new AbortController();
    activeRequests.set(key, controller);

    const startTime = Date.now();
    try {
      const result = await fn(controller.signal);

      // Check if we were cancelled during execution
      if (controller.signal.aborted) {
        return error(new FluiError(FLUI_E028, 'concurrency', 'Request cancelled'));
      }

      circuitBreaker.recordSuccess(key);
      return ok(result);
    } catch (err) {
      if (controller.signal.aborted) {
        return error(new FluiError(FLUI_E028, 'concurrency', 'Request cancelled'));
      }

      circuitBreaker.recordFailure(key);
      const fluiErr = err instanceof FluiError
        ? err
        : new FluiError(FLUI_E028, 'concurrency', 'Generation failed', {
            cause: err instanceof Error ? err : undefined,
          });
      return error(fluiErr);
    } finally {
      // Clean up: only if this is still the active controller for this key
      if (activeRequests.get(key) === controller) {
        activeRequests.delete(key);
      }
      trace?.addStep({
        module: 'concurrency-controller',
        operation: 'execute',
        durationMs: Date.now() - startTime,
        metadata: { key },
      });
    }
  }

  // ... cancel, cancelAll, reset methods
  return { execute, cancel, cancelAll, getCircuitBreakerStatus, recordFailure, recordSuccess, reset };
}
```

**Circuit Breaker state machine (CLOSED → OPEN → HALF_OPEN → CLOSED/OPEN):**
```typescript
function shouldAllow(key?: string | undefined): boolean {
  const resolvedKey = resolveKey(key);
  const tracker = getOrCreateTracker(resolvedKey);

  switch (tracker.state) {
    case 'closed':
      return true;

    case 'open': {
      // Check if cooldown has elapsed
      const now = Date.now();
      if (tracker.lastFailureTime !== null && now - tracker.lastFailureTime >= timeout) {
        tracker.state = 'half-open';
        tracker.halfOpenProbeActive = false;
        trace?.addStep({
          module: 'circuit-breaker',
          operation: 'stateChange',
          durationMs: 0,
          metadata: { key: resolvedKey, from: 'open', to: 'half-open' },
        });
        // Fall through to half-open logic
      } else {
        return false;
      }
    }
    // falls through intentionally to half-open

    case 'half-open': {
      // Allow exactly one probe request
      if (!tracker.halfOpenProbeActive) {
        tracker.halfOpenProbeActive = true;
        return true;
      }
      return false; // Another probe already active
    }
  }
}

function recordFailure(key?: string | undefined): void {
  const resolvedKey = resolveKey(key);
  const tracker = getOrCreateTracker(resolvedKey);

  tracker.consecutiveFailures++;
  tracker.lastFailureTime = Date.now();

  if (tracker.state === 'half-open') {
    // Probe failed: go back to OPEN, reset cooldown
    tracker.state = 'open';
    tracker.halfOpenProbeActive = false;
    trace?.addStep({
      module: 'circuit-breaker',
      operation: 'stateChange',
      durationMs: 0,
      metadata: { key: resolvedKey, from: 'half-open', to: 'open', reason: 'probe-failed' },
    });
  } else if (tracker.state === 'closed' && tracker.consecutiveFailures >= threshold) {
    tracker.state = 'open';
    trace?.addStep({
      module: 'circuit-breaker',
      operation: 'stateChange',
      durationMs: 0,
      metadata: { key: resolvedKey, from: 'closed', to: 'open', failures: tracker.consecutiveFailures },
    });
  }
}

function recordSuccess(key?: string | undefined): void {
  const resolvedKey = resolveKey(key);
  const tracker = getOrCreateTracker(resolvedKey);

  if (tracker.state === 'half-open') {
    // Probe succeeded: close the circuit
    tracker.state = 'closed';
    tracker.consecutiveFailures = 0;
    tracker.halfOpenProbeActive = false;
    trace?.addStep({
      module: 'circuit-breaker',
      operation: 'stateChange',
      durationMs: 0,
      metadata: { key: resolvedKey, from: 'half-open', to: 'closed', reason: 'probe-succeeded' },
    });
  } else {
    // Normal success: reset failure count
    tracker.consecutiveFailures = 0;
  }
}
```

**AbortSignal propagation pattern (from architecture):**
```typescript
// EVERY async function in the generation pipeline accepts AbortSignal
// The concurrency controller CREATES the AbortSignal and passes it to downstream functions
// The controller's execute() provides signal to the callback:
controller.execute('view-1', async (signal: AbortSignal) => {
  // Check signal before expensive operations
  if (signal.aborted) {
    throw new FluiError(FLUI_E010, 'generation', 'Generation cancelled');
  }
  // Pass signal to orchestrator, which passes to LLM connector
  return orchestrator.generate(request, { signal });
});
```

### Error Handling

**New error codes:**
- `FLUI_E028` — Request cancelled: generation superseded by newer request or explicitly cancelled (category: `'concurrency'`)
- `FLUI_E029` — Circuit breaker open: LLM calls blocked due to consecutive failures (category: `'concurrency'`)
- `FLUI_E030` — Invalid concurrency configuration: invalid threshold, timeout, or scope (category: `'concurrency'`)

**New ErrorCategory:**
- Add `'concurrency'` to the `ErrorCategory` union in `error-codes.ts`

**Error scenarios:**
- Non-positive failureThreshold in config → throw `FluiError(FLUI_E030)` at creation time
- Non-positive resetTimeout in config → throw `FluiError(FLUI_E030)` at creation time
- Request superseded by newer request → return `Result.error(new FluiError(FLUI_E028, ...))`
- Circuit breaker open (blocks request) → return `Result.error(new FluiError(FLUI_E029, ...))`
- Function execution error → return `Result.error(...)` wrapping the original error

**Critical: circuit breaker checks and cancellations NEVER throw.** They return `Result.error`. Only `createCircuitBreaker()` and `createConcurrencyController()` throw on invalid configuration (fail-fast on programmer errors).

**Existing error code to reuse:**
- `FLUI_E010` — Generation cancelled (already exists for AbortSignal cancellation in generation pipeline)

### Existing Code to Reuse (DO NOT reinvent)

| What | Where | How to use |
|------|-------|------------|
| `FluiError` class | `@flui/core` errors barrel | Thrown on invalid config, wrapped in Result.error |
| `Result<T>`, `ok()`, `error()` | `@flui/core` errors barrel | Return type for `execute()` method |
| `FLUI_E010` | `@flui/core` errors barrel | Existing cancellation error code |
| `GenerationTrace` | `@flui/core` types barrel | Pass to factories, call `addStep()` for trace enrichment |
| `TraceStep` | `@flui/core` types barrel | Structure for trace step metadata |
| `createTrace()` | `@flui/core` types barrel | For testing trace enrichment |
| `CostManager` | `@flui/core` policy barrel | NOT imported — cost integration is Story 7.4's responsibility |
| `CacheManager` | `@flui/core` cache barrel | NOT imported — cache fallback is Story 7.4's responsibility |
| `GenerationOrchestrator` | `@flui/core` generation barrel | NOT imported — orchestrator integration is Story 7.4's responsibility |

### Design Decisions

**Separate circuit breaker from controller:**
The circuit breaker (`createCircuitBreaker`) and concurrency controller (`createConcurrencyController`) are separate factories. The controller composes the circuit breaker internally. This follows the single-responsibility principle — the circuit breaker tracks failure state, the controller manages request lifecycle. This allows Story 7.4's policy engine to access circuit breaker state independently if needed.

**Latest-wins using AbortController:**
AbortController is a web standard (available in Node.js 16+ and all modern browsers). Each request key (typically view ID) maps to exactly one AbortController. When a new request arrives for the same key, the previous controller is aborted. This is clean, well-understood, and garbage-collector-friendly (no dangling callbacks).

**Result<T> for execute(), throw for config:**
`execute()` returns `Result<T, FluiError>` because cancellation and circuit breaker blocking are expected control flow, not programmer errors. Config validation throws `FluiError` because invalid config is a programmer error (fail-fast). This mirrors the cost manager pattern.

**Scope-based circuit breaker tracking:**
The circuit breaker supports three scopes (global, per-view, per-intent) as specified in ADR-011. The `'global'` scope uses a single tracker. `'per-view'` and `'per-intent'` use a Map keyed by the request key. Default is `'global'` for simplest configuration.

**No retry logic in this story:**
Retry logic (ADR-011's `RetryConfig` and retry strategies) is NOT part of this story. Retry with prompt modification is handled by Story 5.3 (custom validators and validation retry) and will be coordinated by Story 7.4 (generation policy engine). The circuit breaker only tracks raw success/failure — it does not decide whether to retry.

**ConcurrencyController is standalone:**
Story 7-3 creates the ConcurrencyController and CircuitBreaker as standalone modules. They do NOT wire into GenerationOrchestrator or coordinate with CacheManager/CostManager. That integration is Story 7.4's responsibility (policy engine). The concurrency controller is a request-lifecycle primitive.

**Memory management:**
- Active requests Map is cleaned up in the `finally` block of `execute()`
- Circuit breaker trackers are lightweight (a few bytes per tracked key)
- No timers or intervals — cooldown is checked lazily on `shouldAllow()` (same pattern as cost manager's daily budget reset)

### Project Structure Notes

- This story creates the `concurrency/` module directory in `@flui/core` (separate from `policy/`)
- Architecture specifies: `concurrency/ → imports generation/, errors/` — but for this story, we only import from `errors/` (generation integration is Story 7.4)
- Story 7.4 will use both `ConcurrencyController` and `CircuitBreaker` to wire into the generation policy
- All files follow existing naming: kebab-case with co-located tests
- Two test files (one per factory) follows the pattern of having focused, modular test suites
- No changes to `@flui/react` package in this story — concurrency control is a core concern
- No changes to build configuration (tsup/vitest) needed — existing config covers new directory
- `sideEffects: false` must remain in `package.json` for tree-shaking

### Previous Story Intelligence

**From Story 7-2 (Cost Manager & Budget Enforcement — DONE, previous story in this epic):**
- `exactOptionalPropertyTypes` strictness is enabled — all optional properties need explicit `| undefined`
- Factory pattern: `createCostManager(config, trace?)` — follow same pattern for `createConcurrencyController(config?, trace?)` and `createCircuitBreaker(config?, trace?)`
- Trace enrichment pattern: `trace?.addStep({ module: 'cost-manager', operation: '...', durationMs: ..., metadata: {...} })` — follow identically with modules `'concurrency-controller'` and `'circuit-breaker'`
- Error code pattern: added FLUI_E026, FLUI_E027 with category `'policy'` — follow same pattern for FLUI_E028, FLUI_E029, FLUI_E030 with category `'concurrency'`
- The `'policy'` category was added in Story 7-2 — `'concurrency'` MUST be added as a new category
- 500 tests in @flui/core, 129 in @flui/react — maintain zero regressions
- Sprint status file must be updated after story creation
- `sanitizeTraceMetadata()` strips keys matching `/token/i` — avoid using "token" in metadata keys (use alternative names like "promptCount", "totalUsage")
- Existing error test `errors.test.ts` had count updated to 27 error code descriptions — will need update to 30 after adding FLUI_E028/E029/E030
- `BudgetCheckResult` pattern (typed result object, not thrown error) — similar to how circuit breaker `shouldAllow()` returns boolean (not thrown)

**From Story 7-1 (Three-Level Cache System — DONE):**
- Timer mocking: `vi.useFakeTimers()` and `vi.advanceTimersByTime()` work well for time-based tests — use for circuit breaker cooldown testing
- `afterEach(() => { vi.useRealTimers(); })` pattern for cleanup

**From Story 4-2 (Generation Orchestrator — DONE):**
- `GenerationOrchestrator.generate()` already accepts `signal?: AbortSignal` parameter
- The orchestrator already uses FLUI_E010 for cancellation: `return { ok: false, error: new FluiError('FLUI_E010', 'generation', 'Generation cancelled') }`
- This confirms the AbortSignal propagation pattern is already established in the codebase

### Git Intelligence

**Recent commit patterns:**
- `cdedb77` — `feat: implement cost manager and budget enforcement (story 7-2)` (latest)
- `e9b389b` — `feat: implement three-level cache system with memory, session, and IndexedDB storage (story 7-1)`
- All commits follow: `feat: implement <description> (story X-Y)`
- Implementation order: types → constants → implementation → tests → barrel exports → error codes

**Files most recently modified in `@flui/core` (Story 7-2):**
- `packages/core/src/policy/` — complete module
- `packages/core/src/errors/error-codes.ts` — added FLUI_E026, FLUI_E027, added 'policy' ErrorCategory
- `packages/core/src/errors/errors.test.ts` — updated count to 27
- `packages/core/src/errors/index.ts` — exported new codes
- `packages/core/src/index.ts` — added policy exports

### Testing Standards

- **Framework:** Vitest 4.0.18 with `node` environment (core package, NOT jsdom)
- **Test structure:** `describe('ModuleName') > describe('feature') > it('specific behavior')`
- **Coverage:** >90% statement coverage required
- **Mock pattern:** Use `vi.fn()` for callbacks, `vi.spyOn()` for module mocks
- **Timer mocks:** Use `vi.useFakeTimers()` for circuit breaker cooldown tests (proven in Story 7-1 TTL tests and Story 7-2 daily budget tests)
- **Import pattern:** Import from relative paths within same package, never from barrel in tests
- **Async testing:** Use `async/await` with proper promise resolution for concurrency tests
- **AbortSignal testing:** Create real `AbortController` instances, check `signal.aborted` state

**Testing concurrency controller specifics:**
```typescript
// Test latest-wins cancellation
it('cancels in-flight request when new request arrives for same key', async () => {
  const controller = createConcurrencyController();
  const signals: AbortSignal[] = [];

  // Start a long-running request
  const promise1 = controller.execute('view-1', async (signal) => {
    signals.push(signal);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (signal.aborted) throw new Error('Aborted');
    return 'result-1';
  });

  // Immediately start another request for same key
  const promise2 = controller.execute('view-1', async (signal) => {
    signals.push(signal);
    return 'result-2';
  });

  const [result1, result2] = await Promise.all([promise1, promise2]);

  // First request should be cancelled
  expect(result1.ok).toBe(false);
  expect(signals[0]!.aborted).toBe(true);

  // Second request should succeed
  expect(result2.ok).toBe(true);
  if (result2.ok) expect(result2.value).toBe('result-2');
});

// Test circuit breaker activation
it('opens circuit after 3 consecutive failures', () => {
  const breaker = createCircuitBreaker({ failureThreshold: 3 });

  breaker.recordFailure();
  breaker.recordFailure();
  expect(breaker.state()).toBe('closed');

  breaker.recordFailure();
  expect(breaker.state()).toBe('open');
  expect(breaker.shouldAllow()).toBe(false);
});

// Test half-open probe with fake timers
it('transitions to half-open after cooldown and allows one probe', () => {
  vi.useFakeTimers();
  const breaker = createCircuitBreaker({
    failureThreshold: 3,
    resetTimeout: 60_000,
  });

  // Open the circuit
  breaker.recordFailure();
  breaker.recordFailure();
  breaker.recordFailure();
  expect(breaker.state()).toBe('open');

  // Advance past cooldown
  vi.advanceTimersByTime(60_000);

  // Should allow one probe
  expect(breaker.shouldAllow()).toBe(true); // transitions to half-open
  expect(breaker.shouldAllow()).toBe(false); // only one probe

  vi.useRealTimers();
});

// Test trace enrichment
it('records circuit breaker state changes in GenerationTrace', () => {
  const trace = createTrace();
  const breaker = createCircuitBreaker({ failureThreshold: 2 }, trace);

  breaker.recordFailure();
  breaker.recordFailure(); // This should trigger OPEN

  const steps = trace.steps.filter(s => s.module === 'circuit-breaker');
  expect(steps.length).toBeGreaterThan(0);
  expect(steps.some(s => s.operation === 'stateChange')).toBe(true);
});
```

### Performance Considerations

- All circuit breaker operations are synchronous in-memory — O(1) per operation
- `shouldAllow()`: single Map lookup + timestamp comparison — < 0.01ms
- `recordFailure()` / `recordSuccess()`: Map lookup + counter update — < 0.01ms
- Concurrency controller `execute()`: Map operations + AbortController creation — < 0.1ms overhead on top of the actual async function
- No timers or intervals created — cooldown is lazy-checked (no background work)
- Memory: one Map entry per active request key in controller, one tracker per scope key in circuit breaker
- AbortController cleanup in `finally` block prevents memory leaks
- No runtime dependencies added
- Bundle impact: ~1-2KB for concurrency module (well within core's 25KB budget)

### Library/Framework Requirements

| Library | Version | Purpose | Already in package.json? |
|---------|---------|---------|-------------------------|
| None | — | No new dependencies needed | N/A |

The concurrency controller uses web-standard `AbortController` and `AbortSignal` APIs (available in Node.js 16+ and all modern browsers). No external libraries required.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.3] - User story, acceptance criteria, BDD scenarios
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7] - Epic objectives: caching, cost control, concurrency
- [Source: docs/flui-architecture-decisions.md#ADR-005] - Concurrency and Generation Request Lifecycle: latest-wins, AbortController cancellation pattern, request state machine
- [Source: docs/flui-architecture-decisions.md#ADR-011] - Error Recovery and Circuit Breaker: state machine (CLOSED/OPEN/HALF-OPEN), failure threshold, reset timeout, scope, failure telemetry
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Directory Structure] - `packages/core/src/concurrency/` layout with controller.ts, circuit-breaker.ts, concurrency.types.ts
- [Source: _bmad-output/planning-artifacts/architecture.md#Module Dependencies] - `concurrency/ → imports generation/, errors/`
- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting Concerns] - AbortSignal propagation through pipeline, Fallback guarantee via Circuit Breaker
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns] - kebab-case file naming, module.types.ts convention
- [Source: _bmad-output/planning-artifacts/architecture.md#Format Patterns] - FluiError structure, Result pattern, ErrorCategory union
- [Source: _bmad-output/planning-artifacts/architecture.md#Enforcement Guidelines] - Result<T> for async, AbortSignal propagation, barrel imports, trace enrichment
- [Source: _bmad-output/planning-artifacts/prd.md#FR34] - Circuit breaker after consecutive failures, locking to fallback mode
- [Source: _bmad-output/planning-artifacts/prd.md#FR42] - Cancel in-flight requests when newer request supersedes (latest-wins)
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-R2] - Circuit breaker activates after 3 consecutive failures
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-R3] - Application continues functioning during complete LLM provider outage
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-R4] - Concurrency controller cancels stale requests cleanly — no orphaned promises, no memory leaks
- [Source: _bmad-output/planning-artifacts/prd.md#Marco Journey] - Power user triggers 30 regenerations, concurrency controller cancels stale requests
- [Source: packages/core/src/types.ts] - GenerationTrace, TraceStep, createTrace
- [Source: packages/core/src/errors/error-codes.ts] - Existing error codes FLUI_E001-FLUI_E027, ErrorCategory union, DefinedFluiErrorCode
- [Source: packages/core/src/errors/result.ts] - Result<T>, ok(), error() functions
- [Source: packages/core/src/policy/cost-manager.ts] - Factory pattern reference, trace enrichment pattern
- [Source: _bmad-output/implementation-artifacts/7-2-cost-manager-and-budget-enforcement.md] - Previous story intelligence: factory pattern, trace enrichment, error code patterns, sanitizeTraceMetadata caveat
- [Source: _bmad-output/implementation-artifacts/7-1-three-level-cache-system.md] - Timer mocking patterns for vitest

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

N/A

### Completion Notes List

- All 7 tasks and all subtasks implemented successfully
- Task 5 (error codes) implemented before Tasks 3-4 to satisfy compile-time dependencies
- 47 new tests written (24 circuit-breaker + 23 controller)
- All 550 core tests pass, all 129 React tests pass — zero regressions
- Coverage: 97.41% statements on concurrency module (circuit-breaker.ts 100%, controller.ts 93.87%)
- Controller uncovered lines (72, 170, 176) are edge-case branches for abort-during-success and non-Error throwables — acceptable
- No new runtime dependencies added
- `exactOptionalPropertyTypes` compliance verified — all optional params use `| undefined`
- Factory pattern, trace enrichment, and Result<T> patterns match established codebase conventions

### Change Log

- 2026-02-26: Story 7-3 implementation complete — concurrency controller with latest-wins semantics and circuit breaker state machine
- 2026-02-27: Senior code review fixes applied — latest-wins scope config, provider outage/probe tests, error semantics correction, story/docs sync

### File List

**New files:**

- `packages/core/src/concurrency/concurrency.types.ts` — Type definitions for CircuitBreaker, ConcurrencyController, and related types
- `packages/core/src/concurrency/concurrency.constants.ts` — Default constants (failure threshold, reset timeout, scope)
- `packages/core/src/concurrency/circuit-breaker.ts` — Circuit breaker factory with CLOSED/OPEN/HALF_OPEN state machine
- `packages/core/src/concurrency/controller.ts` — Concurrency controller factory with latest-wins cancellation via AbortController
- `packages/core/src/concurrency/index.ts` — Barrel exports for concurrency module
- `packages/core/src/concurrency/circuit-breaker.test.ts` — 24 tests for circuit breaker
- `packages/core/src/concurrency/controller.test.ts` — 23 tests for concurrency controller

**Modified files:**

- `packages/core/src/errors/error-codes.ts` — Added FLUI_E028, FLUI_E029, FLUI_E030; added 'concurrency' to ErrorCategory
- `packages/core/src/errors/index.ts` — Exported new error codes
- `packages/core/src/index.ts` — Added concurrency module exports and new error code exports
- `packages/core/src/errors/errors.test.ts` — Updated error code count 27→30, added 'concurrency' category
- `packages/core/src/concurrency/concurrency.types.ts` — Added controller latest-wins scope configuration (`global` or `per-view`)
- `packages/core/src/concurrency/controller.ts` — Implemented scope-aware request cancellation keying and corrected non-cancellation error mapping
- `packages/core/src/concurrency/controller.test.ts` — Added global/per-view scope tests, half-open single-probe verification, provider outage resilience test, and updated error mapping assertions
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Synced story status after code review

### Senior Developer Review (AI)

- Outcome: **Approve**
- High/Medium issues fixed: **6**
- Verification notes:
  - Added explicit latest-wins controller scope config and behavior tests (`global` and `per-view` semantics).
  - Added outage and half-open probe tests to verify blocked repeated calls and single real probe execution.
  - Corrected generic execution error wrapping to avoid mislabeling as cancellation (`FLUI_E014` now used for non-cancel execution failures).
  - Updated story documentation and file list to match actual changes.
