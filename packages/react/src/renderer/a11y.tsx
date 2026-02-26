import type { UISpecification } from '@flui/core';
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { AriaAnnouncementConfig } from '../react.types';

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Duration in ms before the ARIA announcement is cleared to avoid stale screen reader content. */
const ANNOUNCEMENT_CLEAR_DELAY_MS = 1000;

/**
 * Visually hidden styles — content is accessible to screen readers but invisible on screen.
 */
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

/**
 * Manages focus placement after a spec transition completes.
 *
 * Focus priority:
 * 1. If the previously focused component still exists (matched by `data-flui-id`), return focus to it.
 * 2. Otherwise, focus the first focusable element within the container.
 * 3. If no focusable element exists, focus the container root (sets `tabIndex={-1}` if needed).
 *
 * Uses `requestAnimationFrame` to schedule focus after paint, avoiding race conditions
 * with React rendering.
 */
export function useFocusManagement(
  containerRef: RefObject<HTMLElement | null>,
  previousFocusedId: string | null,
  shouldFocus: boolean,
): void {
  const hasFocusedRef = useRef(false);

  useEffect(() => {
    if (!shouldFocus) {
      hasFocusedRef.current = false;
      return;
    }

    if (hasFocusedRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    hasFocusedRef.current = true;

    requestAnimationFrame(() => {
      // Priority 1: Return focus to same component by data-flui-id
      if (previousFocusedId) {
        const escapedId = previousFocusedId.replace(/"/g, '\\"');
        const sameElement = container.querySelector<HTMLElement>(`[data-flui-id="${escapedId}"]`);
        if (sameElement) {
          sameElement.focus();
          return;
        }
      }

      // Priority 2: First focusable element
      const focusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
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
  }, [containerRef, previousFocusedId, shouldFocus]);
}

/**
 * Generates the announcement message for an ARIA live region.
 */
function getAnnouncementMessage(
  spec: UISpecification | null,
  config?: AriaAnnouncementConfig,
): string {
  if (!spec) return '';

  if (config?.formatMessage) {
    return config.formatMessage(spec);
  }

  const title = spec.metadata.custom?.title;
  if (typeof title === 'string' && title.length > 0) {
    return title;
  }

  return 'Content updated';
}

/**
 * AriaLiveRegion renders a visually-hidden element that announces spec transitions
 * to assistive technology via an ARIA live region.
 *
 * The announcement is cleared after 1 second to avoid stale screen reader content.
 */
export function AriaLiveRegion({
  spec,
  config,
}: {
  spec: UISpecification | null;
  config?: AriaAnnouncementConfig | undefined;
}): ReactNode {
  const politeness = config?.politeness ?? 'polite';
  const [message, setMessage] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const announcement = getAnnouncementMessage(spec, config);
    setMessage(announcement);

    if (announcement) {
      timerRef.current = setTimeout(() => {
        setMessage('');
        timerRef.current = null;
      }, ANNOUNCEMENT_CLEAR_DELAY_MS);
    }

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [spec, config]);

  return (
    <output aria-live={politeness} aria-atomic="true" style={visuallyHiddenStyle}>
      {message}
    </output>
  );
}
