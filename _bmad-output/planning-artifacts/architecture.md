---
stepsCompleted: [step-01-init, step-02-context, step-03-starter, step-04-decisions, step-05-patterns, step-06-structure, step-07-validation, step-08-complete]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/product-brief-flui-2026-02-24.md
  - _bmad-output/problem-solution-2026-02-24.md
  - docs/flui-framework-vision.md
  - docs/flui-architecture-decisions.md
  - docs/flui-phase1-spec.md
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-02-24'
project_name: 'flui'
user_name: 'Fabrice'
date: '2026-02-24'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

58 FRs across 7 capability areas define a complete generation pipeline:

| Capability Area | FR Count | Architectural Implication |
|----------------|----------|--------------------------|
| Intent & Context Processing (FR1-7) | 7 | Input layer — intent parsing, context aggregation, sanitization. Feeds the generation orchestrator. |
| Component Management (FR8-13) | 6 | Registry subsystem — register, query, batch, serialize for LLM prompt. Core data structure. |
| UI Generation (FR14-24) | 11 | Pipeline core — prompt construction, LLM call, response parsing, spec rendering, data resolution, transitions. Most complex module. |
| Validation & Safety (FR25-34) | 10 | Mandatory validation pipeline — schema, component, prop, a11y, data auth, custom validators. Zero-bypass architecture. |
| Cost & Performance Control (FR35-43) | 9 | Cost manager + 3-level cache + concurrency controller + generation policy. Production resilience layer. |
| Observability & Debugging (FR44-51) | 8 | Trace collection, transport, debug overlay, cost/cache metrics, export. Cross-cutting — touches every module. |
| Developer Experience & Testing (FR52-58) | 7 | Zero-config setup, MockConnector, test helpers, typed errors. DX layer. |

**Non-Functional Requirements:**

39 NFRs define hard constraints that shape architecture:

| Category | Count | Key Constraints |
|----------|-------|----------------|
| Performance (NFR-P1-10) | 10 | P50 <500ms generation, <5ms validation, <1ms L1 cache, <25KB core bundle, tree-shaking |
| Security (NFR-S1-8) | 8 | Declarative-only output, no eval/innerHTML, intent sanitization, API key protection, npm provenance |
| Accessibility (NFR-A1-5) | 5 | WCAG AA enforcement, focus management across re-generations, ARIA live regions |
| Reliability (NFR-R1-6) | 6 | 100% fallback on failure, circuit breaker, clean cancellation, cache corruption recovery |
| Integration (NFR-I1-5) | 5 | Provider-agnostic connector (<100 lines), no state library dependency, plugin packaging |
| Maintainability (NFR-M1-6) | 6 | >90% test coverage, zero `any`, TSDoc, Biome clean, module independence, API surface snapshot |

**Scale & Complexity:**

- Primary domain: Frontend framework / TypeScript npm package ecosystem
- Complexity level: Medium-High
- Estimated architectural components: 14 modules across 5 packages
- 20 ADRs pre-decided — constraining the solution space significantly
- 6-sprint implementation sequence with explicit dependency graph

### Technical Constraints & Dependencies

| Constraint | Source | Impact |
|-----------|--------|--------|
| TypeScript 5.x strict mode | PRD Language Matrix | All packages must compile under `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalProperties` |
| Zod as only runtime dependency | PRD Dependency Philosophy | Runtime validation (UISpecification, component props) uses Zod. No lodash, no moment. |
| ES2022 target | PRD Language Matrix | Modern syntax available; supports Node 18+ and modern browsers |
| ESM + CJS dual output | PRD Language Matrix | tsup builds both formats; `sideEffects: false` for tree-shaking |
| React 18+ for adapter | PRD Language Matrix | Hooks-based API, no class components, Suspense-compatible patterns |
| pnpm workspaces | Phase 1 spec | Monorepo management; internal packages linked via workspace protocol |
| size-limit CI enforcement | ADR-018 | Bundle budgets enforced on every commit — shapes code splitting decisions |
| LLM provider SDKs as peer deps | PRD Dependency Philosophy | `openai` and `@anthropic-ai/sdk` are peer dependencies of connector packages |
| 20 ADRs as hard constraints | Architecture Decisions doc | State management, data resolution, caching, concurrency, cost control, etc. are decided |

### Cross-Cutting Concerns Identified

| Concern | Affected Modules | Architectural Strategy |
|---------|-----------------|----------------------|
| **Observability** | All 14 modules | GenerationTrace struct is enriched by each module. Collector aggregates. Console + in-memory transports. |
| **Cost awareness** | Generation Orchestrator, Cache Manager, Cost Manager, Generation Policy | Budget checks before LLM call; cost recorded after; cache as primary cost reduction mechanism. |
| **Cancellation (AbortSignal)** | Concurrency Controller, Orchestrator, LLM Connectors, React Adapter | AbortController created per generation request; signal propagated through entire pipeline. |
| **Type safety** | All packages | Zod for runtime validation, TypeScript strict for compile-time, zero `any` in public API. |
| **Bundle size** | All packages | Tree-shaking architecture, per-package budgets, `sideEffects: false`, individual imports. |
| **Error propagation** | All modules | Typed error codes (FLUI_EXXX), descriptive messages, TypeScript compilation errors for misconfig. |
| **Cache key consistency** | Cache Manager, Context Engine, Intent Parser | `hash(intent + context + registryVersion + specVersion)` must be deterministic and stable. |
| **Fallback guarantee** | LiquidView, Orchestrator, Circuit Breaker, Validation Pipeline | Every failure path must resolve to fallback render. TypeScript enforces mandatory `fallback` prop. |

## Starter Template Evaluation

### Primary Technology Domain

TypeScript npm package monorepo — a library/framework distributed as 5 npm packages, not a web application.

### Starter Options Considered

| Option | What It Provides | Match Score | Gap |
|--------|-----------------|-------------|-----|
| **jkomyno/pnpm-monorepo-template** | Turborepo + pnpm + Vitest + Biome + Changesets + tsup | 6/7 | Missing size-limit; generic package structure needs restructuring |
| **create-turbo official** | Turborepo scaffolding with pnpm | 3/7 | Defaults to Next.js app; uses ESLint not Biome; no tsup, no changesets, no size-limit |
| **Custom from Phase 1 spec** | Exact match — folder structure, tooling, and config are fully specified | 7/7 | More initial setup but zero adaptation needed |
| **ts-template-starter** | pnpm + tsup + Vitest | 3/7 | Missing Biome, Changesets, size-limit, Turborepo |

