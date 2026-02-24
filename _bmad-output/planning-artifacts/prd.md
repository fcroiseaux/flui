---
stepsCompleted: [step-01-init, step-02-discovery, step-02b-vision, step-02c-executive-summary, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish, step-12-complete]
workflowStatus: complete
completedAt: '2026-02-24'
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-flui-2026-02-24.md
  - _bmad-output/problem-solution-2026-02-24.md
  - docs/flui-framework-vision.md
  - docs/flui-architecture-decisions.md
  - docs/flui-phase1-spec.md
documentCounts:
  briefs: 1
  research: 1
  projectDocs: 3
  projectContext: 0
workflowType: 'prd'
classification:
  projectType: developer_tool
  domain: ai_llm_developer_tooling
  complexity: medium-high
  projectContext: greenfield
---

# Product Requirements Document - flui

**Author:** Fabrice
**Date:** 2026-02-24

## Executive Summary

Flui is an open-source, framework-agnostic TypeScript framework that provides the **intelligence layer** for LLM-powered user interfaces. It enables developers to build **liquid interfaces** — UIs that generate and adapt themselves in real-time based on user intent, context, and constraints — while guaranteeing safety, observability, and cost control.

The core paradigm: `(intent, context, constraints) → generate → validate → render`. Developers define capabilities and rules; Flui's Context Engine determines what UI to generate based on who the user is and what they need; the Validation Pipeline enforces safety constraints (accessibility, data authorization, schema conformance) before anything reaches the DOM; and the Observability system makes every generation decision traceable, replayable, and auditable.

Flui augments React, Vue, and Angular — it does not replace them. A developer wraps a single component in `<LiquidView>` and the rest of the app remains unchanged. The framework is LLM-agnostic (OpenAI, Anthropic, Ollama, any provider via connector interface), protocol-compatible (designed for future AG-UI and A2UI integration), and secure by architecture (the LLM generates declarative JSON specifications, never executable code).

**Target users:** Frontend developers building AI-enhanced applications (mid-senior, React/TypeScript), enterprise architects evaluating GenUI for regulated environments (compliance-first), and solo developers seeking production-grade adaptive interfaces without building infrastructure from scratch.

**Phase 1 milestone:** `npm install @flui/react` → working liquid view in 5 minutes, with caching, validation, cost control, and observability included by default.

### What Makes This Special

**The ecosystem has plumbing. Flui provides the brain.** CopilotKit/AG-UI (adopted by Google, Oracle, LangChain, AWS) standardizes the transport protocol. Google's A2UI (v0.8, Dec 2025) defines a declarative UI format. Vercel AI SDK provides TypeScript LLM integration. Hashbrown offers in-browser generation. None of them answer: *"Given this user, this context, and these constraints — what is the right UI to generate, and can we prove it's safe?"*

Flui's unique position:

1. **Context Engine** — The only framework that understands *who* is asking and *why* (role, expertise, device, workflow phase, cognitive load). Every other GenUI tool is blind to context.
2. **Mandatory Validation Pipeline** — Every generated spec passes through schema, component, prop, accessibility, and data authorization validators before rendering. Zero bypass paths. This is what unlocks enterprise adoption.
3. **Observability as core** — Every generation produces a structured trace (intent, context, components selected, reasoning, validation result, latency, cost). Debugging, replay, and audit are built-in, not bolted on.
4. **Production-first architecture** — 3-level caching (memory/session/IndexedDB), cost budgets, concurrency control (latest-wins with AbortController), circuit breaker for persistent failures. All in `@flui/core`, not plugins.
5. **Security by architecture** — Declarative-only LLM output is a structural guarantee, not a configuration option. The LLM never generates executable code.
6. **Progressive adoption** — One `<LiquidView>` in an existing React app. No migration. Same playbook that made Vue.js successful.
7. **Timing** — Protocols are stabilizing, structured output is production-ready, enterprises are asking for GenUI with guarantees. The intelligence layer gap exists *now*.

## Project Classification

| Dimension | Value |
|-----------|-------|
| **Project Type** | Developer Tool — TypeScript framework / npm package ecosystem |
| **Domain** | AI/LLM Developer Tooling |
| **Complexity** | Medium-High — Novel paradigm (intent-driven UI generation), LLM non-determinism, production-grade caching/cost/concurrency requirements |
| **Project Context** | Greenfield — Documentation and architecture complete, no code yet |
| **Monorepo** | pnpm workspaces: `@flui/core`, `@flui/react`, `@flui/openai`, `@flui/anthropic`, `@flui/testing` |
| **Toolchain** | TypeScript, tsup, Vitest, Biome, size-limit, changesets |
| **Architecture Decisions** | 20 ADRs documented covering all critical runtime behaviors |
| **Implementation Spec** | 14 modules, 6 sprints, 25+ acceptance criteria defined |

## Success Criteria

### User Success

Success measured through developer experience outcomes — Flui succeeds when developers feel empowered, not burdened:

| Criterion | Metric | Target | "Aha!" Moment |
|-----------|--------|--------|---------------|
| **Instant productivity** | Time from `npm install` to working `<LiquidView>` | < 5 minutes | "I wrapped one div and it just... adapted to the user's role" |
| **Generation relevance** | % of generations producing appropriate UI without fallback | > 90% | "It chose the right components for an executive on mobile — I didn't code that" |
| **Zero surprise output** | Unvalidated LLM output reaching DOM | 0% — validation pipeline has no bypass | "I can trust this in production because nothing gets through unchecked" |
| **Cost predictability** | Budget overruns when Cost Manager is configured | 0 overruns | "I set $5/day and it gracefully degrades to cache when I hit the limit" |
| **Debuggability** | Time to answer "why did user X see this UI?" | < 2 minutes via debug overlay | "I clicked the trace tab and saw exactly why it chose those components" |
| **Zero-friction adoption** | Existing React app refactoring required to add Flui | 0 breaking changes | "I added Flui to our existing app without changing a single existing component" |

### Business Success

Flui is open-source with a dual-license / enterprise support business model. Business success is measured in adoption velocity and ecosystem health, not direct revenue in Phase 1.

| Timeframe | Metric | Target | Signal |
|-----------|--------|--------|--------|
| **0-6 months** | Phase 1 packages published on npm | 5 packages | Framework exists and is installable |
| **0-6 months** | Example applications working end-to-end | 3 examples | Real-world applicability proven |
| **0-6 months** | Acceptance criteria passing | 25+ criteria | Production-readiness claims are backed by evidence |
| **6-12 months** | GitHub stars | 1,000+ | Community awareness and social proof |
| **6-12 months** | npm weekly downloads (`@flui/core`) | 500+ | Active experimentation |
| **6-12 months** | External contributors | 10+ | Framework addresses real needs beyond creator |
| **6-12 months** | Production deployments | 5+ known | Production-readiness validated in the field |
| **12-24 months** | Enterprise pilot with compliance review passed | 1+ | Enterprise adoption thesis validated (Priya persona) |
| **12-24 months** | First paid enterprise support contract | 1+ | Business model validated |

### Technical Success

Performance and quality KPIs that must be met for Phase 1 release:

