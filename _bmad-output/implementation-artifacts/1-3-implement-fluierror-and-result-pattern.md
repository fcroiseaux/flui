# Story 1.3: Implement FluiError & Result Pattern

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want typed error handling with FluiError codes and a Result pattern,
So that every module returns predictable, structured errors instead of throwing exceptions.

## Acceptance Criteria

1. **Given** the errors/ module in @flui/core **When** a developer creates a FluiError **Then** it extends Error with code (FLUI_E001–FLUI_E099), category (validation | generation | cache | connector | config), optional context record, and optional cause error **And** this story defines initial error codes FLUI_E001–FLUI_E010 for startup, config, and type errors; remaining codes are reserved for allocation by later stories

2. **Given** an async public API function in any module **When** it completes successfully **Then** it returns Result.ok(value) with the typed value

3. **Given** an async public API function in any module **When** it encounters an error **Then** it returns Result.error(fluiError) with a structured FluiError (never throws)

4. **Given** a sync configuration function **When** it receives invalid config **Then** it throws a FluiError (programmer error at startup, per NFR-R6) **And** the error message is descriptive with the specific misconfiguration

5. **Given** a common misconfiguration (e.g., missing fallback prop) **When** TypeScript compiles the code **Then** a compilation error is emitted guiding the developer to fix it (FR58)

6. **Given** the errors/ module source files **Then** `flui-error.ts` contains FluiError class **And** `error-codes.ts` contains FluiErrorCode literals, ErrorCategory type, and all error code constants **And** `result.ts` contains Result type and factory functions **And** `errors.test.ts` contains co-located tests covering ok and error paths **And** zero `any` types in the public API

## Tasks / Subtasks

