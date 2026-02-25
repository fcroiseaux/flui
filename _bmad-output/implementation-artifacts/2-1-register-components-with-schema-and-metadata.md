# Story 2.1: Register Components with Schema & Metadata

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to register UI components with declared prop schemas and descriptive metadata,
So that the framework knows what components are available and can validate their usage.

## Acceptance Criteria

1. **Given** the registry/ module in @flui/core **When** a developer registers a component with a name, category, description, and Zod prop schema **Then** the component is stored in the registry and retrievable by name **And** the registration returns a `Result.ok` confirming success

2. **Given** a component registration attempt **When** the metadata is invalid (missing name, empty category, or malformed schema) **Then** the registration is rejected at registration time with a `Result.error` containing a FluiError (NFR-S4) **And** the error includes the specific validation failure details

3. **Given** a component registration attempt **When** a component with the same name is already registered **Then** the registration returns a `Result.error` indicating a duplicate registration **And** the existing registration is not overwritten

4. **Given** the registry/ module source files **Then** `registry.ts` contains the core implementation **And** `registry.types.ts` contains ComponentDefinition and RegistryEntry types **And** `registry.schema.ts` contains Zod schemas for validating registration metadata **And** `registry.test.ts` contains co-located tests covering valid registrations, invalid metadata rejection, and duplicate handling **And** all tests pass with >90% coverage on the module

## Tasks / Subtasks

