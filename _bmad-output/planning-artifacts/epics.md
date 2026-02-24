---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
---

# flui - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for flui, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Developers can provide a text intent describing the desired UI outcome to trigger generation
FR2: Developers can provide intent programmatically via structured objects (component type, data shape, interaction pattern)
FR3: The system can resolve context about the current user (identity: role, permissions, expertise level)
FR4: The system can resolve context about the current environment (device type, viewport size, connection quality)
FR5: Developers can register custom context providers that supply domain-specific context signals
FR6: The system can combine multiple context signals into a unified context object for generation
FR7: The system can sanitize user-provided intents to prevent prompt injection
FR8: Developers can register UI components with the framework, declaring accepted props via schema
FR9: Developers can register components with metadata (name, category, description) for LLM component selection
FR10: Developers can batch-register multiple components in a single operation
FR11: Developers can query the component registry to discover registered components by category or capability
FR12: The system can serialize the component registry into a format suitable for LLM prompt construction
FR13: The system can validate component registration metadata at registration time, rejecting invalid definitions
FR14: The system can generate a declarative UI specification (JSON) from an intent, context, and component registry using an LLM
FR15: The system can construct prompts that include component registry metadata, context signals, and generation rules
FR16: The system can parse and validate LLM responses into structured UISpecification objects
FR17: The system can stream LLM responses and progressively construct the UISpecification
FR18: Developers can connect any LLM provider (OpenAI, Anthropic, or custom) via a connector interface
FR19: The system can render a validated UISpecification into actual React components
FR20: The system can wire data flows between generated components as defined in the specification (InteractionSpec)
FR21: The system can manage view state (local state within generated components) across re-generations
FR22: The system can apply visual transitions when replacing one generated UI with another
FR23: Developers can provide a mandatory fallback UI that renders when generation fails or is unavailable
FR24: The system can resolve data identifiers referenced in generated specifications via developer-defined data resolvers
FR25: The system can validate every generated specification against a JSON schema before rendering
FR26: The system can validate that generated specifications only reference registered components
FR27: The system can validate that generated component props conform to their declared schemas
FR28: The system can validate generated specifications for WCAG AA accessibility compliance
FR29: The system can validate that generated specifications do not reference unauthorized data sources
FR30: Developers can add custom validators to the validation pipeline (e.g., brand rules, compliance rules, mobile constraints)
FR31: The validation pipeline can reject invalid specifications and provide structured error details
FR32: The system can retry generation with modified prompts when validation fails
FR33: The validation pipeline cannot be bypassed — every generated specification must pass through it before rendering
FR34: The system can activate a circuit breaker after consecutive generation failures, locking to fallback mode
FR35: Developers can configure cost budgets per session and per time period (e.g., daily)
FR36: The system can estimate generation cost before making an LLM call based on prompt size
FR37: The system can enforce budget limits synchronously, preventing LLM calls that would exceed the budget
FR38: The system can gracefully degrade to cached specifications when budget limits are reached
FR39: The system can cache generated specifications at three levels (in-memory, session storage, persistent storage)
FR40: Developers can configure cache TTL per intent category
FR41: The system can serve cached specifications for repeated intent+context combinations within TTL
FR42: The system can cancel in-flight generation requests when a newer request supersedes them (latest-wins)
FR43: The system can control generation policy (when to generate vs. serve from cache vs. show fallback)
FR44: The system can produce a structured trace for every generation (intent, context, components selected, validation result, latency, cost)
FR45: The system can transport traces to configurable destinations (console, in-memory buffer, custom transports)
FR46: Developers can access a debug overlay that displays the current UISpecification (Spec tab)
FR47: Developers can access a debug overlay that displays the generation trace (Trace tab)
FR48: Developers can search and filter generation traces by timestamp, intent, or context attributes
FR49: The system can report cost metrics (per-generation cost, cumulative session cost, daily cost)
FR50: The system can report cache metrics (hit rate, miss rate, eviction count)
FR51: Developers can export generation traces via a transport interface for integration with external systems (SIEM, log aggregators)
FR52: Developers can install and use the framework with zero configuration beyond providing an LLM API key
FR53: Developers can add a single LiquidView component to an existing React application without modifying other components
FR54: Developers can test LiquidView components using a deterministic mock connector that requires no LLM API key
FR55: Developers can programmatically generate UISpecification objects for assertion testing
FR56: Developers can mount and test LiquidView components with assertion helpers
FR57: The framework can provide typed error codes with descriptive messages for all failure modes
FR58: The framework can emit TypeScript compilation errors for common misconfigurations (e.g., missing fallback prop)

### NonFunctional Requirements

**Performance:**
NFR-P1: Generation latency P50 < 500ms, P99 < 2,000ms (excluding LLM network time)
NFR-P2: Validation pipeline total execution < 5ms for standard validator set
NFR-P3: Cache lookup (L1 in-memory) < 1ms
NFR-P4: Cache lookup (L2 session storage) < 5ms
NFR-P5: Cache lookup (L3 IndexedDB) < 20ms
NFR-P6: @flui/core bundle size < 25KB gzipped
NFR-P7: @flui/react bundle size < 8KB gzipped
NFR-P8: Each LLM connector bundle size < 3KB gzipped
NFR-P9: LiquidView component mount-to-fallback render < 16ms (one frame)
NFR-P10: Tree-shaking removes unused validators, context providers, and cache storages from consumer bundles

**Security:**
NFR-S1: LLM output is declarative-only (JSON specification) — no executable code paths in generated output
NFR-S2: Intent Parser sanitizes user-provided text to prevent prompt injection patterns
NFR-S3: DataResolver rejects data identifiers not explicitly provided in context
NFR-S4: Component Registry validates all metadata at registration time — no malformed component definitions accepted at runtime
NFR-S5: Observability traces support field-level redaction for PII-sensitive context attributes
NFR-S6: LLM API keys are never logged, cached, or included in observability traces
NFR-S7: No eval(), new Function(), innerHTML, or dynamic script injection anywhere in the framework
NFR-S8: npm packages published with provenance (SLSA) for supply chain verification

**Accessibility:**
NFR-A1: All generated UISpecifications pass WCAG 2.1 AA validation before rendering
NFR-A2: Focus management is maintained across spec transitions
NFR-A3: Generated specifications include ARIA labels, roles, and live regions as required by component type
NFR-A4: Debug overlay is keyboard-navigable and screen-reader accessible
NFR-A5: LiquidView announces spec transitions to assistive technology via ARIA live regions

**Reliability:**
NFR-R1: Fallback UI renders in 100% of LLM failure scenarios
NFR-R2: Circuit breaker activates after 3 consecutive generation failures, locking to fallback mode
NFR-R3: Application continues functioning (with cached/fallback UIs) during complete LLM provider outage
NFR-R4: Concurrency controller cancels stale requests cleanly — no orphaned promises, no memory leaks
NFR-R5: Cache corruption is detected and evicted — does not crash the application
NFR-R6: Framework initialization failure throws descriptive error at startup, not at first generation

**Integration:**
NFR-I1: LLM connector interface is provider-agnostic — implementing a new connector requires only the LLMConnector interface (< 100 lines typical)
NFR-I2: Observability transport interface supports async transports for external system integration
NFR-I3: Framework has zero dependency on specific React state management (Redux, Zustand, Jotai)
NFR-I4: Framework does not conflict with existing React context providers in the host application
NFR-I5: Custom validators, context providers, and transports can be distributed as standalone npm packages

**Maintainability:**
NFR-M1: Test coverage on @flui/core > 90% (line coverage)
NFR-M2: Zero `any` types in public API surface
NFR-M3: All public APIs documented with TSDoc comments
NFR-M4: Biome linting passes with zero warnings on all packages
NFR-M5: Each module is independently testable without requiring other modules
NFR-M6: Breaking API changes are detected by a public API surface snapshot test

### Additional Requirements

**From Architecture — Starter Template (CRITICAL for Epic 1 Story 1):**
- Custom monorepo built from Phase 1 specification (not using generic templates)
- Monorepo initialization: pnpm workspace, Turborepo, Changesets, shared configs
- 5 npm packages: @flui/core, @flui/react, @flui/openai, @flui/anthropic, @flui/testing

