# Story 5.1: Validation Pipeline & Core Validators (Schema, Component, Props)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want every generated specification to pass through a mandatory validation pipeline with schema, component, and prop validators,
So that only structurally valid specifications referencing real, correctly-configured components can reach the renderer.

## Acceptance Criteria

1. **Pipeline orchestrator** (FR33): Given the `validation/` module in `@flui/core`, when a `UISpecification` is submitted to the validation pipeline, then the pipeline executes validators in order: schema -> component -> props, and the pipeline cannot be bypassed -- there is no API or configuration to skip validation. The validation pipeline is architecturally enforced: no public API exists to render a `UISpecification` without passing through validation.

2. **Schema validator** (FR25): Given the schema validator, when a `UISpecification` is validated, then it checks the specification conforms to the `uiSpecificationSchema` Zod schema. A valid spec returns `ValidationResult` with `valid: true`. An invalid spec returns `ValidationResult` with `valid: false` and structured error details including field paths.

3. **Component validator** (FR26): Given the component validator, when a `UISpecification` is validated against a `ComponentRegistry`, then it checks that every `componentType` referenced in the spec (including nested children) exists in the registry. Unregistered component references produce a validation failure listing the unknown components.

4. **Prop validator** (FR27): Given the prop validator, when a `UISpecification` is validated, then it checks that props passed to each component conform to that component's declared Zod schema (`accepts` field from `RegistryEntry`). Prop mismatches produce validation failures listing the component name, expected schema description, and actual props received.

5. **Aggregated error reporting** (FR31): Given the validation pipeline, when any validator returns a failure, then the pipeline returns `Result.error` with a `FluiError` containing all validation failures aggregated from all validators. Each validator returns `ValidationResult` (never throws).

6. **Performance** (NFR-P2): Given the validation pipeline performance, total execution of the standard validator set (schema + component + props) completes in < 5 ms for a 50-component spec.

7. **Test coverage**: Co-located tests covering valid specs, schema failures, unregistered components, prop mismatches, pipeline order guarantee, and pipeline non-bypass guarantee. All tests pass with >90% coverage.

## Tasks / Subtasks

