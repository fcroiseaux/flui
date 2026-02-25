# Story 3.3: Custom Context Providers and Context Aggregation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to register custom context providers and have all signals aggregated into a unified context object,
So that I can supply domain-specific context (e.g., tenant config, feature flags) that influences UI generation.

## Acceptance Criteria

### AC #1 — Custom Provider Registration

- **Given** the context/ module in @flui/core
- **When** a developer registers a custom context provider implementing the `ContextProvider<T>` interface
- **Then** the provider is added to the context engine's provider list
- **And** registration returns `Result.ok` confirming success

### AC #2 — Multi-Provider Context Aggregation

- **Given** a context engine with multiple registered providers (built-in + custom)
- **When** context resolution is triggered
- **Then** all providers are invoked concurrently and their outputs combined into a single unified `AggregatedContext`
- **And** the result is returned as `Result.ok(AggregatedContext)` containing all provider outputs keyed by provider name

### AC #3 — Partial Failure Handling

- **Given** context aggregation with multiple providers
- **When** one provider fails
- **Then** the aggregation returns `Result.error` with details about which provider failed
- **And** successfully resolved contexts from other providers are included in the error's context record for developer debugging
- **And** partial context is NEVER applied to generation downstream (zero-bypass principle)

### AC #4 — AbortSignal Propagation

- **Given** context aggregation
- **When** an AbortSignal is provided
- **Then** the signal is propagated to all providers
- **And** if aborted, pending providers are cancelled and the operation returns `Result.error` with FLUI_E010

### AC #5 — Duplicate Provider Rejection

- **Given** custom provider registration
- **When** a provider with a duplicate name is registered
- **Then** registration returns `Result.error` indicating a name conflict

### AC #6 — AggregatedContext Type and Structure

- **Given** the context/ module
- **Then** `context.types.ts` defines an `AggregatedContext` type:
  - `Record<string, ContextData>` — keyed by provider name, values are provider outputs
- **And** `ContextEngine` interface with:
  - `registerProvider(provider: ContextProvider): Result<void>` — synchronous registration
  - `resolveAll(signal?: AbortSignal): Promise<Result<AggregatedContext>>` — concurrent resolution
  - `getProviderNames(): string[]` — list registered provider names

### AC #7 — New Error Code

- **Given** a duplicate provider registration attempt
- **Then** the error uses a NEW error code `FLUI_E013` with category `'context'`
- **And** the error message includes the conflicting provider name

### AC #8 — Test Coverage

- **Given** the context/ module source files
- **Then** `context.test.ts` is extended with tests covering:
  - Multi-provider aggregation (built-in + custom) — success path
  - Partial failure scenarios — one provider fails, others succeed
  - AbortSignal cancellation during aggregation
  - Duplicate provider name rejection
  - Empty engine (no providers registered) returns empty `AggregatedContext`
  - Provider ordering is non-deterministic (concurrent resolution)
- **And** all tests pass with >90% coverage on the context/ module

## Tasks / Subtasks