### Selected Approach: Custom Monorepo from Phase 1 Specification

**Rationale:**

The Phase 1 Implementation Specification (`docs/flui-phase1-spec.md`, Section 2) already defines the complete monorepo structure — folder layout, package boundaries, tooling, TypeScript configuration, and dependency relationships. Using a generic starter template would require more effort to adapt than building from the spec directly.

**Initialization Sequence:**

```bash
mkdir flui && cd flui
pnpm init
# Configure pnpm-workspace.yaml for packages/* and examples/*
# Initialize each package with pnpm init in packages/core, react, openai, anthropic, testing
# Add shared tsconfig.base.json, vitest.config.ts, biome.json, .size-limit.json
# Configure changesets with pnpm dlx @changesets/cli init
# Add Turborepo for task orchestration: pnpm add -Dw turbo
```

**Architectural Decisions Provided by Setup:**

**Language & Runtime:**

- TypeScript 5.x with `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalProperties: true`
- ES2022 target, ESM primary + CJS compatibility via tsup dual output
- Zero `any` in public API (enforced by Biome rule)

**Build Tooling:**

- tsup (esbuild-based) for fast builds with ESM + CJS dual output
- Turborepo for monorepo task orchestration (build, test, lint in dependency order)
- size-limit for per-package bundle size enforcement in CI

**Testing Framework:**

- Vitest with native ESM support
- Per-package test suites with shared vitest.config.ts base
- React Testing Library for `@flui/react` component tests

**Code Quality:**

- Biome for linting + formatting (replaces ESLint + Prettier)
- Changesets for coordinated version bumps and npm publishing
- npm provenance (SLSA) for supply chain security

**Code Organization:**

- `packages/core/src/{module}/` — 14 module directories per Phase 1 spec
- `packages/react/src/` — React adapter with renderer, hooks, debug
- `packages/{openai,anthropic}/src/` — LLM connectors
- `packages/testing/src/` — MockConnector and test helpers
- `examples/{basic-dashboard,invoice-hybrid,multi-view}/` — 3 example apps

**Note:** Monorepo initialization should be the first implementation story (Sprint 0 / setup task).

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

- Zod 4.x as runtime validation library (breaking API change from v3 — must decide before any schema code)
- FluiError + Result pattern for error handling (propagates through every public function)
- LLMConnector interface contract (blocks connector implementations)
- Cache key hash algorithm (blocks Cache Manager)

**Important Decisions (Shape Architecture):**

- React 18+ target (constrains adapter API surface)
- GitHub Actions CI structure (enables size-limit enforcement, npm provenance)
- API surface snapshot testing (catches accidental breaking changes)
- Intent sanitization approach (security boundary)

**Deferred Decisions (Post-MVP):**

- Documentation hosting platform (TSDoc sufficient for Phase 1)
- Suspense integration in React adapter (ADR-009 covers latency UX)
- IndexedDB abstraction choice for L3 cache (optional peer dependency, not needed for initial implementation)

### Data Architecture — Library Internals

| Decision | Choice | Version | Rationale | Affects |
|----------|--------|---------|-----------|---------|
| **Runtime validation library** | Zod 4.x | 4.3.6 | 14x faster parsing, 2.3x smaller bundle vs v3. Sole runtime dependency — performance matters. Starting with v4 avoids future migration. | All modules with runtime validation: Validation Pipeline, Component Registry, Connector response parsing |
| **Cache key hashing** | SHA-256 via Web Crypto API | `crypto.subtle.digest()` (browser) / `node:crypto` (Node.js) | Zero-dependency, deterministic, fast. Available in all target environments (Node 18+, modern browsers). | Cache Manager, Context Engine, Intent Parser |
| **IndexedDB abstraction (L3 cache)** | `idb-keyval` as optional peer dependency | ~600B | Keeps `@flui/core` zero-dependency at runtime (Zod only). Consumers who want persistent L3 cache install the lightweight wrapper. | Cache Manager (L3 tier only) |

### Authentication & Security — Library Distribution

| Decision | Choice | Rationale | Affects |
|----------|--------|-----------|---------|
| **API key handling** | Pass-through only — Flui never stores, logs, or persists keys. Connector packages receive keys via constructor config and forward directly to provider SDKs. | Library has no server component. Security boundary is the consumer's application. | `@flui/openai`, `@flui/anthropic`, Observability (must never trace keys) |
| **npm provenance** | SLSA provenance via GitHub Actions `--provenance` flag on `npm publish` | Required by NFR-S8. Proves packages were built from the public repository. | Release CI workflow |
| **Intent sanitization** | DOMPurify-style string sanitization on all intent strings before prompt construction. Implemented as a pure function in the Intent Parser module. | NFR-S3 requires intent sanitization. Prevents prompt injection via user-controlled intent strings. | Intent Parser, Generation Orchestrator |

### API & Communication — Package Public API

| Decision | Choice | Rationale | Affects |
|----------|--------|-----------|---------|
| **Error handling standard** | Typed `FluiError` class with string literal codes (`FLUI_E001`–`FLUI_E099`) extending `Error`. Return `Result<T, FluiError>` for async operations; throw only for programmer errors (invalid config at initialization). | PRD specifies typed error codes. Result pattern is safer for LLM-generated operations where failures are expected. | All modules — cross-cutting |
| **LLM Connector interface** | `LLMConnector` interface with `generate(prompt, options, signal): Promise<LLMResponse>`. Max ~100 lines per implementation (NFR-I1). | Provider-agnostic. OpenAI and Anthropic connectors implement the same contract. Third-party providers follow the same interface. | `@flui/openai`, `@flui/anthropic`, Generation Orchestrator |
| **API surface snapshot testing** | Vitest snapshot tests on exported `.d.ts` files using `@microsoft/api-extractor` | NFR-M6 requires API surface snapshots. Catches accidental public API changes in PRs. | CI pipeline, all 5 packages |

### Frontend Architecture — React Adapter

| Decision | Choice | Rationale | Affects |
|----------|--------|-----------|---------|
| **React version target** | React 18+ (not React 19 exclusive) | React 19 (19.2.4) is current, but many production apps remain on React 18. Supporting 18+ maximizes adoption. Hooks-based API works on both. | `@flui/react`, `@testing-library/react` peer dependency range |
| **Suspense integration** | Deferred to Phase 2. `LiquidView` manages its own loading states (skeleton → transition → render per ADR-009). | Keeps the React adapter simple. ADR-009 already defines the latency UX strategy. Suspense can be added as an optional mode later. | `@flui/react` |

