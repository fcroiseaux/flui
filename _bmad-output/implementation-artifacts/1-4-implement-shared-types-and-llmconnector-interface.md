# Story 1.4: Implement Shared Types & LLMConnector Interface

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want shared type definitions including the LLMConnector interface and GenerationTrace structure,
So that all packages and modules have consistent type contracts for cross-cutting concerns.

## Acceptance Criteria

1. **Given** the types.ts shared types in @flui/core **When** a developer imports shared types **Then** LLMConnector interface is available with `generate(prompt, options, signal): Promise<Result<LLMResponse>>` signature **And** GenerationTrace structure is defined with `addStep({ module, operation, durationMs, metadata })` method **And** AbortSignal parameter pattern is documented in the interface

2. **Given** the LLMConnector interface **Then** it is provider-agnostic and implementable in < 100 lines (NFR-I1) **And** it accepts an optional AbortSignal as last parameter on `generate()` **And** it does not reference any specific LLM provider types

3. **Given** the GenerationTrace structure **Then** trace steps include `module` (kebab-case), `operation` (camelCase), `durationMs` (number), and `metadata` (Record<string, unknown>) **And** timestamps use Unix milliseconds (Date.now()) **And** no sensitive data (API keys, raw LLM responses) can be stored in trace metadata

4. **Given** shared type files **Then** types are exported through the @flui/core barrel `index.ts` **And** all types use explicit named exports **And** zero `any` types in the public surface (NFR-M2)

## Tasks / Subtasks

