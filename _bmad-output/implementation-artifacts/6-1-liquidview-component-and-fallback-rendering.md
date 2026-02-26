# Story 6.1: LiquidView Component & Fallback Rendering

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to add a single LiquidView component with a mandatory fallback to my React app and have it render validated UI specifications,
So that I can integrate liquid interfaces into my existing application without modifying other components.

## Acceptance Criteria

1. **FluiProvider context wrapper** (FR53, NFR-I4): Given the `@flui/react` package, when a developer wraps their app with `FluiProvider` and places a `LiquidView` component, then `FluiProvider` accepts a `ComponentRegistry` (for component lookups) and optional configuration. `FluiProvider` does not conflict with existing React context providers in the host application and has zero dependency on specific state management libraries (NFR-I3).

2. **Mandatory fallback prop** (FR58): Given a `LiquidView` component, then it accepts a mandatory `fallback` prop of type `React.ReactNode`. If the `fallback` prop is omitted, TypeScript produces a compilation error. This is enforced through required prop typing, not runtime validation.

3. **LiquidView props** (FR53): Given a `LiquidView` component, then it accepts `intent` (string or `IntentObject`), optional `context` configuration, optional `data`, and a mandatory `fallback` prop. No other components in the host application need modification.

4. **Idle state** : Given a `LiquidView` component mounted with no generation triggered, then it is in the `idle` state and renders nothing (or the fallback if configured to show on idle).

5. **State progression** : Given a `LiquidView` component, when a generation is triggered (by providing an intent), then it progresses through states: `idle` → `generating` → `validating` → `rendering`. The state never skips steps and no new states are invented. States follow the architecture-defined `LiquidViewState` type exactly.

6. **Spec rendering** (FR19): Given a `LiquidView` in `rendering` state, when a validated `UISpecification` is available, then the spec renderer maps each `ComponentSpec` to the corresponding registered React component from the `ComponentRegistry`. Components are rendered with their declared props. Mount-to-fallback render completes in < 16ms (one frame, NFR-P9).

7. **Error state and fallback** (NFR-R1): Given any LLM failure scenario (timeout, network error, rate limit, malformed response), when generation or validation fails, then `LiquidView` enters `error` state and renders the fallback UI. The `FluiError` is accessible via the error state for developer inspection.

8. **FluiProvider isolation** (NFR-I4): Given `FluiProvider`, then it does not conflict with existing React context providers in the host application and has zero dependency on specific state management libraries (NFR-I3).

9. **Bundle size** (NFR-P7): Given the `@flui/react` package, then the bundle size is < 8KB gzipped as enforced by `.size-limit.json`.

10. **Test coverage**: Co-located tests use React Testing Library to verify state transitions, fallback rendering on all failure modes, spec-to-component mapping, and `FluiProvider` isolation. All tests pass with >90% coverage.

## Tasks / Subtasks

