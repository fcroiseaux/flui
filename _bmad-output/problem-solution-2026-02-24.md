# Problem Solving Session: Enriching the Flui Framework Vision into an Actionable Architecture Reference

**Date:** 2026-02-24
**Problem Solver:** Fabrice
**Problem Category:** Strategic Vision Validation & Architecture Specification

---

## 🎯 PROBLEM DEFINITION

### Initial Problem Statement

The Flui framework vision document (docs/flui-framework-vision.md) is a comprehensive ~1300-line document covering the full scope of an LLM-native, intent-driven frontend framework. However, before entering Phase 1 development (with LLM-assisted coding), the document needs to be stress-tested for blind spots and enriched with enough architectural precision to serve as the primary context document for AI-assisted development sessions.

### Refined Problem Statement

**The Flui vision document is strong as a strategic vision but may contain gaps, contradictions, or under-specified areas that, if left unaddressed, will compound into architectural debt when used as the primary reference document for LLM-assisted development.** The document needs to be validated for completeness and translated from "what we want to build" into "how we will build it" — with enough precision that an LLM reading it can make correct implementation decisions without ambiguity.

### Problem Context

- **Document scope**: 14 sections covering executive summary, problem statement, thesis, design principles, architecture, core modules, DX, differentiation, plugins, protocol compatibility, security, roadmap, business model, and FAQ.
- **Primary consumer**: Fabrice (solo architect/developer) + LLMs used for development.
- **Development approach**: AI-assisted development — the vision document serves as foundational context.
- **Framework positioning**: Open-source, framework-agnostic, LLM-native frontend framework that augments React/Vue/Angular with intent-driven UI generation.
- **Key differentiators**: Context Engine, Validation Pipeline, Observability, Mandatory Fallback, Declarative-only LLM output.
- **Current state**: Vision is written but development has not yet started.

### Success Criteria

- All architectural blind spots are identified and documented
- Contradictions or under-specified areas are surfaced and resolved
- The document contains enough precision for an LLM to make unambiguous implementation decisions for Phase 1
- Critical "how" questions are answered, not just "what" questions
- Edge cases, failure modes, and technical risks are explicitly addressed
- The enriched document can serve as a reliable single source of truth for AI-assisted development

---

## 🔍 DIAGNOSIS AND ROOT CAUSE ANALYSIS

### Problem Boundaries (Is/Is Not)

| Dimension | IS | IS NOT |
|-----------|-----|--------|
| **Document type** | Strategic vision + high-level architecture + API surface sketch | Implementation specification, data model spec, performance budget, detailed error handling guide |
| **Audience served** | Investors, community, high-level technical stakeholders | An LLM tasked with writing the actual code for Phase 1 |
| **What it describes** | WHAT Flui does, WHY it exists, WHAT the modules are | HOW modules interact at runtime, HOW data flows through bindings, HOW state is managed inside generated UIs |
| **Competitive analysis** | Clear positioning vs. CopilotKit, Hashbrown, Vercel AI SDK, A2UI | Analysis of technical risks specific to Flui's approach (latency, cost, determinism) |
| **API design** | TypeScript interfaces for core abstractions (Intent, Context, Registry, Validation) | Concrete implementation patterns, error recovery flows, concurrency handling, caching strategy |
| **Scope** | Full framework vision (Phase 1-4) | Focused Phase 1 implementation spec with hard boundaries |
| **Testing** | High-level test examples | Strategy for testing non-deterministic LLM output, integration test architecture, performance benchmarks |
| **Security** | Threat model + declarative-only principle | Prompt injection defense specifics, rate limiting, cost control, abuse prevention |

**Pattern that emerges:** The document excels at "what and why" but systematically under-specifies "how" — particularly for runtime behaviors that only surface when you actually try to build it. This is normal for a vision document, but problematic when the document becomes the primary context for AI-assisted development.

### Root Cause Analysis

**Method: Five Whys + Systems Thinking**

**Why does the vision document have blind spots?**
→ Because it was written as a vision/pitch document, optimized for communicating the "why" and "what" to a broad audience.

**Why wasn't it written as an implementation spec?**
→ Because at vision stage, the priority is validating the concept and positioning — implementation details follow later.

