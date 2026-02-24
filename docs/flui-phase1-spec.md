# Flui — Phase 1 Implementation Specification

> This document defines the exact scope, architecture, and acceptance criteria for Flui Phase 1.
> It references `flui-framework-vision.md` (strategic vision) and `flui-architecture-decisions.md` (ADRs) for context and decisions.
>
> **Purpose:** Enable LLM-assisted development of Flui Phase 1 with unambiguous implementation guidance.
>
> **Milestone:** A developer can `npm install @flui/react` and have a working liquid view in 5 minutes.

---

## Table of Contents

1. [Scope Overview](#1-scope-overview)
2. [Package Structure](#2-package-structure)
3. [Implementation Sequence](#3-implementation-sequence)
4. [Module Specifications](#4-module-specifications)
   - [4.1 UISpecification Schema](#41-uispecification-schema)
   - [4.2 Component Registry](#42-component-registry)
   - [4.3 Intent Parser](#43-intent-parser)
   - [4.4 Context Engine](#44-context-engine)
   - [4.5 Generation Orchestrator](#45-generation-orchestrator)
   - [4.6 Validation Pipeline](#46-validation-pipeline)
   - [4.7 Cache Manager](#47-cache-manager)
   - [4.8 Generation Policy](#48-generation-policy)
   - [4.9 Concurrency Controller](#49-concurrency-controller)
   - [4.10 Cost Manager](#410-cost-manager)
   - [4.11 Observability Collector](#411-observability-collector)
   - [4.12 React Adapter](#412-react-adapter)
   - [4.13 LLM Connectors](#413-llm-connectors)
   - [4.14 Testing Utilities](#414-testing-utilities)
5. [Explicitly Deferred (NOT Phase 1)](#5-explicitly-deferred-not-phase-1)
6. [Performance Budgets](#6-performance-budgets)
7. [Acceptance Criteria](#7-acceptance-criteria)
8. [Example Applications](#8-example-applications)
9. [Phase 1 Deliverables Checklist](#9-phase-1-deliverables-checklist)

---

## 1. Scope Overview

### What's IN Phase 1

| Package | Scope |
|---------|-------|
| `@flui/core` | Intent Parser (programmatic + explicit), Context Engine (identity + environment), Component Registry, Generation Orchestrator, Validation Pipeline (schema + component + prop + a11y + data), Cache Manager (L1 + L2 + L3), Generation Policy, Concurrency Controller, Cost Manager (basic), Observability Collector (console + in-memory) |
| `@flui/react` | LiquidView, FluiProvider, ViewState management, transition system (basic crossfade), debug overlay (Spec + Trace tabs) |
| `@flui/openai` | OpenAI connector with streaming support |
| `@flui/anthropic` | Anthropic connector with streaming support |
| `@flui/testing` | MockConnector, `generateSpec` test helper, `testLiquidView` helper |

### What's explicitly OUT of Phase 1

| Item | Deferred To | Reason |
|------|------------|--------|
| `@flui/vue`, `@flui/angular`, `@flui/svelte` | Phase 2 | Focus on one adapter first; others follow same pattern |
| `@flui/ollama`, `@flui/mistral` | Phase 2 | OpenAI + Anthropic cover the primary use cases |
| `@flui/ag-ui`, `@flui/a2ui`, `@flui/mcp` | Phase 2 | Protocol adapters require stable core first |
| `@flui/devtools` browser extension | Phase 2 | Inline debug overlay (ADR-019) covers Phase 1 needs |
| `@flui/compliance` | Phase 3 | Custom validators cover basic compliance needs |
| `@flui/analytics`, `@flui/design-system`, `@flui/i18n` | Phase 3 | Enterprise features |
| `@flui/offline` (on-device LLM) | Phase 4 | Cache + fallback covers Phase 1 offline (ADR-020) |
| SSR / SSG | Phase 2 | CSR first; SSR for Next.js as Phase 2 priority (ADR-016) |
| Batched / coordinated multi-view | Phase 2 | Independent mode only in Phase 1 (ADR-012) |
| Expertise context provider (learning) | Phase 2 | Requires usage data accumulation |
| Cognitive context provider (load inference) | Phase 2 | Requires interaction tracking heuristics |
| Predictive intent | Phase 2 | Requires usage pattern analysis |
| What-If debug mode | Phase 2 | Basic Spec + Trace tabs in Phase 1 (ADR-019) |
| Edit Spec debug mode | Phase 2 | Read-only spec view in Phase 1 |
| Property-based tests (Tier 3) | Late Phase 1 | After rules system is stable |
| Golden-file tests (Tier 4) | Phase 2 | Requires CI infrastructure with LLM access |
| Stale-while-revalidate cache | Late Phase 1 | Basic TTL cache first, SWR as optimization |

---

## 2. Package Structure

### Monorepo layout

```
flui/
├── packages/
│   ├── core/                          # @flui/core
│   │   ├── src/
│   │   │   ├── intent/                # Intent Parser
│   │   │   │   ├── parser.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── index.ts
│   │   │   ├── context/               # Context Engine
│   │   │   │   ├── engine.ts
│   │   │   │   ├── providers/
│   │   │   │   │   ├── identity.ts
│   │   │   │   │   ├── environment.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── index.ts
│   │   │   ├── registry/              # Component Registry
│   │   │   │   ├── registry.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── index.ts
│   │   │   ├── generation/            # Generation Orchestrator
│   │   │   │   ├── orchestrator.ts
│   │   │   │   ├── prompt-builder.ts
│   │   │   │   ├── spec-parser.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── index.ts
│   │   │   ├── validation/            # Validation Pipeline
│   │   │   │   ├── pipeline.ts
│   │   │   │   ├── validators/
│   │   │   │   │   ├── schema.ts
│   │   │   │   │   ├── component.ts
│   │   │   │   │   ├── prop.ts
│   │   │   │   │   ├── layout.ts
│   │   │   │   │   ├── a11y.ts
│   │   │   │   │   ├── data.ts
│   │   │   │   │   └── interaction.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── index.ts
│   │   │   ├── cache/                 # Cache Manager (ADR-003)
│   │   │   │   ├── manager.ts
│   │   │   │   ├── storage/
│   │   │   │   │   ├── memory.ts
│   │   │   │   │   ├── session.ts
│   │   │   │   │   └── indexeddb.ts
│   │   │   │   ├── key.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── index.ts
│   │   │   ├── policy/                # Generation Policy (ADR-004) + Cost (ADR-006)
│   │   │   │   ├── generation-policy.ts
│   │   │   │   ├── cost-manager.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── index.ts
│   │   │   ├── concurrency/           # Concurrency Controller (ADR-005)
│   │   │   │   ├── controller.ts
│   │   │   │   ├── circuit-breaker.ts # (ADR-011)
│   │   │   │   ├── types.ts
│   │   │   │   └── index.ts
│   │   │   ├── observe/               # Observability Collector
│   │   │   │   ├── collector.ts
│   │   │   │   ├── trace.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── index.ts
│   │   │   ├── data/                  # Data Resolver (ADR-002)
│   │   │   │   ├── resolver.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── index.ts
│   │   │   ├── spec/                  # UISpecification types + versioning (ADR-017)
│   │   │   │   ├── types.ts
│   │   │   │   ├── version.ts
│   │   │   │   └── index.ts
│   │   │   ├── types.ts               # Shared types (LLMConnector, etc.)
│   │   │   ├── flui.ts                # createFlui() factory
│   │   │   └── index.ts               # Public API re-exports
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── react/                         # @flui/react
│   │   ├── src/
│   │   │   ├── LiquidView.tsx
│   │   │   ├── FluiProvider.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useLiquidView.ts
│   │   │   │   ├── useFluidDebug.ts
│   │   │   │   └── useFluidContext.ts
│   │   │   ├── renderer/
│   │   │   │   ├── spec-renderer.tsx
│   │   │   │   ├── view-state.ts      # ViewState management (ADR-001)
│   │   │   │   ├── interaction-wiring.ts  # InteractionSpec wiring (ADR-008)
│   │   │   │   ├── transitions.tsx    # Transition system (ADR-009)
│   │   │   │   ├── data-resolver.tsx  # Data fetching/binding (ADR-002)
│   │   │   │   └── a11y.tsx           # Focus management + ARIA (ADR-014)
│   │   │   ├── debug/
│   │   │   │   ├── DebugOverlay.tsx
│   │   │   │   ├── SpecTab.tsx
│   │   │   │   └── TraceTab.tsx
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── openai/                        # @flui/openai
│   │   ├── src/
│   │   │   ├── connector.ts
│   │   │   ├── streaming.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── anthropic/                     # @flui/anthropic
│   │   ├── src/
│   │   │   ├── connector.ts
│   │   │   ├── streaming.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── testing/                       # @flui/testing
│       ├── src/
│       │   ├── mock-connector.ts
│       │   ├── test-helpers.ts
│       │   ├── types.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── examples/
│   ├── basic-dashboard/               # Example 1: Simple dashboard
│   ├── invoice-hybrid/                # Example 2: Hybrid (static + liquid)
│   └── multi-view/                    # Example 3: Multiple LiquidViews
│
├── package.json                       # Monorepo root (workspace config)
├── tsconfig.base.json                 # Shared TypeScript config
├── vitest.config.ts                   # Test config
└── .size-limit.json                   # Bundle size enforcement (ADR-018)
```

### Tooling decisions

| Tool | Choice | Reason |
|------|--------|--------|
| **Monorepo** | pnpm workspaces | Fast, disk-efficient, native workspace support |
| **Build** | tsup (esbuild-based) | Fast builds, ESM + CJS dual output, tree-shaking |
| **Test** | Vitest | Fast, native ESM, compatible with React Testing Library |
| **Lint** | Biome | Fast, replaces ESLint + Prettier, zero-config |
| **CI size check** | size-limit | Lightweight, CI-friendly, per-export granularity |
| **Package publish** | changesets | Monorepo versioning and changelog management |

---

## 3. Implementation Sequence

Modules must be built in dependency order. Each sprint delivers a functional, testable increment.

```
Sprint 1: FOUNDATIONS
  ┌──────────────────────────────────────────────────────────┐
  │ spec/types.ts          → UISpecification, ComponentSpec, │
  │                          LayoutSpec, InteractionSpec      │
  │ types.ts               → LLMConnector interface          │
  │ registry/              → Component Registry              │
  │ validation/schema.ts   → Schema validator (Zod)          │
  │ validation/component.ts → Component existence validator   │
  │ validation/prop.ts     → Prop type validator (Zod)       │
  │ testing/mock-connector → MockConnector                   │
  └──────────────────────────────────────────────────────────┘
  Deliverable: Can register components, create specs manually,
               validate them, mock LLM responses.

Sprint 2: GENERATION CORE
  ┌──────────────────────────────────────────────────────────┐
  │ intent/                → Intent Parser                   │
  │ context/               → Context Engine + identity       │
  │                          + environment providers         │
  │ generation/            → Generation Orchestrator         │
  │                          + prompt builder                │
  │                          + spec parser                   │
  │ validation/pipeline.ts → Full pipeline chain             │
  │ validation/layout.ts   → Layout validator                │
  │ validation/a11y.ts     → A11y validator                  │
  │ validation/data.ts     → Data classification validator   │
  └──────────────────────────────────────────────────────────┘
  Deliverable: Can generate a UISpecification from an intent
               using MockConnector. Full validation pipeline.

Sprint 3: LLM INTEGRATION + CACHE
  ┌──────────────────────────────────────────────────────────┐
  │ openai/                → OpenAI connector + streaming    │
  │ anthropic/             → Anthropic connector + streaming │
  │ cache/                 → Cache Manager (L1 memory,       │
  │                          L2 session, L3 IndexedDB)       │
  │ observe/               → Observability Collector         │
  │                          (console + in-memory traces)    │
  │ generation/ update     → Wire cache into orchestrator    │
  │ data/                  → DataResolver (basic props +     │
  │                          resolver pattern)               │
  └──────────────────────────────────────────────────────────┘
  Deliverable: End-to-end generation with real LLMs. Cached.
               Observable. Data resolution working.

Sprint 4: REACT ADAPTER
  ┌──────────────────────────────────────────────────────────┐
  │ react/FluiProvider     → Provider component              │
  │ react/LiquidView      → LiquidView component            │
  │ react/spec-renderer    → Spec → React component mapping  │
  │ react/view-state       → ViewState management (ADR-001)  │
  │ react/interaction-wiring → InteractionSpec wiring        │
  │ react/transitions      → Basic crossfade transitions     │
  │ react/data-resolver    → Async data fetching in render   │
  │ react/a11y             → Focus management + ARIA live    │
  └──────────────────────────────────────────────────────────┘
  Deliverable: Working <LiquidView> in React. Full lifecycle:
               intent → generate → validate → cache → render
               with ViewState, interactions, transitions, a11y.

Sprint 5: POLICIES + RESILIENCE
  ┌──────────────────────────────────────────────────────────┐
  │ policy/generation-policy → Trigger/debounce/stability    │
  │ policy/cost-manager    → Cost tracking + budgets         │
  │ concurrency/controller → AbortController + latest-wins   │
  │ concurrency/circuit-breaker → Circuit breaker pattern    │
  │ generation/ update     → Wire policy + concurrency       │
  │                          + cost into orchestrator        │
  │ validation/interaction → Interaction binding validator    │
  └──────────────────────────────────────────────────────────┘
  Deliverable: Production-resilient generation with cost
               control, debouncing, cancellation, and
               circuit breaker.

Sprint 6: DX + TESTING + EXAMPLES
  ┌──────────────────────────────────────────────────────────┐
  │ react/debug/           → Debug overlay (Spec + Trace)    │
  │ react/hooks/           → useLiquidDebug, pin mechanism   │
  │ testing/               → generateSpec, testLiquidView    │
  │                          test helpers                    │
  │ examples/              → 3 example applications          │
  │ CI                     → Size-limit checks, test suite   │
  └──────────────────────────────────────────────────────────┘
  Deliverable: Complete Phase 1 with DX tooling, test
               utilities, and example apps.
```

### Dependency graph

```
spec/types ◄──── registry ◄──── generation/prompt-builder
    ▲                ▲                    ▲
    │                │                    │
validation/*    context/ ◄──── generation/orchestrator
    ▲              ▲                ▲    ▲
    │              │                │    │
    │         intent/ ◄─────────────┘    │
    │                                    │
    └──── cache/ ◄───────────────────────┘
              ▲
              │
         policy/ + concurrency/ + cost/
              ▲
              │
         observe/
              ▲
              │
         react/LiquidView ◄── react/FluiProvider
              ▲
              │
         openai/ + anthropic/ (via LLMConnector interface)
```

---

## 4. Module Specifications

### 4.1 UISpecification Schema

**Reference:** Vision §6.4, ADR-008, ADR-017

The canonical data structure generated by the LLM and consumed by the renderer.

```typescript
// packages/core/src/spec/types.ts

export const CURRENT_SPEC_VERSION = '1.0'

export interface UISpecification {
  /** Schema version for forward compatibility. See ADR-017 */
  specVersion: string
  /** Layout structure */
  layout: LayoutSpec
  /** Components to render */
  components: ComponentSpec[]
  /** Declarative bindings between components. See ADR-008 */
  interactions?: InteractionSpec[]
}

export interface LayoutSpec {
  type: 'single' | 'grid' | 'stack' | 'sidebar' | 'tabs' | 'flow'
  columns?: number
  gap?: string
  responsive?: Record<string, LayoutSpec>
}

export interface ComponentSpec {
  /** Unique ID — must be stable across re-generations for ViewState (ADR-001) */
  id: string
  /** Must match a registered component name */
  type: string
  /** Props passed to the component — validated by propValidator (ADR-013) */
  props: Record<string, unknown>
  /** Position in the layout */
  slot: string
  /** Display priority (1 = highest). Used for streaming order (ADR-009) */
  priority: number
  /** Conditional visibility rules (Phase 1: simple conditions only) */
  conditions?: ConditionSpec[]
}

export interface ConditionSpec {
  /** Context signal path to evaluate */
  signal: string
  /** Operator */
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'in' | 'notIn'
  /** Value to compare against */
  value: unknown
}

export interface InteractionSpec {
  id: string
  source: { componentId: string; output: string }
  target: { componentId: string; prop: string }
  transform?: 'identity' | 'toArray' | 'toString' | 'toNumber'
}
```

**Zod runtime schema:**

```typescript
// packages/core/src/spec/version.ts
import { z } from 'zod'

export const UISpecificationSchema = z.object({
  specVersion: z.string(),
  layout: LayoutSpecSchema,
  components: z.array(ComponentSpecSchema).min(1),
  interactions: z.array(InteractionSpecSchema).optional(),
})

// Individual schemas for each sub-type follow the same pattern
```

---

### 4.2 Component Registry

**Reference:** Vision §6.3, ADR-013

```typescript
// packages/core/src/registry/types.ts
import { z, ZodType } from 'zod'

export interface ComponentRegistration<TProps = Record<string, unknown>> {
  /** The actual component (opaque to core — the adapter knows how to render it) */
  component: unknown
  /** Semantic description for LLM prompt */
  description: string
  /** Zod schema for runtime prop validation (preferred) */
  propsSchema?: ZodType<TProps>
  /** Shorthand prop declaration (auto-converted to Zod internally) */
  accepts?: Record<string, PropDeclaration>
  /** When this component is appropriate */
  suitableFor: string[]
  /** Complexity level */
  complexity: 'low' | 'medium' | 'high'
  /** Minimum screen width in pixels (optional) */
  minWidth?: number
  /** Accessibility capabilities */
  a11y?: {
    hasAltText?: boolean
    keyboardNavigable?: boolean
    screenReaderSupport?: 'none' | 'basic' | 'full'
  }
  /** Maximum data classification this component can display */
  maxDataClassification?: 'public' | 'internal' | 'confidential' | 'restricted'
  /** Tags for search/filtering */
  tags?: string[]
  /** Outputs this component can emit for interaction bindings (ADR-008) */
  outputs?: Record<string, { type: string; description: string }>
  /** Dynamic inputs bindable via InteractionSpec (ADR-008) */
  dynamicInputs?: Record<string, { type: string; description: string }>
  /** State preservation protocol (ADR-001) — optional */
  stateContract?: StateContract<TProps>
}

export interface StateContract<TProps = Record<string, unknown>> {
  capture: (state: TProps) => Record<string, unknown>
  restore: (current: TProps, saved: Record<string, unknown>) => Partial<TProps>
  isCompatible: (saved: Record<string, unknown>, newProps: TProps) => boolean
}

export interface PropDeclaration {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum' | 'date-range' | 'timeseries' | 'tabular'
  required?: boolean
  default?: unknown
  values?: string[]  // For enum type
  description?: string
}
```

```typescript
// packages/core/src/registry/registry.ts

export interface ComponentRegistry {
  register(name: string, registration: ComponentRegistration): void
  get(name: string): ComponentRegistration | undefined
  has(name: string): boolean
  list(): Map<string, ComponentRegistration>
  /** Serialize for LLM prompt (ADR-007: filtered) */
  serializeForPrompt(filter?: RegistryFilter): string
}

export interface RegistryFilter {
  permissions?: string[]
  maxScreenWidth?: number
  maxDataClassification?: string
  relevantTags?: string[]
  maxComponents?: number
}

export function createRegistry(
  components: Record<string, ComponentRegistration>
): ComponentRegistry
```

**Implementation notes:**

- `serializeForPrompt()` implements the pre-filtering logic from ADR-007: filter by permissions → device → data classification → relevance scoring → top N.
- `accepts` shorthand is converted to Zod schema internally via `deriveSchema()`.
- The `component` field is typed as `unknown` because `@flui/core` is framework-agnostic — the React adapter casts it to `React.ComponentType`.

---

### 4.3 Intent Parser

**Reference:** Vision §6.1

```typescript
// packages/core/src/intent/types.ts

export interface IntentSource {
  type: 'explicit' | 'implicit' | 'programmatic'
  // 'predictive' deferred to Phase 2
}

export interface ParsedIntent {
  raw: string
  action: string
  entities: Record<string, unknown>
  confidence: number
  source: IntentSource
}

export interface IntentParser {
  parse(input: string | IntentInput): Promise<ParsedIntent>
}

export interface IntentInput {
  /** Explicit intent string from user or developer */
  text?: string
  /** Programmatic intent (structured, no LLM needed) */
  programmatic?: {
    action: string
    entities: Record<string, unknown>
  }
}
```

**Phase 1 scope:**

- **Programmatic intents:** Parsed locally (no LLM call). Developer sets `intent="Invoice list with bulk actions"` — this is parsed into `{ action: 'show', entities: { type: 'invoice-list', features: ['bulk-actions'] } }` using simple rule-based extraction.
- **Explicit intents:** For natural language intents ("Show me Q3 performance by region"), the intent is passed through to the LLM as part of the generation prompt. The LLM handles interpretation. A lightweight local extraction (regex-based) extracts obvious entities (dates, numbers, known terms) to enrich the prompt.
- **Implicit intents:** Deferred to Phase 2 (requires router integration).
- **Predictive intents:** Deferred to Phase 2 (requires usage pattern analysis).

---

### 4.4 Context Engine

**Reference:** Vision §6.2, ADR-004

```typescript
// packages/core/src/context/types.ts

export interface ContextSnapshot {
  identity: IdentityContext
  environment: EnvironmentContext
  workflow?: WorkflowContext
  data?: DataContext
  custom?: Record<string, unknown>
  // expertise and cognitive deferred to Phase 2
}

export interface IdentityContext {
  role: string
  permissions: string[]
  team?: string
  preferences?: Record<string, unknown>
  locale?: string
}

export interface EnvironmentContext {
  device: 'desktop' | 'tablet' | 'mobile'
  screenSize: { width: number; height: number }
  connectivity: 'fast' | 'slow' | 'offline'
  darkMode: boolean
}

export interface WorkflowContext {
  currentPhase?: string
  relatedTasks?: string[]
  recentActions?: string[]
}

export interface DataContext {
  availableDataSets: string[]
  classifications: Record<string, 'public' | 'internal' | 'confidential' | 'restricted'>
}
```

```typescript
// packages/core/src/context/engine.ts

export interface ContextProvider<T = unknown> {
  name: string
  /** Return current signal values */
  getSignals(): T
  /** Subscribe to signal changes */
  onChange?(callback: (signals: T) => void): () => void
  /** Refresh interval in ms (optional polling) */
  refreshInterval?: number
}

export interface ContextEngine {
  /** Get current context snapshot */
  getSnapshot(): ContextSnapshot
  /** Subscribe to context changes */
  onChange(callback: (snapshot: ContextSnapshot, changedSignals: string[]) => void): () => void
  /** Register a custom context provider */
  addProvider(provider: ContextProvider): void
  /** Dispose all providers */
  dispose(): void
}

export function createContextEngine(
  providers: ContextProvider[]
): ContextEngine
```

**Phase 1 providers:**

| Provider | Source | Signals |
|----------|--------|---------|
| `identityFromAuth(authService)` | Developer's auth service | role, permissions, team, preferences, locale |
| `environmentFromBrowser()` | Browser APIs | device (from viewport), screenSize, connectivity (navigator.onLine), darkMode (prefers-color-scheme) |
| `workflowFromRouter(router)` (optional) | Framework router | currentPhase (from route path), recentActions |
| `dataFromResolver(resolver)` (optional) | DataResolver (ADR-002) | availableDataSets, classifications |

The Context Engine is reactive: when a provider's signals change (e.g., window resize changes `device`), the engine emits `onChange` with the new snapshot and the list of changed signal paths.

---

### 4.5 Generation Orchestrator

**Reference:** Vision §6.4, ADR-005, ADR-006, ADR-007

The orchestrator is the central coordination point. It receives a generation request and returns a validated UISpecification, coordinating with the cache, LLM, validation pipeline, and observability.

```typescript
// packages/core/src/generation/types.ts

export interface GenerationRequest {
  intent: ParsedIntent
  context: ContextSnapshot
  registry: ComponentRegistry
  rules?: Rule[]
  dataResolver?: DataResolver
  previousSpec?: UISpecification  // For stable ID re-use (ADR-001)
}

export interface GenerationResult {
  specification: UISpecification
  trace: GenerationTrace
  fromCache: boolean
}
```

```typescript
// packages/core/src/generation/orchestrator.ts

export interface GenerationOrchestrator {
  generate(request: GenerationRequest): Promise<GenerationResult>
  generateStream(request: GenerationRequest): AsyncIterable<GenerationChunk>
}

export function createOrchestrator(config: {
  connector: LLMConnector
  cache: CacheManager
  validationPipeline: ValidationPipeline
  observability: ObservabilityCollector
  costManager: CostManager
  promptBudget?: PromptBudget
  retryConfig?: RetryConfig
}): GenerationOrchestrator
```

**Orchestrator flow (see ADR-003, ADR-005, ADR-006, ADR-007, ADR-011):**

```
generate(request)
  │
  ├── 1. Build cache key (ADR-003)
  ├── 2. Check cache → if HIT, return cached spec
  ├── 3. Check cost budget (ADR-006) → if exceeded, return fallback signal
  ├── 4. Build prompt (ADR-007: pre-filter registry, summarize context)
  ├── 5. Check circuit breaker (ADR-011) → if OPEN, return fallback signal
  ├── 6. Call LLM via connector (with AbortSignal from ADR-005)
  ├── 7. Parse structured output into UISpecification
  ├── 8. Run validation pipeline
  │     ├── PASS → cache spec, return
  │     ├── FAIL + retries remaining → modify prompt with violations, goto 6
  │     └── FAIL + no retries → return fallback signal
  ├── 9. Record trace (observability)
  └── 10. Return GenerationResult
```

**Prompt builder:**

```typescript
// packages/core/src/generation/prompt-builder.ts

export interface PromptBudget {
  maxPromptTokens: number  // Default: 4000
}

export function buildPrompt(request: GenerationRequest, budget: PromptBudget): {
  system: string
  user: string
  metrics: PromptMetrics
}
```

The prompt builder implements:

1. System prompt with Flui generation instructions and output schema.
2. Filtered component registry (ADR-007).
3. Summarized context (only rule-referenced signals).
4. Active rules serialized as constraints.
5. Available data sources (from DataResolver or LiquidView data prop).
6. Previous spec component IDs (for stable re-use across re-generations).
7. User intent as the final instruction.

---

### 4.6 Validation Pipeline

**Reference:** Vision §6.5, ADR-013, ADR-014

```typescript
// packages/core/src/validation/types.ts

export interface Validator {
  name: string
  validate(
    spec: UISpecification,
    context: ContextSnapshot,
    registry: ComponentRegistry,
    previousSpec?: UISpecification
  ): ValidationResult
}

export interface ValidationResult {
  status: 'pass' | 'warn' | 'fail'
  violations: Violation[]
  suggestions: string[]
}

export interface Violation {
  severity: 'warn' | 'fail'
  rule: string
  component?: string  // ComponentSpec.id if component-specific
  message: string
  suggestion?: string
}

export interface ValidationPipeline {
  validate(
    spec: UISpecification,
    context: ContextSnapshot,
    registry: ComponentRegistry,
    previousSpec?: UISpecification
  ): ValidationResult
  addValidator(validator: Validator): void
}
```

**Phase 1 validators (in order):**

| Validator | Checks | Severity |
|-----------|--------|----------|
| `schemaValidator` | Spec matches UISpecificationSchema (Zod). specVersion present and compatible (ADR-017). | fail |
| `componentValidator` | All `ComponentSpec.type` values exist in the registry. | fail |
| `propValidator` | All component props match their Zod schema / `accepts` declaration (ADR-013). | fail |
| `layoutValidator` | Layout type is valid. Column count is reasonable. Mobile device → ≤ 3 components. | fail / warn |
| `a11yValidator` | Interactive components have accessible names. Layout supports keyboard navigation. Major layout change warning (ADR-014). | fail / warn |
| `dataValidator` | Referenced data sources exist. User has sufficient classification clearance. | fail |
| `interactionValidator` | All source/target componentIds exist. Output/input names exist in registrations. Type compatibility. No circular bindings. (ADR-008) | fail |

Developers add custom validators via `pipeline.addValidator()` or the `FluiProvider` `validators` prop.

---

### 4.7 Cache Manager

**Reference:** ADR-003

```typescript
// packages/core/src/cache/types.ts

export interface CacheConfig {
  /** Which context signals affect the cache key. Default: all */
  contextKeySignals?: string[]
  /** TTL in ms. Default: 300_000 (5 minutes) */
  ttl?: number
  /** Max cached specs. Default: 100 */
  maxEntries?: number
  /** Storage levels to enable. Default: ['memory', 'session'] */
  storage?: ('memory' | 'session' | 'indexeddb')[]
}

export interface CacheManager {
  get(key: CacheKey): Promise<CachedSpec | null>
  set(key: CacheKey, spec: UISpecification): Promise<void>
  invalidate(intentPattern?: string): Promise<void>
  clear(): Promise<void>
  stats(): CacheStats
}

export interface CachedSpec {
  spec: UISpecification
  timestamp: number
  expired: boolean
  ttlRemaining: number
  level: 'L1' | 'L2' | 'L3'
}

export interface CacheStats {
  totalEntries: number
  hitRate: number
  missRate: number
  byLevel: Record<string, number>
}
```

**Phase 1 scope:**

- L1 (memory) and L2 (sessionStorage) implemented.
- L3 (IndexedDB) implemented for persistent caching.
- Basic TTL-based expiration.
- Stale-while-revalidate deferred to late Phase 1 or Phase 2 (basic TTL is sufficient to start).

---

### 4.8 Generation Policy

**Reference:** ADR-004

```typescript
// packages/core/src/policy/types.ts

export interface GenerationPolicy {
  triggers: GenerationTrigger[]
  debounce: number       // Default: 5000ms
  maxPerMinute: number   // Default: 6
  stabilityCheck: boolean // Default: true
}

export type GenerationTrigger =
  | { type: 'intent-change' }
  | { type: 'context-change'; signals: string[] }
  | { type: 'manual' }

// 'interval' trigger deferred to Phase 2
// 'context-threshold' trigger deferred to Phase 2
```

The policy is consumed by the React adapter's `LiquidView` to determine when to request re-generation from the orchestrator.

---

### 4.9 Concurrency Controller

**Reference:** ADR-005, ADR-011

```typescript
// packages/core/src/concurrency/controller.ts

export interface ConcurrencyController {
  /** Execute a generation, cancelling any in-flight request */
  execute(
    request: GenerationRequest,
    generator: (signal: AbortSignal) => Promise<GenerationResult>
  ): Promise<GenerationResult>
  /** Cancel current in-flight request */
  cancel(): void
  /** Current state */
  state: 'idle' | 'pending' | 'in-flight'
}

// packages/core/src/concurrency/circuit-breaker.ts

export interface CircuitBreaker {
  /** Check if the circuit allows a request */
  canExecute(): boolean
  /** Record a success */
  recordSuccess(): void
  /** Record a failure */
  recordFailure(): void
  /** Current state */
  state: 'closed' | 'open' | 'half-open'
}

export interface CircuitBreakerConfig {
  failureThreshold: number  // Default: 3
  resetTimeout: number      // Default: 60_000ms
}
```

---

### 4.10 Cost Manager

**Reference:** ADR-006

```typescript
// packages/core/src/policy/cost-manager.ts

export interface CostBudget {
  perGeneration?: number   // Default: 0.05 USD
  perViewSession?: number  // Default: 0.50 USD
  perSession?: number      // Default: 2.00 USD
  onExceeded: 'fallback' | 'cached-only' | 'warn'
  // 'block' deferred to Phase 2 (enterprise)
}

export interface CostManager {
  /** Check if a generation is within budget */
  canGenerate(estimatedCost: number, viewId: string): boolean
  /** Record actual cost after generation */
  recordCost(cost: GenerationCost, viewId: string): void
  /** Get remaining budget */
  remaining(): { perSession: number; perView: Record<string, number> }
}
```

**Phase 1 scope:**

- Cost tracking and budget enforcement implemented.
- Cost estimation is approximate (prompt length / 4 ≈ tokens). Exact token counting deferred to Phase 2 (requires tokenizer per model).

---

### 4.11 Observability Collector

**Reference:** Vision §6.6

```typescript
// packages/core/src/observe/types.ts

export interface GenerationTrace {
  id: string
  timestamp: number
  duration: number

  // Inputs
  intent: ParsedIntent
  contextSnapshot: Record<string, unknown>
  componentsAvailable: string[]

  // LLM
  llmConnector: string
  llmModel: string
  llmLatency: number
  promptTokens: number
  completionTokens: number

  // Cache (ADR-003)
  cacheResult: 'hit' | 'miss' | 'expired'
  cacheLevel?: 'L1' | 'L2' | 'L3'

  // Output
  specification: UISpecification
  componentsSelected: string[]
  layoutChosen: string
  validationResults: ValidationResult[]

  // Resilience (ADR-011)
  retryCount: number
  failures: FailureRecord[]
  circuitBreakerState: 'closed' | 'open' | 'half-open'

  // Cost (ADR-006)
  cost: GenerationCost
  budgetRemaining: { perSession: number }

  // Outcome
  outcome: 'rendered' | 'fallback' | 'cache-hit' | 'error'
  fallbackReason?: string
  renderTime: number
}
```

```typescript
// packages/core/src/observe/collector.ts

export interface ObservabilityCollector {
  /** Record a generation trace */
  record(trace: GenerationTrace): void
  /** Get recent traces (in-memory buffer) */
  getTraces(limit?: number): GenerationTrace[]
  /** Subscribe to new traces */
  onTrace(callback: (trace: GenerationTrace) => void): () => void
  /** Flush traces to external sink */
  flush?(): Promise<void>
}

export interface ObservabilityConfig {
  /** Log traces to console. Default: true in dev */
  console: boolean
  /** In-memory buffer size. Default: 50 */
  bufferSize: number
  /** External trace sink (Phase 2: OpenTelemetry, Datadog) */
  sink?: (trace: GenerationTrace) => void
}
```

---

### 4.12 React Adapter

**Reference:** Vision §7, ADR-001, ADR-008, ADR-009, ADR-014, ADR-019

#### FluiProvider

```tsx
// packages/react/src/FluiProvider.tsx

export interface FluiProviderProps {
  children: React.ReactNode
  /** LLM connector */
  connector: LLMConnector
  /** Component registry */
  components: ComponentRegistry
  /** Context providers */
  context?: ContextProvider[]
  /** Data resolver (ADR-002) */
  dataResolver?: DataResolver
  /** Custom validators */
  validators?: Validator[]
  /** Generation policy defaults (ADR-004) */
  generationPolicy?: Partial<GenerationPolicy>
  /** Cost budget (ADR-006) */
  costBudget?: CostBudget
  /** Cache config (ADR-003) */
  cache?: CacheConfig
  /** Observability config */
  observability?: ObservabilityConfig
  /** Retry config (ADR-011) */
  retry?: RetryConfig
  /** Circuit breaker config (ADR-011) */
  circuitBreaker?: CircuitBreakerConfig
  /** Enable debug overlay globally (ADR-019) */
  debug?: boolean
  /** Callbacks */
  onGenerationFailure?: (failure: FailureRecord) => void
  onCircuitOpen?: (viewId: string, intent: string) => void
}
```

#### LiquidView

```tsx
// packages/react/src/LiquidView.tsx

export interface LiquidViewProps {
  /** User intent (string or structured) */
  intent: string | IntentInput
  /** Mandatory fallback component */
  fallback: React.ReactNode
  /** Direct data passed to generated components (ADR-002 Layer 1) */
  data?: Record<string, unknown>
  /** Additional context signals for this view */
  context?: Record<string, unknown>
  /** Generation policy override (ADR-004) */
  generationPolicy?: Partial<GenerationPolicy>
  /** Transition config (ADR-009) */
  transition?: Partial<TransitionConfig>
  /** External state bindings (ADR-001) */
  stateBindings?: Record<string, StateBinding>
  /** Enable debug overlay for this view (ADR-019) */
  debug?: boolean
  /** View ID (for multi-view coordination and cost tracking) */
  viewId?: string
  /** Custom rules for this view */
  rules?: Rule[]
  /** className for the container */
  className?: string
}

export interface TransitionConfig {
  duration: number          // Default: 200ms
  type: 'crossfade' | 'none' | 'instant'  // 'slide' deferred to Phase 2
  showProgressIndicator: boolean  // Default: true
  loadingDelay: number      // Default: 300ms
  streaming: boolean        // Default: true
}
```

**LiquidView internal flow:**

```
1. Mount → subscribe to context changes via ContextEngine
2. Initial render → show fallback immediately
3. Trigger generation (via orchestrator)
   ├── Cache hit → render spec (skip fallback transition)
   └── Cache miss → LLM generation
       ├── Streaming → progressive component render (ADR-009)
       └── Non-streaming → wait for full spec → crossfade from fallback
4. On context change → check GenerationPolicy (ADR-004)
   ├── Trigger matches → debounce → check stability → regenerate
   └── No trigger match → ignore
5. On re-generation → preserve ViewState (ADR-001) → morph transition
6. On unmount → cancel in-flight generation → dispose subscriptions
```

#### Hooks

```typescript
// packages/react/src/hooks/useLiquidView.ts
export function useLiquidView(viewId: string): {
  /** Current spec (null if fallback) */
  spec: UISpecification | null
  /** Current generation state */
  state: 'idle' | 'generating' | 'rendered' | 'fallback' | 'error'
  /** Latest trace */
  trace: GenerationTrace | null
  /** Manually trigger re-generation */
  regenerate: () => void
  /** Pin mechanism (ADR-019) */
  pin: (spec?: UISpecification) => void
  unpin: () => void
  isPinned: boolean
}

// packages/react/src/hooks/useFluidContext.ts
export function useFluidContext(): ContextSnapshot

// packages/react/src/hooks/useFluidDebug.ts
export function useFluidDebug(viewId: string): {
  traces: GenerationTrace[]
  cacheStats: CacheStats
  costRemaining: { perSession: number }
}
```

---

### 4.13 LLM Connectors

**Reference:** Vision §7.6

```typescript
// packages/core/src/types.ts

export interface LLMConnector {
  name: string
  /** Generate a UI specification from a prompt */
  generate(prompt: { system: string; user: string }, options?: {
    signal?: AbortSignal
    temperature?: number
    maxTokens?: number
  }): Promise<LLMResponse>
  /** Stream generation (optional — fallback to full generate if not supported) */
  generateStream?(prompt: { system: string; user: string }, options?: {
    signal?: AbortSignal
  }): AsyncIterable<string>
  /** Capabilities of this connector */
  supports: {
    streaming: boolean
    structuredOutput: boolean
  }
  /** Pricing info for cost estimation (ADR-006) */
  pricing?: {
    promptTokenCost: number    // USD per 1M tokens
    completionTokenCost: number
  }
}

export interface LLMResponse {
  content: string
  usage: { promptTokens: number; completionTokens: number }
  model: string
}
```

**OpenAI connector:**

```typescript
// packages/openai/src/connector.ts
export function openai(config: {
  apiKey?: string        // Default: process.env.OPENAI_API_KEY
  model?: string         // Default: 'gpt-4o'
  baseURL?: string       // For proxies or compatible APIs
  temperature?: number   // Default: 0.1 (low for deterministic specs)
}): LLMConnector
```

**Anthropic connector:**

```typescript
// packages/anthropic/src/connector.ts
export function anthropic(config: {
  apiKey?: string        // Default: process.env.ANTHROPIC_API_KEY
  model?: string         // Default: 'claude-sonnet-4-20250514'
  baseURL?: string
  temperature?: number   // Default: 0.1
}): LLMConnector
```

Both connectors implement streaming via their respective SDK streaming APIs and forward `AbortSignal` for cancellation (ADR-005).

---

### 4.14 Testing Utilities

**Reference:** ADR-010

```typescript
// packages/testing/src/mock-connector.ts

export interface MockResponse {
  /** Intent pattern to match (regex or string) */
  match: { intent: string | RegExp }
  /** Spec to return */
  spec: UISpecification
}

export interface MockConnectorConfig {
  responses: MockResponse[]
  behavior?: {
    latency?: number        // Simulate LLM latency (ms)
    failAfter?: number      // Fail after N successful calls
    error?: Error           // Always throw this error
  }
}

export function createMockConnector(config: MockConnectorConfig): LLMConnector & {
  /** All generation requests made */
  calls: Array<{ system: string; user: string }>
  /** Reset call history */
  reset(): void
}
```

```typescript
// packages/testing/src/test-helpers.ts

/** Generate a spec without rendering (Tier 2 tests) */
export async function generateSpec(config: {
  intent: string
  context?: Partial<ContextSnapshot>
  components: ComponentRegistry
  connector: LLMConnector
  rules?: Rule[]
}): Promise<{
  specification: UISpecification
  validation: ValidationResult
  trace: GenerationTrace
}>

/** Test a full LiquidView render (Tier 1 tests) */
export function testLiquidView(config: {
  intent: string
  context?: Partial<ContextSnapshot>
  components: ComponentRegistry
  connector: LLMConnector
  fallback: React.ReactNode
}): {
  render: () => RenderResult
  waitForGeneration: () => Promise<void>
  getSpec: () => UISpecification | null
  getTrace: () => GenerationTrace | null
}
```

---

## 5. Explicitly Deferred (NOT Phase 1)

This section exists so an LLM reading this document does NOT attempt to implement these features.

| Feature | Phase | Why Deferred |
|---------|-------|-------------|
| Predictive intent | 2 | Requires usage pattern accumulation |
| Implicit intent (router-based) | 2 | Requires router adapter integration |
| Expertise context provider | 2 | Requires usage data + learning heuristics |
| Cognitive context provider | 2 | Requires interaction speed tracking + error rate heuristics |
| Vue / Angular / Svelte adapters | 2 | One adapter first, others follow same pattern |
| Ollama / Mistral connectors | 2 | Two connectors cover primary use cases |
| AG-UI / A2UI / MCP protocol adapters | 2 | Core must stabilize first |
| Browser DevTools extension | 2 | Inline debug overlay covers Phase 1 |
| Batched multi-view coordination | 2 | Independent mode sufficient for Phase 1 |
| Coordinated multi-view | 2 | Requires page-level awareness |
| SSR / SSG | 2 | CSR first, SSR for Next.js in Phase 2 |
| Stale-while-revalidate cache | Late 1 / 2 | Basic TTL sufficient to start |
| What-If debug mode | 2 | Read-only debug sufficient for Phase 1 |
| Edit Spec debug mode | 2 | Read-only debug sufficient for Phase 1 |
| Property-based tests (Tier 3) | Late 1 | After rules system stabilizes |
| Golden-file tests (Tier 4) | 2 | Requires CI with LLM API access |
| Compliance plugins (GDPR, DORA) | 3 | Enterprise feature |
| Analytics plugin | 3 | Requires production usage data |
| Design system constitution | 3 | Enterprise feature |
| i18n plugin | 3 | After core stabilizes |
| Advanced observability (OTel) | 3 | Console + in-memory sufficient for Phase 1 |
| On-device LLM / offline generation | 4 | Cache + fallback covers Phase 1 offline |
| Voice intent | 4 | Future frontier |
| Spatial computing layouts | 4 | Future frontier |
| `context-threshold` triggers | 2 | Basic `context-change` triggers sufficient |
| `interval` triggers | 2 | Manual + context-change triggers sufficient |
| Slide transition type | 2 | Crossfade + instant sufficient for Phase 1 |
| `block` budget enforcement | 2 | Enterprise feature |
| Custom transform functions in InteractionSpec | 2 | Built-in transforms sufficient for Phase 1 |

**If you are an LLM implementing Flui and encounter any of these features: STOP. Do not implement them. They are explicitly out of scope for Phase 1.**

---

## 6. Performance Budgets

**Reference:** ADR-015

These are enforced in CI via `size-limit` and custom performance tests.

### Latency

| Metric | Target (P50) | Hard Limit (P99) |
|--------|-------------|-------------------|
| Cache hit render | < 5ms | < 50ms |
| Full generation (end-to-end) | < 500ms | < 3000ms |
| Validation pipeline | < 20ms | < 100ms |
| Spec → DOM render | < 10ms | < 80ms |

### Bundle Size (gzipped)

| Package | Target | Hard Limit |
|---------|--------|------------|
| `@flui/core` | < 25KB | < 40KB |
| `@flui/react` | < 8KB | < 15KB |
| `@flui/openai` | < 3KB | < 5KB |
| `@flui/anthropic` | < 3KB | < 5KB |
| `@flui/testing` | < 10KB | < 20KB |
| **Total production** | < 36KB | < 60KB |

### Cost (per generation)

| Scenario | Target |
|----------|--------|
| Simple intent, small registry | < $0.005 |
| Medium intent, medium registry | < $0.01 |
| Complex intent, large registry | < $0.02 |

---

## 7. Acceptance Criteria

Phase 1 is complete when ALL of the following are true:

### Core functionality

- [ ] A developer can `npm install @flui/core @flui/react @flui/openai` and render a working `<LiquidView>` with fallback in under 5 minutes following documentation.
- [ ] The LiquidView generates a valid UISpecification from a natural language intent using OpenAI or Anthropic.
- [ ] The generated spec is validated (schema + components + props + a11y + data classification) before rendering.
- [ ] Invalid specs trigger retry with violations, then fallback if retries exhausted.
- [ ] The fallback renders at t=0 for every LiquidView (no blank screens).
- [ ] Generated specs are cached (L1 + L2 + L3). Same intent + context = instant render on second visit.

### Context awareness

- [ ] The Context Engine collects identity (role, permissions) and environment (device, screen, connectivity, dark mode) signals.
- [ ] Different contexts produce different generated UIs (e.g., executive on mobile gets fewer, simpler components than analyst on desktop).
- [ ] Context changes trigger re-generation according to the configured GenerationPolicy (with debouncing).

### State and interactions

- [ ] ViewState is preserved across re-generations for components that persist (same ID and type).
- [ ] InteractionSpec bindings work: a filter dropdown's selected value flows to a data table's filter prop.
- [ ] Data resolution works: components receive real data via LiquidView `data` prop or DataResolver.

### Resilience

- [ ] Generation cancellation works: a new request cancels the in-flight one (no stale overwrites).
- [ ] Circuit breaker opens after 3 consecutive failures and serves fallback immediately.
- [ ] Cost budget enforcement works: generation degrades to cache-only or fallback when budget exceeded.

### UX

- [ ] Transitions between fallback → generated UI use crossfade (configurable).
- [ ] Re-generation morphs smoothly from old spec to new spec (no flash).
- [ ] Loading indicator appears only after 300ms delay (not for fast operations).
- [ ] `prefers-reduced-motion` disables all transitions.
- [ ] ARIA live region announces UI changes for screen readers.
- [ ] Focus is preserved across re-generations when the focused component persists.

### DX

- [ ] Debug overlay shows current spec (JSON) and latest trace when `debug` prop is active.
- [ ] `useLiquidView` hook provides spec, state, trace, and regenerate function.
- [ ] Pin mechanism locks a LiquidView to a specific spec during development.
- [ ] MockConnector enables deterministic unit testing without LLM calls.
- [ ] `generateSpec` and `testLiquidView` test helpers work for Tier 1 and Tier 2 tests.

### Quality

- [ ] All production packages pass `size-limit` checks (within budget).
- [ ] Test coverage > 80% for `@flui/core`.
- [ ] Zero runtime dependencies in `@flui/core` except Zod.
- [ ] All exports are tree-shakeable (`sideEffects: false`).
- [ ] TypeScript strict mode enabled, no `any` in public APIs.

### Examples

- [ ] **Example 1 (basic-dashboard):** Single LiquidView generating a KPI dashboard. Demonstrates: basic setup, component registration, intent, fallback.
- [ ] **Example 2 (invoice-hybrid):** Mix of static and liquid UI on one page. Demonstrates: progressive adoption, data props, interaction bindings.
- [ ] **Example 3 (multi-view):** Multiple independent LiquidViews on one page. Demonstrates: multi-view, context-driven adaptation (role switching), debug mode.

---

## 8. Example Applications

### Example 1: Basic Dashboard

```tsx
// examples/basic-dashboard/src/App.tsx
import { FluiProvider, LiquidView } from '@flui/react'
import { openai } from '@flui/openai'
import { createRegistry } from '@flui/core'
import { KPICard, SalesChart, DataTable } from './components'

const registry = createRegistry({
  KPICard: {
    component: KPICard,
    description: 'Displays a single KPI with trend indicator',
    accepts: {
      metric: { type: 'string', required: true },
      value: { type: 'number', required: true },
      trend: { type: 'enum', values: ['up', 'down', 'flat'] },
    },
    suitableFor: ['overview', 'executive-review'],
    complexity: 'low',
    tags: ['kpi', 'metric', 'summary'],
  },
  SalesChart: {
    component: SalesChart,
    description: 'Interactive sales chart with period selection',
    accepts: {
      data: { type: 'timeseries', required: true },
      period: { type: 'enum', values: ['week', 'month', 'quarter'], required: true },
    },
    suitableFor: ['analysis', 'reporting'],
    complexity: 'medium',
    tags: ['chart', 'visualization', 'sales'],
  },
  DataTable: {
    component: DataTable,
    description: 'Sortable, filterable data table',
    accepts: {
      data: { type: 'tabular', required: true },
      columns: { type: 'array', required: true },
    },
    suitableFor: ['detailed-analysis', 'data-exploration'],
    complexity: 'high',
    tags: ['table', 'data', 'detail'],
  },
})

const connector = openai({ model: 'gpt-4o' })

function App() {
  return (
    <FluiProvider connector={connector} components={registry}>
      <h1>Sales Dashboard</h1>
      <LiquidView
        intent="Show me today's key sales metrics"
        fallback={<div>Loading dashboard...</div>}
        data={{
          revenue: 142_500,
          deals: 23,
          pipeline: 890_000,
          salesData: mockTimeseries,
        }}
        debug
      />
    </FluiProvider>
  )
}
```

### Example 2: Hybrid Invoice Page

Demonstrates mixing static and liquid UI, with data props and interaction bindings.

```tsx
function InvoicePage() {
  const [searchTerm, setSearchTerm] = useState('')
  const invoices = useInvoices(searchTerm)

  return (
    <div>
      {/* Static — coded as usual */}
      <Header title="Invoices" />
      <SearchBar value={searchTerm} onChange={setSearchTerm} />

      {/* Liquid — adapts to context */}
      <LiquidView
        intent="Show filtered invoices with relevant actions"
        data={{ invoices: invoices.data, overdueCount: invoices.overdue }}
        fallback={<InvoiceTable data={invoices.data} />}
      />

      {/* Static */}
      <Pagination total={invoices.total} />
    </div>
  )
}
```

### Example 3: Multi-view with Role Switching

Demonstrates multiple LiquidViews and context-driven adaptation.

```tsx
function MultiViewDemo() {
  const [role, setRole] = useState<'executive' | 'analyst' | 'manager'>('executive')

  return (
    <FluiProvider
      connector={connector}
      components={registry}
      context={[
        identityFromAuth({ role, permissions: permissionsForRole(role) }),
        environmentFromBrowser(),
      ]}
      debug
    >
      {/* Role switcher for demo */}
      <RoleSwitcher value={role} onChange={setRole} />

      <div className="layout">
        <LiquidView
          viewId="nav"
          intent="Show navigation for current user role"
          fallback={<StaticNav />}
        />
        <LiquidView
          viewId="main"
          intent="Show main dashboard content"
          fallback={<StaticDashboard />}
        />
        <LiquidView
          viewId="sidebar"
          intent="Show contextual actions"
          fallback={<StaticSidebar />}
        />
      </div>
    </FluiProvider>
  )
}
```

---

## 9. Phase 1 Deliverables Checklist

| # | Deliverable | Status |
|---|-------------|--------|
| 1 | Monorepo setup (pnpm, tsup, Vitest, Biome, size-limit) | [ ] |
| 2 | `@flui/core` — UISpecification schema + Zod runtime validation | [ ] |
| 3 | `@flui/core` — Component Registry with `serializeForPrompt` | [ ] |
| 4 | `@flui/core` — Intent Parser (programmatic + explicit) | [ ] |
| 5 | `@flui/core` — Context Engine + identity + environment providers | [ ] |
| 6 | `@flui/core` — Generation Orchestrator + prompt builder | [ ] |
| 7 | `@flui/core` — Validation Pipeline (schema, component, prop, layout, a11y, data, interaction) | [ ] |
| 8 | `@flui/core` — Cache Manager (L1 + L2 + L3) | [ ] |
| 9 | `@flui/core` — Generation Policy (triggers, debounce, stability check) | [ ] |
| 10 | `@flui/core` — Concurrency Controller + Circuit Breaker | [ ] |
| 11 | `@flui/core` — Cost Manager (tracking + budgets) | [ ] |
| 12 | `@flui/core` — Observability Collector (console + in-memory) | [ ] |
| 13 | `@flui/core` — Data Resolver (props + resolver pattern) | [ ] |
| 14 | `@flui/react` — FluiProvider | [ ] |
| 15 | `@flui/react` — LiquidView with full lifecycle | [ ] |
| 16 | `@flui/react` — ViewState management | [ ] |
| 17 | `@flui/react` — InteractionSpec wiring | [ ] |
| 18 | `@flui/react` — Transition system (crossfade + instant) | [ ] |
| 19 | `@flui/react` — A11y lifecycle (focus, ARIA, reduced motion) | [ ] |
| 20 | `@flui/react` — Debug overlay (Spec + Trace tabs) | [ ] |
| 21 | `@flui/react` — useLiquidView + useFluidContext + useFluidDebug hooks | [ ] |
| 22 | `@flui/openai` — Connector with streaming + AbortSignal | [ ] |
| 23 | `@flui/anthropic` — Connector with streaming + AbortSignal | [ ] |
| 24 | `@flui/testing` — MockConnector | [ ] |
| 25 | `@flui/testing` — generateSpec + testLiquidView helpers | [ ] |
| 26 | Example 1: Basic Dashboard | [ ] |
| 27 | Example 2: Hybrid Invoice Page | [ ] |
| 28 | Example 3: Multi-view with Role Switching | [ ] |
| 29 | CI: size-limit checks passing | [ ] |
| 30 | CI: test suite passing (> 80% coverage on core) | [ ] |

---

*This document, together with `flui-framework-vision.md` and `flui-architecture-decisions.md`, forms the complete reference for Flui Phase 1 development.*