- [x] Task 1: Create errors module directory and barrel (AC: #6)
  - [x] Create `packages/core/src/errors/` directory
  - [x] Create `packages/core/src/errors/index.ts` barrel with explicit named exports (no `export *`, no `export default`)
  - [x] Update `packages/core/src/index.ts` to re-export public symbols from `errors/`

- [x] Task 2: Define error code types and constants (AC: #1)
  - [x] Create `packages/core/src/errors/error-codes.ts`
  - [x] Define `ErrorCategory` type as string literal union: `'validation' | 'generation' | 'cache' | 'connector' | 'config'`
  - [x] Define `FluiErrorCode` type as string literal union for codes FLUI_E001–FLUI_E010 (with extensible pattern for future codes)
  - [x] Define individual error code constants with descriptive names:
    - `FLUI_E001` — Invalid configuration: malformed or unrecognized config object
    - `FLUI_E002` — Missing required configuration: a mandatory config field is absent
    - `FLUI_E003` — Invalid intent: empty, malformed, or unsanitizable intent string
    - `FLUI_E004` — Type validation failed: runtime value does not match expected type
    - `FLUI_E005` — Schema validation failed: Zod schema validation rejected input
    - `FLUI_E006` — Component not found: referenced component not in registry
    - `FLUI_E007` — Invalid component props: props do not satisfy component schema
    - `FLUI_E008` — Initialization failed: module or subsystem failed to initialize
    - `FLUI_E009` — Unsupported operation: attempted operation not supported in current state
    - `FLUI_E010` — Operation cancelled: AbortSignal triggered cancellation
  - [x] Export an `ERROR_CODE_DESCRIPTIONS` record mapping each code to its human-readable description
  - [x] Ensure all constants use `SCREAMING_SNAKE_CASE` naming and are `as const` literals

- [x] Task 3: Implement FluiError class (AC: #1, #4)
  - [x] Create `packages/core/src/errors/flui-error.ts`
  - [x] Implement `FluiError` class extending `Error`:
    - `readonly code: FluiErrorCode` — string literal error code
    - `readonly category: ErrorCategory` — error category
    - `readonly context?: Record<string, unknown>` — optional structured metadata (never sensitive data)
    - `readonly cause?: Error` — optional original error if wrapping
  - [x] Constructor takes `(code, category, message, options?: { context?, cause? })`
  - [x] Set `this.name = 'FluiError'` for proper error identification
  - [x] Ensure `instanceof FluiError` works correctly (prototype chain)
  - [x] Implement `toJSON()` method for structured serialization (code, category, message, context — never serializes cause stack)
  - [x] All properties are `readonly` — FluiError is immutable after creation

- [x] Task 4: Implement Result type and factory functions (AC: #2, #3)
  - [x] Create `packages/core/src/errors/result.ts`
  - [x] Define `Result<T, E = FluiError>` discriminated union type:
    - `{ ok: true; value: T }` for success
    - `{ ok: false; error: E }` for failure
  - [x] Implement `ok<T>(value: T): Result<T, never>` factory function
  - [x] Implement `err<E>(error: E): Result<never, E>` factory function
  - [x] Implement `isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T }` type guard
  - [x] Implement `isError<T, E>(result: Result<T, E>): result is { ok: false; error: E }` type guard
  - [x] Ensure Result type works with TypeScript strict mode (narrowing via `ok` discriminant)
  - [x] NO monadic methods (.map, .flatMap, etc.) — keep it simple per YAGNI; just discriminated union + factories

- [x] Task 5: Write comprehensive unit tests (AC: #1, #2, #3, #4, #6)
  - [x] Create `packages/core/src/errors/errors.test.ts`
  - [x] **FluiError tests:**
    - [x] Test FluiError extends Error (`instanceof Error` is true)
    - [x] Test FluiError is identifiable (`instanceof FluiError` is true)
    - [x] Test `name` property equals `'FluiError'`
    - [x] Test all properties are set correctly (code, category, message, context, cause)
    - [x] Test FluiError without optional properties (context, cause omitted)
    - [x] Test FluiError with cause wrapping another Error
    - [x] Test FluiError with structured context record
    - [x] Test `toJSON()` serialization includes code, category, message, context
    - [x] Test `toJSON()` serialization excludes cause stack traces
    - [x] Test FluiError is immutable (readonly properties)
  - [x] **Error code tests:**
    - [x] Test all 10 error code constants are exported and have correct format (`FLUI_EXXX`)
    - [x] Test `ERROR_CODE_DESCRIPTIONS` has entries for all defined codes
    - [x] Test ErrorCategory accepts all valid categories
    - [x] Test ErrorCategory type rejects invalid values at compile time (type-level)
  - [x] **Result tests:**
    - [x] Test `ok(value)` creates success result with `ok: true`
    - [x] Test `err(error)` creates failure result with `ok: false`
    - [x] Test TypeScript narrows correctly after `if (result.ok)` check
    - [x] Test `isOk()` type guard returns true for ok results
    - [x] Test `isError()` type guard returns true for error results
    - [x] Test `isOk()` type guard returns false for error results
    - [x] Test `isError()` type guard returns false for ok results
    - [x] Test Result works with generic types (number, string, complex objects)
    - [x] Test Result.error works with FluiError specifically
  - [x] Achieve >90% line coverage on the errors/ module

- [x] Task 6: Verify integration and build (AC: #1, #2, #3, #5, #6)
  - [x] Run `pnpm build` — verify tsup produces updated dist/ with new exports
  - [x] Run `pnpm lint` — verify Biome passes with zero warnings on new files
  - [x] Run `pnpm test` — verify all tests pass including new errors/ tests
  - [x] Run `pnpm size` — verify @flui/core remains < 25KB gzipped
  - [x] Verify type exports work: `import type { FluiError, FluiErrorCode, ErrorCategory, Result } from '@flui/core'`
  - [x] Verify value exports work: `import { FluiError, ok, err, isOk, isError, FLUI_E001, ERROR_CODE_DESCRIPTIONS } from '@flui/core'`
  - [x] Verify existing spec/ tests still pass (zero regressions)
  - [x] Update `packages/core/src/index.test.ts` to verify new errors/ exports in the barrel test

## Dev Notes

### Critical: This is a Foundation Module (Cross-Cutting Concern)

The `errors/` module is a **leaf dependency** — it imports NOTHING from other @flui/core modules. However, it is imported by **every other module** in the system:

```
spec/          → zero imports (leaf)
errors/        → zero imports (leaf)
registry/      → imports errors/
intent/        → imports errors/
context/       → imports errors/
validation/    → imports errors/
generation/    → imports errors/
cache/         → imports errors/
data/          → imports errors/
policy/        → imports errors/
concurrency/   → imports errors/
observe/       → imports errors/
flui.ts        → imports errors/
```

**Any mistake in FluiError or Result types propagates to every downstream module.** This is the single most important cross-cutting concern in the entire architecture.

### Architecture-Mandated Pattern: Result for Async, Throw for Config

The architecture mandates two distinct error handling strategies:

```typescript
// CORRECT: Async operations return Result (failures are expected)
async function generateUI(intent: string, options: GenerateOptions): Promise<Result<UISpecification>>

// CORRECT: Sync config errors throw (programmer errors at startup, per NFR-R6)
function createFlui(config: FluiConfig): FluiInstance // throws FluiError if config is invalid

// WRONG: Never throw from async generation pipeline
async function generateUI(intent: string): Promise<UISpecification> // throws — WRONG
```

### FluiError Class Structure (Architecture-Mandated — Exact)

```typescript
class FluiError extends Error {
  readonly code: FluiErrorCode    // 'FLUI_E001' through 'FLUI_E099'
  readonly category: ErrorCategory // 'validation' | 'generation' | 'cache' | 'connector' | 'config'
  readonly context?: Record<string, unknown> // Structured metadata (never sensitive data)
  readonly cause?: Error           // Original error if wrapping
}
```

### Result Type (Architecture-Mandated — Exact)

```typescript
type Result<T, E = FluiError> =
  | { ok: true; value: T }
  | { ok: false; error: E }
```

### AbortSignal Integration Pattern (For Future Stories)

The architecture shows how FluiError integrates with AbortSignal in async pipelines:

```typescript
if (signal?.aborted) {
  return { ok: false, error: new FluiError('FLUI_E010', 'generation', 'Generation cancelled') }
}
```

This pattern will be used by Story 4.x+ but the error code FLUI_E010 is defined here.

### File Layout Discrepancy: Epics vs Architecture

The **epics file** AC #6 references `errors.ts`, `errors.types.ts`, `errors.constants.ts`. The **architecture document** specifies:

```
packages/core/src/errors/
  index.ts              # Public API barrel
  flui-error.ts         # FluiError class
  error-codes.ts        # Error code constants, FluiErrorCode type, ErrorCategory type
  result.ts             # Result type and factory functions
  errors.test.ts        # Co-located unit tests
```

**Follow the architecture layout** — it provides better separation of concerns (FluiError class, error codes, and Result type are distinct conceptual units). The AC content requirements are fully satisfied by this file layout, just distributed differently.

### Naming Conventions (MANDATORY)

| Element | Convention | Example | Anti-Pattern |
|---------|-----------|---------|-------------|
| Type aliases | `PascalCase`, noun | `FluiError`, `Result`, `ErrorCategory` | `TFluiError`, `IResult` |
| Error code constants | `SCREAMING_SNAKE_CASE` | `FLUI_E001` | `fluiE001`, `FluiE001` |
| File names | `kebab-case.ts` | `flui-error.ts`, `error-codes.ts` | `fluiError.ts`, `ErrorCodes.ts` |
| Factory functions | `camelCase` | `ok()`, `err()` | `Ok()`, `createOk()` |
| Type guards | `camelCase`, `is` prefix | `isOk()`, `isError()` | `checkOk()`, `isResultOk()` |

### TypeScript Strict Mode Implications

All code must compile under these settings (already configured in `tsconfig.base.json`):

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "target": "ES2022",
  "module": "ESNext",
  "moduleResolution": "bundler",
  "verbatimModuleSyntax": true,
  "isolatedModules": true
}
```

**`exactOptionalPropertyTypes: true`** means:

- Optional properties CANNOT be explicitly set to `undefined` unless the type says `| undefined`
- FluiError's optional fields (`context`, `cause`) must use `?: T | undefined` pattern if they can be explicitly set to `undefined`
- For FluiError, `context?: Record<string, unknown>` means the property can be absent but NOT explicitly `undefined` — use `context?: Record<string, unknown> | undefined` if the constructor might receive explicit `undefined`

**`verbatimModuleSyntax: true`** means:

- Must use `import type { ... }` for type-only imports
- Must use `export type { ... }` for type-only re-exports

### Export Pattern from errors/index.ts

```typescript
// errors/index.ts — explicit named exports ONLY
export type { ErrorCategory, FluiErrorCode } from './error-codes';
export { ERROR_CODE_DESCRIPTIONS, FLUI_E001, ... } from './error-codes';
export type { FluiErrorOptions } from './flui-error';
export { FluiError } from './flui-error';
export type { Result } from './result';
export { err, isError, isOk, ok } from './result';
```

### Package Barrel (packages/core/src/index.ts) Update

The root barrel re-exports errors/ public API alongside existing spec/ exports. Biome 2.x requires `export type` blocks before `export` (value) blocks from the same source module, with all type-only exports merged into a single `export type {}` block per source.

### Bundle Size Constraint

@flui/core must remain **< 25KB gzipped** (excluding Zod peer dependency). The errors/ module is pure TypeScript with zero runtime dependencies — it adds negligible bundle size (estimated < 1KB). Types are erased at compile time. Run `pnpm size` after implementation to verify.

### Testing Standards

- **Framework:** Vitest 4.0.18
- **Coverage target:** >90% line coverage on errors/ module
- **Test file:** `errors.test.ts` co-located in `packages/core/src/errors/`
- **Pattern:** `describe(ModuleName) > describe(functionName/type) > it(behavior)`
- **NEVER** use `any`/`unknown` in test assertions — assert specific types
- **ALWAYS** test both success and failure paths
- **ALWAYS** test type guards with both positive and negative cases

### Project Structure Notes

- Alignment with unified project structure: `packages/core/src/errors/` matches architecture document exactly
- File naming follows `kebab-case.ts` convention
- The errors/ module is the SECOND module directory created inside @flui/core (after spec/)
- No conflicts with existing code — spec/ module has zero dependency on errors/
- errors/ imports NOTHING from spec/ or any other module (it is a leaf dependency)

### Previous Story Intelligence (Story 1.2)

**Key learnings from Story 1.2 implementation:**

1. **Biome 2.x export ordering:** `export type` must come before `export` (value exports) from the same module. Within `export` blocks from the same source, Biome sorts alphabetically.
2. **size-limit and dependencies:** Zod was bundled by size-limit and exceeded budget. Fixed by adding `"ignore": ["zod"]` to `.size-limit.json`. For errors/ module, no external deps so this should not be an issue.
3. **`@vitest/coverage-v8`** was added at root workspace level for coverage reporting — already available.
4. **Types defined manually** with `z.ZodType<ManualType>` annotations. For errors/ module, no Zod is used — types are pure TypeScript.
5. **Optional fields** use `?: T | undefined` pattern required by `exactOptionalPropertyTypes: true`.
6. **`createEmptySpec()` helper** was NOT implemented per YAGNI. Apply same principle: do NOT add utility methods (.map, .flatMap, .unwrap, etc.) to Result unless explicitly required.
7. **index.test.ts update pattern:** Story 1.2 updated the existing barrel test to check for new exports. Story 1.3 must do the same.
8. **Review findings from Story 1.2:** `z.strictObject()` was used for strict parsing, `ComponentSpec.id` was added as required field, type-sync assertions were added. Apply same rigor to FluiError type definitions.

### Previous Story Intelligence (Story 1.1)

**Relevant learnings:**

1. **TypeScript 5.8.3** (not 5.8.0) — already installed
2. **Biome 2.x:** `organizeImports` → `assist`, `files.ignore` → `files.includes`
3. **tsup** outputs `.js` (ESM) + `.cjs` (CJS) with `type: "module"`
4. **Security lint:** `security-check.mjs` scans for `new Function()` and `.innerHTML =`
5. **Placeholder tests** were replaced with import-based assertions

### Git Intelligence

**Recent commits (from Story 1.2 completion):**

The project has commits from Story 1.1 (monorepo init) and Story 1.2 (UISpecification types). Key patterns established:

- Module files follow `{module-name}/{purpose}.ts` pattern
- Barrel exports are explicit named exports, Biome-sorted
- Tests are co-located as `{module}.test.ts`
- Root barrel re-exports all public symbols from each module
- `index.test.ts` is updated with each new module to verify barrel exports

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3] — Full acceptance criteria and story definition
- [Source: _bmad-output/planning-artifacts/architecture.md#Error Handling Decision] — FluiError + Result pattern mandate
- [Source: _bmad-output/planning-artifacts/architecture.md#FluiError Structure] — Exact class definition
- [Source: _bmad-output/planning-artifacts/architecture.md#Result Pattern] — Exact type definition
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure] — errors/ module directory layout
- [Source: _bmad-output/planning-artifacts/architecture.md#Module Boundary Rules] — errors/ is leaf dependency
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns] — Error code naming convention
- [Source: _bmad-output/planning-artifacts/architecture.md#Enforcement Guidelines] — Result pattern enforcement rules
- [Source: _bmad-output/planning-artifacts/architecture.md#AbortSignal Propagation] — FLUI_E010 usage pattern
- [Source: _bmad-output/planning-artifacts/prd.md#FR57] — Typed error codes with descriptive messages
- [Source: _bmad-output/planning-artifacts/prd.md#FR58] — TypeScript compilation errors for misconfigurations
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-R6] — Programmer errors thrown at startup
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-M2] — Zero any types in public API
- [Source: _bmad-output/implementation-artifacts/1-1-initialize-monorepo-with-build-toolchain.md] — Story 1.1 learnings
- [Source: _bmad-output/implementation-artifacts/1-2-establish-uispecification-types-and-schema.md] — Story 1.2 learnings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- `verbatimModuleSyntax` prevents exporting the same identifier as both `export type { Result }` and `export { Result }` from the same module barrel. Resolved by separating `Result` type (type-only export) from `ok`/`err` factory functions (value exports) instead of using a `Result` namespace object.
- Story specified `Result.ok()` and `Result.error()` as factory pattern, but `verbatimModuleSyntax` + `isolatedModules` prevents same-name type+value re-exports through barrel files. Refactored to standalone `ok()` and `err()` functions which compile cleanly and provide equivalent ergonomics.
- Biome 2.x requires `export type` blocks to come before `export` (value) blocks from the same source, and `import type` before `import` from the same source. All barrel files and test imports updated accordingly.
- Coverage report files (`packages/core/coverage/prettify.js`, `sorter.js`) contain `innerHTML` assignments from Istanbul's HTML reporter. Added `coverage` to `security-check.mjs` directory exclusion list alongside `dist` and `node_modules`.
- `FluiErrorOptions` interface exported as type-only from barrel to support consumers who need the constructor options type.

### Completion Notes List

- All 6 tasks completed with all subtasks verified
- All 6 acceptance criteria satisfied
- FluiErrorCode now supports the reserved range FLUI_E001–FLUI_E099 while Story 1.3 allocates constants FLUI_E001–FLUI_E010
- Added `Result` factory object with `Result.ok()` and `Result.error()` while preserving standalone `ok()`, `error()`, and `err()` helpers
- Added compile-time misconfiguration guard coverage for required `fallback` property using `@ts-expect-error`
- Added compile-time negative type tests for invalid `ErrorCategory` values
- FluiError class: extends Error, readonly code/category/context/cause, toJSON() serialization
- 10 error codes defined (FLUI_E001–FLUI_E010) with ERROR_CODE_DESCRIPTIONS record
- Result<T,E> discriminated union with ok()/err() factories and isOk()/isError() type guards
- 40 tests in errors.test.ts + 4 barrel tests in index.test.ts = 44 new tests
- 100% line coverage on errors/ runtime files (error-codes.ts, flui-error.ts, result.ts)
- Biome lint: 0 errors across all 41 files
- Bundle size: 1.1 KB total own code (Zod excluded per standard library practice)
- Zero regressions: all 98 tests pass across all 5 packages (previously 90)
- Updated existing index.test.ts to verify new errors/ exports
- security-check.mjs updated to exclude coverage/ directory

### File List

- packages/core/src/errors/index.ts (new)
- packages/core/src/errors/error-codes.ts (new)
- packages/core/src/errors/flui-error.ts (new)
- packages/core/src/errors/result.ts (new)
- packages/core/src/errors/errors.test.ts (new)
- packages/core/src/index.ts (modified — re-exports errors/ public API)
- packages/core/src/index.test.ts (modified — added errors/ barrel export verification)
- security-check.mjs (modified — added coverage/ directory exclusion)
- flui-guide-pratique-fr.docx (unrelated workspace artifact present in git status; excluded from source review scope)
- flui-one-page-fr.docx (unrelated workspace artifact present in git status; excluded from source review scope)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified — story status)
- _bmad-output/implementation-artifacts/1-3-implement-fluierror-and-result-pattern.md (modified — task completion)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-25 | Implemented FluiError class, 10 error codes, Result type with ok/err factories, isOk/isError type guards, 34 unit tests with 100% coverage, updated barrel exports and barrel tests | Claude Opus 4.6 |
| 2026-02-25 | Applied code-review fixes: expanded FluiErrorCode type to FLUI_E001–FLUI_E099, added Result.ok/Result.error factory object, added compile-time misconfiguration/type-negative tests, and reconciled git/story file-list transparency | OpenCode |

## Senior Developer Review (AI)

### Reviewer

Fabrice (AI-assisted code review by OpenCode)

### Date

2026-02-25

### Outcome

Changes Requested — then fixed in-session

### Findings and Resolutions

- **HIGH:** FluiError code space only accepted FLUI_E001–FLUI_E010; AC requires FLUI_E001–FLUI_E099 support
  - **Resolution:** Updated `FluiErrorCode` template-literal type to accept full reserved range FLUI_E001–FLUI_E099 while retaining Story 1.3 constants FLUI_E001–FLUI_E010
- **HIGH:** API surface did not support `Result.ok()` / `Result.error()` naming required by AC language
  - **Resolution:** Added `Result` factory object with `ok` and `error` methods and exported it from module barrels
- **HIGH:** AC for compile-time fallback misconfiguration evidence was missing
  - **Resolution:** Added explicit compile-time check test proving missing required `fallback` property fails type checking
- **MEDIUM:** Story File List did not account for all git-visible changes
  - **Resolution:** Documented unrelated workspace artifacts visible in git status and explicitly marked them excluded from source review scope
- **MEDIUM:** No negative compile-time test for invalid `ErrorCategory`
  - **Resolution:** Added `@ts-expect-error` negative type test for invalid category assignment

### Validation Evidence

- `pnpm lint` passed (Biome + security-check)
- `pnpm test` passed (all workspace tests)
- `pnpm build` passed (all packages)
- `pnpm size` passed (`@flui/core` 1.1 kB gzipped)
- `pnpm --filter @flui/core exec vitest run --coverage` passed with 100% coverage for `src/errors` runtime files