**From Architecture — Build System & Tooling:**
- TypeScript 5.8.0 with strict mode (strict: true, noUncheckedIndexedAccess: true, exactOptionalProperties: true)
- tsup 8.5.1 (esbuild-based) for dual ESM + CJS output per package
- Turborepo 2.8.10 for task orchestration and optional remote caching
- pnpm 10.30.2 for workspace management
- Biome 2.4.4 for linting and formatting (replaces ESLint + Prettier)
- size-limit 11.2.0 with per-package bundle budgets
- ES2022 target for modern syntax
- .nvmrc pinning Node 22 LTS

**From Architecture — CI/CD:**
- GitHub Actions CI platform with 3 workflows (ci.yml, release.yml, canary.yml)
- Node.js version matrix: Node 22 LTS (primary) + Node 20 LTS (compatibility)
- Runner: ubuntu-24.04
- npm provenance (SLSA) via --provenance flag on publish

**From Architecture — Package Structure:**
- @flui/core contains exactly 14 modules: spec, errors, registry, intent, context, validation, generation, cache, data, policy, concurrency, observe, types.ts, flui.ts
- Strict module boundary rules: import only from barrel index.ts files
- kebab-case file naming, co-located tests ({source-file}.test.ts)
- sideEffects: false in all package.json files

**From Architecture — Cross-Cutting Patterns (MANDATORY):**
- FluiError + Result pattern for all async public API functions
- AbortSignal propagation through all async functions in generation pipeline
- GenerationTrace enrichment — every module must add trace steps
- Import only from barrel files, explicit named exports only, no export * or export default

**From Architecture — External Integration:**
- OpenAI API via @flui/openai implementing LLMConnector interface
- Anthropic API via @flui/anthropic implementing LLMConnector interface
- API key pass-through only — Flui never stores, logs, or persists keys
- Browser Storage: L2 sessionStorage, L3 IndexedDB (optional via idb-keyval)
- Web Crypto API for cache key hashing (SHA-256)
- React 18+ compatibility (not React 19-only features)

**From Architecture — Validation Pipeline:**
- Zero-bypass architecture: schema -> component -> props -> a11y -> custom
- Each validator returns ValidationResult (never throws)
- Fallback rendering mandatory on validation failure

**From Architecture — Testing:**
- Vitest 4.0.18 test framework with per-package suites
- React Testing Library for @flui/react component tests
- >90% test coverage required (CI enforcement)
- API surface snapshot testing via @microsoft/api-extractor
- MockConnector from @flui/testing for LLM simulation
- Always test both Result.ok and Result.error paths
- Always test AbortSignal cancellation for async functions

**From Architecture — React Adapter Specifics:**
- LiquidView component with 5 defined states (idle, generating, validating, rendering, error)
- FluiProvider context wrapper
- Hooks: use-liquid-view, use-fluid-debug, use-fluid-context
- Debug overlay with SpecTab and TraceTab
- Crossfade transitions, focus management, ARIA live regions
- No Suspense integration in Phase 1

**From Architecture — Dependencies:**
- Zod 4.3.6 — sole runtime dependency of @flui/core
- LLM provider SDKs as peer deps of connector packages
- react + react-dom as peer deps of @flui/react
- @testing-library/react for React component testing
- idb-keyval as optional peer dep for L3 cache

**From Architecture — Example Apps:**
- 3 example applications: basic-dashboard, invoice-hybrid, multi-view
- Each requires .env.local for API keys (gitignored)

### FR Coverage Map

FR1: Epic 3 — Text intent to trigger generation
FR2: Epic 3 — Programmatic intent via structured objects
FR3: Epic 3 — Resolve user context (role, permissions, expertise)
FR4: Epic 3 — Resolve environment context (device, viewport, connection)
FR5: Epic 3 — Register custom context providers
FR6: Epic 3 — Combine context signals into unified object
FR7: Epic 3 — Sanitize intents to prevent prompt injection
FR8: Epic 2 — Register components with prop schemas
FR9: Epic 2 — Register components with metadata for LLM selection
FR10: Epic 2 — Batch-register multiple components
FR11: Epic 2 — Query registry by category or capability
FR12: Epic 2 — Serialize registry for LLM prompt construction
FR13: Epic 2 — Validate registration metadata, reject invalid
FR14: Epic 4 — Generate declarative UI spec from intent+context+registry
FR15: Epic 4 — Construct prompts with registry, context, rules
FR16: Epic 4 — Parse/validate LLM responses into UISpecification
FR17: Epic 4 — Stream LLM responses, progressive spec construction
FR18: Epic 4 — Connect any LLM provider via connector interface
FR19: Epic 6 — Render validated UISpecification into React components
FR20: Epic 6 — Wire data flows between generated components
FR21: Epic 6 — Manage view state across re-generations
FR22: Epic 6 — Apply visual transitions between UIs
FR23: Epic 6 — Mandatory fallback UI on failure
FR24: Epic 4 — Resolve data identifiers via data resolvers
FR25: Epic 5 — Validate specs against JSON schema
FR26: Epic 5 — Validate specs only reference registered components
FR27: Epic 5 — Validate component props conform to schemas
FR28: Epic 5 — Validate specs for WCAG AA accessibility
FR29: Epic 5 — Validate specs don't reference unauthorized data
FR30: Epic 5 — Add custom validators to pipeline
FR31: Epic 5 — Reject invalid specs with structured errors
FR32: Epic 5 — Retry generation when validation fails
FR33: Epic 5 — Validation pipeline cannot be bypassed
FR34: Epic 7 — Circuit breaker after consecutive failures
FR35: Epic 7 — Configure cost budgets per session/time period
FR36: Epic 7 — Estimate generation cost before LLM call
FR37: Epic 7 — Enforce budget limits synchronously
FR38: Epic 7 — Degrade to cached specs when budget reached
FR39: Epic 7 — 3-level cache (memory, session, persistent)
FR40: Epic 7 — Configure cache TTL per intent category
FR41: Epic 7 — Serve cached specs for repeated intent+context within TTL
FR42: Epic 7 — Cancel stale in-flight requests (latest-wins)
FR43: Epic 7 — Control generation policy (generate vs cache vs fallback)
FR44: Epic 8 — Structured trace for every generation
FR45: Epic 8 — Transport traces to configurable destinations
FR46: Epic 8 — Debug overlay — Spec tab
FR47: Epic 8 — Debug overlay — Trace tab
FR48: Epic 8 — Search/filter traces
FR49: Epic 8 — Report cost metrics
FR50: Epic 8 — Report cache metrics
FR51: Epic 8 — Export traces via transport interface
FR52: Epic 8 — Zero-config install (just provide API key)
FR53: Epic 6 — Drop-in LiquidView component
FR54: Epic 8 — MockConnector for testing without LLM key
FR55: Epic 8 — Programmatic UISpecification generation for testing
FR56: Epic 8 — Mount/test LiquidView with assertion helpers
FR57: Epic 1 — Typed error codes with descriptive messages
FR58: Epic 1 — TypeScript compilation errors for misconfigurations

## Epic List

### Epic 1: Project Foundation & Core Types
Developers can install the flui monorepo, build all packages, and run the toolchain. Foundation types (UISpecification, FluiError, Result pattern) are established for all downstream modules.
**FRs covered:** FR57, FR58
**NFRs addressed:** NFR-P6, NFR-P7, NFR-P8, NFR-P10, NFR-S7, NFR-S8, NFR-M2, NFR-M4, NFR-M5, NFR-M6

### Epic 2: Component Registration & Discovery
Developers can register UI components with schemas and metadata, batch-register them, query the registry by category, and serialize the registry for LLM prompt construction. Validation at registration time prevents invalid definitions.
**FRs covered:** FR8, FR9, FR10, FR11, FR12, FR13
**NFRs addressed:** NFR-S4

### Epic 3: Intent Processing & Context Resolution
Developers can provide text or structured intents, register custom context providers, and the system combines context signals (user identity, environment) into a unified object. Intent sanitization prevents prompt injection.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7
**NFRs addressed:** NFR-S2