- [x] Task 1: Add error code FLUI_E013 (AC: #5, #7)
  - [x] 1.1 Add `FLUI_E013` constant to `error-codes.ts`: `"Duplicate context provider: a provider with this name is already registered"`
  - [x] 1.2 Add `FLUI_E013` to `DefinedFluiErrorCode` union type
  - [x] 1.3 Add `FLUI_E013` to `ERROR_CODE_DESCRIPTIONS` map
  - [x] 1.4 Update `packages/core/src/errors/index.ts` barrel to export `FLUI_E013`
  - [x] 1.5 Update `packages/core/src/index.ts` barrel to add `FLUI_E013` to errors export block

- [x] Task 2: Add new types to `context.types.ts` (AC: #2, #6)
  - [x] 2.1 Define `AggregatedContext` type: `Record<string, ContextData>`
  - [x] 2.2 Define `ContextEngine` interface with three methods:
    - `registerProvider(provider: ContextProvider): Result<void>` (synchronous)
    - `resolveAll(signal?: AbortSignal): Promise<Result<AggregatedContext>>` (async)
    - `getProviderNames(): string[]` (synchronous)

- [x] Task 3: Create `context-engine.ts` — ContextEngine implementation (AC: #1, #2, #3, #4, #5)
  - [x] 3.1 Create `packages/core/src/context/context-engine.ts`
  - [x] 3.2 Implement `createContextEngine(): ContextEngine` factory function that returns a `ContextEngine` implementation
  - [x] 3.3 Internal state: `Map<string, ContextProvider>` for registered providers
  - [x] 3.4 `registerProvider(provider)`:
    - Check `provider.name` is non-empty string; if empty → return `err(new FluiError(FLUI_E005, 'validation', ...))`
    - Check duplicate name in Map; if duplicate → return `err(new FluiError(FLUI_E013, 'context', ...))`
    - Store in Map → return `ok(undefined)`
  - [x] 3.5 `resolveAll(signal?)`:
    - If `signal?.aborted` → return `err(new FluiError(FLUI_E010, 'context', 'Context aggregation cancelled'))`
    - If no providers registered → return `ok({})` (empty AggregatedContext)
    - Create `Promise.allSettled()` for all provider `resolve(signal)` calls (concurrent)
    - After settlement, check `signal?.aborted` → return `err(FLUI_E010)` if aborted
    - Iterate results: collect successes into `AggregatedContext` keyed by provider name
    - If ANY provider returned `Result.error` → return `err(new FluiError(FLUI_E011, 'context', ...))` with context record including which provider(s) failed AND successful results for debugging
    - If all succeeded → return `ok(aggregatedContext)`
  - [x] 3.6 `getProviderNames()`: return `Array.from(providers.keys())`
  - [x] 3.7 Ensure factory function is pure — each call produces independent ContextEngine with own state

- [x] Task 4: Update `context/index.ts` barrel (AC: all)
  - [x] 4.1 Add type export: `AggregatedContext`, `ContextEngine` (from `./context.types`)
  - [x] 4.2 Add value export: `createContextEngine` (from `./context-engine`)
  - [x] 4.3 Maintain alphabetical ordering of exports (Biome requirement)

- [x] Task 5: Update `packages/core/src/index.ts` — package barrel (AC: all)
  - [x] 5.1 Add type exports: `AggregatedContext`, `ContextEngine` in context/ type export block
  - [x] 5.2 Add value export: `createContextEngine` in context/ value export block
  - [x] 5.3 Add `FLUI_E013` to errors/ value export block
  - [x] 5.4 Maintain alphabetical ordering

- [x] Task 6: Extend `context.test.ts` with aggregation tests (AC: #8)
  - [x] 6.1 `describe('createContextEngine')`:
    - [x] 6.1.1 Test: `getProviderNames()` returns empty array initially
    - [x] 6.1.2 Test: `registerProvider` returns `Result.ok` for valid provider
    - [x] 6.1.3 Test: `registerProvider` returns FLUI_E013 for duplicate name
    - [x] 6.1.4 Test: `registerProvider` returns FLUI_E005 for empty provider name
  - [x] 6.2 `describe('resolveAll')`:
    - [x] 6.2.1 Test: empty engine (no providers) → `Result.ok({})` (empty object)
    - [x] 6.2.2 Test: single custom provider → `Result.ok({ 'provider-name': data })`
    - [x] 6.2.3 Test: multiple providers (identity + environment + custom) → all keyed in result
    - [x] 6.2.4 Test: partial failure — one provider fails → `Result.error` with FLUI_E011 and context including successful results
    - [x] 6.2.5 Test: all providers fail → `Result.error` with FLUI_E011
    - [x] 6.2.6 Test: AbortSignal already aborted → `Result.error` with FLUI_E010
    - [x] 6.2.7 Test: AbortSignal aborted during resolution → `Result.error` with FLUI_E010
    - [x] 6.2.8 Test: providers are called concurrently (not sequentially) — verify via timing
  - [x] 6.3 Update error test for `ERROR_CODE_DESCRIPTIONS has exactly N entries` → 13 (from 12)

- [x] Task 7: Build verification (AC: all)
  - [x] 7.1 `pnpm build` — must succeed, check bundle size stays < 25KB gzipped
  - [x] 7.2 `pnpm test` — all tests pass (existing 232 + new aggregation tests)
  - [x] 7.3 `pnpm lint` — Biome clean (zero errors)

## Dev Notes

### Module Location

`packages/core/src/context/`

### Files to Create

```
packages/core/src/context/
  context-engine.ts       # ContextEngine implementation with createContextEngine() factory
```

### Files to Modify

```
packages/core/src/context/context.types.ts    # Add AggregatedContext, ContextEngine types
packages/core/src/context/context.test.ts     # Extend with aggregation tests
packages/core/src/context/index.ts            # Export new symbols
packages/core/src/errors/error-codes.ts       # Add FLUI_E013
packages/core/src/errors/index.ts             # Export FLUI_E013
packages/core/src/errors/errors.test.ts       # Update error code count assertion
packages/core/src/index.ts                    # Add new exports to package barrel
```

### Architecture-Defined Context Engine

The architecture document defines context aggregation as a core step in the generation pipeline:

```
generateUI()
├── intent/ (Parse and sanitize intent)
├── context/ (CONTEXT AGGREGATION STEP)    ← This story
│   ├── Invoke registered providers
│   ├── Merge all context sources
│   └── Validate aggregated context
├── generation/prompt-builder (Use aggregated context in prompt)
└── ...
```

The context engine is consumed by `generation/` module (Epic 4) which imports from `context/` barrel.

### Module Boundary Rules

```
context/       → imports errors/ (ONLY)
generation/    → imports context/ (downstream, not this story)
```

- The context module may ONLY import from `../errors` (barrel import)
- Zod is available as sole runtime dependency
- Internal files import within module (e.g., `./context.types`, `./context-engine`)
- `createContextEngine` is a standalone factory — it does NOT automatically register built-in providers. Built-in providers are registered explicitly by the consuming code (generation/ module or developer app)

### Error Codes

| Error Code | When to Use | Category |
|-----------|-------------|----------|
| `FLUI_E010` | AbortSignal triggered cancellation during aggregation | `'context'` |
| `FLUI_E011` | Context resolution failed: one or more providers returned error during `resolveAll` | `'context'` |
| `FLUI_E013` | Duplicate context provider name on registration | `'context'` |
| `FLUI_E005` | Invalid provider (empty name, schema validation failure) | `'validation'` |

### FluiError Construction Patterns

```typescript
import { FluiError, FLUI_E005, FLUI_E010, FLUI_E011, FLUI_E013, ok, err } from '../errors';
import type { Result } from '../errors';

// Duplicate provider name
return err(new FluiError(FLUI_E013, 'context', `Duplicate context provider: '${provider.name}' is already registered`));

// AbortSignal during aggregation
return err(new FluiError(FLUI_E010, 'context', 'Context aggregation cancelled'));

// Provider failure during resolveAll — include successful results for debugging
return err(new FluiError(FLUI_E011, 'context', `Context aggregation failed: provider '${failedName}' returned an error`, {
  context: { failedProviders: ['tenant'], successfulResults: { identity: {...}, environment: {...} } },
}));

// Invalid provider (empty name)
return err(new FluiError(FLUI_E005, 'validation', 'Provider name must be a non-empty string'));
```

### ContextEngine Design Pattern

```typescript
// Creating an engine and registering providers
const engine = createContextEngine();

// Register built-in providers
const r1 = engine.registerProvider(createIdentityProvider({ role: 'admin', permissions: ['read'], expertiseLevel: 'expert' }));
const r2 = engine.registerProvider(createEnvironmentProvider({ deviceType: 'desktop', viewportSize: { width: 1920, height: 1080 }, connectionQuality: 'fast' }));

// Register custom provider
const tenantProvider: ContextProvider<ContextData> = {
  name: 'tenant',
  async resolve(signal?: AbortSignal): Promise<Result<ContextData>> {
    if (signal?.aborted) return err(new FluiError(FLUI_E010, 'context', 'Cancelled'));
    return ok({ tenantId: 'acme', featureFlags: ['dark-mode', 'beta-ui'] });
  },
};
const r3 = engine.registerProvider(tenantProvider);

// Resolve all context
const result = await engine.resolveAll(signal);
if (isOk(result)) {
  // result.value = {
  //   identity: { role: 'admin', permissions: ['read'], expertiseLevel: 'expert' },
  //   environment: { deviceType: 'desktop', viewportSize: {...}, connectionQuality: 'fast' },
  //   tenant: { tenantId: 'acme', featureFlags: ['dark-mode', 'beta-ui'] },
  // }
}
```

### Concurrency: Promise.allSettled, NOT Promise.all

Use `Promise.allSettled()` for concurrent provider resolution because:
1. We need ALL results even when some fail (for debugging context in error)
2. `Promise.all()` would short-circuit on first rejection — we'd lose successful results
3. Each provider returns `Result<T>` (never throws), but `allSettled` is safer against unexpected throws
4. After `allSettled`, scan results: if any provider returned `Result.error`, the entire aggregation fails

### AbortSignal Implementation in resolveAll

```typescript
async resolveAll(signal?: AbortSignal): Promise<Result<AggregatedContext>> {
  // Check 1: Before resolution
  if (signal?.aborted) {
    return err(new FluiError(FLUI_E010, 'context', 'Context aggregation cancelled'));
  }

  if (providers.size === 0) return ok({});

  // Concurrent resolution of all providers — pass signal to each
  const entries = Array.from(providers.entries());
  const settled = await Promise.allSettled(
    entries.map(([, provider]) => provider.resolve(signal))
  );

  // Check 2: After resolution (cooperative cancellation)
  if (signal?.aborted) {
    return err(new FluiError(FLUI_E010, 'context', 'Context aggregation cancelled'));
  }

  // Process results
  const aggregated: AggregatedContext = {};
  const failures: Array<{ name: string; error: FluiError }> = [];

  for (let i = 0; i < entries.length; i++) {
    const [name] = entries[i]!;
    const settlement = settled[i]!;

    if (settlement.status === 'rejected') {
      // Unexpected throw from provider (should never happen with Result pattern)
      failures.push({ name, error: new FluiError(FLUI_E011, 'context', `${name} provider threw unexpectedly: ${settlement.reason}`) });
    } else {
      const result = settlement.value;
      if (isOk(result)) {
        aggregated[name] = result.value;
      } else {
        failures.push({ name, error: result.error });
      }
    }
  }

  if (failures.length > 0) {
    return err(new FluiError(
      FLUI_E011,
      'context',
      `Context aggregation failed: ${failures.map(f => `'${f.name}'`).join(', ')} provider(s) returned errors`,
      { context: { failedProviders: failures.map(f => f.name), successfulResults: aggregated } },
    ));
  }

  return ok(aggregated);
}
```

### TypeScript Strictness Requirements

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- Zero `any` — use `unknown` where needed
- Use `import type` for type-only imports (`verbatimModuleSyntax: true`)
- The `entries[i]!` and `settled[i]!` non-null assertions are acceptable since indices are guaranteed to match (same loop range). If Biome flags them, extract via `for...of` with index tracking instead

### Naming Conventions

| Element | Convention | This Story |
|---------|-----------|-----------|
| New source file | `kebab-case.ts` | `context-engine.ts` |
| Interface | `PascalCase` | `ContextEngine`, `AggregatedContext` |
| Factory function | `camelCase`, verb-first | `createContextEngine()` |
| Error constant | `SCREAMING_SNAKE_CASE` | `FLUI_E013` |

### Testing Pattern

```typescript
import { describe, expect, it } from 'vitest';
import {
  createContextEngine,
  createIdentityProvider,
  createEnvironmentProvider,
} from './index';
import type { AggregatedContext, ContextEngine, ContextProvider, ContextData } from './index';
import { isOk, isError, ok, err, FLUI_E005, FLUI_E010, FLUI_E011, FLUI_E013, FluiError } from '../errors';

// Helper: create a simple custom provider for testing
function createTestProvider(name: string, data: ContextData): ContextProvider {
  return {
    name,
    async resolve(signal?: AbortSignal) {
      if (signal?.aborted) return err(new FluiError(FLUI_E010, 'context', 'Cancelled'));
      return ok(data);
    },
  };
}

// Helper: create a failing provider for testing
function createFailingProvider(name: string, errorMessage: string): ContextProvider {
  return {
    name,
    async resolve() {
      return err(new FluiError(FLUI_E011, 'context', errorMessage));
    },
  };
}
```

### Cross-Story Context

- **Story 3.1** (Parse Text & Structured Intents) — done; independent intent/ module. No interaction with context/
- **Story 3.2** (Built-in Context Providers) — done; created `ContextProvider<T>` interface, `createProvider()` factory, built-in providers, error codes FLUI_E011/E012. This story builds directly on those foundations
- **Story 4.2** (Prompt Construction & Generation Orchestrator) — downstream consumer; will create a `ContextEngine`, register providers, call `resolveAll()`, and pass `AggregatedContext` to prompt builder
- **Epic 7** (Caching) — cache key includes context: `hash(intent + context + registryVersion + specVersion)`. The `AggregatedContext` record must be JSON-serializable for deterministic cache key hashing. `Record<string, ContextData>` satisfies this since `ContextData = Record<string, unknown>` (JSON-compatible)

### Project Structure Notes

- New file `context-engine.ts` created within existing `context/` module — follows module pattern
- No new subdirectories needed
- Module boundary preserved: only imports from `../errors` barrel
- No new npm dependencies required — uses existing Zod 4.3.6
- All 232 existing tests must continue to pass (zero regressions)
- `registerProvider()` is SYNCHRONOUS (no async validation needed — just name uniqueness check on a Map)
- `resolveAll()` is ASYNC (concurrent provider resolution via `Promise.allSettled`)

### Previous Story Intelligence (Story 3-2: Built-in Context Providers)

**Key learnings from Story 3-2:**

- `IdentityContext` and `EnvironmentContext` must extend `ContextData` (`Record<string, unknown>`) — TypeScript constraint satisfaction issue encountered and fixed
- Existing error test checks exact count of `ERROR_CODE_DESCRIPTIONS` entries — MUST update from 12 to 13 when adding FLUI_E013
- Biome auto-fix needed for import ordering — run `pnpm lint --write` after implementation
- `z.treeifyError()` is the correct Zod error formatting function (not `flatten()`)
- Build output after 3-2: ESM+CJS, @flui/core 4.05 kB minified+gzipped — well within 25KB budget
- All 232 tests passing — must not regress
- Code review found: dynamic `import('zod')` in hot path was flagged — use static imports only
- Coverage >90% on module required for AC

**Patterns to replicate:**

- `FluiError` uses positional args: `new FluiError(FLUI_E013, 'context', 'message')`
- Optional 4th arg for context/cause: `new FluiError(code, cat, msg, { context: { ... } })`
- `ok(value)` for success, `err(new FluiError(...))` for failure
- Tests import from `'./index'` (barrel), never from internal files
- Import `isOk, isError` from `'../errors'` for type guards in tests

### Git Intelligence

Recent commits (pattern: `feat: <description> (story X-Y)`):

```
1d02118 feat: implement built-in context providers for identity and environment (story 3-2)
1bc6030 feat: implement text and structured intent parsing with sanitization (story 3-1)
7ed5944 feat: implement registry serialization for LLM prompts (story 2-3)
```

Expected commit message: `feat: implement custom context providers and context aggregation (story 3-3)`

### Latest Technical Information

**Zod 4.3.6 (current project version):**

- `z.strictObject()` rejects unknown keys — used for context schemas
- `z.treeifyError(error)` for structured error formatting
- `schema.safeParse(data)` returns `{ success: true, data } | { success: false, error }`
- No new Zod features needed for this story (aggregation is pure TypeScript logic)

**TypeScript 5.8.3:**

- `Record<string, ContextData>` requires `noUncheckedIndexedAccess` — accessing `result[key]` returns `ContextData | undefined`
- `Promise.allSettled()` fully typed — no issues with settled result inference
- No known issues with the patterns used in this story

### Build Verification

After implementation, verify:

```bash
pnpm build          # Must succeed, check bundle size stays < 25KB gzipped
pnpm test           # All tests pass (existing 232 + new context engine tests)
pnpm lint           # Biome clean (zero errors)
```

Current: @flui/core 4.05 kB minified+gzipped. Context engine should add ~1-2KB.

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 3, Story 3.3: Custom Context Providers and Context Aggregation]
- [Source: _bmad-output/planning-artifacts/prd.md — FR5: Register custom context providers that supply domain-specific context signals]
- [Source: _bmad-output/planning-artifacts/prd.md — FR6: Combine multiple context signals into a unified context object for generation]
- [Source: _bmad-output/planning-artifacts/architecture.md — Context Engine module, generation pipeline data flow]
- [Source: _bmad-output/planning-artifacts/architecture.md — Module Boundaries: context/ → imports errors/]
- [Source: _bmad-output/planning-artifacts/architecture.md — Cache key: hash(intent + context + registryVersion + specVersion)]
- [Source: _bmad-output/planning-artifacts/architecture.md — Generation Pipeline: context aggregation step]
- [Source: _bmad-output/planning-artifacts/architecture.md — Result Pattern and FluiError construction]
- [Source: _bmad-output/planning-artifacts/architecture.md — AbortSignal Propagation pattern]
- [Source: _bmad-output/implementation-artifacts/3-2-built-in-context-providers-identity-and-environment.md — Previous Story Intelligence]
- [Source: packages/core/src/context/context.types.ts — ContextProvider<T>, ContextData, ContextResolver<T> interfaces]
- [Source: packages/core/src/context/context.ts — createProvider<T>() factory pattern]
- [Source: packages/core/src/context/index.ts — Current module barrel exports]
- [Source: packages/core/src/errors/error-codes.ts — Error codes FLUI_E001–FLUI_E012, ErrorCategory type]
- [Source: packages/core/src/errors/index.ts — Errors barrel exports]
- [Source: packages/core/src/index.ts — Package barrel with context/ and errors/ exports]

## Change Log

- 2026-02-25: Implemented custom context providers and context aggregation — created ContextEngine with createContextEngine() factory, AggregatedContext type, FLUI_E013 error code, 13 new tests (245 total, zero regressions), Biome clean, bundle 6.5KB gzipped
- 2026-02-25: Code review fixes applied — made resolveAll abort-aware during pending aggregation, aligned concurrency test with non-deterministic completion order, tightened provider-name validation for whitespace-only names, and synchronized story documentation with actual changed files

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- No debug issues encountered. All tasks completed in single pass.
- Biome import ordering required fix after initial implementation (expected per Story 3-2 learnings).
- Used guard-based null checks instead of non-null assertions for `noUncheckedIndexedAccess` compliance.

### Completion Notes List

- Task 1: Added FLUI_E013 error code constant, union type member, description, and barrel exports across errors/ and package-level index.ts. Updated error test count assertion from 12 to 13.
- Task 2: Added `AggregatedContext` type alias (`Record<string, ContextData>`) and `ContextEngine` interface with `registerProvider`, `resolveAll`, `getProviderNames` methods to context.types.ts.
- Task 3: Created `context-engine.ts` with `createContextEngine()` factory. Implementation uses `Map<string, ContextProvider>` for state, synchronous registration with name validation (FLUI_E005 for empty, FLUI_E013 for duplicate), async `resolveAll` with `Promise.allSettled` for concurrent resolution, dual AbortSignal checks (before and after resolution), and error aggregation with successful results included in error context for debugging.
- Task 4: Updated context/index.ts barrel with AggregatedContext, ContextEngine type exports and createContextEngine value export. Fixed Biome import ordering.
- Task 5: Updated packages/core/src/index.ts with AggregatedContext, ContextEngine type exports, createContextEngine and FLUI_E013 value exports.
- Task 6: Added 14 new tests covering: empty engine, provider registration (success, duplicate, empty name, whitespace-only name), resolveAll (empty, single, multi-provider, partial failure with context, all-fail, AbortSignal pre-aborted, AbortSignal mid-resolution, concurrency verification via timing), and independent engine isolation.
- Task 7: Build succeeds (ESM 23.52KB, CJS 26.82KB). All 246 tests pass (232 existing + 14 new). Biome lint clean (zero errors).
- Review fixes: `resolveAll()` now returns FLUI_E010 as soon as an abort event is observed while providers are still pending, whitespace-only provider names are rejected with FLUI_E005, and concurrency test assertions no longer assume deterministic completion order.
- Review documentation sync: updated this story's File List to include all changed source and tracking files from the review/fix pass.

### File List

- packages/core/src/context/context-engine.ts (created)
- packages/core/src/context/context.types.ts (modified)
- packages/core/src/context/context.test.ts (modified)
- packages/core/src/context/index.ts (modified)
- packages/core/src/errors/error-codes.ts (modified)
- packages/core/src/errors/index.ts (modified)
- packages/core/src/errors/errors.test.ts (modified)
- packages/core/src/index.ts (modified)
- _bmad-output/implementation-artifacts/3-3-custom-context-providers-and-context-aggregation.md (modified)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)
