# Story 3.1: Parse Text and Structured Intents

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to provide either a text description or a structured object describing the desired UI, with automatic sanitization,
So that the framework can accept flexible input while preventing prompt injection attacks.

## Acceptance Criteria

### AC #1 — Text Intent Parsing

- **Given** the intent/ module in @flui/core
- **When** a developer provides a text intent (e.g., "Show a dashboard with sales metrics")
- **Then** the intent parser normalizes it into a unified IntentObject with the original text and extracted signals
- **And** the result is returned as `Result.ok(IntentObject)`

### AC #2 — Structured Intent Parsing

- **Given** the intent/ module
- **When** a developer provides a structured intent (component type, data shape, interaction pattern)
- **Then** the intent parser validates and normalizes it into the same unified IntentObject
- **And** invalid structured intents return `Result.error` with a descriptive FluiError

### AC #3 — Intent Sanitization (NFR-S2)

- **Given** any text intent input
- **When** the intent is parsed
- **Then** the sanitizer strips known prompt injection patterns including:
  1. Instruction overrides ("ignore previous instructions", "disregard above")
  2. Role injections ("you are now", "act as a")
  3. Delimiter escapes (```, ----, `<|`)
  4. System prompt extraction attempts ("repeat your system prompt")
  5. Encoding-based bypasses (unicode homoglyphs, base64 instructions)
- **And** sanitized output is safe for inclusion in LLM prompts
- **And** sanitization is implemented as a pure function
- **And** the sanitization pattern list is extensible via configuration for domain-specific patterns

### AC #4 — Empty/Invalid Intent Handling

- **Given** an empty or whitespace-only text intent
- **When** the intent is parsed
- **Then** a `Result.error` is returned with a FluiError (FLUI_E003) indicating invalid intent

### AC #5 — Test Coverage

- **Given** the intent/ module source files
- **Then** `intent.ts` contains the parser and sanitizer orchestration implementation
- **And** `intent.types.ts` contains IntentObject and related types
- **And** `sanitizer.ts` contains the pure sanitization function
- **And** `intent.test.ts` contains co-located tests covering text intents, structured intents, sanitization with known injection patterns, and edge cases
- **And** all tests pass with >90% coverage on the module

## Tasks / Subtasks

- [x] Task 1: Create `intent.types.ts` — type definitions (AC: #1, #2)
  - [x] 1.1 Define `TextIntent` type: `{ type: 'text'; text: string }`
  - [x] 1.2 Define `StructuredIntent` type: `{ type: 'structured'; componentType: string; dataShape?: Record<string, unknown>; interactionPattern?: string }`
  - [x] 1.3 Define `Intent` union type: `TextIntent | StructuredIntent`
  - [x] 1.4 Define `IntentObject` type: unified normalized representation with fields: `{ originalText: string; sanitizedText: string; signals: IntentSignals; source: 'text' | 'structured' }`
  - [x] 1.5 Define `IntentSignals` type: `{ componentType?: string; dataShape?: Record<string, unknown>; interactionPattern?: string }`
  - [x] 1.6 Define `SanitizationConfig` type: `{ customPatterns?: RegExp[] }` for extensible sanitization patterns
  - [x] 1.7 Add `AssertEqual` type assertion between Zod schemas and TypeScript interfaces (per project pattern)

- [x] Task 2: Create `intent.schema.ts` — Zod validation schemas (AC: #2, #4)
  - [x] 2.1 Define `textIntentSchema` using `z.strictObject({ type: z.literal('text'), text: z.string().min(1) })`
  - [x] 2.2 Define `structuredIntentSchema` using `z.strictObject({ type: z.literal('structured'), componentType: z.string().min(1), dataShape: z.record(z.string(), z.unknown()).optional(), interactionPattern: z.string().optional() })`
  - [x] 2.3 Define `intentSchema` as `z.discriminatedUnion('type', [textIntentSchema, structuredIntentSchema])`
  - [x] 2.4 Add `AssertEqual` type assertions to ensure schema ↔ TypeScript type sync

- [x] Task 3: Create `sanitizer.ts` — pure sanitization function (AC: #3)
  - [x] 3.1 Implement `sanitizeIntent(text: string, config?: SanitizationConfig): string` as a pure function
  - [x] 3.2 Implement pattern category 1: Instruction overrides — strip phrases like "ignore previous instructions", "disregard above", "forget your instructions", "override system", "new instructions:"
  - [x] 3.3 Implement pattern category 2: Role injections — strip phrases like "you are now", "act as a", "pretend to be", "roleplay as", "your new role is"
  - [x] 3.4 Implement pattern category 3: Delimiter escapes — strip patterns like triple backticks, `----`, `<|`, `|>`, `<|endoftext|>`, `<|im_start|>`, `<|im_end|>`
  - [x] 3.5 Implement pattern category 4: System prompt extraction — strip phrases like "repeat your system prompt", "show me your instructions", "what are your rules", "output your prompt"
  - [x] 3.6 Implement pattern category 5: Encoding-based bypasses — normalize unicode homoglyphs (e.g., Cyrillic lookalikes for Latin chars), detect base64-encoded instruction blocks
  - [x] 3.7 Accept `SanitizationConfig.customPatterns` array and apply them after built-in patterns
  - [x] 3.8 Return sanitized string (trimmed, normalized whitespace)
  - [x] 3.9 Ensure function is PURE — no side effects, no external state, deterministic output

- [x] Task 4: Create `intent.ts` — parser implementation (AC: #1, #2, #3, #4)
  - [x] 4.1 Implement `parseIntent(input: Intent, config?: SanitizationConfig): Result<IntentObject, FluiError>`
  - [x] 4.2 For text intents: validate with `textIntentSchema`, trim and check for empty/whitespace → return `err(new FluiError(FLUI_E003, 'validation', '...'))` for invalid
  - [x] 4.3 For text intents: call `sanitizeIntent()` on the text, then construct `IntentObject` with `source: 'text'`, `originalText`, `sanitizedText`, and empty `signals`
  - [x] 4.4 For structured intents: validate with `structuredIntentSchema`, return `err(new FluiError(FLUI_E003, 'validation', '...'))` for invalid
  - [x] 4.5 For structured intents: construct `IntentObject` with `source: 'structured'`, synthesize `originalText` from structured fields, sanitize it, populate `signals` from structured fields
  - [x] 4.6 Use `z.treeifyError()` for error formatting (NOT `error.flatten()`) — matches project pattern from Story 2-1
  - [x] 4.7 Import error codes from `../errors` barrel only (module boundary rule)

- [x] Task 5: Create `index.ts` — barrel exports (AC: all)
  - [x] 5.1 Export `parseIntent` function
  - [x] 5.2 Export `sanitizeIntent` function
  - [x] 5.3 Export all types: `Intent`, `TextIntent`, `StructuredIntent`, `IntentObject`, `IntentSignals`, `SanitizationConfig`
  - [x] 5.4 Export Zod schemas: `intentSchema`, `textIntentSchema`, `structuredIntentSchema`
  - [x] 5.5 Use explicit named exports (never `export *` or `export default`)

- [x] Task 6: Update `packages/core/src/index.ts` — package barrel (AC: all)
  - [x] 6.1 Add intent/ module exports to the main barrel
  - [x] 6.2 Follow existing pattern: types via `export type {}`, values via `export {}`
  - [x] 6.3 Maintain alphabetical ordering of exports (Biome requirement)

- [x] Task 7: Write comprehensive tests in `intent.test.ts` (AC: #5)
  - [x] 7.1 `describe('parseIntent')` > `describe('text intents')`:
    - [x] 7.1.1 Test: valid text intent → returns `Result.ok(IntentObject)` with correct fields
    - [x] 7.1.2 Test: text intent with leading/trailing whitespace → trimmed in output
    - [x] 7.1.3 Test: empty string text intent → returns `Result.error` with FLUI_E003
    - [x] 7.1.4 Test: whitespace-only text intent → returns `Result.error` with FLUI_E003
  - [x] 7.2 `describe('parseIntent')` > `describe('structured intents')`:
    - [x] 7.2.1 Test: valid structured intent with all fields → returns `Result.ok(IntentObject)` with populated signals
    - [x] 7.2.2 Test: structured intent with only componentType → returns success with minimal signals
    - [x] 7.2.3 Test: structured intent with empty componentType → returns `Result.error` with FLUI_E003
    - [x] 7.2.4 Test: structured intent with missing required fields → returns `Result.error`
  - [x] 7.3 `describe('sanitizeIntent')`:
    - [x] 7.3.1 Test: clean text passes through unchanged (except trim/normalize)
    - [x] 7.3.2 Test: instruction override patterns stripped ("ignore previous instructions")
    - [x] 7.3.3 Test: role injection patterns stripped ("you are now a", "act as")
    - [x] 7.3.4 Test: delimiter escape patterns stripped (triple backticks, `<|endoftext|>`)
    - [x] 7.3.5 Test: system prompt extraction attempts stripped ("repeat your system prompt")
    - [x] 7.3.6 Test: unicode homoglyph normalization (Cyrillic 'а' → Latin 'a' for detection)
    - [x] 7.3.7 Test: base64-encoded instruction detection and removal
    - [x] 7.3.8 Test: custom patterns via `SanitizationConfig` are applied
    - [x] 7.3.9 Test: multiple injection patterns in same input all stripped
    - [x] 7.3.10 Test: sanitization is deterministic (same input → same output)
    - [x] 7.3.11 Test: sanitization preserves legitimate intent text around injection attempts
  - [x] 7.4 `describe('Zod schemas')`:
    - [x] 7.4.1 Test: `intentSchema` validates text intent correctly
    - [x] 7.4.2 Test: `intentSchema` validates structured intent correctly
    - [x] 7.4.3 Test: `intentSchema` rejects invalid input with proper error tree

- [x] Task 8: Build verification (AC: all)
  - [x] 8.1 `pnpm build` — must succeed, check bundle size stays < 25KB gzipped
  - [x] 8.2 `pnpm test` — all tests pass (existing 178 + new intent tests)
  - [x] 8.3 `pnpm lint` — Biome clean (zero errors)

## Dev Notes

### Module Location

`packages/core/src/intent/`

### Files to Create

```
packages/core/src/intent/
  index.ts              # Barrel exports for public API
  intent.ts             # Parser implementation (parseIntent function)
  intent.types.ts       # Type definitions (IntentObject, TextIntent, StructuredIntent, etc.)
  intent.schema.ts      # Zod schemas for intent validation
  sanitizer.ts          # Pure sanitization function (NFR-S2)
  intent.test.ts        # Co-located tests (>90% coverage)
```

### Files to Modify

```
packages/core/src/index.ts   # Add intent/ module exports to package barrel
```

### Architecture-Defined Module Structure

The architecture document explicitly defines the intent/ module structure:

```
├── intent/                   # Intent Parser
│   ├── index.ts
│   ├── intent.ts
│   ├── intent.types.ts
│   ├── sanitizer.ts          # Intent sanitization (NFR-S3)
│   └── intent.test.ts
```

**Note:** The architecture shows `sanitizer.ts` as a separate file from `intent.ts`. The sanitizer is a pure function that should be importable independently for testing and reuse. Additionally, `intent.schema.ts` should be created following the project pattern (every module that validates data has a `.schema.ts` file).

### Module Boundary Rules

```
intent/        → imports errors/ (ONLY)
```

- The intent module may ONLY import from `../errors` (barrel import)
- It does NOT import from `../spec`, `../registry`, `../types`, or any other module
- The `generation/` module will later import from `intent/` — NOT the reverse
- Zod is available as the sole runtime dependency

### Error Codes to Use

| Error Code | When to Use |
|-----------|-------------|
| `FLUI_E003` | Invalid intent: empty, malformed, or unsanitizable intent string |
| `FLUI_E005` | Schema validation failed: Zod schema validation rejected input |

- `FLUI_E003` is pre-allocated for invalid intents (see `error-codes.ts` line 22-23)
- Use `FLUI_E005` for Zod schema validation failures
- Error category: `'validation'` for all intent parsing errors

### FluiError Construction Pattern

```typescript
import { FluiError, FLUI_E003, FLUI_E005, ok, err } from '../errors';
import type { Result } from '../errors';

// For invalid/empty intent
return err(new FluiError(FLUI_E003, 'validation', 'Intent text must not be empty'));

// For Zod schema validation failure
const parseResult = intentSchema.safeParse(input);
if (!parseResult.success) {
  const tree = z.treeifyError(parseResult.error);
  return err(new FluiError(FLUI_E005, 'validation', `Invalid intent structure: ${JSON.stringify(tree)}`));
}

// For success
return ok(intentObject);
```

**CRITICAL:** Use `z.treeifyError()` for Zod errors (NOT `error.flatten()`) — this is the established project pattern from Story 2-1.

### Intent Sanitization Implementation Notes

**Security Priority (NFR-S2):** Intent sanitization is a security boundary. The sanitizer must be:
1. A **pure function** — no side effects, no external state
2. **Extensible** — custom patterns via `SanitizationConfig`
3. **Thorough** — cover all 5 injection pattern categories
4. **Non-destructive** — preserve legitimate intent text around injection patterns

**Sanitization approach:** Pattern-based removal similar to DOMPurify but for LLM prompt injection. Use regex patterns for each category. The function should normalize the text (trim, collapse whitespace) after removing injection patterns.

**Unicode homoglyph strategy:** Normalize common Cyrillic/Greek/other lookalike characters to their ASCII equivalents before running injection pattern detection. This prevents bypasses like using Cyrillic 'а' (U+0430) instead of Latin 'a' (U+0061).

**Base64 detection strategy:** Look for base64-encoded blocks (e.g., text matching `[A-Za-z0-9+/=]{20,}`) that decode to known injection patterns. Strip the encoded block if injection is detected in the decoded content.

### TypeScript Strictness Requirements

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- Zero `any` — use `unknown` where needed
- All optional properties must use `| undefined` (per `exactOptionalPropertyTypes`)
- Use `z.strictObject()` (NOT `z.object()`) for Zod schemas to reject extra keys

### Naming Conventions

| Element | Convention | This Story |
|---------|-----------|-----------|
| Module directory | `kebab-case/` | `intent/` |
| Source files | `kebab-case.ts` | `intent.ts`, `sanitizer.ts` |
| Types file | `{module}.types.ts` | `intent.types.ts` |
| Schema file | `{module}.schema.ts` | `intent.schema.ts` |
| Test file | `{source}.test.ts` | `intent.test.ts` |
| Interfaces/Types | `PascalCase` | `IntentObject`, `TextIntent`, `StructuredIntent` |
| Functions | `camelCase`, verb-first | `parseIntent()`, `sanitizeIntent()` |
| Zod schemas | `camelCase` + `Schema` suffix | `textIntentSchema`, `structuredIntentSchema` |
| Constants | `SCREAMING_SNAKE_CASE` | (none needed for this story) |

### Testing Pattern (from established codebase)

```typescript
import { describe, expect, it } from 'vitest';
import { parseIntent, sanitizeIntent, intentSchema } from './index';
import type { Intent, TextIntent, StructuredIntent, IntentObject } from './index';
import { isOk, isError, FLUI_E003 } from '../errors';

// Import from barrel (./index), never from internal files
// Use describe() > describe() > it() nesting
// Test both Result.ok and Result.error paths
// No any/unknown in assertions — assert specific types
```

### Cross-Story Context

- **Story 3.2** (Built-in Context Providers) will create the `context/` module — independent of this story, can be developed in parallel
- **Story 3.3** (Custom Context Providers & Context Aggregation) depends on 3.2, not on this story
- **Story 4.2** (Prompt Construction & Generation Orchestrator) will consume `parseIntent()` output — the `IntentObject` is part of the generation pipeline input
- **Cache key computation** (Epic 7): `hash(intent + context + registryVersion + specVersion)` — the `sanitizedText` from `IntentObject` feeds into cache key hashing

### Project Structure Notes

- New module `intent/` created within `packages/core/src/` — follows established module pattern
- Module boundary: only imports from `../errors` barrel
- No new npm dependencies required — uses Zod 4.3.6 (already installed) and built-in regex
- Bundle size impact should be minimal (~2-3KB added) — well within 25KB gzipped limit
- All 178 existing tests must continue to pass (zero regressions)

### Previous Story Intelligence (Story 2-3: Registry Serialization)

**Key learnings from Story 2-3:**
- `z.treeifyError()` is the correct Zod error formatting function (not `flatten()`)
- Biome flags non-null assertions — avoid `!` operator in production code and tests
- Import from barrel files only (`./index`), never internal files
- `AssertEqual` type assertion pattern ensures schema ↔ type sync
- Module boundary strictly enforced — registry only imports from `../errors`
- Build output after 2-3: ESM 12.31 KB, CJS 14.73 KB — headroom for intent module
- All 178 tests passing — must not regress
- Coverage >90% on module required for AC

**Key patterns:**
- `FluiError` uses positional args: `new FluiError(FLUI_E003, 'validation', 'message')`
- Optional 4th arg for context/cause: `new FluiError(code, cat, msg, { context: {...} })`
- `ok(value)` for success, `err(new FluiError(...))` for failure
- Tests import from `'./index'` (barrel), NOT from internal files
- `z.strictObject()` preferred over `z.object()` to reject extra properties

### Git Intelligence

Recent commits (pattern: `feat: <description> (story X-Y)`):
```
7ed5944 feat: implement registry serialization for LLM prompts (story 2-3)
d4ba089 feat: implement batch registration and registry querying (story 2-2)
ff65f9b feat: implement CI/CD pipelines and component registry (stories 1-5, 2-1)
2110a5c feat: implement shared types and LLMConnector interface (story 1-4)
36ddbc8 feat: implement FluiError class and Result pattern (story 1-3)
```

Expected commit message for this story: `feat: implement text and structured intent parsing with sanitization (story 3-1)`

### Build Verification

After implementation, verify:
```bash
pnpm build          # Must succeed, check bundle size stays < 25KB gzipped
pnpm test           # All tests pass (existing 178 + new intent tests)
pnpm lint           # Biome clean (zero errors)
```

Current build output from Story 2-3: @flui/core ESM 12.31 KB, CJS 14.73 KB — intent module should add ~2-3KB.

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 3, Story 3.1]
- [Source: _bmad-output/planning-artifacts/architecture.md — Intent Parser module structure, lines 566-571]
- [Source: _bmad-output/planning-artifacts/architecture.md — Module Boundaries, intent/ → imports errors/, line 796]
- [Source: _bmad-output/planning-artifacts/architecture.md — File Naming Conventions, lines 267-293]
- [Source: _bmad-output/planning-artifacts/architecture.md — Result Pattern and Error Handling, lines 340-368]
- [Source: _bmad-output/planning-artifacts/architecture.md — Intent Sanitization (NFR-S3), line 196]
- [Source: _bmad-output/planning-artifacts/architecture.md — AbortSignal Propagation, lines 420-428]
- [Source: _bmad-output/planning-artifacts/architecture.md — Trace Enrichment Pattern, lines 372-380]
- [Source: _bmad-output/planning-artifacts/architecture.md — Generation Pipeline Data Flow, lines 843-903]
- [Source: _bmad-output/planning-artifacts/prd.md — FR1: Text intent, FR2: Structured intent, FR7: Sanitization]
- [Source: _bmad-output/planning-artifacts/epics.md — NFR-S2: Intent Parser sanitizes user-provided text]
- [Source: packages/core/src/errors/error-codes.ts — FLUI_E003: Invalid intent]
- [Source: packages/core/src/errors/flui-error.ts — FluiError class constructor pattern]
- [Source: packages/core/src/errors/result.ts — Result type and ok/err helpers]
- [Source: _bmad-output/implementation-artifacts/2-3-registry-serialization-for-llm-prompts.md — Previous Story Intelligence]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- Initial lint run had 5 Biome issues (import ordering, formatting, unused import) — all fixed in single pass

### Completion Notes List

- Implemented intent/ module with 6 source files following established project patterns
- Created `intent.types.ts` with all type definitions (TextIntent, StructuredIntent, Intent, IntentObject, IntentSignals, SanitizationConfig) using `| undefined` for optional properties per `exactOptionalPropertyTypes`
- Created `intent.schema.ts` with Zod `z.strictObject()` schemas and `z.discriminatedUnion()`, plus AssertEqual type assertions for schema ↔ type sync
- Created `sanitizer.ts` as a pure function covering all 5 injection pattern categories: instruction overrides, role injections, delimiter escapes, system prompt extraction, encoding-based bypasses (unicode homoglyphs + base64 detection). Extensible via `SanitizationConfig.customPatterns`
- Created `intent.ts` with `parseIntent()` using `z.treeifyError()` for error formatting, FLUI_E005 for Zod validation failures, FLUI_E003 for empty/whitespace intents
- Created barrel `index.ts` with explicit named exports (no `export *`)
- Updated `packages/core/src/index.ts` with intent/ module exports (types via `export type {}`, values via `export {}`, alphabetical ordering)
- 26 new tests in `intent.test.ts` covering text intents, structured intents, sanitization (all 5 categories + custom patterns + determinism + preservation of legitimate text), and Zod schema validation
- All 204 tests pass (178 existing + 26 new), zero regressions
- Build: ESM 17.78 KB, CJS 20.54 KB (added ~5.5 KB from intent module, within 25KB gzipped limit)
- Biome lint: zero errors
- Code review fix: `parseIntent()` now returns `FLUI_E003` for empty text intents before schema validation, matching AC #4
- Code review fix: updated empty-text test assertion to validate `FLUI_E003`

### File List

- `packages/core/src/intent/intent.types.ts` (new) — Type definitions
- `packages/core/src/intent/intent.schema.ts` (new) — Zod validation schemas with AssertEqual assertions
- `packages/core/src/intent/sanitizer.ts` (new) — Pure sanitization function (NFR-S2)
- `packages/core/src/intent/intent.ts` (new) — Parser implementation (parseIntent)
- `packages/core/src/intent/index.ts` (new) — Barrel exports
- `packages/core/src/intent/intent.test.ts` (new) — 26 comprehensive tests
- `packages/core/src/index.ts` (modified) — Added intent/ module exports
- `_bmad-output/implementation-artifacts/3-1-parse-text-and-structured-intents.md` (modified) — Review findings and status update
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) — Synced story status

### Senior Developer Review (AI)

- Review date: 2026-02-25
- Outcome: Changes Requested -> Fixed
- High issues fixed: 2
- Medium issues fixed: 2
- Low issues remaining: 1 (sanitizer over-normalization risk noted for future hardening)
- Verification: `pnpm build`, `pnpm test`, `pnpm lint`, and intent-module coverage run completed successfully

## Change Log

- 2026-02-25: Implemented intent/ module with text and structured intent parsing, sanitization (5 injection pattern categories), Zod schema validation, and 26 tests. All 204 tests pass, build and lint clean.
- 2026-02-25: Code review fixes applied — corrected empty-text intent error code to `FLUI_E003`, aligned tests, updated review documentation, and synced sprint status.
