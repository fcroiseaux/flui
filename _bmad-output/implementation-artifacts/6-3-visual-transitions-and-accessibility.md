# Story 6.3: Visual Transitions & Accessibility

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want smooth visual transitions between generated UIs with proper focus management and screen reader announcements,
so that UI changes feel polished and are accessible to all users including those using assistive technology.

## Acceptance Criteria

1. **Crossfade transition on spec replacement** (FR22): Given a LiquidView rendering a new specification replacing a previous one, when the transition occurs, then a crossfade animation smoothly transitions from the old UI to the new UI, and the transition does not cause layout shift or visual flicker.

2. **Focus management after transition** (NFR-A2): Given a spec transition, when the new UI renders, then focus is managed so it does not jump to document body. Focus placement follows this priority: (1) if the previously focused component still exists in the new spec (matched by `ComponentSpec.id`), return focus to it; (2) otherwise, place focus on the first focusable element in the new spec; (3) if no focusable element exists, place focus on the LiquidView container root element.

3. **ARIA live region announcements** (NFR-A5): Given a spec transition, when the new UI renders, then an ARIA live region announces the transition to assistive technology. The announcement is concise and informative (e.g., "Dashboard updated" not "UI specification version 3.2.1 rendered").

4. **Fallback transition** (FR22): Given a transition from rendering state to error/fallback state, when the fallback renders, then the same crossfade transition applies, and focus management and ARIA announcements function identically.

5. **Test coverage**: Co-located tests verify crossfade animation triggers, focus placement after transition, ARIA live region content, and fallback transition behavior. All tests pass with >90% coverage.

## Tasks / Subtasks

