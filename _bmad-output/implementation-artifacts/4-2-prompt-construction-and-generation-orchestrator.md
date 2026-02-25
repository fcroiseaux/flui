# Story 4.2: Prompt Construction & Generation Orchestrator

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the system to construct optimized prompts and orchestrate the full generation flow from intent to UISpecification,
So that I can get a validated UI specification by providing just an intent, context, and registry.

## Acceptance Criteria

### AC1: Prompt Construction (FR15)

Given the generation/ module in @flui/core,
When the orchestrator receives an intent, context, and component registry,
Then the prompt builder constructs a prompt including serialized registry metadata, context signals, and generation rules (FR15),
And the prompt is sent to the configured LLM connector.

### AC2: Spec Parser — Success Path (FR16)

Given a successful LLM response,
When the spec parser processes the response,
Then it extracts the JSON UISpecification from the LLM output,
And it validates the parsed object against the UISpecification Zod schema (FR16),
And a valid parse returns Result.ok(UISpecification).

### AC3: Spec Parser — Error Path

Given an LLM response that cannot be parsed into a valid UISpecification,
When the spec parser processes it,
Then it returns Result.error with a FluiError describing the parse failure (malformed JSON, schema violation),
And the error category is "generation".

### AC4: Abort Signal Propagation

Given a generation request,
When an AbortSignal is provided,
Then the signal is propagated to the LLM connector,
And if aborted, the orchestrator returns Result.error indicating cancellation.

### AC5: GenerationTrace Enrichment

Given any generation operation,
Then the orchestrator enriches the GenerationTrace with steps for prompt construction, LLM call, and response parsing,
And each trace step includes module ("generation"), operation name, durationMs, and metadata,
And no API keys or raw LLM responses appear in trace metadata (NFR-S6).

### AC6: Performance & Testing

Given the generation/ module,
Then generation latency overhead (excluding LLM network time) targets P50 < 500ms, P99 < 2,000ms for batch generation (NFR-P1),
And co-located tests cover successful generation, parse failure, abort, and trace enrichment,
And all tests pass with >90% coverage.

## Tasks / Subtasks