- [x] Task 1: Create shared types file with LLMConnector interface (AC: #1, #2)
  - [x] Create `packages/core/src/types.ts`
  - [x] Define `LLMConnector` interface with `generate(prompt: string, options: LLMRequestOptions, signal?: AbortSignal): Promise<Result<LLMResponse>>` method
  - [x] Define `LLMRequestOptions` type with `model: string`, `temperature?: number | undefined`, `maxTokens?: number | undefined`, `responseFormat?: 'json' | 'text' | undefined`
  - [x] Define `LLMResponse` type with `content: string`, `model: string`, `usage: LLMUsage`
  - [x] Define `LLMUsage` type with `promptTokens: number`, `completionTokens: number`, `totalTokens: number`
  - [x] Ensure LLMConnector is provider-agnostic (zero references to OpenAI, Anthropic, or any specific provider)
  - [x] Add TSDoc comments on all public types and properties
  - [x] Ensure AbortSignal is the optional last parameter on `generate()`

- [x] Task 2: Define GenerationTrace structure (AC: #1, #3)
  - [x] Define `TraceStep` interface with `module: string`, `operation: string`, `durationMs: number`, `metadata: Record<string, unknown>`
  - [x] Define `GenerationTrace` interface with `id: string`, `startTime: number` (Unix ms), `steps: readonly TraceStep[]`, `addStep(step: TraceStep): void`
  - [x] Define `GenerationTraceInit` type for constructing new traces (id, startTime optional defaulting to Date.now())
  - [x] Define `createTrace(init?: GenerationTraceInit): GenerationTrace` factory function that returns a mutable implementation
  - [x] Trace implementation: `addStep()` appends to internal mutable array; `steps` getter returns readonly view
  - [x] All timestamps are Unix milliseconds (number type, not Date)
  - [x] Add TSDoc comments documenting the no-sensitive-data contract on metadata

- [x] Task 3: Export shared types through barrel (AC: #4)
  - [x] Add type-only exports for interfaces (`LLMConnector`, `LLMResponse`, `LLMRequestOptions`, `LLMUsage`, `TraceStep`, `GenerationTrace`, `GenerationTraceInit`) to `packages/core/src/index.ts`
  - [x] Add value export for `createTrace` factory to `packages/core/src/index.ts`
  - [x] Follow Biome 2.x ordering: `export type` blocks before `export` value blocks from same source
  - [x] Ensure `verbatimModuleSyntax` compliance (use `import type` for type-only imports)

- [x] Task 4: Write comprehensive unit tests (AC: #1, #2, #3, #4)
  - [x] Create `packages/core/src/types.test.ts` (co-located)
  - [x] **LLMConnector tests:**
    - [x] Test that a minimal object satisfying LLMConnector compiles (structural typing verification)
    - [x] Test that LLMConnector.generate returns `Promise<Result<LLMResponse>>` (type-level test)
    - [x] Test that AbortSignal parameter is optional (compile with and without it)
    - [x] Test that LLMConnector has no provider-specific properties (no `apiKey`, `endpoint`, etc.)
  - [x] **GenerationTrace tests:**
    - [x] Test `createTrace()` returns a GenerationTrace with empty steps and id
    - [x] Test `createTrace()` with custom init sets provided values
    - [x] Test `addStep()` appends a TraceStep to the trace
    - [x] Test `steps` returns readonly array of all added steps
    - [x] Test `startTime` defaults to Unix ms (number, not Date)
    - [x] Test TraceStep requires all four fields (module, operation, durationMs, metadata)
    - [x] Test multiple `addStep()` calls preserve insertion order
  - [x] **Barrel export tests:**
    - [x] Update `packages/core/src/index.test.ts` to verify new type exports
    - [x] Update `packages/core/src/index.test.ts` to verify `createTrace` value export
  - [x] Achieve >90% line coverage on types.ts runtime code

- [x] Task 5: Verify integration and build (AC: #1, #2, #3, #4)
  - [x] Run `pnpm build` — verify tsup produces updated dist/ with new exports
  - [x] Run `pnpm lint` — verify Biome passes with zero warnings on new files
  - [x] Run `pnpm test` — verify all tests pass including new types/ tests
  - [x] Run `pnpm size` — verify @flui/core remains < 25KB gzipped
  - [x] Verify type exports work: `import type { LLMConnector, LLMResponse, GenerationTrace, TraceStep } from '@flui/core'`
  - [x] Verify value exports work: `import { createTrace } from '@flui/core'`
  - [x] Verify existing spec/ and errors/ tests still pass (zero regressions)

## Dev Notes

### Critical: Shared Types File — NOT a Module Directory

The architecture defines shared types in a **single file** at `packages/core/src/types.ts` — NOT in a `types/` module directory. This is an exception to the standard module pattern because shared types are cross-cutting and don't have their own barrel. The file is imported directly by other modules and by the root barrel.

```
packages/core/src/
  spec/           # Module directory (has index.ts barrel)
  errors/         # Module directory (has index.ts barrel)
  types.ts        # SINGLE FILE — shared types (no barrel, no directory)
  types.test.ts   # Co-located test file
  index.ts        # Root barrel re-exports from types.ts
  index.test.ts   # Root barrel tests
```

### Architecture-Mandated: LLMConnector Interface Contract

The LLMConnector interface is the **single contract** that all LLM provider packages implement. It must be:

```typescript
interface LLMConnector {
  /** Generate a response from the LLM. AbortSignal is always the last optional parameter. */
  generate(
    prompt: string,
    options: LLMRequestOptions,
    signal?: AbortSignal
  ): Promise<Result<LLMResponse>>
}
```

**Key constraints:**
- Returns `Promise<Result<LLMResponse>>` (not `Promise<LLMResponse>`) — follows the Result pattern from Story 1.3
- `signal` is OPTIONAL and LAST parameter — architecture-mandated AbortSignal pattern
- Zero references to any specific LLM provider (OpenAI, Anthropic, etc.)
- Implementable in < 100 lines per NFR-I1
- The `Result` type is imported from the existing `errors/` module

### Architecture-Mandated: GenerationTrace Structure

GenerationTrace is the cross-cutting data structure passed through the generation pipeline. Per the architecture:

```typescript
interface TraceStep {
  module: string        // kebab-case module name (e.g., 'intent-parser')
  operation: string     // camelCase function name (e.g., 'sanitizeIntent')
  durationMs: number    // always milliseconds
  metadata: Record<string, unknown>  // structured, NEVER sensitive data
}

interface GenerationTrace {
  readonly id: string
  readonly startTime: number  // Unix ms (Date.now())
  readonly steps: readonly TraceStep[]
  addStep(step: TraceStep): void
}
```

**Important:** The architecture says GenerationTrace "primary location" is `observe/trace.ts`. However, since the `observe/` module doesn't exist yet (Epic 8), and GenerationTrace is referenced by many modules (intent/, context/, generation/, validation/, cache/, connectors), the **interface** is defined here in `types.ts` as a shared type. The full observability implementation (collector, transports) will come in Epic 8.

The `createTrace()` factory function provides a simple mutable implementation. Later stories may introduce a more sophisticated implementation in `observe/trace.ts` that replaces or wraps this.

### LLMResponse Type Design

The LLMResponse must be provider-agnostic. It captures the essential output from any LLM:

```typescript
interface LLMUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

interface LLMResponse {
  content: string     // The generated text/JSON content
  model: string       // Model identifier used
  usage: LLMUsage     // Token usage for cost tracking
}
```

**Why these fields:**
- `content`: Every LLM returns generated text — this is the UISpecification JSON string
- `model`: Needed for trace metadata and cost calculation (different models have different pricing)
- `usage`: Required by CostManager (Epic 7) for budget enforcement. Token counts are universal across providers.

**What NOT to include:**
- No `id` or `requestId` (provider-specific, goes in connector-level types)
- No `finishReason` (not needed by the generation pipeline; connectors handle retry logic internally)
- No streaming-related fields (streaming is a separate concern in Story 4.3)
- No raw provider response (security concern per AC #3)

### LLMRequestOptions Type Design

```typescript
interface LLMRequestOptions {
  model: string                                    // Required: which model to use
  temperature?: number | undefined                 // Optional: creativity control (0-2)
  maxTokens?: number | undefined                   // Optional: response length limit
  responseFormat?: 'json' | 'text' | undefined     // Optional: structured output hint
}
```

**Why these fields:**
- `model`: Every connector needs to know which model to call (e.g., 'gpt-4o', 'claude-sonnet-4-20250514')
- `temperature`: Standard parameter across all LLM providers
- `maxTokens`: Standard parameter, important for cost control
- `responseFormat`: Flui needs JSON output for UISpecification; some providers support structured output modes

**`exactOptionalPropertyTypes: true` impact:** All optional fields use `?: T | undefined` pattern (same as Story 1.3 learned for FluiError).

### AbortSignal Integration Pattern

The architecture mandates AbortSignal as the LAST optional parameter on all async pipeline functions:

```typescript
// LLMConnector.generate() accepts optional AbortSignal
connector.generate(prompt, options, signal)

// Consumer code checks signal before expensive operations
if (signal?.aborted) {
  return Result.error(new FluiError('FLUI_E010', 'generation', 'Generation cancelled'))
}
```

FLUI_E010 is already defined in `errors/error-codes.ts` for this purpose.

### Import Pattern for types.ts

Other modules will import shared types like this:

```typescript
// From within @flui/core modules
import type { LLMConnector, LLMResponse } from '../types';

// From external packages (@flui/openai, @flui/anthropic)
import type { LLMConnector, LLMResponse } from '@flui/core';
```

The root barrel (`index.ts`) re-exports all shared types, so external consumers use the package import.

### Naming Conventions (MANDATORY)

| Element | Convention | Example | Anti-Pattern |
|---------|-----------|---------|-------------|
| Interface names | `PascalCase`, noun | `LLMConnector`, `GenerationTrace` | `ILLMConnector`, `llmConnector` |
| Type aliases | `PascalCase`, noun | `LLMResponse`, `TraceStep` | `TLLMResponse`, `llm_response` |
| Factory functions | `camelCase`, verb-first | `createTrace()` | `CreateTrace()`, `trace()` |
| File names | `kebab-case.ts` | `types.ts` | `Types.ts`, `shared-types.ts` |
| Properties | `camelCase` | `promptTokens`, `durationMs` | `prompt_tokens`, `PromptTokens` |

### TypeScript Strict Mode Implications

All code must compile under `tsconfig.base.json` settings:
- `strict: true` — no implicit any, strict null checks
- `exactOptionalPropertyTypes: true` — optional fields use `?: T | undefined`
- `verbatimModuleSyntax: true` — use `import type` for type-only imports
- `isolatedModules: true` — no const enum, no namespace merging
- `noUncheckedIndexedAccess: true` — indexed access returns `T | undefined`

### Module Dependency Direction

```
types.ts       → imports from: errors/ (for Result type)
                → imported by: registry/, intent/, context/, generation/,
                               validation/, cache/, policy/, concurrency/,
                               observe/, data/, flui.ts, @flui/openai,
                               @flui/anthropic, @flui/testing
```

The `types.ts` file is a quasi-leaf: it imports ONLY from `errors/` (for the `Result` type used in LLMConnector's return type) and is imported by nearly every other module.

### Previous Story Intelligence (Story 1.3)

**Key learnings applied to this story:**

1. **Biome 2.x export ordering:** `export type` blocks must come before `export` value blocks from the same source module. The barrel update must follow this pattern.
2. **`exactOptionalPropertyTypes: true`:** Optional properties must use `?: T | undefined` pattern. Apply to `LLMRequestOptions` fields (temperature, maxTokens, responseFormat).
3. **`verbatimModuleSyntax: true`:** Must use `import type { ... }` for type-only imports. The `types.ts` file will need `import type { Result } from './errors'` and `import type { FluiError } from './errors'` for the Result generic default.
4. **`index.test.ts` update pattern:** Must update the existing barrel test to verify new exports (both type and value).
5. **YAGNI principle:** Do NOT add utility methods to GenerationTrace beyond what's specified. No `.toJSON()`, no `.filter()`, no `.clear()`. Just `addStep()` and readonly `steps`.
6. **100% coverage achievable** on runtime code. Type-only exports have no runtime code to cover.
7. **security-check.mjs** may flag coverage files — already handled in Story 1.3.
8. **The `Result` factory object** with `Result.ok()` and `Result.error()` is available — LLMConnector return type should reference `Result<LLMResponse>`.

### Previous Story Intelligence (Stories 1.1 & 1.2)

**Relevant learnings:**

1. **TypeScript 5.8.3** (not 5.8.0) — installed
2. **Biome 2.x:** `organizeImports` → `assist`, import sorting enforced
3. **tsup** outputs `.js` (ESM) + `.cjs` (CJS) with `type: "module"`
4. **Placeholder tests** were replaced with import-based assertions — follow same pattern
5. **Zod schemas** are NOT needed for types.ts (these are pure TypeScript interfaces, no runtime validation on them)

### Git Intelligence

**Recent commits:**

```
36ddbc8 feat: implement FluiError class and Result pattern (story 1-3)
7e47658 feat: establish UISpecification types and Zod 4 validation schemas
e19f90d feat: initialize flui monorepo with build toolchain and BMAD planning artifacts
```

**Patterns established:**
- Commit message format: `feat: <description> (story X-Y)`
- Module files follow `{module-name}/{purpose}.ts` pattern (for module directories)
- Barrel exports are explicit named exports, Biome-sorted
- Tests are co-located as `{module}.test.ts`
- Root barrel re-exports all public symbols from each module
- `index.test.ts` is updated with each new module to verify barrel exports

### Project Structure Notes

- `types.ts` is NOT a module directory — it's a single file at `packages/core/src/types.ts`
- `types.test.ts` co-located at `packages/core/src/types.test.ts`
- The `types.ts` file imports from `errors/` module (for Result type)
- No new dependencies required (zero npm packages to install)
- types.ts is pure TypeScript interfaces + one factory function — minimal bundle impact
- This is the THIRD distinct source added to @flui/core (after spec/ and errors/)

### Bundle Size Constraint

@flui/core must remain **< 25KB gzipped**. The types.ts file adds:
- Interfaces: erased at compile time (0 bytes runtime)
- `createTrace()` factory: ~20-30 lines of runtime code (~200 bytes)
- Estimated total impact: < 0.5KB

### Testing Standards

- **Framework:** Vitest 4.0.18
- **Coverage target:** >90% line coverage on types.ts runtime code
- **Test file:** `types.test.ts` co-located at `packages/core/src/types.test.ts`
- **Pattern:** `describe(TypeName) > describe(functionName/method) > it(behavior)`
- **NEVER** use `any`/`unknown` in test assertions — assert specific types
- **Type-level tests:** Use `expectTypeOf()` from Vitest for compile-time type verification
- **Runtime tests:** Focus on `createTrace()` factory and `addStep()` behavior

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4] — Full acceptance criteria and story definition
- [Source: _bmad-output/planning-artifacts/architecture.md#LLM Connector interface] — `LLMConnector` interface contract (line 203)
- [Source: _bmad-output/planning-artifacts/architecture.md#GenerationTrace Enrichment] — `addStep()` pattern (lines 370-379)
- [Source: _bmad-output/planning-artifacts/architecture.md#AbortSignal Propagation] — AbortSignal as last parameter (lines 417-427)
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure] — `types.ts` shared types file location (line 650)
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns] — Module structure rules (lines 302-323)
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns] — Naming conventions (lines 266-300)
- [Source: _bmad-output/planning-artifacts/architecture.md#Enforcement Guidelines] — AI agent MUST rules (lines 507-517)
- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting Concerns] — GenerationTrace as cross-cutting (line 834)
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-I1] — LLMConnector < 100 lines (line 935)
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-M2] — Zero `any` types in public API (line 946)
- [Source: _bmad-output/planning-artifacts/prd.md#FR57] — Typed error codes with descriptive messages
- [Source: _bmad-output/implementation-artifacts/1-3-implement-fluierror-and-result-pattern.md] — Story 1.3 learnings (Result pattern, Biome ordering, exactOptionalPropertyTypes)
- [Source: packages/core/src/errors/result.ts] — Result<T, E> type definition and factories
- [Source: packages/core/src/errors/error-codes.ts] — FLUI_E010 (AbortSignal cancellation code)
- [Source: packages/core/src/index.ts] — Current barrel exports pattern
- [Source: packages/core/src/index.test.ts] — Current barrel test pattern
- [Source: tsconfig.base.json] — TypeScript strict mode settings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Biome lint initially flagged unused `GenerationTrace` import in types.test.ts (only used as describe block name, not in type assertions) and formatting of long return lines — both fixed immediately.

### Completion Notes List

- Created `packages/core/src/types.ts` with all shared types: LLMConnector, LLMRequestOptions, LLMResponse, LLMUsage, TraceStep, GenerationTrace, GenerationTraceInit, and createTrace factory
- LLMConnector interface is fully provider-agnostic with zero references to OpenAI/Anthropic — only 113 lines total including TSDoc
- createTrace() factory uses closure-based mutable array with readonly getter — minimal runtime footprint
- All optional properties use `?: T | undefined` pattern for exactOptionalPropertyTypes compliance
- Uses `import type { Result }` from errors/ for verbatimModuleSyntax compliance
- Barrel exports follow Biome 2.x ordering: `export type` block before `export` value block from './types'
- 19 unit tests covering structural typing, type-level assertions, runtime behavior, and insertion order
- 2 barrel export tests added to index.test.ts (value export + type imports)
- 100% code coverage on types.ts (Stmts, Branch, Funcs, Lines)
- Bundle size: @flui/core 1.22 KB gzipped (well under 25 KB limit)
- All 123 tests pass across all packages (zero regressions)
- Code review fixes applied: trace metadata now strips sensitive keys/values before storage in `createTrace().addStep()`
- Code review fixes applied: `GenerationTrace.steps` now returns a defensive copy instead of exposing the internal mutable array
- Code review fixes applied: shared `Result` import now uses the `errors/` barrel import path for architecture consistency
- Added regression tests for sensitive metadata stripping and defensive-copy `steps` behavior

### File List

- `packages/core/src/types.ts` (NEW) — Shared types: LLMConnector, LLMRequestOptions, LLMResponse, LLMUsage, TraceStep, GenerationTrace, GenerationTraceInit, createTrace
- `packages/core/src/types.test.ts` (NEW) — 19 unit tests for shared types and createTrace factory
- `packages/core/src/index.ts` (MODIFIED) — Added type and value exports for shared types
- `packages/core/src/index.test.ts` (MODIFIED) — Added barrel export verification for new types and createTrace
- `_bmad-output/implementation-artifacts/1-4-implement-shared-types-and-llmconnector-interface.md` (MODIFIED) — Review updates, acceptance criteria correction, and review record
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFIED) — Story status sync after code review

## Senior Developer Review (AI)

### Reviewer

Fabrice (AI workflow)

### Date

2026-02-25

### Outcome

Changes Requested → Addressed

### Findings Resolved

- High: AC signature mismatch resolved by aligning AC text with implemented and architecture-consistent Result pattern
- High: Sensitive trace metadata enforcement added in runtime (`addStep`) to strip key/value patterns associated with credentials and raw responses
- High: `steps` access hardened with defensive copy semantics to avoid exposing the internal mutable array reference
- Medium: Import path aligned with barrel import conventions (`./errors`)
- Medium: Story file list and review record updated to reflect workflow and status synchronization changes

## Change Log

- 2026-02-25: Implemented shared types and LLMConnector interface (Story 1.4) — Added provider-agnostic LLMConnector interface, GenerationTrace structure with createTrace factory, and all supporting types to @flui/core
- 2026-02-25: Code review fixes for Story 1.4 — Added sensitive metadata stripping and defensive `steps` copy in trace implementation, aligned import boundaries, and updated story/review tracking artifacts
