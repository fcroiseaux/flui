# Story 8.4: Testing Package (MockConnector & Assertion Helpers)

Status: done

## Story

As a developer,
I want a testing package with a mock LLM connector and assertion helpers,
So that I can write deterministic tests for my liquid interfaces without needing real LLM API keys.

## Acceptance Criteria

1. **MockConnector implements LLMConnector** (FR54)
   - Implements `LLMConnector` interface from `@flui/core`
   - Returns deterministic, preconfigured responses — no LLM API key required
   - Supports `enqueue(response: LLMResponse)` for FIFO response sequences
   - Supports `enqueueError(error: FluiError)` for failure simulation (timeout, rate limit, network)
   - Calling `generate()` when queue is empty returns `Result.error` with descriptive error
   - Tracks all `generate()` calls for assertion (prompt, options, signal)

2. **UISpecification Builder API** (FR55)
   - Programmatic `UISpecification` generator via builder pattern
   - Builder API creates valid specs: `createSpecBuilder().addComponent(...).withLayout(...).build()`
   - Generated specs pass all built-in validators (schema, component, props)
   - Supports nested children, interactions, and metadata

3. **LiquidView Test Helpers** (FR56)
   - Mount `LiquidView` with `MockConnector` in a single call
   - Assert on rendered output via React Testing Library queries
   - `waitForGeneration()` utility waits for state transitions (generating -> rendering)
   - Access to rendered `UISpecification` for assertion
   - Wraps component in `FluiProvider` with test registry automatically

4. **Package Quality** (NFR-M1)
   - Co-located tests for all components
   - All tests pass with >90% statement coverage
   - Zero new runtime dependencies beyond `@flui/core` peer

## Tasks / Subtasks

