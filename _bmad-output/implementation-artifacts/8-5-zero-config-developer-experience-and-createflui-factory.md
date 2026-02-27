# Story 8.5: Zero-Config Developer Experience & createFlui Factory

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to install flui and get started with just an LLM API key and a single factory function,
So that the barrier to entry is minimal and I can prototype liquid interfaces quickly.

## Acceptance Criteria

1. **createFlui() factory wires all modules automatically** (FR52)
   - `createFlui({ connector })` produces a fully wired FluiInstance
   - All subsystems initialized with sensible defaults: registry, intent parser, context engine, generation orchestrator, validation pipeline, cache, policy, concurrency, and observability
   - Returns a typed `FluiInstance` object with registry access, generate function, and config suitable for `FluiProvider`

2. **Sensible defaults for all optional configuration** (FR52)
   - Default validation pipeline includes all built-in validators (schema, component, props, a11y, data authorization)
   - Default cache uses L1 (memory) and L2 (session storage); L3 (IndexedDB) disabled by default
   - Default policy: generate on cache miss, no budget limit
   - Default observability: console transport in development, no-op in production
   - Default concurrency: latest-wins with circuit breaker (3 consecutive failures)

3. **Startup validation with descriptive errors** (NFR-R6)
   - Calling `createFlui()` with missing `connector` throws a `FluiError` immediately
   - Calling `createFlui()` with invalid configuration throws a descriptive `FluiError` at startup
   - Errors are thrown synchronously at factory call time, never deferred to first generation
   - Error messages include the specific misconfiguration and how to fix it

4. **FluiProvider integration** (FR53)
   - `FluiProvider` accepts the `FluiInstance` returned by `createFlui()`
   - `LiquidView` components within the provider can generate UIs immediately with no additional wiring
   - Existing `FluiProviderProps` interface is extended or a new convenience prop is added for `FluiInstance`

5. **Co-located tests with >90% coverage** (NFR-M1)
   - Tests verify default wiring of all modules
   - Tests verify minimal config success (connector-only)
   - Tests verify startup error for invalid/missing configuration
   - Tests verify module interconnection (generation → validation → cache flow)
   - TSDoc comments on all public APIs (NFR-M3)

## Tasks / Subtasks