### Epic 4: UI Generation Pipeline
Developers can generate declarative UI specifications from intent + context + registry using any LLM provider. The system constructs prompts, calls the LLM, parses responses, and supports streaming. Includes the LLM connector interface and OpenAI/Anthropic implementations.
**FRs covered:** FR14, FR15, FR16, FR17, FR18, FR24
**NFRs addressed:** NFR-P1, NFR-S1, NFR-S6, NFR-I1

### Epic 5: Validation & Safety Pipeline
Every generated specification passes through a mandatory, zero-bypass validation pipeline (schema, component, props, accessibility, data authorization, custom validators). Invalid specs are rejected with structured errors, and the system can retry generation on failure.
**FRs covered:** FR25, FR26, FR27, FR28, FR29, FR30, FR31, FR32, FR33
**NFRs addressed:** NFR-P2, NFR-A1, NFR-A3, NFR-S1, NFR-S3

### Epic 6: React Rendering & Interaction
Developers can add a LiquidView component to an existing React app with a mandatory fallback UI. The system renders validated specs into React components, wires data flows (InteractionSpec), manages view state across re-generations, applies visual transitions, and handles focus management with ARIA live regions.
**FRs covered:** FR19, FR20, FR21, FR22, FR23, FR53
**NFRs addressed:** NFR-P9, NFR-A2, NFR-A5, NFR-I3, NFR-I4, NFR-R1

### Epic 7: Caching, Cost Control & Concurrency
Developers can configure 3-level caching (memory, session, persistent), set cost budgets per session/time period, and the system enforces budget limits, degrades gracefully, cancels stale requests (latest-wins), controls generation policy, and activates circuit breaker on repeated failures.
**FRs covered:** FR34, FR35, FR36, FR37, FR38, FR39, FR40, FR41, FR42, FR43
**NFRs addressed:** NFR-P3, NFR-P4, NFR-P5, NFR-R2, NFR-R3, NFR-R4, NFR-R5

### Epic 8: Observability & Developer Tooling
Developers can trace every generation decision, transport traces to configurable destinations, access a debug overlay (Spec + Trace tabs), search/filter traces, view cost and cache metrics, and export traces to external systems. Includes the testing package with MockConnector and assertion helpers.
**FRs covered:** FR44, FR45, FR46, FR47, FR48, FR49, FR50, FR51, FR52, FR54, FR55, FR56
**NFRs addressed:** NFR-S5, NFR-S6, NFR-I2, NFR-A4, NFR-R6, NFR-M1, NFR-M3

## Epic 1: Project Foundation & Core Types

Developers can install the flui monorepo, build all packages, and run the toolchain. Foundation types (UISpecification, FluiError, Result pattern) are established for all downstream modules.

### Story 1.1: Initialize Monorepo with Build Toolchain

As a developer,
I want to clone the flui repository and have a fully working monorepo with build, lint, test, and size-limit tooling,
So that I can start developing modules across all 5 packages with consistent tooling and CI enforcement.

**Acceptance Criteria:**

