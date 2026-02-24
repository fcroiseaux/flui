---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - docs/flui-framework-vision.md
  - docs/flui-architecture-decisions.md
  - docs/flui-phase1-spec.md
  - _bmad-output/problem-solution-2026-02-24.md
date: 2026-02-24
author: Fabrice
project: flui
---

# Product Brief: Flui

<!-- Content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

**Flui** (Fluid UI) is an open-source, framework-agnostic, LLM-native frontend framework that enables developers to build **liquid interfaces** — user interfaces that generate and adapt themselves in real-time based on user intent, context, and constraints.

While the current GenUI ecosystem focuses on plumbing (getting LLM output into the DOM), Flui provides the **intelligence layer**: a Context Engine that understands who the user is and what they need, a Validation Pipeline that guarantees safety and compliance before any generated UI reaches the screen, and an Observability system that makes every generation decision traceable, replayable, and auditable.

Flui does not replace React, Vue, or Angular — it **augments** them. A developer can make a single component "liquid" while the rest of their application remains unchanged. The framework is LLM-agnostic (OpenAI, Anthropic, Ollama, sovereign models), protocol-compatible (AG-UI, A2UI), and designed from the ground up for production environments where security, accessibility, and cost control are non-negotiable.

**Core paradigm:** `(intent, context, constraints) → generate → validate → render`

**Phase 1 milestone:** A developer runs `npm install @flui/react` and has a working liquid view in 5 minutes — with caching, validation, cost control, and observability included by default.

---

## Core Vision

### Problem Statement

Every major frontend framework operates on the paradigm `state → render(state) → DOM`. The developer declares the UI structure at build time, and the framework makes it reactive to state changes. This paradigm assumes that the developer knows, at build time, every possible screen, layout, and interaction the user will need.

In the age of LLMs and intelligent agents, this assumption breaks. Users want to express an intent and receive the right interface for their task — adapted to their role, expertise, device, and context. The ecosystem has begun responding: AG-UI provides a transport protocol, A2UI defines a declarative format, CopilotKit and Vercel AI SDK offer chat-focused integration. But a critical gap remains:

**Everyone is solving "how to get LLM output into the DOM." Nobody is solving "how to make the right generation decisions, validate them, and keep them observable."**

This gap is particularly acute in regulated and quality-sensitive environments where unvalidated LLM output cannot reach users.

### Problem Impact

- **Developers** building adaptive interfaces must hand-roll context management, output validation, caching, cost control, and observability — or ship without them.
- **Enterprise teams** cannot adopt GenUI because existing tools lack compliance guarantees, accessibility enforcement, and audit trails.
- **Users** experience either rigid static interfaces that ignore their context, or unreliable AI-generated UIs that break accessibility, expose unauthorized data, or behave unpredictably.
- **Organizations** face uncontrolled LLM costs, non-deterministic UX quality, and inability to answer "why did user X see this interface?"

The problem grows with every LLM-powered application that ships without proper context-awareness, validation, and observability — creating a compounding debt of brittle, non-auditable generative UIs.

### Why Existing Solutions Fall Short

| Solution | What it does | What's missing |
|----------|-------------|----------------|
| **CopilotKit / AG-UI** | Transport protocol for agent-UI communication, adopted by Google, Oracle, LangChain, AWS | Protocol-level — no context engine, no validation pipeline, no generation intelligence |
| **Google A2UI** (v0.8, Dec 2025) | Declarative UI format with security-by-design (no executable code), framework-agnostic | Format-level — no context awareness, no constraint enforcement, no observability |
| **Vercel AI SDK** (v5/v6) | TypeScript toolkit for LLM integration, streaming UI, tool execution | Chat-focused — no declarative spec model, no validation pipeline, no context engine |
| **Hashbrown** | In-browser GenUI with LLM-generated components | Thin wrapper — no context awareness, no validation, no observability, no caching |
| **Custom solutions** | Hand-rolled per application | Unrepeatable, expensive to maintain, rarely production-grade |

The gap is clear: **the ecosystem has protocols and plumbing, but no intelligence layer.** No existing solution answers: "Given *this* user, *this* context, and *these* constraints — what is the *right* UI to generate, and can we *prove* it's safe?"

