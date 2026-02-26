# Story 5.2: Accessibility & Data Authorization Validators

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want generated specifications validated for accessibility compliance and data authorization,
So that every UI rendered by flui meets WCAG 2.1 AA standards and only accesses authorized data.

## Acceptance Criteria

1. **Accessibility validator** (FR28, NFR-A1, NFR-A3): Given the accessibility validator in the `validation/` module, when a `UISpecification` is validated, then it checks for WCAG 2.1 AA compliance: verifies ARIA labels, roles, and live regions are present as required by each component type. Missing or incorrect accessibility attributes produce `ValidationResult` with `valid: false` and `ValidationError[]` including specific remediation guidance. A valid spec returns `{ valid: true, spec }`.

2. **Data authorization validator** (FR29, NFR-S3): Given the data authorization validator, when a `UISpecification` references data identifiers (via `dataSource` props or similar data-referencing patterns), then it checks that each identifier is explicitly authorized in the context. Unauthorized data references produce `ValidationResult` with `valid: false` listing the unauthorized identifiers. Authorized data references return `{ valid: true, spec }`.

3. **Async validator support** (Story 5-1 extension): Given that accessibility and data authorization validators may perform async operations, the validation pipeline MUST support `AsyncValidatorFn` type: `(spec, context) => Promise<ValidationResult>`. The pipeline's `validate()` method MUST become async: `validate(spec, context) => Promise<Result<UISpecification, FluiError>>`. Sync validators continue to work via `Promise.resolve()` wrapping.

4. **Updated pipeline order**: Given the updated pipeline, the full validator chain runs: schema -> component -> props -> a11y -> data authorization. All validators run (no short-circuit). Error aggregation includes errors from both sync and async validators.

5. **Aggregated error reporting** (FR31): Given the pipeline, when any validator (sync or async) returns a failure, the pipeline returns `Result.error` with a `FluiError` (code `FLUI_E020`) containing all validation failures aggregated from all validators.

6. **Test coverage**: Co-located tests covering accessibility pass/fail scenarios (missing ARIA labels, missing roles), unauthorized data identifiers, authorized data pass-through, async pipeline execution, and mixed sync+async error aggregation. All tests pass with >90% coverage.

## Tasks / Subtasks