**Given** a fresh clone of the repository
**When** the developer runs `pnpm install`
**Then** all 5 packages (@flui/core, @flui/react, @flui/openai, @flui/anthropic, @flui/testing) are installed with workspace linking
**And** pnpm-workspace.yaml defines the packages/* glob

**Given** the monorepo is installed
**When** the developer runs `pnpm build`
**Then** tsup produces dist/index.mjs, dist/index.cjs, and dist/index.d.ts for each package
**And** Turborepo orchestrates builds in dependency order (core first, then react/openai/anthropic/testing)

**Given** the monorepo is installed
**When** the developer runs `pnpm lint`
**Then** Biome 2.4.4 checks all packages with zero warnings
**And** the shared biome.json config at root is used

**Given** the monorepo is installed
**When** the developer runs `pnpm test`
**Then** Vitest 4.0.18 runs test suites across all packages (empty test files pass)

**Given** the monorepo is installed
**When** the developer runs `pnpm size`
**Then** size-limit checks bundle budgets per package (@flui/core < 25KB, @flui/react < 8KB, connectors < 3KB gzipped)

**Given** the monorepo root
**Then** .nvmrc pins Node 22 LTS
**And** tsconfig.base.json enables strict: true, noUncheckedIndexedAccess: true, exactOptionalProperties: true
**And** ES2022 is the compilation target
**And** all package.json files include sideEffects: false
**And** Changesets is initialized with .changeset/config.json
**And** turbo.json defines the task pipeline (build, test, lint, size)

**Given** each package scaffold
**Then** it contains src/index.ts (empty barrel), package.json, tsconfig.json (extends base), and tsup.config.ts

### Story 1.2: Establish UISpecification Types & Schema

As a developer,
I want a well-defined UISpecification type with Zod schemas and versioning,
So that all modules share a single source of truth for the generated UI specification structure.

**Acceptance Criteria:**

**Given** the spec/ module in @flui/core
**When** a developer imports from @flui/core
**Then** UISpecification type is available with fields for components, layout, interactions, and metadata
**And** ComponentSpec type defines component references with typed props
**And** InteractionSpec type defines data flow wiring between components
**And** LayoutSpec type defines spatial arrangement of components

**Given** the spec/ module
**When** a UISpecification object is validated
**Then** the Zod schema validates the complete structure including nested component specs
**And** invalid specifications produce structured validation errors with field paths

**Given** the spec/ module
**Then** a spec version identifier is defined for future compatibility
**And** the module exports only through index.ts barrel with explicit named exports
**And** no export * or export default is used

**Given** the spec/ module source files
**Then** spec.ts contains the core implementation
**And** spec.types.ts contains all type definitions
**And** spec.schema.ts contains Zod schemas
**And** spec.test.ts contains co-located unit tests
**And** all tests pass with >90% coverage on the module

### Story 1.3: Implement FluiError & Result Pattern

As a developer,
I want typed error handling with FluiError codes and a Result pattern,
So that every module returns predictable, structured errors instead of throwing exceptions.

**Acceptance Criteria:**

**Given** the errors/ module in @flui/core
**When** a developer creates a FluiError
**Then** it extends Error with code (FLUI_E001–FLUI_E099), category (validation | generation | cache | connector | config), optional context record, and optional cause error
**And** this story defines initial error codes FLUI_E001–FLUI_E010 for startup, config, and type errors; remaining codes are reserved for allocation by later stories

**Given** an async public API function in any module
**When** it completes successfully
**Then** it returns Result.ok(value) with the typed value

**Given** an async public API function in any module
**When** it encounters an error
**Then** it returns Result.error(fluiError) with a structured FluiError (never throws)

**Given** a sync configuration function
**When** it receives invalid config
**Then** it throws a FluiError (programmer error at startup, per NFR-R6)
**And** the error message is descriptive with the specific misconfiguration

**Given** a common misconfiguration (e.g., missing fallback prop)
**When** TypeScript compiles the code
**Then** a compilation error is emitted guiding the developer to fix it (FR58)

**Given** the errors/ module source files
**Then** errors.ts contains FluiError class and Result type implementation
**And** errors.types.ts contains FluiErrorCode literals and ErrorCategory enum
**And** errors.constants.ts contains all error code constants
**And** errors.test.ts contains co-located tests covering ok and error paths
**And** zero `any` types in the public API

### Story 1.4: Implement Shared Types & LLMConnector Interface

As a developer,
I want shared type definitions including the LLMConnector interface and GenerationTrace structure,
So that all packages and modules have consistent type contracts for cross-cutting concerns.

**Acceptance Criteria:**

**Given** the types.ts shared types in @flui/core
**When** a developer imports shared types
**Then** LLMConnector interface is available with generate(prompt, options, signal): Promise<LLMResponse> signature
**And** GenerationTrace structure is defined with addStep({ module, operation, durationMs, metadata }) method
**And** AbortSignal parameter pattern is documented in the interface

**Given** the LLMConnector interface
**Then** it is provider-agnostic and implementable in < 100 lines (NFR-I1)
**And** it accepts an optional AbortSignal as last parameter on generate()
**And** it does not reference any specific LLM provider types

**Given** the GenerationTrace structure
**Then** trace steps include module (kebab-case), operation (camelCase), durationMs (number), and metadata (Record<string, unknown>)
**And** timestamps use Unix milliseconds (Date.now())
**And** no sensitive data (API keys, raw LLM responses) can be stored in trace metadata

**Given** shared type files
**Then** types are exported through the @flui/core barrel index.ts
**And** all types use explicit named exports
**And** zero `any` types in the public surface (NFR-M2)

### Story 1.5: Set Up CI/CD Pipelines

As a developer,
I want GitHub Actions CI/CD pipelines that enforce quality on every PR and automate releases,
So that code quality, bundle sizes, and versioning are enforced automatically.

**Acceptance Criteria:**

**Given** a pull request to main
**When** ci.yml runs
**Then** it executes on ubuntu-24.04 with Node 22 LTS (primary) and Node 20 LTS (compatibility)
**And** it runs pnpm lint, pnpm test, pnpm build, and pnpm size in sequence
**And** the PR is blocked if any step fails

**Given** a push to main with changesets present
**When** release.yml runs
**Then** it bumps versions across affected packages using Changesets
**And** it publishes to npm with --provenance flag (SLSA, NFR-S8)
**And** it creates a GitHub release with changelog

**Given** a push to the next branch
**When** canary.yml runs
**Then** it publishes canary builds to npm for pre-release testing

**Given** the CI pipeline
**Then** no eval(), new Function(), innerHTML, or dynamic script injection exists in any package (NFR-S7, enforced by Biome rules)
**And** Turborepo caching is configured for CI efficiency

## Epic 2: Component Registration & Discovery

Developers can register UI components with schemas and metadata, batch-register them, query the registry by category, and serialize the registry for LLM prompt construction. Validation at registration time prevents invalid definitions.

### Story 2.1: Register Components with Schema & Metadata

As a developer,
I want to register UI components with declared prop schemas and descriptive metadata,
So that the framework knows what components are available and can validate their usage.

**Acceptance Criteria:**

**Given** the registry/ module in @flui/core
**When** a developer registers a component with a name, category, description, and Zod prop schema
**Then** the component is stored in the registry and retrievable by name
**And** the registration returns a Result.ok confirming success

**Given** a component registration attempt
**When** the metadata is invalid (missing name, empty category, or malformed schema)
**Then** the registration is rejected at registration time with a Result.error containing a FluiError (NFR-S4)
**And** the error includes the specific validation failure details

**Given** a component registration attempt
**When** a component with the same name is already registered
**Then** the registration returns a Result.error indicating a duplicate registration
**And** the existing registration is not overwritten

**Given** the registry/ module source files
**Then** registry.ts contains the core implementation
**And** registry.types.ts contains ComponentDefinition and RegistryEntry types
**And** registry.schema.ts contains Zod schemas for validating registration metadata
**And** registry.test.ts contains co-located tests covering valid registrations, invalid metadata rejection, and duplicate handling
**And** all tests pass with >90% coverage on the module

### Story 2.2: Batch Registration & Registry Querying

As a developer,
I want to register multiple components at once and query the registry by category or capability,
So that I can efficiently set up my component library and discover available components.

**Acceptance Criteria:**

**Given** the registry/ module
**When** a developer calls batch-register with an array of component definitions
**Then** all valid components are registered in a single operation
**And** if any component in the batch is invalid, the operation returns a Result.error listing all failures
**And** no partial registration occurs on batch failure (atomic operation)

**Given** a populated registry
**When** a developer queries by category (e.g., "chart", "form", "layout")
**Then** all components matching that category are returned
**And** an empty array is returned if no components match

**Given** a populated registry
**When** a developer queries by capability or metadata attribute
**Then** matching components are returned based on the query criteria

**Given** batch registration and querying
**Then** co-located tests cover batch success, batch partial failure (atomic rollback), empty registry queries, and category filtering
**And** all tests pass with >90% coverage

### Story 2.3: Registry Serialization for LLM Prompts

As a developer,
I want the component registry to serialize its contents into a format suitable for LLM prompt construction,
So that the generation pipeline can include component information when asking the LLM to generate UI specifications.

**Acceptance Criteria:**

**Given** a populated registry with multiple components
**When** the serialize function is called
**Then** it produces a JSON representation with structure: `{ components: [{ name, category, description, props: { propName: typeString, ... } }] }`
**And** the output is optimized for LLM consumption (concise, structured, targeting < 2K tokens for a typical 20-component registry)

**Given** an empty registry
**When** the serialize function is called
**Then** it returns an empty or minimal representation indicating no components are available

**Given** the serialization output
**Then** it does not include internal implementation details or Zod schema objects
**And** prop schemas are represented in a human-readable format (e.g., property names with types)
**And** the output format is deterministic (same registry produces same serialization)

**Given** serialization tests
**Then** co-located tests verify serialization of single components, multiple components across categories, and empty registry
**And** all tests pass with >90% coverage

## Epic 3: Intent Processing & Context Resolution

Developers can provide text or structured intents, register custom context providers, and the system combines context signals (user identity, environment) into a unified object. Intent sanitization prevents prompt injection.

### Story 3.1: Parse Text & Structured Intents

As a developer,
I want to provide either a text description or a structured object describing the desired UI, with automatic sanitization,
So that the framework can accept flexible input while preventing prompt injection attacks.

**Acceptance Criteria:**

**Given** the intent/ module in @flui/core
**When** a developer provides a text intent (e.g., "Show a dashboard with sales metrics")
**Then** the intent parser normalizes it into a unified IntentObject with the original text and extracted signals
**And** the result is returned as Result.ok(IntentObject)

**Given** the intent/ module
**When** a developer provides a structured intent (component type, data shape, interaction pattern)
**Then** the intent parser validates and normalizes it into the same unified IntentObject
**And** invalid structured intents return Result.error with a descriptive FluiError

**Given** any text intent input
**When** the intent is parsed
**Then** the sanitizer strips known prompt injection patterns including: (1) instruction overrides ("ignore previous instructions", "disregard above"), (2) role injections ("you are now", "act as a"), (3) delimiter escapes (```, ----, <|), (4) system prompt extraction attempts ("repeat your system prompt"), and (5) encoding-based bypasses (unicode homoglyphs, base64 instructions) (NFR-S2)
**And** sanitized output is safe for inclusion in LLM prompts
**And** sanitization is implemented as a pure function
**And** the sanitization pattern list is extensible via configuration for domain-specific patterns

**Given** an empty or whitespace-only text intent
**When** the intent is parsed
**Then** a Result.error is returned with a FluiError indicating invalid intent

**Given** the intent/ module source files
**Then** intent.ts contains the parser and sanitizer implementation
**And** intent.types.ts contains IntentObject and related types
**And** intent.test.ts contains co-located tests covering text intents, structured intents, sanitization with known injection patterns, and edge cases
**And** all tests pass with >90% coverage on the module

### Story 3.2: Built-in Context Providers (Identity & Environment)

As a developer,
I want the system to resolve user identity context and environment context automatically,
So that generated UIs can adapt based on who the user is and what device they're using.

**Acceptance Criteria:**

**Given** the context/ module in @flui/core
**When** the identity context provider is invoked with user information
**Then** it resolves a context object containing role, permissions, and expertise level
**And** the result is returned as Result.ok(IdentityContext)

**Given** the context/ module
**When** the environment context provider is invoked
**Then** it resolves a context object containing device type, viewport size, and connection quality
**And** the result is returned as Result.ok(EnvironmentContext)

**Given** a context provider
**When** it fails to resolve (e.g., missing required data)
**Then** it returns Result.error with a FluiError describing the failure
**And** downstream consumers can handle the absence gracefully

**Given** context provider implementations
**Then** each provider accepts an optional AbortSignal as last parameter
**And** providers check signal.aborted before expensive operations

**Given** the context/ module source files
**Then** context.ts contains the context engine and built-in providers
**And** context.types.ts contains IdentityContext, EnvironmentContext, and ContextProvider interface types
**And** context.test.ts contains co-located tests covering successful resolution, failure paths, and AbortSignal cancellation
**And** all tests pass with >90% coverage on the module

### Story 3.3: Custom Context Providers & Context Aggregation

As a developer,
I want to register custom context providers and have all signals aggregated into a unified context object,
So that I can supply domain-specific context (e.g., tenant config, feature flags) that influences UI generation.

**Acceptance Criteria:**

**Given** the context/ module
**When** a developer registers a custom context provider implementing the ContextProvider interface
**Then** the provider is added to the context engine's provider list
**And** registration returns Result.ok confirming success

**Given** a context engine with multiple registered providers (built-in + custom)
**When** context resolution is triggered
**Then** all providers are invoked and their outputs combined into a single unified ContextObject
**And** the result is returned as Result.ok(ContextObject) containing all provider outputs keyed by provider name

**Given** context aggregation with multiple providers
**When** one provider fails
**Then** the aggregation returns Result.error with details about which provider failed
**And** successfully resolved contexts from other providers are included in the error's context record for developer debugging, but are NOT applied to generation (partial context is never used downstream)

**Given** context aggregation
**When** an AbortSignal is provided
**Then** the signal is propagated to all providers
**And** if aborted, pending providers are cancelled and the operation returns Result.error

**Given** custom provider registration
**Then** providers with duplicate names return Result.error indicating a conflict
**And** co-located tests cover multi-provider aggregation, partial failure, abort handling, and duplicate registration
**And** all tests pass with >90% coverage

## Epic 4: UI Generation Pipeline

Developers can generate declarative UI specifications from intent + context + registry using any LLM provider. The system constructs prompts, calls the LLM, parses responses, and supports streaming. Includes the LLM connector interface and OpenAI/Anthropic implementations.

### Story 4.1: LLM Connector Interface & OpenAI/Anthropic Implementations

As a developer,
I want to connect any LLM provider via a simple connector interface with ready-made OpenAI and Anthropic implementations,
So that I can use my preferred LLM provider without being locked into a specific vendor.

**Acceptance Criteria:**

**Given** the @flui/openai package
**When** a developer creates an OpenAI connector with an API key in constructor config
**Then** the connector implements the LLMConnector interface with generate(prompt, options, signal)
**And** the API key is passed through to the OpenAI SDK and never stored, logged, or persisted by flui (NFR-S6)
**And** the implementation is under 100 lines (NFR-I1)

**Given** the @flui/anthropic package
**When** a developer creates an Anthropic connector with an API key in constructor config
**Then** the connector implements the LLMConnector interface with generate(prompt, options, signal)
**And** the API key is passed through to the Anthropic SDK and never stored, logged, or persisted by flui (NFR-S6)
**And** the implementation is under 100 lines (NFR-I1)

**Given** either connector
**When** an AbortSignal is provided and aborted during a generate() call
**Then** the in-flight LLM request is cancelled
**And** the function returns Result.error with a FluiError indicating cancellation

**Given** either connector
**When** the LLM provider returns an error (timeout, rate limit, network error)
**Then** the connector returns Result.error with a FluiError containing the error details and cause
**And** the error category is "connector"

**Given** either connector
**When** generate() succeeds
**Then** it returns Result.ok(LLMResponse) containing the raw text response
**And** the response is declarative text only — no executable code paths (NFR-S1)

**Given** connector packages
**Then** each package has co-located tests using mocked provider SDKs
**And** tests cover success, cancellation, timeout, rate limit, and network error scenarios
**And** each connector bundle is < 3KB gzipped (NFR-P8)

### Story 4.2: Prompt Construction & Generation Orchestrator

As a developer,
I want the system to construct optimized prompts and orchestrate the full generation flow from intent to UISpecification,
So that I can get a validated UI specification by providing just an intent, context, and registry.

**Acceptance Criteria:**

**Given** the generation/ module in @flui/core
**When** the orchestrator receives an intent, context, and component registry
**Then** the prompt builder constructs a prompt including serialized registry metadata, context signals, and generation rules (FR15)
**And** the prompt is sent to the configured LLM connector

**Given** a successful LLM response
**When** the spec parser processes the response
**Then** it extracts the JSON UISpecification from the LLM output
**And** it validates the parsed object against the UISpecification Zod schema (FR16)
**And** a valid parse returns Result.ok(UISpecification)

**Given** an LLM response that cannot be parsed into a valid UISpecification
**When** the spec parser processes it
**Then** it returns Result.error with a FluiError describing the parse failure (malformed JSON, schema violation)
**And** the error category is "generation"

**Given** a generation request
**When** an AbortSignal is provided
**Then** the signal is propagated to the LLM connector
**And** if aborted, the orchestrator returns Result.error indicating cancellation

**Given** any generation operation
**Then** the orchestrator enriches the GenerationTrace with steps for prompt construction, LLM call, and response parsing
**And** each trace step includes module ("generation"), operation name, durationMs, and metadata
**And** no API keys or raw LLM responses appear in trace metadata (NFR-S6)

**Given** the generation/ module
**Then** generation latency overhead (excluding LLM network time) targets P50 < 500ms, P99 < 2,000ms for batch (non-streaming) generation (NFR-P1)
**And** streaming latency targets are defined in Story 4.3
**And** co-located tests cover successful generation, parse failure, abort, and trace enrichment
**And** all tests pass with >90% coverage

### Story 4.3: Streaming Generation & Progressive Spec Construction

As a developer,
I want the system to stream LLM responses and progressively build the UISpecification,
So that users see faster perceived responsiveness as the UI specification builds incrementally.

**Acceptance Criteria:**

**Given** the generation/ module
**When** a streaming-capable LLM connector is used
**Then** the orchestrator can receive tokens progressively from the connector
**And** the spec parser incrementally constructs the UISpecification as tokens arrive

**Given** a streaming generation in progress
**When** enough tokens have been received to form a partial valid structure
**Then** intermediate progress is reported via an `onProgress(partialSpec: Partial<UISpecification>)` callback provided by the caller
**And** the callback is invoked each time a new component or section is parsed from the stream
**And** the final complete UISpecification is returned as Result.ok when streaming completes

**Given** streaming latency requirements
**Then** time-to-first-progress-callback targets P50 < 100ms (excluding LLM network time)
**And** subsequent progress callbacks arrive at < 50ms intervals as tokens are received

**Given** a streaming generation
**When** the stream is aborted via AbortSignal
**Then** the stream is cancelled cleanly with no orphaned promises or memory leaks
**And** Result.error is returned indicating cancellation

**Given** a streaming generation
**When** the stream produces a malformed response
**Then** the parse failure is detected and Result.error is returned
**And** the GenerationTrace captures the streaming duration and failure point

**Given** streaming generation
**Then** co-located tests cover progressive construction, successful completion, mid-stream abort, and malformed stream handling
**And** all tests pass with >90% coverage

### Story 4.4: Data Resolver

As a developer,
I want to define data resolvers that connect data identifiers in generated specifications to actual data sources,
So that generated components can display real data from my application's data layer.

**Acceptance Criteria:**

**Given** the data/ module in @flui/core
**When** a developer registers a data resolver function for a data identifier pattern
**Then** the resolver is stored and available for invocation during spec rendering

**Given** a UISpecification containing data identifier references
**When** the data resolver is invoked with those identifiers
**Then** it calls the registered resolver functions and returns the resolved data as Result.ok
**And** the resolved data is typed according to the resolver's declared return type

**Given** a data identifier that has no registered resolver
**When** resolution is attempted
**Then** it returns Result.error with a FluiError indicating an unresolvable data identifier

**Given** a data identifier that is not explicitly provided in context
**When** the resolver attempts to resolve it
**Then** the request is rejected with Result.error (NFR-S3, unauthorized data source)
**And** the error details which identifier was unauthorized

**Given** data resolution
**When** an AbortSignal is provided and aborted
**Then** pending resolver calls are cancelled and Result.error is returned

**Given** the data/ module
**Then** co-located tests cover successful resolution, missing resolver, unauthorized identifier rejection, and abort handling
**And** the GenerationTrace is enriched with data resolution steps (module, operation, durationMs)
**And** all tests pass with >90% coverage

## Epic 5: Validation & Safety Pipeline

Every generated specification passes through a mandatory, zero-bypass validation pipeline (schema, component, props, accessibility, data authorization, custom validators). Invalid specs are rejected with structured errors, and the system can retry generation on failure.

### Story 5.1: Validation Pipeline & Core Validators (Schema, Component, Props)

As a developer,
I want every generated specification to pass through a mandatory validation pipeline with schema, component, and prop validators,
So that only structurally valid specifications referencing real, correctly-configured components can reach the renderer.

**Acceptance Criteria:**

**Given** the validation/ module in @flui/core
**When** a UISpecification is submitted to the validation pipeline
**Then** the pipeline executes validators in order: schema → component → props
**And** the pipeline cannot be bypassed — there is no API or configuration to skip validation (FR33)
**And** the validation pipeline is architecturally enforced: the spec renderer (Story 6.1) calls validation as a mandatory precondition before component mounting, and no public API exists to render a UISpecification without passing through validation

**Given** the schema validator
**When** a UISpecification is validated
**Then** it checks the specification conforms to the UISpecification JSON schema (FR25)
**And** a valid spec returns ValidationResult with status "pass"
**And** an invalid spec returns ValidationResult with status "fail" and structured error details including field paths

**Given** the component validator
**When** a UISpecification is validated
**Then** it checks that every component referenced in the spec exists in the registry (FR26)
**And** unregistered component references produce a validation failure listing the unknown components

**Given** the prop validator
**When** a UISpecification is validated
**Then** it checks that props passed to each component conform to that component's declared Zod schema (FR27)
**And** prop mismatches produce validation failures listing the component, expected schema, and actual props

**Given** the validation pipeline
**When** any validator returns a failure
**Then** the pipeline returns Result.error with a FluiError containing all validation failures aggregated
**And** each validator returns ValidationResult (never throws)

**Given** the validation pipeline performance
**Then** total execution of the standard validator set (schema + component + props) completes in < 5ms for a 50-component spec (NFR-P2)

**Given** the validation/ module source files
**Then** validation.ts contains the pipeline orchestrator
**And** individual validator implementations are in separate files within the module
**And** validation.types.ts contains ValidationResult, ValidatorFn, and related types
**And** validation.test.ts contains co-located tests covering valid specs, schema failures, unregistered components, prop mismatches, and pipeline non-bypass guarantee
**And** all tests pass with >90% coverage

### Story 5.2: Accessibility & Data Authorization Validators

As a developer,
I want generated specifications validated for accessibility compliance and data authorization,
So that every UI rendered by flui meets WCAG 2.1 AA standards and only accesses authorized data.

**Acceptance Criteria:**

**Given** the accessibility validator in the validation/ module
**When** a UISpecification is validated
**Then** it checks for WCAG 2.1 AA compliance (NFR-A1)
**And** it verifies ARIA labels, roles, and live regions are present as required by each component type (NFR-A3)
**And** missing or incorrect accessibility attributes produce validation failures with specific remediation guidance

**Given** a UISpecification with all required accessibility attributes
**When** the accessibility validator runs
**Then** it returns ValidationResult with status "pass"

**Given** the data authorization validator
**When** a UISpecification references data identifiers
**Then** it checks that each identifier is explicitly authorized in the context (FR29)
**And** unauthorized data references produce validation failures listing the unauthorized identifiers

**Given** a UISpecification with only authorized data references
**When** the data authorization validator runs
**Then** it returns ValidationResult with status "pass"

**Given** the updated pipeline
**Then** the full chain runs: schema → component → props → a11y → data authorization
**And** each validator returns ValidationResult (never throws)
**And** co-located tests cover accessibility pass/fail scenarios, missing ARIA attributes, unauthorized data identifiers, and authorized data pass-through
**And** all tests pass with >90% coverage

### Story 5.3: Custom Validators & Validation Retry

As a developer,
I want to add custom validators to the pipeline and have the system retry generation when validation fails,
So that I can enforce domain-specific rules (brand, compliance, mobile) and recover from generation errors automatically.

**Acceptance Criteria:**

**Given** the validation/ module
**When** a developer registers a custom validator function implementing the ValidatorFn interface
**Then** the validator is appended to the pipeline after the built-in validators (FR30)
**And** registration returns Result.ok confirming success

**Given** a custom validator in the pipeline
**When** validation runs
**Then** the custom validator executes after all built-in validators (schema → component → props → a11y → data → custom)
**And** the custom validator receives the UISpecification and returns ValidationResult

**Given** the validation pipeline
**When** any validator (built-in or custom) fails
**Then** the pipeline returns Result.error with structured error details aggregated from all failing validators (FR31)
**And** each error includes the validator name, failure reason, and affected spec elements

**Given** a validation failure
**When** retry is enabled
**Then** the system can retry generation with a modified prompt that includes the validation error details (FR32)
**And** the retry prompt instructs the LLM to fix the specific validation failures
**And** the retry count is configurable with a sensible default

**Given** a validation failure with retry exhausted
**Then** the final Result.error is returned with all validation failures from the last attempt
**And** the GenerationTrace captures each retry attempt with its validation results

**Given** custom validators and retry
**Then** co-located tests cover custom validator registration, custom validator execution in pipeline order, retry with modified prompt, retry exhaustion, and multiple custom validators
**And** all tests pass with >90% coverage

## Epic 6: React Rendering & Interaction

Developers can add a LiquidView component to an existing React app with a mandatory fallback UI. The system renders validated specs into React components, wires data flows (InteractionSpec), manages view state across re-generations, applies visual transitions, and handles focus management with ARIA live regions.

### Story 6.1: LiquidView Component & Fallback Rendering

As a developer,
I want to add a single LiquidView component with a mandatory fallback to my React app and have it render validated UI specifications,
So that I can integrate liquid interfaces into my existing application without modifying other components.

**Acceptance Criteria:**

**Given** the @flui/react package
**When** a developer wraps their app with FluiProvider and places a LiquidView component
**Then** LiquidView accepts a mandatory fallback prop (TypeScript compilation error if missing, FR58)
**And** it accepts intent, context configuration, and connector props
**And** no other components in the host application need modification (FR53)

**Given** a LiquidView component
**When** it is mounted with no generation requested
**Then** it is in the "idle" state and renders nothing or the fallback as configured

**Given** a LiquidView component
**When** a generation is triggered
**Then** it progresses through states: idle → generating → validating → rendering
**And** the state never skips steps and no new states are invented

**Given** a LiquidView in "rendering" state
**When** a validated UISpecification is available
**Then** the spec renderer maps each ComponentSpec to the corresponding registered React component
**And** components are rendered with their declared props (FR19)
**And** mount-to-fallback render completes in < 16ms (one frame, NFR-P9)

**Given** any LLM failure scenario (timeout, network error, rate limit, malformed response)
**When** generation or validation fails
**Then** LiquidView enters "error" state and renders the fallback UI (NFR-R1)
**And** the FluiError is accessible via the error state for developer inspection

**Given** FluiProvider
**Then** it does not conflict with existing React context providers in the host application (NFR-I4)
**And** it has zero dependency on specific state management libraries (NFR-I3)

**Given** the @flui/react package
**Then** co-located tests use React Testing Library to verify state transitions, fallback rendering on all failure modes, spec-to-component mapping, and FluiProvider isolation
**And** @flui/react bundle size is < 8KB gzipped (NFR-P7)
**And** all tests pass with >90% coverage

### Story 6.2: Interaction Wiring & View State Management

As a developer,
I want generated components to have working data flows between them and persistent local state across re-generations,
So that users can interact with generated UIs naturally without losing their input when the UI regenerates.

**Acceptance Criteria:**

**Given** a rendered UISpecification with InteractionSpec definitions
**When** the spec renderer processes interaction wiring
**Then** data flows between components are connected as defined (e.g., filter component output feeds chart component input) (FR20)
**And** interactions are reactive — changes in source components propagate to target components

**Given** a LiquidView with user-entered data (e.g., form inputs, selections)
**When** the UI regenerates with a new specification
**Then** view state is preserved for components that exist in both the old and new specs (FR21)
**And** component identity is determined by the `ComponentSpec.id` field: components with matching IDs across old and new specs preserve their state; components with new IDs start with default state

**Given** a regeneration where a component no longer exists in the new spec
**When** view state reconciliation runs
**Then** orphaned state is cleaned up (no memory leaks)
**And** new components start with their default state

**Given** interaction wiring
**When** an InteractionSpec references a component that doesn't exist in the current spec
**Then** the wiring is silently skipped (no crash) and the issue is logged to the GenerationTrace

**Given** interaction wiring and view state
**Then** co-located tests cover data flow propagation, state persistence across regeneration, orphaned state cleanup, and missing component handling
**And** all tests pass with >90% coverage

### Story 6.3: Visual Transitions & Accessibility

As a developer,
I want smooth visual transitions between generated UIs with proper focus management and screen reader announcements,
So that UI changes feel polished and are accessible to all users including those using assistive technology.

**Acceptance Criteria:**

**Given** a LiquidView rendering a new specification replacing a previous one
**When** the transition occurs
**Then** a crossfade animation smoothly transitions from the old UI to the new UI (FR22)
**And** the transition does not cause layout shift or visual flicker

**Given** a spec transition
**When** the new UI renders
**Then** focus is managed so it does not jump to document body (NFR-A2)
**And** focus placement follows this priority: (1) if the previously focused component still exists in the new spec (matched by ComponentSpec.id), return focus to it; (2) otherwise, place focus on the first focusable element in the new spec; (3) if no focusable element exists, place focus on the LiquidView container root element

**Given** a spec transition
**When** the new UI renders
**Then** an ARIA live region announces the transition to assistive technology (NFR-A5)
**And** the announcement is concise and informative (e.g., "Dashboard updated" not "UI specification version 3.2.1 rendered")

**Given** a transition from rendering state to error/fallback state
**When** the fallback renders
**Then** the same crossfade transition applies
**And** focus management and ARIA announcements function identically

**Given** transitions and accessibility
**Then** co-located tests verify crossfade animation triggers, focus placement after transition, ARIA live region content, and fallback transition behavior
**And** all tests pass with >90% coverage

## Epic 7: Caching, Cost Control & Concurrency

Developers can configure 3-level caching (memory, session, persistent), set cost budgets per session/time period, and the system enforces budget limits, degrades gracefully, cancels stale requests (latest-wins), controls generation policy, and activates circuit breaker on repeated failures.

### Story 7.1: Three-Level Cache System

As a developer,
I want generated specifications cached at three levels with configurable TTL and automatic corruption detection,
So that repeated requests are served instantly, reducing latency and LLM costs.

**Acceptance Criteria:**

**Given** the cache/ module in @flui/core
**When** a UISpecification is generated for an intent+context combination
**Then** the spec is cached at L1 (in-memory Map), L2 (sessionStorage), and L3 (IndexedDB, if configured)
**And** the cache key is a deterministic SHA-256 hash of intent + context + registryVersion + specVersion via Web Crypto API

**Given** a cached specification at L1
**When** a cache lookup is performed for the same intent+context
**Then** the cached spec is returned in < 1ms (NFR-P3)

**Given** a cached specification at L2 (L1 miss)
**When** a cache lookup is performed
**Then** the cached spec is returned in < 5ms (NFR-P4)
**And** the spec is promoted to L1 for future lookups

**Given** a cached specification at L3 (L1 and L2 miss)
**When** a cache lookup is performed
**Then** the cached spec is returned in < 20ms (NFR-P5)
**And** the spec is promoted to L1 and L2

**Given** a developer configuring cache
**When** TTL is set per intent category (FR40)
**Then** cached specs expire after the configured TTL
**And** expired specs are evicted on next lookup

**Given** a repeated intent+context combination within TTL
**When** a cache lookup is performed
**Then** the cached spec is served directly without triggering an LLM call (FR41)

**Given** a corrupted cache entry (invalid stored spec)
**When** the cache attempts to serve it
**Then** the corruption is detected via schema validation, the entry is evicted, and the lookup returns a cache miss (NFR-R5)
**And** the application does not crash

**Given** L3 IndexedDB cache
**Then** it is optional and requires idb-keyval as peer dependency
**And** the cache system works correctly with only L1 and L2 if L3 is not configured

**Given** the cache/ module
**Then** co-located tests cover L1/L2/L3 lookups, cache promotion, TTL expiration, corruption detection and eviction, SHA-256 key determinism, and L3-absent configuration
**And** the GenerationTrace is enriched with cache hit/miss steps
**And** all tests pass with >90% coverage

### Story 7.2: Cost Manager & Budget Enforcement

As a developer,
I want to configure cost budgets and have the system enforce them before making LLM calls,
So that I can control spending and prevent unexpected costs in production.

**Acceptance Criteria:**

**Given** the policy/ module in @flui/core
**When** a developer configures a cost budget per session and per time period (e.g., daily) (FR35)
**Then** the budget is stored and enforced for all subsequent generation requests

**Given** a generation request
**When** the cost manager estimates the cost based on prompt size (FR36)
**Then** the estimate is available before the LLM call is made
**And** the estimate is recorded in the GenerationTrace

**Given** a generation request that would exceed the configured budget
**When** the budget check runs synchronously before the LLM call (FR37)
**Then** the LLM call is prevented
**And** the system degrades gracefully to a cached specification if one is available (FR38)
**And** if no cached spec is available, Result.error is returned with a FluiError indicating budget exhaustion

**Given** a generation request within budget
**When** the LLM call completes
**Then** the actual cost is recorded and deducted from the remaining budget
**And** the cost is added to the GenerationTrace

**Given** cost management
**Then** co-located tests cover budget configuration, cost estimation, budget enforcement (blocked call), graceful degradation to cache, budget exhaustion with no cache, and cost recording
**And** all tests pass with >90% coverage

### Story 7.3: Concurrency Controller & Circuit Breaker

As a developer,
I want stale generation requests cancelled automatically and repeated failures to trigger a circuit breaker,
So that the system stays responsive under load and recovers gracefully from persistent LLM issues.

**Acceptance Criteria:**

**Given** the concurrency/ module in @flui/core
**When** a new generation request is made while a previous request is still in-flight
**Then** the previous request is cancelled via AbortSignal (latest-wins semantics) (FR42)
**And** cancelled requests are cleaned up with no orphaned promises or memory leaks (NFR-R4)

**Given** rapid successive generation requests
**When** multiple requests are submitted in quick succession
**Then** only the latest request proceeds to the LLM
**And** all previous requests are cancelled cleanly

**Given** the circuit breaker
**When** 3 consecutive generation failures occur (NFR-R2)
**Then** the circuit breaker activates and locks to fallback mode
**And** subsequent generation requests immediately return the fallback without attempting LLM calls

**Given** an active circuit breaker
**When** a configurable cooldown period elapses
**Then** the circuit breaker transitions to half-open state and allows a single probe request to test recovery
**And** the probe is a real generation request (not synthetic) using the current intent+context, and its cost counts toward the budget
**And** if the probe succeeds (valid UISpecification returned), the circuit breaker deactivates and normal generation resumes
**And** if the probe fails, the circuit breaker returns to active state and resets the cooldown timer

**Given** a complete LLM provider outage
**Then** the application continues functioning with cached and fallback UIs (NFR-R3)
**And** the circuit breaker prevents repeated failed calls

**Given** the concurrency/ module
**Then** co-located tests cover latest-wins cancellation, rapid request sequences, memory leak verification, circuit breaker activation at 3 failures, cooldown probe success/failure, and provider outage scenario
**And** all tests pass with >90% coverage

### Story 7.4: Generation Policy Engine

As a developer,
I want a unified policy engine that decides when to generate, serve from cache, or show fallback,
So that the system makes intelligent decisions balancing freshness, cost, and reliability automatically.

**Acceptance Criteria:**

**Given** the policy/ module in @flui/core
**When** a generation request arrives
**Then** the policy engine evaluates cache state, budget state, and circuit breaker state to decide the action (FR43)
**And** the decision is one of: generate (call LLM), serve-from-cache, or show-fallback

**Given** a cache hit within TTL and budget available
**When** the policy evaluates
**Then** the decision is "serve-from-cache" (fastest, cheapest path)

**Given** a cache miss with budget available and circuit breaker inactive
**When** the policy evaluates
**Then** the decision is "generate" (call LLM)

**Given** a cache miss with budget exhausted
**When** the policy evaluates
**Then** the decision is "show-fallback" (cannot generate, nothing cached)

**Given** a circuit breaker in active state
**When** the policy evaluates regardless of cache or budget
**Then** the decision is "show-fallback" (circuit breaker overrides)

**Given** any policy decision
**Then** the decision reasoning is recorded in the GenerationTrace with the evaluated inputs (cache state, budget remaining, circuit breaker state)
**And** the policy is deterministic for the same input state

**Given** the policy engine
**Then** co-located tests cover all decision matrix combinations (cache hit/miss × budget available/exhausted × circuit breaker active/inactive)
**And** all tests pass with >90% coverage

## Epic 8: Observability & Developer Tooling

Developers can trace every generation decision, transport traces to configurable destinations, access a debug overlay (Spec + Trace tabs), search/filter traces, view cost and cache metrics, and export traces to external systems. Includes the testing package with MockConnector and assertion helpers.

### Story 8.1: Observability Collector & Trace Transports

As a developer,
I want every generation decision traced and transportable to configurable destinations,
So that I can monitor, debug, and audit all LLM-driven UI generation in my application.

**Acceptance Criteria:**

**Given** the observe/ module in @flui/core
**When** a generation pipeline completes (success or failure)
**Then** a structured GenerationTrace is produced containing intent, context, components selected, validation result, latency, and cost (FR44)
**And** the trace aggregates steps enriched by all pipeline modules

**Given** the observability collector
**When** trace transports are configured
**Then** traces are sent to all configured destinations (console, in-memory buffer, custom transports) (FR45)
**And** the console transport outputs human-readable logs in ISO 8601 format
**And** the in-memory buffer transport stores traces for programmatic access

**Given** a custom transport implementing the transport interface
**When** it is registered with the collector
**Then** it receives all traces asynchronously (NFR-I2)
**And** transport failures do not crash the application or block the generation pipeline

**Given** traces containing context with PII-sensitive attributes (role, permissions)
**When** redaction is configured for specific fields
**Then** those fields are redacted before transport (NFR-S5)
**And** redaction configuration is declarative (field paths to redact)

**Given** any trace
**Then** LLM API keys are never present in trace data (NFR-S6)
**And** raw LLM responses are not included in trace metadata

**Given** the observe/ module
**Then** co-located tests cover trace aggregation from multiple modules, console transport output, in-memory buffer storage, custom transport registration, async transport failure handling, PII redaction, and API key absence verification
**And** all tests pass with >90% coverage

### Story 8.2: Cost & Cache Metrics Reporting

As a developer,
I want to view cost and cache performance metrics through the observability system,
So that I can optimize spending and cache configuration based on real usage data.

**Acceptance Criteria:**

**Given** the observability system
**When** cost metrics are requested
**Then** the system reports per-generation cost, cumulative session cost, and daily cost (FR49)
**And** metrics are derived from GenerationTrace cost data

**Given** the observability system
**When** cache metrics are requested
**Then** the system reports cache hit rate, miss rate, and eviction count (FR50)
**And** metrics are broken down by cache level (L1, L2, L3)

**Given** cost and cache metrics
**When** a developer exports traces via the transport interface (FR51)
**Then** metrics are included in the exported trace data
**And** external systems (SIEM, log aggregators) can consume the structured metric data

**Given** a fresh session with no generations
**When** metrics are requested
**Then** zero values are returned (not errors)

**Given** cost and cache metrics
**Then** co-located tests cover metric accumulation across multiple generations, per-level cache metrics, metric export via transport, and fresh session defaults
**And** all tests pass with >90% coverage

### Story 8.3: Debug Overlay (Spec & Trace Tabs)

As a developer,
I want a debug overlay in my React app that shows the current UISpecification and generation traces,
So that I can inspect and troubleshoot LLM generation behavior during development.

**Acceptance Criteria:**

**Given** the @flui/react package debug overlay
**When** a developer enables the debug overlay via the use-fluid-debug hook
**Then** an overlay panel is rendered with two tabs: Spec and Trace

**Given** the Spec tab
**When** a UISpecification is currently rendered
**Then** the full specification is displayed in a readable, structured format (FR46)
**And** the developer can inspect component hierarchy, props, and layout

**Given** the Trace tab
**When** generation traces are available
**Then** the traces are displayed with timeline, module steps, durations, and metadata (FR47)
**And** the developer can search and filter traces by timestamp (date range picker), intent (substring text match with real-time filtering as user types), or context attributes (key-value dropdown filter) (FR48)

**Given** the debug overlay
**Then** it is fully keyboard-navigable (tab between elements, arrow keys within tabs) (NFR-A4)
**And** it is screen-reader accessible with proper ARIA roles and labels (NFR-A4)

**Given** no active generation or traces
**When** the debug overlay is open
**Then** it displays an empty state message (not an error)

**Given** the debug overlay
**Then** co-located tests using React Testing Library verify Spec tab rendering, Trace tab rendering, search/filter functionality, keyboard navigation, and screen reader accessibility attributes
**And** all tests pass with >90% coverage

### Story 8.4: Testing Package (MockConnector & Assertion Helpers)

As a developer,
I want a testing package with a mock LLM connector and assertion helpers,
So that I can write deterministic tests for my liquid interfaces without needing real LLM API keys.

**Acceptance Criteria:**

**Given** the @flui/testing package
**When** a developer creates a MockConnector
**Then** it implements the LLMConnector interface and returns deterministic, preconfigured responses (FR54)
**And** no LLM API key is required

**Given** a MockConnector
**When** configured with specific response sequences via `mockConnector.enqueue(response: LLMResponse)` and `mockConnector.enqueueError(error: FluiError)`
**Then** it returns responses in FIFO order, enabling multi-step test scenarios
**And** enqueued errors simulate failures (timeout, rate limit, network error) for testing error paths
**And** calling generate() when the queue is empty returns a Result.error indicating no more responses configured

**Given** the @flui/testing package
**When** a developer calls the programmatic UISpecification generator
**Then** it creates valid UISpecification objects from a builder API for assertion testing (FR55)
**And** generated specs pass all built-in validators

**Given** the @flui/testing package
**When** a developer uses the LiquidView test helpers
**Then** they can mount a LiquidView with MockConnector and assert on rendered output (FR56)
**And** helpers provide utilities for waiting on state transitions (generating → rendering)
**And** helpers provide access to the rendered UISpecification for assertion

**Given** the @flui/testing package
**Then** co-located tests verify MockConnector deterministic responses, failure simulation, UISpecification builder validity, LiquidView mount helpers, and state transition waiting
**And** all tests pass with >90% coverage

### Story 8.5: Zero-Config Developer Experience & createFlui Factory

As a developer,
I want to install flui and get started with just an LLM API key and a single factory function,
So that the barrier to entry is minimal and I can prototype liquid interfaces quickly.

**Acceptance Criteria:**

**Given** the flui.ts factory in @flui/core
**When** a developer calls createFlui({ connector: new OpenAIConnector({ apiKey }) })
**Then** all modules are wired together automatically: registry, intent parser, context engine, generation orchestrator, validation pipeline, cache, policy, concurrency, and observability
**And** sensible defaults are applied for all optional configuration (FR52)

**Given** createFlui() with minimal configuration
**Then** the default validation pipeline includes all built-in validators (schema, component, props, a11y, data)
**And** the default cache uses L1 and L2 (L3 optional)
**And** the default policy generates on cache miss with no budget limit
**And** the default observability uses console transport

**Given** createFlui() with invalid configuration (e.g., missing connector)
**When** the factory is called
**Then** it throws a descriptive FluiError at startup explaining the misconfiguration (NFR-R6)
**And** the error is thrown immediately, not deferred to first generation

**Given** a fully configured flui instance
**When** a developer passes it to FluiProvider
**Then** LiquidView components within the provider can generate UIs immediately
**And** no additional wiring or configuration is needed

**Given** the createFlui factory
**Then** co-located tests verify default wiring, minimal config success, invalid config startup error, and module interconnection
**And** TSDoc comments document all public APIs (NFR-M3)
**And** all tests pass with >90% coverage
