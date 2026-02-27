import type { GenerationTrace, UISpecification } from '@flui/core';
import { useCallback, useEffect, useState } from 'react';

import type { DebugOverlayProps, DebugTabId } from './debug.types';

/**
 * Return type for the useFluidDebug hook.
 */
export interface UseFluidDebugResult {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  overlayProps: DebugOverlayProps;
}

export interface UseFluidDebugOptions {
  defaultOpen?: boolean | undefined;
  spec?: UISpecification | null | undefined;
  traces?: readonly GenerationTrace[] | undefined;
  position?: 'right' | 'bottom' | undefined;
  defaultTab?: DebugTabId | undefined;
}

/**
 * Hook to enable and control the debug overlay.
 * Registers Ctrl+Shift+D keyboard shortcut to toggle the overlay.
 *
 * @param options - Optional configuration
 * @param options.defaultOpen - Whether the overlay starts open (default: false)
 * @returns Control object with isOpen state and toggle/open/close methods
 */
export function useFluidDebug(options?: UseFluidDebugOptions): UseFluidDebugResult {
  const [isOpen, setIsOpen] = useState(options?.defaultOpen ?? false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const overlayProps: DebugOverlayProps = {
    spec: options?.spec ?? null,
    traces: options?.traces ?? [],
    position: options?.position,
    defaultTab: options?.defaultTab,
    isOpen,
    onToggle: setIsOpen,
  };

  return { isOpen, toggle, open, close, overlayProps };
}