### Infrastructure & Deployment — CI/CD & Publishing

| Decision | Choice | Rationale | Affects |
|----------|--------|-----------|---------|
| **CI platform** | GitHub Actions | Industry standard for open-source npm packages. Free for public repos. Supports pnpm, Turborepo remote caching, npm provenance. | All packages |
| **CI workflow structure** | 3 workflows: `ci.yml` (lint + test + build + size-limit on every PR), `release.yml` (Changesets → npm publish on merge to main), `canary.yml` (optional: publish canary on push to `next` branch) | Matches the Changesets + Turborepo model. Size-limit runs in CI per ADR-018. | Repository CI/CD |
| **Node.js version in CI** | Node 22 LTS (primary) + Node 20 LTS (compatibility matrix) | Node 22 is current LTS. Testing on 20 ensures broad compatibility. ES2022 target works on both. | GitHub Actions matrix |
| **Environment configuration** | No `.env` files in the library. Example apps use `.env.local` for API keys (gitignored). CI secrets for npm publish token only. | Library has no config files — everything is passed programmatically via constructors and options. | Examples, CI secrets |
| **Documentation hosting** | Deferred to post-Phase 1. TSDoc comments in code are primary API documentation. | Avoids scope creep. TSDoc is machine-readable and human-readable. Dedicated docs site can be added later. | All packages (TSDoc in source) |

### Verified Technology Versions

| Technology | Version | Status |
|-----------|---------|--------|
| TypeScript | 5.8.0 | Latest stable (TS 6.0 beta — not for production) |
| Zod | 4.3.6 | v4 stable (breaking API from v3) |
| tsup | 8.5.1 | Stable |
| Turborepo | 2.8.10 | v2.x stable, active development |
| Vitest | 4.0.18 | v4 stable |
| Biome | 2.4.4 | v2.x stable, type-aware linting |
| pnpm | 10.30.2 | v10 stable |
| @changesets/cli | 2.29.8 | Stable |
| @size-limit/preset-small-lib | 11.2.0 | Stable |
| React | 19.2.4 (target: 18+) | 19 is current; library targets 18+ |
| @testing-library/react | 16.3.2 | Supports React 19 |
| GitHub Actions runner | ubuntu-24.04 | `ubuntu-latest` maps to 24.04 |

### Decision Impact Analysis

**Implementation Sequence:**

1. Monorepo setup with verified tool versions (Sprint 0)
2. Zod 4.x schemas for UISpecification and validation (Sprint 1)
3. LLMConnector interface + OpenAI/Anthropic implementations (Sprint 1-2)
4. FluiError + Result pattern across all modules (Sprint 1, cross-cutting)
5. Cache key hashing with Web Crypto (Sprint 2)
6. GitHub Actions CI pipeline (Sprint 0, refined each sprint)
7. API surface snapshots once public API stabilizes (Sprint 3+)

**Cross-Component Dependencies:**

- Zod 4 decision affects every module that does runtime validation (core validation pipeline, component registry, connector response parsing)
- FluiError/Result pattern propagates through all public-facing functions
- Cache key hash algorithm must be consistent across Intent Parser, Context Engine, and Cache Manager
- React 18+ target constrains which React APIs the adapter can use (no React 19-only features like `use()` hook)

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**18 critical conflict points identified** where AI agents could make different choices when implementing Flui modules. Patterns are adapted to Flui's domain as a TypeScript library framework — no database, REST API, or authentication patterns apply.

### Naming Patterns

**File Naming Conventions:**

| Element | Convention | Example | Anti-Pattern |
|---------|-----------|---------|-------------|
| Module directory | `kebab-case/` | `intent-parser/` | `intentParser/`, `IntentParser/` |
| Source files | `kebab-case.ts` | `generation-orchestrator.ts` | `GenerationOrchestrator.ts`, `generationOrchestrator.ts` |
| Type definition files | `{module}.types.ts` | `cache-manager.types.ts` | `types.ts`, `CacheManagerTypes.ts` |
| Test files | `{source-file}.test.ts` co-located | `intent-parser.test.ts` | `__tests__/intent-parser.ts`, `intent-parser.spec.ts` |
| Index barrel files | `index.ts` per module | `packages/core/src/intent-parser/index.ts` | No barrel file, or exporting from source directly |
| Zod schemas | `{entity}.schema.ts` | `ui-specification.schema.ts` | `schemas.ts`, `UISpecificationSchema.ts` |
| Constants | `{module}.constants.ts` | `cost-manager.constants.ts` | `constants.ts`, `CONSTANTS.ts` |

**Code Naming Conventions:**

| Element | Convention | Example | Anti-Pattern |
|---------|-----------|---------|-------------|
| Interfaces | `PascalCase`, noun | `ComponentRegistry`, `GenerationTrace` | `IComponentRegistry`, `componentRegistry` |
| Type aliases | `PascalCase`, noun | `UISpecification`, `CacheKey` | `TUISpecification`, `ui_specification` |
| Zod schemas | `camelCase` + `Schema` suffix | `uiSpecificationSchema`, `componentSpecSchema` | `UISpecificationSchema`, `uiSpecification` |
| Functions (public) | `camelCase`, verb-first | `registerComponent()`, `generateUI()` | `Register()`, `component_register()` |
| Functions (internal) | `camelCase`, verb-first, no underscore prefix | `buildPrompt()`, `resolveDataSources()` | `_buildPrompt()`, `BuildPrompt()` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_PROMPT_TOKENS`, `DEFAULT_CACHE_TTL` | `maxPromptTokens`, `MaxPromptTokens` |
| Error codes | `FLUI_E` + 3-digit number | `FLUI_E001`, `FLUI_E042` | `E001`, `FLUI_ERROR_1`, `FluiError42` |
| Event names | `camelCase` verb phrase | `generationStarted`, `validationFailed` | `GENERATION_STARTED`, `generation-started` |
| Generic type parameters | Single uppercase letter or descriptive `PascalCase` | `T`, `TProps`, `TData` | `t`, `props_type` |
| Boolean variables | `is`/`has`/`should` prefix | `isLoading`, `hasCache`, `shouldRegenerate` | `loading`, `cached`, `regenerate` |

**JSON/Serialization Naming:**

| Element | Convention | Example |
|---------|-----------|---------|
| UISpecification fields | `camelCase` | `{ "componentType": "DataTable", "dataSource": "sales" }` |
| GenerationTrace fields | `camelCase` | `{ "startTime": 1708790400, "tokenCount": 342 }` |
| Config objects | `camelCase` | `{ "maxRetries": 3, "cacheTtlMs": 60000 }` |

### Structure Patterns

**Module Internal Structure:**

Every module in `packages/core/src/{module}/` follows the same layout:

```
{module}/
  index.ts              # Public API barrel — re-exports only public symbols
  {module}.ts           # Core implementation
  {module}.types.ts     # Types and interfaces for this module
  {module}.schema.ts    # Zod schemas (if module validates data)
  {module}.constants.ts # Module-specific constants (if any)
  {module}.test.ts      # Unit tests (co-located)