- [x] Task 1: Define FluiConfig and FluiInstance types (AC: #1, #2)
  - [x] 1.1 Create `packages/core/src/flui.types.ts` with `FluiConfig` interface
  - [x] 1.2 Define `FluiInstance` interface with registry, generate, config, and module accessors
  - [x] 1.3 Define default configuration constants (DEFAULT_CACHE_CONFIG, DEFAULT_POLICY_CONFIG, etc.)
- [x] Task 2: Implement createFlui() factory (AC: #1, #2, #3)
  - [x] 2.1 Create `packages/core/src/flui.ts` with `createFlui(config: FluiConfig): FluiInstance`
  - [x] 2.2 Implement config validation (throw FluiError for missing connector, invalid options)
  - [x] 2.3 Wire all modules: registry, context engine, generation orchestrator, validation pipeline, cache manager, policy engine, concurrency controller, observability collector
  - [x] 2.4 Apply sensible defaults for all optional configuration
  - [x] 2.5 Add TSDoc comments for all public API
- [x] Task 3: Update FluiProvider integration (AC: #4)
  - [x] 3.1 Extend `FluiProviderProps` or add convenience prop to accept `FluiInstance`
  - [x] 3.2 Wire FluiInstance config into existing FluiProvider context
  - [x] 3.3 Ensure LiquidView components work immediately with FluiInstance
- [x] Task 4: Write co-located tests (AC: #5)
  - [x] 4.1 Create `packages/core/src/flui.test.ts` with comprehensive test suite
  - [x] 4.2 Test default wiring (all modules created and interconnected)
  - [x] 4.3 Test minimal config (connector-only produces valid instance)
  - [x] 4.4 Test startup error scenarios (missing connector, invalid config)
  - [x] 4.5 Test module interconnection (generate → validate → cache flow)
  - [x] 4.6 Test custom config overrides (custom validators, cache config, policy)
- [x] Task 5: Update barrel exports and package wiring (AC: #1)
  - [x] 5.1 Update `packages/core/src/index.ts` to export `createFlui`, `FluiConfig`, `FluiInstance`
  - [x] 5.2 Update `packages/react/src/FluiProvider.tsx` for FluiInstance support
  - [x] 5.3 Verify build (tsup) and type checking (tsc --noEmit)
  - [x] 5.4 Verify all existing tests still pass (zero regressions)

## Dev Notes

### Architecture Compliance

**File location:** `packages/core/src/flui.ts` — as specified in the architecture document's directory structure.

**Type file:** `packages/core/src/flui.types.ts` — follows `{module}.types.ts` convention.

**Module pattern:** Factory function `createFlui()` — not a class. Returns `FluiInstance` interface. This is the top-level factory that imports from ALL other modules' barrel files.

**Error handling for config validation:** This is the ONE place where **throwing** is correct. Per architecture: "Return `Result<T, FluiError>` for async operations; throw only for programmer errors (invalid config at initialization)." The `createFlui()` function is synchronous and throws `FluiError` for invalid configuration.

**Module dependency:** `flui.ts` imports all modules (it's the factory wiring). No module imports from `flui.ts` — only the factory imports modules. This is explicitly documented in the architecture module boundary rules.

### Critical Interfaces to Implement

**FluiConfig** (new type to create):
```typescript
interface FluiConfig {
  /** Required: LLM connector instance (OpenAI, Anthropic, or custom) */
  connector: LLMConnector;
  /** Optional: Generation model and parameters */
  generation?: Partial<GenerationConfig>;
  /** Optional: Validation pipeline configuration */
  validation?: ValidationPipelineConfig;
  /** Optional: Cache configuration (defaults: L1+L2 enabled, L3 disabled) */
  cache?: CacheConfig;
  /** Optional: Cost budget configuration (defaults: no budget limit) */
  budget?: BudgetConfig;
  /** Optional: Concurrency/circuit breaker configuration */
  concurrency?: ConcurrencyConfig;
  /** Optional: Observability transports and config */
  observability?: ObservabilityCollectorConfig;
  /** Optional: Generation policy configuration */
  policy?: GenerationPolicyConfig;
  /** Optional: Lifecycle hooks */
  onGenerationStart?: (trace: GenerationTrace) => void;
  onGenerationComplete?: (trace: GenerationTrace) => void;
  onValidationError?: (errors: ValidationError[]) => void;
  onCacheHit?: (key: CacheKey, level: string) => void;
}
```

**FluiInstance** (new type to create):
```typescript
interface FluiInstance {
  /** Component registry for registering UI components */
  readonly registry: ComponentRegistry;
  /** Context engine for registering context providers */
  readonly context: ContextEngine;
  /** Observability collector for trace access */
  readonly observer: ObservabilityCollector;
  /** Metrics reporter for cost/cache metrics */
  readonly metrics: MetricsReporter;
  /** Data resolver registry for registering data resolvers */
  readonly data: DataResolverRegistry;
  /** Config object suitable for passing to FluiProvider */
  readonly config: FluiReactConfig;
}
```

**Note:** The `FluiInstance` does NOT expose a top-level `generate()` function. The generation pipeline is invoked through `LiquidView` → `useLiquidView` which uses the config from `FluiProvider`. The factory wires the config so that `FluiProvider` can pass it to the generation subsystem.

### Default Configuration Values

```typescript
// Default cache: L1 (memory) + L2 (session), no L3
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxEntries: 100,
  defaultTTL: 300_000, // 5 minutes
  l3Enabled: false,
};

// Default concurrency: latest-wins with standard circuit breaker
const DEFAULT_CONCURRENCY_CONFIG: ConcurrencyConfig = {
  circuitBreaker: {
    failureThreshold: 3,
    resetTimeout: 30_000, // 30 seconds
  },
};

// Default observability: console transport
const DEFAULT_OBSERVABILITY_CONFIG: ObservabilityCollectorConfig = {
  transports: [], // Will be populated with console transport if NODE_ENV !== 'production'
};
```

### Startup Validation Rules

The factory MUST validate at call time (synchronous throws):

1. `config.connector` is present and defined — throw `FluiError(FLUI_E0XX, 'configuration', 'createFlui requires a connector...')`
2. If `config.generation?.model` is empty string — throw with descriptive message
3. If `config.budget?.sessionBudget` is negative — throw with descriptive message
4. If `config.concurrency?.circuitBreaker?.failureThreshold` is < 1 — throw with descriptive message

Use a **new error code** for configuration errors. The next available code after FLUI_E032 is **FLUI_E033**. Allocate:
- `FLUI_E033`: "Invalid configuration: {details}" — category: `'configuration'`

### Existing Module Factories to Wire

Each factory function to call during `createFlui()`:

| Module | Factory | Required Config | Default |
|--------|---------|-----------------|---------|
| Registry | `new ComponentRegistry()` | None | Empty registry |
| Context | `createContextEngine()` | None | No default providers |
| Generation | `createGenerationOrchestrator(config)` | `connector`, `model` | Uses connector from FluiConfig |
| Validation | `createValidationPipeline(config?)` | None | All built-in validators |
| Cache | `createCacheManager(config?)` | None | L1+L2, 100 entries, 5min TTL |
| Cost | `createCostManager(config)` | `BudgetConfig` | No budget limit (Infinity) |
| Concurrency | `createConcurrencyController(config?)` | None | 3 failures, 30s reset |
| Policy | `createGenerationPolicyEngine(config?)` | None | Generate on cache miss |
| Observability | `createObservabilityCollector(config?)` | None | Console transport (dev) |
| Metrics | `createMetricsReporter()` | None | Aggregates from traces |
| Data | `createDataResolverRegistry(config?)` | None | Empty resolver registry |

### FluiProvider Integration Strategy

Currently `FluiProviderProps` accepts:
```typescript
interface FluiProviderProps {
  registry: ComponentRegistry;
  children: ReactNode;
  config?: FluiReactConfig;
}
```

The integration approach: Add an `instance` prop to `FluiProviderProps` as an alternative to `registry` + `config`. When `instance` is provided, extract `registry` and `config` from it. This is backward-compatible — existing usage with `registry` + `config` still works.

```typescript
interface FluiProviderProps {
  /** FluiInstance from createFlui() — provides registry and config automatically */
  instance?: FluiInstance;
  /** Component registry (required if instance not provided) */
  registry?: ComponentRegistry;
  children: ReactNode;
  config?: FluiReactConfig;
}
```

Validation: At least one of `instance` or `registry` must be provided, or throw a clear error.

### File Structure

```
packages/core/src/
├── flui.ts              # createFlui() factory (NEW)
├── flui.types.ts        # FluiConfig, FluiInstance types (NEW)
├── flui.test.ts         # Comprehensive tests (NEW)
└── index.ts             # Updated barrel exports (MODIFIED)

packages/react/src/
├── FluiProvider.tsx      # Updated for FluiInstance support (MODIFIED)
├── react.types.ts        # Updated FluiProviderProps (MODIFIED)
└── index.ts              # Updated if new types exported (MODIFIED)
```

### Testing Standards

- **Framework:** Vitest with `globals: false` (explicit imports)
- **Pattern:** `describe()` → `it()` blocks with descriptive names
- **Assertions:** `expect()` with specific matchers — no generic `toBeTruthy()`
- **Coverage target:** >90% statement coverage
- **Import style:** `import { describe, it, expect, vi } from 'vitest'`
- **Mock connector:** Use `createMockConnector()` from `@flui/testing` for tests
- **No mocking module internals** — test through the public API

### Test Scenarios

```typescript
describe('createFlui', () => {
  describe('minimal configuration', () => {
    it('creates instance with connector-only config');
    it('returns FluiInstance with all expected properties');
    it('registry is empty ComponentRegistry');
    it('config is valid FluiReactConfig for FluiProvider');
  });

  describe('startup validation', () => {
    it('throws FluiError when connector is missing');
    it('throws FluiError when connector is undefined');
    it('throws immediately, not at first generation');
    it('error message describes the misconfiguration');
    it('error code is FLUI_E033');
  });

  describe('default wiring', () => {
    it('validation pipeline includes all built-in validators');
    it('cache uses L1 and L2 by default');
    it('observability uses console transport in dev');
    it('concurrency controller has circuit breaker');
    it('policy defaults to generate on cache miss');
  });

  describe('custom configuration', () => {
    it('accepts custom validation config');
    it('accepts custom cache config with L3 enabled');
    it('accepts custom budget config');
    it('accepts custom observability transports');
    it('accepts custom concurrency config');
  });

  describe('module interconnection', () => {
    it('config.connector is wired to generation orchestrator');
    it('validation pipeline is accessible through config');
    it('cache manager is wired with correct config');
  });
});
```

### Previous Story Intelligence (from Story 8.4)

**Key learnings from the testing package implementation:**
- Factory pattern consistency: `createMockConnector()`, `createSpecBuilder()` — all use closure-based state, not classes
- `FluiProviderProps` currently requires `registry: ComponentRegistry` and optional `config?: FluiReactConfig`
- `FluiReactConfig` has: `connector?: LLMConnector`, `generationConfig?: GenerationConfig`, `validationConfig?: ValidationPipelineConfig`
- `@flui/testing` provides `createMockConnector()` and `createTestRegistry()` — use these in tests
- Build DTS error encountered with `FluiProviderProps.children` — resolved by passing children in props object
- `window.matchMedia` not available in jsdom — test-setup.ts with mock exists in `@flui/react` and `@flui/testing`
- 100% coverage achieved across all source files with 57 tests
- `zod` dependency needed for registry creation in tests — already present as devDependency

**Critical from code review feedback:**
- Peer dependency declarations must align with runtime usage
- Barrel export tests verify public API surface
- Validator pass-through tests prove generated configs work correctly

### Git Intelligence

Recent commit patterns:
- Factory pattern consistency: `createObservabilityCollector()`, `createMetricsReporter()`, `createConcurrencyController()`, `createGenerationPolicyEngine()`
- Zero new runtime dependencies per story — only imports from `@flui/core` internals (this is within `@flui/core` itself, so direct module imports are used)
- Test files co-located next to implementation files
- Barrel exports updated in `index.ts` files
- `FluiError` with specific error codes for each failure mode

### Key Anti-Patterns to AVOID

1. **DO NOT** create a class-based factory — use a plain function returning `FluiInstance` interface
2. **DO NOT** add any new runtime dependencies — `@flui/core` only depends on `zod`
3. **DO NOT** defer config validation to first generation — throw immediately in `createFlui()`
4. **DO NOT** use `any` type — use `unknown` and narrow, or specific types
5. **DO NOT** expose internal module instances directly — expose through typed interface only
6. **DO NOT** make `createFlui()` async — it's a synchronous factory
7. **DO NOT** import from internal module files — import from each module's `index.ts` barrel
8. **DO NOT** break backward compatibility of `FluiProviderProps` — the `instance` prop is additive
9. **DO NOT** create a global singleton — each `createFlui()` call produces an independent instance
10. **DO NOT** skip AbortSignal propagation — ensure generation config includes signal support
11. **DO NOT** use `export default` — only named exports per project convention
12. **DO NOT** add lifecycle hooks to `FluiInstance` return — hooks go in `FluiConfig` input only

### Dependencies Map

**Imports needed in `flui.ts` (all from within `@flui/core`):**
- `ComponentRegistry` from `./registry`
- `createContextEngine` from `./context`
- `createGenerationOrchestrator` from `./generation`
- `createValidationPipeline` from `./validation`
- `createCacheManager` from `./cache`
- `createCostManager` from `./policy`
- `createGenerationPolicyEngine` from `./policy`
- `createConcurrencyController` from `./concurrency`
- `createObservabilityCollector`, `createConsoleTransport`, `createMetricsReporter`, `createMetricsTransport` from `./observe`
- `createDataResolverRegistry` from `./data`
- `FluiError` from `./errors`

**Imports needed in `flui.types.ts`:**
- Type imports only: `LLMConnector`, `GenerationTrace`, `GenerationConfig`, `ValidationPipelineConfig`, `CacheConfig`, `BudgetConfig`, `ConcurrencyConfig`, `ObservabilityCollectorConfig`, `GenerationPolicyConfig`, `ComponentRegistry`, `ContextEngine`, `ObservabilityCollector`, `MetricsReporter`, `DataResolverRegistry`, `ValidationError`, `CacheKey`
- `FluiReactConfig` type from `@flui/react` is NOT imported — it's reconstructed from core types to avoid circular dependency

**Test imports:**
- `createMockConnector` from `@flui/testing` (add as devDependency if not already)
- `describe`, `it`, `expect`, `vi` from `vitest`

### Circular Dependency Prevention

`@flui/core` CANNOT import from `@flui/react` (react depends on core, not the other way). The `FluiInstance.config` property should be typed as:
```typescript
interface FluiInstanceConfig {
  connector: LLMConnector;
  generationConfig: GenerationConfig;
  validationConfig: ValidationPipelineConfig;
}
```
This matches the shape of `FluiReactConfig` without importing it. `@flui/react`'s `FluiProvider` can accept this because the structural types are compatible.

### Project Structure Notes

- Alignment with monorepo structure: `flui.ts` sits at `packages/core/src/` root level (not in a subdirectory) per architecture
- Build tool: tsup (already configured in `packages/core/tsup.config.ts`)
- Package manager: pnpm with workspace protocol (`workspace:*`)
- Turbo orchestrates cross-package builds and tests
- The `flui.ts` file is the architectural "top" of `@flui/core` — it imports from all modules but no module imports from it

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 8, Story 8.5]
- [Source: _bmad-output/planning-artifacts/prd.md#FR52, FR53, FR57, FR58]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-R6, NFR-M1, NFR-M3]
- [Source: _bmad-output/planning-artifacts/architecture.md#createFlui factory, FluiConfig]
- [Source: _bmad-output/planning-artifacts/architecture.md#Module Boundaries Within @flui/core]
- [Source: _bmad-output/planning-artifacts/architecture.md#Package Public API - Error handling]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Flow End-to-End]
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication Patterns - Callback/Hook Naming]
- [Source: packages/core/src/index.ts#barrel exports]
- [Source: packages/react/src/FluiProvider.tsx#FluiProviderProps]
- [Source: packages/react/src/react.types.ts#FluiReactConfig, FluiProviderProps]
- [Source: _bmad-output/implementation-artifacts/8-4-testing-package-mockconnector-and-assertion-helpers.md#Dev Notes]

## Dev Agent Record

### Agent Model Used

openai/gpt-5.3-codex

### Debug Log References

- `pnpm --dir packages/core test`
- `pnpm --dir packages/react test`
- `pnpm --dir packages/core build`
- `pnpm --dir packages/react build`

### Completion Notes List

- Implemented `createFlui()` factory with startup validation and default module wiring.
- Added new Flui factory types and exported them through the core package barrel.
- Added `FLUI_E033` for startup configuration errors and updated error code tests.
- Extended React provider API to support `instance` prop while preserving backward compatibility.
- Added comprehensive core factory tests and provider integration tests.
- Verified all core/react tests pass and both packages build successfully.

### File List

- packages/core/src/flui.types.ts
- packages/core/src/flui.ts
- packages/core/src/flui.test.ts
- packages/core/src/index.ts
- packages/core/src/index.test.ts
- packages/core/src/errors/error-codes.ts
- packages/core/src/errors/index.ts
- packages/core/src/errors/errors.test.ts
- packages/react/src/react.types.ts
- packages/react/src/FluiProvider.tsx
- packages/react/src/FluiProvider.test.tsx

### Change Log

- 2026-02-27: Implemented Story 8.5 factory, provider integration, and test coverage updates from code review fixes.
