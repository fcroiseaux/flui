# Story 4.3: Streaming Generation & Progressive Spec Construction

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the system to stream LLM responses and progressively build the UISpecification,
So that users see faster perceived responsiveness as the UI specification builds incrementally.

## Acceptance Criteria

### AC1: Progressive Token Reception (FR17)

Given the generation/ module,
When a streaming-capable LLM connector is used,
Then the orchestrator can receive tokens progressively from the connector,
And the spec parser incrementally constructs the UISpecification as tokens arrive.

### AC2: Progress Callback API (FR17)

Given a streaming generation in progress,
When enough tokens have been received to form a partial valid structure,
Then intermediate progress is reported via an `onProgress(partialSpec: Partial<UISpecification>)` callback provided by the caller,
And the callback is invoked each time a new component or section is parsed from the stream,
And the final complete UISpecification is returned as Result.ok when streaming completes.

### AC3: Streaming Latency Targets

Given streaming latency requirements,
Then time-to-first-progress-callback targets P50 < 100ms (excluding LLM network time),
And subsequent progress callbacks arrive at < 50ms intervals as tokens are received.

### AC4: Stream Abort & Cancellation

Given a streaming generation,
When the stream is aborted via AbortSignal,
Then the stream is cancelled cleanly with no orphaned promises or memory leaks,
And Result.error is returned indicating cancellation.

### AC5: Malformed Stream Handling

Given a streaming generation,
When the stream produces a malformed response,
Then the parse failure is detected and Result.error is returned,
And the GenerationTrace captures the streaming duration and failure point.

### AC6: Testing & Coverage

Given streaming generation,
Then co-located tests cover progressive construction, successful completion, mid-stream abort, and malformed stream handling,
And all tests pass with >90% coverage.

## Tasks / Subtasks

