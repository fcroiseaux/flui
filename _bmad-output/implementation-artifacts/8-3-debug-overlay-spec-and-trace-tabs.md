# Story 8.3: Debug Overlay (Spec & Trace Tabs)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a debug overlay in my React app that shows the current UISpecification and generation traces,
so that I can inspect and troubleshoot LLM generation behavior during development.

## Acceptance Criteria

1. **Debug Overlay Activation** (FR46, FR47): Given the @flui/react package debug overlay, when a developer enables the debug overlay via the `useFluidDebug` hook, then an overlay panel is rendered with two tabs: Spec and Trace.

2. **Spec Tab Functionality** (FR46): Given the Spec tab is active, when a UISpecification is currently rendered, then the full specification is displayed in a readable, structured format showing component hierarchy, props, layout, interactions, and metadata. The developer can inspect component tree, individual component props, and layout configuration.

3. **Trace Tab Functionality** (FR47): Given the Trace tab is active, when generation traces are available, then the traces are displayed with timeline, module steps, durations, and metadata. The developer can search and filter traces by:
   - **Timestamp** (date range picker)
   - **Intent** (substring text match with real-time filtering as user types)
   - **Context attributes** (key-value dropdown filter) (FR48)

4. **Accessibility Requirements** (NFR-A4): Given the debug overlay, then it is fully keyboard-navigable (Tab between elements, arrow keys within tab panels) and screen-reader accessible with proper ARIA roles (`tablist`, `tab`, `tabpanel`) and labels.

5. **Empty State Handling**: Given no active generation or traces, when the debug overlay is open, then it displays a user-friendly empty state message (not an error or blank panel).

6. **Testing Requirements**: Co-located tests using React Testing Library verify: Spec tab rendering, Trace tab rendering, search/filter functionality, keyboard navigation, screen reader accessibility attributes. All tests pass with >90% statement coverage.

## Tasks / Subtasks