```

**Rules:**

- Every module has exactly one `index.ts` that controls the public surface
- Never import from another module's internal files — always import from its `index.ts`
- Types used by multiple modules go in `packages/core/src/types/` (shared types directory)
- Test files are always co-located, never in a separate `__tests__/` directory

**Package-Level Structure:**

```
packages/{package}/
  src/
    index.ts            # Package public API barrel
    {modules...}/       # Module directories
  tsconfig.json         # Extends root tsconfig.base.json
  tsup.config.ts        # Package-specific build config
  package.json          # Package manifest with sideEffects: false
  vitest.config.ts      # Extends root vitest config (if package-specific overrides needed)
```

### Format Patterns

**FluiError Structure:**

```typescript
// ALWAYS this structure — never variations
class FluiError extends Error {
  readonly code: FluiErrorCode    // 'FLUI_E001' through 'FLUI_E099'
  readonly category: ErrorCategory // 'validation' | 'generation' | 'cache' | 'connector' | 'config'
  readonly context?: Record<string, unknown> // Structured metadata (never sensitive data)
  readonly cause?: Error           // Original error if wrapping
}
```

**Result Pattern:**

```typescript
// For async public API functions that can fail expectedly
type Result<T, E = FluiError> =
  | { ok: true; value: T }
  | { ok: false; error: E }

// GOOD: Async operations return Result
async function generateUI(intent: string, options: GenerateOptions): Promise<Result<UISpecification>>

// GOOD: Sync config errors throw (programmer errors)
function createFlui(config: FluiConfig): FluiInstance // throws if config is invalid

// BAD: Never throw from async generation pipeline
async function generateUI(intent: string): Promise<UISpecification> // throws FluiError — WRONG
```

**GenerationTrace Enrichment:**

```typescript
// Every module that enriches the trace uses this pattern:
trace.addStep({
  module: 'intent-parser',           // kebab-case module name
  operation: 'sanitizeIntent',       // camelCase function name
  durationMs: 2.3,                   // always milliseconds
  metadata: { intentLength: 42 }     // structured, never sensitive
})
```

**Duration/Time Format:**

| Context | Format | Example |
|---------|--------|---------|
| Trace timestamps | Unix ms (`Date.now()`) | `1708790400000` |
| Duration measurements | Milliseconds as number | `durationMs: 4.2` |
| Cache TTL config | Milliseconds as number | `cacheTtlMs: 300000` |
| Human-readable logs | ISO 8601 | `2026-02-24T10:00:00.000Z` |

### Communication Patterns

**Inter-Module Communication:**

- Modules communicate through **function calls** (direct imports from barrel files), never through events or pub/sub internally
- The only event system is the `InteractionSpec` for inter-component communication in rendered UIs (ADR-008)
- GenerationTrace is the cross-cutting data structure passed through the pipeline — not a global event bus

**Callback/Hook Naming:**

```typescript
// Lifecycle hooks use 'on' prefix
interface FluiConfig {
  onGenerationStart?: (trace: GenerationTrace) => void
  onGenerationComplete?: (trace: GenerationTrace) => void
  onValidationError?: (errors: ValidationError[]) => void
  onCacheHit?: (key: CacheKey, level: CacheLevel) => void
}

// Transform hooks use verb
interface GenerationOptions {
  transformPrompt?: (prompt: string) => string
  filterComponents?: (components: ComponentEntry[]) => ComponentEntry[]
}
```

**AbortSignal Propagation:**

```typescript
// EVERY async function in the generation pipeline accepts AbortSignal as last parameter
async function generateUI(intent: string, options: GenerateOptions, signal?: AbortSignal): Promise<Result<UISpecification>>
async function callLLM(prompt: string, config: LLMConfig, signal?: AbortSignal): Promise<Result<LLMResponse>>

// ALWAYS check signal before expensive operations
if (signal?.aborted) {
  return { ok: false, error: new FluiError('FLUI_E010', 'generation', 'Generation cancelled') }
}
```

### Process Patterns

**Validation Pattern (Zero-Bypass):**

```typescript
// ALWAYS validate before rendering — no shortcut path
// Validation pipeline is: schema → component → props → a11y → custom
// Each validator returns ValidationResult, never throws
type ValidationResult =
  | { valid: true; spec: UISpecification }
  | { valid: false; errors: ValidationError[]; fallbackRequired: true }
```

**Loading State Pattern:**

```typescript
// LiquidView states follow a strict progression:
type LiquidViewState =
  | { status: 'idle' }                                    // No generation requested
  | { status: 'generating'; trace: GenerationTrace }       // LLM call in progress
  | { status: 'validating'; rawSpec: unknown }             // Validation pipeline running
  | { status: 'rendering'; spec: UISpecification }         // Valid spec, rendering components
  | { status: 'error'; error: FluiError; fallback: true }  // Failed, showing fallback

// NEVER invent new states. NEVER skip states.
```

**Import Pattern:**

```typescript
// GOOD: Import from package barrel
import { registerComponent, type ComponentEntry } from '@flui/core'

// GOOD: Import from module barrel (within same package)
import { IntentParser } from '../intent-parser'

// BAD: Deep import into module internals
import { sanitize } from '../intent-parser/intent-parser'

// BAD: Relative import across packages
import { something } from '../../react/src/hooks'
```

**Export Pattern:**

```typescript
// Module index.ts — explicit re-exports, never export *
export { IntentParser } from './intent-parser'
export type { ParsedIntent, IntentParserConfig } from './intent-parser.types'

