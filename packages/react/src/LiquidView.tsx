import type { ComponentSpec, UISpecification } from '@flui/core';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFluiContext } from './FluiProvider';
import { useLiquidView } from './hooks';
import type { LiquidViewProps, RenderSpecOptions } from './react.types';
import {
  AriaLiveRegion,
  CrossfadeTransition,
  renderSpec,
  useFocusManagement,
  useInteractionStore,
} from './renderer';

/**
 * Recursively collects all component IDs from a component tree.
 */
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

/**
 * Derives a stable content key for the CrossfadeTransition.
 * Changes when the state status or spec identity changes.
 */
function deriveContentKey(status: string, spec: UISpecification | null): string {
  if (spec) {
    return `rendering-${spec.metadata.generatedAt}`;
  }
  return status;
}

/**
 * LiquidView renders LLM-generated UI specifications into React components.
 *
 * Requires a mandatory `fallback` prop that is rendered during loading, validation,
 * and error states. Must be placed within a FluiProvider.
 *
 * State progression: idle → generating → validating → rendering | error
 *
 * Supports crossfade transitions between spec changes with focus management
 * and ARIA live region announcements for accessibility.
 */
export function LiquidView({
  intent,
  context,
  data,
  fallback,
  onStateChange,
  onError,
  className,
  style,
  transition,
  ariaAnnouncement,
}: LiquidViewProps): ReactNode {
  const ctx = useFluiContext();
  const { state, viewStateStore } = useLiquidView(
    { intent, context, data, onStateChange, onError },
    ctx,
  );
  const renderingState = state.status === 'rendering' ? state : null;
  const currentSpec = renderingState?.spec ?? null;

  // Extract interactions and component IDs from the spec when in rendering state
  const interactions = renderingState?.spec.interactions ?? [];
  const componentIds = useMemo(
    () =>
      renderingState ? collectComponentIds(renderingState.spec.components) : new Set<string>(),
    [renderingState],
  );

  // Create interaction store — recreated when spec changes
  const interactionStore = useInteractionStore(interactions, componentIds);

  const loggedInteractionStoreRef = useRef<typeof interactionStore | null>(null);

  useEffect(() => {
    if (!renderingState) {
      return;
    }

    if (loggedInteractionStoreRef.current === interactionStore) {
      return;
    }

    loggedInteractionStoreRef.current = interactionStore;

    if (interactionStore.issues.length === 0) {
      return;
    }

    renderingState.trace.addStep({
      module: 'interaction-wiring',
      operation: 'wireInteractions',
      durationMs: 0,
      metadata: {
        totalInteractions: interactions.length,
        wiredSuccessfully: interactions.length - interactionStore.issues.length,
        skippedCount: interactionStore.issues.length,
        issues: interactionStore.issues.map((issue) => ({
          type: issue.type,
          componentId: issue.componentId,
          interactionIndex: issue.interactionIndex,
        })),
      },
    });
  }, [interactionStore, interactions.length, renderingState]);

  // Container ref for focus management
  const containerRef = useRef<HTMLDivElement>(null);

  // Track the previously focused component's data-flui-id before content swap
  const previousFocusedIdRef = useRef<string | null>(null);

  // Track whether a transition just completed (triggers focus management)
  const [transitionComplete, setTransitionComplete] = useState(false);

  // Capture the currently focused flui-id before content changes
  const prevStateStatusRef = useRef(state.status);
  useEffect(() => {
    if (state.status !== prevStateStatusRef.current) {
      // State is changing — capture current focus
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        const fluiId = document.activeElement
          .closest('[data-flui-id]')
          ?.getAttribute('data-flui-id');
        previousFocusedIdRef.current = fluiId ?? null;
      }
      prevStateStatusRef.current = state.status;
      setTransitionComplete(false);
      if (
        transition?.enabled === false &&
        (state.status === 'rendering' || state.status === 'error')
      ) {
        setTransitionComplete(true);
      }
    }
  }, [state.status, transition?.enabled]);

  // Also capture focus when spec changes within rendering state
  const prevSpecRef = useRef<UISpecification | null>(null);
  useEffect(() => {
    const currentSpec = renderingState?.spec ?? null;
    if (currentSpec !== prevSpecRef.current && prevSpecRef.current !== null) {
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        const fluiId = document.activeElement
          .closest('[data-flui-id]')
          ?.getAttribute('data-flui-id');
        previousFocusedIdRef.current = fluiId ?? null;
      }
      setTransitionComplete(false);
      if (
        transition?.enabled === false &&
        (state.status === 'rendering' || state.status === 'error')
      ) {
        setTransitionComplete(true);
      }
    }
    prevSpecRef.current = currentSpec;
  }, [renderingState?.spec, state.status, transition?.enabled]);

  const lastRenderedSpecRef = useRef<UISpecification | null>(null);
  useEffect(() => {
    if (currentSpec) {
      lastRenderedSpecRef.current = currentSpec;
    }
  }, [currentSpec]);

  const handleTransitionEnd = useCallback(() => {
    setTransitionComplete(true);
  }, []);

  // Focus management — runs after transition completes
  const transitionsEnabled = transition?.enabled !== false;
  const shouldFocus = transitionComplete;
  useFocusManagement(containerRef, previousFocusedIdRef.current, shouldFocus);

  // Build content based on state
  let content: ReactNode;
  switch (state.status) {
    case 'idle':
      content = null;
      break;
    case 'generating':
    case 'validating':
      content = fallback;
      break;
    case 'rendering': {
      const options: RenderSpecOptions = {
        interactionStore,
        focusTracking: true,
        viewStateStore,
      };
      content = renderSpec(state.spec, ctx.registry, options);
      break;
    }
    case 'error':
      content = fallback;
      break;
  }

  // Derive content key for transition detection
  const contentKey = deriveContentKey(state.status, currentSpec);

  // Transition config — defaults to enabled
  const transitionConfig = useMemo(
    () => ({ enabled: transition?.enabled !== false, ...transition }),
    [transition],
  );

  // ARIA announcement spec — only announce when in rendering state or error
  const announcementSpec =
    state.status === 'rendering'
      ? currentSpec
      : state.status === 'error'
        ? lastRenderedSpecRef.current
        : null;

  // Build AriaLiveRegion props — avoid passing undefined for exactOptionalPropertyTypes
  const ariaLiveProps: { spec: typeof announcementSpec; config?: typeof ariaAnnouncement } = {
    spec: announcementSpec,
  };
  if (ariaAnnouncement !== undefined) {
    ariaLiveProps.config = ariaAnnouncement;
  }

  return (
    <div ref={containerRef} className={className} style={style} data-flui-container="">
      {transitionConfig.enabled ? (
        <CrossfadeTransition
          content={content}
          contentKey={contentKey}
          config={transitionConfig}
          onTransitionEnd={handleTransitionEnd}
        />
      ) : (
        content
      )}
      <AriaLiveRegion {...ariaLiveProps} />
    </div>
  );
}