**Why is this now a problem?**
→ Because the development approach is LLM-assisted, meaning the vision document will serve as the PRIMARY context window for AI coding sessions. An LLM cannot infer unstated architecture decisions — it will either guess (dangerously) or ask (slowing development).

**Why can't the LLM just figure it out?**
→ Because several critical "how" questions have multiple valid answers (e.g., state management, caching, data binding), and choosing wrong creates architectural debt that compounds across modules.

**ROOT CAUSE:** The document was written for human readers who can infer, ask follow-ups, and hold ambiguity. It now needs to serve machine readers who require explicit, unambiguous specifications to make correct implementation decisions.

### Contributing Factors

1. **Natural vision-document bias**: Vision documents prioritize inspiration over implementation. The Flui doc does this well — perhaps too well for its new role as an AI development reference.

2. **Implicit assumptions**: Several fundamental concerns (state management, data binding, caching) are so foundational that they were implicitly assumed rather than explicitly specified. A human architect "knows" these need solving; an LLM doesn't.

3. **Forward-looking scope creep**: The document describes Phases 1-4 without hard boundaries on what Phase 1 MUST vs. MUST NOT include. This creates ambiguity about scope.

4. **Missing failure mode thinking**: The document describes the happy path thoroughly (intent → generate → validate → render) but under-specifies failure paths, edge cases, and degraded states.

5. **No performance constraints**: No latency budgets, cost budgets, or bundle size targets. These constraints fundamentally shape architecture decisions.

### System Dynamics