// Package index.ts — curated public API
export { createFlui, registerComponent, generateUI } from './modules'
export type { FluiConfig, UISpecification, ComponentEntry } from './types'

// NEVER: export * from './intent-parser'
// NEVER: export default
```

**Testing Pattern:**

```typescript
// Test file naming: {source}.test.ts, co-located
// Test structure: describe(ModuleName) > describe(functionName) > it(behavior)
// Mock pattern: use @flui/testing MockConnector for LLM calls

describe('IntentParser', () => {
  describe('parseIntent', () => {
    it('sanitizes HTML from intent strings', () => { /* ... */ })
    it('returns FLUI_E003 for empty intent', () => { /* ... */ })
  })
})

// ALWAYS test Result.ok and Result.error paths
// ALWAYS test AbortSignal cancellation for async functions
// NEVER use any/unknown in test assertions — assert specific types
```

### Enforcement Guidelines

**All AI Agents MUST:**

1. Follow the file naming convention (`kebab-case.ts`) — no exceptions
2. Use the module directory structure exactly as defined (index.ts, types.ts, schema.ts, test.ts)
3. Return `Result<T, FluiError>` from all async public API functions
4. Propagate `AbortSignal` through all async functions in the generation pipeline
5. Import only from barrel files (`index.ts`), never from internal module files
6. Use explicit named exports, never `export *` or `export default`
7. Co-locate tests as `{source}.test.ts`, never in `__tests__/` directories
8. Enrich `GenerationTrace` when the module performs a measurable operation
9. Never log sensitive data (API keys, raw LLM responses containing user data)
10. Use `FluiErrorCode` string literals, never numeric or freeform error codes

**Pattern Enforcement:**

- Biome rules enforce naming conventions and import patterns at lint time
- TypeScript strict mode + `noUncheckedIndexedAccess` catches type safety violations at compile time
- API surface snapshot tests catch accidental public API changes
- size-limit catches bundle size regressions
- PR review checklist should verify: Result pattern, AbortSignal propagation, trace enrichment, barrel imports

**Pattern Updates:**

- Patterns are updated only in this architecture document
- Any AI agent can propose a pattern change but must document the rationale
- Pattern changes require updating all existing code to match (no mixed patterns)

## Project Structure & Boundaries

### Complete Project Directory Structure

```
flui/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                        # Lint + test + build + size-limit (on PR)
│   │   ├── release.yml                   # Changesets → npm publish (on merge to main)
│   │   └── canary.yml                    # Canary publish (on push to next branch)
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── CODEOWNERS
│
├── packages/
│   ├── core/                             # @flui/core
│   │   ├── src/
│   │   │   ├── spec/                     # UISpecification types + versioning (ADR-017)
│   │   │   │   ├── index.ts
│   │   │   │   ├── spec.types.ts
│   │   │   │   ├── spec.schema.ts        # Zod 4 schema for UISpecification
│   │   │   │   └── spec.test.ts
│   │   │   │
│   │   │   ├── registry/                 # Component Registry
│   │   │   │   ├── index.ts
│   │   │   │   ├── registry.ts
│   │   │   │   ├── registry.types.ts
│   │   │   │   ├── registry.schema.ts
│   │   │   │   └── registry.test.ts
│   │   │   │
│   │   │   ├── intent/                   # Intent Parser
│   │   │   │   ├── index.ts
│   │   │   │   ├── intent.ts
│   │   │   │   ├── intent.types.ts
│   │   │   │   ├── sanitizer.ts          # Intent sanitization (NFR-S3)
│   │   │   │   └── intent.test.ts
│   │   │   │
│   │   │   ├── context/                  # Context Engine
│   │   │   │   ├── index.ts
│   │   │   │   ├── context.ts
│   │   │   │   ├── context.types.ts
│   │   │   │   ├── providers/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── identity.ts
│   │   │   │   │   └── environment.ts
│   │   │   │   └── context.test.ts
│   │   │   │
│   │   │   ├── generation/               # Generation Orchestrator
│   │   │   │   ├── index.ts
│   │   │   │   ├── orchestrator.ts
│   │   │   │   ├── prompt-builder.ts
│   │   │   │   ├── spec-parser.ts
│   │   │   │   ├── generation.types.ts
│   │   │   │   └── generation.test.ts
│   │   │   │
│   │   │   ├── validation/               # Validation Pipeline
│   │   │   │   ├── index.ts
│   │   │   │   ├── pipeline.ts
│   │   │   │   ├── validation.types.ts
│   │   │   │   ├── validators/
│   │   │   │   │   ├── schema.ts
│   │   │   │   │   ├── component.ts
│   │   │   │   │   ├── prop.ts
│   │   │   │   │   ├── layout.ts
│   │   │   │   │   ├── a11y.ts
│   │   │   │   │   ├── data.ts
│   │   │   │   │   └── interaction.ts
│   │   │   │   └── validation.test.ts
│   │   │   │
│   │   │   ├── cache/                    # Cache Manager (ADR-003)
│   │   │   │   ├── index.ts
│   │   │   │   ├── cache.ts
│   │   │   │   ├── cache.types.ts
│   │   │   │   ├── key.ts                # Deterministic cache key hashing (SHA-256)
│   │   │   │   ├── storage/
│   │   │   │   │   ├── memory.ts         # L1 — Map-based
│   │   │   │   │   ├── session.ts        # L2 — sessionStorage
│   │   │   │   │   └── indexeddb.ts       # L3 — IndexedDB (optional)
│   │   │   │   └── cache.test.ts
│   │   │   │
│   │   │   ├── policy/                   # Generation Policy (ADR-004) + Cost (ADR-006)
│   │   │   │   ├── index.ts
│   │   │   │   ├── generation-policy.ts
│   │   │   │   ├── cost-manager.ts
│   │   │   │   ├── policy.types.ts
│   │   │   │   └── policy.test.ts
│   │   │   │
│   │   │   ├── concurrency/              # Concurrency Controller (ADR-005) + Circuit Breaker (ADR-011)
│   │   │   │   ├── index.ts
│   │   │   │   ├── controller.ts
│   │   │   │   ├── circuit-breaker.ts
│   │   │   │   ├── concurrency.types.ts
│   │   │   │   └── concurrency.test.ts
│   │   │   │
│   │   │   ├── observe/                  # Observability Collector
│   │   │   │   ├── index.ts
│   │   │   │   ├── collector.ts
│   │   │   │   ├── trace.ts
│   │   │   │   ├── observe.types.ts
│   │   │   │   └── observe.test.ts
│   │   │   │
│   │   │   ├── data/                     # Data Resolver (ADR-002)
│   │   │   │   ├── index.ts
│   │   │   │   ├── resolver.ts
│   │   │   │   ├── data.types.ts
│   │   │   │   └── data.test.ts
│   │   │   │
│   │   │   ├── errors/                   # FluiError + Result + error codes
│   │   │   │   ├── index.ts
│   │   │   │   ├── flui-error.ts
│   │   │   │   ├── error-codes.ts
│   │   │   │   ├── result.ts
│   │   │   │   └── errors.test.ts
│   │   │   │
│   │   │   ├── types.ts                  # Shared types (LLMConnector interface, etc.)
│   │   │   ├── flui.ts                   # createFlui() factory
│   │   │   └── index.ts                  # Package public API barrel
│   │   │
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   │
│   ├── react/                            # @flui/react
│   │   ├── src/
│   │   │   ├── LiquidView.tsx
│   │   │   ├── FluiProvider.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── index.ts
│   │   │   │   ├── use-liquid-view.ts
│   │   │   │   ├── use-fluid-debug.ts
│   │   │   │   └── use-fluid-context.ts
│   │   │   ├── renderer/
│   │   │   │   ├── index.ts
│   │   │   │   ├── spec-renderer.tsx
│   │   │   │   ├── view-state.ts         # ViewState management (ADR-001)
│   │   │   │   ├── interaction-wiring.ts # InteractionSpec wiring (ADR-008)
│   │   │   │   ├── transitions.tsx       # Crossfade transitions (ADR-009)
│   │   │   │   ├── data-resolver.tsx     # Async data fetching/binding (ADR-002)
│   │   │   │   └── a11y.tsx              # Focus management + ARIA (ADR-014)
│   │   │   ├── debug/
│   │   │   │   ├── index.ts
│   │   │   │   ├── DebugOverlay.tsx
│   │   │   │   ├── SpecTab.tsx
│   │   │   │   └── TraceTab.tsx
│   │   │   ├── react.types.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   │
│   ├── openai/                           # @flui/openai
│   │   ├── src/
│   │   │   ├── connector.ts
│   │   │   ├── streaming.ts
│   │   │   ├── openai.types.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   │
│   ├── anthropic/                        # @flui/anthropic
│   │   ├── src/
│   │   │   ├── connector.ts
│   │   │   ├── streaming.ts
│   │   │   ├── anthropic.types.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   │
│   └── testing/                          # @flui/testing
│       ├── src/
│       │   ├── mock-connector.ts
│       │   ├── test-helpers.ts
│       │   ├── testing.types.ts
│       │   └── index.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── tsup.config.ts
│
├── examples/
│   ├── basic-dashboard/                  # Example 1: Simple dashboard
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── components/               # Registered components for this example
│   │   │   ├── main.tsx
│   │   │   └── vite-env.d.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   └── .env.local                    # API keys (gitignored)
│   │
│   ├── invoice-hybrid/                   # Example 2: Static + liquid hybrid
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── components/
│   │   │   ├── main.tsx
│   │   │   └── vite-env.d.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   └── .env.local
│   │
│   └── multi-view/                       # Example 3: Multiple LiquidViews
│       ├── src/
│       │   ├── App.tsx
│       │   ├── components/
│       │   ├── main.tsx
│       │   └── vite-env.d.ts
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       └── .env.local
│
├── package.json                          # Root workspace config
├── pnpm-workspace.yaml                   # packages/* and examples/*
├── tsconfig.base.json                    # Shared TypeScript strict config
├── vitest.config.ts                      # Shared Vitest base config
├── biome.json                            # Biome linting + formatting config
├── .size-limit.json                      # Per-package bundle budgets (ADR-018)
├── turbo.json                            # Turborepo task pipeline config
├── .changeset/
│   └── config.json                       # Changesets config for versioning
├── .gitignore
├── .nvmrc                                # Node 22 LTS pinned
├── LICENSE                               # MIT
└── README.md
```

### Architectural Boundaries

**Package Dependency Boundaries (Strictly Enforced):**

```
@flui/core         → zod (only runtime dependency)
@flui/react        → @flui/core (peer), react + react-dom (peer)
@flui/openai       → @flui/core (peer), openai (peer)
@flui/anthropic    → @flui/core (peer), @anthropic-ai/sdk (peer)
@flui/testing      → @flui/core (peer)
```

**Package Boundary Rules:**

- `@flui/core` has zero awareness of React, OpenAI, or Anthropic
- `@flui/react` has zero awareness of specific LLM providers
- Connector packages (`openai`, `anthropic`) have zero awareness of React
- `@flui/testing` has zero awareness of React or LLM providers
- All inter-package dependencies are `peerDependencies`, never `dependencies`
- No circular dependencies between packages — dependency graph is a DAG

**Module Boundaries Within @flui/core:**

```
spec/          → zero imports from other modules (foundation)
errors/        → zero imports from other modules (foundation)
registry/      → imports spec/
intent/        → imports errors/
context/       → imports errors/
validation/    → imports spec/, registry/, errors/
generation/    → imports spec/, registry/, intent/, context/, validation/, errors/
cache/         → imports spec/, errors/
data/          → imports spec/, errors/
policy/        → imports generation/, cache/, errors/
concurrency/   → imports generation/, errors/
observe/       → imports errors/ (accepts trace data from any module)
flui.ts        → imports all modules (factory wiring)
```

**Module Boundary Rules:**

- Modules import only from other modules' `index.ts` barrel files
- No module imports from `flui.ts` (the factory) — only the factory imports modules
- `observe/` is special: other modules push trace data into it, but it never imports other modules
- `spec/` and `errors/` are leaf dependencies — they import nothing from `@flui/core`

### Requirements to Structure Mapping

**FR Capability Areas → Physical Location:**

| FR Area | Module(s) | Package | Sprint |
|---------|-----------|---------|--------|
| Intent & Context Processing (FR1-7) | `intent/`, `context/` | `@flui/core` | Sprint 2 |
| Component Management (FR8-13) | `registry/` | `@flui/core` | Sprint 1 |
| UI Generation (FR14-24) | `generation/`, `data/`, `spec/` | `@flui/core` + `@flui/react` (renderer) | Sprint 2-4 |
| Validation & Safety (FR25-34) | `validation/` | `@flui/core` | Sprint 1-2 |
| Cost & Performance Control (FR35-43) | `policy/`, `cache/`, `concurrency/` | `@flui/core` | Sprint 3, 5 |
| Observability & Debugging (FR44-51) | `observe/`, `debug/` | `@flui/core` + `@flui/react` (overlay) | Sprint 3, 6 |
| Developer Experience & Testing (FR52-58) | `flui.ts`, `@flui/testing` | `@flui/core` + `@flui/testing` | Sprint 1, 6 |

**Cross-Cutting Concerns → Physical Location:**

| Concern | Primary Location | Touches |
|---------|-----------------|---------|
| FluiError / Result | `errors/` | Every module returns Result or throws FluiError |
| GenerationTrace | `observe/trace.ts` | Enriched by `intent/`, `context/`, `generation/`, `validation/`, `cache/`, connectors |
| AbortSignal | `concurrency/controller.ts` | Propagated through `generation/`, connectors, `@flui/react` |
| Zod schemas | `spec/spec.schema.ts`, `registry/registry.schema.ts` | Used by `validation/`, `generation/spec-parser.ts` |
| ViewState | `@flui/react/renderer/view-state.ts` | Touches `LiquidView`, `spec-renderer`, `a11y` |

### Integration Points

**Internal Communication — Generation Pipeline Flow:**

```
createFlui() → configures all modules
               │
