# Flui — Architecture Decision Records

> This document captures key architectural decisions for the Flui framework.
> It complements `flui-framework-vision.md` (the strategic vision) with concrete "how" decisions
> required for implementation.
>
> **Format:** Each ADR follows: Context → Options → Decision → Consequences → Status
>
> **Audience:** Fabrice (architect/developer) + LLMs used for AI-assisted development.
> Every decision must be unambiguous enough for an LLM to make correct implementation choices.

---

## Table of Contents

### Batch 1 — Critical (Must resolve before Phase 1)

- [ADR-001: State Management Inside Generated UIs](#adr-001-state-management-inside-generated-uis)
- [ADR-002: Data Resolution and Binding](#adr-002-data-resolution-and-binding)
- [ADR-003: Caching as a Core Module](#adr-003-caching-as-a-core-module)
- [ADR-004: Re-generation Strategy and Triggers](#adr-004-re-generation-strategy-and-triggers)
- [ADR-005: Concurrency and Generation Request Lifecycle](#adr-005-concurrency-and-generation-request-lifecycle)
- [ADR-006: Cost Control and Budgeting](#adr-006-cost-control-and-budgeting)
- [ADR-007: Prompt Size Management](#adr-007-prompt-size-management)

### Batch 2 — High Importance (Resolve before/during Phase 1)

- [ADR-008: Inter-component Communication](#adr-008-inter-component-communication)
- [ADR-009: Generation Latency UX](#adr-009-generation-latency-ux)
- [ADR-010: Testing Strategy for Non-deterministic Output](#adr-010-testing-strategy-for-non-deterministic-output)
- [ADR-011: Error Recovery and Circuit Breaker](#adr-011-error-recovery-and-circuit-breaker)
- [ADR-012: Multi-LiquidView Coordination](#adr-012-multi-liquidview-coordination)
- [ADR-013: Runtime Type Safety](#adr-013-runtime-type-safety)
- [ADR-014: Accessibility During Dynamic Re-generation](#adr-014-accessibility-during-dynamic-re-generation)

### Batch 3 — Important (Document now, resolve during Phase 1-2)

- [ADR-015: Performance Budgets](#adr-015-performance-budgets)
- [ADR-016: Server-Side Generation Architecture](#adr-016-server-side-generation-architecture)
- [ADR-017: Spec Versioning and Migration](#adr-017-spec-versioning-and-migration)
- [ADR-018: Bundle Size Strategy](#adr-018-bundle-size-strategy)
- [ADR-019: Developer Debug Mode](#adr-019-developer-debug-mode)
- [ADR-020: Offline Strategy for Phase 1](#adr-020-offline-strategy-for-phase-1)

---

## ADR-001: State Management Inside Generated UIs

**Status:** Decided

### Context

A `LiquidView` generates a UI specification, renders it, and the user interacts with the rendered components (sorting tables, filtering charts, filling forms, scrolling, expanding panels). When context changes or the user issues a new intent, the LiquidView may re-generate a new specification.

The vision document describes the generation pipeline (`intent + context → generate → validate → render`) but does not address what happens to **user interaction state** between generations. Without a clear state management strategy:

- A re-generation could destroy the user's scroll position, form input, sort order, and filter state.
- The user experience would feel "janky" — the UI resets unpredictably.
- Developers would have no reliable way to preserve interaction continuity.

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A — Reset on every re-generation** | Each new spec starts with clean state | Simple to implement | Terrible UX — user loses all interaction state |
| **B — ViewState store in LiquidView** | LiquidView maintains a `ViewState` keyed by component ID; state is preserved for components that survive re-generation | Good UX, framework-controlled | Adds complexity to the rendering adapter |
| **C — Delegate entirely to parent app** | Parent app manages all state, passes it down as props | Familiar React/Vue pattern | Defeats the purpose of liquid UI — developer must manage state for dynamically generated components |
| **D — Hybrid: ViewState + developer override** | LiquidView manages ViewState by default, but developer can provide external state bindings for specific components | Best UX, flexible | Most complex to implement |

### Decision

**Option D — Hybrid ViewState with developer override.**

The LiquidView maintains an internal `ViewState` store that:

1. **Captures** interaction state from rendered components (sort order, filter values, scroll position, expanded/collapsed state, form input).
2. **Keys state by component ID** from the generated spec (the `id` field in `ComponentSpec`).
3. **Preserves state** for components that appear in both the old and new spec (same `id` and `type`).
4. **Drops state** for components removed in the new spec.
5. **Initializes fresh state** for components new in the new spec.
6. **Allows developer override** via an optional `stateBindings` prop on `LiquidView` for cases where external state management is needed.

```typescript
interface ViewState {
  /** State keyed by ComponentSpec.id */
  components: Record<string, ComponentViewState>
  /** Scroll position of the LiquidView container */
  scrollPosition: { x: number; y: number }
  /** Timestamp of last user interaction (for staleness detection) */
  lastInteraction: number
}

interface ComponentViewState {
  /** Component type (for validation on restore) */
  type: string
  /** Arbitrary interaction state captured from the component */
  state: Record<string, unknown>
  /** Whether the user has actively modified this component's state */
  dirty: boolean
}

// Developer override example
<LiquidView
  intent="Show filtered invoices"
  fallback={<InvoiceTable />}
  stateBindings={{
    'invoice-filter': {
      get: () => externalFilterState,
      set: (state) => setExternalFilterState(state)
    }
  }}
/>
```

**Component contract for state preservation:**

Registered components that want to participate in state preservation must implement an optional protocol:

```typescript
registerComponent('DataTable', {
  component: DataTableComponent,
  // ... existing registration fields ...

  // State preservation protocol (optional)
  stateContract: {
    /** Extract current interaction state from the component */
    capture: (instance) => ({
      sortColumn: instance.sortColumn,
      sortDirection: instance.sortDirection,
      filters: instance.activeFilters,
      scrollTop: instance.scrollTop,
      selectedRows: instance.selectedRowIds,
    }),
    /** Restore previously captured state into the component */
    restore: (instance, state) => {
      instance.setSortColumn(state.sortColumn)
      instance.setSortDirection(state.sortDirection)
      instance.setFilters(state.filters)
      instance.scrollTo(state.scrollTop)
      instance.setSelectedRows(state.selectedRows)
    },
    /** Validate that captured state is compatible with new props */
    isCompatible: (state, newProps) => {
      // e.g., if columns changed, sort state may be invalid
      return newProps.columns?.includes(state.sortColumn) ?? false
    }
  }
})
```

Components without a `stateContract` simply re-mount with fresh state on re-generation.

### Consequences

- **Positive:** Users experience smooth transitions between generations. Interaction state is preserved naturally. Developers get sensible defaults with escape hatches.
- **Positive:** The `stateContract` pattern gives component authors explicit control over what state is meaningful to preserve.
- **Negative:** Rendering adapters (`@flui/react`, `@flui/vue`) must implement ViewState management. This adds ~200-300 lines to each adapter.
- **Negative:** The LLM generating specs must produce stable `id` values for components that should preserve state across re-generations. The Generation Orchestrator should instruct the LLM to reuse IDs from the previous spec when the same logical component persists.
- **Risk:** State compatibility validation (`isCompatible`) adds runtime overhead. Mitigated by making it optional and keeping checks lightweight.

---

## ADR-002: Data Resolution and Binding

**Status:** Decided

### Context

The vision document shows generated specs like:

```json
{
  "type": "SalesChart",
  "props": { "data": "team-sales", "period": "month" }
}
```

But `"team-sales"` is just a string identifier. Nothing in the architecture resolves it to actual data. The questions are:

- How does the LLM know what data identifiers are valid?
- How does the runtime resolve `"team-sales"` to actual data?
- Who fetches the data? When?
- What if the data isn't available yet (loading state)?

Without data binding, generated specs are inert — they describe a UI that cannot actually display anything.

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A — Data passed as props to LiquidView** | Developer passes all data as a `data` prop; LLM references keys from that object | Simple, explicit, no magic | Doesn't scale — developer must pre-fetch all possible data before generation |
| **B — DataResolver service** | A registry of data sources; runtime resolves identifiers to data fetching logic | Scalable, decoupled | Another abstraction layer; LLM needs to know available data sources |
| **C — Hybrid: props + DataResolver** | Simple data via props, complex/dynamic data via DataResolver | Best of both, progressive complexity | Two mechanisms to learn |

### Decision

**Option C — Hybrid: props for simple cases, DataResolver for dynamic cases.**

#### Layer 1 — Direct data via props (simple case)

```tsx
<LiquidView
  intent="Show filtered invoices"
  data={{
    invoices: filteredInvoices,       // Already fetched by parent
    overdueCount: overdue.length,     // Simple computed value
  }}
  fallback={<InvoiceTable data={filteredInvoices} />}
/>
```

The LLM receives available data keys (`invoices`, `overdueCount`) in the prompt and references them directly in generated props. The rendering adapter passes them through.

#### Layer 2 — DataResolver for dynamic/async data

```typescript
import { defineDataResolver } from '@flui/core'

const dataResolver = defineDataResolver({
  sources: {
    'team-sales': {
      description: 'Monthly sales data grouped by team',
      schema: { type: 'timeseries', dimensions: ['team', 'month', 'revenue'] },
      classification: 'internal',
      fetch: async (params) => {
        const { period, groupBy } = params
        return api.getSalesData({ period, groupBy })
      },
      /** Cache fetched data for this duration (ms) */
      cacheTTL: 60_000,
    },
    'user-kpis': {
      description: 'Key performance indicators for current user',
      schema: { type: 'record', fields: ['revenue', 'deals', 'pipeline', 'conversion'] },
      classification: 'confidential',
      fetch: async (params) => api.getUserKPIs(params.userId),
      cacheTTL: 30_000,
    }
  }
})

// Registered at provider level
<FluiProvider
  connector={connector}
  components={registry}
  dataResolver={dataResolver}
>
```

#### How the LLM knows what data is available

The Generation Orchestrator includes available data in the prompt:

```
AVAILABLE DATA:
- From props: { invoices: tabular[...], overdueCount: number }
- From resolver:
  - "team-sales": Monthly sales data grouped by team (timeseries, classification: internal)
  - "user-kpis": Key performance indicators for current user (record, classification: confidential)
```

The LLM generates specs referencing these identifiers. The propValidator verifies that all referenced data sources exist.

#### Runtime resolution flow

```
Generated spec: { "type": "SalesChart", "props": { "data": "team-sales", "period": "Q3" } }
        │
        ▼
Rendering Adapter receives spec
        │
        ▼
Is "team-sales" in LiquidView data props?
  YES → pass directly
  NO  → Look up in DataResolver
          │
          ▼
        DataResolver.fetch("team-sales", { period: "Q3" })
          │
          ▼
        Show component loading state while fetching
          │
          ▼
        Data arrives → render component with real data
```

### Consequences

- **Positive:** Simple cases stay simple (just pass data as props). Complex cases are cleanly handled by the DataResolver.
- **Positive:** Data classifications declared in the DataResolver feed into the Validation Pipeline's data validator — preventing unauthorized data exposure.
- **Positive:** DataResolver caching avoids redundant API calls when multiple components reference the same data source.
- **Negative:** Two data mechanisms (props vs resolver) — documentation must make clear when to use each.
- **Negative:** Async data resolution means components may show loading states initially. The rendering adapter must support per-component loading states.
- **Implementation note:** The DataResolver should be optional. A LiquidView with only direct data props works without any DataResolver configuration.

---

## ADR-003: Caching as a Core Module

**Status:** Decided

### Context

The vision document lists `@flui/cache` as a Phase 3 plugin ("Intelligent caching of generation results"). However, without caching:

- Every `LiquidView` render triggers an LLM API call.
- LLM calls cost $0.001–0.05 per call and take 200–2000ms.
- A page with 3 LiquidViews = 3 LLM calls = 600–6000ms latency + 3x cost on every page load.
- Users navigating back to a page they already visited trigger fresh generation unnecessarily.

Caching is not an optimization — it's a **core requirement for acceptable UX and cost control**.

### Decision

**Caching moves to `@flui/core/cache` — it ships with the core framework, not as a plugin.**

#### Cache key strategy

```typescript
type CacheKey = {
  /** Hash of the normalized intent string */
  intentHash: string
  /** Hash of the context signals that actually affect generation */
  contextHash: string
  /** Hash of the component registry version (invalidates on registry change) */
  registryVersion: string
  /** Spec schema version */
  specVersion: string
}
```

**Critical detail — context hash selectivity:** Not ALL context signals should be part of the cache key. The `cognitiveLoad` signal might fluctuate every minute, but a shift from `"medium"` to `"high"` only reduces `maxComponents` from 5 to 2. The cache should only include context signals that the rules actually use for generation decisions.

```typescript
interface CacheConfig {
  /** Which context signals affect the cache key (default: all) */
  contextKeySignals?: string[]
  /** Time-to-live in milliseconds (default: 300_000 = 5 minutes) */
  ttl?: number
  /** Maximum number of cached specs (default: 100) */
  maxEntries?: number
  /** Cache storage backend */
  storage?: 'memory' | 'sessionStorage' | 'indexedDB' | CacheStorage
  /** Whether to serve stale cache while revalidating (default: true) */
  staleWhileRevalidate?: boolean
}
```

#### Cache levels

| Level | Storage | Lifetime | Use Case |
|-------|---------|----------|----------|
| **L1 — Memory** | In-memory Map | Current session / tab | Instant re-renders, back-navigation |
| **L2 — Session** | sessionStorage | Browser tab lifetime | Survives soft navigation, SPAs |
| **L3 — Persistent** | IndexedDB | Configurable TTL (hours/days) | Returning users, common intents |

Lookup order: L1 → L2 → L3 → generate.

#### Stale-while-revalidate

When a cached spec is found but approaching expiry, the cache serves the stale spec immediately (instant render) and triggers a background re-generation. If the new spec differs from the cached one, the UI transitions smoothly (using the ViewState preservation from ADR-001).

```
Request for (intent, context)
        │
        ▼
L1 hit? ──YES──▶ Return cached spec (instant)
  │ NO              │
  ▼                 ├── If near expiry: trigger background re-generation
L2 hit? ──YES──▶ Return cached spec + promote to L1
  │ NO
  ▼
L3 hit? ──YES──▶ Return cached spec + promote to L1 + L2
  │ NO
  ▼
Generate (LLM call) → Validate → Store in L1 + L2 + L3 → Return spec
```

#### Cache invalidation

Cache entries are invalidated when:

- TTL expires.
- Component registry changes (registryVersion in cache key).
- Developer explicitly calls `flui.cache.invalidate(intent?)`.
- Context changes produce a different cache key (natural invalidation).
- Spec schema version changes (specVersion in cache key).

#### Integration with Generation Orchestrator

```typescript
// Inside GenerationOrchestrator.generate()
async function generate(request: GenerationRequest): Promise<UISpecification> {
  const cacheKey = buildCacheKey(request)

  // Check cache
  const cached = await cache.get(cacheKey)
  if (cached && !cached.expired) {
    trace.outcome = 'cache-hit'
    if (cached.nearExpiry) {
      backgroundRegenerate(request, cacheKey) // stale-while-revalidate
    }
    return cached.spec
  }

  // Cache miss — generate
  const spec = await llmConnector.generate(buildPrompt(request))
  const validated = await validationPipeline.validate(spec, request.context)

  if (validated.status === 'pass') {
    await cache.set(cacheKey, validated.spec)
  }

  return validated.spec
}
```

#### Observability integration

The `GenerationTrace` is extended with:

```typescript
interface GenerationTrace {
  // ... existing fields ...
  cacheResult: 'hit' | 'miss' | 'stale-revalidate' | 'expired'
  cacheLevel?: 'L1' | 'L2' | 'L3'
  cacheTTLRemaining?: number
}
```

### Consequences

- **Positive:** Dramatic UX improvement — returning to a page is instant. Common intents are served from cache.
- **Positive:** Cost reduction — cache hits don't incur LLM costs. In typical usage, 60-80% of renders will be cache hits.
- **Positive:** Stale-while-revalidate provides both instant UX and eventual freshness.
- **Negative:** Cache adds ~500 lines to `@flui/core`. Bundle size impact is minimal (no heavy dependencies).
- **Negative:** Cache invalidation is a known hard problem. The TTL + explicit invalidation approach is pragmatic but not perfect.
- **Trade-off:** `contextKeySignals` configuration requires the developer to think about which context signals matter for caching. Default is "all signals" (safe but cache-unfriendly). Documentation must guide this.

---

## ADR-004: Re-generation Strategy and Triggers

**Status:** Decided

### Context

The Context Engine is reactive — signals change in real-time (device rotation, cognitive load inference, workflow phase changes). The vision document does not specify WHEN a LiquidView should re-generate in response to context changes.

Without a clear policy:

- Every context signal change could trigger a re-generation → chaotic, flickering UI.
- No re-generation on context change → the UI doesn't adapt (defeating the purpose of Flui).
- Developers have no control over the trade-off between adaptiveness and stability.

### Decision

**Introduce a `GenerationPolicy` that controls when and how re-generation occurs.**

```typescript
interface GenerationPolicy {
  /** What triggers re-generation */
  triggers: GenerationTrigger[]
  /** Minimum time between re-generations (ms). Default: 5000 */
  debounce: number
  /** Maximum re-generations per minute. Default: 6 */
  maxPerMinute: number
  /** Whether to check if new context would produce a different cache key before regenerating */
  stabilityCheck: boolean
}

type GenerationTrigger =
  | { type: 'intent-change' }                              // User explicitly changes intent
  | { type: 'context-change'; signals: string[] }          // Specific context signals changed
  | { type: 'context-threshold'; signal: string; delta: number }  // Signal changed by more than delta
  | { type: 'manual' }                                     // Developer calls flui.regenerate()
  | { type: 'interval'; ms: number }                       // Periodic refresh (e.g., real-time dashboards)
```

#### Default policy

```typescript
const defaultPolicy: GenerationPolicy = {
  triggers: [
    { type: 'intent-change' },                    // Always re-generate on intent change
    { type: 'context-change', signals: [
      'identity.role',                              // Role change (e.g., user switches account)
      'environment.device',                         // Device change (e.g., tablet rotation)
      'workflow.currentPhase',                      // Workflow phase change
    ]},
    { type: 'context-threshold', signal: 'expertise.level', delta: 1 },  // Expertise level change
  ],
  debounce: 5000,
  maxPerMinute: 6,
  stabilityCheck: true,
}
```

#### Stability check

Before triggering a re-generation, the policy checks whether the new context would produce a different cache key (see ADR-003). If the cache key is identical, the re-generation is skipped entirely — the same spec would be produced.

```
Context signal changes
        │
        ▼
Does change match a trigger? ──NO──▶ Ignore
        │ YES
        ▼
Debounce period elapsed? ──NO──▶ Queue (coalesce with pending)
        │ YES
        ▼
Rate limit OK? ──NO──▶ Drop (log warning)
        │ YES
        ▼
Stability check: would cache key change? ──NO──▶ Skip (same spec would be produced)
        │ YES
        ▼
Trigger re-generation (through cache → orchestrator pipeline)
```

#### Developer API

```tsx
// Custom policy per LiquidView
<LiquidView
  intent="Show team dashboard"
  fallback={<StaticDashboard />}
  generationPolicy={{
    triggers: [
      { type: 'intent-change' },
      { type: 'interval', ms: 60_000 },  // Refresh every minute (real-time dashboard)
    ],
    debounce: 3000,
    stabilityCheck: true,
  }}
/>

// Manual trigger
const { regenerate } = useLiquidView('dashboard-view')
<button onClick={() => regenerate()}>Refresh Layout</button>
```

### Consequences

- **Positive:** Developers have explicit control over the adaptiveness/stability trade-off.
- **Positive:** The stability check prevents unnecessary LLM calls when context changes don't affect the output.
- **Positive:** Debouncing and rate limiting prevent UI chaos from rapidly changing signals.
- **Negative:** The default policy must be well-chosen — too aggressive = flickering, too conservative = stale UI. The proposed defaults favor stability (5s debounce, 6/min max).
- **Interaction with ADR-001:** Re-generation preserves ViewState for surviving components, so even when re-generation occurs, the UX disruption is minimized.
- **Interaction with ADR-003:** Stability check leverages the cache key computation from the caching layer.

---

## ADR-005: Concurrency and Generation Request Lifecycle

**Status:** Decided

### Context

Multiple events can trigger generation requests concurrently:

- User changes intent while a previous generation is in-flight.
- Context changes trigger re-generation while a previous one hasn't completed.
- Multiple LiquidViews on the same page generate simultaneously.

Without concurrency management, stale generation results could overwrite fresh ones, or multiple in-flight requests could waste LLM resources.

### Decision

**Each LiquidView manages a generation request lifecycle with cancellation and latest-wins semantics.**

#### Request state machine

```
                 ┌─────────┐
                 │  idle    │
                 └────┬─────┘
                      │ trigger
                      ▼
                 ┌──────────┐
          ┌──────│ pending  │ (debounce period)
          │      └────┬─────┘
          │           │ debounce elapsed
  new     │           ▼
  trigger │      ┌──────────┐
  (cancel)│      │ in-flight│──── LLM call active
          │      └────┬─────┘
          │           │
          │     ┌─────┼──────────┐
          │     │     │          │
          │     ▼     ▼          ▼
          │  ┌─────┐ ┌────┐ ┌──────────┐
          └──│cancel│ │done│ │  error   │
             └─────┘ └──┬─┘ └────┬─────┘
                        │        │
                        ▼        ▼
                   ┌────────┐ ┌──────────┐
                   │validate│ │ fallback  │
                   └────┬───┘ └──────────┘
                        │
                        ▼
                   ┌─────────┐
                   │ render  │
                   └─────────┘
```

#### Cancellation pattern

```typescript
class GenerationController {
  private currentAbort: AbortController | null = null

  async generate(request: GenerationRequest): Promise<UISpecification> {
    // Cancel any in-flight request
    if (this.currentAbort) {
      this.currentAbort.abort()
      this.trace('cancelled', 'Superseded by new request')
    }

    this.currentAbort = new AbortController()
    const { signal } = this.currentAbort

    try {
      const spec = await this.orchestrator.generate(request, { signal })
      // Check if we were cancelled during generation
      if (signal.aborted) return this.currentSpec // Keep current UI
      return spec
    } catch (err) {
      if (err.name === 'AbortError') return this.currentSpec
      throw err
    } finally {
      this.currentAbort = null
    }
  }
}
```

#### Multi-LiquidView independence

Each LiquidView has its own `GenerationController`. They do not interfere with each other. The FluiProvider manages a shared connection pool to the LLM connector for efficiency, but each view controls its own lifecycle.

#### LLM connector cancellation support

```typescript
interface LLMConnector {
  generate(spec: GenerationRequest, options?: { signal?: AbortSignal }): AsyncIterable<GenerationChunk>
  // ...
}
```

Connectors SHOULD forward the AbortSignal to the underlying HTTP request to stop the LLM from continuing to generate tokens after cancellation. If the connector doesn't support cancellation, the generation completes but the result is discarded.

### Consequences

- **Positive:** Latest-wins ensures the user always sees the UI matching their most recent intent/context.
- **Positive:** AbortController is a web standard — clean, well-understood pattern.
- **Positive:** Cancelled LLM calls (if supported by connector) save cost and free resources.
- **Negative:** Some LLM providers don't support mid-stream cancellation. In those cases, the generation completes but the result is discarded (wasted tokens but correct behavior).
- **Interaction with ADR-003:** A cancelled generation that completed before abort is received CAN still be cached — the spec is valid, just not needed right now.

---

## ADR-006: Cost Control and Budgeting

**Status:** Decided

### Context

Every LLM generation call has a monetary cost (tokens consumed). In production, uncontrolled generation can create unexpected expenses. For adoption, developers need transparency and control over costs.

The vision document has no mention of cost management.

### Decision

**The Generation Orchestrator includes a cost-awareness layer with configurable budgets and graceful degradation.**

#### Cost tracking

```typescript
interface GenerationCost {
  promptTokens: number
  completionTokens: number
  estimatedCostUSD: number
  model: string
  provider: string
}

// Accumulated in session
interface CostAccumulator {
  sessionTotal: GenerationCost
  perViewTotals: Record<string, GenerationCost>
  budget: CostBudget
}
```

#### Budget configuration

```typescript
interface CostBudget {
  /** Max cost per single generation (USD). Default: 0.05 */
  perGeneration?: number
  /** Max cost per LiquidView per session (USD). Default: 0.50 */
  perViewSession?: number
  /** Max cost per user session (USD). Default: 2.00 */
  perSession?: number
  /** What to do when budget exceeded */
  onExceeded: 'fallback' | 'cached-only' | 'warn' | 'block'
}
```

#### Degradation strategy when budget exceeded

| `onExceeded` | Behavior |
|--------------|----------|
| `'fallback'` | Render the fallback component. No more LLM calls for this view/session. |
| `'cached-only'` | Serve only cached specs. No new LLM calls. If no cache hit → fallback. |
| `'warn'` | Log a warning, continue generating (soft limit for monitoring). |
| `'block'` | Throw an error (for hard cost controls in enterprise environments). |

#### Pre-generation cost estimation

Before calling the LLM, the orchestrator estimates the cost based on prompt size:

```typescript
function estimateCost(prompt: string, model: string): number {
  const estimatedPromptTokens = Math.ceil(prompt.length / 4) // rough approximation
  const estimatedCompletionTokens = 500 // typical spec size
  return calculateCost(model, estimatedPromptTokens, estimatedCompletionTokens)
}
```

If the estimated cost exceeds `perGeneration` budget, the orchestrator skips the LLM call and uses cache or fallback.

#### Developer API

```tsx
<FluiProvider
  connector={connector}
  components={registry}
  costBudget={{
    perGeneration: 0.03,
    perSession: 1.00,
    onExceeded: 'cached-only',
  }}
>
```

#### Observability integration

Cost data is included in every `GenerationTrace`:

```typescript
interface GenerationTrace {
  // ... existing fields ...
  cost: GenerationCost
  budgetRemaining: {
    perViewSession: number
    perSession: number
  }
  budgetAction?: 'none' | 'warned' | 'degraded-to-cache' | 'degraded-to-fallback' | 'blocked'
}
```

### Consequences

- **Positive:** Developers can deploy Flui with confidence that costs are bounded.
- **Positive:** Enterprise environments get hard cost controls.
- **Positive:** Cost data in traces enables optimization (identify expensive intents, tune prompts).
- **Negative:** Cost estimation is approximate (token counting varies by model/tokenizer). Actual costs may differ slightly from estimates.
- **Negative:** Pre-generation cost estimation requires knowing the pricing model per LLM provider. Connectors must expose a `pricing` interface.
- **Trade-off:** Tight budgets = more fallbacks. Developers must balance cost control with UX quality.
- **Interaction with ADR-003:** Caching is the primary cost reduction mechanism. High cache hit rate = low cost.

---

## ADR-007: Prompt Size Management

**Status:** Decided

### Context

The Generation Orchestrator builds a prompt that includes:

- System instructions (fixed overhead)
- Serialized component registry (grows with number of registered components)
- Serialized context signals (grows with number of providers)
- Active rules (grows with rule set)
- Available data sources (grows with DataResolver configuration)
- User intent
- Output schema
- Previous spec (for stable ID re-use, see ADR-001)

With a large component registry (50-200 components), extensive rules, and rich context, the prompt can exceed the LLM's context window or degrade response quality due to "lost in the middle" effects.

### Decision

**The Generation Orchestrator implements a prompt budget strategy with intelligent pre-filtering.**

#### Prompt budget

```typescript
interface PromptBudget {
  /** Maximum prompt tokens. Default: 4000 */
  maxPromptTokens: number
  /** Token allocation strategy */
  allocation: {
    systemInstructions: number   // Fixed: ~300 tokens
    componentRegistry: number    // Budget: ~1500 tokens
    context: number              // Budget: ~500 tokens
    rules: number                // Budget: ~400 tokens
    dataDescription: number      // Budget: ~300 tokens
    intent: number               // Budget: ~200 tokens
    outputSchema: number         // Fixed: ~300 tokens
    previousSpec: number         // Budget: ~400 tokens
  }
}
```

#### Component pre-filtering

Instead of serializing all 200 components, the orchestrator pre-filters to include only relevant components:

```
All registered components (200)
        │
        ▼
Filter by user permissions ──▶ Remove components requiring permissions the user lacks (→ 150)
        │
        ▼
Filter by device constraints ──▶ Remove components with minWidth > screen width (→ 120)
        │
        ▼
Filter by data classification ──▶ Remove components needing data above user clearance (→ 110)
        │
        ▼
Filter by suitableFor relevance ──▶ Score components by intent match, keep top N (→ 20-30)
        │
        ▼
Include in prompt (20-30 components, ~1500 tokens)
```

The `suitableFor` field in component registration and `tags` are used for relevance scoring. The intent parser extracts action verbs and entities that match against component metadata.

#### Context summarization

For the prompt, context is summarized to essentials:

```typescript
function summarizeContext(context: ContextSnapshot, rules: Rule[]): string {
  // Only include context signals that are referenced by active rules
  // or that have semantic relevance to the intent
  const referencedSignals = extractSignalsFromRules(rules)
  const intentRelevantSignals = inferRelevantSignals(context, parsedIntent)

  const includedSignals = union(referencedSignals, intentRelevantSignals)
  return serializeContext(context, { only: includedSignals })
}
```

#### Overflow handling

If the prompt still exceeds budget after filtering:

1. **Reduce component descriptions** — Use short descriptions instead of full metadata.
2. **Remove optional context** — Keep only rule-referenced signals.
3. **Truncate previous spec** — Include only component IDs (for stable ID re-use), not full props.
4. **Last resort** — Log a warning and send the prompt as-is (LLMs handle long prompts, just with degraded quality).

#### Developer visibility

```typescript
interface PromptMetrics {
  totalTokens: number
  budgetUtilization: number // 0-1
  componentsIncluded: number
  componentsFiltered: number
  contextSignalsIncluded: string[]
  contextSignalsFiltered: string[]
  overflowActions: string[] // What was truncated, if anything
}
```

Included in `GenerationTrace` for debugging.

### Consequences

- **Positive:** Prompt size stays within budget regardless of registry size. A 200-component registry still produces a focused 20-30 component prompt.
- **Positive:** Pre-filtering improves LLM response quality — fewer irrelevant components = better selection decisions.
- **Positive:** Developers can tune the budget and allocation for their specific use case.
- **Negative:** Pre-filtering logic adds complexity to the orchestrator (~300-400 lines).
- **Negative:** Aggressive filtering might exclude a component that the LLM would have chosen. The relevance scoring must be well-tuned.
- **Mitigation:** The DevTools should show which components were filtered out, allowing developers to debug cases where the "wrong" components were excluded.
- **Interaction with ADR-006:** Smaller prompts = fewer tokens = lower cost per generation.

---

*End of Batch 1 — Critical ADRs*

---
---

## ADR-008: Inter-component Communication

**Status:** Decided

### Context

A generated UI specification can contain multiple components that logically relate to each other. For example:

- A filter dropdown + a data table (filter controls what the table displays)
- A date range picker + a chart (date range controls the chart period)
- A search input + a results list + a detail panel (master-detail pattern)

The vision document defines `InteractionSpec[]` as an optional field in `UISpecification` but never elaborates on what it contains or how it works. Without inter-component communication, generated layouts are collections of **isolated components** that cannot coordinate — severely limiting the value of dynamic UI generation.

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A — Shared state store** | Components read/write to a shared reactive store managed by LiquidView | Familiar pattern (Redux-like), powerful | Heavy, complex for LLM to generate correctly, framework-specific |
| **B — Event bus** | Components emit named events; other components subscribe to them | Loose coupling, simple mental model | Can become spaghetti, hard to debug |
| **C — Declarative bindings in spec** | The generated spec declares data flows between components; the LiquidView wires them | LLM-friendly (declarative), inspectable, validates at spec level | Needs a binding resolution layer |
| **D — Hybrid: declarative bindings + scoped event bus** | Spec declares bindings for common patterns; event bus available for complex cases | Best of both, progressive complexity | Two mechanisms |

### Decision

**Option C — Declarative bindings defined in the generated spec, resolved by the LiquidView renderer.**

The LLM generates interaction bindings as part of the spec. The renderer wires them without components needing to know about each other.

#### InteractionSpec definition

```typescript
interface InteractionSpec {
  /** Unique ID for this interaction binding */
  id: string
  /** Source component and output signal */
  source: {
    componentId: string
    output: string      // Named output signal (e.g., "selectedValue", "filterState", "dateRange")
  }
  /** Target component and input prop */
  target: {
    componentId: string
    prop: string        // Prop name to bind the value to
  }
  /** Optional transform applied to the value in transit */
  transform?: 'identity' | 'toArray' | 'toString' | 'toNumber' | {
    type: 'map'
    mapping: Record<string, unknown>
  }
}
```

#### Component output/input contract

Components declare what outputs they produce and what dynamic inputs they accept:

```typescript
registerComponent('FilterDropdown', {
  component: FilterDropdownComponent,
  description: 'Dropdown filter with single or multi-select',
  accepts: {
    options: { type: 'array', required: true },
    defaultValue: { type: 'string', required: false },
  },

  // Outputs this component can emit (used in InteractionSpec.source.output)
  outputs: {
    selectedValue: { type: 'string', description: 'Currently selected filter value' },
    selectedValues: { type: 'string[]', description: 'All selected values (multi-select)' },
  },

  // Dynamic inputs that can be bound via InteractionSpec (beyond static props)
  dynamicInputs: {
    options: { type: 'array', description: 'Options can be dynamically updated' },
  },

  // ... other registration fields
})
```

#### Example generated spec with interactions

```json
{
  "layout": { "type": "stack" },
  "components": [
    {
      "id": "region-filter",
      "type": "FilterDropdown",
      "props": { "options": ["EMEA", "APAC", "Americas"], "defaultValue": "EMEA" },
      "slot": "top",
      "priority": 1
    },
    {
      "id": "sales-chart",
      "type": "SalesChart",
      "props": { "data": "team-sales", "chartType": "bar" },
      "slot": "main",
      "priority": 2
    }
  ],
  "interactions": [
    {
      "id": "filter-to-chart",
      "source": { "componentId": "region-filter", "output": "selectedValue" },
      "target": { "componentId": "sales-chart", "prop": "groupByValue" }
    }
  ]
}
```

#### How the renderer wires interactions

```
1. Renderer reads interactions[] from the spec
2. For each interaction:
   a. Wrap the source component with an output listener
   b. When source emits the named output → apply transform → update target's prop
3. Updates are reactive (React state / Vue ref / signals)
4. Components remain unaware of each other — the renderer is the mediator
```

#### Prompt instruction for the LLM

The Generation Orchestrator includes this in the system prompt:

```
INTERACTIONS:
When components in your layout logically relate (filter→table, picker→chart, search→list),
declare interaction bindings in the "interactions" array.
Available outputs per component type are listed in each component's "outputs" field.
Available dynamic inputs are listed in each component's "dynamicInputs" field.
Only bind outputs to compatible input types.
```

#### Validation

The `interactionValidator` (added to the Validation Pipeline) checks:

- All referenced componentIds exist in the spec
- Source output names exist in the source component's `outputs` declaration
- Target prop/dynamicInput exists in the target component's registration
- Type compatibility between output and input
- No circular bindings

### Consequences

- **Positive:** Fully declarative — the LLM generates interactions as data, not code. Inspectable, validatable, and observable.
- **Positive:** Components stay decoupled — they don't import or reference each other. The renderer handles all wiring.
- **Positive:** The interaction validator catches invalid bindings before render (e.g., binding a string output to a number input).
- **Negative:** Components must declare `outputs` and `dynamicInputs` in their registration. This is an additional step for component authors.
- **Negative:** Complex interaction patterns (e.g., "when A and B both change, compute C") may not fit the simple source→target model. For Phase 1 this limitation is acceptable; complex patterns can be addressed in Phase 2 with a richer binding language.
- **Interaction with ADR-001:** Interaction state (current binding values) is part of ViewState and is preserved across re-generations if the same interaction ID persists.

---

## ADR-009: Generation Latency UX

**Status:** Decided

### Context

LLM generation takes time — typically 200-2000ms depending on model, prompt size, and provider. The vision document specifies that every LiquidView must have a `fallback` component, and that the fallback renders when the LLM is unavailable. But it doesn't address the UX *during* normal generation:

- What does the user see during the 200-500ms of a cache miss?
- What about first page load (no cache, no previous spec)?
- What about re-generation triggered by context change (previous spec exists)?
- How does streaming affect the perceived latency?

### Decision

**Three-phase rendering with streaming support:**

#### Phase model

```
Phase 1: IMMEDIATE (0ms)
  ├── Cache HIT → Render cached spec (done)
  └── Cache MISS → Render fallback immediately
         │
         ▼
Phase 2: STREAMING (as LLM generates, typically 100-500ms)
  ├── Progressive component appearance
  │   - Components render as soon as their spec chunk arrives
  │   - High-priority components arrive first (the LLM is instructed to generate high-priority first)
  │   - Smooth fade-in transition per component
  └── If streaming not supported → wait for full spec
         │
         ▼
Phase 3: COMPLETE (full spec received and validated)
  └── Final layout adjustment + any remaining transitions
```

#### For first load (no cache, no previous spec)

```
t=0ms:    Render fallback immediately (developer-provided static UI)
t=100ms:  First streaming chunk arrives → begin replacing fallback sections
          with generated components (crossfade transition, 200ms)
t=300ms:  Most components rendered → layout stabilizes
t=500ms:  All components rendered → generation complete
```

The fallback ensures the user **never** sees a blank screen or spinner.

#### For re-generation (previous spec exists)

```
t=0ms:    Keep current generated UI visible (no flash, no fallback)
t=100ms:  New spec chunks arrive → diff against current spec
          - Unchanged components: no visual change
          - Modified components: crossfade to new version
          - New components: fade in
          - Removed components: fade out
t=300ms:  Transition complete
```

The user experience is a **smooth morph** from old layout to new, not a flash-of-fallback.

#### Configuration

```typescript
interface TransitionConfig {
  /** Transition duration in ms. Default: 200 */
  duration: number
  /** Transition type. Default: 'crossfade' */
  type: 'crossfade' | 'slide' | 'none' | 'instant'
  /** Whether to show a subtle progress indicator during generation. Default: true */
  showProgressIndicator: boolean
  /** Delay before showing any loading indicator (ms). Default: 300 */
  loadingDelay: number
  /** Whether to use streaming progressive rendering. Default: true */
  streaming: boolean
}

<LiquidView
  intent="Show dashboard"
  fallback={<StaticDashboard />}
  transition={{ duration: 250, type: 'crossfade', streaming: true }}
/>
```

#### Progress indicator

A subtle, non-blocking indicator (thin progress bar at the top of the LiquidView, or a small spinner icon) appears only if generation takes longer than `loadingDelay` (default 300ms). For fast generations (cache hit or fast LLM), the user never sees a loading indicator.

#### Streaming protocol

The Generation Orchestrator emits spec chunks as they arrive from the LLM:

```typescript
interface GenerationChunk {
  /** Incremental spec addition */
  type: 'component' | 'interaction' | 'layout' | 'complete'
  /** For 'component': the component spec to render immediately */
  component?: ComponentSpec
  /** For 'layout': the layout structure (sent first) */
  layout?: LayoutSpec
  /** For 'complete': the full validated spec */
  specification?: UISpecification
}
```

The LLM is instructed to generate in this order:
1. Layout structure first (so the renderer knows where to place components)
2. High-priority components (so they appear first)
3. Lower-priority components
4. Interactions (wired after components render)

### Consequences

- **Positive:** Users never see a blank screen — fallback renders at t=0.
- **Positive:** Streaming makes generation feel faster than it is — components appear progressively.
- **Positive:** Re-generation is seamless — smooth morph from old to new, no flash.
- **Positive:** The 300ms loading delay avoids showing loading indicators for fast operations.
- **Negative:** Streaming requires the LLM connector to support `AsyncIterable<GenerationChunk>`. Connectors for providers without streaming support fall back to full-spec delivery (Phase 2 renders only after full spec).
- **Negative:** Crossfade transitions add a small visual overhead. Developers can set `type: 'instant'` to disable them.
- **Interaction with ADR-001:** During the morph transition, ViewState from the old spec is transferred to matching components in the new spec.
- **Interaction with ADR-003:** Cache hits skip all of this — instant render at Phase 1.

---

## ADR-010: Testing Strategy for Non-deterministic Output

**Status:** Decided

### Context

LLM output is inherently non-deterministic. The same intent + context may produce different valid specifications on different calls. The vision document shows a test example:

```typescript
expect(result.componentsSelected).toContain('KPICard')
```

But this assertion may flake — the LLM might validly choose `SummaryCard` instead of `KPICard` for the same intent. Without a clear testing strategy, developers cannot write reliable tests for liquid views.

### Decision

**Four-tier testing strategy, from fully deterministic to real-LLM integration:**

#### Tier 1 — Unit tests with MockConnector (deterministic)

```typescript
import { MockConnector } from '@flui/testing'

const mock = new MockConnector({
  // Return a fixed spec for any matching intent
  responses: [
    {
      match: { intent: /metrics|dashboard|kpi/i },
      spec: {
        layout: { type: 'grid', columns: 2 },
        components: [
          { id: 'kpi-1', type: 'KPICard', props: { metric: 'revenue' }, slot: 'a', priority: 1 },
          { id: 'chart-1', type: 'SalesChart', props: { data: 'sales' }, slot: 'b', priority: 2 },
        ]
      }
    }
  ]
})

test('dashboard renders KPI cards with mock connector', async () => {
  const { getByTestId } = render(
    <FluiProvider connector={mock} components={registry}>
      <LiquidView intent="Show key metrics" fallback={<div>fallback</div>} />
    </FluiProvider>
  )

  await waitFor(() => {
    expect(getByTestId('kpi-card')).toBeInTheDocument()
    expect(getByTestId('sales-chart')).toBeInTheDocument()
  })
})
```

**Use for:** Component rendering, ViewState management, interaction wiring, fallback behavior, error handling.

#### Tier 2 — Contract tests (validate spec shape, not exact content)

```typescript
import { generateSpec } from '@flui/testing'

test('generation produces valid spec for dashboard intent', async () => {
  const result = await generateSpec({
    intent: 'Show key metrics',
    context: { role: 'executive', device: 'mobile' },
    components: registry,
    connector: realOrMockConnector,
  })

  // Shape assertions — don't care WHICH components, care about structure
  expect(result.specification).toMatchSchema(UISpecificationSchema)
  expect(result.specification.components.length).toBeGreaterThan(0)
  expect(result.specification.components.length).toBeLessThanOrEqual(5)
  expect(result.validation.status).toBe('pass')

  // Every component in spec must exist in registry
  for (const comp of result.specification.components) {
    expect(registry.has(comp.type)).toBe(true)
  }
})
```

**Use for:** Validation pipeline correctness, spec schema compliance, generation orchestrator output.

#### Tier 3 — Property-based tests (assert invariants, not exact values)

```typescript
import { propertyTest } from '@flui/testing'

propertyTest('mobile always has ≤ 3 components', {
  intent: propertyTest.anyIntent(['Show metrics', 'Show reports', 'Show team data']),
  context: {
    device: 'mobile',
    role: propertyTest.anyOf(['executive', 'analyst', 'manager']),
  },
  runs: 20,  // Run 20 times with different combinations
  assert: (result) => {
    expect(result.specification.components.length).toBeLessThanOrEqual(3)
  }
})

propertyTest('confidential data never shown to non-finance roles', {
  intent: propertyTest.anyIntent(['Show financial data', 'Show revenue']),
  context: {
    role: propertyTest.anyOf(['marketing', 'engineering', 'sales']),
  },
  runs: 10,
  assert: (result) => {
    for (const comp of result.specification.components) {
      const reg = registry.get(comp.type)
      expect(reg.maxDataClassification).not.toBe('confidential')
    }
  }
})
```

**Use for:** Rule enforcement, security invariants, accessibility constraints, context-driven behavior.

#### Tier 4 — Golden-file tests with real LLMs (CI, periodic)

```typescript
import { goldenTest } from '@flui/testing'

goldenTest('executive-mobile-dashboard', {
  intent: 'Show me this month key performance metrics',
  context: { role: 'executive', device: 'mobile', expertise: 'high' },
  connector: anthropic({ model: 'claude-sonnet-4-20250514' }),
  components: registry,
  // First run: saves spec as golden file
  // Subsequent runs: compares against golden file
  tolerance: {
    // Allow component ORDER to differ
    ignoreOrder: true,
    // Allow different component choices if they serve the same suitableFor category
    allowEquivalentComponents: true,
    // Layout type must match
    strictLayout: true,
  }
})
```

**Use for:** Regression detection, LLM model upgrade validation, prompt engineering verification. Run in CI on a schedule (not on every commit — too expensive and slow).

#### MockConnector API

```typescript
interface MockConnector extends LLMConnector {
  /** Predefined responses matched by intent pattern */
  responses: MockResponse[]
  /** Record all generation requests for assertions */
  calls: GenerationRequest[]
  /** Simulate specific behaviors */
  behavior?: {
    latency?: number          // Simulate LLM latency (ms)
    failAfter?: number        // Fail after N successful calls
    streamChunks?: number     // Number of streaming chunks to emit
    error?: Error             // Always throw this error
  }
}
```

### Consequences

- **Positive:** Tier 1-3 tests are fully deterministic and fast — suitable for every commit.
- **Positive:** Tier 3 property tests catch rule violations that specific test cases might miss.
- **Positive:** Tier 4 golden tests catch LLM regression without requiring deterministic output.
- **Positive:** The `MockConnector` enables unit testing of all framework features without LLM costs.
- **Negative:** Tier 4 tests are expensive (real LLM calls) and non-deterministic (may flake). Should run on schedule, not on every commit.
- **Negative:** Golden-file tolerance tuning requires judgment — too strict = flaky, too loose = misses regressions.
- **Recommendation:** Phase 1 focuses on Tier 1 + Tier 2. Tier 3 added during Phase 1 once rules are implemented. Tier 4 added in Phase 2 for CI regression.

---

## ADR-011: Error Recovery and Circuit Breaker

**Status:** Decided

### Context

The vision document describes three failure strategies for the Validation Pipeline: `retry`, `fallback`, and `block`. But it doesn't specify:

- How many retries?
- Same prompt or modified prompt on retry?
- What if a specific intent pattern consistently fails?
- What telemetry on failures?
- How to prevent a broken LLM provider from degrading the entire application?

### Decision

**Structured retry strategy with prompt modification, circuit breaker per intent pattern, and comprehensive failure telemetry.**

#### Retry strategy

```typescript
interface RetryConfig {
  /** Maximum retry attempts. Default: 2 */
  maxRetries: number
  /** Strategy for modifying the prompt on retry */
  retryStrategy: 'same-prompt' | 'with-violations' | 'simplified'
  /** Delay between retries (ms). Default: 0 (immediate) */
  retryDelay: number
}
```

| Strategy | Behavior | When to Use |
|----------|----------|-------------|
| `'same-prompt'` | Retry with the identical prompt (relies on LLM non-determinism) | Transient LLM errors, rate limits |
| `'with-violations'` | Append validation violations to the prompt: "Your previous output had these issues: [...]. Fix them." | Validation failures (most common) |
| `'simplified'` | Reduce the prompt: fewer components, simpler context. Ask for a minimal valid spec. | Complex prompts that overwhelm the LLM |

Default behavior per failure type:

```typescript
const defaultRetryBehavior = {
  // LLM returns malformed output (not valid JSON, wrong schema)
  schemaFailure: { maxRetries: 2, strategy: 'with-violations' },
  // Validation pipeline rejects the spec (a11y, compliance, data classification)
  validationFailure: { maxRetries: 1, strategy: 'with-violations' },
  // LLM provider error (timeout, 500, rate limit)
  providerError: { maxRetries: 1, strategy: 'same-prompt', retryDelay: 1000 },
  // LLM returns valid spec but references unknown components
  componentFailure: { maxRetries: 1, strategy: 'simplified' },
}
```

#### Circuit breaker

The circuit breaker prevents repeated expensive failures for intent patterns that consistently fail generation:

```typescript
interface CircuitBreakerConfig {
  /** Number of consecutive failures to open the circuit. Default: 3 */
  failureThreshold: number
  /** Time the circuit stays open before trying again (ms). Default: 60_000 */
  resetTimeout: number
  /** Granularity of circuit tracking */
  scope: 'per-intent' | 'per-view' | 'global'
}
```

State machine:

```
         ┌────────────┐
         │   CLOSED    │ (normal operation)
         └──────┬──────┘
                │ failure count ≥ threshold
                ▼
         ┌────────────┐
         │    OPEN     │ (all requests → fallback immediately, no LLM call)
         └──────┬──────┘
                │ resetTimeout elapsed
                ▼
         ┌────────────┐
         │ HALF-OPEN   │ (allow ONE request through)
         └──────┬──────┘
                │
        ┌───────┴───────┐
        │ success       │ failure
        ▼               ▼
    ┌────────┐    ┌────────┐
    │ CLOSED │    │  OPEN  │
    └────────┘    └────────┘
```

When the circuit is OPEN, the LiquidView immediately renders the fallback without making an LLM call. This prevents:
- Wasting LLM costs on requests that will fail.
- Adding latency to views that can't generate.
- Cascading failures from a degraded LLM provider.

#### Failure telemetry

Every failure is recorded in the `GenerationTrace`:

```typescript
interface FailureRecord {
  attempt: number
  error: {
    type: 'schema' | 'validation' | 'provider' | 'component' | 'timeout' | 'budget'
    message: string
    details?: unknown
  }
  retryStrategy?: string
  duration: number
}

interface GenerationTrace {
  // ... existing fields ...
  failures: FailureRecord[]
  circuitBreakerState: 'closed' | 'open' | 'half-open'
  finalOutcome: 'success' | 'fallback-after-retries' | 'fallback-circuit-open' | 'blocked'
}
```

#### Developer hooks

```typescript
<FluiProvider
  connector={connector}
  components={registry}
  onGenerationFailure={(failure) => {
    // Custom failure handling (e.g., send to error tracking)
    errorTracker.capture(failure)
  }}
  onCircuitOpen={(viewId, intent) => {
    // Alert that a view has tripped the circuit breaker
    logger.warn(`Circuit open for ${viewId}: ${intent}`)
  }}
>
```

### Consequences

- **Positive:** `with-violations` retry is highly effective — LLMs are good at self-correcting when told what was wrong.
- **Positive:** Circuit breaker prevents cascading failures and wasted costs.
- **Positive:** Detailed failure telemetry enables debugging and optimization ("which intents fail most?").
- **Negative:** Retry adds latency for failed generations (attempt 1 + retry = 2x latency before fallback).
- **Negative:** Circuit breaker requires state tracking per scope, adding memory overhead.
- **Mitigation:** Low `maxRetries` (1-2) and immediate retry (no delay for validation failures) keep added latency minimal. Circuit breaker state is lightweight (a few bytes per tracked pattern).

---

## ADR-012: Multi-LiquidView Coordination

**Status:** Decided

### Context

A realistic page may contain multiple `LiquidView` components:

```tsx
<PageLayout>
  <LiquidView intent="Show navigation for current user role" fallback={<StaticNav />} />
  <LiquidView intent="Show main dashboard content" fallback={<StaticDashboard />} />
  <LiquidView intent="Show contextual actions sidebar" fallback={<StaticSidebar />} />
</PageLayout>
```

Each LiquidView currently generates independently. This creates issues:

- **Cost:** 3 independent LLM calls per page load.
- **Coherence:** The three views don't know about each other — they might generate conflicting layouts or redundant components.
- **Timing:** They complete at different times, causing the page to "pop in" unevenly.

### Decision

**Three coordination modes: independent (default), batched, and coordinated. The FluiProvider orchestrates.**

#### Mode 1 — Independent (default)

Each LiquidView generates independently. No coordination overhead. Best for pages where liquid views are truly independent (e.g., a single LiquidView on a page, or views in different routes).

#### Mode 2 — Batched

Multiple LiquidViews are combined into a single LLM call. The Generation Orchestrator builds a compound prompt:

```typescript
<FluiProvider
  connector={connector}
  components={registry}
  coordination="batched"
>
```

The orchestrator detects multiple pending generation requests within a configurable time window (default: 50ms) and combines them:

```typescript
interface BatchedGenerationRequest {
  views: {
    viewId: string
    intent: string
    availableComponents: string[]  // Pre-filtered per view
    fallback: string               // Description for the LLM
  }[]
  sharedContext: ContextSnapshot
  sharedRules: Rule[]
}
```

The LLM receives a single prompt asking it to generate specs for all views simultaneously:

```
Generate UI specifications for the following views on the same page.
Ensure visual coherence and avoid redundant components across views.

VIEW 1 (id: "nav"): Intent: "Show navigation for current user role"
VIEW 2 (id: "main"): Intent: "Show main dashboard content"
VIEW 3 (id: "sidebar"): Intent: "Show contextual actions sidebar"
```

The LLM returns a compound response that is parsed into individual specs per view.

**Benefits:** Single LLM call (1/3 the cost), inherent coherence (LLM sees all views), simultaneous completion.
**Trade-off:** Larger prompt, longer single call, more complex parsing. If one view's generation fails, all views must handle the failure.

#### Mode 3 — Coordinated

Views generate independently but share an awareness context:

```typescript
<FluiProvider
  connector={connector}
  components={registry}
  coordination="coordinated"
>
```

After each view generates, its selected components and layout are added to a shared `PageContext` that subsequent views (or re-generations) can reference:

```typescript
interface PageContext {
  views: Record<string, {
    componentsUsed: string[]
    layoutType: string
    dataSourcesUsed: string[]
  }>
}
```

This is included in each view's prompt as:

```
OTHER VIEWS ON THIS PAGE:
- "nav" uses: [RoleNavigation] with sidebar layout
- "main" uses: [KPICard, SalesChart, DataTable] with grid-2col layout
Avoid redundancy with these existing views.
```

**Benefits:** Views are coherent without requiring a single compound call. Each view can cache independently.
**Trade-off:** Order-dependent (first view generates without awareness, later views are informed). Requires a generation sequencing strategy.

#### Sequencing for coordinated mode

```typescript
interface CoordinationConfig {
  mode: 'independent' | 'batched' | 'coordinated'
  /** For batched: time window to collect pending requests (ms). Default: 50 */
  batchWindow?: number
  /** For coordinated: order of view generation (by viewId). Default: DOM order */
  generationOrder?: string[]
}
```

### Consequences

- **Positive:** Three modes give developers the right tool for their use case.
- **Positive:** Batched mode cuts costs to 1/N for N views on a page.
- **Positive:** Coordinated mode preserves per-view caching while improving coherence.
- **Negative:** Batched mode increases prompt complexity and requires compound response parsing.
- **Negative:** Coordinated mode introduces generation ordering and page-level state.
- **Recommendation for Phase 1:** Implement independent (default) and batched modes. Coordinated mode in Phase 2.
- **Interaction with ADR-003:** In batched mode, the cache key includes all view intents. In coordinated mode, each view caches independently but the PageContext is part of later views' cache keys.
- **Interaction with ADR-006:** Batched mode enables a single cost-budget check for the entire page.

---

## ADR-013: Runtime Type Safety

**Status:** Decided

### Context

The vision document defines TypeScript interfaces for component registration (`accepts`, `props`) and generated specs (`ComponentSpec.props`). But TypeScript types exist only at compile time. At runtime, the LLM generates a JSON spec — there is no compile-time guarantee that the generated props match the component's expected types.

The `propValidator` is mentioned in the Validation Pipeline but its implementation is not specified.

### Decision

**Use Zod schemas for runtime type validation, auto-generated from component registration.**

#### Component registration with Zod

```typescript
import { z } from 'zod'
import { registerComponent } from '@flui/core'

registerComponent('SalesChart', {
  component: SalesChartComponent,
  description: 'Interactive chart showing sales data over time',

  // Zod schema for props validation
  propsSchema: z.object({
    data: z.string().describe('Data source identifier (timeseries)'),
    period: z.enum(['day', 'week', 'month', 'quarter', 'year']).describe('Time period'),
    groupBy: z.enum(['region', 'product', 'team']).optional().describe('Grouping dimension'),
    chartType: z.enum(['bar', 'line', 'area']).default('bar').describe('Visualization type'),
  }),

  // ... other registration fields
})
```

#### Convenience: schema inference from accepts

For developers who don't want to write Zod schemas manually, the `accepts` field (from the vision document) is auto-converted to a Zod schema:

```typescript
registerComponent('KPICard', {
  component: KPICardComponent,
  description: 'Displays a single KPI with trend indicator',

  // Shorthand — auto-converted to Zod schema internally
  accepts: {
    metric: { type: 'string', required: true },
    value: { type: 'number', required: true },
    trend: { type: 'enum', values: ['up', 'down', 'flat'], required: false, default: 'flat' },
  },
})

// Internally becomes:
// z.object({
//   metric: z.string(),
//   value: z.number(),
//   trend: z.enum(['up', 'down', 'flat']).default('flat'),
// })
```

If `propsSchema` (Zod) is provided, it takes precedence over `accepts`. Both are valid registration methods.

#### PropValidator implementation

```typescript
const propValidator: Validator = {
  name: 'prop-validator',
  validate(spec: UISpecification, context: ContextSnapshot): ValidationResult {
    const violations: Violation[] = []

    for (const comp of spec.components) {
      const registration = registry.get(comp.type)
      if (!registration) continue // componentValidator handles unknown types

      const schema = registration.propsSchema ?? deriveSchema(registration.accepts)
      const result = schema.safeParse(comp.props)

      if (!result.success) {
        for (const issue of result.error.issues) {
          violations.push({
            severity: 'fail',
            component: comp.id,
            rule: 'PROP-TYPE',
            message: `Component "${comp.type}" prop "${issue.path.join('.')}": ${issue.message}`,
            suggestion: `Expected ${issue.expected}, received ${issue.received}`,
          })
        }
      }
    }

    return {
      status: violations.length ? 'fail' : 'pass',
      violations,
      suggestions: violations.map(v => v.suggestion).filter(Boolean),
    }
  }
}
```

#### Schema serialization for the LLM prompt

The Zod schemas are serialized as part of the component catalog in the prompt:

```
COMPONENT: SalesChart
Description: Interactive chart showing sales data over time
Props:
  - data (string, required): Data source identifier (timeseries)
  - period (enum: day|week|month|quarter|year, required): Time period
  - groupBy (enum: region|product|team, optional): Grouping dimension
  - chartType (enum: bar|line|area, default: "bar"): Visualization type
```

The `.describe()` annotations on Zod fields are used to generate human-readable prop descriptions for the LLM.

#### Zod as a dependency

Zod is a `@flui/core` dependency. It adds ~13KB gzipped to the bundle. This is acceptable given the value of runtime validation. If bundle size is critical (see ADR-018), a lighter validation library can be substituted via a `SchemaValidator` interface.

### Consequences

- **Positive:** Every generated spec is type-validated at runtime before rendering. Invalid props never reach components.
- **Positive:** Zod `.describe()` annotations serve double duty: LLM prompt generation + developer documentation.
- **Positive:** Two registration methods (Zod for power users, `accepts` shorthand for convenience) lower the barrier.
- **Negative:** Zod adds ~13KB to the bundle. Acceptable for most apps, configurable for size-sensitive ones.
- **Negative:** Zod schemas must be maintained alongside component props. If the component's actual props change but the schema doesn't update, validation may reject valid props or pass invalid ones.
- **Mitigation:** `@flui/testing` includes a `schemaSync` utility that compares Zod schemas against actual component prop types (via TypeScript compiler API) and warns on mismatches.

---

## ADR-014: Accessibility During Dynamic Re-generation

**Status:** Decided

### Context

The vision document's a11y validator checks the generated *spec* for accessibility compliance (WCAG). But accessibility is not just about the static output — it's about the *dynamic experience*:

- When a LiquidView re-generates, the DOM changes. Where does keyboard focus go?
- How does a screen reader announce that the UI has changed?
- What about motion sensitivity when components animate in/out?
- What about re-generation triggered by context changes the user didn't initiate?

If Flui regenerates the UI and drops keyboard focus or fails to announce changes, it violates WCAG 2.1 Success Criterion 4.1.3 (Status Messages) and potentially 2.4.3 (Focus Order).

### Decision

**The LiquidView renderer implements an accessibility lifecycle for dynamic changes.**

#### Focus management

```typescript
interface FocusStrategy {
  /** What to do with focus after re-generation */
  onRegeneration: 'preserve' | 'reset-to-container' | 'first-interactive'
  /** What to do if the focused element was removed */
  onFocusedElementRemoved: 'container' | 'next-sibling' | 'first-interactive'
}
```

Default behavior:

```
Re-generation starts
        │
        ▼
Record currently focused element (by component ID + internal path)
        │
        ▼
New spec rendered
        │
        ▼
Does the focused component still exist in new spec?
  ├── YES → Restore focus to same element within the component
  │         (component's stateContract can include focus state)
  └── NO  → Move focus to:
             1. Next sibling component in the spec (if exists)
             2. LiquidView container (as last resort)
             → Announce: "[component name] was removed"
```

#### ARIA live region

Every LiquidView renders a visually hidden ARIA live region:

```html
<div role="status" aria-live="polite" aria-atomic="false" class="flui-sr-only">
  <!-- Announcements injected here -->
</div>
```

Announcements are made for:

| Event | Announcement | Priority |
|-------|-------------|----------|
| Generation started (visible loading) | "Updating view..." | `polite` |
| Generation complete (layout unchanged) | *(no announcement — no visible change)* | — |
| Generation complete (layout changed) | "View updated: now showing [component summary]" | `polite` |
| Generation failed → fallback | "View could not update. Showing default view." | `assertive` |
| Component added | "[Component name] added" | `polite` |
| Component removed | "[Component name] removed" | `polite` |

The component summary is derived from the generated spec's component descriptions (from the registry).

#### Motion and animation

```typescript
interface A11yConfig {
  /** Respect prefers-reduced-motion media query. Default: true */
  respectReducedMotion: boolean
  /** Disable all transitions for screen reader users. Default: false */
  disableTransitionsForScreenReaders: boolean
  /** Maximum transition duration (ms) for re-generation. Default: 300 */
  maxTransitionDuration: number
}
```

When `prefers-reduced-motion: reduce` is detected:
- All crossfade/slide transitions are replaced with instant swaps.
- No progressive component appearance — all components render simultaneously.
- Loading indicators use static (non-animated) variants.

#### Keyboard navigation after re-generation

The rendered layout must maintain a logical tab order. The LiquidView renderer:

1. Assigns `tabindex` values based on component `priority` in the spec (high priority = earlier in tab order).
2. Ensures all interactive elements remain reachable via keyboard.
3. Never traps focus inside the LiquidView (user can always tab out).

#### Validator enhancement

The a11y validator (from the Validation Pipeline) is enhanced with dynamic-specific checks:

```typescript
const dynamicA11yValidator: Validator = {
  name: 'dynamic-a11y',
  validate(spec, context, previousSpec?) {
    const violations = []

    // Check: if layout changed significantly, ensure focus strategy is viable
    if (previousSpec && layoutDiffScore(spec, previousSpec) > 0.5) {
      // More than 50% layout change — flag for review
      violations.push({
        severity: 'warn',
        rule: 'A11Y-DYNAMIC-001',
        message: 'Major layout change detected. Verify focus management will handle this gracefully.',
      })
    }

    // Check: all interactive components must have accessible names
    for (const comp of spec.components) {
      const reg = registry.get(comp.type)
      if (reg?.a11y?.hasAltText === false && !comp.props.ariaLabel) {
        violations.push({
          severity: 'fail',
          rule: 'A11Y-LABEL-001',
          message: `Component "${comp.type}" (${comp.id}) lacks accessible name`,
          suggestion: 'Add ariaLabel prop or ensure component provides its own accessible name',
        })
      }
    }

    return { status: violations.length ? 'warn' : 'pass', violations, suggestions: [] }
  }
}
```

### Consequences

- **Positive:** Flui becomes one of the most accessibility-conscious dynamic UI frameworks — a genuine differentiator.
- **Positive:** Screen reader users get meaningful announcements about UI changes, not silence or chaos.
- **Positive:** `prefers-reduced-motion` respect is automatic and comprehensive.
- **Positive:** Focus management is predictable and aligned with WCAG guidelines.
- **Negative:** ARIA announcements require careful tuning — too many announcements are as bad as none. The polite/assertive priority and debouncing must be well-calibrated.
- **Negative:** Focus restoration requires the `stateContract` (ADR-001) to include focus state, adding to the component author's responsibility.
- **Trade-off:** The `disableTransitionsForScreenReaders` option is conservative (off by default). Some screen reader users may prefer transitions; others find them confusing. Making it configurable is the safest approach.
- **Interaction with ADR-009:** The transition system (crossfade, slide) must respect the a11y config. Reduced motion = instant transitions.
- **Interaction with ADR-004:** Re-generations triggered by context changes (not user-initiated) should use `polite` announcements, not `assertive`, to avoid interrupting the user.

---

*End of Batch 2 — High-Importance ADRs*

---
---

## ADR-015: Performance Budgets

**Status:** Decided

### Context

The vision document contains no concrete performance targets. Without explicit budgets, implementation decisions are made without constraints, leading to:

- No benchmark to evaluate architectural trade-offs ("Is 800ms acceptable? Nobody defined it.")
- No regression detection ("Generation is 2x slower than last week — but was that expected?")
- No way to prioritize optimization work ("What's the biggest bottleneck relative to our target?")

Performance budgets are **architectural constraints** that shape every other decision. They must be defined early, even if they're adjusted later.

### Decision

**Define concrete performance budgets across four dimensions: latency, bundle size, cost, and resource consumption.**

#### Latency budgets

| Metric | Target (P50) | Target (P95) | Hard Limit (P99) | Notes |
|--------|-------------|-------------|-------------------|-------|
| **Cache hit render** | < 5ms | < 15ms | < 50ms | Spec from L1 cache → render. Must feel instant. |
| **Generation (end-to-end)** | < 500ms | < 1500ms | < 3000ms | Intent → LLM call → validation → spec ready. |
| **LLM call only** | < 400ms | < 1200ms | < 2500ms | Prompt sent → response complete. Provider-dependent. |
| **Validation pipeline** | < 20ms | < 50ms | < 100ms | All validators combined. Must be negligible. |
| **Render (spec → DOM)** | < 10ms | < 30ms | < 80ms | Mapping spec to framework components. |
| **Time to Interactive (first load)** | < 200ms | < 500ms | < 1000ms | Fallback renders at t=0; this is time until generated UI is interactive. |
| **Re-generation transition** | < 300ms | < 500ms | < 800ms | Old UI → new UI morph complete. |

#### Bundle size budgets

| Package | Target (gzipped) | Hard Limit | Notes |
|---------|-----------------|------------|-------|
| `@flui/core` | < 25KB | < 40KB | Intent + Context + Registry + Orchestrator + Validation + Cache + Observability |
| `@flui/react` | < 8KB | < 15KB | LiquidView + FluiProvider + hooks + ViewState |
| `@flui/vue` | < 8KB | < 15KB | Same scope as React adapter |
| `@flui/openai` | < 3KB | < 5KB | Connector with streaming support |
| `@flui/anthropic` | < 3KB | < 5KB | Connector with streaming support |
| `@flui/testing` | < 10KB | < 20KB | MockConnector + test utilities (dev dependency only) |
| `@flui/devtools` | < 30KB | < 50KB | Dev-only, not in production bundle |
| **Total production** (core + 1 adapter + 1 connector) | < 36KB | < 60KB | Comparable to a mid-size UI library |

#### Cost budgets (per generation)

| Scenario | Target Cost (USD) | Notes |
|----------|------------------|-------|
| Simple intent, small registry (< 20 components) | < $0.005 | ~1000 prompt tokens + ~300 completion tokens |
| Medium intent, medium registry (20-50 components) | < $0.01 | ~2000 prompt tokens + ~500 completion tokens |
| Complex intent, large registry (50+ components, after filtering) | < $0.02 | ~3000 prompt tokens + ~800 completion tokens |
| Batched generation (3 views) | < $0.03 | Single call for multiple views (ADR-012) |

Based on typical pricing for Claude Sonnet / GPT-4o class models. Cheaper models (Haiku, GPT-4o-mini) would be 5-10x less.

#### Resource consumption budgets

| Metric | Target | Notes |
|--------|--------|-------|
| Memory overhead per LiquidView | < 50KB | ViewState + cache entries + trace buffer |
| Memory overhead for FluiProvider | < 200KB | Registry + global cache + context engine |
| Max concurrent LLM connections | 3 | Per FluiProvider. Prevents connection exhaustion. |
| Trace buffer size (in-memory) | Last 50 traces | Circular buffer. Older traces evicted or flushed to storage. |

#### Measurement and enforcement

```typescript
interface PerformanceConfig {
  /** Enable performance monitoring. Default: true in dev, false in prod */
  monitor: boolean
  /** Log a warning when a budget is exceeded */
  warnOnBudgetExceeded: boolean
  /** Custom budget overrides */
  budgets?: Partial<PerformanceBudgets>
}
```

Performance data is included in `GenerationTrace` (already defined in ADR-003/006) and surfaced in DevTools (ADR-019).

### Consequences

- **Positive:** Every architectural decision can be evaluated against concrete targets.
- **Positive:** Performance regressions are detectable via automated tests against budgets.
- **Positive:** Bundle size budgets prevent dependency bloat — every new dependency must justify its weight.
- **Negative:** Budgets may need adjustment as real-world usage patterns emerge. They're starting points, not laws.
- **Trade-off:** Aggressive bundle budgets (25KB core) may constrain feature scope. If the core exceeds 40KB, consider splitting into `@flui/core` (minimal) and `@flui/core-extended` (full features).
- **Interaction with ADR-007:** Prompt size management directly affects cost budgets. Smaller prompts = cheaper generations.
- **Interaction with ADR-003:** Cache hit rate is the single biggest lever for perceived latency. A 70% cache hit rate means 70% of renders are < 5ms.

---

## ADR-016: Server-Side Generation Architecture

**Status:** Decided

### Context

The vision document mentions SSR in the FAQ ("Flui supports server-side generation") but doesn't architect it. Modern frameworks (Next.js, Nuxt, SvelteKit, Analog) use SSR/SSG extensively. Flui must integrate with these rendering strategies.

Key questions:

- Can a LiquidView generate its spec on the server?
- How does streaming SSR work with LLM generation?
- Can known intents be pre-generated at build time (SSG)?
- How does hydration work — does the client re-generate or reuse the server spec?

### Decision

**Three rendering strategies: CSR (default), SSR (server-side generation), and SSG (build-time generation). Hydration reuses the server-generated spec.**

#### Strategy 1 — CSR (Client-Side Rendering) — Default

The current architecture as described in the vision document. Generation happens in the browser. The fallback renders at t=0, then the generated UI replaces it.

```tsx
// CSR — default behavior, no special configuration
<LiquidView intent="Show dashboard" fallback={<StaticDashboard />} />
```

#### Strategy 2 — SSR (Server-Side Rendering)

The Generation Orchestrator runs on the server during the SSR pass. The generated spec is serialized into the HTML response and hydrated on the client without re-generation.

```tsx
// Next.js App Router — Server Component
import { generateServerSpec } from '@flui/react/server'

export default async function DashboardPage() {
  const spec = await generateServerSpec({
    intent: 'Show dashboard',
    context: await getServerContext(request),  // Server-side context (role, permissions)
    components: registry,
    connector: serverConnector,  // Server-side LLM connector (API key not exposed to client)
  })

  return (
    <LiquidView
      serverSpec={spec}
      fallback={<StaticDashboard />}
      // Client-side re-generation only if context changes post-hydration
      clientRegeneration="on-context-change"
    />
  )
}
```

**Hydration behavior:**

```
Server:
  1. Generate spec via LLM (server-side)
  2. Validate spec
  3. Render to HTML (framework SSR)
  4. Serialize spec as JSON in <script> tag
  5. Send HTML + serialized spec to client

Client:
  1. Display server-rendered HTML immediately (fast first paint)
  2. Hydrate framework components
  3. Deserialize spec from <script> tag → populate L1 cache
  4. LiquidView is now live with the server-generated spec
  5. NO re-generation unless context changes or developer opts in
```

**Streaming SSR:**

For frameworks supporting streaming SSR (Next.js with Suspense), the LiquidView can stream:

```tsx
// The fallback renders immediately; LiquidView streams in when spec is ready
<Suspense fallback={<StaticDashboard />}>
  <LiquidViewSSR intent="Show dashboard" connector={serverConnector} />
</Suspense>
```

The LLM generation happens during the streaming SSR pass. The fallback is sent to the browser first; the generated UI streams in when ready.

#### Strategy 3 — SSG (Static Site Generation / Build-time)

For known, deterministic intents, specs can be pre-generated at build time:

```typescript
// flui.config.ts — build-time generation
export const staticSpecs = defineStaticSpecs([
  {
    id: 'default-dashboard',
    intent: 'Show key metrics overview',
    // Fixed context for static generation (no real user)
    context: { role: 'default', device: 'desktop', expertise: 'intermediate' },
  },
  {
    id: 'mobile-dashboard',
    intent: 'Show key metrics overview',
    context: { role: 'default', device: 'mobile', expertise: 'intermediate' },
  },
])
```

```tsx
// Use pre-generated spec as initial render, then adapt on client
<LiquidView
  intent="Show key metrics overview"
  staticSpecId="default-dashboard"  // Pre-generated, instant
  fallback={<StaticDashboard />}
  clientRegeneration="always"  // Re-generate with real user context after hydration
/>
```

SSG provides instant first render with a pre-generated layout. After hydration, the client re-generates with real user context (role, expertise, device) for a personalized UI. The transition uses the smooth morph from ADR-009.

#### Server-side security benefit

SSR/SSG keeps the LLM API key on the server. In CSR mode, the API key must be accessible to the browser (either via a proxy or directly). SSR eliminates this exposure:

```typescript
// Server — API key stays here
const serverConnector = anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,  // Never sent to client
})

// Client — no direct LLM access needed if using SSR-only
// Or use a proxy endpoint for client-side re-generation
const clientConnector = proxy({ endpoint: '/api/flui/generate' })
```

#### Framework integration matrix

| Framework | CSR | SSR | SSG | Streaming SSR |
|-----------|-----|-----|-----|---------------|
| Next.js (App Router) | Yes | Yes (Server Components) | Yes (generateStaticParams) | Yes (Suspense) |
| Next.js (Pages Router) | Yes | Yes (getServerSideProps) | Yes (getStaticProps) | No |
| Nuxt 3 | Yes | Yes (server middleware) | Yes (prerender) | Yes (streaming) |
| SvelteKit | Yes | Yes (load functions) | Yes (prerender) | Yes |
| Vanilla SPA | Yes | N/A | Possible via build script | N/A |

### Consequences

- **Positive:** SSR eliminates client-side generation latency — the user sees the generated UI on first paint.
- **Positive:** SSG provides zero-latency initial render for known intents.
- **Positive:** SSR keeps API keys server-side — better security posture.
- **Positive:** Hydration reuses the server spec (no double-generation).
- **Negative:** SSR adds server infrastructure requirements (the server needs LLM connectivity).
- **Negative:** SSR/SSG context is limited to what's available server-side (no device detection from User-Agent is imperfect, no cognitive load, no real-time signals). Client-side re-generation fills the gap.
- **Recommendation for Phase 1:** Implement CSR fully. Add SSR support for Next.js App Router as a stretch goal. SSG in Phase 2.
- **Interaction with ADR-003:** Server-generated specs are cached in L1 on hydration, avoiding client re-generation.
- **Interaction with ADR-006:** SSR generation costs are server-side — easier to budget and monitor centrally.

---

## ADR-017: Spec Versioning and Migration

**Status:** Decided

### Context

The `UISpecification` schema will evolve as Flui develops:

- New fields may be added (e.g., `animations`, `transitions`, `accessibility` annotations).
- Field types may change (e.g., `layout.type` gains new enum values).
- Deprecated fields may be removed.

Cached specs (ADR-003, stored in IndexedDB/sessionStorage) and server-generated specs (ADR-016, serialized in HTML) may become stale when the schema evolves. Without versioning, the framework could:

- Crash when reading an old-format spec.
- Silently render incorrect UI from an incompatible spec.
- Force a full cache flush on every framework update (poor UX).

### Decision

**Add a `specVersion` field to `UISpecification` with semantic versioning and a migration pipeline.**

#### Version field

```typescript
interface UISpecification {
  /** Spec schema version. Format: MAJOR.MINOR */
  specVersion: string   // e.g., "1.0", "1.1", "2.0"
  layout: LayoutSpec
  components: ComponentSpec[]
  interactions?: InteractionSpec[]
  annotations?: AnnotationSpec[]
}
```

#### Versioning rules

| Change Type | Version Bump | Cache Impact | Example |
|-------------|-------------|--------------|---------|
| New optional field | MINOR (1.0 → 1.1) | Old specs remain valid | Adding `annotations` field |
| New enum value | MINOR | Old specs remain valid | `layout.type` gains `'masonry'` |
| Field renamed | MAJOR (1.x → 2.0) | Old specs incompatible | `slot` → `position` |
| Field removed | MAJOR | Old specs incompatible | Removing `conditions` |
| Field type changed | MAJOR | Old specs incompatible | `priority: number` → `priority: 'high'\|'medium'\|'low'` |

#### Forward compatibility (MINOR bumps)

Specs with a lower MINOR version are **always valid** against a higher MINOR version. The framework ignores unknown fields and supplies defaults for new optional fields.

```typescript
function isForwardCompatible(specVersion: string, currentVersion: string): boolean {
  const [specMajor] = specVersion.split('.').map(Number)
  const [currentMajor] = currentVersion.split('.').map(Number)
  return specMajor === currentMajor  // Same major = compatible
}
```

#### Migration pipeline (MAJOR bumps)

When the MAJOR version changes, the framework includes migration functions:

```typescript
const migrations: Record<string, (spec: unknown) => UISpecification> = {
  '1->2': (oldSpec) => ({
    ...oldSpec,
    specVersion: '2.0',
    // Rename slot → position
    components: oldSpec.components.map(c => ({
      ...c,
      position: c.slot,  // Renamed field
      slot: undefined,
    })),
  }),
}
```

#### Cache key integration

From ADR-003, the cache key includes `specVersion`:

```typescript
type CacheKey = {
  intentHash: string
  contextHash: string
  registryVersion: string
  specVersion: string      // ← Ensures cache invalidation on MAJOR version change
}
```

On a MAJOR version bump, all cached specs have a different `specVersion` in their key → automatic cache miss → fresh generation with the new schema. No explicit flush needed.

On a MINOR version bump, cached specs remain valid (forward compatible) → no cache disruption.

#### Validation integration

The schema validator (first in the Validation Pipeline) checks `specVersion`:

```typescript
const schemaValidator: Validator = {
  name: 'schema-validator',
  validate(spec) {
    if (!spec.specVersion) {
      return { status: 'fail', violations: [{ rule: 'SCHEMA-VERSION', message: 'Missing specVersion' }] }
    }

    if (!isForwardCompatible(spec.specVersion, CURRENT_SPEC_VERSION)) {
      // Try migration
      const migrated = tryMigrate(spec)
      if (migrated) {
        return { status: 'pass', violations: [], migratedSpec: migrated }
      }
      return { status: 'fail', violations: [{ rule: 'SCHEMA-COMPAT', message: `Spec version ${spec.specVersion} incompatible with current ${CURRENT_SPEC_VERSION}` }] }
    }

    return validateStructure(spec)  // Zod schema validation
  }
}
```

#### Current version for Phase 1

```typescript
export const CURRENT_SPEC_VERSION = '1.0'
```

### Consequences

- **Positive:** Framework updates don't silently break cached or serialized specs.
- **Positive:** MINOR bumps are non-disruptive — no cache flush, no breaking changes.
- **Positive:** MAJOR bumps auto-invalidate cache via key mismatch — clean, no manual intervention.
- **Positive:** Migration functions enable gradual schema evolution without losing all cached specs.
- **Negative:** Migration functions must be maintained and tested for each MAJOR bump.
- **Negative:** The LLM must be instructed to include `specVersion` in generated output. Added to the prompt template.
- **Low risk:** Version 1.0 for Phase 1 means no migration complexity during initial development. Migrations only matter from Phase 2 onward.

---

## ADR-018: Bundle Size Strategy

**Status:** Decided

### Context

Flui is a multi-package framework:

- `@flui/core` — Intent, Context, Registry, Orchestrator, Validation, Cache, Observability
- `@flui/react`, `@flui/vue`, `@flui/angular` — Framework adapters
- `@flui/openai`, `@flui/anthropic`, `@flui/ollama` — LLM connectors
- `@flui/testing`, `@flui/devtools` — Dev tools

ADR-015 defines bundle size budgets (core < 25KB, adapter < 8KB). Without a deliberate strategy, the core could easily bloat beyond these targets as features accumulate.

### Decision

**Modular architecture with tree-shakeable exports, lazy loading for optional modules, and a strict dependency policy.**

#### Package structure

```
@flui/core
├── intent/        → Intent Parser (~3KB)
├── context/       → Context Engine (~4KB)
├── registry/      → Component Registry (~2KB)
├── generation/    → Generation Orchestrator (~5KB)
├── validation/    → Validation Pipeline (~3KB)
├── cache/         → Cache Manager (~3KB)
├── observe/       → Observability Collector (~2KB)
├── policy/        → GenerationPolicy + CostBudget (~2KB)
└── index.ts       → Re-exports (tree-shakeable)
```

Every submodule is independently importable:

```typescript
// Full import (tree-shaker removes unused)
import { createFlui, LiquidView } from '@flui/core'

// Direct submodule import (guaranteed minimal)
import { createRegistry } from '@flui/core/registry'
import { defineValidator } from '@flui/core/validation'
```

#### Tree-shaking requirements

- **No side effects in module scope.** All modules are marked `"sideEffects": false` in package.json.
- **No barrel re-exports of large objects.** Each submodule exports only what it owns.
- **No class-based architecture** for core modules. Functions and interfaces are more tree-shakeable than classes.
- **Conditional exports** for environment-specific code (browser vs. Node.js):

```json
{
  "exports": {
    ".": {
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js",
      "types": "./dist/types/index.d.ts"
    },
    "./server": {
      "import": "./dist/esm/server/index.js",
      "types": "./dist/types/server/index.d.ts"
    }
  }
}
```

#### Dependency policy

| Category | Rule |
|----------|------|
| **Core runtime dependencies** | Zero external dependencies except Zod (~13KB). All other functionality is implemented inline. |
| **Zod** | Required for runtime validation (ADR-013). If bundle size is critical, provide a `SchemaValidator` interface that accepts any validation library. |
| **Optional dependencies** | Declared as `peerDependencies` with `optional: true`. E.g., `@flui/devtools` depends on React DevTools extension API. |
| **Dev dependencies** | No restrictions — dev deps don't affect production bundle. |
| **No lodash, no moment, no large utility libs.** | Implement needed utilities inline. Modern JS/TS covers 95% of use cases. |

#### Lazy loading for optional features

Features that not every app uses are loaded lazily:

```typescript
// Compliance validator — loaded only when configured
const complianceValidator = await import('@flui/compliance')

// DevTools — loaded only in development
if (process.env.NODE_ENV === 'development') {
  const devtools = await import('@flui/devtools')
  devtools.connect(fluiInstance)
}
```

#### Build output

```
dist/
├── esm/           → ES Modules (tree-shakeable, primary)
├── cjs/           → CommonJS (for legacy bundlers / Node.js require())
└── types/         → TypeScript declarations
```

No UMD build. Modern bundlers handle ESM natively.

#### Size monitoring in CI

```bash
# In CI pipeline
npx size-limit --config .size-limit.json

# .size-limit.json
[
  { "path": "dist/esm/index.js", "limit": "25 KB", "gzip": true },
  { "path": "dist/esm/intent/index.js", "limit": "3 KB", "gzip": true },
  { "path": "dist/esm/cache/index.js", "limit": "3 KB", "gzip": true }
]
```

Every PR that increases bundle size beyond the budget fails CI.

### Consequences

- **Positive:** Developers importing only `LiquidView` + `FluiProvider` get a minimal bundle. Unused validators, context providers, and observability modules are tree-shaken.
- **Positive:** Zero external dependencies (beyond Zod) eliminates supply chain risk and version conflicts.
- **Positive:** CI size monitoring prevents accidental bloat.
- **Negative:** "No external dependencies" means implementing some utilities from scratch (e.g., hashing, debouncing). This is a small ongoing cost.
- **Negative:** The `SchemaValidator` abstraction (for replacing Zod) adds interface complexity. Recommended to defer this to Phase 2 unless bundle size becomes critical.
- **Interaction with ADR-013:** Zod is the single largest dependency (~13KB). If the core target (25KB) proves tight, Zod is the first candidate for lazy loading or replacement.
- **Interaction with ADR-015:** Size monitoring enforces the budgets defined in ADR-015.

---

## ADR-019: Developer Debug Mode

**Status:** Decided

### Context

The vision document describes `@flui/devtools` as a browser extension showing a timeline of generation events with replay capability. But during active development, a developer needs more immediate, in-context debugging:

- "Why did this LiquidView show a DataTable instead of a Chart?"
- "What prompt was sent to the LLM?"
- "What would happen if I changed the user's role to analyst?"
- "Let me manually force this layout while I work on styling."

The DevTools extension is a separate tool. The developer needs **inline** debugging within the LiquidView itself.

### Decision

**A `debug` prop on LiquidView that activates an inline debug overlay, plus a `useFluidDebug` hook for programmatic control.**

#### Debug overlay

```tsx
// Activate debug mode per view
<LiquidView
  intent="Show dashboard"
  fallback={<StaticDashboard />}
  debug   // ← Enables inline debug overlay
/>

// Or globally via provider
<FluiProvider debug>
```

When `debug` is active, the LiquidView renders a collapsible overlay panel with tabs:

```
┌─── LiquidView Debug ──────────────────────────────── [▼ Collapse] ──┐
│                                                                      │
│  [Spec] [Prompt] [Context] [Trace] [What-If]                       │
│                                                                      │
│  ┌── Spec ──────────────────────────────────────────────────────┐   │
│  │ {                                                            │   │
│  │   "specVersion": "1.0",                                     │   │
│  │   "layout": { "type": "grid", "columns": 2 },              │   │
│  │   "components": [                                            │   │
│  │     { "id": "kpi-1", "type": "KPICard", ... },             │   │
│  │     { "id": "chart-1", "type": "SalesChart", ... }         │   │
│  │   ],                                                         │   │
│  │   "interactions": [...]                                      │   │
│  │ }                                                            │   │
│  │                                                              │   │
│  │ [Edit Spec] [Copy] [Regenerate] [Pin This Spec]             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

#### Tab descriptions

| Tab | Content | Developer Action |
|-----|---------|-----------------|
| **Spec** | The current generated `UISpecification` as formatted JSON | Edit inline, copy, pin, regenerate |
| **Prompt** | The full prompt sent to the LLM (system + user) | Inspect, copy to clipboard for testing in LLM playground |
| **Context** | Current context snapshot with all signals | See exactly what context was used for this generation |
| **Trace** | The `GenerationTrace` with timing, cache status, validation results, cost | Performance debugging, identifying bottlenecks |
| **What-If** | Context signal overrides for experimentation | Change role, device, expertise → see how UI would adapt |

#### Pin mechanism

"Pinning" a spec locks the LiquidView to a specific specification, preventing re-generation:

```typescript
// Programmatic pin
const { pin, unpin, isPinned } = useLiquidDebug('dashboard-view')

// Pin the current spec (useful while styling/testing)
pin()

// Pin a specific spec (useful for reproducing issues)
pin(specificSpec)

// Unpin — resume normal generation
unpin()
```

When pinned:
- Context changes do NOT trigger re-generation.
- The pinned spec renders as-is.
- A visible badge "[PINNED]" appears on the overlay.
- The developer can still use "What-If" to preview (without committing) how the UI would change.

#### Edit Spec

Clicking "Edit Spec" makes the JSON editable. Changes are applied immediately to the rendered UI (no LLM call, no validation — raw override). This allows developers to:

- Test component layouts without waiting for LLM re-generation.
- Debug specific prop combinations.
- Iterate on the component registry by seeing how different props render.

Edited specs are highlighted with a "[MODIFIED]" badge. "Regenerate" restores LLM-generated behavior.

#### What-If mode

The "What-If" tab shows all current context signals as editable fields:

```
┌── What-If ──────────────────────────────────────────────────┐
│                                                              │
│  identity.role:        [executive ▼]  → Try: [analyst    ]  │
│  environment.device:   [desktop   ▼]  → Try: [mobile     ]  │
│  expertise.level:      [high      ▼]  → Try: [novice     ]  │
│  cognitive.inferredLoad: [low     ▼]  → Try: [high       ]  │
│                                                              │
│  [Preview What-If]  [Apply & Regenerate]                     │
│                                                              │
│  Preview result:                                             │
│  "With analyst+mobile+novice: 2 components (SimpleKPI,      │
│   GuidedChart) in stack layout"                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

"Preview" generates a spec with the overridden context and shows the component summary without rendering. "Apply & Regenerate" renders the What-If result.

#### Production safety

```typescript
// Debug mode is stripped in production builds (tree-shaken)
if (process.env.NODE_ENV === 'production') {
  // debug prop is ignored
  // useFluidDebug returns no-op functions
  // Debug overlay code is not included in bundle
}
```

The debug overlay, edit functionality, and What-If mode add ~15KB to the development bundle but zero to production.

### Consequences

- **Positive:** Developers can debug generation decisions in-context without switching tools.
- **Positive:** Pin mechanism enables stable development (style a generated layout without it changing).
- **Positive:** What-If mode lets developers test context-driven adaptation without simulating real users.
- **Positive:** Edit Spec enables rapid iteration without LLM round-trips.
- **Positive:** Zero production bundle impact — all debug code is tree-shaken.
- **Negative:** The debug overlay adds visual complexity in development mode. Collapsible by default to minimize distraction.
- **Negative:** Edit Spec bypasses validation — developers could render invalid specs during debugging. Acceptable for dev mode; production is always validated.
- **Phase 1 scope:** Implement the Spec tab (view + copy + pin) and Trace tab. What-If and Edit Spec in Phase 2.

---

## ADR-020: Offline Strategy for Phase 1

**Status:** Decided

### Context

The vision document lists `@flui/offline` as a Phase 4 feature ("Offline-first generation with local models"). But Flui's mandatory fallback mechanism already provides a form of offline behavior. The offline story needs explicit documentation to avoid confusion.

Questions:

- What happens when the user goes offline?
- What's the degradation path?
- How do cached specs factor in?
- What's the difference between Phase 1 offline and Phase 4 `@flui/offline`?

### Decision

**Phase 1 offline = three-tier graceful degradation: cached specs → fallback → explicit offline UI. `@flui/offline` (Phase 4) adds on-device LLM generation.**

#### Degradation tiers

```
User goes offline (or LLM provider unreachable)
        │
        ▼
Tier 1: CACHED SPEC
  Does a cached spec exist for this intent + context?
  (Check L1 → L2 → L3 cache from ADR-003)
  ├── YES → Render cached spec normally
  │         (user may not even notice they're offline)
  │         Badge: subtle offline indicator in DevTools only
  └── NO ──▼

Tier 2: STALE CACHED SPEC
  Does a cached spec exist for this intent with DIFFERENT context?
  (Fuzzy cache match — same intent, different role/device/etc.)
  ├── YES → Render stale spec with "[approximate view]" indicator
  │         (better than nothing — layout is similar)
  └── NO ──▼

Tier 3: FALLBACK
  Render the mandatory fallback component
  └── This is the developer-provided static UI
      It always works, by design (Flui's Principle 3)
```

#### Connectivity detection

```typescript
interface ConnectivityProvider {
  /** Current connectivity status */
  status: 'online' | 'offline' | 'degraded'
  /** Subscribe to status changes */
  onChange: (callback: (status: ConnectivityStatus) => void) => Unsubscribe
}

// Default implementation uses navigator.onLine + fetch probe
const defaultConnectivity: ConnectivityProvider = {
  get status() {
    if (!navigator.onLine) return 'offline'
    // Optionally: probe the LLM endpoint
    return 'online'
  },
  onChange(callback) {
    window.addEventListener('online', () => callback('online'))
    window.addEventListener('offline', () => callback('offline'))
    return () => { /* cleanup */ }
  }
}
```

The Context Engine includes connectivity as a context signal (already in the vision: `environment.connectivity`). When connectivity is `'offline'`:

- The Generation Orchestrator skips LLM calls entirely (no timeout waiting).
- Cache lookup proceeds normally.
- Fallback is rendered immediately if no cache hit.

#### Transition back to online

When connectivity is restored:

```
Connectivity restored
        │
        ▼
For each LiquidView currently showing cached/stale/fallback:
  ├── If showing Tier 1 (cached, not expired) → No action (spec is still valid)
  ├── If showing Tier 2 (stale) → Trigger re-generation (restore accurate UI)
  └── If showing Tier 3 (fallback) → Trigger generation (replace fallback with liquid UI)
```

Re-generation respects the debounce policy (ADR-004) to avoid a burst of LLM calls when connectivity returns.

#### Offline indicators

```typescript
interface OfflineConfig {
  /** Show a visual indicator when serving cached/stale/fallback due to offline. Default: false */
  showOfflineIndicator: boolean
  /** Custom offline indicator component */
  offlineIndicator?: ComponentType<{ tier: 'cached' | 'stale' | 'fallback' }>
}
```

By default, no visible indicator — the UI looks the same whether online or offline (cached specs are indistinguishable from fresh ones). Developers can opt into indicators for transparency.

#### Phase 1 vs Phase 4 distinction

| Aspect | Phase 1 (this ADR) | Phase 4 (`@flui/offline`) |
|--------|--------------------|-----------------------------|
| **When offline** | Serve cached specs or fallback | Generate NEW specs using on-device LLM (Ollama, WebLLM, ONNX) |
| **New intents offline** | Cannot generate → fallback | Can generate locally (lower quality but functional) |
| **Requires** | Nothing extra (cache + fallback are core) | On-device model download, local inference runtime |
| **User experience** | Graceful degradation | Near-full functionality offline |

### Consequences

- **Positive:** Phase 1 offline is automatic — the cache (ADR-003) and mandatory fallback (vision Principle 3) already provide offline behavior. No additional code required.
- **Positive:** The three-tier degradation is transparent — users on good connections with warm caches may never see the difference.
- **Positive:** Clear separation between "Phase 1 offline" (degradation) and "Phase 4 offline" (local generation) prevents scope creep.
- **Negative:** Tier 2 (stale spec with different context) may show a suboptimal layout. Acceptable as a degraded experience.
- **Negative:** No offline capability for NEW intents the user has never triggered before. This is the fundamental limitation until Phase 4.
- **Interaction with ADR-003:** The L3 persistent cache (IndexedDB) is the key enabler for offline. Common intents cached persistently survive page reloads, app restarts, and connectivity drops.
- **Interaction with ADR-004:** Re-generation on connectivity restoration uses the standard trigger/debounce mechanism.
- **Interaction with ADR-011:** Circuit breaker detects LLM provider unreachability and immediately switches to cache/fallback — no timeout waiting.

---

*End of Batch 3 — Important ADRs*

---

## Summary: All 20 ADRs

| # | Title | Status | Batch |
|---|-------|--------|-------|
| 001 | State Management Inside Generated UIs | Decided | Critical |
| 002 | Data Resolution and Binding | Decided | Critical |
| 003 | Caching as a Core Module | Decided | Critical |
| 004 | Re-generation Strategy and Triggers | Decided | Critical |
| 005 | Concurrency and Generation Request Lifecycle | Decided | Critical |
| 006 | Cost Control and Budgeting | Decided | Critical |
| 007 | Prompt Size Management | Decided | Critical |
| 008 | Inter-component Communication | Decided | High |
| 009 | Generation Latency UX | Decided | High |
| 010 | Testing Strategy for Non-deterministic Output | Decided | High |
| 011 | Error Recovery and Circuit Breaker | Decided | High |
| 012 | Multi-LiquidView Coordination | Decided | High |
| 013 | Runtime Type Safety | Decided | High |
| 014 | Accessibility During Dynamic Re-generation | Decided | High |
| 015 | Performance Budgets | Decided | Important |
| 016 | Server-Side Generation Architecture | Decided | Important |
| 017 | Spec Versioning and Migration | Decided | Important |
| 018 | Bundle Size Strategy | Decided | Important |
| 019 | Developer Debug Mode | Decided | Important |
| 020 | Offline Strategy for Phase 1 | Decided | Important |

### Cross-cutting interaction map

```
PERFORMANCE & COST STACK:
  ADR-003 (Cache) ← ADR-004 (Triggers) ← ADR-005 (Concurrency)
       ↕                                        ↕
  ADR-006 (Cost) ← ADR-007 (Prompt Size) ← ADR-015 (Budgets)
       ↕
  ADR-012 (Multi-View) ← ADR-018 (Bundle Size)

RUNTIME LIFECYCLE:
  ADR-001 (ViewState) → ADR-008 (Interactions) → ADR-009 (Transitions)
       ↕                                               ↕
  ADR-002 (Data Binding) → ADR-013 (Type Safety) → ADR-014 (A11y)
       ↕
  ADR-011 (Error Recovery) → ADR-020 (Offline)

EVOLUTION & DX:
  ADR-017 (Versioning) ← ADR-003 (Cache invalidation)
  ADR-016 (SSR) ← ADR-003 (Cache hydration)
  ADR-019 (Debug) ← ADR-009 (Transitions) + ADR-001 (ViewState)
  ADR-010 (Testing) ← ADR-013 (Type Safety) + ADR-011 (Error Recovery)
```