- [x] Task 1: Set up `@flui/react` package dependencies and testing infrastructure (AC: #10)
  - [x] 1.1 Add `@testing-library/react` (16.3.2), `@testing-library/jest-dom` and `jsdom` to devDependencies in `packages/react/package.json`
  - [x] 1.2 Create `packages/react/vitest.config.ts` with `jsdom` environment for React component testing
  - [x] 1.3 Update `tsup.config.ts` entry to include `.tsx` files (`entry: ['src/index.ts']` — tsup handles tsx natively)
  - [x] 1.4 Verify `tsconfig.json` has `"jsx": "react-jsx"` (already present)

- [x] Task 2: Define React adapter types (AC: #1, #2, #3, #4, #5)
  - [x] 2.1 Create `packages/react/src/react.types.ts` with `LiquidViewState` type (strict 5-state union: idle, generating, validating, rendering, error)
  - [x] 2.2 Define `LiquidViewProps` interface: `{ intent?: string | IntentObject; context?: Record<string, unknown>; data?: Record<string, unknown>; fallback: React.ReactNode; onStateChange?: (state: LiquidViewState) => void; onError?: (error: FluiError) => void; className?: string; style?: React.CSSProperties }`
  - [x] 2.3 Define `FluiProviderProps` interface: `{ registry: ComponentRegistry; children: React.ReactNode; config?: FluiReactConfig }`
  - [x] 2.4 Define `FluiReactConfig` type: `{ connector?: LLMConnector; generationConfig?: GenerationConfig; validationConfig?: ValidationPipelineConfig }`
  - [x] 2.5 Define `FluiContextValue` type for internal context: `{ registry: ComponentRegistry; config?: FluiReactConfig }`
  - [x] 2.6 Export all types from `react.types.ts`

- [x] Task 3: Implement `FluiProvider` context component (AC: #1, #8)
  - [x] 3.1 Create `packages/react/src/FluiProvider.tsx`
  - [x] 3.2 Create `FluiContext` using `React.createContext<FluiContextValue | null>(null)` (null default to detect missing provider)
  - [x] 3.3 Implement `FluiProvider` component that provides `FluiContextValue` via context
  - [x] 3.4 Create `useFluiContext()` hook that reads from `FluiContext` with proper null check (throws descriptive error if used outside `FluiProvider`)
  - [x] 3.5 Ensure `FluiProvider` is a simple context wrapper — no side effects, no state management library dependency

- [x] Task 4: Implement spec renderer (AC: #6)
  - [x] 4.1 Create `packages/react/src/renderer/spec-renderer.tsx`
  - [x] 4.2 Implement `renderSpec(spec: UISpecification, registry: ComponentRegistry): React.ReactNode` function
  - [x] 4.3 For each `ComponentSpec`, look up registered component from `registry.getByName(spec.componentType)`
  - [x] 4.4 Cast the `component` field (which is `unknown` in core) to `React.ComponentType<Record<string, unknown>>` in the React adapter
  - [x] 4.5 Render each component with its declared `props` and `key` (using `spec.id` as React key)
  - [x] 4.6 Recursively render `children` ComponentSpecs
  - [x] 4.7 Handle missing component gracefully — render nothing (don't crash)
  - [x] 4.8 Create `packages/react/src/renderer/index.ts` barrel export

- [x] Task 5: Implement `useLiquidView` hook (AC: #4, #5, #7)
  - [x] 5.1 Create `packages/react/src/hooks/use-liquid-view.ts`
  - [x] 5.2 Implement state machine with `useState<LiquidViewState>` — enforce strict state transitions
  - [x] 5.3 Accept generation parameters (intent, context, data) and produce `LiquidViewState`
  - [x] 5.4 On intent change: transition idle → generating → (call generation orchestrator) → validating → (call validation pipeline) → rendering
  - [x] 5.5 On any error: transition to error state with `FluiError`, expose for developer inspection
  - [x] 5.6 Support `AbortSignal` — cancel in-flight generation when intent changes or component unmounts
  - [x] 5.7 Create `packages/react/src/hooks/index.ts` barrel export

- [x] Task 6: Implement `LiquidView` component (AC: #2, #3, #4, #5, #6, #7)
  - [x] 6.1 Create `packages/react/src/LiquidView.tsx`
  - [x] 6.2 `LiquidView` uses `useFluiContext()` to get registry and config from `FluiProvider`
  - [x] 6.3 `LiquidView` uses `useLiquidView()` hook for state management
  - [x] 6.4 Render logic based on state: idle → null/fallback, generating → fallback, validating → fallback, rendering → spec renderer output, error → fallback
  - [x] 6.5 Expose `FluiError` in error state for developer inspection via `onError` callback
  - [x] 6.6 Apply `className` and `style` props to wrapper div
  - [x] 6.7 TypeScript enforces mandatory `fallback` prop (required in `LiquidViewProps`)

- [x] Task 7: Update barrel exports and package index (AC: #1, #2, #3)
  - [x] 7.1 Update `packages/react/src/index.ts` to export `FluiProvider`, `LiquidView`, `useFluiContext`, `useLiquidView`, and all types
  - [x] 7.2 Use explicit named exports (no `export *`, no `export default`)
  - [x] 7.3 Verify TypeScript compilation succeeds with all exports

- [x] Task 8: Write comprehensive tests (AC: #1, #2, #4, #5, #6, #7, #8, #10)
  - [x] 8.1 Create `packages/react/src/FluiProvider.test.tsx` — test provider isolation, context value, error without provider
  - [x] 8.2 Create `packages/react/src/renderer/spec-renderer.test.tsx` — test component mapping, recursive children, missing component handling, props passing
  - [x] 8.3 Create `packages/react/src/hooks/use-liquid-view.test.ts` — test state transitions, error handling, abort on unmount
  - [x] 8.4 Create `packages/react/src/LiquidView.test.tsx` — test fallback rendering, state progression, error → fallback, mandatory fallback prop (TypeScript check), integration with FluiProvider
  - [x] 8.5 Test all failure modes: timeout, network error, rate limit, malformed response → all show fallback
  - [x] 8.6 Test FluiProvider does not conflict with other React context providers
  - [x] 8.7 Test spec rendering maps ComponentSpec to registered React components with correct props
  - [x] 8.8 Remove or update existing placeholder test in `packages/react/src/index.test.ts`
  - [x] 8.9 Verify all tests pass with >90% coverage

## Dev Notes

### Architecture Compliance

**Package:** `@flui/react` — React adapter package (NEW implementation, replacing empty barrel)

**File structure (architecture-specified):**
```
packages/react/src/
  ├── index.ts                    # Package public API barrel
  ├── LiquidView.tsx              # Main LiquidView component
  ├── FluiProvider.tsx            # Context provider
  ├── react.types.ts              # All React adapter types
  ├── hooks/
  │   ├── index.ts                # Hooks barrel
  │   ├── use-liquid-view.ts      # Core generation state machine hook
  │   └── use-fluid-context.ts    # Context access hook (architecture name)
  ├── renderer/
  │   ├── index.ts                # Renderer barrel
  │   └── spec-renderer.tsx       # UISpecification → React components
  ├── FluiProvider.test.tsx        # FluiProvider tests
  ├── LiquidView.test.tsx          # LiquidView integration tests
  ├── hooks/
  │   └── use-liquid-view.test.ts  # Hook state machine tests
  └── renderer/
      └── spec-renderer.test.tsx   # Renderer tests
```

**NOTE:** The architecture also specifies `debug/`, `renderer/view-state.ts`, `renderer/interaction-wiring.ts`, `renderer/transitions.tsx`, `renderer/data-resolver.tsx`, `renderer/a11y.tsx` — these are for Stories 6.2 and 6.3 respectively. Do NOT create them in this story. Only create files needed for Story 6.1.

**Package dependency rules:**
- `@flui/react` → `@flui/core` (peer dependency), `react` + `react-dom` (peer dependencies)
- `@flui/react` has ZERO awareness of specific LLM providers (OpenAI, Anthropic)
- `@flui/react` has ZERO awareness of specific state management libraries
- `@flui/core` has ZERO awareness of React — the adapter bridges them
- Import from `@flui/core` barrel: `import { type UISpecification, ... } from '@flui/core'`
- NEVER import internal `@flui/core` module files directly

### Implementation Patterns (MUST follow)

**LiquidViewState type (architecture-defined, exact):**
```typescript
type LiquidViewState =
  | { status: 'idle' }
  | { status: 'generating'; trace: GenerationTrace }
  | { status: 'validating'; rawSpec: unknown }
  | { status: 'rendering'; spec: UISpecification }
  | { status: 'error'; error: FluiError; fallback: true }
```

**CRITICAL: NEVER invent new states. NEVER skip states. State transitions are strictly:**
- `idle` → `generating` (intent provided)
- `generating` → `validating` (LLM response received)
- `validating` → `rendering` (validation passes)
- `validating` → `error` (validation fails)
- `generating` → `error` (generation fails)
- `error` → `generating` (new intent provided)
- `rendering` → `generating` (intent changes)

**FluiProvider pattern:**
```typescript
import { createContext, useContext, type ReactNode } from 'react';
import type { ComponentRegistry } from '@flui/core';

interface FluiContextValue {
  registry: ComponentRegistry;
  config?: FluiReactConfig;
}

const FluiContext = createContext<FluiContextValue | null>(null);

export function FluiProvider({ registry, config, children }: FluiProviderProps): ReactNode {
  const value = useMemo(() => ({ registry, config }), [registry, config]);
  return <FluiContext.Provider value={value}>{children}</FluiContext.Provider>;
}

export function useFluiContext(): FluiContextValue {
  const ctx = useContext(FluiContext);
  if (!ctx) {
    throw new Error('useFluiContext must be used within a FluiProvider');
  }
  return ctx;
}
```

**Spec Renderer pattern:**
```typescript
import type { UISpecification, ComponentSpec, ComponentRegistry } from '@flui/core';
import { createElement, type ReactNode } from 'react';

export function renderSpec(spec: UISpecification, registry: ComponentRegistry): ReactNode {
  return spec.components.map((componentSpec) =>
    renderComponentSpec(componentSpec, registry)
  );
}

function renderComponentSpec(spec: ComponentSpec, registry: ComponentRegistry): ReactNode {
  const entries = registry.query({ name: spec.componentType });
  if (entries.length === 0) {
    // Missing component — render nothing, don't crash
    return null;
  }
  const Component = entries[0].component as React.ComponentType<Record<string, unknown>>;
  const children = spec.children?.map((child) => renderComponentSpec(child, registry));
  return createElement(Component, { ...spec.props, key: spec.key ?? spec.id }, children);
}
```

**useLiquidView hook pattern:**
```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import type { GenerationTrace, FluiError } from '@flui/core';
import { createTrace } from '@flui/core';

export function useLiquidView(options: UseLiquidViewOptions): LiquidViewResult {
  const [state, setState] = useState<LiquidViewState>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cleanup: abort on unmount
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Generation trigger when intent changes
  useEffect(() => {
    if (!options.intent) {
      setState({ status: 'idle' });
      return;
    }

    // Abort previous generation
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const trace = createTrace();
    setState({ status: 'generating', trace });

    // ... generation flow
  }, [options.intent]);

  return { state };
}
```

**Result pattern (MUST use, never throw from public API):**
```typescript
import { type Result, isOk, isError, type FluiError } from '@flui/core';
```

### Error Handling

All generation and validation errors MUST result in the LiquidView rendering the fallback UI. The `FluiError` is exposed via:
1. The `state.error` field when `state.status === 'error'`
2. The `onError` callback prop on `LiquidView`

Error scenarios to handle:
- LLM timeout → error state → fallback
- Network error → error state → fallback
- Rate limit → error state → fallback
- Malformed LLM response → error state → fallback
- Validation failure → error state → fallback
- Missing component in registry during render → graceful skip (render remaining)
- AbortSignal cancellation → do not transition to error, keep current state

### Existing Code to Reuse (DO NOT reinvent)

| What | Where | How to use |
|------|-------|------------|
| `UISpecification` type | `@flui/core` barrel | Props for spec renderer |
| `ComponentSpec` type | `@flui/core` barrel | Individual component rendering |
| `ComponentRegistry` class | `@flui/core` barrel | Component lookup via `.query()` |
| `RegistryEntry` type | `@flui/core` barrel | Contains `component: unknown` field |
| `GenerationTrace` type | `@flui/core` barrel | Trace in generating state |
| `createTrace()` function | `@flui/core` barrel | Create trace for generation |
| `FluiError` class | `@flui/core` barrel | Error state errors |
| `Result`, `isOk`, `isError` | `@flui/core` barrel | Handle async results |
| `GenerationOrchestrator` | `@flui/core` barrel | Generation in useLiquidView hook |
| `ValidationPipeline` | `@flui/core` barrel | Validation in useLiquidView hook |
| `createGenerationOrchestrator()` | `@flui/core` barrel | Create orchestrator from config |
| `createValidationPipeline()` | `@flui/core` barrel | Create validation pipeline |
| `IntentObject` type | `@flui/core` barrel | Intent typing for props |
| `parseIntent()` function | `@flui/core` barrel | Parse string intent to IntentObject |

### Design Decisions

**Component lookup via `ComponentRegistry.query()`:** The `ComponentRegistry.query()` method accepts a filter with `name` field. The returned `RegistryEntry` has a `component` field typed as `unknown` (framework-agnostic in core). The React adapter casts this to `React.ComponentType<Record<string, unknown>>` at the rendering boundary.

**FluiProvider is lightweight:** FluiProvider is a thin context wrapper. It does NOT create generation orchestrators or validation pipelines — those are created inside `useLiquidView` when needed. This keeps the provider simple and avoids unnecessary resource allocation.

**Intent-driven generation trigger:** Generation is triggered when `intent` prop changes. No explicit `generate()` call is needed. The `useLiquidView` hook watches the intent and triggers the pipeline automatically. This follows the React paradigm of declarative rendering.

**AbortSignal on unmount and intent change:** When the component unmounts or the intent changes, the current generation is aborted via `AbortController`. This prevents stale results from being applied and avoids memory leaks.

**Fallback shows during generating and validating states:** While the LLM is working, the fallback UI is shown (or nothing if idle). This matches the loading UX strategy (ADR-009 defers Suspense to Phase 2).

**No Suspense in Story 6.1:** Architecture decision explicitly defers Suspense integration to Phase 2. `LiquidView` manages its own loading states.

**No transitions/animations in Story 6.1:** Crossfade transitions are Story 6.3. This story renders specs directly without animation.

**No interaction wiring in Story 6.1:** `InteractionSpec` wiring is Story 6.2. This story renders components with props but does not wire data flows between them.

**No view state management in Story 6.1:** View state persistence across regeneration is Story 6.2.

### Project Structure Notes

- This is the FIRST implementation in `@flui/react` — replacing the empty barrel
- The package scaffold already exists: `package.json`, `tsconfig.json`, `tsup.config.ts` are set up
- React 18+ is the target — do NOT use React 19-only features like `use()` hook
- `@testing-library/react` (16.3.2) needs to be added to devDependencies
- Tests should use `jsdom` environment for React component rendering
- After this story, Story 6.2 adds interaction wiring and view state, Story 6.3 adds transitions and a11y
- The architecture specifies additional files in `renderer/`, `hooks/`, `debug/` — only create what's needed for this story

### Previous Story Intelligence

**From Story 5-3 (Custom Validators & Validation Retry — last completed story):**
- Pipeline `validate()` returns `Promise<Result<UISpecification, FluiError>>` — use this result in useLiquidView
- `validateWithRetry()` accepts `RegenerateFn` callback — the `useLiquidView` hook could wire this for automatic retry
- 391 tests passing across 14 test files — maintain zero regressions
- Factory function + closure pattern used throughout core — follow similar patterns in React adapter
- Error codes go up to `FLUI_E023` — any new React-specific errors should continue the sequence
- `AbortSignal` is checked before and after async operations — follow this pattern in the generation hook

**From Story 5-2 (Accessibility & Data Authorization):**
- `ValidatorContext` requires `registry: ComponentRegistry` — the hook will need to pass the registry from FluiProvider context
- `authorizedDataIdentifiers` is optional in `ValidatorContext` — can be passed via LiquidView props later

**From Story 4-2 (Generation Orchestrator):**
- `createGenerationOrchestrator(config: GenerationConfig)` — requires a `connector`, `model`, etc.
- `orchestrator.generate(input, trace, signal)` — the hook needs `GenerationInput` with `intent`, `context`, `registry`
- `SerializedRegistry` is needed for prompt construction — `registry.serialize()` provides this

**From Story 4-3 (Streaming Generation):**
- `createStreamingOrchestrator()` is available for streaming support — could be used in the hook if a `StreamingLLMConnector` is provided
- `onProgress` callback for progressive rendering — not in scope for 6.1 but design the hook to not block it

### Git Intelligence

**Recent commit patterns:**
- All commits follow `feat: implement <description> (story X-Y)` format
- Story implementation order: types/interfaces first → implementation → tests → barrel exports → core index updates
- All previous stories completed with zero regressions (391 tests pass)
- `dc07399` is the latest commit (story 5-3)

**Most recent commit analysis:**
- 5-3 added `validateWithRetry()` which the React hook will eventually use
- Test patterns: Vitest with `describe > describe > it`, mock functions via `vi.fn()`
- All modules use factory functions (e.g., `createValidationPipeline()`) — React adapter should follow `useLiquidView()` hook pattern

### Testing Standards

- **Framework:** Vitest 4.0.18 with `jsdom` environment (for React component tests)
- **React testing:** `@testing-library/react` 16.3.2 — `render()`, `screen`, `waitFor`, `act`
- **Import pattern:** Import from `@flui/core` barrel — never internal module files
- **Coverage:** >90% statement coverage required
- **Test structure:** `describe('LiquidView') > describe('state transitions') > it('shows fallback on error')`
- **Mock pattern:**
  - Mock `ComponentRegistry` with test components
  - Mock `LLMConnector` with `vi.fn()` returning controlled `Result` values
  - Mock `GenerationOrchestrator` for hook tests
  - Use `@testing-library/react` `render()` and `screen` queries for component tests
- **Both paths:** Test `Result.ok` and `Result.error` paths for generation and validation
- **Error scenarios:** Test all failure modes: timeout, network, rate limit, malformed response → all show fallback
- **Async tests:** Use `waitFor()` from RTL for async state transitions
- **AbortSignal tests:** Use `AbortController` to test cleanup on unmount

### Performance Considerations

- **Bundle size budget:** < 8KB gzipped (`.size-limit.json` already configured)
- **Mount-to-fallback:** < 16ms (one frame) — keep `LiquidView` render path minimal
- **Spec renderer:** O(n) where n = total components in spec tree — use `key` for React reconciliation
- **No heavy dependencies:** Only `react` and `@flui/core` as peers — no additional runtime dependencies
- **Memoization:** Use `useMemo` for FluiProvider value, `useCallback` for event handlers to prevent unnecessary re-renders
- **Cleanup:** AbortController on unmount prevents memory leaks from pending generations

### Library/Framework Requirements

| Library | Version | Purpose | Already in package.json? |
|---------|---------|---------|-------------------------|
| `react` | >=18.0.0 | Core React (peer dep) | Yes (peer) |
| `react-dom` | >=18.0.0 | React DOM rendering (peer dep) | Yes (peer) |
| `@flui/core` | workspace:* | Core types and pipeline (peer dep) | Yes (peer) |
| `@testing-library/react` | 16.3.2 | Component testing | NO — add to devDependencies |
| `@testing-library/jest-dom` | latest | DOM assertion matchers | NO — add to devDependencies |
| `jsdom` | latest | DOM environment for Vitest | NO — add to devDependencies |

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.1] - User story, acceptance criteria, BDD scenarios
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 6] - Epic objectives, cross-story dependencies
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture — React Adapter] - React 18+ target, no Suspense in Phase 1
- [Source: _bmad-output/planning-artifacts/architecture.md#Loading State Pattern] - LiquidViewState 5-state machine (lines 446-452)
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Directory Structure] - packages/react/ file layout (lines 658-685)
- [Source: _bmad-output/planning-artifacts/architecture.md#Package Dependency Boundaries] - @flui/react → @flui/core (peer), react + react-dom (peer)
- [Source: _bmad-output/planning-artifacts/architecture.md#Module Boundary Rules] - @flui/core has zero React awareness
- [Source: _bmad-output/planning-artifacts/architecture.md#Validation Pattern] - Zero-bypass validation before rendering
- [Source: _bmad-output/planning-artifacts/architecture.md#Import Pattern] - Import from barrel files only
- [Source: _bmad-output/planning-artifacts/architecture.md#Verified Technology Versions] - React 19.2.4 (target: 18+), RTL 16.3.2
- [Source: _bmad-output/planning-artifacts/prd.md#FR19] - Render validated UISpecification into React components
- [Source: _bmad-output/planning-artifacts/prd.md#FR53] - Single LiquidView component, no other modifications needed
- [Source: _bmad-output/planning-artifacts/prd.md#FR58] - TypeScript compilation error for missing fallback
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-R1] - 100% fallback on all LLM failure scenarios
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-I3] - Zero dependency on specific state management libraries
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-I4] - No conflict with existing React context providers
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-P7] - @flui/react bundle < 8KB gzipped
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-P9] - Mount-to-fallback render < 16ms
- [Source: .size-limit.json] - @flui/react limit: 8 kB gzipped
- [Source: packages/react/package.json] - Current package setup with peer deps
- [Source: packages/react/tsconfig.json] - jsx: react-jsx configured
- [Source: packages/core/src/spec/spec.types.ts] - UISpecification, ComponentSpec, LayoutSpec, InteractionSpec
- [Source: packages/core/src/types.ts] - GenerationTrace, LLMConnector, createTrace
- [Source: packages/core/src/registry/registry.ts] - ComponentRegistry with query() method
- [Source: packages/core/src/generation/generation-orchestrator.ts] - createGenerationOrchestrator, GenerationOrchestrator
- [Source: packages/core/src/validation/pipeline.ts] - createValidationPipeline, ValidationPipeline
- [Source: _bmad-output/implementation-artifacts/5-3-custom-validators-and-validation-retry.md] - Previous story intelligence

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed pre-existing DTS build error in `packages/core/src/data/resolver.ts` (TS2532: Object possibly undefined) — used non-null assertion for array element after length check.
- Initial test runs failed due to `zod` not being available as devDependency in `@flui/react` — added `zod: 4.3.6` to devDependencies for test registry creation.
- DOM not being cleaned between RTL tests — added `src/test-setup.ts` with `cleanup()` afterEach.
- Used `registry.getByName()` instead of `registry.query()` as the story spec's pattern referenced a method that doesn't exist on `ComponentRegistry`.

### Completion Notes List

- Implemented all 8 tasks for Story 6.1: LiquidView Component & Fallback Rendering
- Created `@flui/react` React adapter with FluiProvider, LiquidView, useLiquidView, useFluiContext, renderSpec
- LiquidViewState is a strict 5-state discriminated union: idle, generating, validating, rendering, error
- FluiProvider is a lightweight context wrapper with zero state management dependency
- Spec renderer maps ComponentSpecs to registered React components via ComponentRegistry.getByName()
- useLiquidView hook manages full generation lifecycle with AbortController cleanup
- All error scenarios (timeout, network, rate limit, malformed, validation) render fallback UI
- TypeScript enforces mandatory `fallback` prop at compile time
- 51 tests across 5 test files — 91.58% statement coverage, 96% line coverage
- 392 core tests pass — zero regressions
- ESM bundle: 5.49 KB (well under 8 KB gzip limit)
- Build succeeds (ESM + CJS + DTS)

### File List

**New files:**
- packages/react/src/react.types.ts
- packages/react/src/FluiProvider.tsx
- packages/react/src/LiquidView.tsx
- packages/react/src/hooks/use-liquid-view.ts
- packages/react/src/hooks/index.ts
- packages/react/src/renderer/spec-renderer.tsx
- packages/react/src/renderer/index.ts
- packages/react/src/test-setup.ts
- packages/react/src/FluiProvider.test.tsx
- packages/react/src/LiquidView.test.tsx
- packages/react/src/hooks/use-liquid-view.test.ts
- packages/react/src/renderer/spec-renderer.test.tsx
- packages/react/vitest.config.ts

**Modified files:**
- packages/react/package.json (added testing deps + zod)
- packages/react/src/index.ts (replaced empty barrel with real exports)
- packages/react/src/index.test.ts (updated to test actual exports)
- packages/core/src/data/resolver.ts (fixed pre-existing TS2532 DTS error)
- pnpm-lock.yaml (lockfile updates from dependency/script changes)
- _bmad-output/implementation-artifacts/sprint-status.yaml (story status sync)

## Senior Developer Review (AI)

### Reviewer

Fabrice (AI-assisted) on 2026-02-26

### Outcome

Approve

### Findings Addressed

- Fixed Flui config mismatch by wiring top-level `config.connector` into generation config resolution in `packages/react/src/hooks/use-liquid-view.ts`
- Preserved structured intent semantics by mapping `IntentObject` back to structured `Intent` when possible in `packages/react/src/hooks/use-liquid-view.ts`
- Reduced unintended generation churn by triggering generation effect from `intent` changes only in `packages/react/src/hooks/use-liquid-view.ts`
- Added explicit coverage workflow and thresholds (>90% statements/lines/functions) via `packages/react/package.json` and `packages/react/vitest.config.ts`
- Added regression tests for structured intent preservation, top-level connector usage, and context-change non-regeneration in `packages/react/src/hooks/use-liquid-view.test.ts`
- Aligned file transparency by recording lockfile and sprint-status updates in this story's File List

## Change Log

- 2026-02-26: Implemented Story 6.1 — LiquidView Component & Fallback Rendering. Created FluiProvider context wrapper, LiquidView component with mandatory fallback, useLiquidView state machine hook, spec renderer for UISpecification→React mapping. 48 tests, 90%+ coverage, zero regressions.
- 2026-02-26: Senior code review executed; fixed 6 findings (3 high, 3 medium), added coverage thresholds, expanded hook behavior tests, and marked story as done after verification.
