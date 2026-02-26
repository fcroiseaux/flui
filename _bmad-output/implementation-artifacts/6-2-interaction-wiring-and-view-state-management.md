# Story 6.2: Interaction Wiring & View State Management

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want generated components to have working data flows between them and persistent local state across re-generations,
So that users can interact with generated UIs naturally without losing their input when the UI regenerates.

## Acceptance Criteria

1. **InteractionSpec data flow wiring** (FR20): Given a rendered `UISpecification` with `InteractionSpec` definitions, when the spec renderer processes interaction wiring, then data flows between components are connected as defined (e.g., filter component output feeds chart component input), and interactions are reactive — changes in source components propagate to target components immediately.

2. **View state preservation across regeneration** (FR21): Given a `LiquidView` with user-entered data (e.g., form inputs, selections), when the UI regenerates with a new specification, then view state is preserved for components that exist in both the old and new specs. Component identity is determined by `ComponentSpec.id`: components with matching IDs across old and new specs preserve their state; components with new IDs start with default state.

3. **Orphaned state cleanup**: Given a regeneration where a component no longer exists in the new spec, when view state reconciliation runs, then orphaned state is cleaned up (no memory leaks) and new components start with their default state.

4. **Missing component handling in interaction wiring**: Given interaction wiring, when an `InteractionSpec` references a component that doesn't exist in the current spec, then the wiring is silently skipped (no crash) and the issue is logged to the `GenerationTrace`.

5. **Test coverage**: Co-located tests cover data flow propagation, state persistence across regeneration, orphaned state cleanup, and missing component handling. All tests pass with >90% coverage.

## Tasks / Subtasks

