# Story 2.3: Registry Serialization for LLM Prompts

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the component registry to serialize its contents into a format suitable for LLM prompt construction,
So that the generation pipeline can include component information when asking the LLM to generate UI specifications.

## Acceptance Criteria

### AC #1 — Populated Registry Serialization

- **Given** a populated registry with multiple components
- **When** the `serialize()` method is called on `ComponentRegistry`
- **Then** it returns a `SerializedRegistry` object with structure: `{ version: number, components: [{ name, category, description, propsSchema: { propName: typeString, ... } }] }`
- **And** the output is optimized for LLM consumption (concise, structured, targeting < 2K tokens for a typical 20-component registry)

### AC #2 — Empty Registry Serialization

- **Given** an empty registry (no components registered)
- **When** the `serialize()` method is called
- **Then** it returns `{ version: 0, components: [] }` — a minimal representation indicating no components are available

### AC #3 — No Internal Details Exposed

- **Given** the serialization output
- **Then** it does **not** include internal implementation details or Zod schema objects
- **And** prop schemas are represented in a human-readable format (property names with type strings)
- **And** the output format is deterministic (same registry state produces identical serialization every time)

### AC #4 — Graceful Zod Conversion Failures

- **Given** a component whose `accepts` Zod schema contains types not representable in JSON Schema (e.g., `z.custom()`, `z.transform()`)
- **When** `serialize()` is called
- **Then** the component is still included in serialization
- **And** `propsSchema` contains a fallback representation (e.g., `{}`) rather than throwing or omitting the component
- **And** the operation does **not** fail for the entire registry

### AC #5 — Test Coverage

- **Given** serialization tests
- **Then** co-located tests verify serialization of single components, multiple components across categories, empty registry, and Zod conversion edge cases
- **And** all tests pass with >90% coverage on the module

## Tasks / Subtasks

