import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { TransitionConfig } from '../react.types';

const DEFAULT_DURATION_MS = 200;
const DEFAULT_TIMING_FUNCTION = 'ease-in-out';
/** Safety fallback margin beyond transition duration to ensure cleanup */
const FALLBACK_TIMEOUT_MARGIN_MS = 50;

interface TransitionPhase {
  current: ReactNode;
  previous: ReactNode | null;
  transitioning: boolean;
}

/**
 * Props for the CrossfadeTransition component.
 */
export interface CrossfadeTransitionProps {
  /** The content to render. */
  content: ReactNode;
  /** Key that changes when content changes (e.g., spec version or state identity). */
  contentKey: string | number;
  /** Transition configuration. */
  config: TransitionConfig;
  /** Callback invoked when the transition completes. */
  onTransitionEnd?: () => void;
}

/**
 * Checks whether the user prefers reduced motion via the
 * `prefers-reduced-motion: reduce` media query.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * CrossfadeTransition renders a CSS-based crossfade between old and new content.
 *
 * When `contentKey` changes, the previous content fades out (opacity 1→0) while the
 * new content fades in (opacity 0→1). During the transition, both layers are overlapped
 * using absolute positioning to prevent layout shift.
 *
 * If `config.enabled === false`, content is rendered directly without transition.
 * If the user prefers reduced motion, transitions are instant.
 */
export function CrossfadeTransition({
  content,
  contentKey,
  config,
  onTransitionEnd,
}: CrossfadeTransitionProps): ReactNode {
  const durationMs = config.durationMs ?? DEFAULT_DURATION_MS;
  const timingFunction = config.timingFunction ?? DEFAULT_TIMING_FUNCTION;
  const enabled = config.enabled !== false;

  const [phase, setPhase] = useState<TransitionPhase>({
    current: content,
    previous: null,
    transitioning: false,
  });

  const prevKeyRef = useRef(contentKey);
  const enteringRef = useRef<HTMLDivElement>(null);
  const exitingRef = useRef<HTMLDivElement>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTransitionEndRef = useRef(onTransitionEnd);
  onTransitionEndRef.current = onTransitionEnd;

  // Trigger a new transition when contentKey changes
  useEffect(() => {
    if (contentKey === prevKeyRef.current) {
      // Key hasn't changed — just update current content in place
      setPhase((prev) => ({ ...prev, current: content }));
      return;
    }

    prevKeyRef.current = contentKey;

    if (!enabled || prefersReducedMotion()) {
      // Skip animation — render new content immediately
      setPhase({ current: content, previous: null, transitioning: false });
      onTransitionEndRef.current?.();
      return;
    }

    // Start crossfade: save current as previous, set new as current
    setPhase((prev) => ({
      current: content,
      previous: prev.current,
      transitioning: true,
    }));
  }, [contentKey, content, enabled]);

  // Finalize transition — remove previous content and reset state
  const finalize = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    setPhase((prev) => {
      if (!prev.transitioning) return prev;
      return { current: prev.current, previous: null, transitioning: false };
    });
    onTransitionEndRef.current?.();
  }, []);

  // Set up a fallback timer to ensure cleanup even if transitionend doesn't fire
  useEffect(() => {
    if (!phase.transitioning) return;

    fallbackTimerRef.current = setTimeout(finalize, durationMs + FALLBACK_TIMEOUT_MARGIN_MS);

    // Kick off the enter animation on the next frame
    requestAnimationFrame(() => {
      const el = enteringRef.current;
      if (el) {
        el.style.opacity = '1';
      }

      const exiting = exitingRef.current;
      if (exiting) {
        exiting.style.opacity = '0';
      }
    });

    return () => {
      if (fallbackTimerRef.current !== null) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [phase.transitioning, durationMs, finalize]);

  // When disabled or not enabled, render content directly
  if (!enabled) {
    return <>{content}</>;
  }

  // Not transitioning — render current content without wrapper overhead
  if (!phase.transitioning) {
    return <>{phase.current}</>;
  }

  // Transitioning — render overlapping layers
  const transitionValue = `opacity ${durationMs}ms ${timingFunction}`;

  const containerStyle: CSSProperties = {
    position: 'relative',
  };

  const exitingStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    opacity: 1,
    transition: transitionValue,
  };

  const enteringStyle: CSSProperties = {
    opacity: 0,
    transition: transitionValue,
  };

  return (
    <div style={containerStyle} data-flui-transition="active">
      {/* Exiting layer — fades out */}
      {phase.previous !== null && (
        <div ref={exitingRef} style={exitingStyle} aria-hidden="true">
          {phase.previous}
        </div>
      )}
      {/* Entering layer — fades in */}
      <div ref={enteringRef} style={enteringStyle} onTransitionEnd={finalize}>
        {phase.current}
      </div>
    </div>
  );
}