generateUI()   intent/ → context/ → generation/prompt-builder
               │                           │
               │                     generation/orchestrator
               │                           │
               │                     cache/ (check hit)
               │                           │
               │                     connector.generate() ← @flui/openai or @flui/anthropic
               │                           │
               │                     generation/spec-parser
               │                           │
               │                     validation/pipeline
               │                           │
               │                     cache/ (store result)
               │                           │
               └──────────────── → Result<UISpecification>
```

**External Integrations:**

| Integration | Package | Interface |
|------------|---------|-----------|
| OpenAI API | `@flui/openai` | `LLMConnector.generate(prompt, options, signal)` |
| Anthropic API | `@flui/anthropic` | `LLMConnector.generate(prompt, options, signal)` |
| React DOM | `@flui/react` | `LiquidView` component, `FluiProvider` context |
| Browser Storage | `@flui/core/cache` | `sessionStorage` (L2), `IndexedDB` (L3 optional) |
| Web Crypto | `@flui/core/cache/key.ts` | `crypto.subtle.digest('SHA-256', ...)` |

**Data Flow (End-to-End):**

```
Developer App
    │
    ├── registerComponent() → Registry (one-time setup)
    ├── createFlui({ connector, config }) → FluiInstance
    │
    └── <FluiProvider instance={flui}>
          <LiquidView
            intent="Show sales dashboard"
            context={{ user, viewport }}
            data={{ salesData }}
            fallback={<StaticDashboard />}
          />
        </FluiProvider>
              │
              ├── Intent Parser: sanitize + parse intent string
              ├── Context Engine: merge user context + environment
              ├── Cache Manager: check L1 → L2 → L3
              ├── (miss) Generation Orchestrator:
              │     ├── Prompt Builder: registry + context → prompt
              │     ├── LLM Connector: prompt → raw response
              │     └── Spec Parser: raw response → UISpecification
              ├── Validation Pipeline: schema → component → prop → a11y
              ├── Cache Manager: store validated spec
              ├── Data Resolver: resolve data references in spec
              ├── Spec Renderer: UISpecification → React components
              ├── ViewState: restore interaction state
              └── Render → DOM