- [x] Task 1: Define view state and interaction wiring types (AC: #1, #2, #3, #4)
  - [x] 1.1 Add `ViewStateStore` interface to `react.types.ts`: `getState(componentId)`, `setState(componentId, update)`, `reconcile(newComponentIds)`, `getSnapshot(): Map`
  - [x] 1.2 Add `InteractionStore` interface to `react.types.ts`: `getTargetProps(componentId)`, `getSourceHandlers(componentId)`, `issues: InteractionIssue[]`
  - [x] 1.3 Add `InteractionIssue` type: `{ type: 'missing-source' | 'missing-target'; interactionIndex: number; componentId: string }`
  - [x] 1.4 Add `RenderSpecOptions` interface: `{ interactionStore?, viewStateStore?, onInteractionIssue? }`
  - [x] 1.5 Export all new types from `react.types.ts`

- [x] Task 2: Implement `view-state.ts` — ViewStateStore with reconciliation (AC: #2, #3)
  - [x] 2.1 Create `packages/react/src/renderer/view-state.ts`
  - [x] 2.2 Implement `createViewStateStore()` factory function returning `ViewStateStore`
  - [x] 2.3 Internal state: `Map<string, Record<string, unknown>>` keyed by `ComponentSpec.id`
  - [x] 2.4 `getState(componentId)`: return stored state or empty object `{}`
  - [x] 2.5 `setState(componentId, update)`: shallow-merge update into existing state for that component, trigger re-render notification
  - [x] 2.6 `reconcile(newComponentIds: Set<string>)`: iterate stored keys, delete any not in `newComponentIds`, return count of cleaned entries
  - [x] 2.7 `getSnapshot()`: return read-only copy of the state map for testing/debugging
  - [x] 2.8 Implement `useViewState()` hook that wraps `createViewStateStore` with React state for reactivity — use `useRef` for the store + `useState` counter for triggering re-renders on state changes

- [x] Task 3: Implement `interaction-wiring.ts` — InteractionStore with reactive data flow (AC: #1, #4)
  - [x] 3.1 Create `packages/react/src/renderer/interaction-wiring.ts`
  - [x] 3.2 Implement `createInteractionStore(interactions, componentIds, onIssue?)` factory function
  - [x] 3.3 Parse `UISpecification.interactions` array and validate source/target existence in `componentIds`
  - [x] 3.4 For missing source or target: record issue in `issues[]` array and skip that interaction (no crash)
  - [x] 3.5 Build internal maps: `sourceToInteractions: Map<sourceId, InteractionSpec[]>` and `targetState: Map<targetId, Record<string, unknown>>`
  - [x] 3.6 `getSourceHandlers(componentId)`: return event handler map `{ [event]: handler }` for all interactions where this component is the source. Handler captures event data, applies `dataMapping`, and updates `targetState`
  - [x] 3.7 `getTargetProps(componentId)`: return current interaction-derived props for this component from `targetState`
  - [x] 3.8 Implement `useInteractionStore(interactions, componentIds)` hook that wraps the factory with React state for reactivity — use `useRef` for store + `useState` counter for triggering re-renders when interaction data propagates
  - [x] 3.9 Event data extraction: if handler argument is a SyntheticEvent-like object with `target.value`, extract that; if it's a primitive or object, use it directly as the data source for `dataMapping`

- [x] Task 4: Integrate interaction wiring and view state into `spec-renderer.tsx` (AC: #1, #2)
  - [x] 4.1 Add optional `RenderSpecOptions` third parameter to `renderSpec(spec, registry, options?)`
  - [x] 4.2 Pass `options` through to `renderComponentSpec`
  - [x] 4.3 In `renderComponentSpec`, build merged props in this order:
    1. Base: `spec.props` (from LLM generation)
    2. Override: interaction target props via `interactionStore.getTargetProps(spec.id)` (data flow results)
    3. Override: view state via `viewStateStore.getState(spec.id)` (preserved user input)
    4. Compose: interaction source handlers via `interactionStore.getSourceHandlers(spec.id)` — chain with existing handlers
  - [x] 4.4 Handler composition: for each event handler from interaction wiring, if a handler with the same name already exists in props, compose them — call original first, then interaction handler
  - [x] 4.5 Backward-compatible: when `options` is undefined, behavior is identical to current implementation

- [x] Task 5: Integrate into `useLiquidView.ts` — view state lifecycle and trace logging (AC: #2, #3, #4)
  - [x] 5.1 Add `useViewState()` hook call inside `useLiquidView` to create and manage the ViewStateStore
  - [x] 5.2 When state transitions from any state to `rendering` with a new spec: call `viewStateStore.reconcile(newComponentIds)` where `newComponentIds` is extracted from `spec.components` (recursively collecting all component IDs including children)
  - [x] 5.3 Keep a reference to the current `GenerationTrace` so it can be passed to the interaction store for logging issues
  - [x] 5.4 Expose `viewStateStore` in `UseLiquidViewResult` so `LiquidView` can pass it to the renderer
  - [x] 5.5 Update `UseLiquidViewResult` type to include `viewStateStore: ViewStateStore`

- [x] Task 6: Update `LiquidView.tsx` — pass stores to renderer (AC: #1, #2)
  - [x] 6.1 Create `useInteractionStore` inside LiquidView (or useLiquidView) when in `rendering` state with `spec.interactions` and component IDs
  - [x] 6.2 Log interaction issues to the GenerationTrace via `trace.addStep({ module: 'interaction-wiring', operation: 'wireInteractions', ... })`
  - [x] 6.3 Pass `RenderSpecOptions` to `renderSpec()` call with interactionStore and viewStateStore
  - [x] 6.4 Ensure interaction store is recreated when spec changes (new interactions from new generation)

- [x] Task 7: Update barrel exports (AC: all)
  - [x] 7.1 Update `packages/react/src/renderer/index.ts` to export `createViewStateStore`, `createInteractionStore`, `useViewState`, `useInteractionStore`
  - [x] 7.2 Update `packages/react/src/index.ts` to export new public types: `ViewStateStore`, `InteractionStore`, `InteractionIssue`, `RenderSpecOptions`
  - [x] 7.3 Verify TypeScript compilation succeeds with all new exports

- [x] Task 8: Write comprehensive tests (AC: #1, #2, #3, #4, #5)
  - [x] 8.1 Create `packages/react/src/renderer/view-state.test.ts`:
    - Test `getState` returns empty object for unknown component
    - Test `setState` stores and retrieves state
    - Test `setState` shallow-merges (preserves unmodified fields)
    - Test `reconcile` preserves state for matching component IDs
    - Test `reconcile` removes orphaned state (component no longer in spec)
    - Test `reconcile` allows new components to start with default state
    - Test no memory leaks: after reconcile, orphaned entries are gone from snapshot
  - [x] 8.2 Create `packages/react/src/renderer/interaction-wiring.test.ts`:
    - Test basic source→target data flow: source fires event, target gets updated props
    - Test `dataMapping`: source field maps to correct target prop name
    - Test reactive propagation: source change immediately available in target props
    - Test missing source component: issue recorded, no crash
    - Test missing target component: issue recorded, no crash
    - Test multiple interactions from same source
    - Test multiple interactions to same target (props merge)
    - Test event data extraction from SyntheticEvent-like objects
    - Test event data extraction from direct values
  - [x] 8.3 Update `packages/react/src/renderer/spec-renderer.test.tsx`:
    - Test `renderSpec` with interaction store: target components receive interaction-derived props
    - Test `renderSpec` with view state store: components receive persisted state
    - Test handler composition: original handler + interaction handler both fire
    - Test backward compatibility: `renderSpec(spec, registry)` without options works as before
  - [x] 8.4 Update `packages/react/src/hooks/use-liquid-view.test.ts`:
    - Test `viewStateStore` is available in result
    - Test `reconcile` is called when spec changes (new rendering state)
    - Test orphaned state is cleaned on regeneration
  - [x] 8.5 Update `packages/react/src/LiquidView.test.tsx`:
    - Test interaction wiring end-to-end: source component interaction propagates to target component
    - Test view state persistence end-to-end: user input survives regeneration
    - Test missing interaction component: no crash, fallback to normal rendering
  - [x] 8.6 All tests pass with >90% statement coverage

## Dev Notes

### Architecture Compliance

**Package:** `@flui/react` — extending the React adapter implemented in Story 6.1

**New files (architecture-specified):**
```
packages/react/src/renderer/
  ├── view-state.ts              # ViewState management (ADR-001)
  ├── interaction-wiring.ts      # InteractionSpec wiring (ADR-008)
  ├── view-state.test.ts         # ViewState tests
  └── interaction-wiring.test.ts # Interaction wiring tests
```

**Modified files:**
```
packages/react/src/
  ├── react.types.ts             # Add ViewStateStore, InteractionStore, RenderSpecOptions types
  ├── renderer/spec-renderer.tsx # Integrate interaction + view state into rendering
  ├── renderer/index.ts          # Export new modules
  ├── hooks/use-liquid-view.ts   # Manage view state lifecycle
  ├── LiquidView.tsx             # Wire interaction store, pass options to renderer
  ├── index.ts                   # Export new public types
  ├── renderer/spec-renderer.test.tsx  # Extended tests
  ├── hooks/use-liquid-view.test.ts    # Extended tests
  └── LiquidView.test.tsx              # Extended tests
```

**Do NOT create these files** (they belong to Story 6.3):
- `renderer/transitions.tsx` — crossfade animations
- `renderer/a11y.tsx` — focus management + ARIA
- `renderer/data-resolver.tsx` — async data fetching
- `debug/` directory — debug overlay

**Package dependency rules (unchanged from 6.1):**
- `@flui/react` → `@flui/core` (peer), `react` + `react-dom` (peer)
- Import from `@flui/core` barrel only: `import { type InteractionSpec, ... } from '@flui/core'`
- NEVER import internal `@flui/core` module files directly
- Zero awareness of specific LLM providers or state management libraries

### Implementation Patterns (MUST follow)

**Core types to use from `@flui/core` (already exported):**

```typescript
// InteractionSpec — defines data flow between components
import type { InteractionSpec } from '@flui/core';
// { source: string, target: string, event: string, dataMapping?: Record<string, string> }

// UISpecification.interactions — array of InteractionSpec
// UISpecification.components — array of ComponentSpec
// ComponentSpec.id — unique identifier for reconciliation and interaction references

// GenerationTrace — for logging interaction issues
import type { GenerationTrace, TraceStep } from '@flui/core';
// trace.addStep({ module, operation, durationMs, metadata })
```

**InteractionSpec wiring pattern:**

```typescript
// InteractionSpec example: filter dropdown feeds chart
// { source: "filter-1", target: "chart-1", event: "onChange", dataMapping: { "value": "filterCategory" } }
//
// When filter-1 fires onChange with value "electronics":
//   1. Extract event data → { value: "electronics" }
//   2. Apply dataMapping → { filterCategory: "electronics" }
//   3. Inject into chart-1 props → <Chart filterCategory="electronics" ...otherProps />

// Source handler generation:
function createSourceHandler(
  interaction: InteractionSpec,
  updateTargetState: (targetId: string, props: Record<string, unknown>) => void,
): (...args: unknown[]) => void {
  return (...args: unknown[]) => {
    const eventData = extractEventData(args[0]);
    const mappedProps: Record<string, unknown> = {};

    if (interaction.dataMapping) {
      for (const [sourceField, targetProp] of Object.entries(interaction.dataMapping)) {
        mappedProps[targetProp] = typeof eventData === 'object' && eventData !== null
          ? (eventData as Record<string, unknown>)[sourceField]
          : eventData; // Primitive: use directly if single mapping
      }
    } else {
      // No mapping: pass raw event data as "data" prop on target
      mappedProps['data'] = eventData;
    }

    updateTargetState(interaction.target, mappedProps);
  };
}

// Event data extraction helper:
function extractEventData(arg: unknown): unknown {
  // React SyntheticEvent-like: extract target.value
  if (arg && typeof arg === 'object' && 'target' in arg) {
    const target = (arg as { target: unknown }).target;
    if (target && typeof target === 'object' && 'value' in target) {
      return (target as { value: unknown }).value;
    }
  }
  // Direct value (primitive or object): use as-is
  return arg;
}
```

**View state reconciliation pattern:**

```typescript
// On regeneration with new spec:
function reconcile(newComponentIds: Set<string>): number {
  let cleaned = 0;
  for (const existingId of stateMap.keys()) {
    if (!newComponentIds.has(existingId)) {
      stateMap.delete(existingId);
      cleaned++;
    }
  }
  return cleaned;
}

// Collecting all component IDs (recursive, including children):
function collectComponentIds(components: ComponentSpec[]): Set<string> {
  const ids = new Set<string>();
  function walk(specs: ComponentSpec[]) {
    for (const spec of specs) {
      ids.add(spec.id);
      if (spec.children) walk(spec.children);
    }
  }
  walk(components);
  return ids;
}
```

**Spec renderer prop merging pattern (CRITICAL ORDER):**

```typescript
function renderComponentSpec(
  spec: ComponentSpec,
  registry: ComponentRegistry,
  options?: RenderSpecOptions,
): ReactNode {
  const entry = registry.getByName(spec.componentType);
  if (!entry) return null;
  const Component = entry.component as ComponentType<Record<string, unknown>>;

  // 1. Base props from LLM generation
  let mergedProps: Record<string, unknown> = { ...spec.props };

  if (options?.interactionStore) {
    // 2. Override: interaction target props (data flow results)
    const targetProps = options.interactionStore.getTargetProps(spec.id);
    mergedProps = { ...mergedProps, ...targetProps };

    // 3. Compose: interaction source handlers
    const sourceHandlers = options.interactionStore.getSourceHandlers(spec.id);
    for (const [eventName, handler] of Object.entries(sourceHandlers)) {
      const existingHandler = mergedProps[eventName];
      if (typeof existingHandler === 'function') {
        // Chain: call original first, then interaction handler
        mergedProps[eventName] = (...args: unknown[]) => {
          (existingHandler as (...a: unknown[]) => void)(...args);
          handler(...args);
        };
      } else {
        mergedProps[eventName] = handler;
      }
    }
  }

  if (options?.viewStateStore) {
    // 4. Override: view state (preserved user input takes highest priority)
    const viewState = options.viewStateStore.getState(spec.id);
    mergedProps = { ...mergedProps, ...viewState };
  }

  const children = spec.children?.map((child) =>
    renderComponentSpec(child, registry, options),
  );
  return createElement(Component, { ...mergedProps, key: spec.key ?? spec.id }, children);
}
```

**Handler composition detail:**
When a source component already has an event handler in its spec props (e.g., `onChange` defined by LLM), AND the interaction wiring adds another handler for the same event:
- Call the original spec prop handler FIRST
- Then call the interaction handler
- Both must receive the same arguments
- This ensures the component's original behavior is preserved while also propagating data flow

**GenerationTrace logging for interaction issues:**

```typescript
// Log interaction wiring issues to the trace
trace.addStep({
  module: 'interaction-wiring',
  operation: 'wireInteractions',
  durationMs: 0, // Wiring is synchronous, typically < 1ms
  metadata: {
    totalInteractions: interactions.length,
    wiredSuccessfully: interactions.length - issues.length,
    skippedCount: issues.length,
    issues: issues.map(i => ({
      type: i.type,
      componentId: i.componentId,
      interactionIndex: i.interactionIndex,
    })),
  },
});
```

**React reactivity pattern for stores:**

```typescript
// Both ViewStateStore and InteractionStore need to trigger React re-renders
// when their internal state changes. Use the ref + counter pattern:

function useViewState(): ViewStateStore {
  const storeRef = useRef(createViewStateStore());
  const [, setVersion] = useState(0);

  // Wrap setState to trigger re-render
  const store = useMemo(() => ({
    ...storeRef.current,
    setState: (componentId: string, update: Record<string, unknown>) => {
      storeRef.current.setState(componentId, update);
      setVersion(v => v + 1); // Trigger re-render
    },
  }), []); // Stable reference

  return store;
}
```

### Error Handling

No new `FluiError` codes needed for this story. Interaction wiring issues are logged, not thrown:
- Missing source/target component → silently skip + log to GenerationTrace (AC #4)
- The `FluiError` code sequence remains at `FLUI_E023` (last code from Story 5-3)

Edge cases to handle:
- Empty `interactions` array → no wiring needed, render normally
- `InteractionSpec` with empty `dataMapping` → pass raw event data as `data` prop on target
- Circular interactions (A→B→A) → each propagation is independent; no infinite loop because source handlers only fire on user events, not on prop changes
- Same component is both source and target of different interactions → both roles apply, all handlers composed
- `ComponentSpec.id` collision across parent and children → unlikely (LLM generates unique IDs), but handle gracefully (use first match)

### Existing Code to Reuse (DO NOT reinvent)

| What | Where | How to use |
|------|-------|------------|
| `InteractionSpec` type | `@flui/core` barrel | Defines source→target data flow |
| `ComponentSpec` type | `@flui/core` barrel | Has `id` field for identity/reconciliation |
| `UISpecification.interactions` | `@flui/core` barrel | Array of InteractionSpec to wire |
| `UISpecification.components` | `@flui/core` barrel | Component tree to extract IDs from |
| `GenerationTrace` type | `@flui/core` barrel | For logging interaction issues |
| `createTrace()` | `@flui/core` barrel | Already used in `useLiquidView` |
| `ComponentRegistry.getByName()` | `@flui/core` barrel | Already used in spec-renderer |
| `renderSpec()` | `renderer/spec-renderer.tsx` | Extend with `options` parameter |
| `useLiquidView()` | `hooks/use-liquid-view.ts` | Extend with view state lifecycle |
| `LiquidView` component | `LiquidView.tsx` | Wire interaction store + view state |
| `FluiProvider` / `useFluiContext` | `FluiProvider.tsx` | Unchanged — provides registry and config |
| Test setup | `test-setup.ts` | Existing cleanup + RTL configuration |

### Design Decisions

**View state store is created once per LiquidView instance:** The `useViewState()` hook creates a single store that persists across regenerations. When a new spec arrives, `reconcile()` is called to prune orphaned state while preserving matching component state. The store is NOT recreated on regeneration.

**Interaction store is recreated per spec:** Unlike view state, the interaction store is rebuilt when a new spec arrives because the `interactions` array may be completely different. The interaction store only holds derived state (data flowing from sources to targets), not user-persisted state.

**Prop merge priority (highest wins last):**
1. `spec.props` — base from LLM generation
2. Interaction target props — data flow results override LLM defaults
3. View state — user input overrides everything (this is the preservation guarantee)

**Event handlers are composed, not replaced:** When interaction wiring adds a handler for an event that already exists in spec props, both handlers fire. Original goes first for predictability.

**React key strategy unchanged:** `spec.key ?? spec.id` is already used from Story 6.1. React's reconciliation preserves DOM state (uncontrolled inputs) automatically when keys match. The view state store handles controlled component state preservation on top of this.

**No new context providers:** Interaction and view state are passed via `RenderSpecOptions` parameter, not via React Context. This keeps the provider tree simple and avoids unnecessary re-renders of the entire subtree.

### Project Structure Notes

- Story 6.1 established the `@flui/react` package — this story extends it
- Existing test infrastructure (Vitest + jsdom + RTL + cleanup) is fully set up
- All test files are co-located: `{source}.test.ts` in the same directory
- The renderer barrel (`renderer/index.ts`) currently only exports `renderSpec` — will be extended
- No changes to `@flui/core` package in this story — all work is in `@flui/react`
- Architecture specifies `interaction-wiring.ts` (not `.tsx`) — no JSX needed in this module
- Architecture specifies `view-state.ts` (not `.tsx`) — no JSX needed in this module

### Previous Story Intelligence

**From Story 6-1 (LiquidView Component & Fallback Rendering — DONE):**
- `renderSpec(spec, registry)` works — extend with third `options` parameter (backward-compatible)
- `useLiquidView(options, ctx)` returns `{ state }` — extend return type to include `viewStateStore`
- `LiquidView` calls `renderSpec(state.spec, ctx.registry)` on line ~45 — add options here
- React key = `spec.key ?? spec.id` — already set up for reconciliation
- `registry.getByName()` (not `registry.query()`) is the correct method for component lookup
- `test-setup.ts` handles RTL cleanup after each test
- Story 6-1 used `vi.fn()` mocks for orchestrator/pipeline — follow same pattern
- 51 tests, 91.58% coverage — maintain zero regressions
- `FluiProvider` is a thin context wrapper — do NOT add state management to it
- `useLiquidView` manages `AbortController` for cleanup — view state store does NOT need abort handling (it's synchronous)
- Intent-driven generation trigger: generation runs when `intent` changes — view state reconciliation happens when the resulting spec changes

**From Story 6-1 debug notes:**
- `registry.getByName()` is the correct method (not `registry.query()` as originally specified)
- DOM cleanup between RTL tests is critical — already handled by `test-setup.ts`
- `zod: 4.3.6` was added to devDependencies for test registry creation

**From Story 5-3 (Custom Validators & Validation Retry):**
- `validateWithRetry()` available but not needed for this story
- 391 core tests passing — do not regress
- Factory function + closure pattern used throughout — follow for `createViewStateStore` and `createInteractionStore`

### Git Intelligence

**Recent commit patterns:**
- `dc99fd3` — `feat: implement LiquidView component, FluiProvider, and spec renderer (story 6-1)` (latest)
- All commits follow: `feat: implement <description> (story X-Y)`
- Implementation order: types → implementation → tests → barrel exports
- Zero regressions maintained across all stories (392 total tests)

**Files most recently modified in `@flui/react`:**
- All files in `packages/react/src/` were created in Story 6-1
- `pnpm-lock.yaml` updates expected when adding/changing deps (none needed for this story)

### Testing Standards

- **Framework:** Vitest 4.0.18 with `jsdom` environment
- **React testing:** `@testing-library/react` 16.3.2 — `render()`, `screen`, `waitFor`, `act`, `fireEvent`
- **Test structure:** `describe('ModuleName') > describe('feature') > it('specific behavior')`
- **Coverage:** >90% statement coverage required
- **Mock pattern:** Use `vi.fn()` for callbacks, create test components with `React.createElement`
- **Async tests:** Use `waitFor()` for state transitions, `act()` for synchronous state updates
- **Import pattern:** Import from `@flui/core` barrel, never internal modules

**Test component examples for interaction testing:**
```typescript
// Source component: fires events
function FilterDropdown({ value, onChange }: { value?: string; onChange?: (value: string) => void }) {
  return createElement('select', {
    value,
    onChange: (e: { target: { value: string } }) => onChange?.(e.target.value),
  });
}

// Target component: receives derived props
function DataChart({ filterCategory, data }: { filterCategory?: string; data?: unknown[] }) {
  return createElement('div', { 'data-testid': 'chart', 'data-filter': filterCategory });
}
```

### Performance Considerations

- View state store operations are O(1) per component (Map lookups)
- Reconciliation is O(n) where n = number of stored component states
- Interaction wiring is O(m) where m = number of interactions (built once per spec)
- Handler composition adds negligible overhead (function wrapping)
- No additional runtime dependencies — pure React + @flui/core
- Bundle size budget: < 8KB gzipped total for @flui/react (current: 5.49 KB — ~2.5 KB headroom)
- Memoize interaction store creation with `useMemo` keyed on `spec.interactions` identity

### Library/Framework Requirements

| Library | Version | Purpose | Already in package.json? |
|---------|---------|---------|-------------------------|
| `react` | >=18.0.0 | Core React (peer dep) | Yes (peer) |
| `react-dom` | >=18.0.0 | React DOM rendering (peer dep) | Yes (peer) |
| `@flui/core` | workspace:* | Core types and pipeline (peer dep) | Yes (peer) |
| `@testing-library/react` | 16.3.2 | Component testing | Yes (devDep, added in 6-1) |
| `@testing-library/jest-dom` | * | DOM assertion matchers | Yes (devDep, added in 6-1) |
| `jsdom` | * | DOM environment for Vitest | Yes (devDep, added in 6-1) |
| `zod` | 4.3.6 | Test registry creation | Yes (devDep, added in 6-1) |

No new dependencies needed for this story.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.2] - User story, acceptance criteria
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 6] - Epic objectives, cross-story dependencies
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture — React Adapter] - view-state.ts, interaction-wiring.ts file placement
- [Source: _bmad-output/planning-artifacts/architecture.md#Loading State Pattern] - LiquidViewState 5-state machine
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-001] - ViewState management
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-008] - InteractionSpec wiring, camelCase event names
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Directory Structure] - packages/react/src/renderer/ layout
- [Source: _bmad-output/planning-artifacts/architecture.md#Module Boundary Rules] - No React in core, adapter bridges them
- [Source: _bmad-output/planning-artifacts/architecture.md#Import Pattern] - Import from barrel files only
- [Source: _bmad-output/planning-artifacts/architecture.md#Event Communication Pattern] - InteractionSpec is the only event system for rendered components
- [Source: _bmad-output/planning-artifacts/prd.md#FR20] - Wire data flows between generated components
- [Source: _bmad-output/planning-artifacts/prd.md#FR21] - Manage view state across re-generations
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-P7] - @flui/react bundle < 8KB gzipped
- [Source: packages/core/src/spec/spec.types.ts#InteractionSpec] - { source, target, event, dataMapping? }
- [Source: packages/core/src/spec/spec.types.ts#ComponentSpec] - { id, componentType, props, key?, children? }
- [Source: packages/core/src/spec/spec.types.ts#UISpecification] - { version, components, layout, interactions, metadata }
- [Source: packages/core/src/types.ts#GenerationTrace] - { id, startTime, steps, addStep(step) }
- [Source: packages/core/src/types.ts#TraceStep] - { module, operation, durationMs, metadata }
- [Source: packages/react/src/renderer/spec-renderer.tsx] - Current renderSpec and renderComponentSpec
- [Source: packages/react/src/hooks/use-liquid-view.ts] - Current hook with state machine and trace
- [Source: packages/react/src/LiquidView.tsx] - Current component rendering switch
- [Source: packages/react/src/react.types.ts] - Current type definitions
- [Source: _bmad-output/implementation-artifacts/6-1-liquidview-component-and-fallback-rendering.md] - Previous story intelligence

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed one test assertion in LiquidView.test.tsx where `getByTestId('filter-1')` was used instead of `getByTestId('input')` — the test component uses `data-testid="input"` not the component ID.

### Completion Notes List

- **Task 1:** Added `ViewStateStore`, `InteractionStore`, `InteractionIssue`, `RenderSpecOptions` interfaces to `react.types.ts`. Updated `UseLiquidViewResult` to include `viewStateStore`.
- **Task 2:** Created `view-state.ts` with `createViewStateStore()` factory (Map-based, O(1) operations) and `useViewState()` hook (ref+counter reactivity pattern).
- **Task 3:** Created `interaction-wiring.ts` with `createInteractionStore()` factory (validates source/target existence, builds handler maps, records issues) and `useInteractionStore()` hook. Supports SyntheticEvent extraction, dataMapping, handler composition for same event.
- **Task 4:** Extended `renderSpec()` and `renderComponentSpec()` with optional `RenderSpecOptions` parameter. Prop merge order: base → interaction target → composed handlers → view state (highest priority). Fully backward-compatible.
- **Task 5:** Integrated `useViewState()` into `useLiquidView()`. Added `collectComponentIds()` helper for recursive ID extraction. Reconciliation runs when transitioning to `rendering` state. `viewStateStore` exposed in `UseLiquidViewResult`.
- **Task 6:** Updated `LiquidView` to create `useInteractionStore` when in rendering state. Passes `RenderSpecOptions` with both stores to `renderSpec()`. Interaction store recreated per spec.
- **Task 7:** Updated barrel exports in `renderer/index.ts` and `src/index.ts` with all new public functions and types.
- **Task 8:** Created 2 new test files (28 tests) and extended 3 existing test files (12 new tests). Total: 91 react tests, all passing. Coverage: 94.49% statements, 97.75% lines, 95.91% functions.
- **Code Review Fixes (AI):** Added trace carry-over into `rendering` state and logged interaction wiring issues to `GenerationTrace` from `LiquidView`.
- **Code Review Fixes (AI):** Added automatic view-state capture from user events in `spec-renderer` so user-entered values are written to `ViewStateStore` and preserved across regeneration.
- **Code Review Fixes (AI):** Strengthened LiquidView integration tests to assert actual interaction propagation and state persistence across regeneration.

### Implementation Plan

- Factory function + closure pattern for both stores (consistent with codebase)
- Ref + counter pattern for React reactivity (avoids external state management deps)
- Interaction store is recreated per spec; view state store persists across regenerations
- No new dependencies — pure React + @flui/core types
- Zero regressions: 392 core tests + 91 react tests all pass

### File List

**New files:**

- `packages/react/src/renderer/view-state.ts`
- `packages/react/src/renderer/interaction-wiring.ts`
- `packages/react/src/renderer/view-state.test.ts`
- `packages/react/src/renderer/interaction-wiring.test.ts`

**Modified files:**

- `packages/react/src/react.types.ts`
- `packages/react/src/renderer/spec-renderer.tsx`
- `packages/react/src/renderer/index.ts`
- `packages/react/src/hooks/use-liquid-view.ts`
- `packages/react/src/LiquidView.tsx`
- `packages/react/src/index.ts`
- `packages/react/src/renderer/spec-renderer.test.tsx`
- `packages/react/src/hooks/use-liquid-view.test.ts`
- `packages/react/src/LiquidView.test.tsx`
- `_bmad-output/implementation-artifacts/6-2-interaction-wiring-and-view-state-management.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-02-26: Implemented interaction wiring and view state management (Story 6.2) — added ViewStateStore with reconciliation, InteractionStore with reactive data flow, integrated into spec renderer and LiquidView with full backward compatibility. 91 tests, 94.49% coverage.
- 2026-02-26: Addressed code review findings — implemented user-input view state capture, added GenerationTrace logging for missing interaction endpoints, tightened end-to-end assertions for interaction propagation and regeneration state persistence.

### Senior Developer Review (AI)

- Reviewer: Fabrice (AI-assisted)
- Date: 2026-02-26
- Outcome: Approve
- Findings addressed:
  - AC #2: View state is now captured from user events in `renderSpec` and replayed on regeneration via `ViewStateStore`.
  - AC #4: Missing source/target interaction references are now logged to `GenerationTrace` under `interaction-wiring/wireInteractions`.
  - Task audit: Rendering state now carries `trace`, enabling interaction-wiring trace reporting from `LiquidView`.
  - Test quality: Integration tests now assert data propagation and cross-regeneration state persistence behavior.
- Verification:
  - `pnpm --filter @flui/react test` (91/91 passing)
  - `pnpm --filter @flui/react exec vitest run --coverage` (94.56% statements)
