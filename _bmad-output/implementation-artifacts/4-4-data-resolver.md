# Story 4.4: Data Resolver

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to define data resolvers that connect data identifiers in generated specifications to actual data sources,
so that generated components can display real data from my application's data layer.

## Acceptance Criteria

1. **Register data resolver** (FR24): Given the `data/` module in `@flui/core`, when a developer registers a data resolver function for a data identifier pattern, then the resolver is stored and available for invocation during spec rendering.

2. **Resolve data identifiers**: Given a `UISpecification` containing data identifier references, when the data resolver is invoked with those identifiers, then it calls the registered resolver functions and returns the resolved data as `Result.ok`, and the resolved data is typed according to the resolver's declared return type.

3. **Missing resolver error**: Given a data identifier that has no registered resolver, when resolution is attempted, then it returns `Result.error` with a `FluiError` indicating an unresolvable data identifier.

4. **Unauthorized identifier rejection** (NFR-S3): Given a data identifier that is not explicitly provided in context, when the resolver attempts to resolve it, then the request is rejected with `Result.error`, and the error details which identifier was unauthorized.

5. **AbortSignal cancellation**: Given data resolution, when an `AbortSignal` is provided and aborted, then pending resolver calls are cancelled and `Result.error` is returned.

6. **Trace enrichment**: The `GenerationTrace` is enriched with data resolution steps (`module: 'data'`, operation, durationMs).

7. **Test coverage**: Co-located tests cover successful resolution, missing resolver, unauthorized identifier rejection, abort handling, and trace enrichment. All tests pass with >90% coverage.

## Tasks / Subtasks

