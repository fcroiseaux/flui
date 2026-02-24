# Story 1.1: Initialize Monorepo with Build Toolchain

Status: done

## Story

As a developer,
I want to clone the flui repository and have a fully working monorepo with build, lint, test, and size-limit tooling,
So that I can start developing modules across all 5 packages with consistent tooling and CI enforcement.

## Acceptance Criteria

1. **Given** a fresh clone of the repository **When** the developer runs `pnpm install` **Then** all 5 packages (@flui/core, @flui/react, @flui/openai, @flui/anthropic, @flui/testing) are installed with workspace linking **And** pnpm-workspace.yaml defines the `packages/*` and `examples/*` globs

2. **Given** the monorepo is installed **When** the developer runs `pnpm build` **Then** tsup produces `dist/index.js`, `dist/index.cjs`, and `dist/index.d.ts` for each package **And** Turborepo orchestrates builds in dependency order (core first, then react/openai/anthropic/testing)

3. **Given** the monorepo is installed **When** the developer runs `pnpm lint` **Then** Biome 2.4.4 checks all packages with zero warnings **And** the shared `biome.json` config at root is used

4. **Given** the monorepo is installed **When** the developer runs `pnpm test` **Then** Vitest 4.0.18 runs test suites across all packages (empty test files pass)

5. **Given** the monorepo is installed **When** the developer runs `pnpm size` **Then** size-limit checks bundle budgets per package (@flui/core < 25KB, @flui/react < 8KB, connectors < 3KB gzipped)

6. **Given** the monorepo root **Then** .nvmrc pins Node 22 LTS **And** tsconfig.base.json enables `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true` **And** ES2022 is the compilation target **And** all package.json files include `sideEffects: false` **And** Changesets is initialized with `.changeset/config.json` **And** `turbo.json` defines the task pipeline (build, test, lint, size)

7. **Given** each package scaffold **Then** it contains `src/index.ts` (empty barrel), `package.json`, `tsconfig.json` (extends base), and `tsup.config.ts`

## Tasks / Subtasks

