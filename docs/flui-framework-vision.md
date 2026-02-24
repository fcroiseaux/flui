# Flui — The Liquid UI Framework

## A next-generation, LLM-native frontend framework for intent-driven interfaces

> *React and Vue solved data reactivity in the UI.*
> *Flui solves intent reactivity — the UI reacts not only to data, but to context, intention, and intelligence.*

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Problem](#2-the-problem)
3. [The Thesis](#3-the-thesis)
4. [Design Principles](#4-design-principles)
5. [Architecture](#5-architecture)
6. [Core Modules](#6-core-modules)
7. [Developer Experience](#7-developer-experience)
8. [Differentiation](#8-differentiation)
9. [Plugin Ecosystem](#9-plugin-ecosystem)
10. [Protocol Compatibility](#10-protocol-compatibility)
11. [Security Model](#11-security-model)
12. [Roadmap](#12-roadmap)
13. [Business Model](#13-business-model)
14. [FAQ](#14-faq)

---

## 1. Executive Summary

**Flui** (Fluid UI) is an open-source, framework-agnostic, LLM-native frontend framework that enables developers to build **liquid interfaces** — user interfaces that generate and adapt themselves in real-time based on user intent, context, and constraints.

Flui does not replace React, Vue, or Angular. It **augments** them with a new capability layer: the ability to generate, compose, and validate UI dynamically using any LLM, while maintaining full control, security, and observability.

### Key characteristics

- **Intent-first**: The UI is driven by what the user wants to accomplish, not by pre-defined screens.
- **Context-aware**: The interface adapts to the user's role, expertise level, cognitive load, device, and workflow phase.
- **Constraint-driven**: Every generated UI is validated against formal rules (accessibility, compliance, brand, security) before rendering.
- **Progressive**: Developers can make a single component liquid while keeping the rest of their app unchanged.
- **LLM-agnostic**: Works with any LLM provider — OpenAI, Anthropic, Mistral, Ollama, or any custom/sovereign model.
- **Observable**: Every generation decision is traced, replayable, and auditable.
- **Secure by design**: The LLM never generates executable code — only declarative specifications validated before render.

### What Flui is NOT

- **Not a replacement for React/Vue/Angular.** Flui uses them as rendering targets.
- **Not a chatbot framework.** Liquid interfaces go far beyond conversational UI.
- **Not tied to any specific LLM.** Provider-agnostic by design.
- **Not tied to any specific platform.** Independent open-source project.
- **Not an AI wrapper.** Flui's value is in the Context Engine, validation pipeline, and observability — not in calling an API.

---

## 2. The Problem

### 2.1 The paradigm gap

Every major frontend framework — React (2013), Vue (2014), Angular (2016), Svelte (2019), Solid (2021) — operates on the same fundamental paradigm:

```
state → render(state) → DOM
```

The developer **declares** the UI structure. The framework makes it **reactive** to state changes. This was revolutionary in 2013. But the paradigm assumes that the developer knows, at build time, every possible screen, layout, and interaction the user will need.

In the age of LLMs and intelligent agents, this assumption breaks. Users don't want to navigate pre-built screens — they want to express an intent and get the right interface for their task, right now, adapted to who they are.

### 2.2 The existing ecosystem is incomplete

The ecosystem has started to respond to this shift:

| Layer | What exists | What's missing |
|-------|------------|----------------|
| **Protocols** | AG-UI (CopilotKit), A2UI (Google) | Unified developer experience on top |
| **Chat UI** | CopilotKit, Vercel AI SDK | Beyond-chat liquid interfaces |
| **In-browser GenUI** | Hashbrown | Context awareness, validation, observability |
| **LLM-first frameworks** | Revolt (experimental) | Production-readiness, ecosystem |
| **Compliance** | Nothing | Everything |
| **Observability** | Nothing specific to GenUI | Intent logging, decision tracing, replay |
| **Context Engine** | Nothing | Understanding who the user is and what they need |

The gap is clear: **everyone is solving "how to get LLM output into the DOM"** — nobody is solving **"how to make the right generation decisions, validate them, and keep them observable."**

Flui fills this gap.

### 2.3 Why now

Three converging factors make 2025 the right moment:

1. **Protocols are stabilizing.** AG-UI and A2UI provide the plumbing. Flui can build on them rather than reinventing transport layers.
2. **LLMs are good enough.** Structured output, function calling, and streaming are reliable enough for production UI generation.
3. **The market is asking.** Enterprises, especially in regulated sectors, want adaptive interfaces but need guarantees that chatbot-first approaches cannot provide.

---

## 3. The Thesis

### 3.1 A new paradigm

Flui introduces a new rendering paradigm:

```
(intent, context, constraints) → generate → validate → render
```

| Classic paradigm | Flui paradigm |
|-----------------|---------------|
| Developer defines UI at build time | Developer defines **capabilities** and **rules** |
| State drives rendering | **Intent + context** drive generation |
| UI is reactive to data | UI is reactive to **meaning** |
| Same screen for all users | **Adapted** screen for each user/situation |
| Test: does the component render correctly? | Test: does the generation produce **valid, relevant** UI? |

### 3.2 The three pillars

Flui is built on three pillars that distinguish it from everything else:

#### Pillar 1 — The Context Engine

The Context Engine is the brain of Flui. It collects, interprets, and provides signals about the user and their situation:

```
Context = {
  identity:    { role, permissions, team, preferences }
  expertise:   { level, frequency, errorPatterns }
  cognitive:   { inferredLoad, sessionDuration, recentErrors }
  environment: { device, screenSize, connectivity, time, locale }
  workflow:    { currentPhase, relatedTasks, recentActions }
  data:        { availableDataSets, dataClassification, freshness }
}
```

No existing framework provides this. Every GenUI tool today receives a prompt and returns UI — blind to who is asking and why.

#### Pillar 2 — The Validation Pipeline

Every generated UI specification passes through a pipeline of validators before it reaches the DOM:

```
LLM Output → Schema Validation → Constraint Check → A11y Check
           → Compliance Check (optional) → Brand Check → Render
```

If any validator fails, the pipeline either:
- **Self-corrects** (re-prompts the LLM with the violation),
- **Degrades gracefully** (renders the developer-provided fallback),
- **Blocks** (for hard compliance constraints).

This is what makes Flui production-ready. A generated UI that violates WCAG never reaches the user. A generated UI that exposes confidential data to an unauthorized role never renders.

#### Pillar 3 — Observability

Every generation decision is logged as a structured event:

```json
{
  "timestamp": "2025-06-15T14:23:01Z",
  "intent": "Show team performance for this month",
  "context": { "role": "executive", "device": "mobile", "expertise": "high" },
  "componentsAvailable": ["SalesChart", "KPICard", "TeamTable", "AlertBanner"],
  "componentsSelected": ["KPICard", "SalesChart"],
  "reason": "Mobile + executive → max 3 components, prefer visual",
  "validationResult": "PASS",
  "renderTime": 340,
  "llmLatency": 280,
  "fallbackUsed": false
}
```

This enables:
- **Debugging**: "Why did user X see this layout?"
- **Replay**: "Show me exactly what this user saw at 14:23."
- **Audit**: "Prove that no unauthorized data was displayed."
- **Optimization**: "Which intents cause the most fallbacks?"

---

## 4. Design Principles

### Principle 1 — Progressive Enhancement

Flui can be added to an existing React/Vue/Angular application **one component at a time**. There is no big-bang migration. A developer can wrap a single `<div>` in a `<LiquidView>` and the rest of the app remains unchanged.

This is how Vue.js won adoption against React in 2015 — by being incrementally adoptable. Flui follows the same playbook.

### Principle 2 — LLM-Agnostic

The core framework has zero knowledge of which LLM is being used. All LLM interaction goes through a **Connector** interface:

```typescript
interface LLMConnector {
  generate(spec: GenerationRequest): AsyncIterable<GenerationChunk>
  supports: { streaming: boolean, structuredOutput: boolean, functionCalling: boolean }
}
```

Swapping from OpenAI to Anthropic to Ollama to a sovereign model is a one-line configuration change. This is critical for:
- **No vendor lock-in** for adopters.
- **Sovereign deployment** for regulated environments.
- **Local/on-device inference** for privacy-sensitive applications.

### Principle 3 — Graceful Degradation is Mandatory

Every `<LiquidView>` requires a `fallback` prop. This is enforced at the type level — the code won't compile without it.

```tsx
// ✅ Valid — fallback provided
<LiquidView intent="..." fallback={<StaticDashboard />} />

// ❌ Type error — no fallback
<LiquidView intent="..." />
```

The fallback is rendered when:
- The LLM is unavailable or too slow (configurable timeout).
- The generated UI fails validation.
- The user has disabled AI features.
- The application is in offline mode.

This guarantees that **Flui-powered applications always work**, even without an LLM. The liquid UI is an enhancement, not a dependency.

### Principle 4 — Security by Design (Declarative, Never Executable)

The LLM **never generates code**. It generates a **declarative specification**:

```json
{
  "layout": "grid-2col",
  "components": [
    { "type": "KPICard", "props": { "metric": "revenue", "period": "month" } },
    { "type": "SalesChart", "props": { "data": "team-sales", "chartType": "bar" } }
  ]
}
```

This specification is:
1. **Validated** against the registered component catalog (unknown components are rejected).
2. **Checked** against constraints (compliance, a11y, brand).
3. **Rendered** by mapping each entry to a real, developer-authored component.

The LLM cannot inject scripts, create arbitrary DOM elements, or access APIs not explicitly exposed. The attack surface is equivalent to a JSON schema validator.

### Principle 5 — Observable by Default

Observability is not an add-on — it's built into the core pipeline. Every generation produces a trace. Developers can opt out of storage, but the instrumentation is always there.

This makes Flui the **only GenUI framework that can answer "why did the user see this?"** — a requirement in regulated industries and a massive debugging advantage everywhere else.

---

## 5. Architecture

### 5.1 High-level architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      YOUR APPLICATION                        │
│                 (React, Vue, Angular, Svelte...)             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌───────────── @flui/core ─────────────────────────────┐  │
│   │                                                       │  │
│   │  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐  │  │
│   │  │   Intent     │ │   Context    │ │  Component   │  │  │
│   │  │   Parser     │ │   Engine     │ │  Registry    │  │  │
│   │  │              │ │              │ │              │  │  │
│   │  │ Understands  │ │ Collects &   │ │ Catalog of   │  │  │
│   │  │ what the     │ │ interprets   │ │ available    │  │  │
│   │  │ user wants   │ │ user signals │ │ components   │  │  │
│   │  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘  │  │
│   │         │                │                │          │  │
│   │         └────────────────┼────────────────┘          │  │
│   │                          ▼                           │  │
│   │               ┌──────────────────┐                   │  │
│   │               │   Generation     │                   │  │
│   │               │   Orchestrator   │                   │  │
│   │               │                  │                   │  │
│   │               │  Builds prompt,  │                   │  │
│   │               │  calls LLM,     │                   │  │
│   │               │  parses output   │                   │  │
│   │               └────────┬─────────┘                   │  │
│   │                        ▼                             │  │
│   │               ┌──────────────────┐                   │  │
│   │               │   Validation     │                   │  │
│   │               │   Pipeline       │                   │  │
│   │               │                  │                   │  │
│   │               │  Schema → Rules  │                   │  │
│   │               │  → A11y → Brand  │                   │  │
│   │               │  → Compliance    │                   │  │
│   │               └────────┬─────────┘                   │  │
│   │                        ▼                             │  │
│   │               ┌──────────────────┐                   │  │
│   │               │  Observability   │                   │  │
│   │               │  Collector       │                   │  │
│   │               │                  │                   │  │
│   │               │  Traces every    │                   │  │
│   │               │  decision        │                   │  │
│   │               └──────────────────┘                   │  │
│   │                                                       │  │
│   └───────────────────────────────────────────────────────┘  │
│                              │                               │
│   ┌──── Rendering Adapters ──┼────────────────────────────┐  │
│   │                          │                            │  │
│   │   @flui/react      @flui/vue       @flui/angular     │  │
│   │   @flui/svelte     @flui/solid     @flui/web         │  │
│   │                                                       │  │
│   └───────────────────────────────────────────────────────┘  │
│                              │                               │
│   ┌──── LLM Connectors ─────┼────────────────────────────┐  │
│   │                          │                            │  │
│   │   @flui/openai     @flui/anthropic  @flui/mistral    │  │
│   │   @flui/ollama     @flui/local      @flui/custom     │  │
│   │                                                       │  │
│   └───────────────────────────────────────────────────────┘  │
│                              │                               │
│   ┌──── Protocol Adapters ───┼────────────────────────────┐  │
│   │                          │                            │  │
│   │   @flui/ag-ui      @flui/a2ui       @flui/mcp        │  │
│   │                                                       │  │
│   └───────────────────────────────────────────────────────┘  │
│                              │                               │
│   ┌──── Plugins (optional) ──┼────────────────────────────┐  │
│   │                          │                            │  │
│   │   @flui/compliance       @flui/analytics              │  │
│   │   @flui/a11y-enhanced    @flui/i18n                   │  │
│   │   @flui/devtools         @flui/testing                │  │
│   │                                                       │  │
│   └───────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Data flow

```
User Action / Intent
        │
        ▼
┌─────────────────┐
│  Intent Parser   │──── "Show me Q3 performance by region"
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Context Engine  │──── { role: "CFO", device: "tablet", expertise: "high",
└────────┬────────┘       workflow: "quarterly-review", cognitive: "normal" }
         │
         ▼
┌─────────────────┐
│  Component       │──── Available: [RegionalChart, KPIGrid, DataTable,
│  Registry        │     CommentThread, AlertBanner, ExportButton]
└────────┬────────┘
         │
         ▼
┌──────────────────┐
│  Generation      │──── Prompt = intent + context + component catalog + rules
│  Orchestrator    │     → LLM call → Structured UI specification
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌─────────────────────────────────────┐
│  Validation      │────▶│  PASS: render generated UI          │
│  Pipeline        │     │  SOFT FAIL: retry with corrections  │
└────────┬─────────┘     │  HARD FAIL: render fallback         │
         │               └─────────────────────────────────────┘
         ▼
┌──────────────────┐
│  Observability   │──── Log: intent, context, selection, validation, timing
│  Collector       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Renderer        │──── Maps spec to real React/Vue/Angular components
│  (Adapter)       │     → DOM update
└──────────────────┘
```

---

## 6. Core Modules

### 6.1 Intent Parser (`@flui/core/intent`)

The Intent Parser normalizes and structures user intent from various sources:

```typescript
interface IntentSource {
  type: 'explicit'        // User typed or spoke a request
      | 'implicit'        // Inferred from navigation/action
      | 'predictive'      // Anticipated from context patterns
      | 'programmatic'    // Set by the developer in code
}

interface ParsedIntent {
  raw: string                          // Original input
  action: string                       // Normalized action verb
  entities: Record<string, unknown>    // Extracted entities
  confidence: number                   // 0-1 confidence score
  source: IntentSource
}
```

Intent can come from:
- **Explicit input**: The user types "Show me this month's sales by region."
- **Implicit signals**: The user navigates to `/reports/q3` — the intent is inferred.
- **Predictive**: It's Monday morning, the user always reviews KPIs first — the intent is anticipated.
- **Programmatic**: The developer sets `intent="Invoice list with bulk actions"` in JSX.

The parser uses the LLM for explicit/complex intents and rule-based logic for implicit/programmatic intents (no LLM call needed for simple cases).

### 6.2 Context Engine (`@flui/core/context`)

The Context Engine is a reactive store of signals about the user and their environment. It's the most novel component in Flui and the primary source of differentiation.

```typescript
interface ContextEngine {
  // Identity context (from auth / user profile)
  identity: {
    role: string
    permissions: string[]
    team: string
    preferences: UserPreferences
    locale: string
  }

  // Expertise context (learned over time)
  expertise: {
    level: 'novice' | 'intermediate' | 'expert'
    frequencyScore: number           // How often they use this feature
    featureDiscovery: string[]       // Features they've used
    errorRate: number                // Recent error frequency
  }

  // Cognitive context (inferred in real-time)
  cognitive: {
    inferredLoad: 'low' | 'medium' | 'high'
    sessionDuration: number          // Minutes in current session
    recentErrorCount: number         // Errors in last 5 minutes
    interactionSpeed: 'fast' | 'normal' | 'slow'  // Typing/clicking pace
  }

  // Environment context (detected)
  environment: {
    device: 'desktop' | 'tablet' | 'mobile' | 'spatial'
    screenSize: { width: number, height: number }
    connectivity: 'fast' | 'slow' | 'offline'
    time: Date
    darkMode: boolean
  }

  // Workflow context (from application state)
  workflow: {
    currentPhase: string             // e.g., "planning", "reviewing", "executing"
    relatedTasks: string[]
    recentActions: Action[]
    pendingItems: number
  }

  // Data context (from available data)
  data: {
    availableDataSets: string[]
    classifications: Record<string, 'public' | 'internal' | 'confidential' | 'restricted'>
    freshness: Record<string, Date>
  }
}
```

#### Context providers

The Context Engine uses a provider pattern. Developers register the sources they want:

```typescript
import { createFlui } from '@flui/core'

const flui = createFlui({
  context: {
    providers: [
      identityFromAuth(authService),       // Reads role/permissions from your auth
      expertiseFromUsage(),                 // Learns from interaction patterns
      cognitiveFromBehavior(),              // Infers cognitive load from error/speed patterns
      environmentFromBrowser(),             // Detects device, screen, connectivity
      workflowFromRouter(router),           // Tracks navigation and workflow phase
      dataFromApi(apiClient),               // Knows what data is available and classified
    ]
  }
})
```

Each provider is optional. If you only provide identity context, Flui works with identity context only. The more context you provide, the more adaptive the UI becomes.

#### Custom context providers

Developers can create their own context providers for domain-specific signals:

```typescript
import { defineContextProvider } from '@flui/core'

const traderContextProvider = defineContextProvider({
  name: 'trading-context',
  signals: {
    marketStatus: () => getMarketStatus(),          // 'pre-market' | 'open' | 'closed'
    portfolioRisk: () => calculatePortfolioRisk(),  // 'low' | 'medium' | 'high'
    regulatoryWindow: () => isRegulatoryWindow(),   // boolean
  },
  refreshInterval: 30_000  // Refresh every 30 seconds
})
```

### 6.3 Component Registry (`@flui/core/registry`)

The Component Registry is the catalog of components the LLM can use. Each component is registered with **semantic metadata** that helps the LLM make intelligent selection decisions.

```typescript
import { registerComponent } from '@flui/core'

registerComponent('SalesChart', {
  // The actual component (React, Vue, etc.)
  component: SalesChartComponent,

  // Semantic description (used in LLM prompt)
  description: 'Interactive chart showing sales data over time with drill-down capability',

  // What data/props it accepts
  accepts: {
    data: { type: 'timeseries', required: true },
    period: { type: 'date-range', required: true },
    groupBy: { type: 'enum', values: ['region', 'product', 'team'], required: false },
    chartType: { type: 'enum', values: ['bar', 'line', 'area'], default: 'bar' }
  },

  // When this component is appropriate
  suitableFor: ['analysis', 'reporting', 'executive-review', 'trend-identification'],

  // Complexity hint (helps match to expertise level)
  complexity: 'medium',

  // Minimum screen size
  minWidth: 400,

  // Accessibility features
  a11y: {
    hasAltText: true,
    keyboardNavigable: true,
    screenReaderSupport: 'full'
  },

  // Data classification constraint
  maxDataClassification: 'confidential',

  // Tags for search/grouping
  tags: ['chart', 'visualization', 'sales', 'timeseries']
})
```

#### Component groups

Components can be organized into logical groups:

```typescript
import { defineComponentGroup } from '@flui/core'

defineComponentGroup('financial-reporting', {
  components: ['RevenueChart', 'ExpenseTable', 'KPICard', 'BudgetGauge', 'ForecastLine'],
  description: 'Components for financial reporting and analysis',
  requiredPermissions: ['finance:read']
})
```

### 6.4 Generation Orchestrator (`@flui/core/generation`)

The Generation Orchestrator is responsible for:
1. Building the optimal prompt from intent + context + component catalog + rules.
2. Calling the LLM via the configured connector.
3. Parsing and normalizing the structured output.
4. Managing streaming for progressive rendering.
5. Handling retries and error recovery.

#### Prompt construction

The orchestrator builds a **system prompt** that includes:

```
You are a UI generation engine for the Flui framework.

AVAILABLE COMPONENTS:
{serialized component registry with metadata}

USER CONTEXT:
{serialized context signals}

ACTIVE RULES:
{serialized constraint rules}

LAYOUT OPTIONS:
{available layout patterns}

USER INTENT:
{parsed intent}

Generate a UI specification in the following JSON schema:
{output schema}

CONSTRAINTS:
- Only use components from the AVAILABLE COMPONENTS list.
- Respect all ACTIVE RULES.
- Match component complexity to user expertise level.
- Prefer fewer components on mobile devices.
- Never expose data above the user's classification clearance.
```

#### Output schema

The LLM generates a declarative specification:

```typescript
interface UISpecification {
  layout: LayoutSpec
  components: ComponentSpec[]
  interactions?: InteractionSpec[]
  annotations?: AnnotationSpec[]
}

interface LayoutSpec {
  type: 'single' | 'grid' | 'stack' | 'sidebar' | 'tabs' | 'flow'
  columns?: number
  gap?: string
  responsive?: Record<string, LayoutSpec>  // Breakpoint overrides
}

interface ComponentSpec {
  id: string                    // Unique ID for this instance
  type: string                  // Must match a registered component
  props: Record<string, any>    // Props to pass to the component
  slot: string                  // Position in the layout
  priority: number              // Display priority (for progressive loading)
  conditions?: ConditionSpec[]  // Conditional visibility rules
}
```

### 6.5 Validation Pipeline (`@flui/core/validation`)

The validation pipeline is a chain of validators that every generated specification must pass:

```typescript
const defaultPipeline = [
  schemaValidator,        // Is the spec structurally valid?
  componentValidator,     // Do all referenced components exist in the registry?
  propValidator,          // Are all required props provided with correct types?
  layoutValidator,        // Is the layout valid for the target device?
  a11yValidator,          // Does the layout meet accessibility requirements?
  brandValidator,         // Does the spec conform to design system constraints?
  dataValidator,          // Is the user authorized to see all referenced data?
  complianceValidator,    // (optional) Does it meet regulatory requirements?
]
```

Each validator returns:

```typescript
interface ValidationResult {
  status: 'pass' | 'warn' | 'fail'
  violations: Violation[]
  suggestions: Suggestion[]    // For self-correction re-prompting
}
```

The pipeline supports three failure strategies:

| Strategy | Behavior |
|----------|----------|
| `retry` | Re-prompt the LLM with violation details (max N attempts) |
| `fallback` | Render the developer-provided fallback component |
| `block` | Throw an error (for hard compliance constraints) |

#### Custom validators

Developers can add domain-specific validators:

```typescript
import { defineValidator } from '@flui/core'

const financialComplianceValidator = defineValidator({
  name: 'financial-compliance',
  validate(spec, context) {
    const violations = []

    // Check: no P&L data for non-finance roles
    if (context.identity.role !== 'finance' && usesFinancialData(spec)) {
      violations.push({
        severity: 'fail',
        rule: 'CSSF-DATA-001',
        message: 'P&L data requires finance role',
        suggestion: 'Remove financial components or request elevated access'
      })
    }

    // Check: audit trail required for regulatory data
    if (usesRegulatoryData(spec) && !spec.annotations?.auditEnabled) {
      violations.push({
        severity: 'warn',
        rule: 'DORA-AUDIT-003',
        message: 'Regulatory data displayed without audit logging',
        suggestion: 'Enable audit annotation on this view'
      })
    }

    return { status: violations.length ? 'fail' : 'pass', violations, suggestions: [] }
  }
})
```

### 6.6 Observability Collector (`@flui/core/observe`)

Every generation cycle produces a `GenerationTrace`:

```typescript
interface GenerationTrace {
  id: string
  timestamp: Date
  duration: number

  // Inputs
  intent: ParsedIntent
  context: ContextSnapshot
  componentsAvailable: string[]

  // LLM interaction
  llmConnector: string
  llmModel: string
  llmLatency: number
  promptTokens: number
  completionTokens: number
  retryCount: number

  // Outputs
  specification: UISpecification
  componentsSelected: string[]
  layoutChosen: string
  validationResults: ValidationResult[]

  // Outcome
  outcome: 'rendered' | 'fallback' | 'error'
  fallbackReason?: string
  renderTime: number
  userEngagement?: EngagementMetrics  // Did the user interact with the generated UI?
}
```

Traces can be:
- **Logged** to console (development).
- **Sent** to an analytics backend (production).
- **Stored** locally for replay (debugging).
- **Exported** for audit (compliance).

#### DevTools integration

Flui ships with browser devtools (`@flui/devtools`) that show:
- A timeline of all generation events.
- For each event: intent, context, components considered vs. selected, validation results.
- A "replay" button to re-generate with the same inputs.
- A "what-if" mode to change context signals and see how the UI would adapt.

---

## 7. Developer Experience

### 7.1 Getting started (< 5 minutes)

```bash
npm install @flui/core @flui/react @flui/openai
```

```tsx
// app.tsx
import { FluiProvider } from '@flui/react'
import { openai } from '@flui/openai'

function App() {
  return (
    <FluiProvider
      connector={openai({ apiKey: process.env.OPENAI_API_KEY })}
      components={componentRegistry}
    >
      <MyApp />
    </FluiProvider>
  )
}
```

```tsx
// dashboard.tsx
import { LiquidView } from '@flui/react'

function Dashboard() {
  return (
    <LiquidView
      intent="Show me today's key metrics"
      fallback={<StaticDashboard />}
    />
  )
}
```

That's it. Three files. Under 20 lines of meaningful code. The developer has a working liquid interface.

### 7.2 Component registration

```tsx
// components/registry.ts
import { createRegistry } from '@flui/core'
import { KPICard } from './KPICard'
import { SalesChart } from './SalesChart'
import { DataTable } from './DataTable'

export const componentRegistry = createRegistry({
  KPICard: {
    component: KPICard,
    description: 'Displays a single KPI with trend indicator',
    accepts: { metric: 'string', value: 'number', trend: 'up|down|flat' },
    suitableFor: ['overview', 'executive-review'],
    complexity: 'low',
  },
  SalesChart: {
    component: SalesChart,
    description: 'Interactive sales chart with period selection',
    accepts: { data: 'timeseries', period: 'date-range' },
    suitableFor: ['analysis', 'reporting'],
    complexity: 'medium',
  },
  DataTable: {
    component: DataTable,
    description: 'Sortable, filterable data table with export',
    accepts: { data: 'tabular', columns: 'column-config[]' },
    suitableFor: ['detailed-analysis', 'data-exploration'],
    complexity: 'high',
  }
})
```

### 7.3 Adding context

```tsx
// app.tsx — enhanced with context
import { FluiProvider } from '@flui/react'
import { openai } from '@flui/openai'
import { identityFromAuth, expertiseFromUsage, environmentFromBrowser } from '@flui/core/providers'

function App() {
  return (
    <FluiProvider
      connector={openai({ apiKey: process.env.OPENAI_API_KEY })}
      components={componentRegistry}
      context={[
        identityFromAuth(useAuth()),
        expertiseFromUsage(),
        environmentFromBrowser(),
      ]}
    >
      <MyApp />
    </FluiProvider>
  )
}
```

Now the same `<LiquidView intent="Show me today's key metrics">` will:
- Show 3 KPI cards on mobile for an executive.
- Show a detailed data table with charts for an analyst on desktop.
- Show simplified cards with contextual help for a new user.

### 7.4 Adding rules

```tsx
import { defineRules } from '@flui/core'

const rules = defineRules([
  // Simplify for mobile
  {
    when: { environment: { device: 'mobile' } },
    then: { maxComponents: 3, preferSimple: true }
  },
  // Executives get visual-first
  {
    when: { identity: { role: 'executive' } },
    then: { preferVisual: true, hideRawData: true }
  },
  // High cognitive load → simplify
  {
    when: { cognitive: { inferredLoad: 'high' } },
    then: { maxComponents: 2, disableAnimations: true }
  },
  // Confidential data → restricted roles only
  {
    when: { data: { classifications: { contains: 'confidential' } } },
    then: { requirePermission: 'data:confidential', auditLog: true }
  }
])
```

### 7.5 Hybrid mode (the most realistic adoption path)

```tsx
function InvoicePage() {
  return (
    <div>
      {/* Classic — coded as usual */}
      <Header title="Invoices" />
      <SearchBar onSearch={handleSearch} />

      {/* Liquid — adapts to context */}
      <LiquidView
        intent="Show filtered invoices with relevant actions"
        data={{ invoices: filteredInvoices }}
        context={{ urgentCount: overdue.length }}
        fallback={<InvoiceTable data={filteredInvoices} />}
      />

      {/* Classic */}
      <Pagination />
    </div>
  )
}
```

This is the key adoption strategy: developers don't rewrite their app — they **liquify** specific sections. The rest stays exactly as it is.

### 7.6 Using with different LLM providers

```tsx
// OpenAI
import { openai } from '@flui/openai'
const connector = openai({ model: 'gpt-4o' })

// Anthropic
import { anthropic } from '@flui/anthropic'
const connector = anthropic({ model: 'claude-sonnet-4-20250514' })

// Mistral (self-hosted)
import { mistral } from '@flui/mistral'
const connector = mistral({ endpoint: 'https://my-mistral.company.eu/v1' })

// Ollama (local)
import { ollama } from '@flui/ollama'
const connector = ollama({ model: 'llama3', baseUrl: 'http://localhost:11434' })

// Custom / sovereign
import { custom } from '@flui/custom'
const connector = custom({
  endpoint: 'https://my-sovereign-llm.deep.lu/generate',
  headers: { Authorization: `Bearer ${token}` },
  format: 'openai-compatible'  // or 'anthropic-compatible', or custom parser
})
```

One line changes the LLM. The rest of the code stays identical.

---

## 8. Differentiation

### 8.1 Competitive positioning

```
                    High ┌─────────────────────────────────────┐
                         │                                     │
             Context     │              Flui ★                 │
             Awareness   │                                     │
                         │                                     │
                         │                                     │
                    Mid  ├──────────────────────────────────── │
                         │                                     │
                         │   Hashbrown         CopilotKit      │
                         │                                     │
                         │         Vercel AI SDK               │
                    Low  ├─────────────────────────────────────│
                         │                                     │
                         │   A2UI (format)     Revolt (exp.)   │
                         │                                     │
                         └─────────────────────────────────────┘
                        Low          GenUI Maturity          High
```

### 8.2 Feature comparison

| Capability | React | CopilotKit | Hashbrown | Vercel AI SDK | A2UI | **Flui** |
|---|---|---|---|---|---|---|
| Static UI rendering | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| LLM-driven UI generation | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Context Engine | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** |
| Validation pipeline | ❌ | ❌ | ❌ | ❌ | Partial | **✅** |
| Mandatory fallback | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** |
| Observability (native) | ❌ | Basic | ❌ | ❌ | ❌ | **✅** |
| Framework-agnostic core | N/A | ❌ (React) | Partial | ❌ (React) | ✅ | **✅** |
| LLM-agnostic | N/A | ✅ | ✅ | ✅ | ✅ | **✅** |
| Progressive adoption | N/A | Medium | ✅ | ✅ | N/A | **✅** |
| Compliance plugins | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** |
| Design system constitution | ❌ | ❌ | ❌ | ❌ | Catalog | **✅** |
| Decision replay | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** |
| Hybrid (liquid + static) | N/A | Partial | Partial | Partial | N/A | **✅** |

### 8.3 What makes Flui unique

1. **The Context Engine.** Nobody else builds a reactive context-awareness layer. Everyone else just passes prompts to LLMs.

2. **The Validation Pipeline.** Nobody else validates generated UI before rendering. Flui ensures that what the LLM produces is safe, accessible, and compliant.

3. **Mandatory Graceful Degradation.** No other framework enforces fallbacks. Flui apps work without an LLM.

4. **Native Observability.** No other framework can answer "why did the user see this?" at the component level.

5. **True Framework Agnosticism.** The core has no dependency on React, Vue, or any rendering library. The core is pure TypeScript logic. Adapters handle the rendering.

---

## 9. Plugin Ecosystem

### 9.1 Official plugins

| Plugin | Description | Status |
|--------|-------------|--------|
| `@flui/compliance` | Regulatory validation (GDPR, DORA, CSSF, EU AI Act) | Planned |
| `@flui/a11y-enhanced` | Extended accessibility validation (WCAG 2.2 AA/AAA) | Planned |
| `@flui/analytics` | Generation analytics, A/B testing for liquid views | Planned |
| `@flui/i18n` | Multi-language intent parsing and UI generation | Planned |
| `@flui/devtools` | Browser extension for debugging and replay | Planned |
| `@flui/testing` | Test utilities for liquid views (intent mocking, snapshot testing) | Planned |
| `@flui/design-system` | Design system constitution enforcement | Planned |
| `@flui/cache` | Intelligent caching of generation results | Planned |
| `@flui/offline` | Offline-first generation with local models | Planned |
| `@flui/voice` | Voice intent input and spoken UI feedback | Future |
| `@flui/spatial` | Spatial computing (Vision Pro, Quest) layout generation | Future |

### 9.2 Plugin API

```typescript
import { definePlugin } from '@flui/core'

export const myPlugin = definePlugin({
  name: 'my-plugin',
  version: '1.0.0',

  // Hook into the generation pipeline
  hooks: {
    // Before the LLM is called
    beforeGenerate(request: GenerationRequest) {
      // Modify the request (add context, adjust prompt, etc.)
      return modifiedRequest
    },

    // After the LLM responds, before validation
    afterGenerate(spec: UISpecification) {
      // Transform or enrich the specification
      return modifiedSpec
    },

    // Add custom validators
    validators: [myCustomValidator],

    // After render
    afterRender(trace: GenerationTrace) {
      // Log, analyze, report
    }
  },

  // Add custom context providers
  contextProviders: [myContextProvider],

  // Add custom components
  components: { MySpecialComponent: { ... } }
})
```

---

## 10. Protocol Compatibility

Flui is designed to work with — not against — the emerging protocol ecosystem.

### 10.1 AG-UI (Agent-User Interaction Protocol)

`@flui/ag-ui` enables Flui to act as a frontend for any AG-UI-compatible agent backend. The Context Engine enriches the AG-UI event stream with Flui's context signals, and the Validation Pipeline validates any UI specification received via AG-UI before rendering.

### 10.2 A2UI (Google)

`@flui/a2ui` enables Flui to consume A2UI widget specifications generated by Google's Gemini or any A2UI-compatible agent. Flui maps A2UI components to registered Flui components, applies validation, and renders through the chosen framework adapter.

### 10.3 MCP (Model Context Protocol)

`@flui/mcp` enables Flui's Context Engine to expose context signals as MCP resources, allowing agents to access user context through the standard MCP protocol.

---

## 11. Security Model

### 11.1 Threat model

| Threat | Mitigation |
|--------|-----------|
| LLM generates malicious code | Declarative-only output — no code execution |
| LLM references non-existent components | Component Registry validation rejects unknown types |
| LLM passes invalid props | Prop schema validation against registry |
| LLM exposes unauthorized data | Data classification check against user permissions |
| LLM produces inaccessible UI | A11y validator rejects non-compliant layouts |
| Prompt injection via user intent | Intent sanitization + output validation (defense in depth) |
| Context data leakage to LLM | Configurable context redaction before prompt construction |

### 11.2 Data privacy

The developer controls exactly what context is sent to the LLM:

```typescript
const connector = openai({
  apiKey: process.env.OPENAI_API_KEY,
  privacy: {
    // Never send these context signals to the LLM
    redact: ['identity.email', 'cognitive.errorRate'],
    // Anonymize these signals
    anonymize: ['identity.name', 'identity.team'],
    // Only send these signals
    allowlist: ['identity.role', 'environment.device', 'expertise.level']
  }
})
```

For sovereign deployments, the LLM connector points to a local/European endpoint, and no data crosses borders.

---

## 12. Roadmap

### Phase 1 — Foundation (Months 1-4)

**Goal: Working `@flui/core` + `@flui/react` + first LLM connector**

- [ ] Core Intent Parser (programmatic + explicit intents)
- [ ] Core Context Engine (identity + environment providers)
- [ ] Core Component Registry
- [ ] Core Generation Orchestrator
- [ ] Core Validation Pipeline (schema + component + prop + a11y validators)
- [ ] Core Observability Collector (console + in-memory)
- [ ] `@flui/react` adapter (LiquidView, FluiProvider)
- [ ] `@flui/openai` connector
- [ ] `@flui/anthropic` connector
- [ ] Basic documentation site
- [ ] 3 example applications

**Milestone: A developer can `npm install @flui/react` and have a working liquid view in 5 minutes.**

### Phase 2 — Ecosystem (Months 5-8)

**Goal: Multi-framework support, protocol compatibility, devtools**

- [ ] `@flui/vue` adapter
- [ ] `@flui/angular` adapter
- [ ] `@flui/ollama` connector (local/sovereign)
- [ ] `@flui/mistral` connector
- [ ] `@flui/ag-ui` protocol adapter
- [ ] `@flui/a2ui` protocol adapter
- [ ] `@flui/devtools` browser extension
- [ ] `@flui/testing` utilities
- [ ] Expertise context provider (learning from usage)
- [ ] Cognitive context provider (load inference)
- [ ] Predictive intent support
- [ ] Advanced documentation + tutorial site
- [ ] Community launch (Discord, GitHub discussions)

**Milestone: Framework is usable with React, Vue, or Angular, any major LLM, and has proper devtools.**

### Phase 3 — Enterprise (Months 9-14)

**Goal: Production readiness for regulated environments**

- [ ] `@flui/compliance` plugin (GDPR, DORA, CSSF)
- [ ] `@flui/analytics` plugin
- [ ] `@flui/design-system` plugin (design system constitution enforcement)
- [ ] `@flui/cache` plugin (intelligent generation caching)
- [ ] `@flui/i18n` plugin
- [ ] Advanced observability (external exporters: OpenTelemetry, Datadog, etc.)
- [ ] Performance optimization (streaming rendering, speculative generation)
- [ ] Security audit
- [ ] Accessibility audit (WCAG 2.2 AA certification)
- [ ] Enterprise documentation + compliance guides
- [ ] First enterprise pilot deployments

**Milestone: Framework is production-ready for regulated financial services environments.**

### Phase 4 — Next Frontier (Months 15+)

- [ ] `@flui/voice` plugin (voice-driven intent)
- [ ] `@flui/spatial` plugin (Vision Pro, spatial computing)
- [ ] `@flui/offline` plugin (on-device models)
- [ ] Multi-agent UI coordination
- [ ] Self-optimizing generation (learning from engagement metrics)
- [ ] Visual editor for rules and component registration

---

## 13. Business Model

### 13.1 Open-source core (MIT License)

Everything a developer needs to build liquid interfaces:

- `@flui/core` — Intent, Context, Registry, Generation, Validation, Observability
- `@flui/react`, `@flui/vue`, `@flui/angular` — Framework adapters
- `@flui/openai`, `@flui/anthropic`, `@flui/ollama`, etc. — LLM connectors
- `@flui/ag-ui`, `@flui/a2ui` — Protocol adapters
- `@flui/devtools` — Developer tools
- `@flui/testing` — Test utilities

### 13.2 Commercial offerings

| Offering | Description | Target |
|----------|-------------|--------|
| **Flui Cloud** | Managed observability, analytics, trace storage, replay dashboard | Teams wanting hosted observability |
| **Flui Enterprise** | Compliance plugins, priority support, SLA, security audit | Regulated industries |
| **Flui Consulting** | Architecture review, implementation support, training | Enterprises adopting Flui |
| **Flui Certification** | "Flui Compliant" certification for applications | ISVs in regulated markets |

### 13.3 The flywheel

```
Open-source adoption → Community growth → Plugin ecosystem
        ↑                                        ↓
Enterprise revenue ← Enterprise needs ← Production usage
```

The open-source framework drives adoption. Production usage creates enterprise needs (compliance, observability, support). Enterprise revenue funds further development of the open-source core.

---

## 14. FAQ

### "How is this different from just calling an LLM API and rendering the result?"

That's like asking "how is React different from just calling `document.createElement`?" Technically, you can do it manually. But Flui provides the Context Engine (understanding who and why), the Validation Pipeline (ensuring quality and safety), the Observability layer (knowing what happened and why), graceful degradation, framework integration, and a component registration system. The raw LLM call is maybe 5% of the value.

### "Does Flui replace React / Vue?"

No. Flui uses React/Vue/Angular as its rendering target. Your existing components work unchanged. Flui adds a layer on top that decides *which* components to show, *how* to arrange them, and *what data* to pass — based on intent and context.

### "What if the LLM is slow or unavailable?"

Every `LiquidView` has a mandatory fallback. If the LLM is slow (configurable timeout), unavailable, or produces invalid output, the fallback renders instantly. Flui-powered apps always work.

### "What about streaming? Users don't want to wait."

Flui supports streaming natively. The Generation Orchestrator can progressively render components as the LLM generates them. High-priority components appear first, others fill in progressively.

### "Can I use this without any LLM for testing?"

Yes. `@flui/testing` includes a `MockConnector` that returns predefined specifications. You can also use `@flui/core` in "rule-only" mode where the Context Engine + Rules determine the layout without any LLM call — useful for deterministic scenarios.

### "What about SEO and SSR?"

Flui supports server-side generation. The Generation Orchestrator can run on the server, produce a specification, validate it, and render to HTML via the framework adapter's SSR capabilities. The fallback also works for SSR.

### "How do I test liquid views?"

```typescript
import { testLiquidView } from '@flui/testing'

test('executive on mobile sees KPI cards', async () => {
  const result = await testLiquidView({
    intent: 'Show me key metrics',
    context: { role: 'executive', device: 'mobile' },
    components: registry
  })

  expect(result.componentsSelected).toContain('KPICard')
  expect(result.componentsSelected).not.toContain('DataTable')
  expect(result.layout.type).toBe('stack')
  expect(result.validation.status).toBe('pass')
})
```

### "Is the name 'Flui' final?"

It's a working name. Alternatives considered: Liq, Melt, Morph, Intent.js, Genui. The final name should be short, memorable, evocative of fluidity, and have an available npm package name and domain.

---

## Contributing

Flui is an open-source project. We welcome contributions of all kinds:

- **Core development**: TypeScript, framework adapters, LLM connectors
- **Plugins**: Compliance, analytics, i18n, accessibility
- **Documentation**: Guides, tutorials, API reference
- **Testing**: Test coverage, edge cases, performance benchmarks
- **Design**: Logo, website, devtools UI
- **Community**: Content, talks, workshops

---

## License

MIT — free for personal and commercial use.

---

*Flui is created and maintained by InTech S.A.*
*For questions, reach out at [contact info to be determined].*