- [x] Task 1: Create `registry.types.ts` with ComponentDefinition, RegistryEntry, and serialization types (AC: #4)
  - [x] Define `ComponentDefinition` interface (input type for `register()`)
  - [x] Define `RegistryEntry` interface (stored type after validation)
  - [x] Define `SerializedRegistry` and `SerializedComponent` interfaces (for Story 2.3 forward-compat)
  - [x] Type the `component` field as `unknown` — @flui/core has zero React awareness

- [x] Task 2: Create `registry.schema.ts` with Zod validation schemas (AC: #2, #4)
  - [x] Create `componentDefinitionSchema` using `z.strictObject()`
  - [x] Validate `name`: non-empty string (`z.string().min(1)`)
  - [x] Validate `category`: non-empty string (`z.string().min(1)`)
  - [x] Validate `description`: non-empty string (`z.string().min(1)`)
  - [x] Validate `accepts`: is a Zod schema instance (`z.custom<z.ZodTypeAny>()`)
  - [x] Validate `component`: `z.unknown()` (any value accepted, typed at adapter layer)
  - [x] Add `AssertEqual` type check pattern to keep schema and TypeScript types in sync

- [x] Task 3: Create `registry.ts` with ComponentRegistry class (AC: #1, #2, #3)
  - [x] Implement `register(definition: ComponentDefinition): Result<void, FluiError>`
  - [x] Validate input against `componentDefinitionSchema` — on fail return `Result.error` with `FLUI_E005`
  - [x] Check duplicate name — on fail return `Result.error` with `FLUI_E005` and specific message
  - [x] Store as `RegistryEntry` in internal `Map<string, RegistryEntry>`
  - [x] Implement `getByName(name: string): RegistryEntry | undefined`
  - [x] Return `Result.ok(undefined)` on successful registration

- [x] Task 4: Create `registry/index.ts` barrel with explicit named exports (AC: #4)
  - [x] Export `ComponentRegistry` from `./registry`
  - [x] Export types: `ComponentDefinition`, `RegistryEntry`, `SerializedRegistry`, `SerializedComponent` from `./registry.types`
  - [x] Export `componentDefinitionSchema` from `./registry.schema`

- [x] Task 5: Update `packages/core/src/index.ts` to re-export registry module (AC: #4)
  - [x] Add registry exports to the core barrel file

- [x] Task 6: Create `registry.test.ts` with comprehensive tests (AC: #1, #2, #3, #4)
  - [x] Test valid registration succeeds with `Result.ok`
  - [x] Test retrieval by name after registration
  - [x] Test invalid metadata: missing name → `Result.error` with FluiError
  - [x] Test invalid metadata: empty category → `Result.error` with FluiError
  - [x] Test invalid metadata: missing description → `Result.error`
  - [x] Test invalid metadata: invalid accepts (not a Zod schema) → `Result.error`
  - [x] Test duplicate name registration → `Result.error`, original preserved
  - [x] Test `getByName` returns undefined for unknown name
  - [x] Test barrel exports from `'../index'`
  - [x] Target >90% coverage

## Dev Notes

### Module Location and File Structure

Create directory: `packages/core/src/registry/`

```
packages/core/src/registry/
  index.ts              # Public API barrel — explicit named exports only
  registry.ts           # Core implementation (ComponentRegistry class)
  registry.types.ts     # ComponentDefinition and RegistryEntry types
  registry.schema.ts    # Zod schemas for validating registration metadata
  registry.test.ts      # Co-located unit tests
```

[Source: architecture.md#Project Structure, lines 559-564]

### Module Boundary Rules

- `registry/` MAY import from `../spec` (spec module barrel) and `../errors` (errors module barrel)
- `registry/` MUST NOT import from any other internal module
- All imports from sibling modules MUST go through their `index.ts` barrel

[Source: architecture.md#Module Boundaries, lines 793-813]

### Type Design — Critical Constraints

- `@flui/core` has **zero React awareness** — the `component` field in `ComponentDefinition` MUST be typed as `unknown`, NOT as `React.ComponentType` or similar
- The React adapter layer (`@flui/react`, Story 6.x) will add type safety for the component field
- `RegistryEntry` stores validated data — same shape as `ComponentDefinition` but guaranteed valid
- All registry methods that can fail MUST return `Result<T, FluiError>` — NEVER throw exceptions
- Registry operations are **synchronous** (no I/O) — return `Result<T>`, NOT `Promise<Result<T>>`

### Error Codes to Use

Already defined in `errors/error-codes.ts`:

| Code | When to use |
|------|-------------|
| `FLUI_E005` | Schema validation failed — invalid metadata at registration time |
| `FLUI_E006` | Component not found — `getByName()` miss (available for future use) |

For **duplicate registration**, use `FLUI_E005` with a descriptive message (e.g., `"Schema validation failed: component 'KPICard' already registered"`). The existing error codes cover this story's needs — no new error codes required.

### Result Pattern Usage

Import from `../errors`:

```typescript
import { FluiError, FLUI_E005, ok, err } from '../errors';
import type { Result } from '../errors/result';
```

Return patterns:

- Success: `return ok(undefined);`
- Validation failure: `return err(new FluiError({ code: FLUI_E005, message: '...', category: 'validation' }));`

### Zod v4 API — Critical Differences

The project uses **Zod 4.3.6** (NOT Zod 3). Key differences:

- Use `z.strictObject()` for strict validation (consistent with existing schemas in `spec.schema.ts`)
- Error introspection: use `z.treeifyError(error)` (NOT `error.flatten()`)
- `z.custom<T>()` for custom validators (use for validating `accepts` is a ZodType)
- `z.int()` available for integer types

[Source: packages/core/package.json — `"zod": "4.3.6"`]

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Module directory | `kebab-case/` | `registry/` |
| Source files | `{module}.suffix.ts` | `registry.types.ts`, `registry.schema.ts` |
| Interfaces | PascalCase noun | `ComponentDefinition`, `RegistryEntry` |
| Zod schema vars | camelCase + Schema | `componentDefinitionSchema` |
| Class names | PascalCase | `ComponentRegistry` |
| Boolean vars | `is`/`has`/`should` prefix | `isDuplicate`, `hasComponent` |

[Source: architecture.md#Naming Conventions, lines 266-300]

### TypeScript Compiler Constraints

From `tsconfig.base.json`:

- `"strict": true` — all strict checks enabled
- `"noUncheckedIndexedAccess": true` — `Map.get()` returns `T | undefined`, handle it
- `"exactOptionalPropertyTypes": true` — `?:` means explicitly undefined
- `"verbatimModuleSyntax": true` — use `import type` for type-only imports
- `"target": "ES2022"` — modern syntax available

### Testing Pattern

Follow existing patterns from `spec.test.ts` and `errors.test.ts`:

```typescript
import { describe, expect, expectTypeOf, it } from 'vitest';
```

- Import from `'./index'` (the barrel), NOT from internal files
- Use `describe('ComponentRegistry') > describe(methodName) > it(behavior)` structure
- Test BOTH `Result.ok` and `Result.error` paths for every operation
- Use `expect.unreachable()` for branches that should never execute
- Define `// ── Test fixtures ──` at the top with reusable valid/invalid data
- Use `expectTypeOf` for type-level assertions where useful

### Linting Rules (Enforced by Biome 2.4.4)

- `"noExplicitAny": "error"` — zero `any` in code
- `"noUnusedImports": "error"` — remove unused imports
- 2-space indent, single quotes, semicolons always, trailing commas, line width 100

### Build — No Config Changes Needed

`tsup.config.ts` entry is `src/index.ts`. Adding registry exports to the barrel is all that's needed. No tsup or build config changes required.

### Cross-Story Context (Epic 2)

This story creates the foundation for:

- **Story 2.2** (Batch Registration & Querying): Will add `registerMany()`, `getByCategory()`, `getAll()` to `ComponentRegistry`. Design the internal `Map` storage now so batch operations are straightforward.
- **Story 2.3** (Serialization): Will add `serialize()` returning `SerializedRegistry`. Define the serialization types in `registry.types.ts` now for forward compatibility, but do NOT implement serialization logic.

### Architecture Hint: Cache Key Integration

The architecture mentions `registryVersion` in cache key computation: `hash(intent + context + registryVersion + specVersion)`. Consider adding a simple `version` counter or method to `ComponentRegistry` that increments on each registration — this will be consumed by the cache module (Epic 7).

[Source: architecture.md#Caching Strategy]

### Project Structure Notes

- `packages/core/src/registry/` does NOT exist yet — create it fresh
- No existing files need modification except `packages/core/src/index.ts` (add registry barrel exports)
- Module boundary: registry/ can only import from `../errors` and `../spec`
- Follow explicit named export pattern — no `export *` or `export default`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1] — Full acceptance criteria and BDD scenarios
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure] — registry/ file structure (lines 559-564)
- [Source: _bmad-output/planning-artifacts/architecture.md#Module Boundaries] — import rules (lines 793-813)
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Conventions] — file and code naming (lines 266-300)
- [Source: _bmad-output/planning-artifacts/architecture.md#Testing Standards] — co-located tests, vitest config (lines 488-505)
- [Source: _bmad-output/planning-artifacts/architecture.md#Component Management] — FR8-FR13, registry subsystem (lines 306-316)
- [Source: packages/core/src/errors/error-codes.ts] — FLUI_E005, FLUI_E006 definitions
- [Source: packages/core/src/errors/result.ts] — Result, ok, err, isOk, isError API
- [Source: packages/core/src/spec/spec.schema.ts] — Zod v4 schema pattern with AssertEqual
- [Source: packages/core/tsup.config.ts] — Build configuration (entry: src/index.ts)
- [Source: tsconfig.base.json] — Strict TypeScript compiler settings

### Previous Story Intelligence (Epic 1 Learnings)

**Key patterns established in Stories 1.1–1.5:**

1. **TypeScript 5.8.3** — installed version, not 5.8.0
2. **Zod 4.3.6** with `z.strictObject()` — follow `spec.schema.ts` pattern exactly
3. **Biome 2.x** — `organizeImports` is now `assist`, security rules in place
4. **tsup with `type: "module"`** — outputs `.js` (ESM) + `.cjs` (CJS)
5. **125 tests pass** across all packages as of Story 1.4 — do NOT regress
6. **Bundle size: @flui/core 1.22 KB gzipped** — well under 25 KB limit
7. **`pnpm lint` = `biome check . && node ./security-check.mjs`** — both run in CI
8. **Commit format:** `feat: <description> (story X-Y)`
9. **Schema + type sync pattern:** Use `AssertEqual` type checking in schema files to guarantee schema matches TypeScript types

### Git Intelligence

Recent commits:

```
2110a5c feat: implement shared types and LLMConnector interface (story 1-4)
36ddbc8 feat: implement FluiError class and Result pattern (story 1-3)
7e47658 feat: establish UISpecification types and Zod 4 validation schemas
e19f90d feat: initialize flui monorepo with build toolchain and BMAD planning artifacts
```

Patterns: All commits follow `feat:` prefix convention. Build toolchain is stable. No CI workflows triggered yet (GitHub Actions created but no remote pushes observed).

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Initial build succeeded on first attempt
- Biome import ordering required reordering exports (registry barrel before spec/types alphabetically)
- All 144 tests pass (23 new registry + 121 existing), zero regressions

### Completion Notes List

- Created `registry/` module with 5 files following established project patterns
- `ComponentDefinition` and `RegistryEntry` interfaces with `component: unknown` (zero React awareness)
- `SerializedRegistry` and `SerializedComponent` types added for Story 2.3 forward-compat
- `componentDefinitionSchema` using `z.strictObject()` with `AssertEqual` type sync pattern
- `ComponentRegistry` class with `register()`, `getByName()`, and `version` getter
- `register()` validates via Zod schema, returns `Result.error(FLUI_E005)` on invalid metadata or duplicate
- `version` counter increments on each successful registration (for cache key integration, Epic 7)
- 23 tests covering: valid registration, retrieval, invalid metadata (name/category/description/accepts), duplicate rejection, version tracking, barrel exports, Result type integration, type-level assertions
- Module boundary respected: only imports from `../errors`
- Build output: @flui/core 6.97 KB ESM, 9.33 KB CJS

### File List

- packages/core/src/registry/registry.types.ts (new)
- packages/core/src/registry/registry.schema.ts (new)
- packages/core/src/registry/registry.ts (new)
- packages/core/src/registry/index.ts (new)
- packages/core/src/registry/registry.test.ts (new)
- packages/core/src/index.ts (modified)

### Senior Developer Review (AI)

- Reviewer: Fabrice
- Date: 2026-02-25
- Outcome: Approved after fixes

Findings addressed during review:

- Fixed module boundary imports in registry source/tests to use `../errors` barrel exports only.
- Strengthened schema/type sync assertion in `registry.schema.ts` with a compile-time checked assertion value.
- Extended invalid metadata tests to assert specific validation detail presence in error messages (`name`, `category`, `description`).
- Re-ran validation checks: Biome passes on updated registry files and all 23 registry tests pass.

Notes:

- Non-source and planning artifact changes in working tree were treated as out-of-scope for this story review per workflow constraints.

### Change Log

- 2026-02-25: Implemented Story 2.1 — Created registry/ module with ComponentRegistry class, types, Zod schema validation, and 23 comprehensive tests. All 144 tests pass, lint clean, build succeeds.
- 2026-02-25: Senior Developer Review completed. Fixed import boundary violations, strengthened schema/type sync assertion, and improved AC2 validation-detail test assertions. Story approved and moved to done.
