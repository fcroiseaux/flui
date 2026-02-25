# Story 3.2: Built-in Context Providers (Identity & Environment)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the system to resolve user identity context and environment context automatically,
So that generated UIs can adapt based on who the user is and what device they're using.

## Acceptance Criteria

### AC #1 — Identity Context Provider

- **Given** the context/ module in @flui/core
- **When** the identity context provider is invoked with user information
- **Then** it resolves a context object containing:
  - role (user's role in the system)
  - permissions (list of authorized actions)
  - expertise level (user's technical proficiency: 'novice' | 'intermediate' | 'expert')
- **And** the result is returned as `Result.ok(IdentityContext)`

### AC #2 — Environment Context Provider

- **Given** the context/ module
- **When** the environment context provider is invoked
- **Then** it resolves a context object containing:
  - device type ('mobile' | 'tablet' | 'desktop')
  - viewport size (width, height as numbers)
  - connection quality ('fast' | 'slow' | 'offline')
- **And** the result is returned as `Result.ok(EnvironmentContext)`

### AC #3 — Error Handling

- **Given** a context provider
- **When** it fails to resolve (e.g., missing required data, invalid schema)
- **Then** it returns `Result.error` with a FluiError describing the failure
- **And** the error includes which required field is missing or invalid
- **And** the error category is `'context'` or `'validation'`
- **And** downstream consumers can handle the absence gracefully

### AC #4 — AbortSignal Support

- **Given** context provider implementations
- **Then** each provider's `resolve()` method accepts an optional `AbortSignal` as parameter
- **And** providers check `signal.aborted` before expensive operations
- **And** if signal is aborted, returns `Result.error` with FLUI_E010 (Operation cancelled)
- **And** no dangling promises or memory leaks occur

### AC #5 — ContextProvider Interface

- **Given** the context/ module
- **Then** `context.types.ts` defines a `ContextProvider<T>` interface with:
  - `readonly name: string` — provider identifier (e.g., 'identity', 'environment')
  - `resolve(signal?: AbortSignal): Promise<Result<T>>` — async resolution that never throws
- **And** `ContextData` is defined as the base type `Record<string, unknown>`
- **And** both `IdentityContext` and `EnvironmentContext` extend or satisfy `ContextData`

### AC #6 — Factory Functions

- **Given** the context/ module
- **Then** `createIdentityProvider(input)` creates a `ContextProvider<IdentityContext>` from:
  - Static `IdentityContext` data, OR
  - A resolver function `() => IdentityContext | Promise<IdentityContext>`
- **And** `createEnvironmentProvider(input)` creates a `ContextProvider<EnvironmentContext>` from:
  - Static `EnvironmentContext` data, OR
  - A resolver function `() => EnvironmentContext | Promise<EnvironmentContext>`
- **And** the resolved data is validated against Zod schemas before being returned

### AC #7 — Test Coverage

- **Given** the context/ module source files
- **Then** `context.test.ts` contains co-located tests covering:
  - Identity provider: success with all fields, missing required fields, AbortSignal cancellation
  - Environment provider: success with all fields, missing required fields, AbortSignal cancellation
  - Both static config and resolver function modes
  - Zod schema validation (valid data, invalid data, extra properties rejected)
- **And** all tests pass with >90% coverage on the module

## Tasks / Subtasks

- [x] Task 1: Add error codes and update ErrorCategory (AC: #3, #4)
  - [x] 1.1 Add `'context'` to `ErrorCategory` union type in `error-codes.ts`
  - [x] 1.2 Add `FLUI_E011` constant: `"Context resolution failed: a context provider returned an error during resolution"`
  - [x] 1.3 Add `FLUI_E012` constant: `"Invalid context data: context data does not match expected schema"`
  - [x] 1.4 Add `FLUI_E011`, `FLUI_E012` to `DefinedFluiErrorCode` union and `ERROR_CODE_DESCRIPTIONS` map
  - [x] 1.5 Update `packages/core/src/errors/index.ts` barrel to export `FLUI_E011`, `FLUI_E012`
  - [x] 1.6 Update `packages/core/src/index.ts` barrel to re-export `FLUI_E011`, `FLUI_E012`

- [x] Task 2: Create `context.types.ts` — type definitions (AC: #1, #2, #5)
  - [x] 2.1 Define `ContextData` type: `Record<string, unknown>` (base type for all context data)
  - [x] 2.2 Define `IdentityContext` interface: `{ role: string; permissions: string[]; expertiseLevel: 'novice' | 'intermediate' | 'expert' }`
  - [x] 2.3 Define `EnvironmentContext` interface: `{ deviceType: 'mobile' | 'tablet' | 'desktop'; viewportSize: { width: number; height: number }; connectionQuality: 'fast' | 'slow' | 'offline' }`
  - [x] 2.4 Define `ViewportSize` interface: `{ width: number; height: number }` (extracted for reuse)
  - [x] 2.5 Define `ContextProvider<T extends ContextData = ContextData>` interface: `{ readonly name: string; resolve(signal?: AbortSignal): Promise<Result<T>> }`
  - [x] 2.6 Define `ContextResolver<T>` type: `T | (() => T | Promise<T>)` (union of static data or resolver function)
  - [x] 2.7 Add `AssertEqual` type assertions between Zod schemas and TypeScript interfaces (per project pattern)

- [x] Task 3: Create `context.schema.ts` — Zod validation schemas (AC: #1, #2, #3)
  - [x] 3.1 Define `viewportSizeSchema` using `z.strictObject({ width: z.number().positive(), height: z.number().positive() })`
  - [x] 3.2 Define `identityContextSchema` using `z.strictObject({ role: z.string().min(1), permissions: z.array(z.string()), expertiseLevel: z.enum(['novice', 'intermediate', 'expert']) })`
  - [x] 3.3 Define `environmentContextSchema` using `z.strictObject({ deviceType: z.enum(['mobile', 'tablet', 'desktop']), viewportSize: viewportSizeSchema, connectionQuality: z.enum(['fast', 'slow', 'offline']) })`
  - [x] 3.4 Add `AssertEqual` type assertions to ensure schema <-> TypeScript type sync

- [x] Task 4: Create `context.ts` — shared context provider factory (AC: #3, #4, #5, #6)
  - [x] 4.1 Implement `createProvider<T extends ContextData>(name: string, resolver: ContextResolver<T>, schema: z.ZodType<T>): ContextProvider<T>` — internal factory function
  - [x] 4.2 In the returned provider's `resolve(signal?)`:
    - [x] 4.2.1 Check `signal?.aborted` → return `err(new FluiError(FLUI_E010, 'context', 'Context resolution cancelled'))`
    - [x] 4.2.2 Resolve data: if `resolver` is a function → call it (awaiting if async), else use directly
    - [x] 4.2.3 Check `signal?.aborted` again after async resolution (cooperative cancellation)
    - [x] 4.2.4 Validate resolved data against Zod schema via `schema.safeParse(data)`
    - [x] 4.2.5 On validation failure → return `err(new FluiError(FLUI_E012, 'validation', 'Invalid context data: ${JSON.stringify(z.treeifyError(parseResult.error))}'))`
    - [x] 4.2.6 On success → return `ok(parseResult.data)`
  - [x] 4.3 Wrap the entire resolve body in try/catch for unexpected resolver errors → return `err(new FluiError(FLUI_E011, 'context', message, { cause: error }))`
  - [x] 4.4 Ensure the factory function is pure — no global state, each call produces an independent provider

- [x] Task 5: Create `providers/identity.ts` — identity context provider (AC: #1, #6)
  - [x] 5.1 Implement `createIdentityProvider(input: ContextResolver<IdentityContext>): ContextProvider<IdentityContext>`
  - [x] 5.2 Delegates to `createProvider('identity', input, identityContextSchema)`
  - [x] 5.3 Provider name is always `'identity'`

- [x] Task 6: Create `providers/environment.ts` — environment context provider (AC: #2, #6)
  - [x] 6.1 Implement `createEnvironmentProvider(input: ContextResolver<EnvironmentContext>): ContextProvider<EnvironmentContext>`
  - [x] 6.2 Delegates to `createProvider('environment', input, environmentContextSchema)`
  - [x] 6.3 Provider name is always `'environment'`

- [x] Task 7: Create `providers/index.ts` — providers barrel (AC: all)
  - [x] 7.1 Export `createIdentityProvider` from `./identity`
  - [x] 7.2 Export `createEnvironmentProvider` from `./environment`
  - [x] 7.3 Use explicit named exports (never `export *`)

- [x] Task 8: Create `context/index.ts` — module barrel (AC: all)
  - [x] 8.1 Export all types: `ContextProvider`, `ContextData`, `IdentityContext`, `EnvironmentContext`, `ViewportSize`, `ContextResolver`
  - [x] 8.2 Export factory functions: `createIdentityProvider`, `createEnvironmentProvider` (from `./providers`)
  - [x] 8.3 Export Zod schemas: `identityContextSchema`, `environmentContextSchema`, `viewportSizeSchema`
  - [x] 8.4 Use explicit named exports, types via `export type {}`, values via `export {}`
  - [x] 8.5 Maintain alphabetical ordering of exports (Biome requirement)

- [x] Task 9: Update `packages/core/src/index.ts` — package barrel (AC: all)
  - [x] 9.1 Add context/ module type exports: `ContextProvider`, `ContextData`, `IdentityContext`, `EnvironmentContext`, `ViewportSize`, `ContextResolver`
  - [x] 9.2 Add context/ module value exports: `createIdentityProvider`, `createEnvironmentProvider`, `identityContextSchema`, `environmentContextSchema`, `viewportSizeSchema`
  - [x] 9.3 Place between `// errors/ module` and `// intent/ module` sections (alphabetical order: context comes before intent)
  - [x] 9.4 Follow existing pattern: types via `export type {}`, values via `export {}`

- [x] Task 10: Write comprehensive tests in `context.test.ts` (AC: #7)
  - [x] 10.1 `describe('createIdentityProvider')`:
    - [x] 10.1.1 Test: static IdentityContext data → `Result.ok` with correct fields (role, permissions, expertiseLevel)
    - [x] 10.1.2 Test: resolver function returning IdentityContext → `Result.ok` with correct fields
    - [x] 10.1.3 Test: async resolver function → `Result.ok` with correct fields
    - [x] 10.1.4 Test: provider name is `'identity'`
    - [x] 10.1.5 Test: missing `role` (empty string) → `Result.error` with FLUI_E012
    - [x] 10.1.6 Test: missing `permissions` → `Result.error` with FLUI_E012
    - [x] 10.1.7 Test: invalid `expertiseLevel` (e.g., 'guru') → `Result.error` with FLUI_E012
    - [x] 10.1.8 Test: extra properties rejected by `z.strictObject()` → `Result.error` with FLUI_E012
    - [x] 10.1.9 Test: resolver function throws → `Result.error` with FLUI_E011
    - [x] 10.1.10 Test: AbortSignal already aborted → `Result.error` with FLUI_E010
    - [x] 10.1.11 Test: AbortSignal aborted during async resolution → `Result.error` with FLUI_E010
  - [x] 10.2 `describe('createEnvironmentProvider')`:
    - [x] 10.2.1 Test: static EnvironmentContext data → `Result.ok` with correct fields (deviceType, viewportSize, connectionQuality)
    - [x] 10.2.2 Test: resolver function returning EnvironmentContext → `Result.ok` with correct fields
    - [x] 10.2.3 Test: async resolver function → `Result.ok` with correct fields
    - [x] 10.2.4 Test: provider name is `'environment'`
    - [x] 10.2.5 Test: invalid `deviceType` (e.g., 'tv') → `Result.error` with FLUI_E012
    - [x] 10.2.6 Test: negative viewport dimensions → `Result.error` with FLUI_E012
    - [x] 10.2.7 Test: invalid `connectionQuality` (e.g., 'medium') → `Result.error` with FLUI_E012
    - [x] 10.2.8 Test: extra properties rejected by `z.strictObject()` → `Result.error` with FLUI_E012
    - [x] 10.2.9 Test: resolver function throws → `Result.error` with FLUI_E011
    - [x] 10.2.10 Test: AbortSignal already aborted → `Result.error` with FLUI_E010
  - [x] 10.3 `describe('Zod schemas')`:
    - [x] 10.3.1 Test: `identityContextSchema` validates valid data correctly
    - [x] 10.3.2 Test: `identityContextSchema` rejects invalid data with proper error tree
    - [x] 10.3.3 Test: `environmentContextSchema` validates valid data correctly
    - [x] 10.3.4 Test: `environmentContextSchema` rejects invalid data with proper error tree
    - [x] 10.3.5 Test: `viewportSizeSchema` validates positive numbers, rejects zero/negative

- [x] Task 11: Build verification (AC: all)
  - [x] 11.1 `pnpm build` — must succeed, check bundle size stays < 25KB gzipped
  - [x] 11.2 `pnpm test` — all tests pass (existing 204 + new context tests)
  - [x] 11.3 `pnpm lint` — Biome clean (zero errors)

## Dev Notes

### Module Location

`packages/core/src/context/`

### Files to Create

```
packages/core/src/context/
  index.ts              # Barrel exports for public API
  context.ts            # Shared createProvider factory (internal)
  context.types.ts      # Type definitions (ContextProvider, IdentityContext, EnvironmentContext, etc.)
  context.schema.ts     # Zod schemas for context data validation
  context.test.ts       # Co-located tests (>90% coverage)
  providers/
    index.ts            # Providers barrel
    identity.ts         # createIdentityProvider factory
    environment.ts      # createEnvironmentProvider factory
```

### Files to Modify

```
packages/core/src/errors/error-codes.ts    # Add FLUI_E011, FLUI_E012, 'context' category
packages/core/src/errors/index.ts          # Export new error codes
packages/core/src/index.ts                 # Add context/ module exports to package barrel
```

### Architecture-Defined Module Structure

The architecture document explicitly defines the context/ module structure (architecture.md lines 573-581):

```
├── context/                  # Context Engine
│   ├── index.ts
│   ├── context.ts
│   ├── context.types.ts
│   ├── providers/
│   │   ├── index.ts
│   │   ├── identity.ts
│   │   └── environment.ts
│   └── context.test.ts
```

**Note:** This module uses a `providers/` subdirectory — different from the flat structure in intent/ and registry/. This is because the architecture plans for extensibility (Story 3.3 will add custom providers via the same subdirectory pattern).

Additionally, `context.schema.ts` should be created following the project pattern (every module that validates data has a `.schema.ts` file).

### Module Boundary Rules

```
context/       → imports errors/ (ONLY)
```

- The context module may ONLY import from `../errors` (barrel import)
- It does NOT import from `../intent`, `../registry`, `../spec`, `../types`, or any other module
- The `generation/` module will later import from `context/` — NOT the reverse
- Zod is available as the sole runtime dependency
- Internal provider files import from `../context.types` and `../context.schema` (within module)

### Error Codes to Use

| Error Code | When to Use |
|-----------|-------------|
| `FLUI_E010` | Operation cancelled: AbortSignal triggered cancellation (pre-existing) |
| `FLUI_E011` | Context resolution failed: provider resolver threw an unexpected error (NEW) |
| `FLUI_E012` | Invalid context data: Zod schema validation rejected provider output (NEW) |

- `FLUI_E010` is pre-allocated for AbortSignal cancellation (reuse from Story 1.3)
- `FLUI_E011` is NEW — for when a resolver function throws unexpectedly
- `FLUI_E012` is NEW — for when resolved data fails Zod schema validation
- Error categories: `'context'` for resolution failures, `'validation'` for schema failures

### ErrorCategory Update Required

The `ErrorCategory` type in `error-codes.ts` currently does not include `'context'`. This story adds it:

```typescript
// BEFORE:
export type ErrorCategory = 'validation' | 'generation' | 'cache' | 'connector' | 'config';

// AFTER:
export type ErrorCategory = 'validation' | 'generation' | 'cache' | 'connector' | 'config' | 'context';
```

### FluiError Construction Pattern

```typescript
import { FluiError, FLUI_E010, FLUI_E011, FLUI_E012, ok, err } from '../errors';
import type { Result } from '../errors';

// For AbortSignal cancellation (reuse existing code)
return err(new FluiError(FLUI_E010, 'context', 'Context resolution cancelled'));

// For unexpected resolver errors
return err(new FluiError(FLUI_E011, 'context', `Identity provider failed: ${error.message}`, { cause: error }));

// For Zod schema validation failure
const parseResult = identityContextSchema.safeParse(data);
if (!parseResult.success) {
  const tree = z.treeifyError(parseResult.error);
  return err(new FluiError(FLUI_E012, 'validation', `Invalid identity context: ${JSON.stringify(tree)}`));
}

// For success
return ok(parseResult.data);
```

**CRITICAL:** Use `z.treeifyError()` for Zod errors (NOT `error.flatten()`) — this is the established project pattern from Stories 2-1 and 3-1.

### Context Provider Design Pattern

The built-in providers use a **factory function** pattern that accepts either static data or a resolver function:

```typescript
// Static data — simplest usage
const identityProvider = createIdentityProvider({
  role: 'admin',
  permissions: ['create-dashboard', 'edit-components'],
  expertiseLevel: 'expert',
});

// Dynamic resolver — for runtime data
const identityProvider = createIdentityProvider(async () => ({
  role: await fetchUserRole(),
  permissions: await fetchPermissions(),
  expertiseLevel: 'intermediate',
}));

// Usage: both produce the same ContextProvider<IdentityContext>
const result = await identityProvider.resolve(signal);
if (isOk(result)) {
  console.log(result.value.role); // 'admin'
}
```

The internal `createProvider<T>()` factory in `context.ts` handles the common logic:
1. Check AbortSignal before resolution
2. Resolve data (invoke function or use static value)
3. Check AbortSignal after async resolution (cooperative cancellation)
4. Validate resolved data against Zod schema
5. Return `Result<T>`

### AbortSignal Implementation Notes

Following the established pattern from `LLMConnector.generate()` (types.ts line 82):

```typescript
async resolve(signal?: AbortSignal): Promise<Result<T>> {
  // Check 1: Before resolution
  if (signal?.aborted) {
    return err(new FluiError(FLUI_E010, 'context', 'Context resolution cancelled'));
  }

  // Resolve data (may be async)
  const data = typeof resolver === 'function' ? await (resolver as () => T | Promise<T>)() : resolver;

  // Check 2: After async resolution (cooperative cancellation)
  if (signal?.aborted) {
    return err(new FluiError(FLUI_E010, 'context', 'Context resolution cancelled'));
  }

  // Validate and return
  // ...
}
```

### TypeScript Strictness Requirements

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- Zero `any` — use `unknown` where needed
- All optional properties must use `| undefined` (per `exactOptionalPropertyTypes`)
- Use `z.strictObject()` (NOT `z.object()`) for Zod schemas to reject extra keys
- Use `verbatimModuleSyntax: true` — type-only imports must use `import type`

### Naming Conventions

| Element | Convention | This Story |
|---------|-----------|-----------|
| Module directory | `kebab-case/` | `context/` |
| Subdirectory | `kebab-case/` | `providers/` |
| Source files | `kebab-case.ts` | `context.ts`, `identity.ts`, `environment.ts` |
| Types file | `{module}.types.ts` | `context.types.ts` |
| Schema file | `{module}.schema.ts` | `context.schema.ts` |
| Test file | `{source}.test.ts` | `context.test.ts` |
| Interfaces/Types | `PascalCase` | `ContextProvider`, `IdentityContext`, `EnvironmentContext`, `ViewportSize` |
| Functions | `camelCase`, verb-first | `createIdentityProvider()`, `createEnvironmentProvider()`, `createProvider()` |
| Zod schemas | `camelCase` + `Schema` suffix | `identityContextSchema`, `environmentContextSchema`, `viewportSizeSchema` |
| Constants | `SCREAMING_SNAKE_CASE` | (none needed for this story) |

### Testing Pattern (from established codebase)

```typescript
import { describe, expect, it } from 'vitest';
import {
  createIdentityProvider,
  createEnvironmentProvider,
  identityContextSchema,
  environmentContextSchema,
} from './index';
import type { IdentityContext, EnvironmentContext, ContextProvider } from './index';
import { isOk, isError, FLUI_E010, FLUI_E011, FLUI_E012 } from '../errors';

// Import from barrel (./index), never from internal files
// Use describe() > describe() > it() nesting
// Test both Result.ok and Result.error paths
// No any/unknown in assertions — assert specific types
```

### Cross-Story Context

- **Story 3.1** (Parse Text & Structured Intents) — already done; created the intent/ module. Context module is independent (parallel development)
- **Story 3.3** (Custom Context Providers & Context Aggregation) — depends on this story; will add `registerProvider()`, `resolveAllContext()`, and custom provider support using the `ContextProvider` interface defined here
- **Story 4.2** (Prompt Construction & Generation Orchestrator) — will consume resolved context to build LLM prompts. The `IdentityContext` and `EnvironmentContext` data shapes feed into prompt templates
- **Cache key computation** (Epic 7): `hash(intent + context + registryVersion + specVersion)` — the resolved context data must be serializable (JSON-compatible) for deterministic cache key hashing

### Project Structure Notes

- New module `context/` created within `packages/core/src/` — follows established module pattern
- Uses `providers/` subdirectory as defined in architecture (unique to this module)
- Module boundary: only imports from `../errors` barrel
- No new npm dependencies required — uses Zod 4.3.6 (already installed)
- Bundle size impact should be minimal (~2-3KB added) — well within 25KB gzipped limit
- All 204 existing tests must continue to pass (zero regressions)

### Previous Story Intelligence (Story 3-1: Parse Text and Structured Intents)

**Key learnings from Story 3-1:**

- `z.treeifyError()` is the correct Zod error formatting function (not `flatten()`)
- Biome flags non-null assertions — avoid `!` operator in production code and tests
- Import from barrel files only (`./index`), never internal files
- `AssertEqual` type assertion pattern ensures schema <-> type sync
- Module boundary strictly enforced — intent only imports from `../errors`
- Build output after 3-1: ESM 17.78 KB, CJS 20.54 KB — headroom for context module
- All 204 tests passing — must not regress
- Coverage >90% on module required for AC
- Code review identified: `parseIntent()` should return specific error codes early (e.g., FLUI_E003 for empty intents before schema validation)

**Key patterns to replicate:**

- `FluiError` uses positional args: `new FluiError(FLUI_E011, 'context', 'message')`
- Optional 4th arg for context/cause: `new FluiError(code, cat, msg, { cause: error })`
- `ok(value)` for success, `err(new FluiError(...))` for failure
- Tests import from `'./index'` (barrel), NOT from internal files
- `z.strictObject()` preferred over `z.object()` to reject extra properties
- Initial lint run had Biome issues (import ordering, formatting) — fix in single pass
- Build verification: `pnpm build && pnpm test && pnpm lint`

### Git Intelligence

Recent commits (pattern: `feat: <description> (story X-Y)`):

```
1bc6030 feat: implement text and structured intent parsing with sanitization (story 3-1)
7ed5944 feat: implement registry serialization for LLM prompts (story 2-3)
d4ba089 feat: implement batch registration and registry querying (story 2-2)
ff65f9b feat: implement CI/CD pipelines and component registry (stories 1-5, 2-1)
2110a5c feat: implement shared types and LLMConnector interface (story 1-4)
```

Expected commit message for this story: `feat: implement built-in context providers for identity and environment (story 3-2)`

### Latest Technical Information

**Zod 4.3.6 (current project version):**

- `z.strictObject()` is the preferred top-level API for strict objects (rejects unknown keys)
- `z.treeifyError(error)` replaces deprecated `.format()` and `.flatten()` on ZodError
- `z.prettifyError(error)` available for human-readable single-string summaries
- `z.enum()` for string literal unions — use for `expertiseLevel`, `deviceType`, `connectionQuality`
- `z.discriminatedUnion()` available but not needed for this story (no union types)
- `z.number().positive()` enforces > 0 — use for viewport width/height
- `schema.safeParse(data)` returns `{ success: true, data } | { success: false, error }` — use for validation
- In Zod 4, strict object intersection only rejects keys unrecognized by BOTH sides

**TypeScript 5.8.3:**

- `exactOptionalPropertyTypes: true` requires explicit `| undefined` for optional props
- `verbatimModuleSyntax: true` requires `import type` for type-only imports
- No known issues with the patterns used in this story

### Build Verification

After implementation, verify:

```bash
pnpm build          # Must succeed, check bundle size stays < 25KB gzipped
pnpm test           # All tests pass (existing 204 + new context tests)
pnpm lint           # Biome clean (zero errors)
```

Current build output from Story 3-1: @flui/core ESM 17.78 KB, CJS 20.54 KB — context module should add ~2-3KB.

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 3, Story 3.2: Built-in Context Providers]
- [Source: _bmad-output/planning-artifacts/epics.md — Epic 3, Story 3.3: Custom Context Providers (downstream dependency)]
- [Source: _bmad-output/planning-artifacts/architecture.md — Context Engine module structure, lines 573-581]
- [Source: _bmad-output/planning-artifacts/architecture.md — Module Boundaries, context/ → imports errors/, line 797]
- [Source: _bmad-output/planning-artifacts/architecture.md — File Naming Conventions, lines 267-293]
- [Source: _bmad-output/planning-artifacts/architecture.md — Result Pattern and Error Handling, lines 340-368]
- [Source: _bmad-output/planning-artifacts/architecture.md — AbortSignal Propagation, lines 420-428]
- [Source: _bmad-output/planning-artifacts/architecture.md — Trace Enrichment Pattern, lines 372-380]
- [Source: _bmad-output/planning-artifacts/architecture.md — Generation Pipeline Data Flow, lines 843-903]
- [Source: _bmad-output/planning-artifacts/architecture.md — FR-to-Module Mapping, line 821]
- [Source: _bmad-output/planning-artifacts/prd.md — FR3: Resolve user identity context (role, permissions, expertise level)]
- [Source: _bmad-output/planning-artifacts/prd.md — FR4: Resolve environment context (device type, viewport size, connection quality)]
- [Source: _bmad-output/planning-artifacts/prd.md — FR5: Register custom context providers (Story 3.3)]
- [Source: _bmad-output/planning-artifacts/prd.md — FR6: Combine multiple context signals into unified object (Story 3.3)]
- [Source: packages/core/src/errors/error-codes.ts — ErrorCategory type and error code constants]
- [Source: packages/core/src/errors/flui-error.ts — FluiError class constructor pattern]
- [Source: packages/core/src/errors/result.ts — Result type and ok/err helpers]
- [Source: packages/core/src/types.ts — LLMConnector interface pattern with AbortSignal]
- [Source: _bmad-output/implementation-artifacts/3-1-parse-text-and-structured-intents.md — Previous Story Intelligence]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- TypeScript error: `EnvironmentContext` interface didn't satisfy `ContextData` (`Record<string, unknown>`) constraint due to missing index signature. Fixed by adding `extends ContextData` to both `IdentityContext` and `EnvironmentContext` interfaces.
- Existing test `ERROR_CODE_DESCRIPTIONS has exactly 10 entries` needed updating to 12 after adding FLUI_E011/E012. Also updated `ErrorCategory` test array to include `'context'`.
- Biome auto-fix applied for import ordering and formatting (5 files).

### Completion Notes List

- Implemented full context/ module with identity and environment context providers
- Created `createProvider<T>()` internal factory with AbortSignal support, Zod validation, and error handling
- Added 2 new error codes (FLUI_E011, FLUI_E012) and 'context' error category
- 28 new tests covering: static data, resolver functions, async resolvers, provider names, validation errors (empty role, missing permissions, invalid enums, extra properties), resolver throws, AbortSignal pre/post-resolution, and Zod schema validation
- All 232 tests pass (204 existing + 28 new), zero regressions
- Coverage verification: `pnpm --filter @flui/core test --coverage` reports `All files 95.78%` statements; `src/context/*` files are 100% statements/lines
- Bundle budget verification: `pnpm size` reports `@flui/core` at `4.05 kB` minified+gzipped (limit: `25 kB`)
- Biome lint: zero errors

### Change Log

- 2026-02-25: Implemented Story 3.2 — Built-in context providers for identity and environment. Added context/ module with ContextProvider interface, IdentityContext/EnvironmentContext types, Zod schemas, factory functions, and comprehensive tests. Added FLUI_E011/E012 error codes and 'context' error category.
- 2026-02-25: Code review fixes applied — removed dynamic Zod import in `createProvider`, completed category coverage for `'context'`, and added explicit coverage + gzipped size verification evidence.

### File List

**New files:**

- packages/core/src/context/context.types.ts
- packages/core/src/context/context.schema.ts
- packages/core/src/context/context.ts
- packages/core/src/context/context.test.ts
- packages/core/src/context/index.ts
- packages/core/src/context/providers/index.ts
- packages/core/src/context/providers/identity.ts
- packages/core/src/context/providers/environment.ts

**Modified files:**

- packages/core/src/errors/error-codes.ts
- packages/core/src/errors/index.ts
- packages/core/src/errors/errors.test.ts
- packages/core/src/index.ts
- _bmad-output/implementation-artifacts/3-2-built-in-context-providers-identity-and-environment.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Senior Developer Review (AI)

### Reviewer

Fabrice (AI code-review workflow)

### Date

2026-02-25

### Outcome

Approved

### Findings Summary

- High: 1 (coverage evidence missing) — fixed
- Medium: 3 (size-limit evidence missing, dynamic Zod import in hot path, missing `'context'` in category coverage loop) — fixed
- Low: 1 (comment wording mismatch) — accepted as non-blocking

### Fixes Applied

- Replaced dynamic `import('zod')` with static `z` usage in `packages/core/src/context/context.ts`
- Added `'context'` to category coverage iteration in `packages/core/src/errors/errors.test.ts`
- Executed and recorded coverage and gzipped bundle budget checks

### Validation Evidence

- `pnpm --filter @flui/core test --coverage` → 232 tests passed; overall statement coverage 95.78%
- `pnpm size` → `@flui/core` 4.05 kB minified+gzipped (under 25 kB limit)
- `pnpm lint` → Biome clean, zero issues