- [x] Task 1: Define transition and accessibility types (AC: #1, #2, #3, #4)
  - [x] 1.1 Add `TransitionConfig` interface to `react.types.ts`: `{ enabled?: boolean; durationMs?: number; timingFunction?: string }`
  - [x] 1.2 Add `TransitionState` type: `'idle' | 'entering' | 'exiting'`
  - [x] 1.3 Add `AriaAnnouncementConfig` interface: `{ politeness?: 'polite' | 'assertive'; formatMessage?: (spec: UISpecification) => string }`
  - [x] 1.4 Update `LiquidViewProps` to accept optional `transition?: TransitionConfig` and `ariaAnnouncement?: AriaAnnouncementConfig` props
  - [x] 1.5 Export all new types from `react.types.ts`

- [x] Task 2: Implement `transitions.tsx` — crossfade transition component (AC: #1, #4)
  - [x] 2.1 Create `packages/react/src/renderer/transitions.tsx`
  - [x] 2.2 Implement `CrossfadeTransition` component that wraps content with CSS-based crossfade
  - [x] 2.3 Use CSS opacity transitions (0→1 for entering, 1→0 for exiting) — no animation library dependency
  - [x] 2.4 Default duration: 200ms, configurable via `TransitionConfig.durationMs`
  - [x] 2.5 Default timing: `ease-in-out`, configurable via `TransitionConfig.timingFunction`
  - [x] 2.6 Use `position: relative` container with `position: absolute` overlapping layers during transition to prevent layout shift
  - [x] 2.7 Cleanup: remove exiting content from DOM after transition completes (via `transitionend` event)
  - [x] 2.8 When `transition.enabled === false`, render content directly without transition wrapper
  - [x] 2.9 Implement `useTransition()` hook that manages entering/exiting state for old and new content

- [x] Task 3: Implement `a11y.tsx` — focus management + ARIA live region (AC: #2, #3, #4)
  - [x] 3.1 Create `packages/react/src/renderer/a11y.tsx`
  - [x] 3.2 Implement `useFocusManagement(containerRef, previousFocusedId?, newComponentIds?)` hook
  - [x] 3.3 Focus priority logic: (1) find element matching previous focused `ComponentSpec.id` via `[data-flui-id]` attribute; (2) find first focusable element within container; (3) focus the container root (set `tabIndex={-1}` on container if needed)
  - [x] 3.4 Use `requestAnimationFrame` to schedule focus after paint to avoid race conditions with React rendering
  - [x] 3.5 Implement `AriaLiveRegion` component: renders a visually-hidden `<div role="status" aria-live="polite">` with announcement text
  - [x] 3.6 Default announcement: extract from `spec.metadata?.title` if available, else "Content updated"
  - [x] 3.7 Custom announcement: use `AriaAnnouncementConfig.formatMessage(spec)` if provided
  - [x] 3.8 Clear announcement after 1 second to avoid stale screen reader content
  - [x] 3.9 Visually-hidden styles: `position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap`

- [x] Task 4: Integrate transitions into `LiquidView.tsx` (AC: #1, #2, #3, #4)
  - [x] 4.1 Wrap the content switch with `CrossfadeTransition` component
  - [x] 4.2 Track the previously rendered content to show during exiting phase
  - [x] 4.3 Add `containerRef` via `useRef` on the wrapper div for focus management
  - [x] 4.4 Always render wrapper `<div>` (remove conditional wrapper logic) — needed as anchor for transitions, focus, and ARIA live region
  - [x] 4.5 Add `data-flui-id={spec.id}` attribute on rendered components for focus tracking (update `spec-renderer.tsx` `renderComponentSpec` to add this attribute)
  - [x] 4.6 Call `useFocusManagement` after transition completes
  - [x] 4.7 Track `previousFocusedId` by reading `document.activeElement`'s closest `[data-flui-id]` before content swap
  - [x] 4.8 Render `AriaLiveRegion` inside the container for transition announcements
  - [x] 4.9 Same crossfade applies when transitioning to fallback on error (rendering → error state change)

- [x] Task 5: Update `spec-renderer.tsx` — add `data-flui-id` attributes (AC: #2)
  - [x] 5.1 Add `data-flui-id={spec.id}` to the props passed to rendered components for focus tracking
  - [x] 5.2 Ensure backward-compatible: only add when rendering within a transition context

- [x] Task 6: Update barrel exports (AC: all)
  - [x] 6.1 Update `packages/react/src/renderer/index.ts` to export `CrossfadeTransition`, `useFocusManagement`, `AriaLiveRegion`
  - [x] 6.2 Update `packages/react/src/index.ts` to export new public types: `TransitionConfig`, `TransitionState`, `AriaAnnouncementConfig`
  - [x] 6.3 Verify TypeScript compilation succeeds with all new exports

- [x] Task 7: Write comprehensive tests (AC: #1, #2, #3, #4, #5)
  - [x] 7.1 Create `packages/react/src/renderer/transitions.test.tsx`:
    - Test crossfade renders new content with opacity transition
    - Test old content fades out while new content fades in
    - Test no layout shift: container maintains dimensions during transition
    - Test exiting content removed from DOM after transition completes
    - Test `transition.enabled = false` renders without transition wrapper
    - Test configurable duration and timing function
    - Test transition from rendering to fallback content
  - [x] 7.2 Create `packages/react/src/renderer/a11y.test.tsx`:
    - Test focus returns to same component (by ID) after transition
    - Test focus moves to first focusable element when previous component gone
    - Test focus moves to container root when no focusable elements
    - Test focus does NOT jump to document body (NFR-A2)
    - Test ARIA live region appears with correct `role` and `aria-live` attributes
    - Test announcement text uses `spec.metadata.title` when available
    - Test announcement text uses "Content updated" as default
    - Test custom `formatMessage` generates expected announcement
    - Test announcement clears after timeout
  - [x] 7.3 Update `packages/react/src/LiquidView.test.tsx`:
    - Test crossfade transition triggers on spec change
    - Test focus management after transition
    - Test ARIA announcement on transition
    - Test fallback transition on error
    - Test transitions disabled via config
    - Test backward compatibility: LiquidView without transition props works as before
  - [x] 7.4 Verify `spec-renderer.test.tsx` still passes with `data-flui-id` addition
  - [x] 7.5 All tests pass with >90% statement coverage

## Dev Notes

### Architecture Compliance

**Package:** `@flui/react` — extending the React adapter implemented in Stories 6.1 and 6.2

**New files (architecture-specified):**
```
packages/react/src/renderer/
  ├── transitions.tsx              # Crossfade transitions (ADR-009)
  ├── a11y.tsx                     # Focus management + ARIA (ADR-014)
  ├── transitions.test.tsx         # Transition tests
  └── a11y.test.tsx                # Accessibility tests
```

**Modified files:**
```
packages/react/src/
  ├── react.types.ts               # Add TransitionConfig, TransitionState, AriaAnnouncementConfig
  ├── renderer/spec-renderer.tsx   # Add data-flui-id attribute to rendered components
  ├── renderer/index.ts            # Export new modules
  ├── LiquidView.tsx               # Integrate transitions, focus management, ARIA live region
  ├── index.ts                     # Export new public types
  ├── LiquidView.test.tsx          # Extended tests
  └── renderer/spec-renderer.test.tsx # Verify data-flui-id compatibility
```

**Do NOT create these files** (they belong to future stories):
- `renderer/data-resolver.tsx` — async data fetching (Epic 4 already handled data resolution in core)
- `debug/` directory — debug overlay (Epic 8)
- `hooks/use-fluid-debug.ts` — debug hook (Epic 8)
- `hooks/use-fluid-context.ts` — context hook (not in current epic)

**Package dependency rules (unchanged from 6.1, 6.2):**
- `@flui/react` → `@flui/core` (peer), `react` + `react-dom` (peer)
- Import from `@flui/core` barrel only: `import { type UISpecification, ... } from '@flui/core'`
- NEVER import internal `@flui/core` module files directly
- Zero awareness of specific LLM providers or state management libraries
- **Zero animation library dependencies** — use CSS transitions only (opacity + position)

### Implementation Patterns (MUST follow)

**CSS-only crossfade approach (no external deps):**

The crossfade uses CSS `opacity` transitions with absolute positioning to overlay old/new content during the transition period. This avoids adding any animation library dependency and keeps the bundle minimal.

```typescript
// CrossfadeTransition component structure
interface CrossfadeTransitionProps {
  content: ReactNode;
  contentKey: string | number; // Changes when content changes (e.g., spec version or state)
  config: TransitionConfig;
  onTransitionEnd?: () => void;
}

// Internal state tracks: { current: ReactNode, previous: ReactNode | null, phase: 'idle' | 'transitioning' }
// When contentKey changes:
//   1. Save current content as "previous"
//   2. Set new content as "current"
//   3. Start transition: previous fades out (opacity 1→0), current fades in (opacity 0→1)
//   4. On transitionend: remove previous from DOM, set phase to 'idle'

// Container CSS during transition:
const containerStyle: CSSProperties = {
  position: 'relative',
};

// Layer CSS:
const enteringStyle: CSSProperties = {
  opacity: 0,
  transition: `opacity ${durationMs}ms ${timingFunction}`,
};
const enteringActiveStyle: CSSProperties = {
  opacity: 1,
};
const exitingStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  opacity: 1,
  transition: `opacity ${durationMs}ms ${timingFunction}`,
};
const exitingActiveStyle: CSSProperties = {
  opacity: 0,
};
```

**Focus management pattern:**

```typescript
// Focus priority logic (runs after transition completes)
function manageFocus(
  containerRef: RefObject<HTMLElement>,
  previousFocusedId: string | null,
): void {
  const container = containerRef.current;
  if (!container) return;

  requestAnimationFrame(() => {
    // Priority 1: Return focus to same component by data-flui-id
    if (previousFocusedId) {
      const sameElement = container.querySelector(
        `[data-flui-id="${previousFocusedId}"]`
      );
      if (sameElement instanceof HTMLElement) {
        sameElement.focus();
        return;
      }
    }

    // Priority 2: First focusable element
    const focusable = container.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable) {
      focusable.focus();
      return;
    }

    // Priority 3: Container root
    if (!container.hasAttribute('tabindex')) {
      container.setAttribute('tabindex', '-1');
    }
    container.focus();
  });
}
```

**ARIA live region pattern:**

```typescript
// Visually hidden but accessible to screen readers
const visuallyHiddenStyle: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: 0,
};

// AriaLiveRegion component
function AriaLiveRegion({
  message,
  politeness = 'polite',
}: {
  message: string;
  politeness?: 'polite' | 'assertive';
}): ReactNode {
  return createElement('div', {
    role: 'status',
    'aria-live': politeness,
    'aria-atomic': 'true',
    style: visuallyHiddenStyle,
  }, message);
}
```

**LiquidView integration approach:**

```typescript
// In LiquidView.tsx, the wrapper div is ALWAYS rendered (not conditional)
// This is required as anchor for:
// - Transition container (position: relative)
// - Focus management (containerRef)
// - ARIA live region

// Track previous focused component ID before content swap:
const previousFocusedIdRef = useRef<string | null>(null);

// Before content changes:
const activeEl = document.activeElement;
if (activeEl instanceof HTMLElement) {
  const fluiId = activeEl.closest('[data-flui-id]')?.getAttribute('data-flui-id');
  previousFocusedIdRef.current = fluiId ?? null;
}
```

**Data attribute on rendered components:**

```typescript
// In renderComponentSpec, add data-flui-id for focus tracking:
return createElement(
  Component,
  { ...mergedProps, key: spec.key ?? spec.id, 'data-flui-id': spec.id },
  children
);
```

### Error Handling

No new `FluiError` codes needed for this story. Transitions and accessibility are purely UI concerns:
- If `transitionend` event doesn't fire (rare edge case) → set a timeout fallback (durationMs + 50ms) to cleanup exiting content
- If `document.activeElement` is null or not within container → skip to priority 2/3 in focus management
- If `spec.metadata?.title` is undefined → use default "Content updated" announcement

Edge cases to handle:
- Rapid successive transitions: if a new transition starts before the previous one completes, immediately finalize the previous transition (skip to end state) and start the new one
- Transition during unmount: cleanup all timers and event listeners in useEffect cleanup
- Empty components array: still apply focus management (focus container root)
- Server-side rendering: check `typeof document !== 'undefined'` before accessing `document.activeElement`
- `prefers-reduced-motion` media query: respect user preference — skip opacity animation and render immediately if the user prefers reduced motion

### Existing Code to Reuse (DO NOT reinvent)

| What | Where | How to use |
|------|-------|------------|
| `UISpecification` type | `@flui/core` barrel | Has `metadata?.title` for ARIA announcements |
| `ComponentSpec` type | `@flui/core` barrel | Has `id` field for focus tracking |
| `renderSpec()` | `renderer/spec-renderer.tsx` | Already renders components — add `data-flui-id` |
| `useLiquidView()` | `hooks/use-liquid-view.ts` | Already manages state transitions — DO NOT modify |
| `LiquidView` component | `LiquidView.tsx` | Integrate transitions, focus, ARIA here |
| `ViewStateStore` | `renderer/view-state.ts` | Unchanged — view state persists independently |
| `InteractionStore` | `renderer/interaction-wiring.ts` | Unchanged — interaction wiring is independent |
| `FluiProvider` / `useFluiContext` | `FluiProvider.tsx` | Unchanged — provides registry and config |
| Test setup | `test-setup.ts` | Existing cleanup + RTL configuration |
| `collectComponentIds` | `LiquidView.tsx` | Already extracts component IDs recursively |

### Design Decisions

**CSS transitions over animation libraries:** No Framer Motion, React Spring, or other animation deps. CSS `opacity` transitions are sufficient for crossfade, add zero bundle size, and work across all React 18+ environments. The `@flui/react` bundle budget is < 8KB gzipped (current: ~5.49 KB).

**Always-present wrapper div:** LiquidView now ALWAYS renders a wrapper `<div>` (not conditional). This is required as a stable anchor for transitions (position: relative), focus management (ref), and the ARIA live region. The existing conditional wrapper logic (`if (className || style)`) is replaced.

**`data-flui-id` attribute:** Added to every rendered component for focus tracking across transitions. This is a passthrough prop — if the underlying component doesn't support it, it naturally falls through to the DOM element (React handles this for native elements, custom components may ignore it).

**Focus management runs after transition:** Focus is not moved during the crossfade — it's applied after the entering content is fully visible. This prevents confusing screen reader behavior where focus jumps while content is still animating.

**ARIA announcement via `role="status" aria-live="polite"`:** Uses `polite` by default (waits for screen reader to finish current announcement). The `assertive` option is available but not default because transitions are not urgent.

**`prefers-reduced-motion` support:** When the user has `prefers-reduced-motion: reduce` set, the transition is instant (no opacity animation). This is checked via `window.matchMedia('(prefers-reduced-motion: reduce)')`.

**Transition disabled by default:** The `transition.enabled` prop defaults to `true` (transitions are on by default). Set `transition={{ enabled: false }}` to disable.

### Project Structure Notes

- Stories 6.1 and 6.2 established the `@flui/react` package — this story extends it
- Existing test infrastructure (Vitest + jsdom + RTL + cleanup) is fully set up
- All test files are co-located: `{source}.test.ts(x)` in the same directory
- Architecture specifies `transitions.tsx` (JSX needed for rendering transition wrapper)
- Architecture specifies `a11y.tsx` (JSX needed for ARIA live region component)
- The renderer barrel (`renderer/index.ts`) currently exports `renderSpec`, `createInteractionStore`, `useInteractionStore`, `createViewStateStore`, `useViewState`
- No changes to `@flui/core` package in this story — all work is in `@flui/react`
- No new dependencies needed — CSS transitions only

### Previous Story Intelligence

**From Story 6-2 (Interaction Wiring & View State Management — DONE):**
- `renderSpec(spec, registry, options?)` accepts `RenderSpecOptions` — extend `renderComponentSpec` to add `data-flui-id`
- `LiquidView` already uses `useRef` for `loggedInteractionStoreRef` — follow same pattern for `containerRef` and `previousFocusedIdRef`
- `useMemo` used for `componentIds` extraction — follow for transition config memoization
- The wrapper `<div>` was conditional (`if (className || style)`) — this story changes it to always render
- `useEffect` used for interaction store logging — follow same pattern for focus management timing
- `viewStateStore` persists across regenerations — transitions do not affect view state
- `interactionStore` is recreated per spec — transitions should not interfere with interaction wiring
- 91 react tests, 94.49% coverage — maintain zero regressions
- Bundle size: ~5.49 KB gzipped — ~2.5 KB headroom for transitions + a11y

**From Story 6-2 debug notes:**
- DOM cleanup between RTL tests is critical — already handled by `test-setup.ts`
- `vi.fn()` mocks used extensively for callbacks — follow for `onTransitionEnd`
- `waitFor()` used for async state transitions — will be needed for transition completion testing
- `act()` used for synchronous state updates — will be needed for focus management testing
- `fireEvent` available from RTL — use for simulating `transitionend` events

**From Story 6-1 (LiquidView Component & Fallback Rendering — DONE):**
- `LiquidView` state machine: idle → generating → validating → rendering | error
- Fallback renders during generating, validating, and error states
- `state.status === 'rendering'` is when the spec is available
- `createElement` used (not JSX) in spec-renderer — transitions file uses JSX since it has `.tsx` extension
- `registry.getByName()` is the correct method for component lookup

### Git Intelligence

**Recent commit patterns:**
- `a9d0909` — `feat: implement interaction wiring and view state management (story 6-2)` (latest)
- `dc99fd3` — `feat: implement LiquidView component, FluiProvider, and spec renderer (story 6-1)`
- All commits follow: `feat: implement <description> (story X-Y)`
- Implementation order: types → implementation → tests → barrel exports
- Zero regressions maintained across all stories

**Files most recently modified in `@flui/react`:**
- All renderer files modified in Story 6-2
- `pnpm-lock.yaml` — no changes expected (no new deps)

### Testing Standards

- **Framework:** Vitest 4.0.18 with `jsdom` environment
- **React testing:** `@testing-library/react` 16.3.2 — `render()`, `screen`, `waitFor`, `act`, `fireEvent`
- **Test structure:** `describe('ModuleName') > describe('feature') > it('specific behavior')`
- **Coverage:** >90% statement coverage required
- **Mock pattern:** Use `vi.fn()` for callbacks, create test components with `React.createElement`
- **Async tests:** Use `waitFor()` for state transitions, `act()` for synchronous state updates
- **Import pattern:** Import from `@flui/core` barrel, never internal modules

**Testing transitions in jsdom:**
- `jsdom` does NOT support CSS transitions natively — `transitionend` events must be manually fired
- Use `fireEvent(element, new Event('transitionend'))` to simulate transition completion
- Use `vi.useFakeTimers()` for timeout-based cleanup testing
- Test `prefers-reduced-motion` via mocking `window.matchMedia`

```typescript
// Mock matchMedia for reduced-motion tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});
```

### Performance Considerations

- CSS transitions are GPU-accelerated (opacity is a compositor property) — zero layout thrashing
- `requestAnimationFrame` for focus management — avoids forced synchronous layout
- Transition cleanup via `transitionend` event — no polling or timers during normal operation
- Fallback timeout (durationMs + 50ms) only fires if `transitionend` is missed — defensive, not primary
- ARIA announcement cleanup via setTimeout(1000ms) — negligible overhead
- Bundle size impact: ~0.5-1 KB for transitions.tsx + a11y.tsx (well within 2.5 KB headroom)
- No additional runtime dependencies — pure React + CSS

### Library/Framework Requirements

| Library | Version | Purpose | Already in package.json? |
|---------|---------|---------|-------------------------|
| `react` | >=18.0.0 | Core React (peer dep) | Yes (peer) |
| `react-dom` | >=18.0.0 | React DOM rendering (peer dep) | Yes (peer) |
| `@flui/core` | workspace:* | Core types and pipeline (peer dep) | Yes (peer) |
| `@testing-library/react` | 16.3.2 | Component testing | Yes (devDep) |
| `@testing-library/jest-dom` | ^6.6.3 | DOM assertion matchers | Yes (devDep) |
| `jsdom` | ^26.1.0 | DOM environment for Vitest | Yes (devDep) |

No new dependencies needed for this story.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.3] - User story, acceptance criteria, BDD scenarios
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 6] - Epic objectives: rendering, interaction, transitions, accessibility
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture — React Adapter] - transitions.tsx, a11y.tsx file placement
- [Source: _bmad-output/planning-artifacts/architecture.md#Loading State Pattern] - LiquidViewState 5-state machine
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-009] - Crossfade transitions, latency UX strategy
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-014] - Focus management, ARIA live regions
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Directory Structure] - packages/react/src/renderer/ layout
- [Source: _bmad-output/planning-artifacts/architecture.md#Module Boundary Rules] - No React in core, adapter bridges them
- [Source: _bmad-output/planning-artifacts/architecture.md#Import Pattern] - Import from barrel files only
- [Source: _bmad-output/planning-artifacts/prd.md#FR22] - Apply visual transitions when replacing one generated UI with another
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-A2] - Focus management across spec transitions
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-A5] - ARIA live region announcements for spec transitions
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-P7] - @flui/react bundle < 8KB gzipped
- [Source: packages/core/src/spec/spec.types.ts#UISpecification] - { version, components, layout, interactions, metadata }
- [Source: packages/core/src/spec/spec.types.ts#ComponentSpec] - { id, componentType, props, key?, children? }
- [Source: packages/react/src/LiquidView.tsx] - Current component with conditional wrapper and state switch
- [Source: packages/react/src/react.types.ts] - Current type definitions
- [Source: packages/react/src/renderer/spec-renderer.tsx] - Current renderSpec and renderComponentSpec
- [Source: packages/react/src/renderer/index.ts] - Current renderer barrel exports
- [Source: packages/react/src/index.ts] - Current package barrel exports
- [Source: _bmad-output/implementation-artifacts/6-2-interaction-wiring-and-view-state-management.md] - Previous story intelligence

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- Fixed `window.matchMedia` not available in jsdom — added mock to `test-setup.ts`
- Fixed `CSS.escape` not available in jsdom — replaced with manual string escaping in `a11y.tsx`
- Fixed `exactOptionalPropertyTypes` TypeScript strictness for `AriaLiveRegion` config prop and `TransitionConfig` spread
- Updated existing LiquidView tests to account for always-present wrapper `<div>` (replacing conditional wrapper logic)
- Updated existing test for fallback removal to handle crossfade overlap where both old and new content exist briefly
- `spec.metadata.title` is not a direct field on `UISpecificationMetadata` — used `spec.metadata.custom?.title` instead

### Completion Notes List

- Implemented CSS-only crossfade transitions (no animation library dependency) with configurable duration and timing
- Implemented focus management with 3-priority logic: same component → first focusable → container root
- Implemented ARIA live region with polite/assertive modes and auto-clear after 1 second
- Integrated transitions, focus management, and ARIA announcements into LiquidView
- LiquidView now always renders a wrapper `<div data-flui-container>` as anchor for transitions, focus, and ARIA
- Added optional `focusTracking` render option so `data-flui-id` is only injected in transition/focus-tracking context
- Supports `prefers-reduced-motion` media query — instant rendering when user prefers reduced motion
- Rapid successive transitions handled: previous transition finalized immediately when new one starts
- Fallback timeout (durationMs + 50ms) ensures cleanup even if `transitionend` event doesn't fire
- Full test suite: 127 tests pass (36 new), 94.53% statement coverage, zero regressions across all packages
- No new dependencies added — pure CSS transitions + React hooks

### File List

**New files:**
- `packages/react/src/renderer/transitions.tsx` — CrossfadeTransition component with CSS opacity transitions
- `packages/react/src/renderer/a11y.tsx` — useFocusManagement hook and AriaLiveRegion component
- `packages/react/src/renderer/transitions.test.tsx` — 16 tests for crossfade transitions
- `packages/react/src/renderer/a11y.test.tsx` — 15 tests for focus management and ARIA live region

**Modified files:**
- `packages/react/src/react.types.ts` — Added TransitionConfig, TransitionState, AriaAnnouncementConfig interfaces; updated LiquidViewProps
- `packages/react/src/LiquidView.tsx` — Integrated CrossfadeTransition, useFocusManagement, AriaLiveRegion; always-present wrapper div
- `packages/react/src/renderer/spec-renderer.tsx` — Added conditional `data-flui-id` injection behind `focusTracking` option
- `packages/react/src/renderer/index.ts` — Exported CrossfadeTransition, useFocusManagement, AriaLiveRegion
- `packages/react/src/index.ts` — Exported new public types and components
- `packages/react/src/test-setup.ts` — Added window.matchMedia mock for jsdom
- `packages/react/src/LiquidView.test.tsx` — Updated existing tests for new wrapper behavior; added 5 new transition integration tests
- `packages/react/src/renderer/spec-renderer.test.tsx` — Added coverage for conditional `data-flui-id` behavior
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Synced story status from review to done

### Senior Developer Review (AI)

- Date: 2026-02-26
- Reviewer: Fabrice
- Outcome: Approve
- Fixed during review:
  - Crossfade now correctly animates exiting content from opacity 1 → 0
  - Focus management now runs when transitions are disabled (after content updates)
  - Error/fallback transitions now announce via ARIA live region using latest rendered spec context
  - `data-flui-id` is now conditional to focus-tracking context (aligned with task 5.2)
  - Story file list now matches changed implementation files

### Change Log

- 2026-02-26: Implemented visual transitions and accessibility (Story 6.3) — CrossfadeTransition component, useFocusManagement hook, AriaLiveRegion component, data-flui-id attributes, LiquidView integration. 127 tests pass, 94.53% statement coverage, zero regressions.
- 2026-02-26: Code review fixes applied — corrected exiting fade behavior, restored focus handling when transitions are disabled, fixed fallback ARIA announcement behavior, made `data-flui-id` conditional by render context, and updated test/documentation alignment.
