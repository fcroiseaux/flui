import { useMemo, useRef, useState } from 'react';

import type { ViewStateStore } from '../react.types';

/**
 * Creates a ViewStateStore that persists component state across regenerations.
 * State is keyed by ComponentSpec.id and survives regeneration for matching IDs.
 */
export function createViewStateStore(): ViewStateStore {
  const stateMap = new Map<string, Record<string, unknown>>();

  return {
    getState(componentId: string): Record<string, unknown> {
      return stateMap.get(componentId) ?? {};
    },

    setState(componentId: string, update: Record<string, unknown>): void {
      const existing = stateMap.get(componentId) ?? {};
      stateMap.set(componentId, { ...existing, ...update });
    },

    reconcile(newComponentIds: Set<string>): number {
      let cleaned = 0;
      for (const existingId of stateMap.keys()) {
        if (!newComponentIds.has(existingId)) {
          stateMap.delete(existingId);
          cleaned++;
        }
      }
      return cleaned;
    },

    getSnapshot(): Map<string, Record<string, unknown>> {
      return new Map(
        Array.from(stateMap.entries()).map(([k, v]) => [k, { ...v }]),
      );
    },
  };
}

/**
 * React hook that creates and manages a ViewStateStore with reactivity.
 * Uses ref + counter pattern: store persists across renders, setState triggers re-render.
 */
export function useViewState(): ViewStateStore {
  const storeRef = useRef(createViewStateStore());
  const [, setVersion] = useState(0);

  const store = useMemo<ViewStateStore>(() => ({
    getState: (componentId: string) => storeRef.current.getState(componentId),
    setState: (componentId: string, update: Record<string, unknown>) => {
      storeRef.current.setState(componentId, update);
      setVersion((v) => v + 1);
    },
    reconcile: (newComponentIds: Set<string>) => storeRef.current.reconcile(newComponentIds),
    getSnapshot: () => storeRef.current.getSnapshot(),
  }), []); // Stable reference — never recreated

  return store;
}
