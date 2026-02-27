# Story 8.1: Observability Collector & Trace Transports

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want every generation decision traced and transportable to configurable destinations,
so that I can monitor, debug, and audit all LLM-driven UI generation in my application.

## Acceptance Criteria

1. **Structured Trace Aggregation** (FR44): Given the `observe/` module in `@flui/core`, when a generation pipeline completes (success or failure), then a structured `GenerationTrace` is produced containing intent, context, components selected, validation result, latency, and cost. The trace aggregates steps enriched by all pipeline modules.

2. **Configurable Trace Transports** (FR45): Given the observability collector, when trace transports are configured, then traces are sent to all configured destinations (console, in-memory buffer, custom transports). The console transport outputs human-readable logs in ISO 8601 format. The in-memory buffer transport stores traces for programmatic access.

3. **Custom Transport Interface** (NFR-I2, FR51): Given a custom transport implementing the transport interface, when it is registered with the collector, then it receives all traces asynchronously. Transport failures do not crash the application or block the generation pipeline. This satisfies FR51 (export traces to external systems) because any custom transport can route to SIEM, log aggregators, or APM tools.

4. **PII Field Redaction** (NFR-S5): Given traces containing context with PII-sensitive attributes (role, permissions), when redaction is configured for specific fields, then those fields are redacted before transport. Redaction configuration is declarative (field paths to redact).

5. **API Key Absence Guarantee** (NFR-S6): Given any trace, then LLM API keys are never present in trace data, and raw LLM responses are not included in trace metadata.

6. **Testing Requirements**: Co-located tests cover trace aggregation from multiple modules, console transport output, in-memory buffer storage, custom transport registration, async transport failure handling, PII redaction, and API key absence verification. All tests pass with >90% coverage.

## Tasks / Subtasks