- [x] Task 1: Initialize root project (AC: #1, #6)
  - [x] Create root `package.json` with workspace config and root dev scripts
  - [x] Create `pnpm-workspace.yaml` with `packages/*` and `examples/*` globs (include examples now per architecture spec, even though examples/ directory is deferred)
  - [x] Create `.nvmrc` with Node 22 LTS version (e.g., `22.14.0`)
  - [x] Create `.gitignore` (node_modules, dist, .turbo, coverage, *.tsbuildinfo)
  - [x] Create `LICENSE` (MIT)

- [x] Task 2: Configure TypeScript (AC: #6)
  - [x] Create `tsconfig.base.json` at root with: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`

- [x] Task 3: Configure Biome (AC: #3)
  - [x] Create `biome.json` at root (see Biome Config Pattern below)
  - [x] Enable zero-`any` rule for public API enforcement
  - [x] Enable assist (import organization, Biome 2.x)
  - [x] Configure enforcement for no `eval()`, no `new Function()`, no `innerHTML` (NFR-S7) via Biome + custom security lint check

- [x] Task 4: Configure Turborepo (AC: #2)
  - [x] Create `turbo.json` defining task pipeline: build, test, lint, size
  - [x] Configure dependency-ordered builds (core first, then dependents)

- [x] Task 5: Configure Vitest (AC: #4)
  - [x] Create `vitest.config.ts` shared base config at root

- [x] Task 6: Configure size-limit (AC: #5)
  - [x] Create `.size-limit.json` with per-package bundle budgets:
    - @flui/core < 25KB gzipped
    - @flui/react < 8KB gzipped
    - @flui/openai < 3KB gzipped
    - @flui/anthropic < 3KB gzipped
    - @flui/testing: no limit (devDependency)

- [x] Task 7: Initialize Changesets (AC: #6)
  - [x] Create `.changeset/config.json` manually
  - [x] Configure for coordinated version bumps across all packages (fixed versioning group)

- [x] Task 8: Scaffold all 5 packages (AC: #7)
  - [x] Create `packages/core/` with: `package.json` (@flui/core), `tsconfig.json` (extends ../../tsconfig.base.json), `tsup.config.ts` (ESM+CJS dual output + dts), `src/index.ts` (empty barrel export)
  - [x] Create `packages/react/` with: `package.json` (@flui/react, peer: @flui/core + react + react-dom), `tsconfig.json`, `tsup.config.ts`, `src/index.ts`
  - [x] Create `packages/openai/` with: `package.json` (@flui/openai, peer: @flui/core + openai), `tsconfig.json`, `tsup.config.ts`, `src/index.ts`
  - [x] Create `packages/anthropic/` with: `package.json` (@flui/anthropic, peer: @flui/core + @anthropic-ai/sdk), `tsconfig.json`, `tsup.config.ts`, `src/index.ts`
  - [x] Create `packages/testing/` with: `package.json` (@flui/testing, peer: @flui/core), `tsconfig.json`, `tsup.config.ts`, `src/index.ts`

- [x] Task 9: Add placeholder test files (AC: #4)
  - [x] Create `packages/*/src/index.test.ts` with a passing placeholder test per package

- [x] Task 10: Install all dependencies and verify (AC: #1-#7)
  - [x] Run `pnpm install` — verify workspace linking works (all 6 workspace projects resolved)
  - [x] Run `pnpm build` — verify tsup output for all packages (5/5 successful, ESM+CJS+DTS)
  - [x] Run `pnpm lint` — verify Biome passes with zero warnings (31 files checked, 0 errors)
  - [x] Run `pnpm test` — verify Vitest runs all test suites (5/5 test files, 5/5 tests passed)
  - [x] Run `pnpm size` — verify bundle budget checks pass (all 4 packages within limits)

## Dev Notes

### Exact Tool Versions (Architecture-Mandated)

All versions are verified current as of 2026-02-24:

| Tool | Version | Install |
|------|---------|---------|
| pnpm | 10.30.2 | Already installed globally or via corepack |
| TypeScript | 5.8.3 | `devDependency` in each package (5.8.0 not published as stable; 5.8.3 is latest stable 5.8.x) |
| tsup | 8.5.1 | `devDependency` in each package |
| Turborepo | 2.8.10 | `devDependency` at root (`turbo`) |
| Vitest | 4.0.18 | `devDependency` at root |
| Biome | 2.4.4 | `devDependency` at root (`@biomejs/biome`) |
| Zod | 4.3.6 | `dependency` of @flui/core only |
| @changesets/cli | 2.29.8 | `devDependency` at root |
| @size-limit/preset-small-lib | 11.2.0 | `devDependency` at root |

### Package Dependency Boundaries (CRITICAL)

```
@flui/core         → zod (only runtime dependency)
@flui/react        → @flui/core (peer), react + react-dom (peer)
@flui/openai       → @flui/core (peer), openai (peer)
@flui/anthropic    → @flui/core (peer), @anthropic-ai/sdk (peer)
@flui/testing      → @flui/core (peer)
```

**Rules:**
- All inter-package dependencies are `peerDependencies`, never `dependencies`
- `@flui/core` has zero awareness of React, OpenAI, or Anthropic
- No circular dependencies — dependency graph is a DAG
- Every `package.json` must include `"sideEffects": false`

### Turborepo Build Order

```
core → react, openai, anthropic, testing (parallel after core)
```

### tsup Configuration Pattern

Each package's `tsup.config.ts`:
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
});
```

### Root package.json Scripts

```json
{
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "biome check .",
    "format": "biome format . --write",
    "size": "size-limit",
    "changeset": "changeset"
  }
}
```

### TypeScript Base Config Pattern

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  }
}
```

### Biome Config Pattern

`biome.json` (Biome 2.x — `organizeImports` replaced by `assist`, `files.ignore` replaced by `files.includes`):
```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.4/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "assist": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": { "noExplicitAny": "error" },
      "security": { "noGlobalEval": "error" },
      "correctness": { "noUnusedImports": "error", "noUnusedVariables": "warn" }
    }
  },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "always", "trailingCommas": "all" } },
  "files": { "includes": ["packages/**/*.ts", "packages/**/*.tsx", "packages/**/*.json", "*.json", "*.ts"] }
}
```

### Additional Security Lint Enforcement

NFR-S7 requirements not fully covered by built-in Biome rules are enforced by root lint command + custom check:

```json
{
  "scripts": {
    "lint": "biome check . && node ./security-check.mjs"
  }
}
```

`security-check.mjs` scans `packages/**` source files and fails lint if `new Function()` or `.innerHTML =` is detected.

### Package tsconfig Pattern

Each `packages/*/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

### Expected Directory Structure After Completion

```
flui/
├── .changeset/
│   └── config.json
├── .gitignore
├── .nvmrc                      # Node 22 LTS
├── .size-limit.json
├── LICENSE                     # MIT
├── biome.json
├── package.json                # Root workspace
├── packages/
│   ├── anthropic/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.test.ts
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── core/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.test.ts
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── openai/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.test.ts
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── react/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.test.ts
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   └── testing/
│       ├── package.json
│       ├── src/
│       │   ├── index.test.ts
│       │   └── index.ts
│       ├── tsconfig.json
│       └── tsup.config.ts
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── turbo.json
└── vitest.config.ts
```

### What Is NOT In Scope

- `.github/workflows/` (CI/CD) — Story 1.5
- `examples/` directory — later stories
- Any source code beyond empty barrel exports and placeholder tests
- README.md content (basic placeholder is fine)
- Module subdirectories inside packages (e.g., `packages/core/src/spec/`) — Story 1.2+

### Project Structure Notes

- Alignment with unified project structure: all paths, modules, and naming follow the architecture document exactly
- Package naming follows `@flui/{name}` convention
- Source files in `src/`, build output in `dist/`
- Test files co-located: `{source-file}.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure] — Complete directory layout
- [Source: _bmad-output/planning-artifacts/architecture.md#Verified Tool Versions] — All tool versions
- [Source: _bmad-output/planning-artifacts/architecture.md#Package Dependency Boundaries] — Inter-package rules
- [Source: _bmad-output/planning-artifacts/architecture.md#Development Commands] — CLI commands
- [Source: _bmad-output/planning-artifacts/architecture.md#Module Boundary Rules] — Dependency DAG
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1] — Acceptance criteria
- [Source: _bmad-output/planning-artifacts/prd.md#Bundle size strategy] — Size budgets
- [Source: _bmad-output/planning-artifacts/prd.md#Language Matrix] — TypeScript config requirements

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- TypeScript 5.8.0 not available on npm (only dev/beta builds); used 5.8.3 (latest stable 5.8.x)
- Architecture doc had typo: `exactOptionalProperties` corrected to `exactOptionalPropertyTypes`
- Biome 2.x schema changes: `organizeImports` → `assist`, `files.ignore` → `files.includes`
- tsup with `type: "module"` outputs `.js` (ESM) + `.cjs` (CJS), not `.mjs`; package.json exports updated accordingly
- esbuild required `pnpm rebuild esbuild` after initial install due to pnpm build script approval
- Review fix: Biome security rules extended with `noDangerouslySetInnerHtml`
- Review fix: Added `security-check.mjs` to enforce `new Function()` and `.innerHTML =` bans during lint

### Completion Notes List

- All 10 tasks completed with all subtasks verified
- All 7 acceptance criteria satisfied
- 5 packages scaffolded with correct peer dependency boundaries
- Full toolchain verified: build, lint, test, size all pass cleanly
- Biome config adapted to v2.4.4 actual schema (differs from v1.x patterns)
- Changesets configured with fixed versioning group for coordinated releases
- Review fixes applied: pinned `.nvmrc` to `22.14.0`, strengthened security lint enforcement, and replaced placeholder tests with import-based assertions

### File List

- package.json (root workspace config)
- pnpm-workspace.yaml
- pnpm-lock.yaml
- .nvmrc
- .gitignore
- LICENSE
- tsconfig.base.json
- biome.json
- security-check.mjs
- turbo.json
- vitest.config.ts
- .size-limit.json
- .changeset/config.json
- packages/core/package.json
- packages/core/tsconfig.json
- packages/core/tsup.config.ts
- packages/core/src/index.ts
- packages/core/src/index.test.ts
- packages/react/package.json
- packages/react/tsconfig.json
- packages/react/tsup.config.ts
- packages/react/src/index.ts
- packages/react/src/index.test.ts
- packages/openai/package.json
- packages/openai/tsconfig.json
- packages/openai/tsup.config.ts
- packages/openai/src/index.ts
- packages/openai/src/index.test.ts
- packages/anthropic/package.json
- packages/anthropic/tsconfig.json
- packages/anthropic/tsup.config.ts
- packages/anthropic/src/index.ts
- packages/anthropic/src/index.test.ts
- packages/testing/package.json
- packages/testing/tsconfig.json
- packages/testing/tsup.config.ts
- packages/testing/src/index.ts
- packages/testing/src/index.test.ts

## Senior Developer Review (AI)

### Reviewer

Fabrice (AI code-review workflow)

### Findings Resolved

- HIGH: Security lint enforcement gap resolved by adding `noDangerouslySetInnerHtml` and custom lint gate for `new Function()` and `.innerHTML =`.
- MEDIUM: `.nvmrc` pinned to explicit Node `22.14.0` for reproducible environments.
- MEDIUM: Placeholder tests replaced with import-based assertions across all 5 packages.
- MEDIUM: Story metadata updated with review fixes and expanded file list.

### Validation Evidence

- `pnpm lint` passes with Biome + security check.
- `pnpm test` passes across all 5 packages.
- `pnpm size` passes all configured bundle limits.

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-24 | Applied code-review fixes: security lint hardening, Node pinning, stronger tests, and story record updates | AI Reviewer |
