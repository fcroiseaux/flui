# Story 2.2: Batch Registration & Registry Querying

Status: done

## Story

As a developer,
I want to register multiple components at once and query the registry by category or capability,
So that I can efficiently set up my component library and discover available components.

## Acceptance Criteria

### AC #1 — Batch Registration Success (Atomic)

- **Given** the registry/ module with `ComponentRegistry`
- **When** a developer calls `batchRegister()` with an array of valid `ComponentDefinition` objects
- **Then** all components are registered in a single operation
- **And** the registry version increments once (not per-component)
- **And** `Result.ok` is returned

### AC #2 — Batch Registration Atomic Rollback

- **Given** a `batchRegister()` call with a mix of valid and invalid definitions
- **When** any definition in the batch fails validation (invalid metadata or duplicate name)
- **Then** the operation returns `Result.error` listing **all** failures (not just the first)
- **And** **no** components from the batch are registered (atomic rollback)
- **And** the registry version does **not** change
- **And** previously registered components remain untouched

### AC #3 — Category-Based Querying

- **Given** a populated registry with components in multiple categories
- **When** a developer calls `queryByCategory(category)` (e.g., `"chart"`, `"form"`, `"layout"`)
- **Then** all `RegistryEntry` objects matching that category are returned
- **And** an empty array is returned if no components match
- **And** the query is case-sensitive (matches exact category string)

### AC #4 — Capability/Metadata Attribute Querying

- **Given** a populated registry with components that have optional `metadata` attributes
- **When** a developer calls `queryByMetadata(query)` with key-value filter criteria
- **Then** all `RegistryEntry` objects whose `metadata` contains all specified key-value pairs are returned
- **And** an empty array is returned if no components match
- **And** components without `metadata` are never returned when querying by metadata

### AC #5 — Test Coverage

- **Given** batch registration and querying
- **Then** co-located tests cover: batch success, batch partial failure (atomic rollback), empty registry queries, category filtering, metadata querying, edge cases (empty batch, empty category, undefined metadata)
- **And** all tests pass with >90% coverage on the module

## Tasks / Subtasks