- [x] Task 1: Extend validation types for async support (AC: #3)
  - [x] 1.1 Add `AsyncValidatorFn` type to `validation.types.ts`: `(spec: UISpecification, context: ValidatorContext) => Promise<ValidationResult>`
  - [x] 1.2 Add `AnyValidatorFn` union type: `ValidatorFn | AsyncValidatorFn`
  - [x] 1.3 Extend `ValidatorContext` with `authorizedDataIdentifiers?: string[]` for data auth validator
  - [x] 1.4 Update `ValidationPipelineConfig.additionalValidators` to accept `AnyValidatorFn[]`
  - [x] 1.5 Export new types from `validation/index.ts` barrel

- [x] Task 2: Make pipeline async (AC: #3, #4, #5)
  - [x] 2.1 Change `ValidationPipeline.validate()` signature to return `Promise<Result<UISpecification, FluiError>>`
  - [x] 2.2 Update pipeline loop to `await Promise.resolve(validator(currentSpec, context))` for each validator (handles both sync and async)
  - [x] 2.3 Add `a11yValidator` and `dataAuthorizationValidator` to the fixed validator list after prop validator
  - [x] 2.4 Maintain non-short-circuit behavior: all validators run regardless of earlier failures
  - [x] 2.5 Ensure existing sync-only tests still pass (update `validate()` calls to `await validate()`)

- [x] Task 3: Implement accessibility validator (AC: #1)
  - [x] 3.1 Create `packages/core/src/validation/validators/a11y.ts`
  - [x] 3.2 Implement `a11yValidator: AsyncValidatorFn` that traverses all `ComponentSpec` nodes
  - [x] 3.3 For each component, look up the registry entry and check its metadata `category` to determine required ARIA attributes
  - [x] 3.4 Check for required ARIA props based on component category: interactive components need `aria-label` or visible label; form components need `aria-label` or `aria-labelledby`; dynamic content needs `aria-live`; navigation needs `role`
  - [x] 3.5 Produce `ValidationError[]` with `validator: 'a11y'`, remediation guidance in `message`, component id in `field`, and specific WCAG criterion in `context`
  - [x] 3.6 Wrap in try/catch to handle malformed specs (return `ValidationError` instead of throwing)

- [x] Task 4: Implement data authorization validator (AC: #2)
  - [x] 4.1 Create `packages/core/src/validation/validators/data-authorization.ts`
  - [x] 4.2 Implement `dataAuthorizationValidator: AsyncValidatorFn` that traverses all `ComponentSpec` nodes
  - [x] 4.3 Extract data identifiers from component props: scan for `dataSource`, `dataRef`, or any prop value matching known data identifier patterns
  - [x] 4.4 Check each extracted identifier against `context.authorizedDataIdentifiers` set
  - [x] 4.5 Unauthorized identifiers produce `ValidationError[]` with `validator: 'data-authorization'`, unauthorized identifier in `field`, and authorized list info in `context`
  - [x] 4.6 If `authorizedDataIdentifiers` is undefined/empty and data identifiers exist, ALL data references fail validation (fail-closed security)
  - [x] 4.7 Wrap in try/catch to handle malformed specs

- [x] Task 5: Add error codes and update exports (AC: #1, #2)
  - [x] 5.1 Add `FLUI_E021` ("Accessibility validation failed: WCAG 2.1 AA compliance issues detected") to `error-codes.ts`
  - [x] 5.2 Add `FLUI_E022` ("Data authorization validation failed: unauthorized data identifiers referenced") to `error-codes.ts`
  - [x] 5.3 Update `DefinedFluiErrorCode` union and `ERROR_CODE_DESCRIPTIONS`
  - [x] 5.4 Export `FLUI_E021`, `FLUI_E022` from `errors/index.ts` and `src/index.ts`
  - [x] 5.5 Update `validation/index.ts` barrel with new validator exports and `AsyncValidatorFn`, `AnyValidatorFn` types
  - [x] 5.6 Update `packages/core/src/index.ts` barrel with new type exports
  - [x] 5.7 Update error count test in `errors.test.ts`

- [x] Task 6: Write comprehensive tests (AC: #1, #2, #3, #4, #5, #6)
  - [x] 6.1 Update existing `validation.test.ts` — change all `validate()` calls to `await validate()` for async pipeline
  - [x] 6.2 Test: Valid spec with proper ARIA attributes passes a11y validator
  - [x] 6.3 Test: Spec missing `aria-label` on interactive component fails a11y with remediation guidance
  - [x] 6.4 Test: Spec missing `role` on navigation component fails a11y
  - [x] 6.5 Test: Spec with all authorized data sources passes data auth validator
  - [x] 6.6 Test: Spec with unauthorized `dataSource` prop fails with identifier listed
  - [x] 6.7 Test: Spec with no data references passes data auth validator (no identifiers to check)
  - [x] 6.8 Test: Empty `authorizedDataIdentifiers` with data references fails (fail-closed)
  - [x] 6.9 Test: Pipeline runs full chain: schema -> component -> props -> a11y -> data auth
  - [x] 6.10 Test: Mixed sync+async validator errors are aggregated into single `FluiError` with `FLUI_E020`
  - [x] 6.11 Test: Malformed spec handled gracefully by a11y and data auth validators (no throws)
  - [x] 6.12 Test: Deeply nested children checked by both a11y and data auth validators

## Dev Notes

### Architecture Compliance

**Module location:** `packages/core/src/validation/` (extending existing module from Story 5-1)

**New file structure (additions):**
```
packages/core/src/validation/
  ├── index.ts                    # Updated barrel exports
  ├── pipeline.ts                 # Updated: async validate(), new validators in chain
  ├── validation.types.ts         # Updated: AsyncValidatorFn, AnyValidatorFn, extended ValidatorContext
  ├── validators/
  │   ├── schema.ts               # Unchanged (Story 5-1)
  │   ├── component.ts            # Unchanged (Story 5-1)
  │   ├── prop.ts                 # Unchanged (Story 5-1)
  │   ├── a11y.ts                 # NEW: Accessibility validator
  │   └── data-authorization.ts   # NEW: Data authorization validator
  └── validation.test.ts          # Updated: async tests + new validator tests
```

**Module dependency rules (from architecture):**
- `validation/` CAN import from: `spec/`, `registry/`, `errors/`
- `validation/` MUST NOT import from: `generation/`, `intent/`, `context/`, `data/`, `cache/`, `policy/`, `concurrency/`, `observe/`
- Import from barrel files only: `import { ... } from '../spec'`, `import { ... } from '../registry'`, `import { ... } from '../errors'`
- The data authorization validator does NOT import from `data/` — it receives authorized identifiers via `ValidatorContext`, not from the data resolver directly

### Implementation Patterns (MUST follow)

**Async validator function pattern:**
```typescript
// Async validators follow same structure as sync but return Promise
export const a11yValidator: AsyncValidatorFn = async (spec, context) => {
  try {
    const allComponents = collectAllComponents(spec.components);
    const errors: ValidationError[] = [];

    for (const component of allComponents) {
      // Check ARIA requirements based on component registry metadata
      // ...
    }

    if (errors.length > 0) return { valid: false, errors };
    return { valid: true, spec };
  } catch {
    return {
      valid: false,
      errors: [{ validator: 'a11y', message: 'Accessibility validation failed due to malformed spec structure' }],
    };
  }
};
```

**Pipeline async update pattern:**
```typescript
// Pipeline must now await each validator (supports both sync and async)
async validate(spec, context) {
  const allErrors: ValidationError[] = [];
  let currentSpec = spec;

  for (const validator of validators) {
    const result = await Promise.resolve(validator(currentSpec, context));
    if (!result.valid) {
      allErrors.push(...result.errors);
      continue;
    }
    currentSpec = result.spec;
  }
  // ... same error aggregation as before
}
```

**Result pattern (MUST use, never throw from public API):**
```typescript
import { ok, err, type Result } from '../errors';
import { FluiError, FLUI_E020 } from '../errors';
```

**Component tree traversal (reuse from existing validators):**
```typescript
// SAME helper already used in component.ts and prop.ts
// Import or duplicate the helper (it's private to each validator file)
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

**Data authorization validation approach:**
```typescript
// Data identifiers appear in component props (convention: dataSource, dataRef, etc.)
// Scan props for string values that could be data identifiers
// The validator uses a configurable list of prop keys to check:
const DATA_IDENTIFIER_PROP_KEYS = ['dataSource', 'dataRef', 'dataId', 'dataBinding'];

export const dataAuthorizationValidator: AsyncValidatorFn = async (spec, context) => {
  const authorizedSet = new Set(context.authorizedDataIdentifiers ?? []);
  const allComponents = collectAllComponents(spec.components);
  const errors: ValidationError[] = [];

  for (const component of allComponents) {
    for (const key of DATA_IDENTIFIER_PROP_KEYS) {
      const value = component.props[key];
      if (typeof value === 'string' && value.length > 0) {
        if (authorizedSet.size === 0 || !authorizedSet.has(value)) {
          errors.push({
            validator: 'data-authorization',
            message: `Unauthorized data identifier '${value}' in component '${component.componentType}' prop '${key}'`,
            field: `${component.id}.${key}`,
            context: { identifier: value, componentType: component.componentType, propKey: key },
          });
        }
      }
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, spec };
};
```

### Accessibility Validation Rules

**WCAG 2.1 AA rules to enforce (based on component category from registry metadata):**

| Component Category | Required ARIA | WCAG Criterion |
|--------------------|--------------|----------------|
| Interactive (buttons, links) | `aria-label` OR text content in props | 4.1.2 Name, Role, Value |
| Form inputs | `aria-label` OR `aria-labelledby` | 1.3.1 Info and Relationships |
| Images | `alt` prop (not empty) | 1.1.1 Non-text Content |
| Dynamic/live content | `aria-live` (polite or assertive) | 4.1.3 Status Messages |
| Navigation | `role` prop (e.g., `navigation`, `menu`) | 1.3.1 Info and Relationships |
| Tables/data grids | `aria-label` and column headers | 1.3.1 Info and Relationships |

**Category detection strategy:** Use `context.registry.getByName(componentType)` to get the registry entry, then check `entry.metadata.category` to determine which ARIA rules apply. If a component is not in the registry, skip a11y validation (component validator already handles unknown components).

### Error Codes to Add

| Code | Category | Description |
|------|----------|-------------|
| `FLUI_E021` | `validation` | Accessibility validation failed: WCAG 2.1 AA compliance issues detected |
| `FLUI_E022` | `validation` | Data authorization validation failed: unauthorized data identifiers referenced |

**Note:** These error codes are informational for individual validators. The pipeline still wraps all errors in `FLUI_E020`. The individual error codes (`E021`, `E022`) can be used in `ValidationError.context` for programmatic error handling by consumers.

### Existing Code to Reuse (DO NOT reinvent)

| What | Where | How to use |
|------|-------|------------|
| `ValidationResult` type | `./validation.types` | Both new validators return this type |
| `ValidationError` type | `./validation.types` | Both new validators produce these |
| `ValidatorContext` type | `./validation.types` | Extended with `authorizedDataIdentifiers` |
| `collectAllComponents()` | `./validators/component.ts` (private) | Duplicate the helper in each new validator file (same pattern as component.ts and prop.ts) |
| `ComponentRegistry.getByName()` | `../registry` barrel | a11y validator looks up component metadata |
| `RegistryEntry.metadata.category` | `../registry` barrel | a11y validator uses category to determine ARIA requirements |
| `FluiError` class | `../errors` barrel | Pipeline wraps aggregated errors |
| `ok()`, `err()` helpers | `../errors` barrel | Pipeline return values |
| `schemaValidator`, `componentValidator`, `propValidator` | `./validators/` | Existing validators in chain (unchanged) |
| `uiSpecificationSchema` | `../spec` barrel | Already used by schema validator |
| Test helpers `validSpec()`, `testRegistry()` | `./validation.test.ts` | Extend for a11y and data auth test fixtures |

### Design Decisions

**Pipeline becomes fully async:** Even though the existing 3 validators (schema, component, prop) are synchronous, the pipeline `validate()` method becomes async to support a11y and data auth validators. Using `await Promise.resolve(validator(...))` handles both sync and async validators uniformly. This is a backward-compatible change at the call site (callers now `await` the result).

**Fail-closed data authorization:** If `context.authorizedDataIdentifiers` is undefined or empty and the spec contains data identifier references, all data references fail validation. This prevents accidental data exposure when authorization context is not configured.

**A11y validation is heuristic-based:** Since `ComponentSpec.props` is `Record<string, unknown>`, the a11y validator checks for known ARIA prop names (`aria-label`, `aria-labelledby`, `aria-live`, `role`, `alt`). The validator uses component registry metadata `category` to determine which ARIA attributes are required for each component type.

**Data identifier detection is convention-based:** Data identifiers are detected by scanning specific prop keys (`dataSource`, `dataRef`, `dataId`, `dataBinding`). This is a convention established in the spec tests (see `spec.test.ts` line 24: `props: { dataSource: 'sales' }`). The list of prop keys can be extended via `context.config.dataIdentifierPropKeys` if needed.

**Individual error codes (E021, E022) vs pipeline code (E020):** Each validator may reference its specific error code in `ValidationError.context.errorCode` for programmatic handling, but the pipeline always wraps all errors in `FLUI_E020`. This maintains the existing pattern where the pipeline is the single error aggregation point.

### Project Structure Notes

- Extends the existing `validation/` module created in Story 5-1
- No conflicts with existing code — adding 2 new validator files
- The `validation/` module dependency rules are unchanged: imports from `spec/`, `registry/`, `errors/` only
- The data authorization validator does NOT import from `data/` module — it receives authorized identifiers via `ValidatorContext`
- After this story, Story 5.3 will add custom validators and retry logic to this same module
- Story 6.1 (`@flui/react` renderer) will call this pipeline as a mandatory precondition — the async signature change means Story 6.1 must `await` the pipeline result

### Previous Story Intelligence

**From Story 5-1 (Validation Pipeline - direct predecessor):**
- Factory function + closure pattern: `createValidationPipeline()` — extend, don't rewrite
- Error codes: `FLUI_E020` added for pipeline. Continue with `FLUI_E021`, `FLUI_E022`
- Pipeline runs ALL validators (no short-circuit) — maintain this for async validators
- Component and prop validators include try/catch for malformed specs — follow this pattern for a11y and data auth
- `collectAllComponents()` helper duplicated in component.ts and prop.ts — follow same pattern (private helper per file)
- `ValidationResult` discriminated union established: `{ valid: true; spec } | { valid: false; errors }`
- `ValidatorContext` has `registry` and extensible `config` — extend with `authorizedDataIdentifiers`
- 340 tests currently passing across 14 test files — maintain zero regressions
- Pipeline propagates parsed spec outputs between validators (code review fix from 5-1) — maintain for async validators

**From Story 4-4 (Data Resolver - authorization patterns):**
- Authorization uses `Set<string>` for O(1) lookup of authorized identifiers — follow this pattern
- `FLUI_E018` for unauthorized data identifier in resolver — data auth validator uses `FLUI_E022` for spec-level authorization
- Fail-fast: authorization checked BEFORE resolver invocation — validator is the spec-level equivalent
- Resolver `authorizedIdentifiers` parameter established — validator receives same concept via `ValidatorContext`

### Git Intelligence

**Recent commit patterns:**
- All commits follow `feat: implement <description> (story X-Y)` format
- Story 5-1 was the most recent commit: `b3892e0 feat: implement validation pipeline and core validators for schema, component, and props (story 5-1)`
- Pattern: types first, then implementation, then tests, then barrel exports, then core index.ts updates
- All previous stories completed with zero regressions

### Testing Standards

- **Framework:** Vitest 4.0.18
- **Import pattern:** Import from barrel `../errors`, `../spec`, `../registry` — never internal module files
- **Coverage:** >90% statement coverage required
- **Test structure:** `describe('ValidationPipeline') > describe('validate') > it('behavior')` — extend existing describe blocks
- **Async tests:** Use `async/await` in test functions; Vitest natively supports async tests
- **Test fixture pattern:** Extend existing `validSpec()` and `testRegistry()` helpers with ARIA props and data source props
- **Both paths:** Test `Result.ok` and `Result.error` paths for both new validators
- **Error codes:** Verify exact error code strings (`FLUI_E021`, `FLUI_E022`) in `ValidationError.context`

### Performance Considerations

- Story 5-1 sync validators: ~5ms for 50-component spec
- a11y validator: O(n) per component for ARIA prop checks — adds ~0.05ms per component = ~2.5ms for 50 components
- Data auth validator: O(n * k) where n = components, k = data prop keys to scan — adds ~0.01ms per component = ~0.5ms for 50 components
- Total estimated: ~8ms for 50-component spec with all 5 validators
- If > 5ms is unacceptable, consider: parallel execution of a11y and data auth (they are independent)
- Note: Architecture says "< 5ms for standard validator set" — with async validators this budget may need revisiting. Document actual performance in completion notes.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2] - User story, acceptance criteria, BDD scenarios
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5] - Epic objectives, cross-story dependencies
- [Source: _bmad-output/planning-artifacts/architecture.md#validation/ module] - Module structure, file layout, import rules
- [Source: _bmad-output/planning-artifacts/architecture.md#Module Boundary Rules] - `validation/` imports: `spec/`, `registry/`, `errors/`
- [Source: _bmad-output/planning-artifacts/architecture.md#Process Patterns] - ValidationResult, AsyncValidatorFn types
- [Source: _bmad-output/planning-artifacts/architecture.md#Error Handling] - FluiError, Result pattern, error code ranges
- [Source: _bmad-output/planning-artifacts/prd.md#FR28] - WCAG AA accessibility validation requirement
- [Source: _bmad-output/planning-artifacts/prd.md#FR29] - Data authorization validation requirement
- [Source: _bmad-output/planning-artifacts/prd.md#FR31] - Structured error details for rejected specs
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-A1] - WCAG 2.1 AA compliance before rendering
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-A3] - ARIA labels, roles, live regions per component type
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-S3] - DataResolver rejects unauthorized identifiers
- [Source: packages/core/src/validation/validation.types.ts] - Current ValidatorFn, ValidationResult types
- [Source: packages/core/src/validation/pipeline.ts] - Current sync pipeline implementation
- [Source: packages/core/src/validation/validators/component.ts] - collectAllComponents() helper, try/catch pattern
- [Source: packages/core/src/validation/validators/prop.ts] - Registry lookup + Zod safeParse per component pattern
- [Source: packages/core/src/data/data.types.ts] - DataResolverRegistry.resolve() authorizedIdentifiers parameter
- [Source: packages/core/src/data/resolver.ts] - Authorization enforcement pattern with Set<string>
- [Source: packages/core/src/spec/spec.types.ts] - ComponentSpec.props: Record<string, unknown>
- [Source: packages/core/src/spec/spec.test.ts#line 24] - dataSource convention in component props
- [Source: packages/core/src/errors/error-codes.ts] - 20 existing error codes (FLUI_E001-E020), add E021-E022
- [Source: packages/core/src/index.ts] - Current barrel exports (update for new types and error codes)
- [Source: _bmad-output/implementation-artifacts/5-1-validation-pipeline-and-core-validators-schema-component-props.md] - Previous story intelligence

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No blocking issues encountered during implementation.

### Completion Notes List

- Implemented `AsyncValidatorFn` and `AnyValidatorFn` types in `validation.types.ts`, extended `ValidatorContext` with `authorizedDataIdentifiers`
- Made `ValidationPipeline.validate()` fully async using `await Promise.resolve()` to uniformly handle both sync and async validators
- Pipeline order: schema -> component -> props -> a11y -> data-authorization (no short-circuit)
- Accessibility validator (`a11y.ts`) checks WCAG 2.1 AA compliance based on component registry `category`: interactive (aria-label/visible text), input/form (aria-label/aria-labelledby), image (alt), display (aria-live), navigation (role), data (aria-label)
- Data authorization validator (`data-authorization.ts`) scans `dataSource`, `dataRef`, `dataId`, `dataBinding` prop keys; fail-closed when `authorizedDataIdentifiers` is undefined/empty
- Added error codes `FLUI_E021` (a11y) and `FLUI_E022` (data auth) — used in `ValidationError.context.errorCode`, pipeline still wraps in `FLUI_E020`
- Updated test registry to use `.passthrough()` on Zod schemas to allow ARIA props alongside declared props
- Test categories added for a11y testing: interactive, input, image, display, navigation, data (beyond original input/layout)
- Post-review fixes: a11y now rejects empty/whitespace ARIA values, enforces data-table column headers, and data authorization now includes authorized identifier context and convention-based data key detection
- Added chain-order assertions proving `a11y` runs before `data-authorization`
- Performance: 50-component spec validates in ~1ms with all 5 validators (well within 50ms async budget)
- All 372 tests pass across 14 test files (up from 340), zero regressions

### Change Log

- 2026-02-26: Implemented accessibility and data authorization validators with async pipeline support (Story 5-2)
- 2026-02-26: Code review follow-up fixes applied for a11y/data-auth validation gaps and order assertions

### File List

- packages/core/src/validation/validation.types.ts (modified) — Added AsyncValidatorFn, AnyValidatorFn types; extended ValidatorContext with authorizedDataIdentifiers; updated ValidationPipelineConfig
- packages/core/src/validation/pipeline.ts (modified) — Made validate() async, added a11y and data auth to chain, uses AnyValidatorFn[]
- packages/core/src/validation/validators/a11y.ts (new) — Accessibility validator with WCAG 2.1 AA checks per component category
- packages/core/src/validation/validators/data-authorization.ts (new) — Data authorization validator with fail-closed identifier checking
- packages/core/src/validation/index.ts (modified) — Updated barrel exports with new types and validators
- packages/core/src/validation/validation.test.ts (modified) — Updated all tests to async, added 27 new tests for a11y, data auth, and async pipeline
- packages/core/src/errors/error-codes.ts (modified) — Added FLUI_E021, FLUI_E022 with descriptions
- packages/core/src/errors/index.ts (modified) — Added FLUI_E021, FLUI_E022 exports
- packages/core/src/errors/errors.test.ts (modified) — Updated error count tests from 20 to 22
- packages/core/src/index.ts (modified) — Added new type exports (AsyncValidatorFn, AnyValidatorFn) and value exports (FLUI_E021, FLUI_E022, a11yValidator, dataAuthorizationValidator)

### Senior Developer Review (AI)

- Reviewer: Fabrice
- Date: 2026-02-26
- Outcome: Approved after fixes
- Findings addressed:
  - Enforced non-empty ARIA values (`aria-label`, `aria-labelledby`, `role`) and whitespace-safe label checks
  - Added WCAG data-component requirement for column headers in addition to `aria-label`
  - Added authorized identifiers to `data-authorization` error context
  - Extended data identifier detection beyond fixed keys to convention-based keys
  - Added test assertion for `a11y -> data-authorization` order in pipeline