- [x] Task 1: Create debug types and hook (AC: #1)
  - [x] 1.1 Create `packages/react/src/debug/debug.types.ts` with type definitions:
    - `DebugOverlayProps` interface: `{ spec: UISpecification | null; traces: readonly GenerationTrace[]; position?: 'right' | 'bottom'; defaultTab?: 'spec' | 'trace'; isOpen?: boolean; onToggle?: (isOpen: boolean) => void }`
    - `DebugTabId` type: `'spec' | 'trace'`
    - `TraceFilter` interface: `{ startTime?: number; endTime?: number; intent?: string; contextKey?: string; contextValue?: string }`
  - [x] 1.2 Create `packages/react/src/debug/use-fluid-debug.ts` hook:
    - `useFluidDebug(options?: { defaultOpen?: boolean })` returns `{ isOpen: boolean; toggle: () => void; open: () => void; close: () => void; overlayProps: DebugOverlayProps }`
    - Hook reads current spec and traces from LiquidView context or explicit props
    - Manages open/closed state with `useState`
    - Keyboard shortcut: Ctrl+Shift+D toggles overlay (registers/cleans up `keydown` listener)
  - [x] 1.3 Export hook from `packages/react/src/debug/index.ts`

- [x] Task 2: Implement DebugOverlay shell component (AC: #1, #4)
  - [x] 2.1 Create `packages/react/src/debug/DebugOverlay.tsx`:
    - Renders as a fixed-position panel (right side or bottom, configurable)
    - Tab bar with "Spec" and "Trace" tabs using `role="tablist"`, `role="tab"`, `role="tabpanel"` ARIA pattern
    - Active tab managed via `useState<DebugTabId>`
    - Keyboard navigation: Arrow Left/Right switches tabs, Tab key moves into panel content
    - `aria-selected`, `aria-controls`, `id` attributes for tab-panel association
    - Collapse/expand toggle button with `aria-expanded`
    - Inline `CSSProperties` for all styling (no CSS modules — follows codebase convention)
    - `data-flui-debug` attribute on root element for DOM selection
  - [x] 2.2 Implement panel resize/collapse UX:
    - Toggle button to collapse/expand overlay
    - Default width: 400px (right position) or height: 300px (bottom position)

- [x] Task 3: Implement SpecTab component (AC: #2, #5)
  - [x] 3.1 Create `packages/react/src/debug/SpecTab.tsx`:
    - Receives `spec: UISpecification | null` as prop
    - When spec is null: render empty state message "No specification generated yet"
    - When spec exists: render structured tree view:
      - **Metadata section**: version, generatedAt (formatted), model, traceId
      - **Components section**: recursive tree of `ComponentSpec` nodes showing `id`, `componentType`, `props` (collapsible JSON), `children`
      - **Layout section**: display `LayoutSpec` properties
      - **Interactions section**: list of `InteractionSpec` entries showing source → target event mappings
    - Each section collapsible with disclosure widget (`<details>/<summary>` or custom with `aria-expanded`)
    - Props displayed as formatted JSON with syntax highlighting (inline styles for key/value colors)
  - [x] 3.2 Implement component tree recursion:
    - `renderComponentNode(component: ComponentSpec, depth: number)` recursive renderer
    - Indentation by depth level
    - Show children count badge

- [x] Task 4: Implement TraceTab component with search/filter (AC: #3, #5)
  - [x] 4.1 Create `packages/react/src/debug/TraceTab.tsx`:
    - Receives `traces: readonly GenerationTrace[]` as prop
    - When traces is empty: render empty state "No traces recorded yet"
    - When traces exist: render filterable trace list
  - [x] 4.2 Implement filter bar:
    - **Timestamp filter**: two `<input type="datetime-local">` for start/end range
    - **Intent filter**: `<input type="text">` with real-time substring filtering (debounced 200ms)
    - **Context filter**: `<select>` for context key + `<input>` for value — extracted from trace step metadata
    - Clear filters button
    - `aria-label` on all filter inputs
  - [x] 4.3 Implement trace list display:
    - Each trace: expandable row showing trace ID, start time (formatted), step count, total duration
    - Expanded view: timeline of `TraceStep` entries:
      - Module name (color-coded by module)
      - Operation name
      - Duration in ms (with bar visualization proportional to total)
      - Metadata (collapsible JSON)
    - Steps sorted chronologically
  - [x] 4.4 Implement filter logic:
    - Filter traces by timestamp range (compare `trace.startTime`)
    - Filter by intent substring (search trace step metadata for intent-related fields in `intent-parser` module steps)
    - Filter by context attribute (search `context-resolver` module step metadata for matching key-value)
    - Filters are AND-combined
    - `useMemo` for filtered results to avoid re-computation on tab switch

- [x] Task 5: Update barrel exports (AC: all)
  - [x] 5.1 Create `packages/react/src/debug/index.ts` exporting:
    - Components: `DebugOverlay`, `SpecTab`, `TraceTab`
    - Hook: `useFluidDebug`
    - Types: `DebugOverlayProps`, `DebugTabId`, `TraceFilter`
  - [x] 5.2 Update `packages/react/src/index.ts` to add debug exports:
    - Type exports: `DebugOverlayProps`, `DebugTabId`, `TraceFilter`
    - Value exports: `DebugOverlay`, `SpecTab`, `TraceTab`, `useFluidDebug`
  - [x] 5.3 Verify TypeScript compilation succeeds with all exports

- [x] Task 6: Write comprehensive tests (AC: #1-#6)
  - [x] 6.1 Create `packages/react/src/debug/DebugOverlay.test.tsx`:
    - **Overlay rendering tests:**
      - Test: renders with two tabs (Spec and Trace)
      - Test: defaults to Spec tab active
      - Test: switches tabs on click
      - Test: respects `defaultTab` prop
    - **Keyboard navigation tests:**
      - Test: Arrow Right/Left switches between tabs
      - Test: Tab key moves focus into active panel
      - Test: Enter/Space activates tab
    - **Accessibility tests:**
      - Test: tabs have `role="tab"` and `aria-selected`
      - Test: tab panels have `role="tabpanel"` and `aria-labelledby`
      - Test: tablist has `role="tablist"`
      - Test: collapse button has `aria-expanded`
  - [x] 6.2 Create `packages/react/src/debug/SpecTab.test.tsx`:
    - Test: renders empty state when spec is null
    - Test: renders component tree from spec
    - Test: displays metadata section with model and traceId
    - Test: displays interactions with source/target mapping
    - Test: collapses/expands sections
    - Test: renders nested children recursively
  - [x] 6.3 Create `packages/react/src/debug/TraceTab.test.tsx`:
    - Test: renders empty state when no traces
    - Test: renders trace list with trace IDs and timestamps
    - Test: expands trace to show steps
    - Test: filters by intent substring (real-time)
    - Test: filters by timestamp range
    - Test: filters by context attribute key-value
    - Test: combined filters (AND logic)
    - Test: clear filters resets view
    - Test: filter inputs have aria-labels
  - [x] 6.4 Create `packages/react/src/debug/use-fluid-debug.test.tsx`:
    - Test: returns isOpen state (default false)
    - Test: toggle() flips isOpen
    - Test: open()/close() set explicit state
    - Test: Ctrl+Shift+D keyboard shortcut toggles
    - Test: cleans up keydown listener on unmount
  - [x] 6.5 All tests pass with >90% statement coverage

## Dev Notes

### Architecture Compliance

**Package:** `@flui/react` — new `debug/` module

**New files:**
```
packages/react/src/debug/
  ├── index.ts                    # Debug module barrel exports
  ├── debug.types.ts              # Type definitions (DebugOverlayProps, TraceFilter, etc.)
  ├── use-fluid-debug.ts          # Hook to enable/control debug overlay
  ├── DebugOverlay.tsx            # Main overlay shell with tab navigation
  ├── SpecTab.tsx                 # Spec display tab (component tree, layout, interactions)
  ├── TraceTab.tsx                # Trace display with filtering
  ├── DebugOverlay.test.tsx       # Overlay shell + keyboard + a11y tests
  ├── SpecTab.test.tsx            # Spec tab rendering tests
  ├── TraceTab.test.tsx           # Trace tab + filter tests
  └── use-fluid-debug.test.tsx    # Hook tests
```

**Modified files:**
```
packages/react/src/
  └── index.ts                    # Add debug module exports
```

**Do NOT create or modify these files** (they belong to other stories or are out of scope):
- `packages/react/src/FluiProvider.tsx` — do NOT modify the provider context shape
- `packages/react/src/LiquidView.tsx` — do NOT modify LiquidView internals
- `packages/react/src/renderer/` — do NOT touch spec renderer, transitions, or a11y modules
- `packages/react/src/react.types.ts` — do NOT modify existing types
- `packages/core/src/` — do NOT modify any core package files
- `packages/core/src/observe/` — do NOT modify collector, metrics, or transports
- `packages/core/src/types.ts` — do NOT modify GenerationTrace or UISpecification types

**What this story IS vs IS NOT:**
- **IS:** A set of React debug overlay components (`DebugOverlay`, `SpecTab`, `TraceTab`) that visualize `UISpecification` and `GenerationTrace` data passed as props
- **IS:** A `useFluidDebug` hook that manages overlay open/closed state and keyboard shortcut
- **IS:** A read-only inspection tool — it displays data, it does NOT modify specs, traces, or system state
- **IS NOT:** A modification to FluiProvider or LiquidView — the debug overlay receives data as props, it does NOT reach into context or internal state
- **IS NOT:** A metrics dashboard — Story 8.2 created the MetricsReporter; this story shows spec and traces only
- **IS NOT:** A factory wiring story — Story 8.5 will wire the debug overlay into the createFlui factory and connect it to the collector's buffered traces
- **IS NOT:** A testing package — Story 8.4 creates MockConnector and assertion helpers

**Module dependency rules:**
- `debug/` components import types from `@flui/core` (type-only: `UISpecification`, `ComponentSpec`, `InteractionSpec`, `LayoutSpec`, `GenerationTrace`, `TraceStep`, `UISpecificationMetadata`)
- `debug/` components import React and React DOM only
- `debug/` does NOT import from `../renderer/`, `../FluiProvider`, or `../LiquidView`
- `debug/` does NOT import any runtime value from `@flui/core` — only type imports
- Zero new runtime dependencies
- `sideEffects: false` must be maintained — debug module is fully tree-shakeable

### Implementation Patterns (MUST follow)

**Inline styles pattern (established codebase convention):**
```typescript
// Follow the CSSProperties pattern from transitions.tsx and a11y.tsx
const overlayStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  width: '400px',
  height: '100vh',
  backgroundColor: '#1e1e2e',
  color: '#cdd6f4',
  fontFamily: 'monospace',
  fontSize: '13px',
  zIndex: 99999,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  borderLeft: '1px solid #45475a',
};
```

**ARIA tab pattern (WAI-ARIA Tabs design pattern):**
```typescript
// Tab navigation — follows WAI-ARIA Authoring Practices
<div role="tablist" aria-label="Debug overlay tabs">
  <button
    role="tab"
    id="flui-debug-tab-spec"
    aria-selected={activeTab === 'spec'}
    aria-controls="flui-debug-panel-spec"
    tabIndex={activeTab === 'spec' ? 0 : -1}
    onClick={() => setActiveTab('spec')}
    onKeyDown={handleTabKeyDown}
  >
    Spec
  </button>
  <button
    role="tab"
    id="flui-debug-tab-trace"
    aria-selected={activeTab === 'trace'}
    aria-controls="flui-debug-panel-trace"
    tabIndex={activeTab === 'trace' ? 0 : -1}
    onClick={() => setActiveTab('trace')}
    onKeyDown={handleTabKeyDown}
  >
    Trace
  </button>
</div>
<div
  role="tabpanel"
  id="flui-debug-panel-spec"
  aria-labelledby="flui-debug-tab-spec"
  hidden={activeTab !== 'spec'}
>
  <SpecTab spec={spec} />
</div>
```

**Tab keyboard handler:**
```typescript
function handleTabKeyDown(e: React.KeyboardEvent): void {
  const tabs: DebugTabId[] = ['spec', 'trace'];
  const currentIndex = tabs.indexOf(activeTab);

  if (e.key === 'ArrowRight') {
    e.preventDefault();
    const next = tabs[(currentIndex + 1) % tabs.length];
    setActiveTab(next);
    // Focus the newly active tab button
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    const prev = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
    setActiveTab(prev);
  }
}
```

**Hook pattern (keyboard shortcut):**
```typescript
export function useFluidDebug(options?: { defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(options?.defaultOpen ?? false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    toggle: () => setIsOpen(prev => !prev),
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}
```

**Component tree recursion for SpecTab:**
```typescript
function renderComponentNode(
  component: ComponentSpec,
  depth: number,
): ReactNode {
  return (
    <div key={component.id} style={{ paddingLeft: `${depth * 16}px` }} data-flui-debug-component={component.id}>
      <details>
        <summary>
          <strong>{component.componentType}</strong> <code>#{component.id}</code>
          {component.children?.length ? ` (${component.children.length} children)` : ''}
        </summary>
        <pre style={propsStyle}>{JSON.stringify(component.props, null, 2)}</pre>
        {component.children?.map(child => renderComponentNode(child, depth + 1))}
      </details>
    </div>
  );
}
```

**Trace display with duration bars:**
```typescript
function renderTraceStep(step: TraceStep, maxDuration: number): ReactNode {
  const widthPercent = maxDuration > 0 ? (step.durationMs / maxDuration) * 100 : 0;
  return (
    <div data-flui-debug-step={step.module}>
      <span style={moduleStyle}>{step.module}</span>
      <span style={operationStyle}>{step.operation}</span>
      <span style={durationStyle}>{step.durationMs}ms</span>
      <div style={{ ...barStyle, width: `${widthPercent}%` }} aria-hidden="true" />
      <details>
        <summary>metadata</summary>
        <pre>{JSON.stringify(step.metadata, null, 2)}</pre>
      </details>
    </div>
  );
}
```

**Filter with debounced intent search:**
```typescript
// Use useMemo for filtered traces, useRef for debounce timer
const filteredTraces = useMemo(() => {
  return traces.filter(trace => {
    // Timestamp filter
    if (filter.startTime && trace.startTime < filter.startTime) return false;
    if (filter.endTime && trace.startTime > filter.endTime) return false;

    // Intent filter — search intent-parser module steps
    if (filter.intent) {
      const hasIntent = trace.steps.some(
        step => step.module === 'intent-parser' &&
          JSON.stringify(step.metadata).toLowerCase().includes(filter.intent!.toLowerCase())
      );
      if (!hasIntent) return false;
    }

    // Context attribute filter — search context-resolver module steps
    if (filter.contextKey) {
      const hasContext = trace.steps.some(
        step => step.module === 'context-resolver' &&
          step.metadata[filter.contextKey!] !== undefined &&
          (!filter.contextValue || String(step.metadata[filter.contextKey!]).includes(filter.contextValue))
      );
      if (!hasContext) return false;
    }

    return true;
  });
}, [traces, filter]);
```

### Existing Code to Reuse (DO NOT reinvent)

| What | Where | How to use |
|------|-------|------------|
| `UISpecification` interface | `packages/core/src/spec/spec.types.ts` | Type-only import for SpecTab props |
| `ComponentSpec` interface | `packages/core/src/spec/spec.types.ts` | Type-only import for tree rendering |
| `InteractionSpec` interface | `packages/core/src/spec/spec.types.ts` | Type-only import for interaction display |
| `LayoutSpec` interface | `packages/core/src/spec/spec.types.ts` | Type-only import for layout display |
| `UISpecificationMetadata` interface | `packages/core/src/spec/spec.types.ts` | Type-only import for metadata display |
| `GenerationTrace` interface | `packages/core/src/types.ts:108-115` | Type-only import for TraceTab props |
| `TraceStep` interface | `packages/core/src/types.ts:90-102` | Type-only import for step rendering |
| `createTrace()` | `packages/core/src/types.ts:178-202` | For test setup ONLY — create mock traces |
| `visuallyHiddenStyle` pattern | `packages/react/src/renderer/a11y.tsx` | Reference for accessibility styling (do NOT import — replicate if needed) |
| `window.matchMedia` mock | `packages/react/src/test-setup.ts` | Already mocked in test setup |
| ARIA tab pattern | WAI-ARIA Authoring Practices 1.2 | Standard tabs pattern for overlay navigation |

### Design Decisions

**Debug overlay receives data as props, NOT from context:**
The `DebugOverlay` component accepts `spec` and `traces` as props rather than reading from FluiProvider context. This keeps the debug module decoupled from the provider — Story 8.5 (createFlui factory) will handle wiring the collector's buffered traces and current spec into the overlay. This also makes the overlay independently testable without needing a full FluiProvider setup.

**Inline styles, no CSS modules or styled-components:**
Following the established codebase convention (see `transitions.tsx`, `a11y.tsx`), all styling uses React inline `CSSProperties` objects. This keeps the debug module zero-dependency and tree-shakeable. The dark theme is hardcoded for developer tools (similar to browser DevTools conventions).

**`<details>/<summary>` for collapsible sections:**
Using native HTML disclosure widgets instead of custom accordion components. This provides built-in keyboard accessibility (Enter/Space to toggle) and screen reader support (`aria-expanded` is automatic). This avoids reinventing collapsible UI logic.

**Filter state is local to TraceTab, not lifted to overlay:**
The `TraceFilter` state lives inside `TraceTab` via `useState`. There's no need to persist filter state across tab switches or externalize it — the filter is a transient developer interaction. `useMemo` prevents re-filtering when switching tabs since `TraceTab` unmounts.

**Keyboard shortcut Ctrl+Shift+D:**
Following common developer tools conventions (e.g., Chrome DevTools Ctrl+Shift+I). The shortcut is registered on `document` via `useEffect` in the `useFluidDebug` hook and cleaned up on unmount. Only fires when the debug hook is mounted — no global side effects.

**No portal rendering:**
The overlay renders inline (fixed position) rather than using `ReactDOM.createPortal`. This avoids complexity with portal targets and keeps the component self-contained. The `z-index: 99999` ensures it renders above application content.

**`exactOptionalPropertyTypes` compliance:**
All optional properties in new types use explicit `| undefined` suffix, following the project's TypeScript strictness.

### Previous Story Intelligence

**From Story 8-2 (Cost & Cache Metrics Reporting — DONE):**
- Factory pattern: `createMetricsReporter()` with closure-based state — debug components use functional components with hooks instead
- 642 total tests in `@flui/core` at end of Story 8.2 — maintain zero regressions in core
- Barrel export pattern: types first, then values in `index.ts`
- `MetricsReporter`, `CostMetrics`, `CacheMetrics` types available — not directly consumed by this story but referenced for future metrics tab (Story 8.5 wiring)

**From Story 8-1 (Observability Collector & Trace Transports — DONE):**
- `ObservabilityCollector.getBufferedTraces()` returns `readonly GenerationTrace[]` — this is what Story 8.5 will pass to the debug overlay's `traces` prop
- Buffer default: 100 traces — UI should handle up to 100 trace entries efficiently
- `redactTrace()` applied before transports — traces displayed in debug overlay may have redacted fields (show `[REDACTED]` values as-is, don't try to decrypt)
- Transport names: `'console'`, `'buffer'`, `'metrics'` — informational for trace step context

**From Story 6-3 (Visual Transitions & Accessibility — DONE):**
- `CrossfadeTransition` uses `requestAnimationFrame` for paint scheduling — debug overlay does NOT need transitions
- `visuallyHiddenStyle` pattern for screen-reader-only content — replicate for any SR-only labels
- Focus management pattern: `containerRef` + `tabIndex={-1}` — use similar for overlay focus trapping
- `window.matchMedia('(prefers-reduced-motion: reduce)')` — already mocked in test-setup.ts

**From Story 6-1 (LiquidView & FluiProvider — DONE):**
- `FluiProvider` context shape: `{ registry: ComponentRegistry; config?: FluiReactConfig }` — debug overlay does NOT read from this context
- `LiquidView` state machine: `idle → generating → validating → rendering | error` — the spec is available only in `rendering` state as `state.spec`
- Test mocking pattern: `vi.mock('@flui/core', async (importOriginal) => {...})` — follow for debug tests if needed

### Git Intelligence

**Recent commit patterns:**
- `5fe0ff0` — `feat: implement cost and cache metrics reporting (story 8-2)` — 25 new tests, metrics module
- `3e73c13` — `feat: implement observability collector and trace transports (story 8-1)` — collector, transports, redaction
- `7071d52` — `feat: implement visual transitions and accessibility for LiquidView (story 6-3)` — CSS transitions, ARIA, focus management
- `dc99fd3` — `feat: implement LiquidView component, FluiProvider, and spec renderer (story 6-1)` — React component patterns, context, rendering

**Files most recently modified in `@flui/react` (Story 6.3):**
- `packages/react/src/renderer/transitions.tsx` — crossfade with inline styles
- `packages/react/src/renderer/a11y.tsx` — ARIA live regions, focus management
- `packages/react/src/LiquidView.tsx` — state machine, trace logging
- `packages/react/src/index.ts` — barrel exports with types and values separated

**Implementation order established:** types → implementation → tests → barrel exports

### Testing Standards

- **Framework:** Vitest 4.0.18 with `jsdom` environment (React package)
- **React testing:** `@testing-library/react` 16.3.2
- **Test structure:** `describe('DebugOverlay') > describe('tab navigation') > it('specific behavior')`
- **Coverage:** >90% statement coverage required (configured in vitest.config.ts)
- **Import pattern:** Import from relative paths within same package, never from barrel in tests
- **Setup file:** `packages/react/src/test-setup.ts` — already mocks `window.matchMedia`
- **React rendering in tests:**
```typescript
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DebugOverlay } from './DebugOverlay';

// Create mock spec for testing
function createMockSpec(): UISpecification {
  return {
    version: '1.0',
    components: [
      {
        id: 'btn-1',
        componentType: 'Button',
        props: { label: 'Click me' },
        children: [],
      },
    ],
    layout: { type: 'stack', direction: 'vertical', gap: 8 },
    interactions: [
      { source: 'input-1', target: 'btn-1', event: 'onChange' },
    ],
    metadata: {
      generatedAt: Date.now(),
      model: 'gpt-4o',
      traceId: 'trace-123',
    },
  };
}

// Create mock trace for testing
function createMockTrace(): GenerationTrace {
  const trace = createTrace({ id: 'test-trace-1' });
  trace.addStep({
    module: 'intent-parser',
    operation: 'parseIntent',
    durationMs: 15,
    metadata: { intent: 'show user dashboard', type: 'text' },
  });
  trace.addStep({
    module: 'context-resolver',
    operation: 'resolveContext',
    durationMs: 5,
    metadata: { role: 'admin', device: 'desktop' },
  });
  trace.addStep({
    module: 'generation',
    operation: 'generateSpec',
    durationMs: 850,
    metadata: { model: 'gpt-4o', tokens: 1200 },
  });
  return trace;
}
```

- **Keyboard event testing:**
```typescript
import { fireEvent } from '@testing-library/react';

// Test tab switching with arrow keys
fireEvent.keyDown(screen.getByRole('tab', { name: 'Spec' }), { key: 'ArrowRight' });
expect(screen.getByRole('tab', { name: 'Trace' })).toHaveAttribute('aria-selected', 'true');
```

- **Accessibility assertion pattern:**
```typescript
// ARIA roles
expect(screen.getByRole('tablist')).toBeInTheDocument();
expect(screen.getAllByRole('tab')).toHaveLength(2);
expect(screen.getByRole('tabpanel')).toBeInTheDocument();

// ARIA attributes
const specTab = screen.getByRole('tab', { name: 'Spec' });
expect(specTab).toHaveAttribute('aria-selected', 'true');
expect(specTab).toHaveAttribute('aria-controls', 'flui-debug-panel-spec');
```

### Performance Considerations

- Component tree rendering: O(n) where n = total ComponentSpec nodes (typically < 50)
- Trace list rendering: O(t) where t = buffered traces (max 100 from collector)
- Trace filtering: O(t * s) where s = average steps per trace (typically < 20) — memoized with `useMemo`
- Intent search debounced at 200ms — prevents excessive re-filtering during typing
- `<details>` elements defer rendering of collapsed content (native browser optimization)
- JSON.stringify for props/metadata display: O(size of metadata object) — acceptable for debug tool
- No virtualization needed for 100-trace limit — simple list rendering is sufficient
- Bundle impact: estimated ~3-4KB for debug module (within @flui/react's 8KB budget)
- Fully tree-shakeable: if `DebugOverlay` is not imported, zero bytes added to production bundle

### Library/Framework Requirements

| Library | Version | Purpose | Already in package.json? |
|---------|---------|---------|-------------------------|
| react | ^19.0.0 | Peer dependency — components, hooks | Yes (peer) |
| react-dom | ^19.0.0 | Peer dependency | Yes (peer) |
| @flui/core | workspace:* | Type-only imports for UISpecification, GenerationTrace | Yes (peer) |
| @testing-library/react | 16.3.2 | Testing — render, screen, fireEvent | Yes (devDependencies) |
| vitest | 4.0.18 | Test runner | Yes (devDependencies) |

No new dependencies needed. The debug module is pure React with type imports from @flui/core.

### Project Structure Notes

- This story creates a new `debug/` module inside `packages/react/src/`
- Architecture specifies `debug/DebugOverlay.tsx`, `debug/SpecTab.tsx`, `debug/TraceTab.tsx` as the file structure
- All files follow existing naming: PascalCase for components, kebab-case for hooks, co-located tests
- No changes to `@flui/core` package
- No changes to build configuration (tsup/vitest) — existing config covers new files automatically
- New files are automatically included by `src/**/*.test.{ts,tsx}` test pattern in vitest.config.ts
- `sideEffects: false` must remain in package.json for tree-shaking

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.3] - User story, acceptance criteria, BDD scenarios
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 8] - Epic objectives: observability, developer tooling, testing package
- [Source: _bmad-output/planning-artifacts/prd.md#FR46] - Debug overlay Spec tab: display current UISpecification
- [Source: _bmad-output/planning-artifacts/prd.md#FR47] - Debug overlay Trace tab: display generation trace
- [Source: _bmad-output/planning-artifacts/prd.md#FR48] - Search and filter traces by timestamp, intent, context attributes
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-A4] - Debug overlay keyboard-navigable and screen-reader accessible
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-M1] - >90% test coverage for all packages
- [Source: _bmad-output/planning-artifacts/architecture.md#@flui/react Structure] - debug/ module file layout (DebugOverlay.tsx, SpecTab.tsx, TraceTab.tsx)
- [Source: _bmad-output/planning-artifacts/architecture.md#Module Dependencies] - @flui/react → @flui/core (peer), react + react-dom (peer)
- [Source: _bmad-output/planning-artifacts/architecture.md#Bundle Size Strategy] - @flui/react < 8KB gzipped (NFR-P7)
- [Source: packages/react/src/FluiProvider.tsx] - Context provider pattern reference
- [Source: packages/react/src/LiquidView.tsx] - Component pattern, state machine, trace logging reference
- [Source: packages/react/src/renderer/transitions.tsx] - Inline CSSProperties styling convention
- [Source: packages/react/src/renderer/a11y.tsx] - Accessibility patterns (ARIA, focus, visually hidden)
- [Source: packages/react/vitest.config.ts] - Testing config: jsdom, 90% coverage, test-setup.ts
- [Source: packages/core/src/spec/spec.types.ts] - UISpecification, ComponentSpec, InteractionSpec, LayoutSpec types
- [Source: packages/core/src/types.ts:90-115] - TraceStep, GenerationTrace interfaces
- [Source: packages/core/src/observe/observe.types.ts:7-10] - TraceTransport, ObservabilityCollector interfaces
- [Source: _bmad-output/implementation-artifacts/8-2-cost-and-cache-metrics-reporting.md] - Previous story intelligence
- [Source: _bmad-output/implementation-artifacts/8-1-observability-collector-and-trace-transports.md] - Observability collector patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- Fixed TypeScript `exactOptionalPropertyTypes` error in `DebugOverlay.tsx` — array indexing returns `T | undefined`, required narrowing check before `setActiveTab()` call
- Adapted test assertions to use native Vitest matchers (`.toBeTruthy()`, `.toBeNull()`, `.getAttribute()`) to keep debug module tests aligned with existing package assertion style
- Fixed timestamp filter test — replaced hardcoded datetime-local values with `Date.UTC()` for timezone-independent test assertions

### Completion Notes List

- Implemented complete debug overlay module in `packages/react/src/debug/` with 4 source files and 4 co-located test files
- `DebugOverlay` component: fixed-position panel with WAI-ARIA compliant tablist (Spec/Trace tabs), keyboard navigation (Arrow Left/Right wrapping), collapse/expand toggle with `aria-expanded`, configurable position (right/bottom)
- `SpecTab` component: displays UISpecification in structured tree view with metadata, recursive component tree (depth-based indentation, children count badges), layout properties, and interaction mappings; all sections collapsible via native `<details>/<summary>`
- `TraceTab` component: displays GenerationTrace list with filter bar — timestamp range (datetime-local inputs), intent substring search (debounced 200ms), context attribute key-value filter (dynamic dropdown from trace metadata); AND-combined filters with `useMemo` optimization
- `useFluidDebug` hook: manages open/closed state with Ctrl+Shift+D keyboard shortcut, provides toggle/open/close methods, cleans up keydown listener on unmount
- All styling uses inline `CSSProperties` objects following codebase convention (dark theme, monospace font)
- Zero new runtime dependencies; type-only imports from `@flui/core`
- 49 new tests across 4 test files; 96.31% statement coverage, 97.9% line coverage (exceeds >90% threshold)
- 178 total `@flui/react` tests pass (zero regressions); 642 `@flui/core` tests pass (zero regressions)
- TypeScript compilation clean for all new files
- Barrel exports updated: `packages/react/src/debug/index.ts` and `packages/react/src/index.ts`
- Code review fixes applied: `useFluidDebug` now returns `overlayProps` (including `isOpen` wiring and explicit `spec`/`traces` pass-through), matching the story contract
- Code review fixes applied: Spec metadata now renders the actual specification version instead of model
- Code review fixes applied: tab keyboard handling now moves focus into active panel content on Tab
- Code review fixes applied: trace steps are sorted chronologically when timestamp metadata exists, with stable fallback order
- Code review fixes applied: trace step list keys are now collision-resistant (`trace.id + module + operation + index`)

### Change Log

- 2026-02-27: Implemented debug overlay module (Story 8.3) — DebugOverlay, SpecTab, TraceTab components + useFluidDebug hook + 49 tests
- 2026-02-27: Addressed code review findings — fixed hook return contract, metadata version rendering, keyboard tab focus, trace step ordering, and key stability

### Senior Developer Review (AI)

- Reviewer: Fabrice
- Date: 2026-02-27
- Outcome: Changes Requested -> Fixed -> Approved
- Verified against ACs and tasks with direct code inspection and test execution
- Validation evidence:
  - `pnpm --filter @flui/react test -- src/debug` (pass)
  - `pnpm --filter @flui/react test:coverage -- src/debug` (pass, `src/debug` statements 93.78%)

### File List

**New files:**
- `packages/react/src/debug/debug.types.ts` — Type definitions (DebugOverlayProps, DebugTabId, TraceFilter)
- `packages/react/src/debug/use-fluid-debug.ts` — Hook for overlay state management and keyboard shortcut
- `packages/react/src/debug/DebugOverlay.tsx` — Main overlay shell with tab navigation and ARIA
- `packages/react/src/debug/SpecTab.tsx` — Spec display tab (component tree, metadata, layout, interactions)
- `packages/react/src/debug/TraceTab.tsx` — Trace display with timeline, filtering, and search
- `packages/react/src/debug/index.ts` — Debug module barrel exports
- `packages/react/src/debug/DebugOverlay.test.tsx` — 20 tests (rendering, keyboard, accessibility, collapse)
- `packages/react/src/debug/SpecTab.test.tsx` — 10 tests (empty state, tree rendering, metadata, interactions)
- `packages/react/src/debug/TraceTab.test.tsx` — 10 tests (empty state, filtering, accessibility)
- `packages/react/src/debug/use-fluid-debug.test.tsx` — 9 tests (state, toggle, keyboard shortcut, cleanup)

**Modified files:**
- `packages/react/src/index.ts` — Added debug module exports (types + values)
- `_bmad-output/implementation-artifacts/8-3-debug-overlay-spec-and-trace-tabs.md` — Updated story status and review record
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Synced story development status