- [x] Task 1: Define observe module types (AC: #1, #2, #3, #4)
  - [x] 1.1 Create `packages/core/src/observe/observe.types.ts` with all type definitions:
    - `TraceTransport` interface: `{ name: string; send(trace: GenerationTrace): Promise<void> }`
    - `RedactionConfig` interface: `{ fieldPaths: string[] }` — declarative field paths to redact (e.g., `'context.identity.role'`, `'context.identity.permissions'`)
    - `ObservabilityCollectorConfig` interface: `{ transports?: TraceTransport[] | undefined; redaction?: RedactionConfig | undefined; bufferSize?: number | undefined }`
    - `ObservabilityCollector` interface: `{ collect(trace: GenerationTrace): void; getBufferedTraces(): readonly GenerationTrace[]; clearBuffer(): void; addTransport(transport: TraceTransport): void; removeTransport(name: string): void }`
  - [x] 1.2 Export all new types from `observe/index.ts`

- [x] Task 2: Implement console transport (AC: #2, #5)
  - [x] 2.1 Create `packages/core/src/observe/console-transport.ts`
  - [x] 2.2 Implement `createConsoleTransport(): TraceTransport` with name `'console'`
  - [x] 2.3 `send()` outputs human-readable log: ISO 8601 timestamp, trace ID, step count, total duration, per-step summary (module.operation: Xms)
  - [x] 2.4 Uses `console.log` for standard traces, `console.warn` for traces containing error steps. Error-step detection: a step is considered an error step if its `metadata` contains a key `'error'` (e.g., `metadata: { error: 'validation failed' }`). Check via `trace.steps.some(s => 'error' in s.metadata)`.

- [x] Task 3: Implement in-memory buffer transport (AC: #2)
  - [x] 3.1 Create `packages/core/src/observe/buffer-transport.ts`
  - [x] 3.2 Implement `createBufferTransport(maxSize?: number | undefined): TraceTransport & { getTraces(): readonly GenerationTrace[]; clear(): void }`
  - [x] 3.3 Buffer stores traces in FIFO order, evicts oldest when `maxSize` reached (default: 100)
  - [x] 3.4 `getTraces()` returns defensive copy, `clear()` empties the buffer

- [x] Task 4: Implement PII redaction engine (AC: #4, #5)
  - [x] 4.1 Create `packages/core/src/observe/redaction.ts`
  - [x] 4.2 Implement `redactTrace(trace: GenerationTrace, config: RedactionConfig): GenerationTrace` — pure function, returns new trace with redacted fields
  - [x] 4.3 Field path resolution: dot-notation paths traverse trace step metadata. The first segment matches `step.module`, subsequent segments traverse `step.metadata`. Example: path `'context.identity.role'` means — for each step where `step.module === 'context'`, traverse `step.metadata.identity.role` and redact it. If a path has only one segment (e.g., `'secret'`), it matches a top-level key in ALL steps' metadata.
  - [x] 4.4 Redacted values replaced with `'[REDACTED]'` string
  - [x] 4.5 Ensure existing `sanitizeTraceMetadata` from `types.ts` handles API key stripping (already in place at `addStep` time) — redaction is an additional layer for PII fields

- [x] Task 5: Implement observability collector (AC: #1, #2, #3, #4, #5)
  - [x] 5.1 Create `packages/core/src/observe/collector.ts`
  - [x] 5.2 Implement `createObservabilityCollector(config?: ObservabilityCollectorConfig | undefined): ObservabilityCollector`
  - [x] 5.3 `collect(trace)` flow:
    1. Apply PII redaction if `config.redaction` is configured
    2. Store in internal buffer (respect `bufferSize`, FIFO eviction)
    3. Fan-out to all registered transports asynchronously (`Promise.allSettled`)
    4. Swallow transport errors silently — log via `console.error(\`[flui:observe] Transport '${transport.name}' failed: ${reason}\`)` but NEVER throw. Do NOT create a `FluiError` here. `FLUI_E031` is reserved for external consumers and Story 8.5's factory wiring layer.
  - [x] 5.4 `getBufferedTraces()` returns defensive copy of buffered traces
  - [x] 5.5 `clearBuffer()` empties the internal buffer
  - [x] 5.6 `addTransport(transport)` registers new transport at runtime
  - [x] 5.7 `removeTransport(name)` unregisters transport by name. If multiple transports share the same name, remove only the first match (consistent with `findIndex` behavior). `addTransport` does NOT enforce name uniqueness.

- [x] Task 6: Update barrel exports (AC: all)
  - [x] 6.1 Create `packages/core/src/observe/index.ts` exporting all types and factories
  - [x] 6.2 Update `packages/core/src/index.ts` to add observe module exports:
    - Type exports: `ObservabilityCollector`, `ObservabilityCollectorConfig`, `TraceTransport`, `RedactionConfig`
    - Value exports: `createObservabilityCollector`, `createConsoleTransport`, `createBufferTransport`, `redactTrace`
  - [x] 6.3 Verify TypeScript compilation succeeds with all exports

- [x] Task 7: Add error codes for observe module (AC: #3)
  - [x] 7.1 Add `'observe'` to `ErrorCategory` union in `error-codes.ts`
  - [x] 7.2 Add `FLUI_E031`: "Transport send failed: one or more trace transports failed to deliver" (category: `observe`)
  - [x] 7.3 Add `FLUI_E032`: "Invalid redaction config: malformed field path in redaction configuration" (category: `observe`)
  - [x] 7.4 Update `DefinedFluiErrorCode` union to include `typeof FLUI_E031 | typeof FLUI_E032`
  - [x] 7.5 Update `ERROR_CODE_DESCRIPTIONS` record with descriptions for FLUI_E031 and FLUI_E032
  - [x] 7.6 Update `packages/core/src/errors/index.ts` barrel to export `FLUI_E031` and `FLUI_E032`
  - [x] 7.7 Update `packages/core/src/errors/errors.test.ts`: change error code count assertions from `30` → `32` (appears in 3 places: the test title, `toHaveLength(30)`, and the sequential check `{ length: 30 }`). Change category count from `8` → `9`. Add `FLUI_E031` and `FLUI_E032` to the `allCodes` array. Add `'observe'` to the `categories` array (~line 227).

- [x] Task 8: Write comprehensive tests (AC: #1, #2, #3, #4, #5, #6)
  - [x] 8.1 Create `packages/core/src/observe/observe.test.ts`:
    - **Collector Tests:**
      - Test: collect stores trace in buffer
      - Test: collect fans out to all registered transports
      - Test: collect applies PII redaction before transport
      - Test: transport failure does not throw (swallowed silently)
      - Test: transport failure does not block other transports
      - Test: buffer respects maxSize with FIFO eviction
      - Test: getBufferedTraces returns defensive copy
      - Test: clearBuffer empties internal buffer
      - Test: addTransport registers new transport
      - Test: removeTransport unregisters by name
      - Test: collect with no transports still buffers
    - **Console Transport Tests:**
      - Test: outputs human-readable log with ISO 8601 timestamp
      - Test: includes trace ID, step count, total duration
      - Test: per-step summary shows module.operation and timing
      - Test: uses console.warn for traces with error metadata
    - **Buffer Transport Tests:**
      - Test: stores traces in FIFO order
      - Test: evicts oldest when maxSize reached
      - Test: getTraces returns defensive copy
      - Test: clear empties buffer
      - Test: default maxSize is 100
    - **Redaction Tests:**
      - Test: redacts field at dot-notation path
      - Test: redacts nested fields in trace step metadata
      - Test: non-matching paths leave trace unchanged
      - Test: returns new trace (does not mutate original)
      - Test: handles missing intermediate paths gracefully
    - **API Key Security Tests:**
      - Test: API keys in metadata are stripped by existing sanitizeTraceMetadata
      - Test: raw LLM responses never appear in trace data
      - Test: bearer tokens never appear in trace metadata
    - **Factory Tests:**
      - Test: createObservabilityCollector returns valid collector
      - Test: createObservabilityCollector accepts optional config
      - Test: createConsoleTransport returns transport with name 'console'
      - Test: createBufferTransport returns transport with buffer methods
  - [x] 8.2 All tests pass with >90% statement coverage

## Dev Notes

### Architecture Compliance

**Package:** `@flui/core` — new `observe/` module (architecture-specified)

**New files (architecture-specified):**
```
packages/core/src/observe/
  ├── index.ts                # Barrel exports for observe module
  ├── collector.ts            # ObservabilityCollector factory and implementation
  ├── console-transport.ts    # Console trace transport (human-readable ISO 8601 logs)
  ├── buffer-transport.ts     # In-memory buffer transport (FIFO, configurable maxSize)
  ├── redaction.ts            # PII field redaction engine (declarative dot-notation paths)
  ├── observe.types.ts        # Type definitions (TraceTransport, RedactionConfig, ObservabilityCollectorConfig)
  └── observe.test.ts         # Co-located tests for all observe module components
```

**Modified files:**
```
packages/core/src/
  ├── errors/error-codes.ts   # Add 'observe' ErrorCategory, FLUI_E031, FLUI_E032
  ├── errors/errors.test.ts   # Update error code/category count assertions
  ├── errors/index.ts         # Export new error codes
  ├── observe/index.ts        # New barrel file for observe module
  └── index.ts                # Add observe module exports to core barrel
```

**Do NOT create these files** (they belong to future stories):
- `observe/metrics.ts` — Cost and cache metrics aggregation (Story 8.2)
- Any `@flui/react/debug/` files — Debug overlay UI (Story 8.3)
- `flui.ts` — Factory wiring that composes all modules including collector (Story 8.5)
- `observe/trace.ts` — The architecture lists this file, but `GenerationTrace` and `createTrace()` were implemented in `types.ts` during Story 1.4 and are used throughout the codebase (14+ modules). Do NOT create a wrapper or duplicate in `observe/`. If a future story needs trace enhancements, it can add `observe/trace.ts` then.
- Any changes to existing `types.ts` — The `GenerationTrace`, `TraceStep`, `createTrace`, and `sanitizeTraceMetadata` are already complete and sufficient for Story 8.1
- Any re-export of `createTrace` from `observe/` — trace creation stays in `types.ts`

**What this story IS vs IS NOT:**
- **IS:** A collector that receives completed `GenerationTrace` instances and fans them out to configurable transports (console, buffer, custom) with PII redaction
- **IS NOT:** A replacement for the existing `createTrace()`/`addStep()` system — the collector is the *consumer* of traces, not the producer. Traces are still created in `types.ts` and enriched by pipeline modules
- **IS NOT:** A metrics engine — metric aggregation from trace data is Story 8.2
- **IS NOT:** A debug UI — the debug overlay consuming traces is Story 8.3
- **IS NOT:** An integration story — the collector is not wired into the generation pipeline yet. Story 8.5 (`flui.ts` factory) wires `collect()` calls after pipeline completion

**Module dependency rules:**
- `observe/` imports ONLY from `../errors` (for FluiError, error codes)
- `observe/` accepts `GenerationTrace` as a parameter (type-only import from `../types`)
- `observe/` does NOT import from any other module (intent, context, generation, validation, cache, policy, concurrency, registry, spec, data)
- Other modules do NOT import from `observe/` — the orchestration layer (Story 8.5) passes completed traces to the collector
- Zero new runtime dependencies
- Zero new peer dependencies
- `sideEffects: false` must be maintained in package.json

### Implementation Patterns (MUST follow)

**Factory pattern (established codebase convention):**
```typescript
// Follow the create* factory pattern established in createCostManager, createConcurrencyController, createGenerationPolicyEngine
export function createObservabilityCollector(
  config?: ObservabilityCollectorConfig | undefined,
): ObservabilityCollector {
  const transports: TraceTransport[] = [...(config?.transports ?? [])];
  const maxBufferSize = config?.bufferSize ?? 100;
  const buffer: GenerationTrace[] = [];

  function collect(trace: GenerationTrace): void {
    // 1. Apply PII redaction if configured
    const processedTrace = config?.redaction
      ? redactTrace(trace, config.redaction)
      : trace;

    // 2. Buffer (FIFO eviction)
    buffer.push(processedTrace);
    while (buffer.length > maxBufferSize) {
      buffer.shift();
    }

    // 3. Fan-out to transports asynchronously — never throw
    if (transports.length > 0) {
      Promise.allSettled(
        transports.map((t) => t.send(processedTrace)),
      ).catch(() => {
        // Promise.allSettled never rejects, but defensive
      });
    }
  }

  function getBufferedTraces(): readonly GenerationTrace[] {
    return buffer.slice();
  }

  function clearBuffer(): void {
    buffer.length = 0;
  }

  function addTransport(transport: TraceTransport): void {
    transports.push(transport);
  }

  function removeTransport(name: string): void {
    const index = transports.findIndex((t) => t.name === name);
    if (index !== -1) {
      transports.splice(index, 1);
    }
  }

  return { collect, getBufferedTraces, clearBuffer, addTransport, removeTransport };
}
```

**Console transport ISO 8601 output format:**
```typescript
// Human-readable log output format:
// [2026-02-27T14:30:00.000Z] trace-abc123 | 5 steps | 342ms total
//   intent-parser.parseIntent: 2ms
//   context.resolve: 15ms
//   generation.callConnector: 300ms
//   validation.validate: 20ms
//   generation-policy.evaluate: 0ms
```

**Redaction engine — pure function, dot-notation path traversal:**
```typescript
export function redactTrace(
  trace: GenerationTrace,
  config: RedactionConfig,
): GenerationTrace {
  // Create a new trace with redacted step metadata
  // Do NOT mutate the original trace
  // Traverse dot-notation paths in step metadata
  // Replace matched values with '[REDACTED]'
  // Handle missing intermediate paths gracefully (no-op)
}
```

**Transport error handling pattern — CRITICAL for AC #3:**
```typescript
// Transport failures must NEVER:
// - Throw to the caller of collect()
// - Block other transports from receiving the trace
// - Crash the application
// - Prevent buffering

// Use Promise.allSettled to isolate failures:
const results = await Promise.allSettled(
  transports.map((t) => t.send(processedTrace)),
);
// Optionally log failures via console.error for debugging:
for (const result of results) {
  if (result.status === 'rejected') {
    console.error(`[flui:observe] Transport failed: ${result.reason}`);
  }
}
```

### Error Handling

**New error codes for this story:**

| Code | Category | Description |
|------|----------|-------------|
| `FLUI_E031` | `observe` | Transport send failed: one or more trace transports failed to deliver |
| `FLUI_E032` | `observe` | Invalid redaction config: malformed field path in redaction configuration |

**New error category:** `'observe'` added to `ErrorCategory` union type.

**Error handling philosophy for observe module:**
- The collector itself does NOT throw — it logs transport failures silently and continues
- Error codes are defined for use by consuming code that may want to create `FluiError` instances from transport failures (e.g., Story 8.5's wiring layer)
- Redaction config validation can use `FLUI_E032` if field paths are malformed (empty strings, paths starting/ending with dots)
- The `collect()` method is fire-and-forget — the generation pipeline should never be blocked by observability

**Existing security measures already in place (DO NOT recreate):**
- `sanitizeTraceMetadata()` in `types.ts` already strips API keys, tokens, secrets, passwords, raw responses at `addStep()` time
- The `TRACE_SENSITIVE_KEY_PATTERN` and `TRACE_SENSITIVE_VALUE_PATTERN` regexes handle NFR-S6
- Story 8.1's PII redaction (NFR-S5) is an ADDITIONAL layer for application-specific field paths (e.g., user roles, permissions)

### Existing Code to Reuse (DO NOT reinvent)

| What | Where | How to use |
|------|-------|------------|
| `GenerationTrace` interface | `packages/core/src/types.ts` | Type-only import — the collector accepts this as input |
| `TraceStep` interface | `packages/core/src/types.ts` | Type-only import — used when iterating trace steps |
| `createTrace()` | `packages/core/src/types.ts` | For test setup ONLY — the collector does not create traces |
| `sanitizeTraceMetadata()` | `packages/core/src/types.ts` | DO NOT call — already applied at `addStep()` time. Don't duplicate |
| `FluiError` class | `packages/core/src/errors/flui-error.ts` | For error code definitions |
| `ErrorCategory` type | `packages/core/src/errors/error-codes.ts` | Extend with `'observe'` |
| Error code pattern | `packages/core/src/errors/error-codes.ts` | Follow FLUI_E0XX pattern for E031, E032 |

### Design Decisions

**Collector is a synchronous collect() with async fan-out:**
The `collect()` method is synchronous (returns `void`, not `Promise<void>`). This is deliberate — the generation pipeline should never `await` observability. Transports receive traces asynchronously via `Promise.allSettled`, and failures are silently logged. This guarantees zero latency impact on the generation pipeline.

**Separate transports as individual files:**
Each built-in transport (`console-transport.ts`, `buffer-transport.ts`) gets its own file following the single-responsibility pattern. This enables tree-shaking — if a developer only uses custom transports, the console and buffer transports are not bundled.

**Redaction is a separate pure function, not embedded in collector:**
`redactTrace()` is a standalone pure function (input → output, no side effects) that can be tested independently and reused outside the collector (e.g., Story 8.2 metrics). The collector delegates to it when `config.redaction` is provided. Export `redactTrace` from `observe/index.ts` as a public utility.

**Redaction path resolution model:**
Dot-notation paths use the first segment to match `step.module`, then subsequent segments traverse `step.metadata`. For example, `'context.identity.role'` targets steps where `module === 'context'` and traverses `metadata.identity.role`. Single-segment paths like `'secret'` match the key in ALL steps' metadata. This design aligns with how trace steps are structured: each step belongs to a named module with arbitrary metadata.

**Buffer with `bufferSize=0`:**
If `config.bufferSize` is explicitly `0`, buffering is disabled — traces are still sent to transports but not retained in the buffer. `getBufferedTraces()` will always return an empty array. This is a valid configuration for production use where only transport delivery matters.

**Buffer transport extends TraceTransport interface:**
`createBufferTransport()` returns `TraceTransport & { getTraces(): readonly GenerationTrace[]; clear(): void }`. The additional methods allow programmatic access without requiring the collector's buffer. This is useful for testing and for Story 8.2 (metrics) to access traces directly.

**No `trace.ts` wrapper file:**
The architecture lists `observe/trace.ts` in the module structure. However, the existing `createTrace()` and `GenerationTrace` in `types.ts` are complete and used throughout the codebase. Creating a wrapper would cause confusion about which to use. If future stories need trace enhancements, they can add `observe/trace.ts` then. For Story 8.1, the collector consumes the existing trace system as-is.

### Previous Story Intelligence

**From Story 7-4 (Generation Policy Engine — DONE, last story in previous epic):**
- `exactOptionalPropertyTypes` strictness is enabled — all optional properties need explicit `| undefined`
- Factory pattern: `createGenerationPolicyEngine(config?, trace?)` — follow same pattern for `createObservabilityCollector(config?)`
- Trace enrichment pattern: `trace?.addStep({ module: '...', operation: '...', durationMs: ..., metadata: {...} })` — this is how upstream modules push data into traces that the collector later receives
- `sanitizeTraceMetadata()` strips keys matching `/token/i` — avoid using "token" in metadata keys for observe module trace steps
- 576 tests in `@flui/core` — maintain zero regressions
- Story 7-4 code review caught missing trace metadata field (`budgetRemaining`) — ensure all collector trace metadata is complete from the start

**From Story 7-3 (Concurrency Controller & Circuit Breaker — DONE):**
- `CircuitBreakerState` is `'closed' | 'open' | 'half-open'` — the collector may see traces with circuit breaker state in step metadata
- `AbortSignal` patterns are established — but the collector itself does NOT use AbortSignal (it's fire-and-forget)
- Error code additions follow the pattern: add constant, add to `DefinedFluiErrorCode` union, add to `ERROR_CODE_DESCRIPTIONS`, update test count

**From Story 7-1 (Three-Level Cache System — DONE):**
- The collector's in-memory buffer follows a similar FIFO pattern as the L1 cache (memory cache with maxEntries eviction)
- Defensive copy pattern: `buffer.slice()` for `getBufferedTraces()` — same as `steps.slice()` in `createTrace()`

### Git Intelligence

**Recent commit patterns:**
- `328455d` — `feat: implement concurrency controller, circuit breaker, and generation policy engine (stories 7-3, 7-4)`
- `cdedb77` — `feat: implement cost manager and budget enforcement (story 7-2)`
- `e9b389b` — `feat: implement three-level cache system with memory, session, and IndexedDB storage (story 7-1)`
- All commits follow: `feat: implement <description> (story X-Y)`
- Implementation order: types → implementation → tests → barrel exports

**Files most recently modified in `@flui/core` (Story 7-3/7-4):**
- `packages/core/src/concurrency/` — complete module
- `packages/core/src/policy/` — cost manager + generation policy
- `packages/core/src/errors/error-codes.ts` — added FLUI_E028-E030, added 'concurrency' ErrorCategory
- `packages/core/src/index.ts` — added concurrency and policy exports

### Testing Standards

- **Framework:** Vitest 4.0.18 with `node` environment (core package, NOT jsdom)
- **Test structure:** `describe('ObservabilityCollector') > describe('collect') > it('specific behavior')`
- **Coverage:** >90% statement coverage required
- **Import pattern:** Import from relative paths within same package, never from barrel in tests
- **Console mocking pattern for console-transport tests:**
```typescript
// Mock console.log/console.warn for assertions
const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

// After test
logSpy.mockRestore();
warnSpy.mockRestore();
```

- **Custom transport mock pattern:**
```typescript
function createMockTransport(name: string): TraceTransport & { calls: GenerationTrace[] } {
  const calls: GenerationTrace[] = [];
  return {
    name,
    async send(trace: GenerationTrace): Promise<void> {
      calls.push(trace);
    },
    calls,
  };
}

function createFailingTransport(name: string): TraceTransport {
  return {
    name,
    async send(): Promise<void> {
      throw new Error('Transport failed');
    },
  };
}
```

- **Trace creation for test setup:**
```typescript
import { createTrace } from '../types';

function makeTestTrace(stepCount: number = 3): GenerationTrace {
  const trace = createTrace({ id: 'test-trace-1' });
  for (let i = 0; i < stepCount; i++) {
    trace.addStep({
      module: `module-${i}`,
      operation: `operation${i}`,
      durationMs: (i + 1) * 10,
      metadata: { index: i },
    });
  }
  return trace;
}
```

### Performance Considerations

- `collect()` is synchronous — O(1) buffer push + async transport fan-out
- Transport fan-out uses `Promise.allSettled` — non-blocking, isolated failures
- Buffer FIFO eviction is O(1) amortized (shift on array — acceptable for default 100 size)
- Console transport formatting is O(n) where n = number of trace steps (typically < 20)
- Redaction engine is O(m * n) where m = field paths, n = trace steps (both small)
- Bundle impact: ~2KB for observe module (architecture budget)
- No runtime dependencies added
- Tree-shakeable: unused transports eliminated in production

### Library/Framework Requirements

| Library | Version | Purpose | Already in package.json? |
|---------|---------|---------|-------------------------|
| None | — | No new dependencies needed | N/A |

The observe module is pure TypeScript with zero dependencies. It only type-imports `GenerationTrace` from `../types` and error types from `../errors`.

### Project Structure Notes

- This story creates the NEW `observe/` module directory in `packages/core/src/`
- Architecture specifies exactly: `observe/` imports only `errors/` (accepts trace data from any module via function params, not imports)
- All files follow existing naming: kebab-case with co-located tests
- No changes to `@flui/react` package in this story
- No changes to build configuration (tsup/vitest) needed — existing config covers new directories automatically
- `sideEffects: false` must remain in `package.json` for tree-shaking
- The `observe/` module is 1 of 14 architecture-specified modules in `@flui/core`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.1] - User story, acceptance criteria, BDD scenarios
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 8] - Epic objectives: observability, developer tooling, testing package
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Directory Structure] - `packages/core/src/observe/` layout with collector.ts, trace.ts, observe.types.ts
- [Source: _bmad-output/planning-artifacts/architecture.md#Module Dependencies] - `observe/ → imports errors/ (accepts trace data from any module)`
- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting Concerns] - GenerationTrace enrichment by every module, collector aggregation, console + in-memory transports
- [Source: _bmad-output/planning-artifacts/architecture.md#Requirements to Structure Mapping] - Observability & Debugging (FR44-51) maps to `observe/` + `debug/`
- [Source: _bmad-output/planning-artifacts/architecture.md#Bundle Size Strategy] - observe/ module allocated ~2KB budget
- [Source: _bmad-output/planning-artifacts/prd.md#FR44] - Structured trace for every generation (intent, context, components, validation, latency, cost)
- [Source: _bmad-output/planning-artifacts/prd.md#FR45] - Transport traces to configurable destinations (console, in-memory buffer, custom)
- [Source: _bmad-output/planning-artifacts/prd.md#FR51] - Export traces via transport interface for external systems (SIEM, log aggregators)
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-S5] - Field-level redaction for PII-sensitive context attributes
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-S6] - LLM API keys never logged, cached, or included in observability traces
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-I2] - Async transport interface for external system integration
- [Source: docs/flui-architecture-decisions.md#ADR-019] - Developer Debug Mode: debug overlay with Spec/Trace tabs, trace visualization
- [Source: docs/flui-architecture-decisions.md#ADR-018] - Bundle Size Strategy: observe/ allocated ~2KB
- [Source: packages/core/src/types.ts] - GenerationTrace, TraceStep, createTrace, sanitizeTraceMetadata (existing trace system)
- [Source: packages/core/src/errors/error-codes.ts] - Error code pattern (FLUI_E001-E030), ErrorCategory type
- [Source: _bmad-output/implementation-artifacts/7-4-generation-policy-engine.md] - Previous story intelligence: factory pattern, trace enrichment, exactOptionalPropertyTypes

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed TypeScript strict null checks in `collector.ts` (array index access with `!` assertion) and `redaction.ts` (explicit undefined checks for segments from `split()`)
- Fixed test failures: `sanitizeTraceMetadata` strips keys matching `/secret/i` — updated test to use non-sensitive key names (`userRole`, `identity.role`) for PII redaction tests

### Completion Notes List

- Implemented full observe module: types, collector, console transport, buffer transport, PII redaction engine
- Collector uses synchronous `collect()` with async `Promise.allSettled` fan-out — zero latency impact on generation pipeline
- Console transport outputs human-readable ISO 8601 logs, uses `console.warn` for traces with error steps
- Buffer transport supports FIFO eviction with configurable maxSize (default: 100)
- Redaction engine is a pure function with dot-notation path traversal: first segment matches `step.module`, subsequent segments traverse `step.metadata`
- Added `'observe'` ErrorCategory and error codes FLUI_E031, FLUI_E032
- All 37 new tests pass, 94.8% statement coverage on observe module
- Full regression suite passes: 613 tests, zero regressions
- No new dependencies added, zero runtime impact, tree-shakeable
- Code review fixes applied: normalized negative/invalid buffer size inputs, fixed redacted trace `addStep`/`steps` consistency, and added malformed redaction path validation with `FLUI_E032`

### File List

**New files:**

- packages/core/src/observe/observe.types.ts
- packages/core/src/observe/collector.ts
- packages/core/src/observe/console-transport.ts
- packages/core/src/observe/buffer-transport.ts
- packages/core/src/observe/redaction.ts
- packages/core/src/observe/index.ts
- packages/core/src/observe/observe.test.ts

**Modified files:**

- packages/core/src/errors/error-codes.ts
- packages/core/src/errors/errors.test.ts
- packages/core/src/errors/index.ts
- packages/core/src/index.ts

### Change Log

- 2026-02-27: Implemented Story 8.1 — Observability Collector & Trace Transports. Created `observe/` module with collector, console/buffer transports, PII redaction engine, and comprehensive tests. Added error codes FLUI_E031-E032 and 'observe' error category.
- 2026-02-27: Senior code review fixes — hardened buffer size normalization in collector and buffer transport, fixed redacted trace mutability contract, added malformed redaction validation, and extended observe test coverage.

## Senior Developer Review (AI)

### Reviewer

- Fabrice (AI-assisted review workflow)

### Outcome

- Changes Requested (addressed in this pass)

### Findings and Resolutions

- HIGH: Redacted trace returned a stale `steps` snapshot while reusing original `addStep`; fixed by returning getter-based trace object with synchronized internal step storage in `packages/core/src/observe/redaction.ts`.
- HIGH: Negative buffer sizes could cause non-terminating FIFO eviction loops; fixed by normalizing buffer size inputs to non-negative integers in `packages/core/src/observe/collector.ts` and `packages/core/src/observe/buffer-transport.ts`.
- MEDIUM: Redaction config accepted malformed field paths despite `FLUI_E032`; fixed by validating redaction field paths and throwing `FluiError(FLUI_E032, 'observe', ...)` for malformed paths in `packages/core/src/observe/redaction.ts`.
- MEDIUM: Missing regression tests for these edge cases; fixed by adding tests for malformed redaction paths, redacted trace `addStep` consistency, and negative buffer-size normalization in `packages/core/src/observe/observe.test.ts`.

### Verification

- `pnpm vitest run src/observe/observe.test.ts src/errors/errors.test.ts` (81/81 passed)
- `pnpm vitest run src/observe/observe.test.ts --coverage` (`src/observe` statements: 93%)