- [x] Task 1: Add new error codes for generation module (AC: #3)
  - [x] 1.1 Add `FLUI_E015` constant to `packages/core/src/errors/error-codes.ts` — "LLM response parse failed: malformed JSON or unexpected response format"
  - [x] 1.2 Add `FLUI_E016` constant — "UISpecification validation failed: LLM response does not conform to UISpecification schema"
  - [x] 1.3 Add both to `DefinedFluiErrorCode` union type
  - [x] 1.4 Add both to `ERROR_CODE_DESCRIPTIONS` map
  - [x] 1.5 Export from `packages/core/src/errors/index.ts`
  - [x] 1.6 Re-export from `packages/core/src/index.ts`
  - [x] 1.7 Update error count test in `packages/core/src/errors/errors.test.ts` (14 → 16)

- [x] Task 2: Create generation module types (AC: #1, #2, #3)
  - [x] 2.1 Create `packages/core/src/generation/generation.types.ts` with:
    - `GenerationConfig` interface (connector, model, temperature, maxTokens, responseFormat)
    - `GenerationInput` interface (intent: IntentObject, context: AggregatedContext, registry: SerializedRegistry)
    - `GenerationResult` type = UISpecification (with model & usage info embedded in metadata)
    - `PromptBuilder` interface with `build(input: GenerationInput): string`
    - `SpecParser` interface with `parse(response: LLMResponse): Result<UISpecification>`
    - `GenerationOrchestrator` interface with `generate(input: GenerationInput, trace: GenerationTrace, signal?: AbortSignal): Promise<Result<UISpecification>>`

- [x] Task 3: Implement prompt builder (AC: #1)
  - [x] 3.1 Create `packages/core/src/generation/prompt-builder.ts`
  - [x] 3.2 Implement `createPromptBuilder(): PromptBuilder` factory function
  - [x] 3.3 The `build()` method constructs a structured prompt containing:
    - System instructions: role definition, output format (JSON UISpecification), generation rules
    - Available components: serialized registry (name, category, description, propsSchema)
    - Context signals: identity, environment, and custom context data
    - Intent: sanitized text and extracted signals (componentType, dataShape, interactionPattern)
    - Schema contract: exact UISpecification structure the LLM must produce (version, components, layout, interactions, metadata)
  - [x] 3.4 Prompt instructs LLM to output ONLY valid JSON matching UISpecification schema
  - [x] 3.5 Include SPEC_VERSION constant in prompt so LLM produces correct version field

- [x] Task 4: Implement spec parser (AC: #2, #3)
  - [x] 4.1 Create `packages/core/src/generation/spec-parser.ts`
  - [x] 4.2 Implement `createSpecParser(): SpecParser` factory function
  - [x] 4.3 The `parse()` method:
    - Extracts JSON from LLM response content (handles markdown code fences, leading text)
    - Calls `JSON.parse()` — returns `Result.error(FluiError(FLUI_E015, 'generation', ...))` on SyntaxError
    - Validates parsed JSON against `uiSpecificationSchema` — returns `Result.error(FluiError(FLUI_E016, 'generation', ...))` on schema failure
    - Returns `Result.ok(UISpecification)` on success

- [x] Task 5: Implement generation orchestrator (AC: #1, #2, #3, #4, #5)
  - [x] 5.1 Create `packages/core/src/generation/generation-orchestrator.ts`
  - [x] 5.2 Implement `createGenerationOrchestrator(config: GenerationConfig): GenerationOrchestrator` factory
  - [x] 5.3 The `generate()` method orchestrates:
    1. Check AbortSignal — return `FLUI_E010` if already aborted
    2. Build prompt via PromptBuilder — add trace step (module: "generation", operation: "constructPrompt", durationMs)
    3. Call `connector.generate(prompt, requestOptions, signal)` — add trace step (module: "generation", operation: "callConnector", durationMs)
    4. Check AbortSignal again — return `FLUI_E010` if aborted during call
    5. If connector returns error — propagate as-is (already `Result.error`)
    6. Parse response via SpecParser — add trace step (module: "generation", operation: "parseResponse", durationMs)
    7. If parse succeeds — enrich UISpecification metadata with model & traceId, return `Result.ok`
    8. If parse fails — return parse error as-is
  - [x] 5.4 Construct `LLMRequestOptions` from `GenerationConfig`: `{ model, temperature, maxTokens, responseFormat: 'json' }`
  - [x] 5.5 Metadata enrichment: set `metadata.model` to `response.model`, `metadata.traceId` to `trace.id`, `metadata.generatedAt` to `Date.now()`

- [x] Task 6: Create barrel export (AC: all)
  - [x] 6.1 Create `packages/core/src/generation/index.ts` with explicit named exports
  - [x] 6.2 Update `packages/core/src/index.ts` to export generation module types and factories

- [x] Task 7: Write prompt builder tests (AC: #1, #6)
  - [x] 7.1 Create `packages/core/src/generation/prompt-builder.test.ts`
  - [x] 7.2 Test prompt includes serialized registry components
  - [x] 7.3 Test prompt includes context signals (identity, environment)
  - [x] 7.4 Test prompt includes intent text and signals
  - [x] 7.5 Test prompt includes UISpecification schema contract
  - [x] 7.6 Test prompt includes SPEC_VERSION

- [x] Task 8: Write spec parser tests (AC: #2, #3, #6)
  - [x] 8.1 Create `packages/core/src/generation/spec-parser.test.ts`
  - [x] 8.2 Test successful parse of valid UISpecification JSON
  - [x] 8.3 Test parse of JSON wrapped in markdown code fences
  - [x] 8.4 Test FLUI_E015 on malformed JSON
  - [x] 8.5 Test FLUI_E015 on empty response content
  - [x] 8.6 Test FLUI_E016 on JSON that fails UISpecification schema validation
  - [x] 8.7 Test FLUI_E016 includes Zod error details in FluiError context

- [x] Task 9: Write orchestrator tests (AC: #1-#6)
  - [x] 9.1 Create `packages/core/src/generation/generation-orchestrator.test.ts`
  - [x] 9.2 Test successful end-to-end generation (mock connector returns valid JSON)
  - [x] 9.3 Test metadata enrichment (model, traceId, generatedAt)
  - [x] 9.4 Test AbortSignal pre-aborted returns FLUI_E010
  - [x] 9.5 Test AbortSignal aborted mid-flight returns FLUI_E010
  - [x] 9.6 Test connector error propagation
  - [x] 9.7 Test parse failure propagation (FLUI_E015, FLUI_E016)
  - [x] 9.8 Test GenerationTrace enrichment — verify 3 trace steps added (constructPrompt, callConnector, parseResponse)
  - [x] 9.9 Test trace steps have correct module ("generation") and durationMs > 0
  - [x] 9.10 Test no API keys or raw responses in trace metadata (NFR-S6)

- [x] Task 10: Verify build, lint, tests, and bundle size (AC: #6)
  - [x] 10.1 Run `pnpm build` — all packages must compile
  - [x] 10.2 Run `pnpm test` — all tests pass (existing + new, zero regressions)
  - [x] 10.3 Run `pnpm --filter @flui/core test --coverage` — >90% coverage
  - [x] 10.4 Run `pnpm lint` — zero Biome errors
  - [x] 10.5 Run `pnpm size` — @flui/core still < 25KB gzipped (NFR-P6)

## Dev Notes

### Module Dependency Map

```
generation/ → imports from:
  - spec/        (UISpecification type, uiSpecificationSchema, SPEC_VERSION)
  - registry/    (SerializedRegistry type — used in prompt builder)
  - intent/      (IntentObject type — used in prompt builder)
  - context/     (AggregatedContext type — used in prompt builder)
  - errors/      (FluiError, Result, ok, err, isOk, isError, error codes)
  - types.ts     (LLMConnector, LLMRequestOptions, LLMResponse, GenerationTrace, TraceStep, createTrace)
```

generation/ DOES NOT import from: `cache/`, `validation/`, `policy/`, `concurrency/`, `data/`

### Existing Types to Consume (DO NOT RECREATE)

**LLMConnector interface** — `packages/core/src/types.ts`:
```typescript
interface LLMConnector {
  generate(prompt: string, options: LLMRequestOptions, signal?: AbortSignal): Promise<Result<LLMResponse>>;
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
  generatedAt: number;             // Unix milliseconds
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

**SerializedRegistry** — `packages/core/src/registry/registry.types.ts`:
```typescript
interface SerializedRegistry {
  version: number;
  components: SerializedComponent[];
}
interface SerializedComponent {
  name: string;
  category: string;
  description: string;
  propsSchema: Record<string, unknown>;
}
```

**IntentObject** — `packages/core/src/intent/intent.types.ts`:
```typescript
interface IntentObject {
  originalText: string;
  sanitizedText: string;
  signals: IntentSignals;
  source: 'text' | 'structured';
}
interface IntentSignals {
  componentType?: string | undefined;
  dataShape?: Record<string, unknown> | undefined;
  interactionPattern?: string | undefined;
}
```

**AggregatedContext** — `packages/core/src/context/context.types.ts`:
```typescript
type AggregatedContext = Record<string, ContextData>;  // e.g., { identity: {...}, environment: {...} }
```

**SPEC_VERSION** — `packages/core/src/spec/index.ts`:
```typescript
export const SPEC_VERSION = '1.0.0';
```

### Error Code Allocation

Add **two new error codes** in `packages/core/src/errors/error-codes.ts`:

| Code | Category | Description |
|------|----------|-------------|
| `FLUI_E015` | generation | LLM response parse failed: malformed JSON or unexpected response format |
| `FLUI_E016` | generation | UISpecification validation failed: LLM response does not conform to UISpecification schema |

Existing codes reused:
- `FLUI_E010` (category: 'generation') — AbortSignal cancellation in orchestrator
- `FLUI_E014` (category: 'connector') — propagated from connector errors

### Factory Function Pattern (MUST FOLLOW)

```typescript
// ✓ CORRECT — factory function + internal class/closure
export function createGenerationOrchestrator(config: GenerationConfig): GenerationOrchestrator { ... }
export function createPromptBuilder(): PromptBuilder { ... }
export function createSpecParser(): SpecParser { ... }

// ✗ WRONG — no class exports
export class GenerationOrchestratorImpl { ... }
```

### AbortSignal Handling Pattern (Established)

Triple-check pattern used by connectors (Story 4-1):
```typescript
async generate(input, trace, signal?) {
  // Check 1: Before any work
  if (signal?.aborted) {
    return err(new FluiError(FLUI_E010, 'generation', 'Generation cancelled'));
  }

  // ... build prompt, trace step ...

  const llmResult = await this.connector.generate(prompt, options, signal);

  // Check 2: After async call
  if (signal?.aborted) {
    return err(new FluiError(FLUI_E010, 'generation', 'Generation cancelled'));
  }

  // ... parse response, trace step ...
  return result;
}
```

### Prompt Construction Strategy

The architecture document explicitly states prompt template format is an implementation detail. The prompt builder should:

1. **System section**: Define the LLM's role as a UI specification generator
2. **Available components section**: Include the full serialized registry (name, category, description, propsSchema per component)
3. **Context section**: Include all aggregated context signals (identity, environment, custom)
4. **Intent section**: Include the sanitized intent text and any extracted signals
5. **Output contract section**: Specify exact UISpecification JSON schema the LLM must produce, including SPEC_VERSION

The prompt MUST instruct the LLM to:
- Output ONLY valid JSON (no markdown, no explanation)
- Use only components from the available registry
- Set `metadata.generatedAt` to a placeholder (orchestrator will override)
- Include at least one component in `components` array
- Include valid `layout` and `interactions` arrays

### Spec Parser — JSON Extraction

LLMs sometimes wrap JSON in markdown code fences or add explanatory text. The spec parser MUST handle:
1. Raw JSON string — parse directly
2. JSON wrapped in ` ```json ... ``` ` — extract content between fences
3. JSON wrapped in ` ``` ... ``` ` — extract content between fences
4. JSON preceded/followed by text — attempt to find JSON object boundaries `{...}`

Use a simple extraction strategy:
```typescript
function extractJson(content: string): string {
  // 1. Try code fence extraction
  const fenceMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();

  // 2. Try finding outermost JSON object
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return content.slice(firstBrace, lastBrace + 1);
  }

  // 3. Return as-is and let JSON.parse fail with descriptive error
  return content;
}
```

### Trace Step Timing Pattern

```typescript
const start = Date.now();
// ... do work ...
const durationMs = Date.now() - start;
trace.addStep({
  module: 'generation',
  operation: 'constructPrompt',  // or 'callConnector', 'parseResponse'
  durationMs,
  metadata: { /* safe metadata only — sanitized by trace.addStep() */ },
});
```

Trace metadata guidelines (NFR-S6):
- **INCLUDE**: model name, token usage counts, intent hash, component count, parse success/failure
- **NEVER INCLUDE**: API keys, raw LLM response content, user PII
- Note: `createTrace()` auto-sanitizes via `sanitizeTraceMetadata()` which strips keys matching `/(api\s*key|apikey|authorization|auth|token|secret|password|raw\s*response|rawResponse)/i`

### TypeScript Strictness Requirements

The project uses strict TypeScript (`tsconfig.base.json`):
- `strict: true` — no implicit any
- `noUncheckedIndexedAccess: true` — must guard indexed access
- `exactOptionalPropertyTypes: true` — optional props need explicit `| undefined`
- `verbatimModuleSyntax: true` — must use `import type` for type-only imports
- Zero `any` in public API

### Testing Pattern

Follow established patterns from previous stories:

```typescript
import { describe, expect, it, vi } from 'vitest';
import type { LLMConnector, GenerationTrace } from '../types';
import { createTrace, ok, err, isOk, isError, FLUI_E010, FLUI_E015, FLUI_E016 } from '../index';

// Mock connector
const mockConnector: LLMConnector = {
  generate: vi.fn(),
};

describe('GenerationOrchestrator', () => {
  it('returns Result.ok(UISpecification) on successful generation', async () => {
    vi.mocked(mockConnector.generate).mockResolvedValueOnce(ok({
      content: JSON.stringify(validSpec),
      model: 'gpt-4o',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    }));

    const result = await orchestrator.generate(input, trace);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.version).toBe(SPEC_VERSION);
    expect(result.value.components.length).toBeGreaterThan(0);
  });
});
```

**Testing rules:**
- Import from barrel (`./index` or `../index`), never internal files (except for specific module tests)
- Use `isOk()` / `isError()` type guards with control flow narrowing
- Mock `LLMConnector.generate` — NEVER make real API calls
- Assert specific error codes, not just truthiness
- Use `vi.fn()` for connector mocking (not `vi.mock()` — connector is injected, not imported)
- Test trace step count and content after each operation
- >90% coverage per file

### Project Structure Notes

```
packages/core/src/generation/
├── generation.types.ts           # GenerationConfig, GenerationInput, PromptBuilder, SpecParser, GenerationOrchestrator
├── prompt-builder.ts             # createPromptBuilder() factory
├── prompt-builder.test.ts        # Prompt builder tests
├── spec-parser.ts                # createSpecParser() factory
├── spec-parser.test.ts           # Spec parser tests
├── generation-orchestrator.ts    # createGenerationOrchestrator(config) factory
├── generation-orchestrator.test.ts  # Orchestrator tests
└── index.ts                      # Barrel exports
```

Also modify:
```
packages/core/src/errors/
├── error-codes.ts     (add FLUI_E015, FLUI_E016)
├── index.ts           (export FLUI_E015, FLUI_E016)
└── errors.test.ts     (update count 14 → 16)

packages/core/src/
└── index.ts           (add generation/ module exports)
```

**File naming:** kebab-case for files, PascalCase for interfaces, camelCase for functions. Test files co-located as `{source}.test.ts`.

**Barrel exports:** Explicit named exports only. No `export *`. No `export default`.

### Previous Story Intelligence

**From Story 4-1 (LLM Connector Interface):**
- Connectors return `Result<LLMResponse>` — orchestrator receives this directly
- AbortSignal dual-check pattern established: before and after async ops
- Factory function pattern: `createOpenAIConnector(config)` returns interface, class is internal
- Error wrapping pattern: specific error codes with cause chaining
- `FLUI_E002/config` for constructor validation, not runtime errors
- Provider SDKs are peer deps — connector packages have no runtime deps on them
- `.size-limit.json` `ignore` arrays exclude peer deps from bundle measurement
- Biome auto-fixes import ordering with `pnpm lint --write`
- `exactOptionalPropertyTypes` may require explicit parameter types instead of inline objects

**From Story 3-3 (Context Aggregation):**
- `Promise.allSettled()` over `Promise.all()` when partial results useful
- Guard-based null checks per `noUncheckedIndexedAccess`
- Error count test must be exact match
- Factory functions return object literal implementing interface (not class instance)

### Git Intelligence

**Recent commits (latest first):**
1. `4d3eee3` — Story 4-1: LLM connector interface and OpenAI/Anthropic implementations
2. `9dd2d91` — Story 3-3: Custom context providers and context aggregation engine
3. `1d02118` — Story 3-2: Built-in context providers for identity and environment
4. `1bc6030` — Story 3-1: Text and structured intent parsing with sanitization
5. `7ed5944` — Story 2-3: Registry serialization for LLM prompts

**Patterns confirmed:**
- Each story is a single commit with descriptive message
- All tests pass before and after each story
- Bundle size remains within limits
- Biome lint passes clean after `pnpm lint --write`

### References

- [Source: packages/core/src/types.ts] — LLMConnector, LLMRequestOptions, LLMResponse, LLMUsage, GenerationTrace, TraceStep, createTrace
- [Source: packages/core/src/spec/spec.types.ts] — UISpecification, ComponentSpec, LayoutSpec, InteractionSpec, UISpecificationMetadata
- [Source: packages/core/src/spec/spec.schema.ts] — uiSpecificationSchema, componentSpecSchema, layoutSpecSchema, interactionSpecSchema
- [Source: packages/core/src/spec/index.ts] — SPEC_VERSION constant
- [Source: packages/core/src/intent/intent.types.ts] — Intent, IntentObject, IntentSignals
- [Source: packages/core/src/context/context.types.ts] — AggregatedContext, ContextData, ContextProvider
- [Source: packages/core/src/registry/registry.types.ts] — SerializedRegistry, SerializedComponent
- [Source: packages/core/src/errors/error-codes.ts] — FLUI_E001–FLUI_E014, ErrorCategory includes 'generation'
- [Source: packages/core/src/errors/flui-error.ts] — FluiError class with code, category, context, cause
- [Source: packages/core/src/errors/result.ts] — Result<T,E>, ok(), err(), isOk(), isError()
- [Source: packages/core/src/index.ts] — Current barrel exports (add generation/ module)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-4] — Story 4.2 acceptance criteria
- [Source: _bmad-output/planning-artifacts/architecture.md] — Module dependency graph, generation pipeline flow, naming conventions
- [Source: _bmad-output/planning-artifacts/prd.md] — FR14, FR15, FR16, NFR-P1, NFR-S6

## Change Log

- 2026-02-25: Implemented prompt construction, spec parsing, and generation orchestrator with full test coverage (Story 4.2)
- 2026-02-25: Applied AI code-review fixes for AC/task alignment, prompt metadata, and latency verification; updated story and sprint tracking to done

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No debug issues encountered during implementation.

### Completion Notes List

- Task 1: Added FLUI_E015 (parse failure) and FLUI_E016 (schema validation failure) error codes, updated union type, descriptions map, barrel exports, and error count test (14→16)
- Task 2: Created GenerationConfig, GenerationInput, PromptBuilder, SpecParser, and GenerationOrchestrator interfaces in generation.types.ts
- Task 3: Implemented createPromptBuilder() factory with structured prompt sections: system instructions, available components, context signals, intent, and output schema contract with SPEC_VERSION
- Task 4: Implemented createSpecParser() factory with JSON extraction (code fences, raw JSON, text-wrapped JSON), JSON.parse with FLUI_E015, and Zod schema validation with FLUI_E016 including Zod error details in context
- Task 5: Implemented createGenerationOrchestrator(config) factory with dual AbortSignal checks, prompt building, connector call, response parsing, trace step enrichment (3 steps), and metadata enrichment (model, traceId, generatedAt)
- Task 6: Created generation/index.ts barrel export and updated packages/core/src/index.ts with generation module exports
- Task 7: 8 prompt builder tests covering registry inclusion, context signals, intent text/signals, schema contract, SPEC_VERSION, rules, empty context, and no-signal intent
- Task 8: 8 spec parser tests covering valid JSON, code fence extraction, malformed JSON (E015), empty content (E015), schema mismatch (E016), Zod error details, and text-preceded JSON
- Task 9: 11 orchestrator tests covering successful generation, metadata enrichment, pre-abort, mid-flight abort, connector error propagation, parse failure propagation (E015/E016), trace step count and operations, trace module/duration, NFR-S6 security, and request options
- Task 10: All validations passed — build clean, 273 tests pass (0 regressions), 95.77% coverage, Biome lint clean, @flui/core 5.78KB gzipped (limit 25KB)
- AI Review Fixes: Added `GenerationResult` type and exports, forced orchestrator `responseFormat` to `json`, included registry version in prompt metadata, compacted prompt JSON serialization for lower token overhead, switched generation module imports to barrel-style paths, and added latency percentile test for AC6 (P50/P99 target assertions)
- AI Review Validation: `pnpm --filter @flui/core test` passes with 274 tests

### File List

New files:

- packages/core/src/generation/generation.types.ts
- packages/core/src/generation/prompt-builder.ts
- packages/core/src/generation/spec-parser.ts
- packages/core/src/generation/generation-orchestrator.ts
- packages/core/src/generation/index.ts
- packages/core/src/generation/prompt-builder.test.ts
- packages/core/src/generation/spec-parser.test.ts
- packages/core/src/generation/generation-orchestrator.test.ts

Modified files:

- packages/core/src/errors/error-codes.ts (added FLUI_E015, FLUI_E016)
- packages/core/src/errors/index.ts (export FLUI_E015, FLUI_E016)
- packages/core/src/errors/errors.test.ts (updated error count 14→16)
- packages/core/src/index.ts (added generation module exports)
- _bmad-output/implementation-artifacts/sprint-status.yaml (story status sync: review → done)
- _bmad-output/implementation-artifacts/4-2-prompt-construction-and-generation-orchestrator.md (status/changelog/dev record updates)

## Senior Developer Review (AI)

- Reviewer: Fabrice
- Date: 2026-02-25
- Outcome: Approved after fixes
- Summary: Fixed all identified HIGH and MEDIUM issues by aligning orchestrator request format with story requirement, restoring missing `GenerationResult` contract, enriching prompt registry metadata, reducing prompt token overhead, adding AC6 latency percentile checks, and documenting sprint/story sync updates.