- [x] Task 1: Create validation module types (AC: #1, #2, #5)
  - [x] 1.1 Create `packages/core/src/validation/validation.types.ts` with `ValidationResult`, `ValidationError`, `ValidatorFn`, `ValidatorContext`, `ValidationPipelineConfig` interfaces
  - [x] 1.2 Define `ValidationResult` as discriminated union: `{ valid: true; spec: UISpecification } | { valid: false; errors: ValidationError[] }`
  - [x] 1.3 Define `ValidationError` with fields: `validator: string`, `message: string`, `field?: string`, `context?: Record<string, unknown>`
  - [x] 1.4 Define `ValidatorFn` type: `(spec: UISpecification, context: ValidatorContext) => ValidationResult`
  - [x] 1.5 Define `ValidatorContext` with `registry: ComponentRegistry` and extensible config

- [x] Task 2: Implement schema validator (AC: #2)
  - [x] 2.1 Create `packages/core/src/validation/validators/schema.ts`
  - [x] 2.2 Implement `schemaValidator: ValidatorFn` using `uiSpecificationSchema.safeParse(spec)`
  - [x] 2.3 On failure: extract Zod error paths and messages, map to `ValidationError[]` with `validator: 'schema'` and `field` set to Zod error path strings
  - [x] 2.4 On success: return `{ valid: true, spec }` (spec is the parsed/validated value)

- [x] Task 3: Implement component validator (AC: #3)
  - [x] 3.1 Create `packages/core/src/validation/validators/component.ts`
  - [x] 3.2 Implement `componentValidator: ValidatorFn` that traverses all `ComponentSpec` nodes (including nested `children` recursively)
  - [x] 3.3 For each `componentType`, call `registry.getByName(componentType)` to verify existence
  - [x] 3.4 Collect all unregistered component types and return as `ValidationError[]` with `validator: 'component'`

- [x] Task 4: Implement prop validator (AC: #4)
  - [x] 4.1 Create `packages/core/src/validation/validators/prop.ts`
  - [x] 4.2 Implement `propValidator: ValidatorFn` that traverses all `ComponentSpec` nodes (including nested children)
  - [x] 4.3 For each component, get the `RegistryEntry` via `registry.getByName(componentType)` and run `entry.accepts.safeParse(component.props)`
  - [x] 4.4 On Zod failure: map errors to `ValidationError[]` with `validator: 'prop'`, `field` as component id + Zod path, and context including component name and error details
  - [x] 4.5 Skip prop validation for components not found in registry (component validator already handles missing components)

- [x] Task 5: Implement validation pipeline orchestrator (AC: #1, #5, #6)
  - [x] 5.1 Create `packages/core/src/validation/pipeline.ts`
  - [x] 5.2 Implement `createValidationPipeline(config: ValidationPipelineConfig)` factory function
  - [x] 5.3 Pipeline `validate(spec: UISpecification, context: ValidatorContext): Result<UISpecification, FluiError>` method
  - [x] 5.4 Execute validators in fixed order: schema -> component -> props
  - [x] 5.5 Aggregate all `ValidationError[]` from all validators into a single `FluiError` with code `FLUI_E020`
  - [x] 5.6 If all validators pass, return `Result.ok(spec)`
  - [x] 5.7 If any fail, return `Result.error(new FluiError(FLUI_E020, 'validation', message, { context: { errors: aggregatedErrors } }))`

- [x] Task 6: Add error codes and barrel exports (AC: #1)
  - [x] 6.1 Add `FLUI_E020` ("Validation pipeline failed: one or more validators rejected the specification") to `error-codes.ts`
  - [x] 6.2 Update `DefinedFluiErrorCode` union and `ERROR_CODE_DESCRIPTIONS`
  - [x] 6.3 Export `FLUI_E020` from `errors/index.ts` and `src/index.ts`
  - [x] 6.4 Create `packages/core/src/validation/index.ts` barrel with public exports: `createValidationPipeline`, `ValidationResult`, `ValidationError`, `ValidatorFn`, `ValidatorContext`, `ValidationPipelineConfig`
  - [x] 6.5 Add validation module exports to `packages/core/src/index.ts`
  - [x] 6.6 Update error count test in `errors.test.ts`

- [x] Task 7: Write comprehensive tests (AC: #2, #3, #4, #5, #6, #7)
  - [x] 7.1 Create `packages/core/src/validation/validation.test.ts`
  - [x] 7.2 Test: Valid UISpecification passes all three validators and returns `Result.ok`
  - [x] 7.3 Test: Invalid schema (missing `version`, wrong `layout.type`, extra fields) returns `ValidationResult.valid = false` with field paths
  - [x] 7.4 Test: Unregistered component returns failure listing unknown `componentType` names
  - [x] 7.5 Test: Nested children with unregistered components are caught
  - [x] 7.6 Test: Prop mismatches (wrong type, missing required, extra props with strict schema) return failures with component id and Zod error details
  - [x] 7.7 Test: Pipeline runs validators in order: schema -> component -> props (verify by making schema fail and confirming component/prop validators still run or pipeline short-circuits as designed)
  - [x] 7.8 Test: All validators return `ValidationResult` (never throw) -- wrap validator in test that catches throws
  - [x] 7.9 Test: Pipeline aggregates errors from multiple validators into single `FluiError` with `FLUI_E020`
  - [x] 7.10 Test: Performance benchmark - 50-component spec validates in < 5 ms
  - [x] 7.11 Test: Empty component array is valid (edge case)
  - [x] 7.12 Test: Deeply nested children (3+ levels) are validated for components and props

## Dev Notes

### Architecture Compliance

**Module location:** `packages/core/src/validation/` (per architecture document)

**Required file structure:**
```
packages/core/src/validation/
  ├── index.ts                # Barrel exports (public API only)
  ├── pipeline.ts             # createValidationPipeline() factory
  ├── validation.types.ts     # ValidationResult, ValidatorFn, ValidationError, etc.
  ├── validators/
  │   ├── schema.ts           # Schema validator (Zod-based)
  │   ├── component.ts        # Component registry validator
  │   └── prop.ts             # Props validator (per-component Zod schemas)
  └── validation.test.ts      # Co-located tests
```

**Module dependency rules (from architecture):**
- `validation/` CAN import from: `spec/`, `registry/`, `errors/`
- `validation/` MUST NOT import from: `generation/`, `intent/`, `context/`, `data/`, `cache/`, `policy/`, `concurrency/`, `observe/`
- Import from barrel files only: `import { ... } from '../spec'`, `import { ... } from '../registry'`, `import { ... } from '../errors'`

### Implementation Patterns (MUST follow)

**Factory function pattern** (established in ALL previous stories):
```typescript
export function createValidationPipeline(config?: ValidationPipelineConfig): ValidationPipeline {
  // Internal state via closure — NO class
  const validators: ValidatorFn[] = [schemaValidator, componentValidator, propValidator];
  return {
    validate(spec, context) { ... },
  };
}
```

**Result pattern** (MUST use, never throw from public API):
```typescript
import { ok, err, type Result } from '../errors';
import { FluiError } from '../errors';
import { FLUI_E020 } from '../errors';
```

**Zod safeParse pattern** (established in registry.ts and intent.ts):
```typescript
// Zod 4.3.6 safeParse API:
const parseResult = uiSpecificationSchema.safeParse(spec);
if (!parseResult.success) {
  // parseResult.error is a ZodError
  // Use z.treeifyError(parseResult.error) for structured error output
  // Or iterate parseResult.error.issues for individual path/message pairs
}
// parseResult.data is the validated, typed value
```

**Component tree traversal** (MUST handle recursive children):
```typescript
function collectAllComponents(components: ComponentSpec[]): ComponentSpec[] {
  const all: ComponentSpec[] = [];
  function walk(specs: ComponentSpec[]) {
    for (const spec of specs) {
      all.push(spec);
      if (spec.children) walk(spec.children);
    }
  }
  walk(components);
  return all;
}
```

**Validator function pattern** (synchronous for Story 5.1):
```typescript
// Each validator is a pure function, NOT async (schema/component/prop validation is CPU-only)
// Async validators (a11y, data auth) come in Story 5.2
export const schemaValidator: ValidatorFn = (spec, context) => {
  // ... validate ...
  // NEVER throw — always return ValidationResult
  return { valid: true, spec };
  // or: return { valid: false, errors: [...] };
};
```

### Error Codes to Add

| Code | Category | Description |
|------|----------|-------------|
| `FLUI_E020` | `validation` | Validation pipeline failed: one or more validators rejected the specification |

**Note:** Error codes E001-E019 are already defined. Continue with E020 for validation pipeline. Future stories (5.2, 5.3) will add E021+ for specific validators (a11y, data auth, custom).

### Existing Code to Reuse (DO NOT reinvent)

| What | Where | How to use |
|------|-------|------------|
| `uiSpecificationSchema` | `../spec` barrel | Schema validator uses this directly via `safeParse()` |
| `ComponentRegistry.getByName()` | `../registry` barrel | Component validator looks up each `componentType` |
| `RegistryEntry.accepts` | `../registry` barrel | Prop validator runs `.safeParse(component.props)` on each component's Zod schema |
| `FluiError` class | `../errors` barrel | Pipeline wraps aggregated errors |
| `ok()`, `err()` helpers | `../errors` barrel | Pipeline return values |
| `z.treeifyError()` | `zod` | Structured error output from Zod parse failures (used in registry.ts line 30) |
| `ComponentSpec.children` | `../spec` barrel | Recursive tree traversal for component/prop validators |

### Zod 4 API Notes (version 4.3.6)

- `schema.safeParse(data)` returns `{ success: true; data: T } | { success: false; error: ZodError }`
- `ZodError.issues` array contains `{ path: (string|number)[]; message: string; code: string }`
- `z.treeifyError(zodError)` returns structured tree for human-readable output
- `z.strictObject({...})` rejects extra properties (used in spec.schema.ts for UISpecification)
- No `safeParseAsync` needed — all validation in this story is synchronous

### Performance Considerations

- All three validators are synchronous (no I/O, no async)
- Schema validation via Zod safeParse is fast (~0.1ms per parse for moderate schemas)
- Component lookup via `Map.get()` is O(1) per component
- Prop validation via Zod safeParse per component: ~0.1ms each
- For 50 components: ~0.1ms (schema) + 50 * ~0.01ms (registry lookup) + 50 * ~0.1ms (prop parse) = ~5.6ms max
- If performance is tight, consider: collect all components first, then batch lookups
- Pipeline should NOT short-circuit on first failure — run ALL validators to provide complete error report (architecture requirement)

### Design Decisions

**Pipeline does NOT short-circuit:** All three validators run regardless of earlier failures. This provides a complete error report to the developer (or to the retry mechanism in Story 5.3). Exception: if schema validation fails catastrophically (e.g., input is not an object), component and prop validators may receive malformed data — handle gracefully with try/catch inside each validator, converting exceptions to `ValidationError`.

**Prop validator skips unknown components:** If a component is not in the registry, the prop validator cannot validate its props (no schema available). This is not an error from the prop validator's perspective — the component validator already reports it. The prop validator should silently skip unregistered components.

**ValidationResult vs Result:** The `ValidationResult` discriminated union is internal to the validation module (used between validators and pipeline). The pipeline's public API returns `Result<UISpecification, FluiError>` to maintain consistency with all other modules.

### Project Structure Notes

- This creates the new `validation/` module directory per architecture specification
- No conflicts with existing code — the directory does not exist yet
- The `validation/` module is one of the 14 planned modules for `@flui/core`
- After this story, Stories 5.2 and 5.3 will add more validators and retry logic to this same module
- Story 6.1 (`@flui/react` renderer) will call this pipeline as a mandatory precondition before rendering

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1] - User story, acceptance criteria, BDD scenarios
- [Source: _bmad-output/planning-artifacts/architecture.md#validation/ module] - Module structure, file layout, import rules
- [Source: _bmad-output/planning-artifacts/architecture.md#Module Boundary Rules] - `validation/` imports: `spec/`, `registry/`, `errors/`
- [Source: _bmad-output/planning-artifacts/architecture.md#Process Patterns] - ValidationResult type definition
- [Source: _bmad-output/planning-artifacts/architecture.md#Error Handling] - FluiError, Result pattern, error code ranges
- [Source: _bmad-output/planning-artifacts/prd.md#FR25-FR27] - Schema, component, prop validation requirements
- [Source: _bmad-output/planning-artifacts/prd.md#FR33] - Zero-bypass validation requirement
- [Source: _bmad-output/planning-artifacts/prd.md#FR31] - Structured error details for rejected specs
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-P2] - Validation pipeline < 5ms for standard set
- [Source: packages/core/src/spec/spec.schema.ts] - `uiSpecificationSchema` Zod schema for UISpecification
- [Source: packages/core/src/spec/spec.types.ts] - UISpecification, ComponentSpec interfaces
- [Source: packages/core/src/registry/registry.ts] - ComponentRegistry class with `getByName()` and `accepts` Zod schema
- [Source: packages/core/src/errors/error-codes.ts] - 19 existing error codes (FLUI_E001-E019), add E020
- [Source: packages/core/src/errors/result.ts] - Result<T,E>, ok(), err(), isOk(), isError()
- [Source: packages/core/src/index.ts] - Current barrel exports (add validation module exports here)

### Previous Story Intelligence

**From Story 4-4 (Data Resolver - most recent):**
- Factory function + closure pattern: `createDataResolverRegistry()` — follow this exactly for `createValidationPipeline()`
- Error codes added to `error-codes.ts`: update `DefinedFluiErrorCode` union, `ERROR_CODE_DESCRIPTIONS`, barrel exports, and error count test
- Import from `../errors` barrel, never deep-import from `errors/error-codes.ts` or `errors/result.ts`
- `z.treeifyError()` used in `registry.ts` for structured Zod error output — reuse this pattern
- 320 tests currently passing across 13 test files — maintain zero regressions
- Bundle size: 6.77 KB gzipped (limit 25 KB) — keep validation module lean

**From Story 4-3 (Streaming Generation):**
- Trace step naming: module in lowercase (`'validation'`), operation in camelCase (`'validateSchema'`)
- Note: Trace enrichment for validation is NOT required in Story 5.1 — it will be added in Story 5.3 when retry logic needs tracing. Keep this story focused.

**From Story 4-2 (Generation Orchestrator):**
- `createTrace()` from `types.ts` if trace needed — but NOT needed for this story
- Error cause chaining: `new FluiError(code, category, message, { cause: originalError })`

### Git Intelligence

**Recent commit patterns (last 5):**
- All commits follow `feat: implement <description> (story X-Y)` format
- All stories in Epic 4 completed successfully with zero regressions
- Pattern: types first, then implementation, then tests, then barrel exports, then core index.ts updates

### Testing Standards

- **Framework:** Vitest 4.0.18
- **Mock pattern:** Use `vi.fn()` for mock functions; create test fixtures for `UISpecification` and `ComponentRegistry`
- **Import pattern:** Import from barrel `../errors`, `../spec`, `../registry` — never internal module files
- **Coverage:** >90% statement coverage required
- **Both paths:** Always test `Result.ok` and `Result.error` paths for pipeline
- **Error codes:** Verify exact error code string (`FLUI_E020`)
- **Test structure:** `describe('ValidationPipeline') > describe('validate') > it('behavior')`
- **Test fixture pattern:** Create a `validSpec()` helper function that returns a minimal valid `UISpecification` for reuse across tests. Create a `testRegistry()` helper that returns a `ComponentRegistry` with known components registered.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No blocking issues encountered.

### Completion Notes List

- Implemented complete validation module at `packages/core/src/validation/` with types, 3 core validators, pipeline orchestrator, and barrel exports
- All validators follow factory function + closure pattern (no classes) and never throw (always return ValidationResult)
- Schema validator uses `uiSpecificationSchema.safeParse()` with Zod error path extraction
- Component validator traverses full component tree (recursive children) and checks registry via `getByName()`
- Prop validator runs `entry.accepts.safeParse(component.props)` per component, skipping unregistered components
- Pipeline runs ALL validators (no short-circuit) to provide complete error reports, aggregating into single `FluiError` with `FLUI_E020`
- Component and prop validators include try/catch to handle malformed spec data gracefully
- Added `FLUI_E020` error code to error-codes.ts, errors barrel, and core index.ts
- Updated error count test from 19 to 20
- 17 new validation tests covering all ACs including performance benchmark (<5ms for 50 components)
- All 337 tests pass (14 test files), zero regressions
- Biome lint passes with no issues
- Code review fixes applied: pipeline now propagates parsed spec outputs between validators
- Code review fixes applied: prop validator now includes expected schema and actual props in error context
- Code review fixes applied: validation tests now cover extra-field schema rejection and strict validator execution ordering
- Re-ran core test suite: 340 tests passing (14 files)

### File List

- `packages/core/src/validation/validation.types.ts` (new) - ValidationResult, ValidationError, ValidatorFn, ValidatorContext, ValidationPipelineConfig types
- `packages/core/src/validation/validators/schema.ts` (new) - Schema validator using Zod safeParse
- `packages/core/src/validation/validators/component.ts` (new) - Component registry validator with recursive tree traversal
- `packages/core/src/validation/validators/prop.ts` (new) - Prop validator with per-component Zod schema validation
- `packages/core/src/validation/pipeline.ts` (new) - createValidationPipeline factory, ValidationPipeline interface
- `packages/core/src/validation/index.ts` (new) - Barrel exports for validation module
- `packages/core/src/validation/validation.test.ts` (new) - 17 comprehensive tests
- `packages/core/src/errors/error-codes.ts` (modified) - Added FLUI_E020, updated DefinedFluiErrorCode union and ERROR_CODE_DESCRIPTIONS
- `packages/core/src/errors/index.ts` (modified) - Added FLUI_E020 export
- `packages/core/src/errors/errors.test.ts` (modified) - Updated error count from 19 to 20
- `packages/core/src/index.ts` (modified) - Added validation module exports and FLUI_E020
- `packages/core/src/validation/pipeline.ts` (modified) - Propagate validated spec through pipeline and return latest validated value
- `packages/core/src/validation/validators/prop.ts` (modified) - Add expected schema and actual props to prop validation error context
- `packages/core/src/validation/validation.test.ts` (modified) - Add tests for extra fields, validator order, and non-bypass config guarantee
- `_bmad-output/implementation-artifacts/5-1-validation-pipeline-and-core-validators-schema-component-props.md` (modified) - Review outcomes and status update
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) - Story status sync to done

### Senior Developer Review (AI)

- Reviewer: Fabrice (AI-assisted)
- Date: 2026-02-26
- Outcome: Changes Requested -> Resolved
- Findings fixed:
  - Prop validator now reports expected schema description and actual props in error context
  - Pipeline now preserves validator-produced parsed spec values
  - Added explicit test coverage for schema extra-field rejection
  - Added explicit test coverage for validator execution order (schema -> component -> prop)
  - Added explicit test coverage that validation cannot be bypassed via pipeline configuration
- Verification: `pnpm --filter @flui/core test -- validation.test.ts` (pass)
- AC status: All ACs for Story 5.1 validated as implemented

### Change Log

- 2026-02-26: Implemented validation pipeline and core validators (schema, component, props) for Story 5.1. Added FLUI_E020 error code. 17 new tests, 337 total tests passing.
- 2026-02-26: Completed adversarial code review remediation. Fixed HIGH/MEDIUM findings in validation pipeline and tests; story moved to done.