```
┌─────────────────────────────────────────────────────────┐
│              FEEDBACK LOOP: AMBIGUITY AMPLIFICATION      │
│                                                          │
│   Vision Document (ambiguous on "how")                   │
│         │                                                │
│         ▼                                                │
│   LLM reads document as context                          │
│         │                                                │
│         ▼                                                │
│   LLM makes implementation choices (possibly wrong)      │
│         │                                                │
│         ▼                                                │
│   Wrong choices create architectural debt                 │
│         │                                                │
│         ▼                                                │
│   Debt compounds across dependent modules                │
│         │                                                │
│         ▼                                                │
│   Late discovery → costly rework                          │
│         │                                                │
│         ▼                                                │
│   Rework creates inconsistency with vision               │
│         │                                                │
│         └──────────── (reinforcing loop) ────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Leverage point:** Enriching the vision document BEFORE development starts breaks the amplification loop at the source. Every ambiguity resolved now prevents N downstream errors.

---

## 📊 ANALYSIS

### Force Field Analysis

**Driving Forces (Supporting Solution):**

| Force | Strength | Notes |
|-------|----------|-------|
| AI-assisted development demands precision | **Strong** | The LLM-as-developer model punishes ambiguity heavily |
| Solo developer — single decision-maker | **Strong** | No committee friction; Fabrice can enrich and decide fast |
| Document already exists and is comprehensive | **Strong** | We're enriching, not writing from scratch — 80% is done |
| Pre-development timing | **Strong** | No existing code to contradict; changes are free |
| Deep domain knowledge (Fabrice) | **Strong** | The answers exist in Fabrice's head — they just need extraction |

**Restraining Forces (Blocking Solution):**

| Force | Strength | Notes |
|-------|----------|-------|
| Analysis paralysis risk | **Medium** | Could over-specify and never start building |
| Some answers require prototyping | **Medium** | Certain "how" questions (e.g., streaming UX) can only be answered by building |
| Document length already ~1300 lines | **Low** | Adding more could make it unwieldy — need structured approach |
| Cognitive load of solo analysis | **Low** | Hard to see your own blind spots — but that's why we're here |

### Constraint Identification

**Primary constraint (bottleneck):** The document needs to be enriched WITHOUT becoming an unwieldy monolith. The audience is Fabrice + LLM — both need to be able to load relevant sections efficiently.

**Real constraints:**

- Phase 1 scope must be explicitly bounded — can't specify everything at once
- Some decisions genuinely require prototyping (mark these explicitly as "TBD — resolve during implementation")
- The document should remain a SINGLE source of truth (not fragment into 20 files)
- Enrichment should focus on decisions that BLOCK Phase 1 implementation

**Assumed constraints (challengeable):**

- "The document must stay in its current format" → Not necessarily. Could add appendices, decision records, or specification sections
- "Everything must be decided now" → No. Explicitly marking "decide during implementation" is a valid answer

### Key Insights

1. **The document's greatest strength is also its gap.** It's excellent at "what and why" — inspiring, clear, well-positioned. But it systematically skips "how" for the hard runtime questions. This is intentional for a vision doc but problematic for an AI-development reference.

2. **20 specific blind spots identified.** Through systematic analysis, I've identified 20 concrete gaps in the current document (detailed in the Solution Generation section below). These range from critical (state management, data binding, caching) to important (concurrency, bundle size, accessibility during re-generation).

3. **The enrichment should be ADDITIVE, not rewriting.** The existing vision is strong. We should add specification sections, not rewrite the narrative. Think: "Vision + Architecture Decision Records + Phase 1 Specification Appendix."

4. **"Decide later" is a valid specification.** For questions that genuinely require prototyping, explicitly marking them as "TBD — resolve during Sprint N" is better than guessing. An LLM reading "TBD" will ask; an LLM reading nothing will assume.

5. **The caching question is more urgent than the document suggests.** `@flui/cache` is listed as a Phase 3 plugin. But without caching, EVERY LiquidView render = LLM API call. This is a Phase 1 core requirement, not a Phase 3 plugin.

---

## 💡 SOLUTION GENERATION

### Methods Used

1. **Systems Thinking** — Tracing the full lifecycle of a LiquidView from intent to render to user interaction, identifying gaps at each transition point.
2. **Failure Mode Analysis** — For each module, asking "what could go wrong?" and checking if the vision document addresses it.
3. **TRIZ Contradiction Analysis** — Identifying inherent contradictions in the design (e.g., "LLM-agnostic" vs. "structured output dependent") and proposing resolutions.
4. **Assumption Busting** — Challenging implicit assumptions in the document to surface hidden requirements.

### Generated Solutions

**The 20 Blind Spots — organized by criticality for Phase 1:**

---

#### CRITICAL (Must resolve before Phase 1 development)

**Blind Spot #1 — State Management Inside Generated UIs**

- **Gap:** The document describes generating a UI spec and rendering it, but never addresses what happens AFTER render. When a user sorts a DataTable, filters a chart, or types in a form — where does that interaction state live? How does it persist across re-generations?
- **Why it matters:** If context changes trigger a re-generation, does the user lose their scroll position, form input, and filter state? This is the difference between "magic" and "infuriating."
- **Enrichment needed:** Define a `ViewState` model that persists interaction state across generations. Specify whether state lives in the LiquidView, the parent app, or a dedicated store. Define the merge strategy when a new spec arrives.

**Blind Spot #2 — Data Resolution and Binding**

- **Gap:** The generated spec contains `{ "type": "SalesChart", "props": { "data": "team-sales" } }` — but HOW does `"team-sales"` resolve to actual data? There is no data resolution layer described.
- **Why it matters:** Without this, the LLM generating specs doesn't know what data identifiers are valid, and the runtime doesn't know how to fetch/bind data to components.
- **Enrichment needed:** Define a `DataResolver` interface that maps data identifiers to actual data sources (API endpoints, stores, props passed to LiquidView). Specify how the component registry declares what data each component needs and how it's provided.

**Blind Spot #3 — Caching as a Core Requirement**

- **Gap:** `@flui/cache` is listed as a Phase 3 plugin. But without caching, every LiquidView render = LLM API call = 200-2000ms latency + $0.001-0.05 cost.
- **Why it matters:** A page with 3 LiquidViews and no caching means 3 LLM calls on every page load. Users will perceive Flui as "slow and expensive" immediately.
- **Enrichment needed:** Move caching to `@flui/core`. Define a cache key strategy (intent + context hash → spec). Define cache invalidation rules (context change thresholds, TTL, explicit invalidation). Define cache levels: memory (session), persistent (localStorage/IndexedDB), server-side.

**Blind Spot #4 — Re-generation Strategy and Triggers**

- **Gap:** When should a LiquidView re-generate? On every context signal change? Only on intent change? What about debouncing? Partial re-generation?
- **Why it matters:** If the cognitive load signal fluctuates every 30 seconds, does the entire UI regenerate constantly? This would be chaotic.
- **Enrichment needed:** Define a `GenerationPolicy` that specifies: trigger conditions (which context changes warrant re-generation), debouncing/throttling, partial vs. full re-generation, and a stability mechanism (don't re-generate if the new context would produce the same spec).

**Blind Spot #5 — Concurrency and Race Conditions**

- **Gap:** What happens if context changes while a generation is in-flight? What if the user changes intent before the previous generation completes?
- **Why it matters:** Without cancellation/superseding logic, stale generations could overwrite fresh ones, creating a flickering, inconsistent UI.
- **Enrichment needed:** Define a generation request lifecycle: pending → in-flight → completed/cancelled/superseded. Specify that new requests cancel in-flight ones (AbortController pattern). Define how the Orchestrator handles concurrent requests.

**Blind Spot #6 — Cost Control and Budgeting**

- **Gap:** Zero mention of LLM cost management anywhere in the document.
- **Why it matters:** In production, uncontrolled LLM calls can generate surprise bills. For adoption, developers need to understand and control costs.
- **Enrichment needed:** Define cost-awareness at the Orchestrator level: per-session budgets, per-view budgets, cost estimation before generation, degradation to cached/fallback when budget exceeded. Include cost in the GenerationTrace.

**Blind Spot #7 — Prompt Size Management**

- **Gap:** The prompt includes the serialized component registry + context + rules + intent. But what if there are 200 registered components? The prompt could exceed the LLM's context window.
- **Why it matters:** Prompt size directly impacts latency, cost, and quality. Overly long prompts degrade LLM performance.
- **Enrichment needed:** Define a prompt budget strategy: component pre-filtering (only include components relevant to the intent/context), context summarization, progressive prompt construction, and a maximum prompt size configuration.

---

#### HIGH IMPORTANCE (Should resolve before or during Phase 1)

**Blind Spot #8 — Inter-component Communication**

- **Gap:** If a generated layout has a filter dropdown and a data table, how do they communicate? The spec is declarative but doesn't describe interactions.
- **Enrichment needed:** Define an `InteractionSpec` model (partially hinted at in the UISpecification interface but never elaborated). Specify event-based communication: component A emits event → component B reacts. Define how the LLM specifies these interactions in the generated spec.

**Blind Spot #9 — Generation Latency UX**

- **Gap:** Beyond fallback, what's the user experience DURING generation? The fallback handles failure — but what about the 200-500ms of normal operation?
- **Enrichment needed:** Define loading states: instant fallback → skeleton/shimmer → progressive component appearance as streaming delivers them. Specify the transition animation strategy. Define the "perceptible latency threshold" below which no loading state is shown.

**Blind Spot #10 — Testing Non-deterministic LLM Output**

- **Gap:** The test example shows `expect(result.componentsSelected).toContain('KPICard')` — but LLM output is non-deterministic. The same intent may produce different valid specs.
- **Enrichment needed:** Define testing tiers: (1) Unit tests with MockConnector (deterministic), (2) Contract tests that validate spec SHAPE not exact content, (3) Property-based tests that assert constraints (e.g., "mobile always ≤ 3 components"), (4) Golden-file tests with real LLMs run in CI periodically.

**Blind Spot #11 — Error Recovery Details**

- **Gap:** The validation pipeline supports retry/fallback/block, but: How many retries? Same prompt or modified? Exponential backoff? What telemetry on persistent failures?
- **Enrichment needed:** Define retry strategy per validator (max retries, prompt modification strategy, backoff). Define a "circuit breaker" pattern: if an intent consistently fails generation, stop trying and use fallback permanently until conditions change.

**Blind Spot #12 — Multi-LiquidView Coordination**

- **Gap:** A page might have multiple LiquidViews. Do they generate independently? Can they share context? Batch generation?
- **Enrichment needed:** Define coordination modes: independent (default), batched (single LLM call for multiple views — cost efficient), and coordinated (views are aware of each other's specs for layout coherence). Specify the FluiProvider's role in orchestrating multi-view pages.

**Blind Spot #13 — TypeScript Type Safety Through the Pipeline**

- **Gap:** Interfaces are defined but the type safety story for the full pipeline is unclear. How are generated specs validated against component prop types at runtime?
- **Enrichment needed:** Define runtime type validation (Zod schemas generated from component registration). Specify how the propValidator works concretely. Define the developer experience for type errors in generated specs.

**Blind Spot #14 — Accessibility During Re-generation**

- **Gap:** The a11y validator checks the output spec, but what about the dynamic experience? Focus management when UI re-generates? ARIA live regions? Screen reader announcements?
- **Enrichment needed:** Define a11y rules for dynamic UI changes: focus preservation/restoration strategy, ARIA live region for generation status, announcement of significant layout changes, respecting `prefers-reduced-motion`.

---

#### IMPORTANT (Should document, can resolve during Phase 1-2)

**Blind Spot #15 — Performance Budget**

- **Gap:** No latency targets, no bundle size targets, no cost-per-generation targets.
- **Enrichment needed:** Define concrete targets: generation latency P50 < 500ms, P99 < 2s. Core bundle < 30KB gzipped. Adapter < 10KB. Target cost per generation < $0.01 for common cases.

**Blind Spot #16 — Server-Side Generation Architecture**

- **Gap:** SSR mentioned in FAQ but not architected. How does it work with Next.js/Nuxt? How does streaming work server-side?
- **Enrichment needed:** Define SSG (build-time generation for known intents), SSR (server-side generation on request), and CSR (client-side, current default). Specify integration with Next.js App Router and Nuxt 3.

**Blind Spot #17 — Spec Versioning and Migration**

- **Gap:** No mention of UISpecification schema versioning. Cached specs may become invalid when the schema evolves.
- **Enrichment needed:** Add a `specVersion` field to UISpecification. Define forward-compatibility rules and cache invalidation on version bump.

**Blind Spot #18 — Bundle Size Strategy**

- **Gap:** Framework-agnostic core + adapters + connectors + validators — could become heavy.
- **Enrichment needed:** Define tree-shaking strategy. Core must be modular: import only what you use. Define maximum bundle sizes per package.

**Blind Spot #19 — Developer Debugging Beyond DevTools**

- **Gap:** DevTools show traces, but how does a developer debug a BAD generation in the moment? Override it? Pin a known-good spec? Edit a spec manually?
- **Enrichment needed:** Define a debug mode: `<LiquidView debug>` that shows the raw spec, allows manual editing, and provides a "regenerate with modified context" button. Define a "pin" mechanism to lock a LiquidView to a specific spec during development.

**Blind Spot #20 — Offline Story for Phase 1**

- **Gap:** `@flui/offline` is Phase 4, but the fallback mechanism IS the offline story. This should be explicit.
- **Enrichment needed:** Clarify that Phase 1 offline = fallback rendering. No LLM = fallback always. Define how cached specs can serve as an intermediate "semi-offline" mode (better than fallback, doesn't need LLM).

### Creative Alternatives

Beyond filling blind spots, three structural ideas for enriching the document:

**Alternative A — Architecture Decision Records (ADRs)**
Add an appendix of numbered ADRs (ADR-001, ADR-002...) for each major architectural decision. Format: Context → Decision → Consequences. This is the most LLM-friendly format — clear, bounded, unambiguous.

**Alternative B — Phase 1 Specification Appendix**
Add a separate "Phase 1 Implementation Specification" section that hard-scopes Phase 1: exactly which modules, which features of each module, what's deferred. Include concrete TypeScript interfaces with Zod runtime schemas.

**Alternative C — Executable Specification via Test Cases**
Define the specification AS test cases. Instead of prose describing how caching should work, write the test: `test('same intent+context within TTL returns cached spec')`. This is unambiguous, machine-readable, and doubles as the acceptance criteria.

---

## ⚖️ SOLUTION EVALUATION

### Evaluation Criteria

| Criterion | Weight | Description |
|-----------|--------|-------------|
| **LLM-readability** | 30% | Can an LLM parse this format and make unambiguous decisions? |
| **Completeness** | 25% | Does it cover all 20 blind spots? |
| **Maintainability** | 20% | Can the document be updated as decisions evolve? |
| **Effort to produce** | 15% | How much work to create the enrichment? |
| **Non-disruption** | 10% | Does it preserve the existing vision document's strength? |

### Solution Analysis

| Alternative | LLM-readability | Completeness | Maintainability | Effort | Non-disruption | **Score** |
|-------------|----------------|--------------|-----------------|--------|----------------|-----------|
| **A — ADRs** | 9/10 | 8/10 | 9/10 | 6/10 | 9/10 | **8.35** |
| **B — Phase 1 Spec Appendix** | 7/10 | 9/10 | 6/10 | 7/10 | 8/10 | **7.45** |
| **C — Executable Test Specs** | 8/10 | 7/10 | 7/10 | 5/10 | 9/10 | **7.25** |
| **A+B Combined** | 9/10 | 10/10 | 8/10 | 5/10 | 8/10 | **8.35** |
| **A+B+C Combined** | 10/10 | 10/10 | 8/10 | 3/10 | 8/10 | **8.15** |

### Recommended Solution

**Combine Alternative A (ADRs) + Alternative B (Phase 1 Spec Appendix)**, structured as follows:

1. **Keep the existing vision document untouched** as `docs/flui-framework-vision.md` — it serves its purpose perfectly as the strategic narrative.

2. **Create `docs/flui-architecture-decisions.md`** — A numbered set of Architecture Decision Records addressing each of the 20 blind spots. Format: Context → Decision → Consequences → Status (Decided / Proposed / TBD).

3. **Create `docs/flui-phase1-spec.md`** — A focused Phase 1 implementation specification that:
   - Hard-scopes Phase 1 (what's in, what's explicitly out)
   - References ADRs for each decision
   - Includes concrete TypeScript interfaces with implementation notes
   - Defines performance budgets and acceptance criteria
   - Marks "TBD — resolve during implementation" where prototyping is needed

4. **Optionally, later add test specs** (Alternative C) as development begins — these emerge naturally from the ADRs and Phase 1 spec.

### Rationale

- **ADRs are the most LLM-friendly format.** They're structured, bounded, and unambiguous. An LLM reading "ADR-003: Caching is a core requirement, not a plugin. Cache key = hash(intent + context). TTL = configurable, default 5 minutes." will make correct implementation decisions.

- **The Phase 1 spec provides scope discipline.** Without it, an LLM might try to implement Phase 3 features in Phase 1, or skip core features thinking they're "optional."

- **Separating documents preserves the vision's strength.** The vision document is a compelling narrative. Polluting it with implementation details would weaken both purposes. Three focused documents > one bloated one.

- **The effort is manageable.** The 20 blind spots are already identified. Writing ADRs is structured and fast. The Phase 1 spec is a scoping exercise, not a writing exercise.

- **This approach scales.** As development progresses, new ADRs can be added, and Phase 2/3 specs can follow the same pattern.

---

## 🚀 IMPLEMENTATION PLAN

### Implementation Approach

**Strategy: Phased document enrichment — ADRs first, then Phase 1 spec.**

Write the ADRs first because they force explicit decisions. Then use the ADRs as input to write the Phase 1 spec. This creates a natural dependency chain where each document informs the next.

### Action Steps

**Batch 1 — Architecture Decision Records (Critical blind spots 1-7)**

| Step | Action | Output |
|------|--------|--------|
| 1.1 | Create `docs/flui-architecture-decisions.md` with ADR template | File structure |
| 1.2 | Write ADR-001: State Management Inside Generated UIs | Decision on ViewState model |
| 1.3 | Write ADR-002: Data Resolution and Binding | Decision on DataResolver interface |
| 1.4 | Write ADR-003: Caching Strategy (Core, not Plugin) | Decision on cache architecture |
| 1.5 | Write ADR-004: Re-generation Strategy and Triggers | Decision on GenerationPolicy |
| 1.6 | Write ADR-005: Concurrency and Request Lifecycle | Decision on cancellation/superseding |
| 1.7 | Write ADR-006: Cost Control and Budgeting | Decision on cost-awareness layer |
| 1.8 | Write ADR-007: Prompt Size Management | Decision on prompt budget strategy |

**Batch 2 — Architecture Decision Records (High-importance blind spots 8-14)**

| Step | Action | Output |
|------|--------|--------|
| 2.1 | Write ADR-008: Inter-component Communication | Decision on event model |
| 2.2 | Write ADR-009: Generation Latency UX | Decision on loading/transition strategy |
| 2.3 | Write ADR-010: Testing Strategy for Non-deterministic Output | Decision on test tiers |
| 2.4 | Write ADR-011: Error Recovery and Circuit Breaker | Decision on retry/breaker patterns |
| 2.5 | Write ADR-012: Multi-LiquidView Coordination | Decision on coordination modes |
| 2.6 | Write ADR-013: Runtime Type Safety | Decision on Zod/runtime validation |
| 2.7 | Write ADR-014: Accessibility During Dynamic Re-generation | Decision on focus/ARIA strategy |

**Batch 3 — Architecture Decision Records (Important blind spots 15-20)**

| Step | Action | Output |
|------|--------|--------|
| 3.1 | Write ADR-015: Performance Budgets | Concrete latency/size/cost targets |
| 3.2 | Write ADR-016: Server-Side Generation Architecture | SSG/SSR/CSR strategy |
| 3.3 | Write ADR-017: Spec Versioning and Migration | Decision on versioning approach |
| 3.4 | Write ADR-018: Bundle Size Strategy | Tree-shaking and size limits |
| 3.5 | Write ADR-019: Developer Debug Mode | Decision on debug tooling |
| 3.6 | Write ADR-020: Offline Strategy for Phase 1 | Decision on fallback + cached specs |

**Batch 4 — Phase 1 Implementation Specification**

| Step | Action | Output |
|------|--------|--------|
| 4.1 | Define Phase 1 hard scope (in/out boundary) | Scope document section |
| 4.2 | Write Phase 1 module specs (referencing ADRs) | Detailed per-module specs |
| 4.3 | Define Phase 1 acceptance criteria | Testable criteria list |
| 4.4 | Define Phase 1 performance budgets | Concrete targets |
| 4.5 | Review complete document set for consistency | Final validation |

### Timeline and Milestones

| Milestone | Deliverable |
|-----------|-------------|
| **M1** | ADRs 1-7 (Critical) written and validated |
| **M2** | ADRs 8-14 (High) written and validated |
| **M3** | ADRs 15-20 (Important) written and validated |
| **M4** | Phase 1 Implementation Specification complete |
| **M5** | All three documents reviewed for consistency — ready for development |

### Resource Requirements

- **Fabrice's domain knowledge**: Required for all ADR decisions — the analysis identifies the questions, but only Fabrice can make the final architectural calls
- **LLM assistance**: Can draft ADRs from the blind spot descriptions, but Fabrice must validate decisions
- **No external dependencies**: This is a documentation exercise — no code, no tools, no infrastructure needed

### Responsible Parties

| Role | Who | Responsibility |
|------|-----|----------------|
| **Decision maker** | Fabrice | Final call on all architectural decisions in ADRs |
| **Drafter** | LLM (Claude) | Draft ADRs and Phase 1 spec based on blind spot analysis |
| **Reviewer** | Fabrice | Validate each batch before proceeding to next |

---

## 📈 MONITORING AND VALIDATION

### Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Blind spot coverage** | 20/20 addressed | Count ADRs with status "Decided" or "TBD with rationale" |
| **Ambiguity reduction** | Zero ambiguous "how" questions for Phase 1 scope | Review Phase 1 spec — every module should have clear implementation guidance |
| **LLM usability test** | LLM can answer implementation questions without guessing | Feed documents to Claude, ask Phase 1 implementation questions, verify answers are correct and unambiguous |
| **Phase 1 scope clarity** | Clear in/out boundary | Every feature explicitly listed as "Phase 1" or "Deferred to Phase N" |
| **Decision completeness** | All ADRs have a status | No ADR left as "Undecided" without a clear resolution path |

### Validation Plan

1. **Self-review (per batch):** After each batch of ADRs, Fabrice reviews for consistency with the vision and technical feasibility.

2. **LLM stress test:** Feed the complete document set (vision + ADRs + Phase 1 spec) to Claude and ask it to:
   - "Describe how you would implement the Generation Orchestrator for Phase 1"
   - "What happens when a user sorts a DataTable inside a LiquidView and then context changes?"
   - "How would you implement caching for LiquidView?"
   - If the LLM's answers are correct and consistent with the ADRs, the documents are sufficient.

3. **First implementation session:** The ultimate validation is the first AI-assisted coding session. If the LLM makes correct architectural decisions based on the documents, the enrichment was successful. If it guesses or contradicts decisions, those ADRs need strengthening.

### Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Over-specification** — spending too long on docs, never building | Medium | High | Set a hard stop: after Batch 4, start coding. Use "TBD" liberally for non-critical questions. |
| **Wrong decisions in ADRs** | Low | Medium | ADRs are explicitly designed to be revisable. Status can change from "Decided" to "Superseded" with a new ADR. |
| **Document drift** — docs become stale during development | Medium | Medium | During development, update ADR status when decisions are validated or changed. Keep documents as living references. |
| **Analysis paralysis on specific ADRs** | Medium | Low | If an ADR takes more than 15 minutes of deliberation, mark it "TBD — resolve during implementation" and move on. |

### Adjustment Triggers

- **If the LLM stress test fails for >3 questions:** More ADRs or deeper specification needed in the failing areas.
- **If first coding session produces >2 architectural mistakes:** Revisit the ADRs for those areas and add more specificity.
- **If document set exceeds ~100 pages combined:** Consider splitting Phase 1 spec into per-module documents.
- **If Fabrice feels blocked or exhausted by documentation:** Switch to coding and write ADRs retroactively as questions arise. Documentation is a tool, not a prison.

---

## 📝 LESSONS LEARNED

### Key Learnings

1. **Vision documents and implementation specs serve different audiences and purposes.** A brilliant vision doc can be a terrible implementation reference — and that's fine. The solution is additive (ADRs + spec), not rewriting the vision.

2. **AI-assisted development changes what "good documentation" means.** For human developers, some ambiguity is fine — they'll ask or figure it out. For LLM developers, every ambiguity is a potential wrong decision. This is a new documentation discipline.

3. **The "how" questions cluster around runtime behavior.** The vision brilliantly answers "what" and "why." Nearly all gaps are about runtime dynamics: state, caching, concurrency, re-generation, error recovery. This makes sense — these are the hardest things to think about before building.

4. **Caching is almost always a core concern, not a plugin.** Pattern observed: caching is frequently deferred to "later" in framework visions, but it's almost always a day-1 requirement for acceptable user experience.

5. **Explicitly marking "TBD" is a specification act.** Saying "we'll decide this during Sprint 3" is a legitimate architectural decision — it tells the LLM not to guess and the developer when to expect resolution.

### What Worked

- **Is/Is Not analysis** was the most revealing technique — it immediately exposed the systematic gap between "what" and "how."
- **Failure Mode Analysis** found blind spots that purely positive analysis would have missed (concurrency, cost overruns, prompt overflow).
- **Reading the FULL document** before analysis — understanding the complete vision prevented false-positive "gaps" that were actually addressed elsewhere.
- **Categorizing blind spots by criticality** — prevents the trap of treating all gaps equally when some are truly blocking and others are nice-to-have.

### What to Avoid

- **Don't try to resolve all 20 blind spots in one session.** Batch approach with validation between batches prevents fatigue-driven bad decisions.
- **Don't over-specify things that need prototyping.** Some questions (e.g., exact streaming UX, optimal prompt construction) are best answered by building a prototype, not writing a document.
- **Don't touch the vision document itself.** It's effective as-is. Enrichment should be additive through new documents, not by modifying the original narrative.
- **Don't let documentation become a substitute for building.** The goal is "enough specification to start building correctly" — not "perfect specification before writing a single line of code."

---

_Generated using BMAD Creative Intelligence Suite - Problem Solving Workflow_