- [x] Task 1: MockConnector implementation (AC: #1)
  - [x] 1.1 Create `mock-connector.ts` with `createMockConnector()` factory
  - [x] 1.2 Implement FIFO response queue (`enqueue`, `enqueueError`)
  - [x] 1.3 Implement `generate()` returning queued responses or `Result.error`
  - [x] 1.4 Add call tracking (prompt, options, signal recorded per call)
  - [x] 1.5 Add `reset()` to clear queue and call history
  - [x] 1.6 Create `mock-connector.test.ts` with comprehensive tests
- [x] Task 2: UISpecification Builder (AC: #2)
  - [x] 2.1 Create `spec-builder.ts` with `createSpecBuilder()` factory
  - [x] 2.2 Implement fluent builder API: `addComponent()`, `withLayout()`, `addInteraction()`, `withMetadata()`
  - [x] 2.3 Implement `build()` that returns a valid `UISpecification`
  - [x] 2.4 Add convenience presets: `createMinimalSpec()`, `createSpecWithChildren()`
  - [x] 2.5 Create `spec-builder.test.ts` with validation pass-through tests
- [x] Task 3: LiquidView Test Helpers (AC: #3)
  - [x] 3.1 Create `render-helpers.ts` with `renderLiquidView()` wrapper
  - [x] 3.2 Implement `waitForGeneration()` state transition utility
  - [x] 3.3 Implement test registry with mock components
  - [x] 3.4 Create `render-helpers.test.tsx` verifying mount/assert workflow
- [x] Task 4: Package wiring and exports (AC: #4)
  - [x] 4.1 Update `packages/testing/src/index.ts` barrel exports
  - [x] 4.2 Update `packages/testing/package.json` with required peer/dev dependencies
  - [x] 4.3 Create `testing.types.ts` for public type exports
  - [x] 4.4 Verify all tests pass and coverage >90%

## Dev Notes

### Architecture Compliance

**Package location:** `packages/testing/` — already scaffolded with empty barrel export.

**Module pattern:** Factory functions with closure-based state, matching project convention:
- `createMockConnector()` — not a class, returns `MockConnector` interface
- `createSpecBuilder()` — returns chainable builder object
- `renderLiquidView()` — standalone function

**Result pattern:** All error returns use `Result.error(new FluiError(...))` — never throw.

**Type imports:** Use `import type { ... } from '@flui/core'` for type-only imports. Use value imports only for `FluiError`, `ok`, `err`/`error`, and error code constants.

**TypeScript strictness:** Project uses `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyProperties: true`, `verbatimModuleSyntax: true`. All optional properties must use `| undefined` explicitly.

### Critical Interfaces to Implement Against

**LLMConnector interface** (from `packages/core/src/types.ts`):
```typescript
interface LLMConnector {
  generate(
    prompt: string,
    options: LLMRequestOptions,
    signal?: AbortSignal,
  ): Promise<Result<LLMResponse>>;
}
```

**LLMResponse type:**
```typescript
interface LLMResponse {
  content: string;
  model: string;
  usage: LLMUsage;
}
interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
```

**LLMRequestOptions type:**
```typescript
interface LLMRequestOptions {
  model: string;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  responseFormat?: 'json' | 'text' | undefined;
}
```

**UISpecification** (from `packages/core/src/spec/spec.types.ts`):
```typescript
interface UISpecification {
  version: string;
  components: ComponentSpec[];
  layout: LayoutSpec;
  interactions: InteractionSpec[];
  metadata: UISpecificationMetadata;
}
```

**FluiError** constructor: `new FluiError(code, category, message, options?)`.

**Result helpers:** `ok(value)`, `err(error)` or `error(error)` from `@flui/core`.

### Error Codes

Error codes FLUI_E001 through FLUI_E032 are allocated. The MockConnector should use an appropriate existing code when the queue is empty. Use `FLUI_E009` ("Unsupported operation: attempted operation not supported in current state") for "no more queued responses" since it's a state-dependent operation. If a new testing-specific code is needed, allocate FLUI_E033+ with category `'connector'`.

### Existing Package State

The `@flui/testing` package is already scaffolded:
- `packages/testing/package.json` — configured with `@flui/core` as peer dep, vitest, tsup, typescript
- `packages/testing/src/index.ts` — empty barrel (`export {}`)
- `packages/testing/src/index.test.ts` — placeholder test for empty exports
- `packages/testing/tsconfig.json` — extends `../../tsconfig.base.json`
- `packages/testing/tsup.config.ts` — build configuration

**Current peer dependencies:** `@flui/core: workspace:*` only. For LiquidView test helpers, add `@flui/react`, `react`, and `react-dom` as peer dependencies. Add `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@types/react`, `@types/react-dom` as dev dependencies.

### File Structure

```
packages/testing/src/
├── index.ts                    # Barrel exports (update existing)
├── index.test.ts               # Update placeholder test
├── testing.types.ts             # Public types (MockConnectorOptions, etc.)
├── mock-connector.ts            # createMockConnector() factory
├── mock-connector.test.ts       # MockConnector tests
├── spec-builder.ts              # createSpecBuilder() factory + presets
├── spec-builder.test.ts         # Spec builder tests
├── render-helpers.ts            # renderLiquidView(), waitForGeneration()
└── render-helpers.test.tsx      # Render helper tests (React, needs jsdom)
```

### Testing Standards

- **Framework:** Vitest 4.0.18 with `globals: false` (explicit imports)
- **React testing:** `@testing-library/react` 16.3.2 with `jsdom` environment
- **Pattern:** `describe()` → `it()` blocks with descriptive names
- **Assertions:** `expect()` with specific matchers — no generic `toBeTruthy()`
- **Coverage target:** >90% statement coverage
- **Mock data:** Use factory functions (e.g., `createMockResponse()`) not inline literals
- **Import style:** `import { describe, it, expect, vi } from 'vitest'`

### Vitest Configuration

The testing package needs its own `vitest.config.ts`. Since it has both pure TS tests (mock-connector, spec-builder) and React component tests (render-helpers), use:
```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'jsdom',  // needed for render-helpers
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

### Previous Story Intelligence (from Story 8.3)

**Key learnings from the debug overlay implementation:**
- Props-based data flow — components receive data as props, not from context
- Inline CSSProperties styling — no CSS modules (but not relevant for testing package)
- Test patterns: `createDefaultProps()` factory for test data, `render()` from testing-library, `screen` queries, `fireEvent` for interactions
- Keyboard event testing: use `fireEvent.keyDown(element, { key: 'ArrowRight' })`
- Use `vi.fn()` for mock callbacks, assert with `toHaveBeenCalledWith()`
- 49 tests across 4 test files achieved 96.31% coverage — similar granularity expected here

**Files from story 8.3 that test helpers may interact with:**
- `packages/react/src/LiquidView.tsx` — the component to mount in test helpers
- `packages/react/src/FluiProvider.tsx` — the context provider wrapping LiquidView
- `packages/react/src/renderer/` — component rendering logic
- `packages/react/src/hooks/` — useLiquidView hook with state machine

### Git Intelligence

Recent commit patterns:
- Factory pattern consistency: `createObservabilityCollector()`, `createMetricsReporter()`, `createConcurrencyController()`
- Zero new runtime dependencies per story — only type imports from `@flui/core`
- Test files co-located next to implementation files
- Barrel exports updated in `index.ts` files

### Key Anti-Patterns to AVOID

1. **DO NOT** create a class-based MockConnector — use factory function returning interface
2. **DO NOT** import from internal `@flui/core/src/...` paths — only from `@flui/core` public barrel
3. **DO NOT** add runtime dependencies — `@flui/core` and `@flui/react` are peer deps only
4. **DO NOT** use `any` type — use `unknown` and narrow
5. **DO NOT** throw errors — always return `Result.error()`
6. **DO NOT** skip AbortSignal handling in MockConnector — check `signal?.aborted` before returning
7. **DO NOT** hardcode UISpecification version string — use `'1.0'` as the current spec version
8. **DO NOT** use `@testing-library/react` `act()` manually — `waitFor()` and `findBy*` handle this

### Dependencies Map

**@flui/core imports needed:**
- Types: `LLMConnector`, `LLMResponse`, `LLMUsage`, `LLMRequestOptions`, `Result`, `UISpecification`, `ComponentSpec`, `LayoutSpec`, `InteractionSpec`, `UISpecificationMetadata`, `FluiError`, `FluiErrorCode`, `ErrorCategory`
- Values: `ok`, `err` (or `error`), `FluiError`, `FLUI_E009`, `FLUI_E010`

**@flui/react imports needed (for render-helpers only):**
- `LiquidView`, `FluiProvider`, `LiquidViewProps`, `LiquidViewState`

**Test-only imports:**
- `react`, `react-dom` (for JSX rendering)
- `@testing-library/react` (`render`, `screen`, `waitFor`, `RenderResult`)
- `vitest` (`describe`, `it`, `expect`, `vi`)

### Project Structure Notes

- Alignment with monorepo structure: `packages/testing/` sits alongside `packages/core/` and `packages/react/`
- Build tool: tsup (already configured in `tsup.config.ts`)
- Package manager: pnpm with workspace protocol (`workspace:*`)
- Turbo orchestrates cross-package builds and tests

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 8, Story 8.4]
- [Source: _bmad-output/planning-artifacts/prd.md#FR54, FR55, FR56]
- [Source: _bmad-output/planning-artifacts/architecture.md#@flui/testing module]
- [Source: packages/core/src/types.ts#LLMConnector, LLMResponse, LLMRequestOptions]
- [Source: packages/core/src/spec/spec.types.ts#UISpecification, ComponentSpec, LayoutSpec]
- [Source: packages/core/src/errors/flui-error.ts#FluiError]
- [Source: packages/core/src/errors/result.ts#Result, ok, err]
- [Source: packages/core/src/errors/error-codes.ts#FLUI_E001-FLUI_E032]
- [Source: packages/react/src/LiquidView.tsx#LiquidView, LiquidViewProps]
- [Source: packages/react/src/FluiProvider.tsx#FluiProvider, useFluiContext]
- [Source: _bmad-output/implementation-artifacts/8-3-debug-overlay-spec-and-trace-tabs.md#Dev Notes]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Build DTS error fixed: `FluiProviderProps.children` required in `createElement` — resolved by passing children in props object instead of as third argument.
- `window.matchMedia` not available in jsdom — resolved by adding `test-setup.ts` with mock (matching `@flui/react` pattern).
- `zod` dependency missing for test registry creation — added as devDependency.

### Completion Notes List

- **Task 1 (MockConnector):** Implemented `createMockConnector()` factory with FIFO queue (`enqueue`/`enqueueError`), `generate()` returning Result pattern, call tracking, `reset()`, and AbortSignal handling (FLUI_E010 for aborted, FLUI_E009 for empty queue). 19 tests.
- **Task 2 (Spec Builder):** Implemented `createSpecBuilder()` fluent builder with `addComponent()`, `withLayout()`, `addInteraction()`, `withMetadata()`, `build()`. Added `createMinimalSpec()` and `createSpecWithChildren()` convenience presets. 25 tests.
- **Task 3 (Render Helpers):** Implemented `renderLiquidView()` wrapping LiquidView in FluiProvider with MockConnector, state tracking, and `waitForGeneration()` utility. Added test-setup.ts for jsdom compatibility. 8 tests.
- **Task 4 (Package Wiring):** Updated barrel exports, package.json with peer/dev dependencies (@flui/react, react, react-dom, @testing-library/react, jsdom, zod), created testing.types.ts, vitest.config.ts. 5 barrel tests. Build produces ESM, CJS, and DTS outputs successfully. 100% statement coverage across all source files.
- **Total:** 57 tests, 4 test files, 100% coverage, zero regressions across 906 monorepo tests.
- **Code review follow-up fixes (2026-02-27):** Implemented automatic test registry support via `createTestRegistry()` and optional `components` in `renderLiquidView()`. Added rendered-output RTL assertions and explicit validator pass-through tests for builder specs. Added `@testing-library/react` peer dependency declaration to align runtime usage with package contract.

### File List

- `packages/testing/src/testing.types.ts` (new) — Public types: MockConnector, MockConnectorCall
- `packages/testing/src/mock-connector.ts` (new) — createMockConnector() factory
- `packages/testing/src/mock-connector.test.ts` (new) — 19 tests for MockConnector
- `packages/testing/src/spec-builder.ts` (new) — createSpecBuilder(), createMinimalSpec(), createSpecWithChildren()
- `packages/testing/src/spec-builder.test.ts` (new) — 25 tests for spec builder
- `packages/testing/src/render-helpers.ts` (new) — renderLiquidView(), waitForGeneration()
- `packages/testing/src/render-helpers.test.tsx` (new) — 8 tests for render helpers
- `packages/testing/src/test-setup.ts` (new) — jsdom test setup (matchMedia mock, cleanup)
- `packages/testing/src/index.ts` (modified) — Updated barrel exports
- `packages/testing/src/index.test.ts` (modified) — Updated barrel tests (6 tests)
- `packages/testing/package.json` (modified) — Added peer/dev dependencies
- `packages/testing/vitest.config.ts` (new) — Vitest configuration with jsdom + setup file
- `pnpm-lock.yaml` (modified) — Workspace lockfile updated for package manifest changes
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) — Story status updated

## Change Log

- 2026-02-27: Implemented story 8.4 — @flui/testing package with MockConnector, UISpecification builder, and LiquidView test helpers. 57 tests, 100% coverage, zero regressions.
- 2026-02-27: Code review fixes applied — added automatic test registry helper, strengthened render-helper assertions, added validator pass-through test coverage, and aligned peer dependency declaration for `@testing-library/react`.

## Senior Developer Review (AI)

### Reviewer

Fabrice

### Date

2026-02-27

### Outcome

Approve

### Findings Resolved

- Added automatic test-registry support with `createTestRegistry()` and optional `components` registration path in `renderLiquidView()`.
- Added RTL rendered-output assertions in `render-helpers.test.tsx` to verify actual mounted component content, not only state transitions.
- Added schema + pipeline validator pass-through test in `spec-builder.test.ts` to prove builder-generated specs validate correctly.
- Added `pnpm-lock.yaml` to File List to match actual git changes.
- Declared `@testing-library/react` as a peer dependency to reflect runtime use by exported render helpers.

### Validation Evidence

- `pnpm --filter @flui/testing test` → 61/61 tests passed.
- `pnpm --filter @flui/testing exec tsc --noEmit` → passed.