- [x] Task 1: Add streaming types to `types.ts` (AC: #1)
  - [x] 1.1 Add `GenerationChunk` interface with `delta: string`, `done: boolean`, `model?: string | undefined`, `usage?: LLMUsage | undefined`
  - [x] 1.2 Add `StreamingLLMConnector` interface extending `LLMConnector` with `streamGenerate(prompt, options, signal?): Promise<Result<AsyncIterable<GenerationChunk>>>`
  - [x] 1.3 Add `isStreamingConnector(connector: LLMConnector): connector is StreamingLLMConnector` type guard function
  - [x] 1.4 Export `GenerationChunk`, `StreamingLLMConnector`, `isStreamingConnector` from `packages/core/src/index.ts`

- [x] Task 2: Add streaming generation types to `generation.types.ts` (AC: #1, #2)
  - [x] 2.1 Add `StreamingGenerationOptions` interface with `onProgress?: ((partialSpec: Partial<UISpecification>) => void) | undefined`
  - [x] 2.2 Add `StreamingSpecParser` interface with `processChunk(delta: string): Partial<UISpecification> | undefined` and `finalize(): Result<UISpecification>`
  - [x] 2.3 Add `StreamingGenerationOrchestrator` interface extending `GenerationOrchestrator` with `generateStream(input: GenerationInput, trace: GenerationTrace, options?: StreamingGenerationOptions, signal?: AbortSignal): Promise<Result<GenerationResult>>`
  - [x] 2.4 Export new types from `packages/core/src/generation/index.ts`

- [x] Task 3: Add new error code for stream termination (AC: #5)
  - [x] 3.1 Add `FLUI_E017` constant to `packages/core/src/errors/error-codes.ts` — "Stream terminated unexpectedly: stream ended before producing a complete response"
  - [x] 3.2 Add to `DefinedFluiErrorCode` union type
  - [x] 3.3 Add to `ERROR_CODE_DESCRIPTIONS` map
  - [x] 3.4 Export from `packages/core/src/errors/index.ts`
  - [x] 3.5 Re-export from `packages/core/src/index.ts`
  - [x] 3.6 Update error count test in `packages/core/src/errors/errors.test.ts` (16 → 17)

- [x] Task 4: Implement streaming spec parser (AC: #1, #2, #5)
  - [x] 4.1 Create `packages/core/src/generation/streaming-spec-parser.ts`
  - [x] 4.2 Implement `createStreamingSpecParser(): StreamingSpecParser` factory function
  - [x] 4.3 Internal state: accumulated text buffer (`string`)
  - [x] 4.4 `processChunk(delta)` method:
    - Appends delta to internal buffer
    - Attempts to detect newly completed JSON structures in the accumulation
    - Uses progressive detection strategy: try to extract partial `components[]` items as they complete
    - Returns `Partial<UISpecification>` when new structure detected, `undefined` otherwise
  - [x] 4.5 `finalize()` method:
    - Extracts JSON from the complete accumulated text (reuse `extractJson` helper pattern from `spec-parser.ts`)
    - Calls `JSON.parse()` — returns `Result.error(FluiError(FLUI_E015, 'generation', ...))` on failure
    - Validates against `uiSpecificationSchema` — returns `Result.error(FluiError(FLUI_E016, 'generation', ...))` on failure
    - Returns `Result.ok(UISpecification)` on success
  - [x] 4.6 Progressive detection strategy for `processChunk()`:
    - Track parsing state: has version been seen? How many complete components? Has layout been seen?
    - After each chunk, attempt a lightweight parse of the buffer so far
    - When a new `components[n]` object appears complete (matching braces), build partial spec with known fields
    - Do NOT validate partial spec against Zod — validation only on `finalize()`

- [x] Task 5: Implement streaming generation orchestrator (AC: #1, #2, #3, #4, #5)
  - [x] 5.1 Create `packages/core/src/generation/streaming-orchestrator.ts`
  - [x] 5.2 Implement `createStreamingOrchestrator(config: GenerationConfig): StreamingGenerationOrchestrator` factory
  - [x] 5.3 The `generateStream()` method orchestrates:
    1. Check AbortSignal — return `FLUI_E010` if already aborted
    2. Verify connector is streaming-capable via `isStreamingConnector()` — return `FLUI_E009` if not
    3. Build prompt via PromptBuilder (reuse from existing module) — add trace step (module: "generation", operation: "constructPrompt")
    4. Call `connector.streamGenerate(prompt, requestOptions, signal)` — add trace step start
    5. If `streamGenerate` returns `Result.error` — propagate, add trace step with failure
    6. Consume `AsyncIterable<GenerationChunk>` via `for await...of`:
       - Feed each chunk to `StreamingSpecParser.processChunk()`
       - If `processChunk` returns a partial spec AND `onProgress` callback is provided, invoke it
       - Check AbortSignal periodically — break from loop if aborted
       - Track `model` and `usage` from chunks (typically on final chunk where `done: true`)
    7. Add trace step (module: "generation", operation: "streamConsume", durationMs, metadata: { chunkCount, totalContentLength })
    8. Call `StreamingSpecParser.finalize()` — add trace step (module: "generation", operation: "parseResponse")
    9. If finalize fails — return error as-is
    10. Enrich UISpecification metadata (model, traceId, generatedAt, usage)
    11. Return `Result.ok(UISpecification)`
  - [x] 5.4 Error handling in stream consumption:
    - Wrap `for await...of` in try/catch for stream errors
    - On stream error: return `Result.error(FluiError(FLUI_E017, 'generation', ...))`
    - On abort during stream: return `Result.error(FluiError(FLUI_E010, 'generation', 'Streaming generation cancelled'))`
  - [x] 5.5 Also implement `generate()` method by delegating to existing `createGenerationOrchestrator(config).generate()` — so the streaming orchestrator is a superset
  - [x] 5.6 Construct `LLMRequestOptions` from `GenerationConfig`: `{ model, temperature, maxTokens, responseFormat: 'json' }`

- [x] Task 6: Update barrel exports (AC: all)
  - [x] 6.1 Update `packages/core/src/generation/index.ts`:
    - Add type exports: `StreamingGenerationOptions`, `StreamingSpecParser`, `StreamingGenerationOrchestrator`
    - Add factory exports: `createStreamingOrchestrator`, `createStreamingSpecParser`
  - [x] 6.2 Update `packages/core/src/index.ts`:
    - Add type exports: `GenerationChunk`, `StreamingLLMConnector`, `StreamingGenerationOptions`, `StreamingSpecParser`, `StreamingGenerationOrchestrator`
    - Add value exports: `isStreamingConnector`, `createStreamingOrchestrator`, `createStreamingSpecParser`

- [x] Task 7: Write streaming spec parser tests (AC: #1, #2, #5, #6)
  - [x] 7.1 Create `packages/core/src/generation/streaming-spec-parser.test.ts`
  - [x] 7.2 Test feeding chunks that form a complete valid UISpecification → finalize returns Result.ok
  - [x] 7.3 Test `processChunk()` returns `undefined` when no new structure detected
  - [x] 7.4 Test `processChunk()` returns `Partial<UISpecification>` when a new component is fully received
  - [x] 7.5 Test progressive detection: feed components one at a time, verify partial spec grows
  - [x] 7.6 Test finalize on empty buffer returns FLUI_E015
  - [x] 7.7 Test finalize on malformed JSON returns FLUI_E015
  - [x] 7.8 Test finalize on JSON that fails schema validation returns FLUI_E016 with Zod error details
  - [x] 7.9 Test JSON extraction handles markdown code fences in stream
  - [x] 7.10 Test finalize on incomplete JSON (stream cut short) returns FLUI_E015

- [x] Task 8: Write streaming orchestrator tests (AC: #1-#6)
  - [x] 8.1 Create `packages/core/src/generation/streaming-orchestrator.test.ts`
  - [x] 8.2 Test successful end-to-end streaming generation (mock streaming connector returns valid chunks)
  - [x] 8.3 Test onProgress callbacks are invoked with progressive partial specs
  - [x] 8.4 Test no onProgress callback provided — works without error
  - [x] 8.5 Test latency target: time-to-first-progress-callback P50 < 100ms (measure from prompt build end to first onProgress call, excluding mock network time)
  - [x] 8.6 Test AbortSignal pre-aborted returns FLUI_E010
  - [x] 8.7 Test AbortSignal aborted mid-stream returns FLUI_E010 and cleans up
  - [x] 8.8 Test non-streaming connector returns FLUI_E009 ("unsupported operation")
  - [x] 8.9 Test stream error (thrown during iteration) returns FLUI_E017
  - [x] 8.10 Test malformed stream content (valid stream, invalid JSON) returns FLUI_E015 or FLUI_E016
  - [x] 8.11 Test connector returns Result.error on streamGenerate — error propagated
  - [x] 8.12 Test GenerationTrace enrichment — verify trace steps: constructPrompt, streamConsume, parseResponse
  - [x] 8.13 Test trace steps have correct module ("generation") and durationMs > 0
  - [x] 8.14 Test no API keys or raw responses in trace metadata (NFR-S6)
  - [x] 8.15 Test metadata enrichment (model, traceId, generatedAt, usage) on successful result
  - [x] 8.16 Test `generate()` method delegates to non-streaming orchestrator correctly

- [x] Task 9: Verify build, lint, tests, and bundle size (AC: #6)
  - [x] 9.1 Run `pnpm build` — all packages must compile
  - [x] 9.2 Run `pnpm test` — all tests pass (existing + new, zero regressions)
  - [x] 9.3 Run `pnpm --filter @flui/core test --coverage` — >90% coverage
  - [x] 9.4 Run `pnpm lint` — zero Biome errors (run `pnpm lint --write` if auto-fixable)
  - [x] 9.5 Run `pnpm size` — @flui/core still < 25KB gzipped (NFR-P6)

## Dev Notes

### Module Dependency Map

```
generation/ streaming additions → imports from:
  - spec/        (UISpecification type, uiSpecificationSchema, SPEC_VERSION)
  - registry/    (SerializedRegistry type — used in prompt builder, reused)
  - intent/      (IntentObject type — used in prompt builder, reused)
  - context/     (AggregatedContext type — used in prompt builder, reused)
  - errors/      (FluiError, Result, ok, err, isOk, isError, FLUI_E009, FLUI_E010, FLUI_E015, FLUI_E016, FLUI_E017)
  - types.ts     (LLMConnector, StreamingLLMConnector, GenerationChunk, LLMRequestOptions, LLMResponse, GenerationTrace, TraceStep, createTrace, isStreamingConnector)
  - generation/  (GenerationOrchestrator, GenerationConfig, GenerationInput, PromptBuilder — reuse existing)
```

generation/ streaming additions DO NOT import from: `cache/`, `validation/`, `policy/`, `concurrency/`, `data/`

### Existing Types to Consume (DO NOT RECREATE)

**LLMConnector interface** — `packages/core/src/types.ts`:
```typescript
interface LLMConnector {
  generate(
    prompt: string,
    options: LLMRequestOptions,
    signal?: AbortSignal,
  ): Promise<Result<LLMResponse>>;
}
```

**LLMRequestOptions** — `packages/core/src/types.ts`:
```typescript
interface LLMRequestOptions {
  model: string;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  responseFormat?: 'json' | 'text' | undefined;
}
```

**LLMResponse** — `packages/core/src/types.ts`:
```typescript
interface LLMResponse {
  content: string;
  model: string;
  usage: LLMUsage;
}
```

**LLMUsage** — `packages/core/src/types.ts`:
```typescript
interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
```

**GenerationTrace** — `packages/core/src/types.ts`:
```typescript
interface GenerationTrace {
  readonly id: string;
  readonly startTime: number;
  readonly steps: readonly TraceStep[];
  addStep(step: TraceStep): void;  // Metadata auto-sanitized (removes API keys, tokens, etc.)
}
```

**UISpecification** — `packages/core/src/spec/spec.types.ts`:
```typescript
interface UISpecification {
  version: string;
  components: ComponentSpec[];
  layout: LayoutSpec;
  interactions: InteractionSpec[];
  metadata: UISpecificationMetadata;
}
```

**UISpecificationMetadata** — `packages/core/src/spec/spec.types.ts`:
```typescript
interface UISpecificationMetadata {
  generatedAt: number;
  model?: string | undefined;
  intentHash?: string | undefined;
  traceId?: string | undefined;
  custom?: Record<string, unknown> | undefined;
}
```

**Zod Schema** — `packages/core/src/spec/spec.schema.ts`:
```typescript
export const uiSpecificationSchema: z.ZodType<UISpecification> = z.strictObject({ ... });
```
Use `uiSpecificationSchema.safeParse(data)` for validation — returns `{ success: true, data }` or `{ success: false, error }`.

**GenerationConfig** — `packages/core/src/generation/generation.types.ts`:
```typescript
interface GenerationConfig {
  connector: LLMConnector;
  model: string;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  responseFormat?: 'json' | 'text' | undefined;
}
```

**GenerationInput** — `packages/core/src/generation/generation.types.ts`:
```typescript
interface GenerationInput {
  intent: IntentObject;
  context: AggregatedContext;
  registry: SerializedRegistry;
}
```

**GenerationOrchestrator** — `packages/core/src/generation/generation.types.ts`:
```typescript
interface GenerationOrchestrator {
  generate(
    input: GenerationInput,
    trace: GenerationTrace,
    signal?: AbortSignal,
  ): Promise<Result<GenerationResult>>;
}
```

**SPEC_VERSION** — `packages/core/src/spec/index.ts`:
```typescript
export const SPEC_VERSION = '1.0.0';
```

### New Types to Create

**GenerationChunk** — add to `packages/core/src/types.ts`:
```typescript
/**
 * A single chunk from a streaming LLM response.
 * Normalized across all providers per ADR-009.
 */
export interface GenerationChunk {
  /** The text delta for this chunk. */
  delta: string;
  /** Whether this is the final chunk in the stream. */
  done: boolean;
  /** Model identifier (typically available on first or last chunk). */
  model?: string | undefined;
  /** Token usage statistics (available on final chunk only). */
  usage?: LLMUsage | undefined;
}
```

**StreamingLLMConnector** — add to `packages/core/src/types.ts`:
```typescript
/**
 * Extended LLM connector interface with streaming support.
 * Normalizes provider-specific streaming into AsyncIterable<GenerationChunk> per ADR-009.
 */
export interface StreamingLLMConnector extends LLMConnector {
  /**
   * Stream a response from the LLM as an async iterable of chunks.
   *
   * @param prompt - The prompt text to send to the LLM
   * @param options - Generation options (model, temperature, etc.)
   * @param signal - Optional AbortSignal for cancellation
   * @returns Result.ok with an AsyncIterable of chunks, or Result.error on connection failure
   */
  streamGenerate(
    prompt: string,
    options: LLMRequestOptions,
    signal?: AbortSignal,
  ): Promise<Result<AsyncIterable<GenerationChunk>>>;
}
```

**isStreamingConnector** — add to `packages/core/src/types.ts`:
```typescript
/**
 * Type guard to check if an LLM connector supports streaming.
 */
export function isStreamingConnector(
  connector: LLMConnector,
): connector is StreamingLLMConnector {
  return 'streamGenerate' in connector;
}
```

**StreamingGenerationOptions** — add to `packages/core/src/generation/generation.types.ts`:
```typescript
/**
 * Options for streaming generation, including progress callbacks.
 */
export interface StreamingGenerationOptions {
  /** Called when new structure is parsed from the stream. */
  onProgress?: ((partialSpec: Partial<UISpecification>) => void) | undefined;
}
```

**StreamingSpecParser** — add to `packages/core/src/generation/generation.types.ts`:
```typescript
/**
 * Incrementally parses streaming LLM output into a UISpecification.
 */
export interface StreamingSpecParser {
  /** Feed a text delta and return partial spec if new structure detected. */
  processChunk(delta: string): Partial<UISpecification> | undefined;
  /** Finalize and validate the complete accumulated spec. */
  finalize(): Result<UISpecification>;
}
```

**StreamingGenerationOrchestrator** — add to `packages/core/src/generation/generation.types.ts`:
```typescript
/**
 * Extended orchestrator with streaming generation support.
 */
export interface StreamingGenerationOrchestrator extends GenerationOrchestrator {
  generateStream(
    input: GenerationInput,
    trace: GenerationTrace,
    options?: StreamingGenerationOptions,
    signal?: AbortSignal,
  ): Promise<Result<GenerationResult>>;
}
```

### Error Code Allocation

Add **one new error code** in `packages/core/src/errors/error-codes.ts`:

| Code | Category | Description |
|------|----------|-------------|
| `FLUI_E017` | generation | Stream terminated unexpectedly: stream ended before producing a complete response |

Existing codes reused:

- `FLUI_E009` (category: 'generation') — Unsupported operation: connector does not support streaming
- `FLUI_E010` (category: 'generation') — AbortSignal cancellation in streaming orchestrator
- `FLUI_E015` (category: 'generation') — Malformed JSON from completed stream
- `FLUI_E016` (category: 'generation') — UISpecification schema validation failed after stream completes

### Factory Function Pattern (MUST FOLLOW)

```typescript
// CORRECT — factory function + internal closure
export function createStreamingOrchestrator(config: GenerationConfig): StreamingGenerationOrchestrator { ... }
export function createStreamingSpecParser(): StreamingSpecParser { ... }

// WRONG — no class exports
export class StreamingOrchestratorImpl { ... }
```

### Streaming Implementation Strategy

**AsyncIterable consumption pattern (ES2022):**
```typescript
async generateStream(input, trace, options?, signal?) {
  // ... prompt build, trace step ...

  const streamResult = await connector.streamGenerate(prompt, requestOptions, signal);
  if (isError(streamResult)) return streamResult;

  const parser = createStreamingSpecParser();
  let model: string | undefined;
  let usage: LLMUsage | undefined;
  let chunkCount = 0;

  const consumeStart = Date.now();
  try {
    for await (const chunk of streamResult.value) {
      // Check abort between chunks
      if (signal?.aborted) {
        return err(new FluiError(FLUI_E010, 'generation', 'Streaming generation cancelled'));
      }

      chunkCount++;
      const partial = parser.processChunk(chunk.delta);

      if (partial && options?.onProgress) {
        options.onProgress(partial);
      }

      if (chunk.model) model = chunk.model;
      if (chunk.done && chunk.usage) usage = chunk.usage;
    }
  } catch (cause) {
    // Stream threw an error (network, provider issue)
    return err(new FluiError(FLUI_E017, 'generation', 'Stream terminated unexpectedly', {
      cause: cause instanceof Error ? cause : undefined,
      context: { chunkCount },
    }));
  }
  const consumeDuration = Date.now() - consumeStart;

  trace.addStep({
    module: 'generation',
    operation: 'streamConsume',
    durationMs: consumeDuration,
    metadata: { chunkCount, totalContentLength: /* from parser */ },
  });

  // Finalize and validate
  const parseStart = Date.now();
  const parseResult = parser.finalize();
  // ... trace step, metadata enrichment, return ...
}
```

### Progressive Spec Detection Strategy

The `StreamingSpecParser` accumulates text and periodically attempts to detect completed structures:

1. **Buffer accumulation**: Append each `delta` to an internal buffer string
2. **Component detection**: After each chunk, check if a new complete JSON object has appeared in the `components` array by tracking brace depth
3. **Partial spec construction**: When a new component boundary is detected:
   - Attempt to extract `version` field if present
   - Build `Partial<UISpecification>` with `{ version?, components: [parsedSoFar] }`
   - Return the partial spec
4. **Layout/interactions detection**: Similarly detect when `layout` and `interactions` sections complete
5. **No Zod validation on partials**: Only validate via Zod on `finalize()` — partial detection is best-effort heuristic

**Brace tracking heuristic:**
```typescript
// Track depth of nested braces within the components array
// When depth returns to array level, a component object is complete
// This avoids costly JSON.parse on every chunk
let braceDepth = 0;
let inComponentsArray = false;
// ... update on each character of delta
```

**Important**: The progressive detection is a **performance optimization** for user-perceived responsiveness. It does NOT need to be perfect. If detection misses a component boundary, the final `finalize()` still catches everything. The callback may fire fewer times — that's acceptable.

### AbortSignal Handling for Streams

The streaming orchestrator checks AbortSignal at three points:

1. **Before any work** — standard pre-check
2. **Between chunks** — inside the `for await...of` loop (before processing each chunk)
3. **After stream completes** — before finalize (in case abort arrived during last chunk processing)

The `for await...of` loop naturally terminates if the underlying async iterable respects `signal`. However, we add an explicit check as a safety net because not all connector implementations may propagate abort correctly.

**Memory leak prevention**: When aborting mid-stream, the `for await...of` loop breaks via early return. The async iterable's `return()` method is automatically called by the JavaScript runtime, which should signal the underlying HTTP connection to close. No manual cleanup needed.

### Trace Step Timing Pattern for Streaming

```typescript
// Streaming adds these trace steps:
trace.addStep({
  module: 'generation',
  operation: 'constructPrompt',
  durationMs: promptDuration,
  metadata: { intentLength, componentCount },
});

trace.addStep({
  module: 'generation',
  operation: 'streamConsume',
  durationMs: consumeDuration,
  metadata: { chunkCount, totalContentLength, progressCallbackCount },
});

trace.addStep({
  module: 'generation',
  operation: 'parseResponse',
  durationMs: parseDuration,
  metadata: { parseSuccess: true/false },
});
```

Trace metadata guidelines (NFR-S6):

- **INCLUDE**: model name, token usage counts, chunk count, content length, callback count
- **NEVER INCLUDE**: API keys, raw LLM response content, user PII
- Note: `createTrace()` auto-sanitizes via `sanitizeTraceMetadata()` which strips keys matching `/(api\s*key|apikey|authorization|auth|token|secret|password|raw\s*response|rawResponse)/i`

### TypeScript Strictness Requirements

The project uses strict TypeScript (`tsconfig.base.json`):

- `strict: true` — no implicit any
- `noUncheckedIndexedAccess: true` — must guard indexed access
- `exactOptionalPropertyTypes: true` — optional props need explicit `| undefined`
- `verbatimModuleSyntax: true` — must use `import type` for type-only imports
- `target: "ES2022"` — native support for async generators and `for await...of`
- Zero `any` in public API

### Testing Pattern

Follow established patterns from previous stories:

```typescript
import { describe, expect, it, vi } from 'vitest';
import type { GenerationTrace, StreamingLLMConnector, GenerationChunk } from '../types';
import {
  createTrace, ok, err, isOk, isError,
  FLUI_E009, FLUI_E010, FLUI_E015, FLUI_E016, FLUI_E017,
} from '../index';

// Mock streaming connector
function createMockStreamingConnector(
  chunks: GenerationChunk[],
): StreamingLLMConnector {
  return {
    generate: vi.fn(),  // Non-streaming method
    streamGenerate: vi.fn().mockResolvedValue(
      ok((async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      })()),
    ),
  };
}

// Mock non-streaming connector (for FLUI_E009 test)
const mockNonStreamingConnector: LLMConnector = {
  generate: vi.fn(),
};

describe('StreamingOrchestrator', () => {
  it('returns Result.ok(UISpecification) on successful streaming generation', async () => {
    const chunks = createValidSpecChunks(); // Helper to split valid JSON into chunks
    const connector = createMockStreamingConnector(chunks);
    const orchestrator = createStreamingOrchestrator({ connector, model: 'gpt-4o' });

    const trace = createTrace();
    const result = await orchestrator.generateStream(input, trace);
    expect(isOk(result)).toBe(true);
  });

  it('invokes onProgress with partial specs as components are parsed', async () => {
    const onProgress = vi.fn();
    // ... test that onProgress is called with growing partial specs
  });
});
```

**Testing rules:**

- Import from barrel (`./index` or `../index`), never internal files (except for specific module tests)
- Use `isOk()` / `isError()` type guards with control flow narrowing
- Mock `StreamingLLMConnector.streamGenerate` with async generator functions
- Assert specific error codes, not just truthiness
- Use `vi.fn()` for connector mocking (not `vi.mock()` — connector is injected, not imported)
- Test trace step count and content after each operation
- For latency tests: measure elapsed time for onProgress invocations relative to operation start
- >90% coverage per file

### Project Structure Notes

```
packages/core/src/generation/
├── generation.types.ts              # Add StreamingGenerationOptions, StreamingSpecParser, StreamingGenerationOrchestrator
├── prompt-builder.ts                # UNCHANGED — reused by streaming orchestrator
├── prompt-builder.test.ts           # UNCHANGED
├── spec-parser.ts                   # UNCHANGED — reused for reference/fallback
├── spec-parser.test.ts              # UNCHANGED
├── generation-orchestrator.ts       # UNCHANGED — non-streaming orchestrator
├── generation-orchestrator.test.ts  # UNCHANGED
├── streaming-spec-parser.ts         # NEW: createStreamingSpecParser() factory
├── streaming-spec-parser.test.ts    # NEW: Streaming parser tests
├── streaming-orchestrator.ts        # NEW: createStreamingOrchestrator(config) factory
├── streaming-orchestrator.test.ts   # NEW: Streaming orchestrator tests
└── index.ts                         # MODIFIED: add streaming exports
```

Also modify:
```
packages/core/src/
├── types.ts       (add GenerationChunk, StreamingLLMConnector, isStreamingConnector)
├── index.ts       (add streaming module exports)
└── errors/
    ├── error-codes.ts  (add FLUI_E017)
    ├── index.ts        (export FLUI_E017)
    └── errors.test.ts  (update count 16 → 17)
```

**File naming:** kebab-case for files, PascalCase for interfaces, camelCase for functions. Test files co-located as `{source}.test.ts`.

**Barrel exports:** Explicit named exports only. No `export *`. No `export default`.

### Previous Story Intelligence

**From Story 4-2 (Prompt Construction & Generation Orchestrator):**

- `createPromptBuilder()` is reusable — streaming orchestrator should call it for prompt building (DO NOT duplicate prompt logic)
- `createSpecParser()` has `extractJson()` helper pattern — the streaming spec parser's `finalize()` should use the same extraction strategy (code fence handling, brace detection)
- `GenerationConfig` already defines all config needed — streaming orchestrator takes the same config
- AbortSignal dual-check pattern: before work and after async ops — streaming adds a third check between chunks
- Metadata enrichment pattern: `spec.metadata.model`, `.traceId`, `.generatedAt`, `.custom.usage` — follow same pattern
- Trace step naming: `constructPrompt`, `callConnector`, `parseResponse` — streaming uses `constructPrompt`, `streamConsume`, `parseResponse`
- Error count test must be exact match (16 → 17)
- Factory functions return object literal implementing interface (not class instance)
- `responseFormat` must be forced to `'json'` in request options
- `exactOptionalPropertyTypes` may require explicit parameter types instead of inline objects
- Biome auto-fixes import ordering with `pnpm lint --write`

**From Story 4-1 (LLM Connector Interface):**

- Connectors return `Result<LLMResponse>` — streaming variant returns `Result<AsyncIterable<GenerationChunk>>`
- AbortSignal as last optional parameter — consistent across all interfaces
- Provider SDKs are peer deps — no impact on core bundle size
- Error wrapping pattern: specific error codes with cause chaining

**From Story 3-3 (Context Aggregation):**

- `Promise.allSettled()` over `Promise.all()` when partial results useful — not directly applicable to streaming but good pattern awareness
- Guard-based null checks per `noUncheckedIndexedAccess`

### Git Intelligence

**Recent commits (latest first):**

1. `bac5263` — Story 4-2: Prompt construction and generation orchestrator
2. `4d3eee3` — Story 4-1: LLM connector interface and OpenAI/Anthropic implementations
3. `9dd2d91` — Story 3-3: Custom context providers and context aggregation engine
4. `1d02118` — Story 3-2: Built-in context providers for identity and environment
5. `1bc6030` — Story 3-1: Text and structured intent parsing with sanitization

**Patterns confirmed:**

- Each story is a single commit with descriptive message format: `feat: implement <description> (story X-Y)`
- All tests pass before and after each story
- Bundle size remains within limits (last measured: 5.78KB gzipped, limit 25KB)
- Biome lint passes clean after `pnpm lint --write`
- Story 4-2 touched 14 files (8 new, 6 modified) — expect similar scope for 4-3

**Key code patterns from recent commits:**

- Orchestrator uses internal `createPromptBuilder()` and `createSpecParser()` — compose inside factory
- Trace steps consistently use `{ module: 'generation', operation: 'camelCase' }` format
- All generation errors use `err(new FluiError(CODE, 'generation', message, { cause?, context? }))` pattern
- Tests use `vi.fn()` for mock functions, `vi.mocked()` for typed access to mock implementations
- Tests create fresh instances per test to avoid state leakage

### Architecture Compliance Notes

- **ADR-009**: Streaming MUST be normalized to `AsyncIterable<GenerationChunk>` — the `StreamingLLMConnector` interface enforces this at the type level
- **NFR-I1**: Connector implementations < 100 lines — this story does NOT implement connector streaming (just defines the interface). Actual streaming.ts in @flui/openai and @flui/anthropic are future work
- **NFR-S1**: LLM output is declarative-only (JSON specification) — streaming does not change this; the spec parser validates the same schema
- **NFR-S6**: No API keys in traces — `sanitizeTraceMetadata()` handles this automatically; no raw stream content should appear in metadata
- **NFR-P6**: Bundle size < 25KB gzipped — streaming adds ~2-3KB estimated; well within budget

### References

- [Source: packages/core/src/types.ts] — LLMConnector, LLMRequestOptions, LLMResponse, LLMUsage, GenerationTrace, TraceStep, createTrace
- [Source: packages/core/src/spec/spec.types.ts] — UISpecification, ComponentSpec, LayoutSpec, InteractionSpec, UISpecificationMetadata
- [Source: packages/core/src/spec/spec.schema.ts] — uiSpecificationSchema, componentSpecSchema
- [Source: packages/core/src/spec/index.ts] — SPEC_VERSION constant
- [Source: packages/core/src/generation/generation.types.ts] — GenerationConfig, GenerationInput, GenerationOrchestrator, GenerationResult, PromptBuilder, SpecParser
- [Source: packages/core/src/generation/generation-orchestrator.ts] — createGenerationOrchestrator factory (reuse pattern)
- [Source: packages/core/src/generation/spec-parser.ts] — createSpecParser, extractJson helper (reuse extraction strategy)
- [Source: packages/core/src/generation/prompt-builder.ts] — createPromptBuilder (reuse directly)
- [Source: packages/core/src/generation/index.ts] — Current barrel exports (extend with streaming)
- [Source: packages/core/src/errors/error-codes.ts] — FLUI_E001–FLUI_E016, ErrorCategory includes 'generation'
- [Source: packages/core/src/errors/flui-error.ts] — FluiError class with code, category, context, cause
- [Source: packages/core/src/errors/result.ts] — Result<T,E>, ok(), err(), isOk(), isError()
- [Source: packages/core/src/index.ts] — Current barrel exports (extend with streaming)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-4] — Story 4.3 acceptance criteria
- [Source: _bmad-output/planning-artifacts/architecture.md] — ADR-009 (streaming normalization), module dependency graph, generation pipeline flow
- [Source: _bmad-output/planning-artifacts/prd.md] — FR17, NFR-P1, NFR-S6
- [Source: _bmad-output/implementation-artifacts/4-2-prompt-construction-and-generation-orchestrator.md] — Previous story dev notes, patterns, learnings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No blocking issues encountered during implementation.

### Completion Notes List

- Implemented `GenerationChunk`, `StreamingLLMConnector`, and `isStreamingConnector` type guard in `types.ts`
- Added `StreamingGenerationOptions`, `StreamingSpecParser`, and `StreamingGenerationOrchestrator` interfaces to `generation.types.ts`
- Added `FLUI_E017` error code for stream termination, updated all error count tests (16 → 17)
- Implemented `createStreamingSpecParser()` factory with brace-depth tracking for progressive component detection
- Implemented `createStreamingOrchestrator()` factory with full streaming pipeline: AbortSignal handling (3-point check), stream consumption, progressive callbacks, trace steps, and metadata enrichment
- Non-streaming `generate()` delegates to existing `createGenerationOrchestrator`
- All barrel exports updated in `generation/index.ts` and root `index.ts`
- 11 streaming spec parser tests covering progressive detection, finalize success/failure, code fences, incomplete JSON
- 15 streaming orchestrator tests covering end-to-end streaming, onProgress callbacks, abort handling, non-streaming connector rejection, stream errors, trace enrichment, metadata, and delegation
- All 300 tests pass (26 new, 274 existing, zero regressions)
- Lint clean (zero Biome errors after auto-fix for formatting/imports)
- Coverage: 95.19% statements overall, streaming-orchestrator.ts 98.14%, streaming-spec-parser.ts 91.58%
- Bundle size: 6.77 KB gzipped (well under 25KB limit)
- Code review remediation applied: progressive parser now emits real `components`, `layout`, and `interactions` partials
- Added latency interval assertion for subsequent `onProgress` callbacks (< 50ms)
- Added stream-iteration failure trace capture with explicit `failurePoint`
- Tightened `isStreamingConnector` runtime check to require callable `streamGenerate`

### File List

New files:
- packages/core/src/generation/streaming-spec-parser.ts
- packages/core/src/generation/streaming-spec-parser.test.ts
- packages/core/src/generation/streaming-orchestrator.ts
- packages/core/src/generation/streaming-orchestrator.test.ts

Modified files:
- packages/core/src/types.ts (added GenerationChunk, StreamingLLMConnector, isStreamingConnector)
- packages/core/src/generation/generation.types.ts (added StreamingGenerationOptions, StreamingSpecParser, StreamingGenerationOrchestrator)
- packages/core/src/errors/error-codes.ts (added FLUI_E017)
- packages/core/src/errors/index.ts (export FLUI_E017)
- packages/core/src/errors/errors.test.ts (updated error count 16 → 17)
- packages/core/src/generation/index.ts (added streaming exports)
- packages/core/src/index.ts (added streaming type and value exports, FLUI_E017)
- _bmad-output/implementation-artifacts/4-3-streaming-generation-and-progressive-spec-construction.md (review findings and remediation record)
- _bmad-output/implementation-artifacts/sprint-status.yaml (story status sync)

### Change Log

- 2026-02-25: Implemented streaming generation and progressive spec construction (story 4-3). Added StreamingLLMConnector interface, streaming spec parser with progressive component detection, streaming orchestrator with AbortSignal handling and onProgress callbacks, FLUI_E017 error code, and comprehensive test coverage (26 new tests).
- 2026-02-25: Resolved code review findings: strengthened progressive partial emission (components/layout/interactions), improved streaming latency coverage for callback intervals, and added failure-point trace capture for stream iteration errors.

## Senior Developer Review (AI)

- Reviewer: Fabrice
- Date: 2026-02-25
- Outcome: Approve

### Findings Resolved

- HIGH: `onProgress` now receives meaningful partial structures with parsed `components` data
- HIGH: Progressive parser now detects and emits completed `layout` and `interactions` sections
- HIGH: Added automated coverage for subsequent progress-callback intervals targeting `< 50ms`
- HIGH: Stream iteration exceptions now record `streamConsume` trace with duration and `failurePoint`
- HIGH: Strengthened parser growth assertions to verify actual partial payload growth
- MEDIUM: Story file list now includes all changed tracking artifacts
- LOW: `isStreamingConnector` now validates `streamGenerate` is a function
