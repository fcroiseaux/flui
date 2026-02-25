# Story 4.1: LLM Connector Interface & OpenAI/Anthropic Implementations

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to connect any LLM provider via a simple connector interface with ready-made OpenAI and Anthropic implementations,
So that I can use my preferred LLM provider without being locked into a specific vendor.

## Acceptance Criteria

### AC1: OpenAI Connector Package

Given the @flui/openai package,
When a developer creates an OpenAI connector with an API key in constructor config,
Then the connector implements the LLMConnector interface with `generate(prompt, options, signal)`,
And the API key is passed through to the OpenAI SDK and never stored, logged, or persisted by flui (NFR-S6),
And the implementation is under 100 lines (NFR-I1).

### AC2: Anthropic Connector Package

Given the @flui/anthropic package,
When a developer creates an Anthropic connector with an API key in constructor config,
Then the connector implements the LLMConnector interface with `generate(prompt, options, signal)`,
And the API key is passed through to the Anthropic SDK and never stored, logged, or persisted by flui (NFR-S6),
And the implementation is under 100 lines (NFR-I1).

### AC3: Abort Signal Handling

Given either connector,
When an AbortSignal is provided and aborted during a `generate()` call,
Then the in-flight LLM request is cancelled,
And the function returns `Result.error` with a FluiError indicating cancellation (FLUI_E010, category: 'connector').

### AC4: Error Handling (Timeout, Rate Limit, Network)

Given either connector,
When the LLM provider returns an error (timeout, rate limit, network error),
Then the connector returns `Result.error` with a FluiError containing the error details and cause,
And the error category is "connector" (FLUI_E014).

### AC5: Success Response

Given either connector,
When `generate()` succeeds,
Then it returns `Result.ok(LLMResponse)` containing the content, model, and usage token counts,
And the response is declarative text only — no executable code paths (NFR-S1).

### AC6: Testing & Bundle Size

Given connector packages,
Then each package has co-located tests using mocked provider SDKs,
And tests cover success, cancellation, timeout, rate limit, and network error scenarios,
And each connector bundle is < 3KB gzipped (NFR-P8),
And tests achieve >90% code coverage.

## Tasks / Subtasks

