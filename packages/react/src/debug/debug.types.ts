import type { GenerationTrace, UISpecification } from '@flui/core';

/**
 * Tab identifier for the debug overlay.
 */
export type DebugTabId = 'spec' | 'trace';

/**
 * Filter criteria for trace search in the debug overlay.
 */
export interface TraceFilter {
  startTime?: number | undefined;
  endTime?: number | undefined;
  intent?: string | undefined;
  contextKey?: string | undefined;
  contextValue?: string | undefined;
}

/**
 * Props for the DebugOverlay component.
 */
export interface DebugOverlayProps {
  spec: UISpecification | null;
  traces: readonly GenerationTrace[];
  position?: 'right' | 'bottom' | undefined;
  defaultTab?: DebugTabId | undefined;
  isOpen?: boolean | undefined;
  onToggle?: ((isOpen: boolean) => void) | undefined;
}