- [x] Task 1: Extend `ComponentDefinition` type with optional `metadata` (AC: #4)
  - [x] 1.1 Add `metadata?: Record<string, unknown>` to `ComponentDefinition` in `registry.types.ts`
  - [x] 1.2 Add `metadata?: Record<string, unknown>` to `RegistryEntry` in `registry.types.ts` (both types must stay in sync)
  - [x] 1.3 Update `componentDefinitionSchema` in `registry.schema.ts` to validate optional `metadata` field as `z.record(z.string(), z.unknown()).optional()`
  - [x] 1.4 Verify `AssertEqual` type assertion still compiles (schema ↔ type sync)
  - [x] 1.5 Existing tests must still pass (metadata is optional, backward-compatible)

- [x] Task 2: Implement `batchRegister()` method on `ComponentRegistry` (AC: #1, #2)
  - [x] 2.1 Method signature: `batchRegister(definitions: ComponentDefinition[]): Result<void, FluiError>`
  - [x] 2.2 Validate ALL definitions first, collect all errors (do not short-circuit on first failure)
  - [x] 2.3 Check for duplicates within the batch itself (two definitions with same name)
  - [x] 2.4 Check for duplicates against existing registry entries
  - [x] 2.5 If any errors, return `Result.error` with FluiError (code `FLUI_E005`, category `'validation'`) — error message must list all failures in format: `Batch registration failed with N error(s):\n  [0] "ComponentName": reason\n  [1] "ComponentName": reason`
  - [x] 2.6 If all pass, register all components and increment version **once**
  - [x] 2.7 Handle edge case: empty array input → return `Result.ok` (no-op)

- [x] Task 3: Implement `queryByCategory()` method on `ComponentRegistry` (AC: #3)
  - [x] 3.1 Method signature: `queryByCategory(category: string): RegistryEntry[]`
  - [x] 3.2 Filter internal `Map` entries by exact `category` match
  - [x] 3.3 Return empty array for no matches or empty registry

- [x] Task 4: Implement `queryByMetadata()` method on `ComponentRegistry` (AC: #4)
  - [x] 4.1 Method signature: `queryByMetadata(query: Record<string, unknown>): RegistryEntry[]`
  - [x] 4.2 Return entries where `metadata` exists and contains ALL key-value pairs from query (subset match)
  - [x] 4.3 Return empty array for no matches, empty registry, or components without metadata
  - [x] 4.4 Handle edge case: empty query object → return all entries that have metadata defined

- [x] Task 5: Implement `getAll()` method on `ComponentRegistry` (AC: #3, #4)
  - [x] 5.1 Method signature: `getAll(): RegistryEntry[]`
  - [x] 5.2 Return all registered entries as an array
  - [x] 5.3 Return empty array for empty registry

- [x] Task 6: Update barrel exports (AC: all)
  - [x] 6.1 Update `registry/index.ts` — export new methods are on the class, so no new named exports needed, but verify types
  - [x] 6.2 Update `packages/core/src/index.ts` if any new types need exporting (unlikely — methods are on existing class)

- [x] Task 7: Write comprehensive tests in `registry.test.ts` (AC: #5)
  - [x] 7.1 Test `batchRegister()` with all valid definitions → all registered, version increments once
  - [x] 7.2 Test `batchRegister()` with one invalid definition → none registered, all errors listed
  - [x] 7.3 Test `batchRegister()` with intra-batch duplicate names → error, none registered
  - [x] 7.4 Test `batchRegister()` with name conflicting with existing entry → error, none registered
  - [x] 7.5 Test `batchRegister()` with empty array → `Result.ok`, no version change
  - [x] 7.6 Test `queryByCategory()` returns matching entries
  - [x] 7.7 Test `queryByCategory()` returns empty array for no matches
  - [x] 7.8 Test `queryByCategory()` on empty registry
  - [x] 7.9 Test `queryByMetadata()` returns matching entries
  - [x] 7.10 Test `queryByMetadata()` returns empty for components without metadata
  - [x] 7.11 Test `queryByMetadata()` partial match (must match ALL query keys)
  - [x] 7.12 Test `queryByMetadata({})` with empty query → returns all entries that have metadata defined
  - [x] 7.13 Test `getAll()` returns all entries
  - [x] 7.14 Test `getAll()` returns empty array on empty registry
  - [x] 7.15 Verify existing Story 2.1 tests still pass (no regressions)

## Dev Notes

### Module Location

`packages/core/src/registry/`

### Existing Files to Modify

```
packages/core/src/registry/
  registry.types.ts     # Add optional metadata field to ComponentDefinition AND RegistryEntry
  registry.schema.ts    # Add metadata to Zod schema
  registry.ts           # Add batchRegister(), queryByCategory(), queryByMetadata(), getAll()
  registry.test.ts      # Add new test cases (append to existing suite)
  index.ts              # Verify exports (likely no changes needed)
```

### Do NOT Create New Files

All changes go into existing files. The registry module structure is established.

### Existing Implementation to Build On

From Story 2-1, `ComponentRegistry` already has:

```typescript
class ComponentRegistry {
  private readonly entries = new Map<string, RegistryEntry>();
  private registryVersion = 0;

  register(definition: ComponentDefinition): Result<void, FluiError>  // validates via Zod, rejects duplicates
  getByName(name: string): RegistryEntry | undefined                   // Map lookup
  get version(): number                                                // cache key integration
}
```

Internal storage is `Map<string, RegistryEntry>` keyed by component `name`.

### Critical Implementation Patterns

**Result pattern (from `../errors` barrel — always import from barrel, never sub-paths):**
```typescript
import { FluiError, FLUI_E005, ok, err } from '../errors';
import type { Result } from '../errors';

// Success
return ok(undefined);

// Failure — FluiError uses POSITIONAL args: (code, category, message, options?)
return err(new FluiError(FLUI_E005, 'validation', 'Schema validation failed: ...'));
```

**Zod v4 validation (project uses Zod 4.3.6):**
```typescript
import { z } from 'zod';

// Parse
const result = componentDefinitionSchema.safeParse(definition);
if (!result.success) {
  const tree = z.treeifyError(result.error);  // NOT error.flatten()
  // ...
}
```

**Error code:** Use `FLUI_E005` for all registry validation failures (schema, duplicates, batch errors).

**Module boundary:** Registry may only import from `../errors`. No imports from `../spec` or any other module.

**Naming conventions:**
- Methods: camelCase verb-first (`batchRegister`, `queryByCategory`, `queryByMetadata`, `getAll`)
- No `async` — all registry operations are synchronous
- Return types: `Result<void, FluiError>` for mutations, `RegistryEntry[]` for queries

**TypeScript strictness:**
- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- Zero `any` — use `unknown` where needed
- `metadata` field: `Record<string, unknown>` not `Record<string, any>`

### Batch Registration — Atomic Strategy

The atomicity requirement means:
1. First pass: validate ALL definitions (collect all errors)
2. Also check for intra-batch duplicates (same name appears twice in the array)
3. Also check for conflicts with existing registry (name already registered)
4. If ANY error found: return all errors, change nothing
5. If ALL pass: insert all into Map, increment `registryVersion` once

Do NOT call `this.register()` in a loop — that would increment version per-component and make rollback complex. Implement validation inline in `batchRegister()`.

### Metadata Querying — Subset Match Strategy

`queryByMetadata({ interactive: true, theme: 'dark' })` returns entries where:
- `entry.metadata` is defined (not undefined)
- `entry.metadata.interactive === true`
- `entry.metadata.theme === 'dark'`

Use strict equality (`===`) for value comparison.

### Testing Patterns (from Story 2-1)

```typescript
import { describe, expect, it } from 'vitest';
import { ComponentRegistry, componentDefinitionSchema } from './index';
import type { ComponentDefinition } from './index';
import { isOk, isError } from '../errors';
import { z } from 'zod';

// Existing fixtures from Story 2-1 (DO NOT modify):
const validPropsSchema = z.object({ title: z.string(), count: z.number() });
const validDefinition: ComponentDefinition = {
  name: 'KPICard',
  category: 'data',               // ← existing fixture uses 'data', not 'chart'
  description: 'Displays a key performance indicator',
  accepts: validPropsSchema,
  component: null,
};

// Add NEW fixtures for batch/query tests:
const chartDefinition: ComponentDefinition = {
  name: 'BarChart',
  category: 'chart',
  description: 'Renders a bar chart',
  accepts: z.object({ data: z.array(z.number()) }),
  component: null,
  metadata: { interactive: true, theme: 'dark' },
};
const formDefinition: ComponentDefinition = {
  name: 'TextInput',
  category: 'form',
  description: 'A text input field',
  accepts: z.object({ label: z.string() }),
  component: null,
  metadata: { interactive: true },
};
```

Test structure: `describe('ComponentRegistry') > describe('batchRegister') > it('...')`

### Cross-Story Context

- **Story 2.3** (next) will add `serialize(): SerializedRegistry` — the types `SerializedRegistry` and `SerializedComponent` already exist in `registry.types.ts` (forward-compatible from Story 2-1).
- **Epic 4 Story 4.2** will use registry queries to construct LLM prompts.
- **Epic 7** will use `registry.version` in cache key computation.

### Build Verification

After implementation, verify:
```bash
pnpm build          # Must succeed, check bundle size stays < 25KB gzipped
pnpm test           # All tests pass (existing + new)
pnpm lint           # Biome clean
```

Current build output from Story 2-1: @flui/core 6.97 KB ESM, 9.33 KB CJS — new methods should add minimal size.

### Project Structure Notes

- All changes within `packages/core/src/registry/` — no other modules touched
- Barrel exports at `registry/index.ts` and `packages/core/src/index.ts` may need updates only if new types are exported
- No new dependencies required

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 2, Story 2.2]
- [Source: _bmad-output/planning-artifacts/architecture.md — Component Registry, Module Boundaries, Testing Standards]
- [Source: _bmad-output/implementation-artifacts/2-1-register-components-with-schema-and-metadata.md — Previous Story Intelligence]
- [Source: packages/core/src/registry/ — Existing Implementation]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- AssertEqual type assertion initially failed due to `exactOptionalPropertyTypes: true` — Zod's `.optional()` infers `T | undefined` while TS interface had `T`. Fixed by aligning interface types to `Record<string, unknown> | undefined`.
- Biome flagged non-null assertion (`definitions[i]!`) — replaced with `for...of` using `definitions.entries()`.
- Biome formatting issues in long template literal and array argument — reformatted to comply.

### Completion Notes List

- Task 1: Added optional `metadata` field to both `ComponentDefinition` and `RegistryEntry` interfaces, updated Zod schema, verified type assertion compiles, all 23 existing tests pass.
- Task 2: Implemented `batchRegister()` with atomic validation-first strategy. Validates all definitions, checks intra-batch and existing duplicates, returns all errors. Empty array returns ok (no-op). Version increments once on success.
- Task 3: Implemented `queryByCategory()` — iterates entries, exact case-sensitive match, returns empty array for no matches.
- Task 4: Implemented `queryByMetadata()` — subset match with strict equality, skips entries without metadata, empty query returns all entries with metadata defined.
- Task 5: Implemented `getAll()` — returns spread of Map values as array.
- Task 6: Verified barrel exports — no changes needed, methods are on existing class.
- Task 7: Added 20 new tests covering all scenarios: batch success, atomic rollback, intra-batch duplicates, existing name conflicts, empty batch, category querying, metadata querying (subset match, strict equality, empty query), getAll, and regression verification. Total: 43 registry tests, 164 across all packages.
- Review fixes (AI): Corrected `batchRegister()` error numbering to be sequential by error count (matching required `[0]...[N-1]` format), added edge-case test for empty category query, and added regression test for sequential batch error indexing. Updated totals: 45 registry tests, 166 across all packages.

### Change Log

- 2026-02-25: Implemented batch registration and registry querying (Story 2.2). Added `metadata` field to types/schema, implemented `batchRegister()`, `queryByCategory()`, `queryByMetadata()`, `getAll()` methods, and 20 comprehensive tests. Build output: ESM 9.88 KB, CJS 12.29 KB. Biome clean. 164/164 tests pass.
- 2026-02-25: Senior code review fixes applied. Resolved high/medium review findings by aligning batch error index format to story spec, adding missing empty-category edge-case coverage, and reconciling story file documentation with actual changed files.

### File List

- packages/core/src/registry/registry.types.ts (modified — added `metadata` to `ComponentDefinition` and `RegistryEntry`)
- packages/core/src/registry/registry.schema.ts (modified — added `metadata` to Zod schema)
- packages/core/src/registry/registry.ts (modified — added `batchRegister()`, `queryByCategory()`, `queryByMetadata()`, `getAll()`, updated `register()` to include metadata in entry, and aligned batch error index formatting)
- packages/core/src/registry/registry.test.ts (modified — added 3 new fixtures and 22 tests for batch/query/getAll, including review edge-case coverage)
- _bmad-output/implementation-artifacts/2-2-batch-registration-and-registry-querying.md (modified — review findings, fixes, and status updates)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified — story status sync to `done`)

### Senior Developer Review (AI)

- Reviewer: Fabrice (AI code-review workflow)
- Date: 2026-02-25
- Outcome: Changes Requested -> Fixed
- Findings addressed:
  - HIGH: Batch error index formatting now uses contiguous error numbering.
  - HIGH: Added explicit empty-category query test coverage.
  - HIGH: Removed inaccurate claim of `registry/index.ts` change from file accounting.
  - MEDIUM: Story documentation now tracks workflow-updated artifact changes.
- Validation evidence:
  - `pnpm --filter @flui/core test -- registry.test.ts` -> 45 registry tests passing.
  - Total in-package tests passing: 166.
