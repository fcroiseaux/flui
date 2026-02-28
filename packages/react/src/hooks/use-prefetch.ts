import { type FluiError, isError, type PrefetchStatus } from '@flui/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFluiContext } from '../FluiProvider';
import type { UsePrefetchOptions, UsePrefetchResult } from '../react.types';

/**
 * React hook for prefetching LLM-generated UI specs in the background.
 * Ties prefetch lifecycle to component mount/unmount and dependency changes.
 */
export function usePrefetch(options: UsePrefetchOptions): UsePrefetchResult {
  const { intent, context, authorizedDataIdentifiers, enabled = true } = options;
  const ctx = useFluiContext();
  const instance = ctx.instance;

  const [status, setStatus] = useState<PrefetchStatus>('idle');
  const [error, setError] = useState<FluiError | undefined>(undefined);
  const controllerRef = useRef<AbortController | null>(null);

  // F4: Track mounted state to prevent state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Stable cancel callback
  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  // F12: Stabilize object reference deps via JSON serialization
  const contextKey = useMemo(
    () => (context !== undefined ? JSON.stringify(context) : undefined),
    [context],
  );
  const dataIdsKey = useMemo(
    () => (authorizedDataIdentifiers !== undefined ? JSON.stringify(authorizedDataIdentifiers) : undefined),
    [authorizedDataIdentifiers],
  );

  useEffect(() => {
    if (!intent || !enabled || !instance) {
      setStatus('idle');
      setError(undefined);
      return;
    }

    // Abort previous prefetch
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setStatus('in-flight');
    setError(undefined);

    instance
      .prefetch({
        intent,
        context,
        authorizedDataIdentifiers,
        signal: controller.signal,
      })
      .then((result) => {
        // F4: Guard against state updates after unmount or abort
        if (controller.signal.aborted || !mountedRef.current) return;

        if (isError(result)) {
          setStatus('failed');
          setError(result.error);
        } else {
          setStatus('cached');
          setError(undefined);
        }
      });

    return () => {
      controller.abort();
    };
    // F12: Use serialized keys for stable deps instead of raw object references
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent, contextKey, dataIdsKey, enabled, instance]);

  return { status, error, cancel };
}
