import type { ComponentSpec } from '@flui/core';
import { type ReactNode, useEffect, useMemo, useRef } from 'react';

import { useFluiContext } from './FluiProvider';
import { useLiquidView } from './hooks';
import type { LiquidViewProps, RenderSpecOptions } from './react.types';
import { renderSpec, useInteractionStore } from './renderer';

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
 * LiquidView renders LLM-generated UI specifications into React components.
 *
 * Requires a mandatory `fallback` prop that is rendered during loading, validation,
 * and error states. Must be placed within a FluiProvider.
 *
 * State progression: idle → generating → validating → rendering | error
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
}: LiquidViewProps): ReactNode {
  const ctx = useFluiContext();
  const { state, viewStateStore } = useLiquidView(
    { intent, context, data, onStateChange, onError },
    ctx,
  );
  const renderingState = state.status === 'rendering' ? state : null;

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

  // Log interaction issues to trace (if any)
  // Issues are logged during creation, accessible via interactionStore.issues

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
        viewStateStore,
      };
      content = renderSpec(state.spec, ctx.registry, options);
      break;
    }
    case 'error':
      content = fallback;
      break;
  }

  if (className || style) {
    return (
      <div className={className} style={style}>
        {content}
      </div>
    );
  }

  return content;
}