### Proposed Solution

Flui introduces a new rendering paradigm built on three pillars:

**Pillar 1 — The Context Engine.** Collects and interprets signals about the user (role, expertise, cognitive load), environment (device, connectivity, locale), and workflow (current phase, recent actions, related tasks). No existing framework provides this. Every GenUI tool today receives a prompt and returns UI — blind to who is asking and why.

**Pillar 2 — The Validation Pipeline.** Every generated UI specification passes through a pipeline of validators (schema, component, prop, accessibility, compliance, data authorization) before reaching the DOM. If validation fails, the pipeline self-corrects (re-prompts), degrades gracefully (renders fallback), or blocks (hard compliance constraints). A generated UI that violates WCAG or exposes unauthorized data never renders.

**Pillar 3 — Observability.** Every generation decision is logged as a structured event: intent, context, components selected, reasoning, validation result, latency, cost, fallback status. This enables debugging ("why did user X see this?"), replay ("show exactly what they saw"), audit ("prove no unauthorized data was displayed"), and optimization ("which intents cause the most fallbacks?").

The architecture is progressive (adopt one `<LiquidView>` at a time), LLM-agnostic (swap providers in one line), protocol-compatible (AG-UI and A2UI as future adapters), and secure by design (LLM generates declarative specifications, never executable code).

### Key Differentiators

1. **Intelligence, not plumbing.** Flui is the context-aware, validation-enforced intelligence layer that sits above transport protocols (AG-UI) and format specs (A2UI). It makes *decisions*, not just *connections*.

2. **Security by architecture.** The LLM never generates executable code — only declarative `UISpecification` JSON validated through a mandatory pipeline. This is not a configuration option; it's a structural guarantee.

3. **Progressive adoption.** One `<LiquidView>` in an existing React app. No big-bang migration. Same playbook that made Vue.js successful against React in 2015.

4. **Production-first design.** Caching (3-level: memory/session/IndexedDB), cost control (per-session budgets), concurrency management (latest-wins with AbortController), circuit breaker for persistent failures — all in core, not plugins.

5. **Observability as a first-class citizen.** Every generation is traceable, replayable, and auditable. This is the requirement that unlocks enterprise adoption in regulated sectors.

6. **LLM-agnostic + protocol-compatible.** Works with any LLM provider today, and designed for future interoperability with AG-UI and A2UI as protocol adapters.

7. **Timing advantage.** Protocols (AG-UI, A2UI) are stabilizing, LLM structured output is production-ready, and the market is asking for GenUI with guarantees. Flui enters at the moment when the plumbing exists but the intelligence layer is missing.

---

## Target Users

### Primary Users

#### Persona 1: Alex — The Frontend Developer Building AI-Enhanced Products

**Profile:** Mid-to-senior frontend developer (3-8 years experience), proficient in React/Next.js, working at a mid-size SaaS company or AI-first startup. Comfortable with TypeScript, familiar with LLM APIs, has experimented with CopilotKit or Vercel AI SDK.

**Context:** Alex's team is building a B2B analytics platform. The PM wants dashboards that adapt to user roles (executive sees KPIs, analyst sees drill-down tables, operator sees alerts). Today, Alex hand-codes 3 separate dashboard layouts and uses feature flags per role. Every new role or context variation means more static layouts to maintain.

**Current Pain:**

- Maintaining N static layouts for N user contexts is unsustainable as the product scales
- Tried CopilotKit for a chat-based assistant, but "chat" doesn't solve the dashboard adaptation problem
- Experimented with calling GPT-4 directly to generate React components — but the output is unpredictable, sometimes breaks accessibility, and there's no way to validate or audit what was generated
- No caching strategy — every page load costs money and adds latency
- Manager asks "why did client X see that broken layout?" and Alex has no observability to answer

**What Success Looks Like:** Alex wraps the dashboard section in a `<LiquidView>`, registers the existing chart/table/KPI components, and the framework handles role-based adaptation automatically. Generation is cached, validated for accessibility, cost-controlled, and every decision is traceable. Alex ships adaptive dashboards in days, not weeks — and sleeps well knowing the validation pipeline catches bad output before users see it.

