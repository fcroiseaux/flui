import type {
  ComponentRegistry,
  FluiError,
  GenerationConfig,
  GenerationTrace,
  LLMConnector,
  UISpecification,
  ValidationPipelineConfig,
} from '@flui/core';
import type { CSSProperties, ReactNode } from 'react';

/**
 * Configuration for crossfade transitions between spec replacements.
 * CSS-only transitions — no animation library dependency.
 */
export interface TransitionConfig {
  /** Whether transitions are enabled. Defaults to true. */
  enabled?: boolean;
  /** Duration of the crossfade transition in milliseconds. Defaults to 200. */
  durationMs?: number;
  /** CSS timing function for the transition. Defaults to 'ease-in-out'. */
  timingFunction?: string;
}

/**
 * Represents the current phase of a crossfade transition.
 */
export type TransitionState = 'idle' | 'entering' | 'exiting';

/**
 * Configuration for ARIA live region announcements during spec transitions.
 */
export interface AriaAnnouncementConfig {
  /** Politeness level for the ARIA live region. Defaults to 'polite'. */
  politeness?: 'polite' | 'assertive';
  /** Custom function to format the announcement message from the spec. */
  formatMessage?: (spec: UISpecification) => string;
}

/**
 * Discriminated union representing the LiquidView lifecycle states.
 * State transitions are strict — never skip states, never invent new ones.
 */
export type LiquidViewState =
  | { status: 'idle' }
  | { status: 'generating'; trace: GenerationTrace }
  | { status: 'validating'; rawSpec: unknown }
  | { status: 'rendering'; spec: UISpecification; trace: GenerationTrace }
  | { status: 'error'; error: FluiError; fallback: true };

/**
 * Props for the LiquidView component.
 * `fallback` is mandatory — TypeScript compilation error if omitted.
 */
export interface LiquidViewProps {
  /** Intent string or structured intent object to trigger generation. */
  intent?: string | import('@flui/core').IntentObject | undefined;
  /** Optional context data passed to context providers. */
  context?: Record<string, unknown> | undefined;
  /** Optional data for data resolver. */
  data?: Record<string, unknown> | undefined;
  /** Mandatory fallback UI rendered during loading and error states. */
  fallback: ReactNode;
  /** Callback invoked when the LiquidView state changes. */
  onStateChange?: ((state: LiquidViewState) => void) | undefined;
  /** Callback invoked when an error occurs. */
  onError?: ((error: FluiError) => void) | undefined;
  /** Optional CSS class name for the wrapper element. */
  className?: string | undefined;
  /** Optional inline styles for the wrapper element. */
  style?: CSSProperties | undefined;
  /** Optional transition configuration for crossfade animations between spec changes. */
  transition?: TransitionConfig | undefined;
  /** Optional ARIA announcement configuration for screen reader notifications during transitions. */
  ariaAnnouncement?: AriaAnnouncementConfig | undefined;
}

/**
 * Configuration for the FluiProvider.
 */
export interface FluiReactConfig {
  /** LLM connector instance for generation. */
  connector?: LLMConnector | undefined;
  /** Generation configuration (model, temperature, etc.). */
  generationConfig?: GenerationConfig | undefined;
  /** Validation pipeline configuration. */
  validationConfig?: ValidationPipelineConfig | undefined;
}

/**
 * Props for the FluiProvider component.
 */
export interface FluiProviderProps {
  /** Component registry for component lookups. */
  registry: ComponentRegistry;
  /** Child components wrapped by the provider. */
  children: ReactNode;
  /** Optional configuration for generation and validation. */
  config?: FluiReactConfig | undefined;
}

/**
 * Internal context value provided by FluiProvider.
 */
export interface FluiContextValue {
  /** Component registry for component lookups. */
  registry: ComponentRegistry;
  /** Optional configuration for generation and validation. */
  config?: FluiReactConfig | undefined;
}

/**
 * Options for the useLiquidView hook.
 */
export interface UseLiquidViewOptions {
  /** Intent string or structured intent object to trigger generation. */
  intent?: string | import('@flui/core').IntentObject | undefined;
  /** Optional context data. */
  context?: Record<string, unknown> | undefined;
  /** Optional data for data resolver. */
  data?: Record<string, unknown> | undefined;
  /** Callback invoked when state changes. */
  onStateChange?: ((state: LiquidViewState) => void) | undefined;
  /** Callback invoked when an error occurs. */
  onError?: ((error: FluiError) => void) | undefined;
}

/**
 * Return type of the useLiquidView hook.
 */
export interface UseLiquidViewResult {
  /** Current LiquidView state. */
  state: LiquidViewState;
  /** View state store for persisting component state across regenerations. */
  viewStateStore: ViewStateStore;
}

/**
 * Store for persisting component state across regenerations.
 * Components are identified by their ComponentSpec.id.
 */
export interface ViewStateStore {
  /** Get stored state for a component, or empty object if none. */
  getState(componentId: string): Record<string, unknown>;
  /** Shallow-merge update into existing state for a component. */
  setState(componentId: string, update: Record<string, unknown>): void;
  /** Remove state for components not in newComponentIds. Returns count of cleaned entries. */
  reconcile(newComponentIds: Set<string>): number;
  /** Return a read-only copy of the entire state map (for testing/debugging). */
  getSnapshot(): Map<string, Record<string, unknown>>;
}

/**
 * Store for wiring interactions between components based on InteractionSpec.
 */
export interface InteractionStore {
  /** Get interaction-derived props for a target component. */
  getTargetProps(componentId: string): Record<string, unknown>;
  /** Get event handler map for a source component. */
  getSourceHandlers(componentId: string): Record<string, (...args: unknown[]) => void>;
  /** Issues encountered during interaction wiring. */
  issues: InteractionIssue[];
}

/**
 * Describes an issue encountered during interaction wiring.
 */
export interface InteractionIssue {
  /** Type of issue: source or target component not found. */
  type: 'missing-source' | 'missing-target';
  /** Index of the interaction in the interactions array. */
  interactionIndex: number;
  /** The component ID that was not found. */
  componentId: string;
}

/**
 * Options for the spec renderer to integrate interaction wiring and view state.
 */
export interface RenderSpecOptions {
  /** Interaction store for data flow between components. */
  interactionStore?: InteractionStore | undefined;
  /** View state store for persisting component state. */
  viewStateStore?: ViewStateStore | undefined;
  /** Enables data-flui-id pass-through on rendered components for focus tracking. */
  focusTracking?: boolean | undefined;
  /** Callback for interaction wiring issues. */
  onInteractionIssue?: ((issue: InteractionIssue) => void) | undefined;
}
