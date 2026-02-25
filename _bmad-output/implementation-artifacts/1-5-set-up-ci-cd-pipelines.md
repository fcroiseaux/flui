# Story 1.5: Set Up CI/CD Pipelines

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want GitHub Actions CI/CD pipelines that enforce quality on every PR and automate releases,
So that code quality, bundle sizes, and versioning are enforced automatically.

## Acceptance Criteria

1. **Given** a pull request to main **When** ci.yml runs **Then** it executes on ubuntu-24.04 with Node 22 LTS (primary) and Node 20 LTS (compatibility) **And** it runs pnpm lint, pnpm test, pnpm build, and pnpm size in sequence **And** the PR is blocked if any step fails

2. **Given** a push to main with changesets present **When** release.yml runs **Then** it bumps versions across affected packages using Changesets **And** it publishes to npm with --provenance flag (SLSA, NFR-S8) **And** it creates a GitHub release with changelog

3. **Given** a push to the next branch **When** canary.yml runs **Then** it publishes canary builds to npm for pre-release testing

4. **Given** the CI pipeline **Then** no eval(), new Function(), innerHTML, or dynamic script injection exists in any package (NFR-S7, enforced by Biome rules) **And** Turborepo caching is configured for CI efficiency

## Tasks / Subtasks

- [x] Task 1: Create CI workflow `.github/workflows/ci.yml` (AC: #1, #4)
  - [x] Create `.github/workflows/` directory structure
  - [x] Set trigger: `pull_request` targeting `main` branch
  - [x] Configure `strategy.matrix` with `node-version: [20, 22]`
  - [x] Set `runs-on: ubuntu-24.04`
  - [x] Step 1: `actions/checkout@v4`
  - [x] Step 2: `pnpm/action-setup@v4` (version inferred from `packageManager` field in root `package.json`)
  - [x] Step 3: `actions/setup-node@v4` with `node-version: ${{ matrix.node-version }}` and `cache: 'pnpm'`
  - [x] Step 4: `pnpm install --frozen-lockfile`
  - [x] Step 5: `pnpm lint` (runs Biome check + security-check.mjs — already configured in root package.json)
  - [x] Step 6: `pnpm test` (Vitest via Turborepo)
  - [x] Step 7: `pnpm build` (tsup via Turborepo)
  - [x] Step 8: `pnpm size` (size-limit check against `.size-limit.json` budgets)
  - [x] Enable Turborepo remote caching: set `TURBO_TOKEN` and `TURBO_TEAM` env vars from repository secrets (optional — local file caching works without these)
  - [x] Verify steps run sequentially (lint → test → build → size)

- [x] Task 2: Create release workflow `.github/workflows/release.yml` (AC: #2)
  - [x] Set trigger: `push` to `main` branch
  - [x] Set `runs-on: ubuntu-24.04` with Node 22 LTS only (no matrix needed for release)
  - [x] Add required permissions: `contents: write`, `packages: write`, `id-token: write` (SLSA provenance)
  - [x] Step 1: `actions/checkout@v4` with `fetch-depth: 0` (full history for changesets)
  - [x] Step 2: `pnpm/action-setup@v4`
  - [x] Step 3: `actions/setup-node@v4` with `node-version: 22`, `cache: 'pnpm'`, `registry-url: 'https://registry.npmjs.org'`
  - [x] Step 4: `pnpm install --frozen-lockfile`
  - [x] Step 5: `pnpm build`
  - [x] Step 6: `pnpm test` (verify before publish)
  - [x] Step 7: Use `changesets/action@v1` with `publish` command set to `pnpm changeset publish` (not `changeset publish --provenance` directly — see Dev Notes on provenance)
  - [x] Set `NPM_CONFIG_PROVENANCE: true` environment variable (enables SLSA provenance on publish)
  - [x] Set `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` for npm authentication
  - [x] Set `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` for changelog PR creation
  - [x] The changesets/action creates a "Version Packages" PR when changesets are pending, and publishes when that PR is merged

- [x] Task 3: Create canary workflow `.github/workflows/canary.yml` (AC: #3)
  - [x] Set trigger: `push` to `next` branch
  - [x] Set `runs-on: ubuntu-24.04` with Node 22 LTS only
  - [x] Add required permissions: `contents: read`, `id-token: write`
  - [x] Steps 1-4: Same checkout + pnpm + node + install pattern as release.yml
  - [x] Step 5: `pnpm build`
  - [x] Step 6: `pnpm test`
  - [x] Step 7: Run `pnpm changeset version --snapshot canary` to apply canary version suffixes
  - [x] Step 8: Run `pnpm changeset publish --tag canary` to publish canary builds to npm
  - [x] Set `NPM_CONFIG_PROVENANCE: true` and `NODE_AUTH_TOKEN` env vars

- [x] Task 4: Verify security enforcement in CI context (AC: #4)
  - [x] Confirm Biome rules already enforce `noGlobalEval: "error"` and `noDangerouslySetInnerHtml: "error"` in `biome.json`
  - [x] Confirm `security-check.mjs` scans for `new Function()` and `.innerHTML =` patterns (already runs as part of `pnpm lint`)
  - [x] Verify that `pnpm lint` in ci.yml covers both Biome and security-check.mjs (it does — root package.json `lint` script: `biome check . && node ./security-check.mjs`)
  - [x] No additional configuration needed — existing lint setup already satisfies NFR-S7

- [x] Task 5: Verify all workflows locally and document (AC: #1, #2, #3, #4)
  - [x] Run `pnpm lint && pnpm build && pnpm test && pnpm size` locally to confirm the CI pipeline commands succeed
  - [x] Verify `.github/workflows/` directory contains exactly 3 files: `ci.yml`, `release.yml`, `canary.yml`
  - [x] Verify YAML syntax is valid (no tabs, proper indentation)
  - [x] Verify all action versions are pinned to major versions (`@v4`, `@v1`)

## Dev Notes

### Critical: GitHub Actions Provenance Setup

npm provenance (SLSA, NFR-S8) requires specific GitHub Actions configuration:

1. **Permissions block** must include `id-token: write` — this allows the workflow to request an OIDC token used by npm to generate the provenance statement
2. **Environment variable** `NPM_CONFIG_PROVENANCE: true` is the recommended approach when using changesets/action (rather than passing `--provenance` CLI flag)
3. The `registry-url` must be set in `actions/setup-node` for npm authentication to work
4. Repository must be **public** for provenance to work with npm (flui is an open-source project, so this is satisfied)

### Critical: changesets/action Behavior

The `changesets/action@v1` has two modes:

1. **When changesets exist**: Creates a "Version Packages" PR that bumps versions, updates changelogs, and removes consumed changesets
2. **When no changesets exist** (i.e., the Version Packages PR was just merged): Runs the `publish` command to publish updated packages to npm

This means `release.yml` triggers on every push to main, but only publishes when the Version Packages PR merge lands. The `version` command is handled by the action itself (creates the PR), and the `publish` command is what we configure.

### Critical: pnpm/action-setup Version Detection

`pnpm/action-setup@v4` can automatically detect the pnpm version from the `packageManager` field in root `package.json` (`"packageManager": "pnpm@10.30.2"`). No need to explicitly specify `version` input — the action reads it from the project configuration. This ensures CI always uses the same pnpm version as local development.

### Turborepo Caching in CI

Two levels of caching are available:

1. **Local file caching** (default): Turborepo caches task outputs in `node_modules/.cache/turbo`. This works out of the box but doesn't persist across CI runs.
2. **Remote caching** (optional): Set `TURBO_TOKEN` and `TURBO_TEAM` secrets in the repository to enable Vercel Remote Cache. This persists build artifacts across CI runs for faster builds.

For the initial setup, local caching is sufficient. Remote caching can be enabled later by adding repository secrets — no workflow file changes needed since Turborepo auto-detects the env vars.

### actions/setup-node Cache for pnpm

The `actions/setup-node@v4` `cache: 'pnpm'` option caches the pnpm store directory (`~/.local/share/pnpm/store`), avoiding re-downloads of packages across CI runs. This is different from Turborepo caching (which caches build outputs). Both are complementary.

### Architecture-Mandated CI Pipeline Step Order

The architecture document explicitly specifies the CI pipeline step sequence:

```
1. pnpm install --frozen-lockfile
2. pnpm lint (Biome)
3. pnpm build (tsup via Turborepo)
4. pnpm test (Vitest via Turborepo)
5. pnpm size (size-limit check)
```

**Important:** `lint` runs BEFORE `build` because Biome checks source files (not dist/). `test` runs AFTER `build` because `turbo.json` declares `test` depends on `build` (`"dependsOn": ["build"]`). `size` runs AFTER `build` because it checks `dist/` output files.

### Security Enforcement — Already Complete

NFR-S7 enforcement is already fully configured from Story 1.1:

- `biome.json` → `noGlobalEval: "error"`, `noDangerouslySetInnerHtml: "error"` — catches `eval()` and `dangerouslySetInnerHTML`
- `security-check.mjs` → catches `new Function()` and `.innerHTML =` patterns
- Root `package.json` `lint` script → `biome check . && node ./security-check.mjs`

No additional security scanning configuration is needed for CI. The `pnpm lint` step in ci.yml automatically runs both checks.

### Project Structure Notes

- `.github/workflows/` directory does NOT exist yet — must be created
- All 3 workflow files are new files
- No existing files need modification (the toolchain is already fully configured from Stories 1.1-1.4)
- The `.changeset/config.json` is already configured with `"access": "public"` and fixed versioning group

### Existing Toolchain State (from Stories 1.1-1.4)

Everything the CI needs is already configured locally:

| Component | File | Status |
|-----------|------|--------|
| pnpm 10.30.2 | `package.json` (packageManager) | Ready |
| Turborepo 2.8.10 | `turbo.json` | Ready |
| Biome 2.4.4 | `biome.json` | Ready |
| Vitest 4.0.18 | `vitest.config.ts` | Ready |
| size-limit 11.2.0 | `.size-limit.json` | Ready |
| Changesets 2.29.8 | `.changeset/config.json` | Ready |
| Security check | `security-check.mjs` | Ready |
| Node 22 LTS | `.nvmrc` (22.14.0) | Ready |
| Build (tsup) | Per-package `tsup.config.ts` | Ready |

### GitHub Actions Versions to Use

| Action | Version | Notes |
|--------|---------|-------|
| `actions/checkout` | `@v4` | Standard checkout |
| `pnpm/action-setup` | `@v4` | Auto-detects pnpm version from packageManager field |
| `actions/setup-node` | `@v4` | Supports pnpm cache natively |
| `changesets/action` | `@v1` | Handles version PR creation + publish |

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.5] — Full acceptance criteria and story definition
- [Source: _bmad-output/planning-artifacts/architecture.md#CI/CD & Publishing] — CI platform decision, workflow structure, Node.js version matrix (lines 213-221)
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure] — `.github/workflows/` directory with 3 workflow files (lines 544-546)
- [Source: _bmad-output/planning-artifacts/architecture.md#CI Pipeline] — ci.yml step sequence: install → lint → build → test → size (lines 925-937)
- [Source: _bmad-output/planning-artifacts/architecture.md#Release Pipeline] — release.yml step sequence with changesets + provenance (lines 939-951)
- [Source: _bmad-output/planning-artifacts/architecture.md#Verified Technology Versions] — GitHub Actions runner: ubuntu-24.04 (line 238)
- [Source: _bmad-output/planning-artifacts/architecture.md#npm provenance] — SLSA provenance via --provenance flag, NFR-S8 (lines 190-196)
- [Source: _bmad-output/planning-artifacts/architecture.md#Build Process] — Turborepo orchestration, size-limit checks (lines 919-923)
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Sequence] — GitHub Actions CI pipeline refined each sprint (line 248)
- [Source: package.json] — Root workspace scripts (lint, build, test, size, changeset)
- [Source: turbo.json] — Task pipeline with dependency ordering
- [Source: biome.json] — Security lint rules (noGlobalEval, noDangerouslySetInnerHtml)
- [Source: security-check.mjs] — Custom security scanner for new Function() and innerHTML
- [Source: .size-limit.json] — Per-package bundle budgets
- [Source: .changeset/config.json] — Changesets config with fixed versioning and public access
- [Source: .nvmrc] — Node 22.14.0 pinned

### Previous Story Intelligence (Stories 1.1-1.4)

**Key learnings applied to this story:**

1. **TypeScript 5.8.3** (not 5.8.0) — installed version. The `.nvmrc` pins Node `22.14.0`.
2. **Biome 2.x** schema: `organizeImports` → `assist`, security rules already include `noGlobalEval` and `noDangerouslySetInnerHtml`.
3. **tsup with `type: "module"`** outputs `.js` (ESM) + `.cjs` (CJS) — the `pnpm build` step will produce these.
4. **esbuild rebuild** may be needed after `pnpm install` in CI — watch for this. If `pnpm install --frozen-lockfile` handles it, no extra step needed.
5. **123 tests pass** across all packages as of Story 1.4 — the CI `pnpm test` step should reproduce this.
6. **Bundle size: @flui/core 1.22 KB gzipped** — well under the 25 KB limit. `pnpm size` will pass.
7. **`pnpm lint` = `biome check . && node ./security-check.mjs`** — both tools are already orchestrated in a single script.
8. **`security-check.mjs`** may flag coverage files — it skips `dist/`, `node_modules/`, and `coverage/` directories (already handled in Story 1.1).

### Git Intelligence

**Recent commits:**

```
2110a5c feat: implement shared types and LLMConnector interface (story 1-4)
36ddbc8 feat: implement FluiError class and Result pattern (story 1-3)
7e47658 feat: establish UISpecification types and Zod 4 validation schemas
e19f90d feat: initialize flui monorepo with build toolchain and BMAD planning artifacts
```

**Patterns established:**
- Commit message format: `feat: <description> (story X-Y)`
- All 4 commits built successfully with the same toolchain the CI will use
- No CI workflows exist yet — this is a greenfield story creating `.github/workflows/`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean implementation with no errors or retries.

### Completion Notes List

- Created 3 GitHub Actions workflow files in `.github/workflows/`
- **ci.yml**: PR gating workflow with Node 20+22 matrix on ubuntu-24.04, running lint → build → test → size in architecture-mandated order. Turborepo remote caching env vars included (optional).
- **release.yml**: Push-to-main release workflow using changesets/action@v1 for version PR creation and npm publishing with SLSA provenance (`NPM_CONFIG_PROVENANCE: true`, `id-token: write`). Concurrency guard added to prevent parallel release runs.
- **canary.yml**: Push-to-next canary workflow publishing snapshot versions via `changeset version --snapshot canary` and `changeset publish --tag canary`.
- **Security enforcement (Task 4)**: Verified Biome rules + security-check.mjs cover NFR-S7; security-check now explicitly scans dynamic script injection patterns in addition to `new Function()` and `.innerHTML =`.
- **Local verification (Task 5)**: All 4 pipeline commands pass locally — lint (43 files, 0 issues), test (125 tests, 0 failures), build (5 packages), size (all under budget).
- No existing files were modified; all changes are new file additions.
- Review fix applied: `ci.yml` command order adjusted to `lint -> test -> build -> size` to align with AC #1 wording.
- Review fix applied: `security-check.mjs` now explicitly blocks dynamic script injection patterns (`createElement('script')`, `insertAdjacentHTML`).
- Review note: non-source files (`.docx`) were excluded from review scope per workflow rules.

### File List

- .github/workflows/ci.yml (new)
- .github/workflows/release.yml (new)
- .github/workflows/canary.yml (new)
- security-check.mjs (updated during code review)
- _bmad-output/implementation-artifacts/1-5-set-up-ci-cd-pipelines.md (updated during code review)
- _bmad-output/implementation-artifacts/sprint-status.yaml (updated during code review workflow sync)

## Change Log

- 2026-02-25: Created GitHub Actions CI/CD pipelines — ci.yml (PR gating with Node 20/22 matrix), release.yml (changesets + npm provenance), canary.yml (snapshot pre-releases). Verified all local pipeline commands pass (125 tests, lint clean, size under budget).
- 2026-02-25: Senior code review fixes applied — aligned ci.yml step order with AC #1, expanded security scan for dynamic script injection checks, synchronized sprint status.

## Senior Developer Review (AI)

### Reviewer

- Fabrice (AI-assisted review)

### Date

- 2026-02-25

### Outcome

- Approved after fixes

### Findings and Resolutions

- HIGH: AC #1 step order mismatch (`lint -> test -> build -> size`) - fixed in `.github/workflows/ci.yml`.
- HIGH: Dynamic script injection enforcement was implicit - fixed by adding explicit checks in `security-check.mjs`.
- MEDIUM: Story/git tracking mismatch - resolved by updating file tracking in this story and syncing sprint status.
- MEDIUM: Non-source `.docx` files were present in git status - explicitly excluded from review scope (workflow rule).