**Motivations:** Ship faster, reduce maintenance burden, build something impressive, avoid embarrassing LLM failures in production.

---

#### Persona 2: Priya — The Enterprise Architect in a Regulated Environment

**Profile:** Senior architect or tech lead (10+ years experience) at a large enterprise (finance, healthcare, government). Responsible for evaluating and approving frontend technologies. Deep concern for compliance (WCAG, GDPR, SOC2), security, and auditability. Reports to a CTO who wants "AI-powered interfaces" but a CISO who wants guarantees.

**Context:** Priya's organization wants to modernize internal tools with adaptive interfaces — different views for different departments, expertise levels, and compliance zones. They've seen demos of GenUI tools but every evaluation ends the same way: "How do we guarantee the generated UI doesn't expose unauthorized data? How do we prove compliance? Where's the audit trail?"

**Current Pain:**

- Every GenUI tool she evaluates fails the compliance review — no validation pipeline, no observability, no data authorization enforcement
- Custom-building a validation + observability layer on top of existing tools would take 6+ months and a dedicated team
- The organization is stuck between "we need adaptive UI" and "we can't ship unvalidated LLM output"
- Needs to justify ROI to leadership while satisfying security and compliance teams

**What Success Looks Like:** Priya evaluates Flui and finds that validation (schema, accessibility, data authorization), observability (structured traces, replay capability), and cost control are built-in — not plugins, not afterthoughts. She can demonstrate to the CISO that generated UIs pass through a mandatory pipeline before rendering, that every decision is auditable, and that the framework supports custom compliance validators. The architecture review passes. The team adopts Flui progressively, starting with one internal tool.

**Motivations:** De-risk AI adoption, satisfy compliance requirements, enable innovation without compromising governance, maintain architectural control.

---

#### Persona 3: Marco — The Solo Developer / Indie Hacker

**Profile:** Full-stack developer building a SaaS product solo or with a very small team. Ships fast, values developer experience above all. Uses React/Next.js, deploys on Vercel or Cloudflare. Budget-conscious — every LLM API dollar counts. Follows the "one person framework" ethos.

**Context:** Marco is building a project management tool where the interface should adapt to the user's workflow phase (planning → execution → review). He's seen what's possible with LLM-generated UIs but doesn't have the time or team to build caching, validation, cost control, and observability from scratch.

**Current Pain:**

- Prototyped with raw LLM calls — works in demos, breaks in production (wrong components, broken accessibility, unpredictable costs)
- Can't afford $50/day in uncontrolled LLM API calls for a product with 100 users
- Doesn't have time to build a caching layer, a validation pipeline, AND ship features
- Needs something that "just works" with minimal configuration — like how Next.js simplified React deployment

**What Success Looks Like:** Marco runs `npm install @flui/react @flui/openai`, wraps his workflow view in `<LiquidView>`, registers his existing components, and has a working adaptive interface in under an hour. The 3-level cache means most renders don't even hit the LLM. The cost manager ensures he never exceeds his budget. The fallback system means the app always works, even when the LLM is down or the budget is exhausted.

**Motivations:** Ship fast, control costs, build differentiated product features, avoid infrastructure yak-shaving.

---

### Secondary Users

#### Persona 4: Sarah — The Engineering Manager / Decision Maker

**Profile:** Engineering manager or VP of Engineering who evaluates frameworks for team adoption. Cares about developer productivity, hiring implications, maintenance burden, and ecosystem maturity.

**Role in Flui's Adoption:** Sarah doesn't write Flui code herself, but she approves (or blocks) its adoption. She evaluates: Is the learning curve acceptable? Is the project maintained and funded? Does it introduce vendor lock-in? What happens if the project dies?

**Key Concerns:**

- Team ramp-up time and learning curve
- LLM-agnostic design (no vendor lock-in)
- Open-source license and governance
- Progressive adoption (can the team try it on one feature without committing?)
- Community size and ecosystem health

**What Convinces Sarah:** Progressive adoption story (one `<LiquidView>`, no migration), MIT license, LLM-agnostic connectors, comprehensive documentation, and evidence of the 5-minute onboarding experience. The fact that Flui augments React rather than replacing it means the team's existing skills transfer directly.

---

#### Persona 5: The End User of a Flui-Powered Application