- [x] Task 1: Add new error code FLUI_E014 for connector errors (AC: #4)
  - [x] 1.1 Add `FLUI_E014` constant to `packages/core/src/errors/error-codes.ts`
  - [x] 1.2 Add to `DefinedFluiErrorCode` union type
  - [x] 1.3 Add to `ERROR_CODE_DESCRIPTIONS` map
  - [x] 1.4 Export from `packages/core/src/errors/index.ts`
  - [x] 1.5 Re-export from `packages/core/src/index.ts`
  - [x] 1.6 Update error count test in `packages/core/src/errors/errors.test.ts` (13 → 14)
- [x] Task 2: Implement OpenAI connector (AC: #1, #3, #4, #5)
  - [x] 2.1 Create `packages/openai/src/openai.types.ts` with `OpenAIConnectorConfig`
  - [x] 2.2 Create `packages/openai/src/connector.ts` with `OpenAIConnectorImpl` class (76 lines, < 100)
  - [x] 2.3 Update `packages/openai/src/index.ts` barrel with `createOpenAIConnector` factory + type exports
  - [x] 2.4 Add `openai` SDK as devDependency for testing
- [x] Task 3: Implement Anthropic connector (AC: #2, #3, #4, #5)
  - [x] 3.1 Create `packages/anthropic/src/anthropic.types.ts` with `AnthropicConnectorConfig`
  - [x] 3.2 Create `packages/anthropic/src/connector.ts` with `AnthropicConnectorImpl` class (74 lines, < 100)
  - [x] 3.3 Update `packages/anthropic/src/index.ts` barrel with `createAnthropicConnector` factory + type exports
  - [x] 3.4 Add `@anthropic-ai/sdk` as devDependency for testing
- [x] Task 4: Write OpenAI connector tests (AC: #6)
  - [x] 4.1 Create `packages/openai/src/connector.test.ts`
  - [x] 4.2 Test success path with mocked `client.chat.completions.create()`
  - [x] 4.3 Test AbortSignal cancellation (pre-check + mid-flight)
  - [x] 4.4 Test timeout error wrapping
  - [x] 4.5 Test rate limit (429) error wrapping
  - [x] 4.6 Test network error wrapping
  - [x] 4.7 Test missing API key throws at construction time
  - [x] 4.8 Remove placeholder test in `index.test.ts`, or update to test real exports
- [x] Task 5: Write Anthropic connector tests (AC: #6)
  - [x] 5.1 Create `packages/anthropic/src/connector.test.ts`
  - [x] 5.2 Test success path with mocked `client.messages.create()`
  - [x] 5.3 Test AbortSignal cancellation (pre-check + mid-flight)
  - [x] 5.4 Test timeout error wrapping
  - [x] 5.5 Test rate limit (429) error wrapping
  - [x] 5.6 Test network error wrapping
  - [x] 5.7 Test missing API key throws at construction time
  - [x] 5.8 Remove placeholder test in `index.test.ts`, or update to test real exports
- [x] Task 6: Verify build, bundle size, and coverage (AC: #6)
  - [x] 6.1 Run `pnpm build` — all packages must compile
  - [x] 6.2 Run `pnpm test` — all 274 tests pass (246 existing + 28 new, zero regressions)
  - [x] 6.3 Run `pnpm --filter @flui/openai test --coverage` — 94.11% coverage (>90%)
  - [x] 6.4 Run `pnpm --filter @flui/anthropic test --coverage` — 94.44% coverage (>90%)
  - [x] 6.5 Run `pnpm size` — @flui/openai 908B < 3KB, @flui/anthropic 887B < 3KB
  - [x] 6.6 Run `pnpm lint` — zero Biome errors

## Dev Notes

### Existing LLMConnector Interface (DO NOT MODIFY)

The `LLMConnector` interface is already defined in `packages/core/src/types.ts` (Story 1-4). Connectors MUST implement this exact contract:

```typescript
interface LLMConnector {
  generate(
    prompt: string,
    options: LLMRequestOptions,
    signal?: AbortSignal,
  ): Promise<Result<LLMResponse>>;
}

interface LLMRequestOptions {
  model: string;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  responseFormat?: 'json' | 'text' | undefined;
}

interface LLMResponse {
  content: string;      // Generated text
  model: string;        // Model identifier used
  usage: LLMUsage;      // Token counts
}

interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
```

**CRITICAL:** Do NOT modify `packages/core/src/types.ts`. Connector packages implement the interface — they do not define it.

### Result Pattern (MUST USE)

Located in `packages/core/src/errors/result.ts`:

```typescript
import { ok, err } from '@flui/core';
import { FluiError, FLUI_E010, FLUI_E014 } from '@flui/core';
import type { Result } from '@flui/core';

// Success
return ok({ content: '...', model: 'gpt-4o', usage: { ... } });

// Error
return err(new FluiError(FLUI_E014, 'connector', 'OpenAI API error: rate limited', {
  cause: originalError instanceof Error ? originalError : undefined,
  context: { model: options.model, status: 429 },
}));
```

**NEVER throw from `generate()`.** Always return `Result.error` for provider failures.

### Error Code Allocation

Add **one new error code** in `packages/core/src/errors/error-codes.ts`:

| Code | Category | Description |
|------|----------|-------------|
| `FLUI_E014` | connector | LLM provider API error: timeout, rate limit, network, or authentication failure |

Reuse existing `FLUI_E010` (category: 'connector') for AbortSignal cancellation. Note: E010 was originally category 'context' but can be used with category 'connector' since the FluiError constructor accepts any valid category.

### OpenAI SDK v6 Integration Pattern

**SDK:** `openai` package (v6.x, peer dependency `>=4.0.0`)

```typescript
import OpenAI from 'openai';

// Client construction — apiKey passed directly, never stored
const client = new OpenAI({ apiKey: config.apiKey });

// Generate call
const response = await client.chat.completions.create(
  {
    model: options.model,
    messages: [{ role: 'user', content: prompt }],
    temperature: options.temperature ?? undefined,
    max_tokens: options.maxTokens ?? undefined,
    response_format: options.responseFormat === 'json'
      ? { type: 'json_object' }
      : undefined,
  },
  { signal },  // AbortSignal passed as request option
);

// Response mapping to LLMResponse
const choice = response.choices[0];
return ok({
  content: choice?.message.content ?? '',
  model: response.model,
  usage: {
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    totalTokens: response.usage?.total_tokens ?? 0,
  },
});
```

**Error types:** `OpenAI.APIError` has `.status` (number), `.message` (string), `.error` (object).

### Anthropic SDK v0.78 Integration Pattern

**SDK:** `@anthropic-ai/sdk` package (v0.78.x, peer dependency `>=0.30.0`)

```typescript
import Anthropic from '@anthropic-ai/sdk';

// Client construction — apiKey passed directly, never stored
const client = new Anthropic({ apiKey: config.apiKey });

// Generate call
const message = await client.messages.create(
  {
    model: options.model,
    max_tokens: options.maxTokens ?? 4096,
    messages: [{ role: 'user', content: prompt }],
    temperature: options.temperature ?? undefined,
  },
  { signal },  // AbortSignal passed as request option
);

// Response mapping to LLMResponse
const textBlock = message.content.find((block) => block.type === 'text');
return ok({
  content: textBlock?.text ?? '',
  model: message.model,
  usage: {
    promptTokens: message.usage.input_tokens,
    completionTokens: message.usage.output_tokens,
    totalTokens: message.usage.input_tokens + message.usage.output_tokens,
  },
});
```

**Error types:** `Anthropic.APIError` has `.status` (number), `.message` (string).

**CRITICAL Anthropic difference:** `max_tokens` is REQUIRED (not optional). Default to 4096 if `options.maxTokens` is undefined.

### AbortSignal Handling Pattern

Established dual-check pattern from Epic 3 (context-engine.ts):

```typescript
async generate(prompt, options, signal?) {
  // Check 1: Before making the API call
  if (signal?.aborted) {
    return err(new FluiError(FLUI_E010, 'connector', 'Generation cancelled'));
  }

  try {
    const response = await providerClient.create({ ... }, { signal });

    // Check 2: After async call (cooperative cancellation)
    if (signal?.aborted) {
      return err(new FluiError(FLUI_E010, 'connector', 'Generation cancelled'));
    }

    return ok({ ... });
  } catch (caught: unknown) {
    // Handle abort errors from provider SDK
    if (signal?.aborted) {
      return err(new FluiError(FLUI_E010, 'connector', 'Generation cancelled'));
    }
    // Wrap provider error
    return err(new FluiError(FLUI_E014, 'connector', `Provider error: ${errorMessage}`, {
      cause: caught instanceof Error ? caught : undefined,
      context: { model: options.model },
    }));
  }
}
```

### Provider Error Wrapping

Both SDKs throw `APIError` subclasses. Wrap them uniformly:

```typescript
function wrapProviderError(caught: unknown, signal?: AbortSignal): FluiError {
  if (signal?.aborted) {
    return new FluiError(FLUI_E010, 'connector', 'Generation cancelled');
  }

  const message = caught instanceof Error ? caught.message : String(caught);
  const status = isAPIError(caught) ? caught.status : undefined;

  return new FluiError(FLUI_E014, 'connector', `LLM provider error: ${message}`, {
    cause: caught instanceof Error ? caught : undefined,
    context: { ...(status !== undefined && { status }) },
  });
}
```

### Factory Function Pattern (NOT class export)

Export factory functions, not classes. This is the established flui pattern:

```typescript
// ✓ CORRECT
export function createOpenAIConnector(config: OpenAIConnectorConfig): LLMConnector { ... }

// ✗ WRONG — do not export class directly
export class OpenAIConnector implements LLMConnector { ... }
```

The class itself is internal (not exported). Only the factory + config type are public API.

### Configuration Types

Each connector has its own config type:

```typescript
// packages/openai/src/openai.types.ts
export interface OpenAIConnectorConfig {
  apiKey: string;
  baseURL?: string | undefined;     // Custom endpoint (proxies, testing)
  timeout?: number | undefined;      // Request timeout in ms
}

// packages/anthropic/src/anthropic.types.ts
export interface AnthropicConnectorConfig {
  apiKey: string;
  baseURL?: string | undefined;
  timeout?: number | undefined;
}
```

**Validation:** Throw synchronously at construction time if `apiKey` is empty/missing. This is a programmer error (NFR-R6: surface config errors at init, not first call).

### Trace Enrichment Note

Story 4-1 connectors do NOT add trace steps directly. Trace enrichment is the responsibility of the generation orchestrator (Story 4-2), which wraps connector calls with timing. The `GenerationTrace` type and `createTrace()` are available in `@flui/core` for reference but not used by connectors.

### Implementation Size Constraint

**NFR-I1:** Each connector implementation MUST be under 100 lines (including imports, types, error handling, and the generate() function). The factory function + class implementation in `connector.ts` must fit within this budget.

### Bundle Size Constraint

**NFR-P8:** Each connector package must be < 3KB gzipped. Since provider SDKs (`openai`, `@anthropic-ai/sdk`) are peer dependencies, they are NOT counted in the bundle. Only the connector's own code counts. Verified by `.size-limit.json`:

```json
{ "name": "@flui/openai", "path": "packages/openai/dist/index.js", "limit": "3 kB", "gzip": true }
{ "name": "@flui/anthropic", "path": "packages/anthropic/dist/index.js", "limit": "3 kB", "gzip": true }
```

### Project Structure Notes

**File structure for BOTH connector packages follows the same pattern:**

```
packages/openai/                          packages/anthropic/
├── src/                                  ├── src/
│   ├── openai.types.ts                   │   ├── anthropic.types.ts
│   ├── connector.ts                      │   ├── connector.ts
│   ├── connector.test.ts                 │   ├── connector.test.ts
│   ├── index.test.ts (update/remove)     │   ├── index.test.ts (update/remove)
│   └── index.ts (update barrel)          │   └── index.ts (update barrel)
├── package.json (add SDK devDep)         ├── package.json (add SDK devDep)
├── tsconfig.json (no changes)            ├── tsconfig.json (no changes)
└── tsup.config.ts (no changes)           └── tsup.config.ts (no changes)
```

**Also modify in @flui/core:**

```
packages/core/src/errors/
├── error-codes.ts     (add FLUI_E014)
├── index.ts           (export FLUI_E014)
└── errors.test.ts     (update count 13 → 14)

packages/core/src/
└── index.ts           (re-export FLUI_E014)
```

**File naming:** kebab-case for files, PascalCase for interfaces, camelCase for functions. Test files co-located as `{source}.test.ts`.

**Barrel exports:** Explicit named exports only. No `export *`. No `export default`.

```typescript
// packages/openai/src/index.ts
export type { OpenAIConnectorConfig } from './openai.types';
export { createOpenAIConnector } from './connector';
```

### Testing Pattern

Follow the established project testing pattern from Epic 3:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { isOk, isError, FLUI_E010, FLUI_E014 } from '@flui/core';
import { createOpenAIConnector } from './index';

// Mock the provider SDK module
vi.mock('openai', () => ({
  default: vi.fn(),
}));

describe('OpenAIConnector', () => {
  describe('generate()', () => {
    it('returns Result.ok with LLMResponse on success', async () => {
      // Arrange: mock client.chat.completions.create to resolve
      // Act: call connector.generate()
      // Assert:
      const result = await connector.generate(prompt, options);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect(result.value.content).toBe('...');
      expect(result.value.usage.promptTokens).toBeGreaterThan(0);
    });

    it('returns FLUI_E010 when AbortSignal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      const result = await connector.generate(prompt, options, controller.signal);
      expect(isError(result)).toBe(true);
      if (!isError(result)) return;
      expect(result.error.code).toBe(FLUI_E010);
      expect(result.error.category).toBe('connector');
    });

    it('returns FLUI_E014 on rate limit (429)', async () => {
      // Mock SDK to throw APIError with status 429
      const result = await connector.generate(prompt, options);
      expect(isError(result)).toBe(true);
      if (!isError(result)) return;
      expect(result.error.code).toBe(FLUI_E014);
      expect(result.error.category).toBe('connector');
      expect(result.error.cause).toBeInstanceOf(Error);
    });
  });
});
```

**Testing rules:**
- Import from barrel (`./index`), never internal files — except for `connector.test.ts` which tests the connector directly
- Use `isOk()` / `isError()` type guards with control flow narrows
- Mock provider SDKs — NEVER make real API calls
- Assert specific error codes, not just truthiness
- Use `vi.mock()` for module-level mocking of `openai` and `@anthropic-ai/sdk`
- >90% coverage per package

**Mocking SDK Pattern:**

For OpenAI, mock the `OpenAI` default export as a class whose prototype chain includes `chat.completions.create`:

```typescript
const mockCreate = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));
```

For Anthropic, mock the `Anthropic` default export similarly:

```typescript
const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));
```

### TypeScript Strictness Requirements

The project uses strict TypeScript (`tsconfig.base.json`):
- `strict: true` — no implicit any
- `noUncheckedIndexedAccess: true` — must guard indexed access
- `exactOptionalPropertyTypes: true` — optional props need explicit `| undefined`
- `verbatimModuleSyntax: true` — must use `import type` for type-only imports
- Zero `any` in public API

**Example of correct type-only import:**
```typescript
import type { LLMConnector, LLMRequestOptions, LLMResponse, Result } from '@flui/core';
import { ok, err, FluiError, FLUI_E010, FLUI_E014 } from '@flui/core';
```

### Previous Story Intelligence

**From Story 3-3 (most recent):**
- AbortSignal requires dual checks: before AND after async operations
- `Promise.allSettled()` over `Promise.all()` when partial results are useful
- Guard-based null checks (not `!`) per `noUncheckedIndexedAccess`
- Error test requires exact count assertion — update from 13 to 14 when adding FLUI_E014

**From Story 3-2:**
- `z.treeifyError()` is the correct Zod error formatting (not `flatten()` or `prettifyError()`) — not directly relevant but good to know
- Biome import ordering auto-fixed with `pnpm lint --write` — expected behavior
- Error code count tests must be updated when adding new codes

**From Story 3-1:**
- Tests should import from barrel (`./index`), never internal files
- Pure functions preferred for testability
- Sanitizer is pure — connector `generate()` is not pure (side effects) but error wrapping helpers should be

### Git Intelligence

**Recent commits (latest first):**
1. `9dd2d91` — Story 3-3: Custom context providers and context aggregation engine
2. `1d02118` — Story 3-2: Built-in context providers for identity and environment
3. `1bc6030` — Story 3-1: Text and structured intent parsing with sanitization
4. `7ed5944` — Story 2-3: Registry serialization for LLM prompts
5. `d4ba089` — Story 2-2: Batch registration and registry querying

**Patterns established:**
- Each story is a single commit with descriptive message
- All 246 existing tests pass before and after each story
- Bundle size remains within limits (core currently 6.5KB of 25KB limit)
- Biome lint passes clean after `pnpm lint --write` for import ordering

### Latest SDK Technical Information

**OpenAI SDK (`openai` v6.25.0):**
- Latest stable major version: v6
- Client: `new OpenAI({ apiKey })` — default import
- Chat API: `client.chat.completions.create({ model, messages, ... }, { signal })`
- AbortSignal: second argument object `{ signal }`
- Error class: `OpenAI.APIError` with `.status`, `.message`
- Token usage: `response.usage?.prompt_tokens`, `response.usage?.completion_tokens`, `response.usage?.total_tokens`
- Choice access: `response.choices[0]?.message.content` (guard with `?.`)
- JSON mode: `response_format: { type: 'json_object' }`

**Anthropic SDK (`@anthropic-ai/sdk` v0.78.0):**
- Latest version: v0.78.0
- Client: `new Anthropic({ apiKey })` — default import
- Messages API: `client.messages.create({ model, max_tokens, messages, ... }, { signal })`
- **CRITICAL:** `max_tokens` is REQUIRED — default to 4096
- AbortSignal: second argument object `{ signal }`
- Error class: `Anthropic.APIError` with `.status`, `.message`
- Token usage: `message.usage.input_tokens`, `message.usage.output_tokens` (no `total_tokens` — compute manually)
- Content access: `message.content.find(b => b.type === 'text')?.text` (content is array of blocks)
- No `response_format` equivalent — use prompt instructions for JSON output

### References

- [Source: packages/core/src/types.ts] — LLMConnector, LLMRequestOptions, LLMResponse, LLMUsage interfaces
- [Source: packages/core/src/errors/error-codes.ts] — Error codes FLUI_E001–FLUI_E013, ErrorCategory type
- [Source: packages/core/src/errors/flui-error.ts] — FluiError class with code, category, context, cause
- [Source: packages/core/src/errors/result.ts] — Result<T,E>, ok(), err(), isOk(), isError()
- [Source: packages/openai/package.json] — Peer deps: @flui/core, openai >=4.0.0
- [Source: packages/anthropic/package.json] — Peer deps: @flui/core, @anthropic-ai/sdk >=0.30.0
- [Source: .size-limit.json] — Bundle limits: @flui/openai < 3KB, @flui/anthropic < 3KB
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-4] — Story 4.1 acceptance criteria
- [Source: _bmad-output/planning-artifacts/architecture.md] — NFR-I1, NFR-S6, NFR-P8, connector patterns
- [Source: _bmad-output/planning-artifacts/prd.md] — FR18, NFR-S1, NFR-S6
- [Web: OpenAI Node SDK v6](https://github.com/openai/openai-node) — API patterns, error handling
- [Web: Anthropic TypeScript SDK v0.78](https://github.com/anthropics/anthropic-sdk-typescript) — API patterns, error handling

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- TypeScript `exactOptionalPropertyTypes` required using `ChatCompletionCreateParamsNonStreaming` / `MessageCreateParamsNonStreaming` explicit types instead of inline object literals with optional undefined properties
- SDK mocks required using class syntax (`class MockOpenAI { ... }`) instead of `vi.fn().mockImplementation()` because SDKs are instantiated with `new`
- `.size-limit.json` needed `ignore` arrays for peer deps (`openai`, `@anthropic-ai/sdk`, `@flui/core`) to exclude SDK size from bundle measurements
- Biome auto-fixed import ordering with `npx biome check --write .`

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created
- FLUI_E014 error code added to @flui/core (connector category: timeout, rate limit, network, auth failures)
- OpenAI connector implemented: 76 lines, factory pattern, dual AbortSignal checks, Result-based error handling
- Anthropic connector implemented: 74 lines, factory pattern, max_tokens defaults to 4096, Result-based error handling
- 28 new tests added (13 per connector package): success, cancellation, timeout, rate limit, network error, non-Error wrapping, missing API key
- Both connectors achieve >90% coverage (94.11% and 94.44% respectively)
- Bundle sizes: @flui/openai 908B, @flui/anthropic 887B (both well under 3KB limit)
- All 274 tests pass across all packages (zero regressions)
- Code review fixes applied: missing API key now throws `FLUI_E002` (`config`) at construction for both connectors, including whitespace-only key rejection
- Code review fixes applied: provider error wrapping now carries provider `status` when available for timeout/rate-limit/network diagnostics

### File List

**Files CREATED:**
- `packages/openai/src/openai.types.ts`
- `packages/openai/src/connector.ts`
- `packages/openai/src/connector.test.ts`
- `packages/anthropic/src/anthropic.types.ts`
- `packages/anthropic/src/connector.ts`
- `packages/anthropic/src/connector.test.ts`

**Files MODIFIED:**
- `packages/core/src/errors/error-codes.ts` (added FLUI_E014 constant, union type, description)
- `packages/core/src/errors/index.ts` (export FLUI_E014)
- `packages/core/src/index.ts` (re-export FLUI_E014)
- `packages/core/src/errors/errors.test.ts` (updated error count 13 → 14)
- `packages/openai/src/connector.ts` (review fix: constructor uses `FLUI_E002` + whitespace key validation + status in wrapped provider error context)
- `packages/openai/src/connector.test.ts` (review fix: constructor assertions updated to `FLUI_E002/config`, plus rate-limit status context assertion)
- `packages/openai/src/index.ts` (updated barrel: createOpenAIConnector + OpenAIConnectorConfig)
- `packages/openai/src/index.test.ts` (replaced placeholder with real export test)
- `packages/openai/package.json` (added openai ^6.25.0 as devDependency)
- `packages/anthropic/src/connector.ts` (review fix: constructor uses `FLUI_E002` + whitespace key validation + status in wrapped provider error context)
- `packages/anthropic/src/connector.test.ts` (review fix: constructor assertions updated to `FLUI_E002/config`, plus rate-limit status context assertion)
- `packages/anthropic/src/index.ts` (updated barrel: createAnthropicConnector + AnthropicConnectorConfig)
- `packages/anthropic/src/index.test.ts` (replaced placeholder with real export test)
- `packages/anthropic/package.json` (added @anthropic-ai/sdk ^0.78.0 as devDependency)
- `.size-limit.json` (added ignore arrays for peer dependencies)
- `pnpm-lock.yaml` (lockfile updates from connector package dependency changes)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (story status sync to `done`)

**Files NOT touched:**
- `packages/core/src/types.ts` — LLMConnector interface already defined
- `packages/*/tsconfig.json` — no changes needed
- `packages/*/tsup.config.ts` — no changes needed

## Senior Developer Review (AI)

### Reviewer

Fabrice (AI Code Review Workflow) — 2026-02-25

### Outcome

Approve

### Findings and Resolution

- HIGH: AC4 error detail propagation was partial (provider status missing in wrapped errors). **Fixed** in `packages/openai/src/connector.ts` and `packages/anthropic/src/connector.ts` by enriching `FluiError.context` with provider `status` when available.
- HIGH: Constructor API-key validation used runtime provider error code (`FLUI_E014`) instead of config/init error semantics. **Fixed** by switching to `FLUI_E002` with `config` category in both connectors.
- MEDIUM: Whitespace-only API keys were accepted. **Fixed** via `trim().length === 0` validation in both connector constructors.
- MEDIUM: Story File List omitted `pnpm-lock.yaml` and `sprint-status.yaml`. **Fixed** by updating File List documentation.
- LOW: Tests did not assert provider status propagation for rate-limit failures. **Fixed** in both connector test suites.

### Validation Evidence

- `pnpm --filter @flui/openai test` passed (13 tests)
- `pnpm --filter @flui/anthropic test` passed (13 tests)
- `pnpm --filter @flui/openai test --coverage` passed (94.11%)
- `pnpm --filter @flui/anthropic test --coverage` passed (94.44%)
- `pnpm lint` passed
- `pnpm build` passed
- `pnpm test` passed
- `pnpm size` passed (@flui/openai 908B, @flui/anthropic 887B)

## Change Log

- 2026-02-25: Story 4-1 implementation complete. Added FLUI_E014 error code, implemented OpenAI and Anthropic connectors with factory pattern, dual AbortSignal checks, and comprehensive test suites (28 new tests, >90% coverage). Updated .size-limit.json to properly exclude peer dependencies from bundle measurement.
- 2026-02-25: Senior code review completed and issues fixed. Corrected constructor API-key error taxonomy to `FLUI_E002/config`, added whitespace key rejection, enriched connector provider errors with `status` context, expanded tests to assert status propagation, and reconciled story File List with actual git changes.