```

### Development Workflow Integration

**Development Commands (via Turborepo):**

```bash
pnpm dev            # Watch mode for all packages (tsup --watch)
pnpm build          # Build all packages in dependency order
pnpm test           # Run all tests (Vitest)
pnpm lint           # Biome check all packages
pnpm format         # Biome format all packages
pnpm size           # Check bundle sizes against budgets
pnpm changeset      # Create a changeset for version bump
```

**Build Process:**

- Turborepo orchestrates builds in dependency order: `core` → `react`, `openai`, `anthropic`, `testing`
- Each package builds with tsup: `src/index.ts` → `dist/index.mjs` (ESM) + `dist/index.cjs` (CJS) + `dist/index.d.ts`
- size-limit checks run after build, comparing against `.size-limit.json` budgets

**CI Pipeline (`ci.yml`):**

```
Trigger: Pull Request to main
Matrix: Node 20, Node 22

Steps:
1. pnpm install --frozen-lockfile
2. pnpm lint (Biome)
3. pnpm build (tsup via Turborepo)
4. pnpm test (Vitest via Turborepo)
5. pnpm size (size-limit check)
```

**Release Pipeline (`release.yml`):**

```
Trigger: Push to main (when .changeset/ has pending changesets)

Steps:
1. pnpm install --frozen-lockfile
2. pnpm build
3. pnpm test
4. changeset version (bump versions, update changelogs)
5. changeset publish --provenance (npm publish with SLSA)
6. git push tags
```

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:** All technology choices are compatible:

- TypeScript 5.8 + Zod 4.x: Zod 4 has first-class TypeScript support, inference works with strict mode
- tsup 8.5 + ES2022 target: tsup supports ES2022 output natively
- Vitest 4.0 + Biome 2.4: No conflicts — Vitest handles testing, Biome handles linting/formatting
- React 18+ target + React Testing Library 16.3: RTL 16 supports both React 18 and 19
- pnpm 10 + Turborepo 2.8 + Changesets 2.29: Well-established monorepo combination
- Zod 4 as sole runtime dep + size-limit enforcement: Zod 4 is 2.3x smaller than v3, aligning with bundle budget goals

**Pattern Consistency:** No contradictions found:

- File naming (`kebab-case.ts`) consistent across all module examples
- `Result<T, FluiError>` pattern referenced consistently in error handling, process patterns, and AbortSignal sections
- Import/export patterns (barrel-only imports, explicit named exports) align with module boundary rules
- `GenerationTrace` enrichment pattern consistent with observability cross-cutting concern

**Structure Alignment:** Project structure supports all decisions:

- Every module from Phase 1 spec has a corresponding directory in the project tree
- `errors/` module (added in step 04) correctly extends the Phase 1 spec — FluiError/Result promoted to dedicated module
- Package boundaries (peer deps only, no circular deps) correctly reflected in module dependency graph
- CI workflows support size-limit (ADR-018), npm provenance (NFR-S8), and dual Node version matrix

### Requirements Coverage Validation

**Functional Requirements Coverage (58/58 FRs):**

| FR Area | Coverage | Architecture Support |
|---------|----------|---------------------|
| Intent & Context (FR1-7) | 7/7 | `intent/` + `context/` modules, sanitization in `sanitizer.ts` |
| Component Management (FR8-13) | 6/6 | `registry/` module with Zod schema validation |
| UI Generation (FR14-24) | 11/11 | `generation/` + `spec/` + `data/` + `@flui/react` renderer |
| Validation & Safety (FR25-34) | 10/10 | 7 validators in `validation/validators/`, pipeline in `pipeline.ts` |
| Cost & Performance (FR35-43) | 9/9 | `policy/`, `cache/`, `concurrency/` modules |
| Observability (FR44-51) | 8/8 | `observe/` module + `@flui/react/debug/` overlay |
| DX & Testing (FR52-58) | 7/7 | `createFlui()` factory, `@flui/testing` package |

**Non-Functional Requirements Coverage (39/39 NFRs):**

| NFR Category | Coverage | Architecture Support |
|-------------|----------|---------------------|
| Performance (NFR-P1-10) | 10/10 | Performance budgets (ADR-015), size-limit CI, 3-level cache, L1 <1ms via Map |
| Security (NFR-S1-8) | 8/8 | Declarative-only output, intent sanitization, API key pass-through, npm provenance |
| Accessibility (NFR-A1-5) | 5/5 | `a11y.tsx` renderer, ARIA live regions (ADR-014), focus management |
| Reliability (NFR-R1-6) | 6/6 | Circuit breaker (ADR-011), mandatory fallback, AbortSignal cancellation, cache recovery |
| Integration (NFR-I1-5) | 5/5 | LLMConnector <100 lines, peer deps, `sideEffects: false` |
| Maintainability (NFR-M1-6) | 6/6 | Vitest coverage, zero `any`, TSDoc, Biome, module independence, API snapshots |

### Implementation Readiness Validation

**Decision Completeness:**

- All critical technology decisions documented with verified versions
- 20 ADRs + 15 architecture decisions = comprehensive decision coverage
- Implementation patterns include concrete TypeScript code examples for every pattern
- Error codes, Result pattern, trace enrichment, and AbortSignal all have copy-pasteable examples

**Structure Completeness:**

- Full project tree with every file and directory specified
- Module dependency graph explicitly documented
- Package boundaries and rules clearly stated
- CI/CD pipeline structure with trigger conditions and steps

**Pattern Completeness:**

- 18 conflict points identified and resolved
- Naming conventions cover files, code symbols, JSON serialization, and error codes
- Process patterns cover validation, loading states, imports, exports, and testing
- Enforcement mechanisms defined (Biome, TypeScript strict, size-limit, snapshots)

### Gap Analysis Results

**Critical Gaps: None.**

**Important Gaps (2 items — addressable during implementation, not blocking):**

1. **Error code registry:** Codes `FLUI_E001`–`FLUI_E099` defined as a range but specific assignments not enumerated. Codes should be assigned as modules are implemented, documented in `errors/error-codes.ts`.

2. **Prompt template strategy:** `generation/prompt-builder.ts` constructs prompts from registry + context, but specific prompt template format is not specified. Intentional — prompt engineering is an implementation detail that evolves through testing with real LLMs.

**Nice-to-Have Gaps (2 items — post-Phase 1):**

1. **Contribution guidelines:** No `CONTRIBUTING.md` defined. Add when project goes public.
2. **Performance benchmark suite:** ADR-015 defines budgets but no benchmark automation. Can be added in Sprint 6.

### Architecture Completeness Checklist

**Requirements Analysis**

- [x] Project context thoroughly analyzed (58 FRs, 39 NFRs mapped)
- [x] Scale and complexity assessed (Medium-High, 14 modules, 5 packages)
- [x] Technical constraints identified (9 constraints from PRD/ADRs/Phase 1)
- [x] Cross-cutting concerns mapped (8 concerns with strategies)

**Architectural Decisions**

- [x] Critical decisions documented with versions (15 decisions + 20 ADRs)
- [x] Technology stack fully specified with verified versions
- [x] Integration patterns defined (LLMConnector, generation pipeline, React adapter)
- [x] Performance considerations addressed (budgets, cache, size-limit)

**Implementation Patterns**

- [x] Naming conventions established (files, code, JSON, errors)
- [x] Structure patterns defined (module layout, package layout)
- [x] Communication patterns specified (function calls, callbacks, AbortSignal)
- [x] Process patterns documented (validation, loading states, imports, testing)

**Project Structure**

- [x] Complete directory structure defined (~100 files mapped)
- [x] Component boundaries established (package deps, module deps)
- [x] Integration points mapped (pipeline flow, external integrations, data flow)
- [x] Requirements to structure mapping complete (7 FR areas → modules)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**

- Exceptionally well-constrained solution space: 20 ADRs + comprehensive PRD eliminate ambiguity
- Every module has a clear location, clear boundaries, and clear dependency rules
- Implementation patterns include executable TypeScript examples — AI agents can copy patterns directly
- 6-sprint sequence with explicit dependency graph provides clear implementation order
- Zero `any`, Result pattern, and typed errors create strong type-safety guarantees across the codebase

**Areas for Future Enhancement:**

- Error code assignments (during implementation)
- Prompt template engineering (Sprint 2-3, iterative)
- Performance benchmark automation (Sprint 6)
- Contribution guidelines (when open-sourced)

### Implementation Handoff

**AI Agent Guidelines:**

- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries (package DAG, module barrel imports)
- Refer to this document for all architectural questions
- When in doubt, check the 20 ADRs in `docs/flui-architecture-decisions.md` for detailed rationale

**First Implementation Priority:**

```bash
# Sprint 0: Monorepo initialization
pnpm init
# Configure pnpm-workspace.yaml, tsconfig.base.json, biome.json,
# turbo.json, .size-limit.json, vitest.config.ts
# Initialize all 5 packages with package.json + tsconfig.json + tsup.config.ts
# Set up .github/workflows/ci.yml
# Verify: pnpm build && pnpm test && pnpm lint && pnpm size
```