**Profile:** Not a developer — the person who uses applications built with Flui. Could be a business analyst, a healthcare professional, a financial trader, or a customer support agent.

**Role:** The ultimate beneficiary. They never know Flui exists, but they experience the difference: an interface that adapts to their role, shows them what they need based on their context, and never presents unauthorized data or inaccessible layouts.

**What They Experience:** Instead of navigating through static menus to find the right view, they express what they need (through natural language, workflow context, or role-based adaptation) and receive a UI tailored to their situation. The interface feels responsive because of caching. It feels reliable because of the validation pipeline. It feels trustworthy because it never shows them data they shouldn't see.

---

### User Journey

#### Alex's Journey (Primary Developer Persona)

| Phase | Experience | Flui Touchpoint |
|-------|-----------|-----------------|
| **Discovery** | Reads a blog post or sees a conference talk about "liquid interfaces" — intrigued by the concept of intent-driven UI that goes beyond chatbots | Marketing site, demo applications, technical blog posts |
| **Evaluation** | Clones the example repo, runs the dashboard example, sees a working adaptive interface in minutes. Reads the ADR on validation pipeline — impressed that accessibility is enforced by default | Documentation, example applications, GitHub repo |
| **Onboarding** | `npm install @flui/react @flui/openai`, wraps one component in `<LiquidView>`, registers existing components. First generation works with fallback showing instantly, then adaptive UI appears | npm packages, getting-started guide, FluiProvider setup |
| **"Aha!" Moment** | Changes the context to `role: "executive"` and sees the same intent produce a completely different (and appropriate) layout. Realizes: "I didn't have to code that layout — it just *knew*" | Context Engine, Generation Orchestrator |
| **Core Usage** | Progressively wraps more sections in LiquidViews. Uses debug overlay to inspect specs and traces. Tunes cost budgets and cache TTLs. Registers custom validators for domain rules | Debug overlay, Cost Manager, Cache Manager, custom validators |
| **Long-term Value** | Flui becomes the standard pattern for adaptive sections. New features ship as component registrations + intent definitions, not as coded layouts. The team saves weeks per feature cycle | Component Registry, full framework integration |

#### Priya's Journey (Enterprise Architect Persona)

| Phase | Experience | Flui Touchpoint |
|-------|-----------|-----------------|
| **Discovery** | CISO forwards an article about "secure generative UI" — Priya investigates Flui's security model | Security documentation, threat model, ADR on declarative-only output |
| **Evaluation** | Runs compliance review: LLM never generates executable code (pass), validation pipeline is mandatory (pass), observability provides audit trail (pass), data authorization can be enforced via custom validator (pass) | Architecture docs, ADRs, validation pipeline spec |
| **Proof of Concept** | Team builds a pilot on one internal tool. Compliance team reviews generation traces, confirms no data leakage. Accessibility audit confirms WCAG enforcement | Observability Collector, a11y validator, generation traces |
| **Adoption Decision** | Presents to leadership: risk profile, cost projections (with cost manager data), compliance evidence, progressive adoption plan | Cost Manager reports, compliance reports, architecture review |
| **Rollout** | Phased adoption across internal tools, starting with lowest-risk applications. Custom compliance validators added for domain-specific rules | Plugin validators, FluiProvider configuration |

---

## Success Metrics

### User Success Metrics

Success from the developer's perspective — measured by adoption signals and developer experience outcomes:

| Metric | Target | Measurement | Persona Link |
|--------|--------|-------------|--------------|
| **Time to first liquid view** | < 5 minutes from `npm install` to working `<LiquidView>` | Timed onboarding test with fresh developer | Alex, Marco |
| **Generation relevance rate** | > 90% of generations produce contextually appropriate UI without fallback | `fallbackUsed: false` rate in Observability traces | Alex, Priya |
| **Developer confidence in output** | Zero unvalidated LLM output reaches the DOM | Validation pipeline pass rate = 100% (fail → fallback or retry, never skip) | Priya |
| **Cost predictability** | Developer can set a budget and never exceed it | Cost Manager enforces per-session/per-view limits; budget overruns = 0 | Marco |
| **Debugging capability** | Developer can answer "why did this user see this UI?" in < 2 minutes | Debug overlay shows spec + trace for any generation | Alex, Priya |
| **Progressive adoption friction** | Adding Flui to an existing React app requires zero refactoring of existing components | Integration test: existing app + one `<LiquidView>` = no breaking changes | Alex, Sarah |