| Category | KPI | Target |
|----------|-----|--------|
| **Latency** | Generation P50 | < 500ms |
| **Latency** | Generation P99 | < 2,000ms |
| **Cache** | Hit rate for repeated intent+context within TTL | > 80% |
| **Bundle** | `@flui/core` gzipped | < 25KB |
| **Bundle** | `@flui/react` gzipped | < 8KB |
| **Bundle** | LLM connectors gzipped (each) | < 3KB |
| **Cost** | Per generation (common cases) | < $0.01 |
| **Quality** | Validation pipeline bypass paths | 0 |
| **Quality** | WCAG AA violations in generated specs | 0 |
| **Quality** | Test coverage on `@flui/core` | > 90% |
| **Quality** | `any` types in public API | 0 |
| **Resilience** | Fallback renders when LLM unavailable | 100% |

### Measurable Outcomes

**Phase 1 Go/No-Go Gates:**

- **Gate 1 — Technical Completeness:** All 14 modules implemented, 5 packages published, 3 examples working, 25+ acceptance criteria passing, performance budgets met.
- **Gate 2 — Developer Experience:** 5-minute onboarding validated, zero-config fallback working, debug overlay actionable, cost manager preventing overruns, documentation complete.
- **Gate 3 — Production Readiness:** Validation catching 100% of violations, cache reducing LLM calls >80%, concurrency handling rapid changes without flicker, circuit breaker activating on persistent failures, full observability traces.

**Decision:** Gates 1-3 all pass → open-source release. Any gate fails → fix before release, no partial shipping.

## Product Scope