- [x] Task 1: Create data module types (AC: #1, #2)
  - [x] 1.1 Create `packages/core/src/data/data.types.ts` with `DataResolver`, `DataResolverConfig`, `DataResolutionResult`, `DataResolverRegistry` interfaces
  - [x] 1.2 Define `DataIdentifier` type for representing data references in specs
  - [x] 1.3 Define `DataResolverFn` type: `(identifier: string, signal?: AbortSignal) => Promise<Result<unknown>>`

- [x] Task 2: Implement data resolver registry (AC: #1, #3)
  - [x] 2.1 Create `packages/core/src/data/resolver.ts` with `createDataResolverRegistry()` factory
  - [x] 2.2 Implement `register(pattern: string, resolver: DataResolverFn)` method
  - [x] 2.3 Implement pattern matching (exact string match or glob-like patterns)
  - [x] 2.4 Implement `resolve(identifiers: string[], context, trace, signal?)` method

- [x] Task 3: Implement security enforcement (AC: #4, NFR-S3)
  - [x] 3.1 Accept authorized identifier list from context (allowed data sources)
  - [x] 3.2 Reject identifiers not in the authorized list with specific error
  - [x] 3.3 Add error code `FLUI_E018` for unauthorized data identifier
  - [x] 3.4 Add error code `FLUI_E019` for unresolvable data identifier (no resolver found)

- [x] Task 4: Implement AbortSignal support (AC: #5)
  - [x] 4.1 Check signal before starting resolution
  - [x] 4.2 Pass signal through to individual resolver functions
  - [x] 4.3 Check signal between concurrent resolver calls

- [x] Task 5: Implement trace enrichment (AC: #6)
  - [x] 5.1 Add trace step for each resolver invocation: `{ module: 'data', operation: 'resolveIdentifier', durationMs, metadata: { identifier, resolverPattern } }`
  - [x] 5.2 Add aggregate trace step: `{ module: 'data', operation: 'resolveAll', durationMs, metadata: { identifierCount, resolvedCount, rejectedCount } }`

- [x] Task 6: Create barrel exports and integrate (AC: #1)
  - [x] 6.1 Create `packages/core/src/data/index.ts` barrel
  - [x] 6.2 Add data module exports to `packages/core/src/index.ts`
  - [x] 6.3 Add new error codes to `error-codes.ts` and update `DefinedFluiErrorCode` union and `ERROR_CODE_DESCRIPTIONS`
  - [x] 6.4 Update error count test in `errors.test.ts`

- [x] Task 7: Write comprehensive tests (AC: #7)
  - [x] 7.1 Create `packages/core/src/data/data.test.ts`
  - [x] 7.2 Test: Register resolver and resolve identifier successfully
  - [x] 7.3 Test: Resolve multiple identifiers concurrently
  - [x] 7.4 Test: Missing resolver returns `Result.error` with `FLUI_E019`
  - [x] 7.5 Test: Unauthorized identifier returns `Result.error` with `FLUI_E018`
  - [x] 7.6 Test: AbortSignal cancellation at multiple points (pre-check, during resolution)
  - [x] 7.7 Test: Trace enrichment with correct module/operation/metadata
  - [x] 7.8 Test: Resolver function error propagation (resolver throws)
  - [x] 7.9 Test: Empty identifier list returns empty results

## Dev Notes

### Architecture Compliance

**Module location:** `packages/core/src/data/` (per architecture document ADR-002)

**Required files (from architecture):**
```
packages/core/src/data/
  ├── index.ts          # Barrel exports
  ├── resolver.ts       # createDataResolverRegistry() factory
  ├── data.types.ts     # Type definitions
  └── data.test.ts      # Co-located tests
```

**Module dependency rules (from architecture):**
- `data/` can import from: `spec/`, `errors/`
- `data/` MUST NOT import from: `generation/`, `registry/`, `intent/`, `context/`, `validation/`, `cache/`, `policy/`, `concurrency/`, `observe/`
- The `data/` module provides the **core resolver registry** used by `@flui/react`'s renderer (`data-resolver.tsx`) to bind data at render time

### Implementation Patterns (MUST follow)

**Factory function pattern** (established in all previous stories):
```typescript
export function createDataResolverRegistry(config?: DataResolverConfig): DataResolverRegistry {
  // Internal state via closure
  const resolvers = new Map<string, DataResolverFn>();
  return {
    register(pattern, resolver) { ... },
    resolve(identifiers, context, trace, signal?) { ... },
  };
}
```

**Result pattern** (MUST use, never throw):
```typescript
import { ok, err, type Result } from '../errors';
import { FluiError } from '../errors';
import { FLUI_E010, FLUI_E018, FLUI_E019 } from '../errors';
```

**AbortSignal triple-check pattern** (established in stories 4-1, 4-2, 4-3):
1. Before any work: `if (signal?.aborted) return err(new FluiError(FLUI_E010, ...))`
2. Pass signal to resolver functions: `resolver(identifier, signal)`
3. Between concurrent operations: check signal after each resolution completes

**Trace step naming convention** (module: 'data'):
```typescript
trace.addStep({
  module: 'data',
  operation: 'resolveIdentifier', // or 'resolveAll'
  durationMs: duration,
  metadata: { identifier, resolverPattern, success: true }
});
```

**Error wrapping with cause chain:**
```typescript
return err(new FluiError(FLUI_E019, 'generation', `No resolver registered for data identifier: ${identifier}`, {
  context: { identifier }
}));
```

### Security Requirements (NFR-S3 - CRITICAL)

The `DataResolver` MUST reject data identifiers not explicitly provided in context. This is a **security-critical** requirement to prevent LLM-generated specs from accessing unauthorized data.

**Implementation approach:**
- The `resolve()` method accepts an `authorizedIdentifiers: string[]` parameter (derived from the context's allowed data sources)
- Before calling any resolver function, check if the identifier is in the authorized list
- If not authorized, return `Result.error` with `FLUI_E018` immediately
- Log the unauthorized attempt in the trace for audit purposes

### Error Codes to Add

| Code | Category | Description |
|------|----------|-------------|
| `FLUI_E018` | `generation` | Unauthorized data identifier: data identifier not in authorized context |
| `FLUI_E019` | `generation` | Unresolvable data identifier: no resolver registered for the given pattern |

**Note:** The `ErrorCategory` type already includes `'generation'` which is appropriate for data resolution errors. Alternatively, a new `'data'` category could be added - but follow existing patterns: use `'generation'` since data resolution is part of the generation pipeline.

### Concurrent Resolution

When multiple identifiers need resolution:
- Use `Promise.allSettled()` to resolve concurrently
- Each resolver function is independent; one failure should not block others
- Collect all results and return aggregated `Result`:
  - If ALL succeed: `Result.ok` with all resolved data
  - If ANY fail: `Result.error` with aggregated errors listing each failure

### Bundle Size Budget

Current `@flui/core` bundle: **6.77 KB gzipped** (limit: 25 KB). The `data/` module should add minimal overhead (~0.5-1 KB). Keep implementation lean.

### Testing Standards

- **Framework:** Vitest 4.0.18
- **Mock pattern:** `vi.fn()` for resolver functions
- **Import pattern:** Import from barrel `../index` or `../../index`, never internal modules directly
- **Coverage:** >90% statement coverage required
- **Both paths:** Always test `Result.ok` and `Result.error` paths
- **AbortSignal:** Test pre-aborted signal and mid-resolution abort
- **Error codes:** Verify exact error code strings (`FLUI_E018`, `FLUI_E019`)

### Project Structure Notes

- This creates the new `data/` module directory per architecture specification
- No conflicts with existing code - the directory does not exist yet
- The `data/` module aligns with the architecture's 14-module plan for `@flui/core`
- After this story, the `@flui/react` renderer (Epic 6) will consume this module for runtime data binding

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.4: Data Resolver] - User story, acceptance criteria
- [Source: _bmad-output/planning-artifacts/architecture.md#data/ module] - Module structure, file layout, import rules
- [Source: _bmad-output/planning-artifacts/architecture.md#Module Boundary Rules] - `data/` imports: `spec/`, `errors/` only
- [Source: _bmad-output/planning-artifacts/prd.md#FR24] - Resolve data identifiers via developer-defined resolvers
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-S3] - DataResolver rejects unauthorized identifiers
- [Source: _bmad-output/planning-artifacts/prd.md#Security Considerations] - Data identifier enumeration prevention
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-002] - Data Resolution architecture decision
- [Source: packages/core/src/types.ts] - GenerationTrace, TraceStep, createTrace interfaces
- [Source: packages/core/src/errors/error-codes.ts] - Current 17 error codes (FLUI_E001-E017), add E018-E019
- [Source: 4-3-streaming-generation-and-progressive-spec-construction.md] - Previous story patterns, trace conventions

### Previous Story Intelligence

**From Story 4-3 (Streaming Generation):**
- Factory function + closure pattern works well, continue using it
- AbortSignal checked at THREE points minimum
- Trace step naming: module in lowercase, operation in camelCase
- Error cause chaining preserves original error context
- All 300 tests passing, 95.19% coverage - maintain this standard
- Bundle size: 6.77 KB gzipped - keep additions minimal

**From Story 4-2 (Generation Orchestrator):**
- `createTrace()` factory from `types.ts` auto-sanitizes metadata
- Trace steps use `Date.now()` delta for timing
- Error codes are constants exported from `error-codes.ts`

**From Story 4-1 (LLM Connectors):**
- Never include sensitive data in trace metadata
- Error wrapping pattern with cause chaining is standard
- All async functions check AbortSignal pre/post operation

## Change Log

- 2026-02-26: Implemented data resolver module with registry, security enforcement, AbortSignal support, trace enrichment, and comprehensive tests (17 tests). Added error codes FLUI_E018 and FLUI_E019. All 319 tests pass, zero regressions.
- 2026-02-26: Senior code review fixes applied: corrected top-level error code propagation (FLUI_E018/FLUI_E010), switched data module imports to errors barrel, added bounded concurrency behavior using `maxConcurrency`, and strengthened tests. All 320 tests pass.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Trace metadata key `authorized` was stripped by `sanitizeTraceMetadata()` because it matches the sensitive key pattern `/auth/i`. Changed to `allowed` to avoid false positive filtering.

### Completion Notes List

- Created `packages/core/src/data/` module with 4 files: `data.types.ts`, `resolver.ts`, `index.ts`, `data.test.ts`
- Implemented `createDataResolverRegistry()` factory with closure-based state (follows established pattern)
- Security enforcement: `resolve()` accepts `authorizedIdentifiers` parameter; rejects unauthorized identifiers with `FLUI_E018` before calling any resolver
- Pattern matching supports exact strings and glob-like `*` wildcards
- Concurrent resolution now respects `maxConcurrency` in bounded batches while still using `Promise.allSettled()` per batch
- AbortSignal triple-check pattern: pre-check, pass-through to resolvers, post-resolution check
- Trace enrichment: `resolveIdentifier` step per identifier + `resolveAll` aggregate step
- Error codes `FLUI_E018` (unauthorized) and `FLUI_E019` (unresolvable) added to `error-codes.ts`
- Updated `DefinedFluiErrorCode` union, `ERROR_CODE_DESCRIPTIONS`, barrel exports, and error count tests
- Module dependency rules corrected to use `errors/` barrel imports (no deep imports from `errors/*`)
- Top-level aggregated error code now preserves specific failure semantics: `FLUI_E018` for unauthorized-only failures and `FLUI_E010` for cancellation-only failures
- Added bounded concurrency behavior using `maxConcurrency` and covered it with tests
- `DataResolverFn` and `DataResolutionResult` now support generic data typing (`TData`) to align resolver return type declarations
- 18 new tests covering all ACs plus maxConcurrency behavior
- All 320 tests pass (302 existing + 18 new), zero regressions
- Biome linting passes clean

### File List

- `packages/core/src/data/data.types.ts` (new) - Type definitions: DataIdentifier, DataResolverFn, DataResolverConfig, DataResolutionResult, DataResolverRegistry
- `packages/core/src/data/resolver.ts` (new) - createDataResolverRegistry() factory implementation
- `packages/core/src/data/index.ts` (new) - Barrel exports for data module
- `packages/core/src/data/data.test.ts` (new) - 18 comprehensive tests, including `maxConcurrency` limit behavior and corrected top-level error assertions
- `packages/core/src/errors/error-codes.ts` (modified) - Added FLUI_E018, FLUI_E019, updated DefinedFluiErrorCode and ERROR_CODE_DESCRIPTIONS
- `packages/core/src/errors/index.ts` (modified) - Added FLUI_E018, FLUI_E019 exports
- `packages/core/src/errors/errors.test.ts` (modified) - Updated error count from 17 to 19
- `packages/core/src/index.ts` (modified) - Added data/ module exports and FLUI_E018, FLUI_E019 exports
- `_bmad-output/implementation-artifacts/4-4-data-resolver.md` (modified) - Updated status, review notes, changelog, and file list after senior review fixes
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) - Synced story status `4-4-data-resolver` to `done`

## Senior Developer Review (AI)

### Reviewer

Fabrice

### Date

2026-02-26

### Outcome

Changes Requested (addressed in this review pass)

### Findings Fixed

- HIGH: Unauthorized identifier failures were masked as `FLUI_E019`; fixed to preserve `FLUI_E018` when failures are unauthorized-only.
- HIGH: Cancellation failures were masked as `FLUI_E019`; fixed to preserve `FLUI_E010` when failures are cancellation-only.
- HIGH: Data resolver typing did not carry declared resolver return typing; introduced `TData` generics for resolver function/result types.
- MEDIUM: `data/` module used deep imports from `errors/*`; switched to barrel imports from `../errors`.
- MEDIUM: `maxConcurrency` config was unused; implemented bounded concurrent resolution with batched `Promise.allSettled()`.
- MEDIUM: Story file list did not reflect documentation artifacts changed in git; updated file list and synced sprint status.

### Validation Evidence

- `pnpm test` in `packages/core` passes: 13 files, 320 tests, 0 failures.