### Business Objectives

Flui is an open-source framework with a dual-license / enterprise support business model (as outlined in the vision). Business success is measured in adoption, community, and ecosystem health rather than direct revenue in Phase 1.

**Phase 1 (0-6 months) — Foundation & Credibility:**

| Objective | Target | Why It Matters |
|-----------|--------|----------------|
| **Working open-source release** | All Phase 1 packages published on npm with documentation | Establishes credibility and enables community evaluation |
| **Example applications** | 3 working examples (dashboard, form wizard, content explorer) | Demonstrates real-world applicability beyond toy demos |
| **Passing acceptance criteria** | 25+ acceptance criteria from Phase 1 spec all passing | Proves production-readiness claims are not marketing |
| **Documentation completeness** | Getting-started guide, API reference, architecture explanation | Enables self-service onboarding (critical for solo dev persona) |

**Phase 2 (6-12 months) — Adoption & Community:**

| Objective | Target | Why It Matters |
|-----------|--------|----------------|
| **GitHub stars** | 1,000+ stars | Social proof and discoverability signal |
| **npm weekly downloads** | 500+ weekly downloads of `@flui/core` | Indicates active experimentation and adoption |
| **Community contributors** | 10+ external contributors (issues, PRs, plugins) | Validates the framework addresses real needs beyond the creator |
| **Conference/blog mentions** | Featured in 3+ technical publications or talks | Establishes thought leadership in the GenUI intelligence layer space |
| **Production deployments** | 5+ known production deployments | Validates production-readiness beyond benchmarks |

**Phase 3 (12-24 months) — Ecosystem & Monetization:**

| Objective | Target | Why It Matters |
|-----------|--------|----------------|
| **Enterprise pilot** | 1+ enterprise pilot with compliance review passed | Validates the enterprise adoption thesis (Priya persona) |
| **Protocol adapter adoption** | AG-UI and A2UI adapters used in production | Proves protocol-compatible positioning |
| **Revenue from enterprise support** | First paid enterprise support contract | Validates the business model |

### Key Performance Indicators

Technical KPIs that must be met for Phase 1 release — directly derived from the Phase 1 spec performance budgets and ADR decisions:

**Performance KPIs:**

| KPI | Target | Measurement Method |
|-----|--------|-------------------|
| **Generation latency (P50)** | < 500ms | Observability Collector traces in benchmark suite |
| **Generation latency (P99)** | < 2,000ms | Observability Collector traces under load |
| **Cache hit rate (repeat renders)** | > 80% for same intent+context within TTL | Cache Manager metrics |
| **Core bundle size** | < 25KB gzipped | `size-limit` CI check on `@flui/core` |
| **React adapter bundle** | < 8KB gzipped | `size-limit` CI check on `@flui/react` |
| **LLM connector bundle** | < 3KB gzipped each | `size-limit` CI check on `@flui/openai`, `@flui/anthropic` |
| **Cost per generation** | < $0.01 for common cases | Cost Manager tracking in benchmark suite |

**Quality KPIs:**

| KPI | Target | Measurement Method |
|-----|--------|-------------------|
| **Validation pipeline coverage** | 100% of generations pass through full pipeline | Observability audit — no bypass paths |
| **Accessibility enforcement** | 0 WCAG AA violations in generated specs | A11y validator test suite |
| **Test coverage** | > 90% line coverage on `@flui/core` | Vitest coverage reports |
| **Type safety** | 0 `any` types in public API surface | TypeScript strict mode + lint rules |
| **Zero-config fallback** | 100% of LiquidViews render fallback when LLM unavailable | Integration test: no LLM connector → fallback renders |

**Adoption Leading Indicators (post-launch):**

