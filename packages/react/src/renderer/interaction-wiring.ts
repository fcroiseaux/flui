import type { InteractionSpec } from '@flui/core';
import { useMemo, useRef, useState } from 'react';

import type { InteractionIssue, InteractionStore } from '../react.types';

/**
 * Extracts event data from a handler argument.
 * React SyntheticEvent-like objects: extract target.value.
 * Primitives/objects: use as-is.
 */
function extractEventData(arg: unknown): unknown {
  if (arg && typeof arg === 'object' && 'target' in arg) {
    const target = (arg as { target: unknown }).target;
    if (target && typeof target === 'object' && 'value' in target) {
      return (target as { value: unknown }).value;
    }
  }
  return arg;
}

/**
 * Creates an InteractionStore that wires data flow between components.
 *
 * Parses InteractionSpec array, validates source/target existence,
 * and builds handler maps for source components and derived props for target components.
 */
export function createInteractionStore(
  interactions: InteractionSpec[],
  componentIds: Set<string>,
  onIssue?: (issue: InteractionIssue) => void,
): InteractionStore {
  const issues: InteractionIssue[] = [];
  const sourceToInteractions = new Map<string, InteractionSpec[]>();
  const targetState = new Map<string, Record<string, unknown>>();

  // Notify callback for store state changes (used by hook for reactivity)
  let onChange: (() => void) | undefined;

  // Parse and validate interactions
  for (let i = 0; i < interactions.length; i++) {
    const interaction = interactions[i]!;

    if (!componentIds.has(interaction.source)) {
      const issue: InteractionIssue = {
        type: 'missing-source',
        interactionIndex: i,
        componentId: interaction.source,
      };
      issues.push(issue);
      onIssue?.(issue);
      continue;
    }

    if (!componentIds.has(interaction.target)) {
      const issue: InteractionIssue = {
        type: 'missing-target',
        interactionIndex: i,
        componentId: interaction.target,
      };
      issues.push(issue);
      onIssue?.(issue);
      continue;
    }

    // Register this interaction for the source component
    const existing = sourceToInteractions.get(interaction.source) ?? [];
    existing.push(interaction);
    sourceToInteractions.set(interaction.source, existing);

    // Initialize target state if not present
    if (!targetState.has(interaction.target)) {
      targetState.set(interaction.target, {});
    }
  }

  function updateTargetState(targetId: string, props: Record<string, unknown>): void {
    const current = targetState.get(targetId) ?? {};
    targetState.set(targetId, { ...current, ...props });
    onChange?.();
  }

  function createSourceHandler(
    interaction: InteractionSpec,
  ): (...args: unknown[]) => void {
    return (...args: unknown[]) => {
      const eventData = extractEventData(args[0]);
      const mappedProps: Record<string, unknown> = {};

      if (interaction.dataMapping && Object.keys(interaction.dataMapping).length > 0) {
        for (const [sourceField, targetProp] of Object.entries(interaction.dataMapping)) {
          mappedProps[targetProp] =
            typeof eventData === 'object' && eventData !== null
              ? (eventData as Record<string, unknown>)[sourceField]
              : eventData;
        }
      } else {
        mappedProps['data'] = eventData;
      }

      updateTargetState(interaction.target, mappedProps);
    };
  }

  const store: InteractionStore & { _setOnChange(fn: () => void): void } = {
    getTargetProps(componentId: string): Record<string, unknown> {
      return targetState.get(componentId) ?? {};
    },

    getSourceHandlers(componentId: string): Record<string, (...args: unknown[]) => void> {
      const interactionsForSource = sourceToInteractions.get(componentId);
      if (!interactionsForSource) return {};

      const handlers: Record<string, (...args: unknown[]) => void> = {};
      for (const interaction of interactionsForSource) {
        const handler = createSourceHandler(interaction);
        const eventName = interaction.event;

        if (handlers[eventName]) {
          // Multiple interactions on same event: compose handlers
          const previousHandler = handlers[eventName]!;
          handlers[eventName] = (...args: unknown[]) => {
            previousHandler(...args);
            handler(...args);
          };
        } else {
          handlers[eventName] = handler;
        }
      }

      return handlers;
    },

    issues,

    _setOnChange(fn: () => void): void {
      onChange = fn;
    },
  };

  return store;
}

/**
 * React hook that creates and manages an InteractionStore with reactivity.
 * Recreated when interactions or componentIds change.
 */
export function useInteractionStore(
  interactions: InteractionSpec[],
  componentIds: Set<string>,
  onIssue?: (issue: InteractionIssue) => void,
): InteractionStore {
  const storeRef = useRef<InteractionStore | null>(null);
  const [, setVersion] = useState(0);
  const onIssueRef = useRef(onIssue);
  onIssueRef.current = onIssue;

  const store = useMemo(() => {
    const newStore = createInteractionStore(
      interactions,
      componentIds,
      (issue) => onIssueRef.current?.(issue),
    );
    storeRef.current = newStore;

    // Wire reactivity: when interaction data propagates, trigger re-render
    (newStore as unknown as { _setOnChange(fn: () => void): void })._setOnChange(() => {
      setVersion((v) => v + 1);
    });

    return newStore;
  }, [interactions, componentIds]);

  return store;
}