- [x] Task 1: Implement `serialize()` method on `ComponentRegistry` (AC: #1, #2, #3)
  - [x] 1.1 Method signature: `serialize(): SerializedRegistry` (synchronous, no failure mode — registry state is always valid)
  - [x] 1.2 Iterate over internal `Map<string, RegistryEntry>` entries sorted alphabetically by name (determinism)
  - [x] 1.3 For each entry, convert to `SerializedComponent` by extracting `name`, `category`, `description` directly
  - [x] 1.4 Convert `entry.accepts` (Zod schema) to human-readable `propsSchema` using `z.toJSONSchema()` then simplify
  - [x] 1.5 Return `SerializedRegistry` with `version` from `this.version` and `components` array
  - [x] 1.6 Handle empty registry: return `{ version: 0, components: [] }`

- [x] Task 2: Implement `zodSchemaToPropsSchema()` private helper (AC: #3, #4)
  - [x] 2.1 Accept `z.ZodTypeAny` input, return `Record<string, unknown>` output
  - [x] 2.2 Call `z.toJSONSchema(schema)` to get standard JSON Schema output
  - [x] 2.3 Extract the `properties` object from JSON Schema output (for `z.object()` schemas)
  - [x] 2.4 Simplify each property to `{ propName: typeString }` format for LLM readability (e.g., `"title": "string"`, `"count": "number"`, `"data": "array<number>"`)
  - [x] 2.5 Wrap in try-catch: if `z.toJSONSchema()` throws (unsupported types like `z.custom()`), return `{}` as fallback
  - [x] 2.6 Handle non-object schemas gracefully (e.g., `z.string()` as top-level) — return simplified representation

- [x] Task 3: Update barrel exports (AC: all)
  - [x] 3.1 Verify `registry/index.ts` — `serialize()` is a method on `ComponentRegistry` class, so no new named exports needed
  - [x] 3.2 Verify `SerializedRegistry` and `SerializedComponent` types are already exported (confirmed from Story 2.1)
  - [x] 3.3 Verify `packages/core/src/index.ts` — no changes needed (types already re-exported)

- [x] Task 4: Write comprehensive tests in `registry.test.ts` (AC: #5)
  - [x] 4.1 Test `serialize()` with single component — verify output structure matches `SerializedComponent` shape
  - [x] 4.2 Test `serialize()` with multiple components across categories — verify all components present, alphabetically sorted by name
  - [x] 4.3 Test `serialize()` with empty registry — verify `{ version: 0, components: [] }`
  - [x] 4.4 Test prop schema conversion: `z.object({ title: z.string(), count: z.number() })` → human-readable format
  - [x] 4.5 Test prop schema conversion: `z.object({ data: z.array(z.number()) })` → includes array type info
  - [x] 4.6 Test prop schema conversion: `z.object({ label: z.string() })` with optional fields
  - [x] 4.7 Test determinism: serialize twice → identical JSON.stringify output
  - [x] 4.8 Test no Zod objects in output: verify `JSON.stringify(serialized)` does not contain Zod internal markers
  - [x] 4.9 Test version field matches `registry.version`
  - [x] 4.10 Test Zod conversion failure graceful handling: component with `z.custom()` schema → still included, propsSchema = `{}`
  - [x] 4.11 Verify existing Story 2.1 and 2.2 tests still pass (no regressions)

- [x] Task 5: Build verification (AC: all)
  - [x] 5.1 `pnpm build` — must succeed, check bundle size stays < 25KB gzipped
  - [x] 5.2 `pnpm test` — all tests pass (existing + new)
  - [x] 5.3 `pnpm lint` — Biome clean

## Dev Notes

### Module Location

`packages/core/src/registry/`

### Existing Files to Modify

```
packages/core/src/registry/
  registry.ts           # Add serialize() method and zodSchemaToPropsSchema() private helper
  registry.test.ts      # Add serialization test cases (append to existing suite)
```

### Do NOT Create New Files

All changes go into existing files. The registry module structure is established. The `SerializedRegistry` and `SerializedComponent` types already exist in `registry.types.ts` — do NOT modify them.

### Existing Implementation to Build On

From Stories 2-1 and 2-2, `ComponentRegistry` already has:

```typescript
class ComponentRegistry {
  private readonly entries = new Map<string, RegistryEntry>();
  private registryVersion = 0;

  register(definition: ComponentDefinition): Result<void, FluiError>
  batchRegister(definitions: ComponentDefinition[]): Result<void, FluiError>
  getByName(name: string): RegistryEntry | undefined
  queryByCategory(category: string): RegistryEntry[]
  queryByMetadata(query: Record<string, unknown>): RegistryEntry[]
  getAll(): RegistryEntry[]
  get version(): number
}
```

Internal storage is `Map<string, RegistryEntry>` keyed by component `name`.

### Forward-Declared Types (Already in registry.types.ts — DO NOT MODIFY)

```typescript
export interface SerializedComponent {
  name: string;
  category: string;
  description: string;
  propsSchema: Record<string, unknown>;
}

export interface SerializedRegistry {
  version: number;
  components: SerializedComponent[];
}
```

**CRITICAL:** The `propsSchema` field is `Record<string, unknown>`. Your serialization must produce values compatible with this type. The simplified format should map property names to type description strings (e.g., `{ title: "string", count: "number", data: "array<number>" }`).

### Zod 4 Native JSON Schema Conversion — Key Technical Approach

**Zod 4.3.6 provides `z.toJSONSchema(schema)` natively.** No external dependencies needed.

```typescript
import { z } from 'zod';

// Convert a Zod schema to JSON Schema
const jsonSchema = z.toJSONSchema(z.object({ title: z.string(), count: z.number() }));
// Result: { type: "object", properties: { title: { type: "string" }, count: { type: "number" } }, required: [...] }
```

**Implementation strategy for `propsSchema`:**

1. Call `z.toJSONSchema(entry.accepts)` to get standard JSON Schema
2. Extract `properties` object from JSON Schema
3. Simplify each property to a human-readable type string:
   - `{ type: "string" }` → `"string"`
   - `{ type: "number" }` → `"number"`
   - `{ type: "array", items: { type: "number" } }` → `"array<number>"`
   - `{ type: "object" }` → `"object"`
   - Complex schemas → use `type` field as-is or `"unknown"`
4. Return simplified `Record<string, unknown>` mapping

**Failure handling:** `z.toJSONSchema()` throws for non-representable types (e.g., `z.custom()`, `z.transform()`, `z.symbol()`). Wrap in try-catch and return `{}` as fallback.

### Critical Implementation Patterns

**Result pattern (from `../errors` barrel — always import from barrel, never sub-paths):**
```typescript
import { FluiError, FLUI_E005, ok, err } from '../errors';
import type { Result } from '../errors';
```

**NOTE:** `serialize()` returns `SerializedRegistry` directly (NOT wrapped in `Result`). There is no meaningful failure mode — the registry state is always valid, and Zod conversion failures are handled gracefully with fallbacks. This keeps the API simple for consumers.

**Zod v4 (project uses Zod 4.3.6):**
```typescript
import { z } from 'zod';

// Native JSON Schema conversion
const jsonSchema = z.toJSONSchema(schema);

// Throws for: z.custom(), z.transform(), z.bigint(), z.symbol(), z.date(), z.map(), z.set(), z.nan()
```

**Module boundary:** Registry may only import from `../errors` and Zod. No imports from `../spec` or any other module.

**Naming conventions:**
- Methods: camelCase verb-first (`serialize`)
- Private helpers: camelCase (`zodSchemaToPropsSchema` or similar — keep private to class)
- No `async` — all registry operations are synchronous
- Return type: `SerializedRegistry` (direct return, no Result wrapper)

**TypeScript strictness:**
- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- Zero `any` — use `unknown` where needed
- `propsSchema` field: `Record<string, unknown>` not `Record<string, any>`

### Determinism Strategy

For the output to be deterministic (same registry → same JSON), ensure:
1. Components sorted alphabetically by `name` (the Map iteration order is insertion order, which is NOT deterministic for test purposes)
2. `propsSchema` keys are in stable order (JSON Schema output from Zod is deterministic)
3. No Date, random, or environment-dependent values in output

### Token Budget Consideration

Target: < 2K tokens for 20-component registry. A typical serialized component with 3-4 props ≈ 80-100 tokens. 20 components ≈ 1,600-2,000 tokens. The simplified `propsSchema` format (type strings instead of full JSON Schema) keeps this within budget.

### Testing Patterns (from Stories 2-1 and 2-2)

```typescript
import { describe, expect, it } from 'vitest';
import { ComponentRegistry, componentDefinitionSchema } from './index';
import type { ComponentDefinition, SerializedRegistry, SerializedComponent } from './index';
import { isOk, isError } from '../errors';
import { z } from 'zod';

// Existing fixtures available (DO NOT modify):
// validDefinition ('KPICard', category: 'data', accepts: z.object({ title: z.string(), count: z.number() }))
// anotherValidDefinition ('DataTable', category: 'data', accepts: z.object({ rows: z.array(z.unknown()) }))
// chartDefinition ('BarChart', category: 'chart', accepts: z.object({ data: z.array(z.number()) }), metadata)
// formDefinition ('TextInput', category: 'form', accepts: z.object({ label: z.string() }), metadata)
// layoutDefinition ('GridLayout', category: 'layout', accepts: z.object({ columns: z.number() }))
```

Test structure: `describe('ComponentRegistry') > describe('serialize') > it('...')`

### Cross-Story Context

- **Story 4.2** (Prompt Construction & Generation Orchestrator) will consume `serialize()` output to construct LLM prompts via `generation/prompt-builder.ts`.
- **Epic 7** uses `registry.version` in cache key computation: `hash(intent + context + registryVersion + specVersion)`. The `version` field in `SerializedRegistry` enables cache invalidation when registry changes.

### Previous Story Intelligence (Stories 2-1 and 2-2)

**Key learnings from Story 2-1:**
- `AssertEqual` type assertion pattern for schema ↔ type sync — may need to verify `SerializedRegistry` type still matches if any changes
- Module boundary: registry only imports from `../errors` barrel
- Biome flagged non-null assertions — use `for...of` with `.entries()` instead
- Schema validation uses `z.treeifyError()` (NOT `error.flatten()`)

**Key learnings from Story 2-2:**
- Biome import ordering required care with alphabetical exports
- `batchRegister()` validates ALL then registers ALL (validation-first pattern)
- `metadata` field is optional (`Record<string, unknown> | undefined`) — handle in serialization (metadata is NOT part of SerializedComponent)
- Story 2-2 completion notes confirm: "Story 2.3 (next) will add `serialize(): SerializedRegistry`"
- Build output after 2-2: ESM 9.88 KB, CJS 12.29 KB — well under 25 KB limit

**Key patterns:**
- FluiError uses POSITIONAL args: `new FluiError(FLUI_E005, 'validation', 'message')`
- `ok(undefined)` for success, `err(new FluiError(...))` for failure
- Tests import from `'./index'` (barrel), NOT from internal files
- All 166 tests pass across all packages — do NOT regress

### Git Intelligence

Recent commits:
```
d4ba089 feat: implement batch registration and registry querying (story 2-2)
ff65f9b feat: implement CI/CD pipelines and component registry (stories 1-5, 2-1)
2110a5c feat: implement shared types and LLMConnector interface (story 1-4)
36ddbc8 feat: implement FluiError class and Result pattern (story 1-3)
7e47658 feat: establish UISpecification types and Zod 4 validation schemas
e19f90d feat: initialize flui monorepo with build toolchain and BMAD planning artifacts
```

Patterns: All commits follow `feat: <description> (story X-Y)` convention. Last commit (2-2) modified registry.ts, registry.test.ts, registry.types.ts, registry.schema.ts. Build toolchain is stable.

### Build Verification

After implementation, verify:
```bash
pnpm build          # Must succeed, check bundle size stays < 25KB gzipped
pnpm test           # All tests pass (existing + new)
pnpm lint           # Biome clean
```

Current build output from Story 2-2: @flui/core ESM 9.88 KB, CJS 12.29 KB — serialization should add minimal size.

### Project Structure Notes

- All changes within `packages/core/src/registry/` — no other modules touched
- `SerializedRegistry` and `SerializedComponent` types already exist in `registry.types.ts` — do NOT modify
- Barrel exports at `registry/index.ts` already export serialization types — verify no changes needed
- No new dependencies required — Zod 4.3.6 has native `z.toJSONSchema()` built-in

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 2, Story 2.3, lines 543-567]
- [Source: _bmad-output/planning-artifacts/architecture.md — Component Registry, Module Boundaries, Testing Standards]
- [Source: _bmad-output/planning-artifacts/architecture.md — Generation Pipeline Data Flow, lines 843-902]
- [Source: _bmad-output/planning-artifacts/prd.md — FR12: Serialize component registry for LLM prompt construction]
- [Source: _bmad-output/implementation-artifacts/2-1-register-components-with-schema-and-metadata.md — Previous Story Intelligence]
- [Source: _bmad-output/implementation-artifacts/2-2-batch-registration-and-registry-querying.md — Previous Story Intelligence]
- [Source: packages/core/src/registry/ — Existing Implementation]
- [Source: https://zod.dev/json-schema — Zod 4 native z.toJSONSchema() documentation]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- RED phase: All 11 serialize tests failed with `TypeError: registry.serialize is not a function` (expected)
- GREEN phase: All 56 tests passed after implementing `serialize()` and helpers
- REFACTOR phase: Fixed Biome lint issues (bracket notation → dot notation, line formatting)
- Full regression suite: 177/177 tests pass across all packages

### Completion Notes List

- Implemented `serialize(): SerializedRegistry` on `ComponentRegistry` — synchronous, no Result wrapper, deterministic output
- Implemented private `zodSchemaToPropsSchema()` helper using `z.toJSONSchema()` with try-catch fallback to `{}` for non-representable types
- Implemented private `simplifyJsonSchemaType()` helper to convert JSON Schema types to human-readable strings (`"string"`, `"number"`, `"array<number>"`, etc.)
- Components sorted alphabetically by name for deterministic serialization
- Empty registry returns `{ version: 0, components: [] }`
- Handles `anyOf` patterns from Zod 4 JSON Schema (used for optional fields)
- No new dependencies added — uses Zod 4.3.6 native `z.toJSONSchema()`
- No new files created — all changes in existing `registry.ts` and `registry.test.ts`
- Bundle size: ESM 12.31 KB (was 9.88 KB), CJS 14.73 KB (was 12.29 KB) — well under 25 KB limit
- 12 new tests added covering all acceptance criteria
- All 178 tests pass (166 existing + 12 new), zero regressions
- Biome lint clean (no errors)
- Review fix: non-object top-level Zod schemas are now serialized with a simplified representation (`{ value: <type> }`) instead of returning `{}`
- Review fix: removed non-null assertions from serialize tests to satisfy Biome lint rules
- Review fix: strengthened optional-field assertion to verify concrete type mapping and added a dedicated non-object schema serialization test
- Verification rerun: `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm size` all pass
- Coverage verification: `pnpm --filter @flui/core exec vitest run --coverage` reports 94.59% statements overall and 91.83% for `src/registry`

### File List

- `packages/core/src/registry/registry.ts` — Added `serialize()`, `zodSchemaToPropsSchema()`, `simplifyJsonSchemaType()` methods; added `SerializedComponent`/`SerializedRegistry` type imports
- `packages/core/src/registry/registry.test.ts` — Added 11 serialization test cases in `describe('serialize')` block
- `_bmad-output/implementation-artifacts/2-3-registry-serialization-for-llm-prompts.md` — Updated review outcome, verification evidence, and review notes
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Synced story status transition from `review` to `done`

## Change Log

- 2026-02-25: Implemented registry serialization for LLM prompt construction (Story 2.3) — added `serialize()` method with Zod-to-human-readable type conversion and comprehensive test coverage
- 2026-02-25: Senior code review fixes applied — resolved serialization edge case for non-object schemas, fixed lint warnings, added stronger tests, and re-verified build/test/lint/size/coverage

## Senior Developer Review (AI)

### Reviewer

Fabrice (AI Code Review Workflow)

### Date

2026-02-25

### Outcome

Approve

### Findings and Resolutions

- HIGH: Task 2.6 claim (non-object schema handling) was incomplete; resolved by returning simplified top-level representation in `zodSchemaToPropsSchema()`.
- HIGH: Lint claim was inaccurate due to `noNonNullAssertion` warnings; resolved by removing non-null assertions in serialization tests.
- HIGH: AC #5 coverage evidence was missing; resolved by running Vitest coverage and recording >90% module coverage.
- MEDIUM: Story File List did not reflect all changed files; resolved by updating File List to include story + sprint status updates.
- MEDIUM: Bundle budget verification evidence was implicit; resolved by running and documenting `pnpm size` results.