| KPI | Signal | Interpretation |
|-----|--------|---------------|
| **Issue quality** | Feature requests > bug reports (ratio > 2:1) | Framework is stable; users want more capabilities |
| **Time to first PR** | External contributor opens first PR within 30 days of launch | Documentation and architecture are accessible |
| **Stack Overflow / Discord activity** | Questions asked and answered by community members (not just maintainer) | Community is self-sustaining |
| **Connector diversity** | Community-built connectors for providers beyond OpenAI/Anthropic | Plugin architecture works; demand exists beyond initial scope |

---

## MVP Scope

### Core Features

The MVP (Phase 1) scope is precisely defined in the Phase 1 Implementation Specification. It represents the smallest version of Flui that creates real value: **a developer can `npm install @flui/react`, wrap one component in `<LiquidView>`, and have a working, validated, cached, cost-controlled liquid interface.**

**5 npm packages ship in MVP:**

| Package | Core Features | "Aha!" Enabler |
|---------|--------------|-----------------|
| **`@flui/core`** | Intent Parser (programmatic + explicit), Context Engine (identity + environment providers), Component Registry, Generation Orchestrator, Validation Pipeline (schema + component + prop + a11y + data validators), Cache Manager (L1 memory + L2 session + L3 IndexedDB), Generation Policy (trigger/debounce/stability), Concurrency Controller (latest-wins + AbortController), Cost Manager (per-session/per-view budgets), Observability Collector (console + in-memory transports) | The intelligence layer — everything that makes Flui different from raw LLM calls |
| **`@flui/react`** | `<FluiProvider>`, `<LiquidView>`, ViewState management (hybrid with developer override), transition system (basic crossfade), debug overlay (Spec tab + Trace tab) | The developer-facing API — 2 components to learn |
| **`@flui/openai`** | OpenAI connector with streaming, structured output, function calling | LLM integration for the dominant provider |
| **`@flui/anthropic`** | Anthropic connector with streaming, structured output | LLM integration for the second major provider |
| **`@flui/testing`** | `MockConnector` (deterministic), `generateSpec()` helper, `testLiquidView()` helper | Makes Flui testable from day 1 |

**14 internal modules** deliver these features across a 6-sprint implementation sequence (detailed in Phase 1 spec):

1. UISpecification Schema (the declarative JSON format)
2. Component Registry (register, query, serialize for prompt)
3. Intent Parser (explicit + programmatic intent resolution)
4. Context Engine (pluggable providers, merge strategy)
5. Generation Orchestrator (prompt assembly → LLM call → response parsing)
6. Validation Pipeline (ordered validators, retry/fallback/block modes)
7. Cache Manager (3-level, TTL-based, intent+context hash keys)
8. Generation Policy (trigger conditions, debounce, stability check)
9. Concurrency Controller (request lifecycle, cancellation, latest-wins)
10. Cost Manager (budget tracking, estimation, degradation)
11. Observability Collector (structured traces, pluggable transports)
12. React Adapter (FluiProvider, LiquidView, ViewState, transitions)
13. LLM Connectors (OpenAI + Anthropic, streaming, error normalization)
14. Testing Utilities (MockConnector, helpers, snapshot support)

**3 example applications** demonstrate real-world use:

- **Adaptive Dashboard** — Role-based layout (executive vs. analyst vs. operator)
- **Smart Form Wizard** — Context-aware multi-step form with adaptive fields
- **Content Explorer** — Intent-driven data exploration with progressive disclosure

### Out of Scope for MVP

Explicitly deferred items — with rationale and target phase. These boundaries are critical to prevent scope creep:

| Category | Deferred Items | Target Phase | Rationale |
|----------|---------------|-------------|-----------|
| **Framework adapters** | `@flui/vue`, `@flui/angular`, `@flui/svelte` | Phase 2 | Focus on one adapter first; others follow the same pattern |
| **Additional LLM connectors** | `@flui/ollama`, `@flui/mistral` | Phase 2 | OpenAI + Anthropic cover primary use cases |
| **Protocol adapters** | `@flui/ag-ui`, `@flui/a2ui`, `@flui/mcp` | Phase 2 | Protocols need stable core first; interop is strategic but not MVP-critical |
| **Browser DevTools extension** | `@flui/devtools` | Phase 2 | Inline debug overlay covers Phase 1 needs |
| **Server-side rendering** | SSR / SSG integration (Next.js, Nuxt) | Phase 2 | CSR first; SSR as Phase 2 priority |
| **Multi-view coordination** | Batched and coordinated LiquidView modes | Phase 2 | Independent mode only; coordination adds complexity |
| **Advanced context providers** | Expertise learning, cognitive load inference, predictive intent | Phase 2 | Require usage data accumulation and interaction heuristics |
| **Enterprise features** | `@flui/compliance`, `@flui/analytics`, `@flui/design-system`, `@flui/i18n` | Phase 3 | Enterprise value-add after core is proven |
| **On-device LLM** | `@flui/offline` (local model integration) | Phase 4 | Cache + fallback covers Phase 1 offline needs |
| **Advanced debug modes** | What-If simulation, Edit Spec, pin mechanism | Phase 2 | Read-only Spec + Trace tabs in Phase 1 |