> **Note:** Detailed MVP feature set, must-have analysis, deferred items with rationale, and phased roadmap with priorities are in the [Project Scoping & Phased Development](#project-scoping--phased-development) section below.

### MVP - Minimum Viable Product

**5 npm packages, 14 internal modules, 3 example apps.**

| Package | What Ships |
|---------|-----------|
| `@flui/core` | Intent Parser, Context Engine, Component Registry, Generation Orchestrator, Validation Pipeline, Cache Manager (3-level), Generation Policy, Concurrency Controller, Cost Manager, Observability Collector |
| `@flui/react` | `<FluiProvider>`, `<LiquidView>`, ViewState, transitions (crossfade), debug overlay (Spec + Trace tabs) |
| `@flui/openai` | OpenAI connector with streaming + structured output |
| `@flui/anthropic` | Anthropic connector with streaming + structured output |
| `@flui/testing` | MockConnector, `generateSpec()`, `testLiquidView()` helpers |

**Examples:** Adaptive Dashboard (role-based), Smart Form Wizard (context-aware), Content Explorer (intent-driven).

**Guiding principle:** If a feature is not needed for the 3 example apps to work with validation, caching, cost control, and observability — it's not MVP.

### Growth Features (Post-MVP)

**Phase 2 (6-12 months):**

- Framework adapters: Vue 3, Angular 17+, Svelte 5
- Protocol adapters: AG-UI, A2UI, MCP
- SSR/SSG: Next.js App Router, Nuxt 3
- Multi-view coordination: batched + coordinated modes
- Browser DevTools extension
- Additional connectors: Ollama, Mistral, Gemini
- Advanced debug: What-If simulation, Edit Spec, pin mechanism

### Vision (Future)

**Phase 3 (12-24 months):** Enterprise compliance suite (HIPAA, GDPR, SOC2), design system integration, advanced context providers (expertise learning, cognitive load inference, predictive intent), analytics/A/B testing, i18n, marketplace.

**Phase 4 (24+ months):** On-device LLM, multi-agent collaboration, autonomous optimization, cross-application context, visual no-code editor.

**Long-term thesis:** Flui becomes to LLM-powered UIs what React became to data-reactive UIs — the default intelligence layer for adaptive interfaces.

## User Journeys

### Journey 1: Alex's First Liquid Interface (Primary Developer — Success Path)

**Opening Scene:** Alex is a senior frontend developer at a B2B analytics startup. His team maintains 3 separate dashboard layouts — one per user role. The PM just asked for a fourth (for "partners") and Alex knows this approach doesn't scale. He's heard about Flui from a conference talk about "liquid interfaces."

**Rising Action:**

1. Alex visits the Flui docs, clones the example repo, and runs `pnpm dev`. The adaptive dashboard example loads — he switches the context dropdown from "analyst" to "executive" and watches the entire layout transform. *Intrigued.*
2. He runs `npm install @flui/react @flui/openai` in his existing Next.js project. Imports `FluiProvider` and `LiquidView`. Wraps the dashboard section.
3. He registers his existing `KPICard`, `SalesChart`, `TeamTable`, and `AlertBanner` components with the Component Registry, declaring each component's `accepts` props.
4. He writes his first intent: `"Show team performance overview"` with context `{ role: "executive", device: "desktop" }`.
5. First generation takes ~400ms. The fallback shows instantly, then the generated layout fades in: 2 KPICards + 1 SalesChart. Exactly what an executive needs. He didn't code that layout.

**Climax:** Alex changes the context to `{ role: "analyst", device: "desktop" }` and regenerates. The layout shifts: TeamTable with sortable columns + SalesChart with drill-down + AlertBanner. Same intent, completely different (and appropriate) UI. He opens the debug overlay — the Trace tab shows exactly which components were selected and why. *"This is what I've been building manually for months."*

**Resolution:** Alex adds LiquidViews to 3 more sections over the next week. The partner dashboard — the one the PM requested — works without writing a single new layout. Cost Manager shows $0.003 per generation average, and the cache handles 85% of page loads without hitting the LLM. The team saves 2 weeks of development time.

**Requirements revealed:** Component Registry API, LiquidView rendering, Context Engine (role + device), Generation Orchestrator, Cache Manager, Debug Overlay (Spec + Trace), Cost Manager reporting.

---

### Journey 2: Alex Hits a Bad Generation (Primary Developer — Edge Case / Error Recovery)

**Opening Scene:** Two weeks into using Flui, Alex gets a bug report: "The executive dashboard showed a DataTable with 50 columns yesterday — it was unusable on mobile."

**Rising Action:**

1. Alex opens the debug overlay for the reported LiquidView and searches the trace log by timestamp. He finds the generation trace: intent was "Show team performance overview", context was `{ role: "executive", device: "mobile" }` — but the LLM returned a spec with a `TeamTable` containing 50-column data.
2. He checks the validation trace: the schema validator passed (valid spec), the component validator passed (TeamTable is registered), but the *prop validator* didn't catch the excessive columns because Alex hadn't set a `maxColumns` constraint.
3. Alex registers a custom validator: `mobileComponentValidator` that rejects tables with >5 columns on mobile devices.
4. He retests. The generation now fails validation, triggers a retry with a modified prompt ("mobile device, prefer compact components"), and produces 2 KPICards — no table. The fallback never showed because the retry succeeded.

**Climax:** Alex checks the circuit breaker state — no persistent failures. He adds the validator to the default pipeline. He realizes the validation system *caught the issue and self-corrected* once the rule was in place.

**Resolution:** Alex writes a unit test with MockConnector that returns a spec with a 50-column table on mobile, and asserts the validator rejects it. The test passes. He pins the test to CI. No more bad mobile generations.

**Requirements revealed:** Validation Pipeline (custom validators), retry with modified prompt, circuit breaker status, debug overlay trace search, MockConnector for testing, validator registration API.

---

### Journey 3: Priya's Compliance Evaluation (Enterprise Architect — Evaluation Path)

**Opening Scene:** Priya is a senior architect at a financial services firm. The CTO wants "AI-powered adaptive dashboards." The CISO says "prove it's safe or it doesn't ship." Priya has evaluated 4 GenUI tools — all failed compliance review.

**Rising Action:**

1. Priya reads Flui's architecture docs. First signal: "The LLM never generates executable code — only declarative JSON specifications." She highlights this for the CISO.
2. She reviews ADR-002 (Data Resolution) and ADR-006 (Cost Control). Data identifiers in specs are resolved by a `DataResolver` that the developer controls — the LLM can't reference data sources it doesn't know about. Cost budgets prevent runaway API spending.
3. She builds a proof-of-concept: an internal tool dashboard with a custom `dataAuthorizationValidator` that checks generated specs against the user's permission set. If the spec references data the user can't access, validation blocks rendering.
4. She runs a compliance review: (a) LLM output is declarative-only — no code execution risk. (b) Validation pipeline is mandatory — no bypass paths. (c) Every generation produces a structured trace — full audit trail. (d) Data authorization validator enforces row-level security in generated UIs.

**Climax:** Priya presents to the security review board. She shows generation traces proving no unauthorized data was referenced in 500 test generations. She demonstrates the circuit breaker: after 3 consecutive failures, the LiquidView locks to fallback mode until conditions change. The CISO signs off.

**Resolution:** The team adopts Flui for one internal tool. Six months later, it's running on 4 internal dashboards. Priya writes a custom compliance validator for SOC2 audit requirements. The observability traces feed into their existing SIEM system.

**Requirements revealed:** Declarative-only architecture, custom validators (data authorization), Observability Collector (structured traces, export), circuit breaker behavior, Cost Manager budgets, FluiProvider configuration.

---

### Journey 4: Marco's Cost-Conscious Launch (Solo Developer — Budget Constraint Path)

**Opening Scene:** Marco is building a SaaS project management tool solo. He wants the task board to adapt to the workflow phase (planning shows cards, execution shows timelines, review shows reports). His budget: $50/month for LLM API calls across all users.

**Rising Action:**

1. Marco installs Flui and configures the Cost Manager: `maxCostPerSession: 0.05, maxCostPerDay: 2.00`. He sets cache TTL to 10 minutes.
2. His 50 beta users start using the app. Day 1: cache hit rate is 40% (cold caches). Day 2: cache hit rate climbs to 78% as users revisit similar intents. Cost: $1.20/day.
3. A power user triggers 30 regenerations in rapid succession (testing intent variations). The Concurrency Controller cancels stale requests (latest-wins), and the Cost Manager hits the session budget after 15 generations. The LiquidView gracefully degrades to cached specs for the remaining session.
4. Marco checks the Observability console. He sees: 15 generations, 12 served from cache, 3 fallbacks. Total cost: $0.04 for that session. The cost manager worked perfectly.

**Climax:** End of month 1: 50 users, $38 total LLM cost. 82% average cache hit rate. Zero fallback-only sessions (every user saw at least one generated UI). The adaptive task board is Marco's key differentiator — competitors have static layouts.

**Resolution:** Marco scales to 200 users. The cache handles the growth — LLM costs grow sub-linearly because most intent+context combinations are already cached. He adjusts cache TTL by intent category: "task board" (15 min), "reports" (30 min), "settings" (60 min).

**Requirements revealed:** Cost Manager (session + daily budgets, graceful degradation), Cache Manager (TTL configuration per intent), Concurrency Controller (latest-wins, budget-aware cancellation), Observability (cost tracking, cache metrics).

---

### Journey 5: The Plugin Developer (API/Integration Consumer)

**Opening Scene:** Dana is a developer at a design system company. Her team maintains a component library used by 200+ enterprise clients. She wants to create a Flui connector package (`@acme/flui-design-system`) so clients can use Flui with Acme's component library.

**Rising Action:**

1. Dana reads the Component Registry API docs. She needs to register Acme's 40+ components with proper `accepts` declarations, Zod prop schemas, and category tags.
2. She creates a `registerAcmeComponents(registry)` function that batch-registers all components with correct type metadata.
3. She writes a custom `brandValidator` that checks generated specs against Acme's design guidelines: max 3 colors, mandatory header component, approved font stack only.
4. She packages it as an npm module with `@flui/core` as a peer dependency.

**Climax:** An Acme client installs `@acme/flui-design-system`, calls `registerAcmeComponents(registry)`, adds the `brandValidator` to their pipeline — and every generated UI conforms to Acme's design system automatically.

**Resolution:** Dana's package gets adopted by 15 Acme clients in the first quarter. She extends it with Acme-specific context providers (brand theme, client tier). The plugin ecosystem is working.

**Requirements revealed:** Component Registry batch registration API, custom validator plugin API, npm packaging with peer dependencies, context provider plugin API, Zod schema generation from component metadata.

---

### Journey Requirements Summary

| Journey | Primary Capabilities Revealed |
|---------|------------------------------|
| **Alex — Success Path** | Component Registry, LiquidView, Context Engine, Generation Orchestrator, Cache Manager, Debug Overlay, Cost Manager |
| **Alex — Error Recovery** | Validation Pipeline (custom validators), retry logic, circuit breaker, debug trace search, MockConnector |
| **Priya — Compliance** | Declarative architecture, custom validators (data auth), Observability (traces, export), circuit breaker, Cost Manager |
| **Marco — Budget** | Cost Manager (budgets, degradation), Cache Manager (TTL config), Concurrency Controller, Observability (cost metrics) |
| **Dana — Plugin Dev** | Component Registry (batch API), validator plugin API, context provider plugin API, npm packaging, Zod schemas |

**Coverage check:**

- Primary user success path: Alex Journey 1
- Primary user edge case / error recovery: Alex Journey 2
- Enterprise / compliance user: Priya Journey 3
- Budget-constrained user: Marco Journey 4
- API / integration consumer: Dana Journey 5

## Domain-Specific Requirements

### Domain: AI/LLM Developer Tooling

Flui operates in a unique domain intersection: it's a **developer tool** (framework/SDK) that manages **LLM interactions** for **frontend UI generation**. Domain-specific concerns arise from LLM non-determinism, cost economics, and the fact that Flui-powered apps may themselves operate in regulated domains.

### LLM Integration Constraints

| Constraint | Requirement | ADR Reference |
|-----------|-------------|---------------|
| **Non-deterministic output** | Same intent+context may produce different valid specs across LLM calls. Framework must treat this as normal, not error. Testing strategy must account for valid variation. | ADR-010 |
| **Streaming behavior varies by provider** | OpenAI streams structured JSON differently than Anthropic. Connector interface must normalize streaming into a common `AsyncIterable<GenerationChunk>` format. | ADR-009 |
| **Context window limits** | Prompt (component registry + context + rules + intent) must fit within provider's context window. Large registries (200+ components) require pre-filtering. | ADR-007 |
| **Rate limits and throttling** | LLM providers impose rate limits. Connector must handle 429 responses gracefully with exponential backoff. Cache and Cost Manager reduce call volume. | ADR-011 |
| **Model versioning** | Provider model updates may change generation quality. Spec versioning (ADR-017) and golden-file tests (Phase 2) mitigate regression. | ADR-017 |

### Cost Economics

| Concern | Requirement |
|---------|-------------|
| **Per-token pricing** | Cost Manager must estimate cost *before* generation based on prompt size and expected output tokens. Developers need predictable cost per generation. |
| **Cost asymmetry** | Input tokens (prompt with registry + context) cost less than output tokens (generated spec). Prompt optimization directly reduces cost. |
| **Cache as cost control** | 3-level cache is not a performance optimization — it's a *business requirement*. Without cache, Flui is economically unviable for production. |
| **Budget enforcement** | Hard budget limits must be enforced synchronously — not after-the-fact accounting. Exceeding budget must trigger graceful degradation, not error. |

### Security Considerations Specific to GenUI

| Concern | Mitigation |
|---------|-----------|
| **Prompt injection via intent** | User-provided intents could contain injection attempts. Intent Parser must sanitize input. Generated specs are declarative-only (no code execution), limiting injection impact. |
| **Data identifier enumeration** | LLM might reference data identifiers not provided in context, attempting to access unauthorized data. DataResolver must reject unknown identifiers. Data authorization validator blocks specs referencing unauthorized data. |
| **Component registry poisoning** | If registry accepts untrusted component definitions, malicious components could bypass safety. Registry must validate component metadata at registration time. |
| **Observability data sensitivity** | Generation traces contain user intent, context (role, permissions), and component selections. Trace data must be treated as PII-adjacent. Observability transports must support filtering/redaction. |

### Compliance Enablement (Meta-Requirement)

Flui itself is not a regulated product, but it *enables* regulated deployments. The framework must provide the *hooks* for downstream compliance without imposing specific regulations:

| Hook | Purpose | Phase 1 Implementation |
|------|---------|----------------------|
| **Custom validators** | Developers add domain-specific compliance rules (HIPAA, SOC2, GDPR) as validators in the pipeline | Validator plugin API with `validate(spec, context) → ValidationResult` |
| **Trace export** | Compliance teams need generation traces in their audit systems (SIEM, log aggregators) | Observability transport interface: `send(trace: GenerationTrace)` |
| **Data authorization** | Generated specs must respect data access controls from the host application | DataResolver + data authorization validator pattern |
| **Fallback guarantee** | Regulated environments need certainty that fallback renders when LLM fails | Mandatory fallback prop on LiquidView — TypeScript compilation error if missing |

### Risk Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **LLM provider outage** | Medium | High | Mandatory fallback + 3-level cache means app works without LLM. Circuit breaker prevents retry storms. |
| **LLM quality regression** (model update) | Medium | Medium | Spec versioning + validation pipeline catches regressions. Golden-file tests (Phase 2) detect quality drift. |
| **Cost spike** (unexpected usage pattern) | Medium | Medium | Cost Manager with hard budget limits. Cache reduces volume. Observability alerts on cost anomalies. |
| **Prompt injection** | Low | Medium | Declarative-only output (no code execution). Intent sanitization. Data authorization validator. |
| **Bundle size bloat** | Low | Medium | `size-limit` CI checks. Tree-shaking architecture. Per-package size budgets (ADR-018). |

## Innovation & Novel Patterns

### Detected Innovation Areas

**Innovation Signal 1: New Rendering Paradigm**
Flui introduces a fundamentally new paradigm for frontend development. Every major framework since React (2013) operates on `state → render(state) → DOM`. Flui introduces `(intent, context, constraints) → generate → validate → render`. This is not an incremental improvement — it's a paradigm shift from developer-declared UI to intent-driven, context-aware UI generation.

**Innovation Signal 2: Intelligence Layer Architecture**
While the GenUI ecosystem converges on plumbing (AG-UI for transport, A2UI for format), Flui occupies a novel architectural position: the intelligence layer *above* protocols and *below* the application. This is a new category — no existing framework provides context-aware generation decisions with mandatory validation and full observability.

**Innovation Signal 3: Declarative Specification Language**
The UISpecification format is effectively a new declarative DSL — a JSON schema that describes UI composition without executable code. Unlike A2UI (which is also declarative), Flui's spec includes `InteractionSpec` (component-to-component data flows), `ViewState` contracts, and `DataResolver` bindings. This makes it a richer specification language for expressing UI behavior declaratively.

**Innovation Signal 4: Validation-as-Architecture**
Most frameworks treat validation as an optional middleware. Flui makes the validation pipeline a mandatory, non-bypassable architectural layer. This is novel in the GenUI space and directly addresses the enterprise trust gap that blocks adoption of LLM-powered UIs.

### Market Context & Competitive Landscape

| Category | Players | Flui's Novel Position |
|----------|---------|----------------------|
| **Transport protocols** | AG-UI (CopilotKit), MCP | Flui consumes protocols, doesn't compete. Future `@flui/ag-ui` adapter. |
| **Declarative UI formats** | A2UI (Google, v0.8) | Flui's UISpecification is richer (interactions, state, data bindings). Future `@flui/a2ui` adapter. |
| **Chat-focused GenUI** | CopilotKit, Vercel AI SDK | Flui goes beyond chat — liquid interfaces for dashboards, workflows, data exploration. |
| **In-browser GenUI** | Hashbrown | Flui adds context engine, validation, observability — the intelligence layer Hashbrown lacks. |
| **LLM-first frameworks** | Revolt (experimental) | Flui is production-focused from day 1 (caching, cost control, circuit breaker). |

**Timing advantage:** The ecosystem is standardizing around protocols (AG-UI adopted by Google, Oracle, AWS, LangChain in 2025). This creates the opening for an intelligence layer that sits above the plumbing. Flui is the first to occupy this position.

### Validation Approach

| Innovation Aspect | Validation Method | Success Signal |
|------------------|-------------------|----------------|
| **New paradigm adoption** | 5-minute onboarding test with fresh developers | Developer creates working LiquidView without prior Flui knowledge |
| **Context-aware generation quality** | Same intent with different contexts produces different, appropriate UIs | >90% of context-adapted generations rated "appropriate" by developer |
| **Validation pipeline effectiveness** | Inject known-bad specs (WCAG violations, unauthorized data) | 100% caught by pipeline — zero bypass paths |
| **Cache economics** | Production-like workload simulation (50 users, diverse intents) | Cache hit rate >80% after warm-up; cost per user <$0.50/month |
| **Intelligence layer value** | Compare Flui app vs. raw LLM-call app on same task | Flui version has fewer bad generations, lower cost, audit capability |

### Risk Mitigation

| Innovation Risk | What Could Go Wrong | Fallback Strategy |
|----------------|--------------------|--------------------|
| **Paradigm adoption resistance** | Developers don't understand "intent-driven UI" or see it as too abstract | Progressive adoption story: start with one `<LiquidView>`. Show concrete examples, not abstract paradigms. The dashboard example demonstrates value in 30 seconds. |
| **LLM generation quality insufficient** | LLMs don't generate good enough specs for production use | 3-phase fallback: (1) retry with modified prompt, (2) serve cached spec, (3) render developer fallback. Flui works even when LLM quality is poor. |
| **Context Engine adds latency without value** | Context signals don't meaningfully improve generation quality | Context is modular — developers enable providers incrementally. Start with identity (role) only. Add environment, workflow later. Measure generation quality delta per provider. |
| **Market timing wrong** | Protocols aren't stable enough, or enterprises aren't ready | Flui works standalone without AG-UI/A2UI. Protocol adapters are Phase 2. Core value (context + validation + observability) doesn't depend on protocol maturity. |

## Developer Tool Specific Requirements

### Project-Type Overview

Flui is a **TypeScript framework distributed as npm packages** — a developer tool in the most direct sense. Developers consume it as a library dependency, integrate it into existing projects, and interact with it exclusively through TypeScript APIs and React components. The framework must meet the elevated standards developers apply to their core dependencies: type safety, small bundle size, zero breaking changes in minor versions, excellent error messages, and comprehensive documentation.

The developer tool classification drives specific requirements around **language support** (TypeScript-first with JavaScript compatibility), **installation** (zero-config npm install), **API surface** (minimal, discoverable, strongly typed), **documentation** (API reference + guides + examples), and **migration** (progressive adoption without breaking existing apps).

### Technical Architecture Considerations

#### Language Matrix

| Dimension | Phase 1 Support | Notes |
|-----------|----------------|-------|
| **Primary language** | TypeScript 5.x | Strict mode, zero `any` in public API |
| **JavaScript consumers** | Full support via compiled output | `.d.ts` declaration files, JSDoc comments preserved |
| **Module format** | ESM (primary) + CJS (compatibility) | Dual output via tsup |
| **Target** | ES2022 | Supports modern browsers and Node 18+ |
| **React version** | React 18+ | Hooks-based API, no class components |
| **Node.js** | 18+ (LTS) | For SSR scenarios in Phase 2; connectors work server-side |
| **Zod dependency** | Zod 3.x | Runtime type validation for UISpecification and component props |
| **Type exports** | All public types exported from package index | `import type { UISpecification } from '@flui/core'` |

**TypeScript strictness requirements:**

- `strict: true` in all packages
- `noUncheckedIndexedAccess: true`
- `exactOptionalProperties: true`
- Zero `any` in public API (enforced by lint rule)
- Generic types used for extensibility (e.g., `ComponentRegistry<TProps>`, `ContextProvider<TContext>`)

#### Installation Methods

| Method | Command | Minimum Install |
|--------|---------|-----------------|
| **npm** | `npm install @flui/react @flui/openai` | 2 packages for working app |
| **pnpm** | `pnpm add @flui/react @flui/openai` | Same |
| **yarn** | `yarn add @flui/react @flui/openai` | Same |
| **Core only** (framework adapters) | `npm install @flui/core` | For non-React or custom integrations |
| **Testing** | `npm install -D @flui/testing` | Dev dependency for tests |

**Installation experience requirements:**

- Zero post-install scripts (no native compilation, no setup steps)
- No peer dependency warnings for standard React 18+ projects
- `@flui/core` is a regular dependency of `@flui/react` (not peer) — developers install `@flui/react` and get `@flui/core` automatically
- LLM connectors (`@flui/openai`, `@flui/anthropic`) are separate installs — bring your own provider
- `@flui/testing` as devDependency, includes `MockConnector` that requires no LLM API key

**Dependency philosophy:**

- Minimal external dependencies to reduce supply chain risk
- `zod` is the only required runtime dependency (validation)
- LLM provider SDKs (`openai`, `@anthropic-ai/sdk`) are peer dependencies of their respective connector packages
- No dependency on `lodash`, `moment`, or other heavy utility libraries

#### API Surface

The public API is designed for **minimal surface area with maximum composability**:

**Package: `@flui/core`**

| Export | Type | Purpose |
|--------|------|---------|
| `createFlui()` | Factory function | Creates a configured Flui instance — the main entry point |
| `ComponentRegistry` | Class | Register components with prop schemas and metadata |
| `ValidationPipeline` | Class | Configure and run validators on generated specs |
| `CacheManager` | Class | 3-level cache configuration and management |
| `CostManager` | Class | Budget configuration and cost tracking |
| `ObservabilityCollector` | Class | Trace collection and transport configuration |
| `UISpecificationSchema` | Zod schema | Runtime validation of generated specs |
| Type exports | TypeScript types | `UISpecification`, `GenerationTrace`, `Intent`, `Context`, `ValidationResult`, `LLMConnector`, `GenerationPolicy`, etc. |

**Package: `@flui/react`**

| Export | Type | Purpose |
|--------|------|---------|
| `<FluiProvider>` | React component | Context provider — wraps app, provides Flui instance |
| `<LiquidView>` | React component | The core component — renders intent-driven UI with mandatory fallback |
| `useLiquidView()` | React hook | Imperative access to generation, state, and trace |
| `useFluidDebug()` | React hook | Access debug overlay state and trace data |
| `useFluidContext()` | React hook | Access current context from within liquid views |

**Package: `@flui/openai` / `@flui/anthropic`**

| Export | Type | Purpose |
|--------|------|---------|
| `createOpenAIConnector()` / `createAnthropicConnector()` | Factory function | Creates configured LLM connector |

**Package: `@flui/testing`**

| Export | Type | Purpose |
|--------|------|---------|
| `MockConnector` | Class | Deterministic LLM connector for tests |
| `generateSpec()` | Helper | Generate a spec programmatically for testing |
| `testLiquidView()` | Helper | Mount and test a LiquidView with assertions |

**API design principles:**

- **One way to do things** — no method aliases, no multiple configuration patterns
- **Discoverable** — autocomplete reveals the full API; no hidden methods or magic strings
- **Fail loudly** — invalid configuration throws at initialization, not at runtime
- **Composable** — validators, context providers, and transports are pluggable via well-typed interfaces
- **No global state** — everything flows from `createFlui()` → `FluiProvider` → components

#### Code Examples

**Minimal working example (< 20 lines):**

```typescript
// app.tsx
import { createFlui } from '@flui/core';
import { FluiProvider, LiquidView } from '@flui/react';
import { createOpenAIConnector } from '@flui/openai';
import { KPICard, SalesChart, AlertBanner } from './components';

const flui = createFlui({
  connector: createOpenAIConnector({ apiKey: process.env.OPENAI_API_KEY }),
  components: [KPICard, SalesChart, AlertBanner],
});

export function App() {
  return (
    <FluiProvider instance={flui}>
      <LiquidView
        intent="Show team performance overview"
        context={{ role: 'executive', device: 'desktop' }}
        fallback={<DefaultDashboard />}
      />
    </FluiProvider>
  );
}
```

**Component registration:**

```typescript
import { ComponentRegistry } from '@flui/core';
import { z } from 'zod';

const registry = new ComponentRegistry();

registry.register({
  name: 'KPICard',
  component: KPICard,
  category: 'data-display',
  accepts: z.object({
    title: z.string(),
    value: z.number(),
    trend: z.enum(['up', 'down', 'flat']).optional(),
    format: z.enum(['number', 'currency', 'percentage']).optional(),
  }),
  description: 'Displays a key performance indicator with optional trend',
});
```

**Custom validator:**

```typescript
import { ValidationPipeline } from '@flui/core';

const pipeline = new ValidationPipeline();

pipeline.addValidator({
  name: 'mobile-table-guard',
  validate: (spec, context) => {
    if (context.device === 'mobile') {
      const tables = spec.components.filter(c => c.type === 'DataTable');
      const violations = tables.filter(t => (t.props.columns?.length ?? 0) > 5);
      return violations.length === 0
        ? { valid: true }
        : { valid: false, errors: ['Tables on mobile must have ≤ 5 columns'] };
    }
    return { valid: true };
  },
});
```

#### Migration Guide

Flui is designed for **zero-migration, progressive adoption** — the primary adoption path is additive, not a rewrite:

**Step 1: Install (0 changes to existing code)**

```bash
npm install @flui/react @flui/openai
```

**Step 2: Wrap app with provider (1 change — add provider)**

```tsx
// Before:
<App />

// After:
<FluiProvider instance={flui}>
  <App />  {/* existing app unchanged */}
</FluiProvider>
```

**Step 3: Replace one section with LiquidView (1 change — swap one component)**

```tsx
// Before:
<DashboardSection>
  <KPICard title="Revenue" value={revenue} />
  <SalesChart data={sales} />
</DashboardSection>

// After:
<LiquidView
  intent="Show team performance overview"
  context={{ role: user.role, device: deviceType }}
  fallback={
    <DashboardSection>
      <KPICard title="Revenue" value={revenue} />
      <SalesChart data={sales} />
    </DashboardSection>
  }
/>
```

**What does NOT change:**

- Existing components continue to work as before
- Routing, state management, data fetching — all unchanged
- Build pipeline, CI/CD — unchanged (Flui is just npm packages)
- Testing — existing tests pass; new tests use `@flui/testing` for LiquidView-specific assertions

**Adoption trajectory:**

| Stage | Effort | Result |
|-------|--------|--------|
| **Try** | 1 LiquidView in a side project | See how it works, zero risk |
| **Adopt** | 2-5 LiquidViews in one section | Validate value proposition with real users |
| **Expand** | LiquidViews across multiple features | Full benefit of adaptive interfaces |
| **Enterprise** | Custom validators + observability exports | Compliance and audit requirements met |

### Implementation Considerations

**Package publishing and versioning:**

- Changesets for coordinated version bumps across the monorepo
- Semantic versioning: breaking API changes only in major versions
- All 5 packages published simultaneously with matching version numbers in Phase 1
- npm provenance (SLSA) for supply chain security

**Bundle size strategy:**

- Per-package size budgets enforced by `size-limit` in CI (ADR-018)
- Tree-shaking: all exports are individually importable
- No side effects in module root (sideEffects: false in package.json)
- Core validators, context providers, and cache storages are individually importable to minimize bundle

| Package | Size Budget (gzipped) |
|---------|----------------------|
| `@flui/core` | < 25KB |
| `@flui/react` | < 8KB |
| `@flui/openai` | < 3KB |
| `@flui/anthropic` | < 3KB |
| `@flui/testing` | No limit (devDependency) |

**Error messages and DX:**

- All errors include a Flui error code (e.g., `FLUI_E001: Component "XYZ" not found in registry`)
- Error codes map to documentation pages with explanations and solutions
- TypeScript compilation errors for common mistakes (e.g., missing `fallback` prop on `LiquidView`)
- Runtime warnings for performance issues (e.g., "Component registry has 200+ components — consider pre-filtering")

**Testing strategy for framework consumers:**

- `MockConnector` returns deterministic specs — no LLM API key needed for tests
- `generateSpec()` helper creates valid specs programmatically for assertion testing
- `testLiquidView()` mounts a LiquidView with mock connector and provides assertion helpers
- 4-tier testing strategy documented: unit (Tier 1), integration (Tier 2), property-based (Tier 3, late Phase 1), golden-file (Tier 4, Phase 2)

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Platform MVP — "Working Infrastructure"

Flui's MVP is not a feature-first product (no "killer feature" to ship); it's a **platform MVP** that proves the architecture works end-to-end. The minimum viable product must demonstrate that `(intent, context, constraints) → generate → validate → render` works reliably in production conditions. If the pipeline works with caching, cost control, validation, and observability — the framework is useful. If any link in the chain is missing, it's not.

**Why Platform MVP over alternatives:**

| MVP Type | Why Not (or Why Yes) |
|----------|---------------------|
| **Problem-solving MVP** | Flui solves a real problem (manual layout per persona), but the value only materializes when the full pipeline works. A partial pipeline has negative value (unreliable generation). |
| **Experience MVP** | Developer experience is critical (5-minute onboarding), but DX without working validation is dangerous — developers would ship unsafe UIs. |
| **Revenue MVP** | Flui is open-source; revenue is Phase 3. Not applicable for MVP strategy. |
| **Platform MVP** | **Selected.** The framework's value proposition requires the full pipeline to be credible. Each piece (context, generation, validation, cache, cost, observability) is necessary for the others to have value. |

**Resource Requirements:**

- Solo developer (Fabrice) for Phase 1 — architecture is designed for this constraint
- 6 sprints estimated in Phase 1 spec
- No external dependencies beyond LLM provider APIs
- No infrastructure to manage (client-side framework, npm publishing only)

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**

| Journey | MVP Support Level | Notes |
|---------|-------------------|-------|
| **Alex — Success Path** | Full | Primary journey — if this doesn't work, nothing works |
| **Alex — Error Recovery** | Full | Validation pipeline + custom validators + retry + circuit breaker |
| **Priya — Compliance** | Partial | Hooks available (custom validators, trace export interface, data auth validator). Full compliance suite is Phase 3. |
| **Marco — Budget** | Full | Cost Manager + Cache Manager + Concurrency Controller |
| **Dana — Plugin Dev** | Partial | Component Registry batch API and validator plugin API available. Context provider plugin API is basic. |

**Must-Have Capabilities (Without these, the framework fails):**

| # | Capability | Rationale |
|---|-----------|-----------|
| 1 | **Intent Parser** (programmatic + explicit) | Entry point — no intent, no generation |
| 2 | **Context Engine** (identity + environment providers) | Core differentiator — context-blind generation is not Flui |
| 3 | **Component Registry** (register, query, batch) | LLM needs to know available components |
| 4 | **Generation Orchestrator** (prompt builder + spec parser) | The core pipeline step — intent+context → spec |
| 5 | **Validation Pipeline** (schema, component, prop, a11y, data validators) | Non-negotiable — this is what makes Flui safe for production |
| 6 | **Cache Manager** (3 levels: memory, session, IndexedDB) | Without cache, Flui is economically unviable and too slow |
| 7 | **Cost Manager** (session + daily budgets, graceful degradation) | Developers won't adopt a framework that can cause surprise bills |
| 8 | **Concurrency Controller** (AbortController, latest-wins) | Rapid intent changes without concurrent request chaos |
| 9 | **Circuit Breaker** | Persistent LLM failures must lock to fallback, not retry-storm |
| 10 | **Observability Collector** (traces, console + in-memory transports) | Debugging is impossible without traces — framework is unusable |
| 11 | **LiquidView** component (React) | The developer-facing surface — if this doesn't feel right, adoption fails |
| 12 | **FluiProvider** + ViewState + transitions | Required for LiquidView to work in React apps |
| 13 | **Debug Overlay** (Spec + Trace tabs) | "Why did the user see this?" must be answerable in < 2 minutes |
| 14 | **OpenAI connector** | At least one real LLM connector — OpenAI has largest developer base |
| 15 | **Anthropic connector** | Second connector proves the abstraction works (not hardcoded to one provider) |
| 16 | **MockConnector** + test helpers | Framework is untestable without deterministic mock — developers won't adopt |
| 17 | **3 example applications** | Without working examples, developers can't validate the framework |
| 18 | **Mandatory fallback on LiquidView** | TypeScript error if missing — safety guarantee |

**Can be manual / deferred initially (Nice-to-haves removed from MVP):**

| Item | Why It Can Wait | Deferred To |
|------|----------------|-------------|
| Vue / Angular / Svelte adapters | React proves the model; other adapters follow the same pattern | Phase 2 |
| AG-UI / A2UI / MCP protocol adapters | Core value doesn't depend on protocol integration | Phase 2 |
| SSR / SSG (Next.js) | Client-side rendering covers MVP scenarios | Phase 2 |
| Browser DevTools extension | Inline debug overlay covers Phase 1 debugging needs | Phase 2 |
| Multi-view coordination (batched/coordinated) | Independent mode sufficient for MVP examples | Phase 2 |
| Ollama / Mistral / Gemini connectors | OpenAI + Anthropic cover primary use cases | Phase 2 |
| Compliance suite (HIPAA, GDPR, SOC2) | Custom validators provide basic compliance hooks | Phase 3 |
| Design system integration | Component Registry handles individual registration | Phase 3 |
| Analytics / A/B testing | Observability traces provide raw data; analytics is Phase 3 | Phase 3 |
| i18n | English-only examples for Phase 1 | Phase 3 |
| On-device LLM | Cache + fallback covers offline scenarios | Phase 4 |
| Visual no-code editor | Developer-only API for Phase 1 | Phase 4 |

### Post-MVP Features

**Phase 2 — Growth (6-12 months):**

| Priority | Feature | Strategic Rationale |
|----------|---------|-------------------|
| P0 | Framework adapters (Vue 3, Angular 17+, Svelte 5) | Expand addressable market beyond React developers |
| P0 | Protocol adapters (AG-UI, A2UI, MCP) | Interoperability with ecosystem; enterprises expect protocol support |
| P0 | SSR/SSG (Next.js App Router, Nuxt 3) | Enterprise apps require server rendering; Next.js is dominant |
| P1 | Multi-view coordination (batched + coordinated) | Complex dashboards need coordinated generation |
| P1 | Browser DevTools extension | Power users and enterprise developers expect dedicated tooling |
| P1 | Additional connectors (Ollama, Mistral, Gemini) | Ollama for on-prem / sovereignty; Gemini for Google Cloud shops |
| P2 | Advanced debug (What-If, Edit Spec, pin) | Reduces debugging time further; enhances developer trust |
| P2 | Property-based tests (Tier 3) + Golden-file tests (Tier 4) | Validates generation quality systematically |

**Phase 3 — Expansion (12-24 months):**

| Priority | Feature | Strategic Rationale |
|----------|---------|-------------------|
| P0 | Enterprise compliance suite (HIPAA, GDPR, SOC2) | Unlocks enterprise revenue (Priya persona) |
| P0 | Design system integration | Enterprise clients have mandatory design systems |
| P1 | Advanced context providers (expertise learning, cognitive load, predictive intent) | Deepens the intelligence layer differentiation |
| P1 | Analytics + A/B testing for generated UIs | Data-driven generation optimization |
| P2 | i18n | Global market expansion |
| P2 | Plugin marketplace | Community ecosystem growth |

**Phase 4 — Vision (24+ months):**

- On-device LLM for offline / low-latency generation
- Multi-agent collaboration (multiple LLMs contributing to a single spec)
- Autonomous optimization (self-improving generation quality)
- Cross-application context (user context shared across Flui-powered apps)
- Visual no-code editor for non-developers

### Risk Mitigation Strategy

**Technical Risks:**

| Risk | Severity | Mitigation |
|------|----------|------------|
| **LLM generation quality insufficient for production** | High | 3-phase fallback (retry → cache → fallback). Validation pipeline catches bad specs before rendering. MockConnector enables development without depending on LLM quality. |
| **Bundle size exceeds budgets** | Medium | `size-limit` CI enforcement from Sprint 1. Per-package budgets. Tree-shaking architecture. If core approaches 25KB, aggressive code splitting. |
| **Validation pipeline adds unacceptable latency** | Medium | Validators are synchronous and fast (< 5ms total). Measured in performance budgets. If slow, validators can be parallelized or selectively skipped by developer choice. |
| **3-level cache complexity (IndexedDB)** | Medium | Memory and SessionStorage are simple. IndexedDB adapter is isolated — if it's too complex for Phase 1, L3 can be deferred to late Phase 1 with L1+L2 covering most use cases. |

**Market Risks:**

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Developers don't adopt intent-driven paradigm** | High | Progressive adoption reduces barrier. One `<LiquidView>` in an existing app, no migration. 3 working examples demonstrate value concretely, not abstractly. |
| **AG-UI/A2UI become the default and make Flui irrelevant** | Medium | Flui is complementary, not competitive. Protocol adapters in Phase 2 mean Flui works *with* AG-UI/A2UI. Intelligence layer value is orthogonal to transport protocols. |
| **A well-funded competitor launches a similar intelligence layer** | Medium | Open-source + early mover + comprehensive architecture (20 ADRs). Community building and ecosystem (Phase 2 plugin marketplace) create switching costs. |

**Resource Risks:**

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Solo developer bottleneck** | High | Architecture is modular — each module is independently implementable and testable. 6-sprint sequence designed for single developer. If blocked on one module, move to another. |
| **Scope creep** | Medium | Phase 1 spec has explicit "NOT Phase 1" list. Every feature must pass the test: "Is this needed for the 3 example apps to work with validation, caching, cost control, and observability?" |
| **Burnout / timeline slip** | Medium | 14 modules across 6 sprints is aggressive but scoped. Each sprint delivers a usable increment. If timeline slips, ship with 2 examples instead of 3. Core pipeline is non-negotiable; examples are adjustable. |

## Functional Requirements

### Intent & Context Processing

- FR1: Developers can provide a text intent describing the desired UI outcome to trigger generation
- FR2: Developers can provide intent programmatically via structured objects (component type, data shape, interaction pattern)
- FR3: The system can resolve context about the current user (identity: role, permissions, expertise level)
- FR4: The system can resolve context about the current environment (device type, viewport size, connection quality)
- FR5: Developers can register custom context providers that supply domain-specific context signals
- FR6: The system can combine multiple context signals into a unified context object for generation
- FR7: The system can sanitize user-provided intents to prevent prompt injection

### Component Management

- FR8: Developers can register UI components with the framework, declaring accepted props via schema
- FR9: Developers can register components with metadata (name, category, description) for LLM component selection
- FR10: Developers can batch-register multiple components in a single operation
- FR11: Developers can query the component registry to discover registered components by category or capability
- FR12: The system can serialize the component registry into a format suitable for LLM prompt construction
- FR13: The system can validate component registration metadata at registration time, rejecting invalid definitions

### UI Generation

- FR14: The system can generate a declarative UI specification (JSON) from an intent, context, and component registry using an LLM
- FR15: The system can construct prompts that include component registry metadata, context signals, and generation rules
- FR16: The system can parse and validate LLM responses into structured UISpecification objects
- FR17: The system can stream LLM responses and progressively construct the UISpecification
- FR18: Developers can connect any LLM provider (OpenAI, Anthropic, or custom) via a connector interface
- FR19: The system can render a validated UISpecification into actual React components
- FR20: The system can wire data flows between generated components as defined in the specification (InteractionSpec)
- FR21: The system can manage view state (local state within generated components) across re-generations
- FR22: The system can apply visual transitions when replacing one generated UI with another
- FR23: Developers can provide a mandatory fallback UI that renders when generation fails or is unavailable
- FR24: The system can resolve data identifiers referenced in generated specifications via developer-defined data resolvers

### Validation & Safety

- FR25: The system can validate every generated specification against a JSON schema before rendering
- FR26: The system can validate that generated specifications only reference registered components
- FR27: The system can validate that generated component props conform to their declared schemas
- FR28: The system can validate generated specifications for WCAG AA accessibility compliance
- FR29: The system can validate that generated specifications do not reference unauthorized data sources
- FR30: Developers can add custom validators to the validation pipeline (e.g., brand rules, compliance rules, mobile constraints)
- FR31: The validation pipeline can reject invalid specifications and provide structured error details
- FR32: The system can retry generation with modified prompts when validation fails
- FR33: The validation pipeline cannot be bypassed — every generated specification must pass through it before rendering
- FR34: The system can activate a circuit breaker after consecutive generation failures, locking to fallback mode

### Cost & Performance Control

- FR35: Developers can configure cost budgets per session and per time period (e.g., daily)
- FR36: The system can estimate generation cost before making an LLM call based on prompt size
- FR37: The system can enforce budget limits synchronously, preventing LLM calls that would exceed the budget
- FR38: The system can gracefully degrade to cached specifications when budget limits are reached
- FR39: The system can cache generated specifications at three levels (in-memory, session storage, persistent storage)
- FR40: Developers can configure cache TTL per intent category
- FR41: The system can serve cached specifications for repeated intent+context combinations within TTL
- FR42: The system can cancel in-flight generation requests when a newer request supersedes them (latest-wins)
- FR43: The system can control generation policy (when to generate vs. serve from cache vs. show fallback)

### Observability & Debugging

- FR44: The system can produce a structured trace for every generation (intent, context, components selected, validation result, latency, cost)
- FR45: The system can transport traces to configurable destinations (console, in-memory buffer, custom transports)
- FR46: Developers can access a debug overlay that displays the current UISpecification (Spec tab)
- FR47: Developers can access a debug overlay that displays the generation trace (Trace tab)
- FR48: Developers can search and filter generation traces by timestamp, intent, or context attributes
- FR49: The system can report cost metrics (per-generation cost, cumulative session cost, daily cost)
- FR50: The system can report cache metrics (hit rate, miss rate, eviction count)
- FR51: Developers can export generation traces via a transport interface for integration with external systems (SIEM, log aggregators)

### Developer Experience & Testing

- FR52: Developers can install and use the framework with zero configuration beyond providing an LLM API key
- FR53: Developers can add a single LiquidView component to an existing React application without modifying other components
- FR54: Developers can test LiquidView components using a deterministic mock connector that requires no LLM API key
- FR55: Developers can programmatically generate UISpecification objects for assertion testing
- FR56: Developers can mount and test LiquidView components with assertion helpers
- FR57: The framework can provide typed error codes with descriptive messages for all failure modes
- FR58: The framework can emit TypeScript compilation errors for common misconfigurations (e.g., missing fallback prop)

## Non-Functional Requirements

### Performance

| NFR | Requirement | Measurement Method |
|-----|-------------|-------------------|
| NFR-P1 | Generation latency P50 < 500ms, P99 < 2,000ms (excluding LLM network time) | Observability traces measuring orchestrator overhead |
| NFR-P2 | Validation pipeline total execution < 5ms for standard validator set (schema + component + prop + a11y + data) | Benchmark tests on 50-component specs |
| NFR-P3 | Cache lookup (L1 in-memory) < 1ms | Unit benchmark |
| NFR-P4 | Cache lookup (L2 session storage) < 5ms | Unit benchmark |
| NFR-P5 | Cache lookup (L3 IndexedDB) < 20ms | Integration benchmark |
| NFR-P6 | `@flui/core` bundle size < 25KB gzipped | `size-limit` CI check |
| NFR-P7 | `@flui/react` bundle size < 8KB gzipped | `size-limit` CI check |
| NFR-P8 | Each LLM connector bundle size < 3KB gzipped | `size-limit` CI check |
| NFR-P9 | LiquidView component mount-to-fallback render < 16ms (one frame) | React profiler measurement |
| NFR-P10 | Tree-shaking removes unused validators, context providers, and cache storages from consumer bundles | Bundle analysis of minimal example app |

### Security

| NFR | Requirement | Measurement Method |
|-----|-------------|-------------------|
| NFR-S1 | LLM output is declarative-only (JSON specification) — no executable code paths in generated output | Architecture review + static analysis of spec renderer |
| NFR-S2 | Intent Parser sanitizes user-provided text to prevent prompt injection patterns | Security test suite with known injection patterns |
| NFR-S3 | DataResolver rejects data identifiers not explicitly provided in context | Integration tests with unauthorized identifier attempts |
| NFR-S4 | Component Registry validates all metadata at registration time — no malformed component definitions accepted at runtime | Unit tests with invalid registration attempts |
| NFR-S5 | Observability traces support field-level redaction for PII-sensitive context attributes (role, permissions) | Unit tests verifying redaction configuration |
| NFR-S6 | LLM API keys are never logged, cached, or included in observability traces | Grep-based audit of trace output + code review |
| NFR-S7 | No `eval()`, `new Function()`, `innerHTML`, or dynamic script injection anywhere in the framework | Static analysis rule (Biome/ESLint) |
| NFR-S8 | npm packages published with provenance (SLSA) for supply chain verification | npm publish workflow verification |

### Accessibility

| NFR | Requirement | Measurement Method |
|-----|-------------|-------------------|
| NFR-A1 | All generated UISpecifications pass WCAG 2.1 AA validation before rendering | Accessibility validator in pipeline with 100% coverage |
| NFR-A2 | Focus management is maintained across spec transitions (focus does not jump to document body on re-generation) | Automated accessibility tests with focus tracking |
| NFR-A3 | Generated specifications include ARIA labels, roles, and live regions as required by component type | Schema validation rules for ARIA attributes |
| NFR-A4 | Debug overlay is keyboard-navigable and screen-reader accessible | Manual + automated a11y testing of overlay |
| NFR-A5 | LiquidView announces spec transitions to assistive technology via ARIA live regions | Screen reader testing |

### Reliability

| NFR | Requirement | Measurement Method |
|-----|-------------|-------------------|
| NFR-R1 | Fallback UI renders in 100% of LLM failure scenarios (timeout, network error, rate limit, malformed response) | Chaos testing with simulated failure modes |
| NFR-R2 | Circuit breaker activates after 3 consecutive generation failures, locking to fallback mode | Integration tests with consecutive failures |
| NFR-R3 | Application continues functioning (with cached/fallback UIs) during complete LLM provider outage | Integration test with mocked provider returning 503 |
| NFR-R4 | Concurrency controller cancels stale requests cleanly — no orphaned promises, no memory leaks | Unit tests with rapid request sequences + memory profiling |
| NFR-R5 | Cache corruption (invalid stored specs) is detected and evicted — does not crash the application | Integration tests with corrupted cache entries |
| NFR-R6 | Framework initialization failure (invalid config) throws descriptive error at startup, not at first generation | Unit tests with invalid configurations |

### Integration

| NFR | Requirement | Measurement Method |
|-----|-------------|-------------------|
| NFR-I1 | LLM connector interface is provider-agnostic — implementing a new connector requires only the `LLMConnector` interface (< 100 lines typical) | Verified by OpenAI and Anthropic connector implementations |
| NFR-I2 | Observability transport interface supports async transports for external system integration (HTTP, WebSocket) | Interface type check + mock transport integration test |
| NFR-I3 | Framework has zero dependency on specific React state management (Redux, Zustand, Jotai) — works with any or none | Integration tests with vanilla React (no state library) |
| NFR-I4 | Framework does not conflict with existing React context providers in the host application | Integration test with common provider patterns |
| NFR-I5 | Custom validators, context providers, and transports can be distributed as standalone npm packages with `@flui/core` as peer dependency | Validated by plugin packaging example |

### Maintainability

| NFR | Requirement | Measurement Method |
|-----|-------------|-------------------|
| NFR-M1 | Test coverage on `@flui/core` > 90% (line coverage) | Vitest coverage report in CI |
| NFR-M2 | Zero `any` types in public API surface | TypeScript strict mode + custom lint rule |
| NFR-M3 | All public APIs documented with TSDoc comments | Documentation coverage tool |
| NFR-M4 | Biome linting passes with zero warnings on all packages | CI lint step |
| NFR-M5 | Each module is independently testable without requiring other modules (except declared dependencies) | Module dependency graph analysis + isolated test suites |
| NFR-M6 | Breaking API changes are detected by a public API surface snapshot test | API extractor or equivalent in CI |