**The guiding principle:** If a feature is not needed for the 3 example applications to work correctly with validation, caching, cost control, and observability — it's not MVP.

### MVP Success Criteria

The MVP is successful when ALL of the following gates are met:

**Gate 1 — Technical Completeness:**

- [ ] All 14 modules implemented and passing unit tests (>90% coverage)
- [ ] All 5 packages published on npm
- [ ] All 3 example applications working end-to-end
- [ ] 25+ acceptance criteria from Phase 1 spec passing
- [ ] Performance budgets met (generation P50 < 500ms, core < 25KB gzip)

**Gate 2 — Developer Experience Validation:**

- [ ] Fresh developer completes "first liquid view" in < 5 minutes (timed test)
- [ ] Zero-config fallback works when LLM is unavailable
- [ ] Debug overlay provides actionable information for troubleshooting
- [ ] Cost manager prevents budget overruns in test scenarios
- [ ] Documentation covers getting-started, API reference, and architecture

**Gate 3 — Production Readiness:**

- [ ] Validation pipeline catches 100% of schema violations, a11y violations, and unauthorized data references
- [ ] Cache reduces LLM calls by >80% for repeated intent+context pairs
- [ ] Concurrency controller handles rapid context changes without UI flickering
- [ ] Circuit breaker activates after persistent failures, preventing infinite retry loops
- [ ] Observability traces provide full auditability for every generation

**Go/No-Go Decision:** If Gates 1-3 are met → open-source release. If any gate fails → fix before release, no partial shipping.

### Future Vision

If Flui's MVP succeeds, the framework evolves through four phases into **the standard intelligence layer for LLM-powered user interfaces**:

**Phase 2 (6-12 months) — Ecosystem Expansion:**

- Framework adapters: Vue 3, Angular 17+, Svelte 5 — same core, multiple renderers
- Protocol adapters: AG-UI and A2UI as first-class integration paths, positioning Flui as the intelligence layer above emerging standards
- SSR/SSG: Next.js App Router and Nuxt 3 integration for server-side generation
- Multi-view coordination: Batched generation (cost-efficient) and coordinated views (layout coherence)
- Browser DevTools extension: Full-featured debugging beyond inline overlay
- Additional connectors: Ollama (local), Mistral, Google Gemini

**Phase 3 (12-24 months) — Enterprise & Advanced Intelligence:**

- Enterprise compliance suite: Custom regulatory validators (HIPAA, GDPR, SOC2)
- Design system integration: Brand enforcement in generated specs
- Advanced context providers: Expertise learning from usage patterns, cognitive load inference, predictive intent
- Analytics and A/B testing: Which generation strategies produce better user outcomes?
- Internationalization: Context-aware locale adaptation in generation
- Marketplace for community validators, context providers, and connectors

**Phase 4 (24+ months) — Platform & Autonomy:**

- On-device LLM support: Offline-capable generation with local models
- Multi-agent collaboration: Multiple LLMs cooperating on complex UI generation
- Autonomous optimization: Framework learns which generation strategies work best per context cluster
- Cross-application context: Shared user context across Flui-powered applications
- Visual editor: No-code configuration of LiquidViews, component registries, and validation rules

**The long-term thesis:** Flui becomes to LLM-powered UIs what React became to data-reactive UIs — the default way to build intelligent, adaptive interfaces. The intelligence layer (context + validation + observability) is the moat; everything else is commoditizable plumbing.
