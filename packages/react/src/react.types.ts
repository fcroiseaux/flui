import type { ComponentRegistry, FluiError, GenerationConfig, GenerationTrace, LLMConnector, UISpecification, ValidationPipelineConfig } from '@flui/core';
import type { CSSProperties, ReactNode } from 'react';

/**
 * Discriminated union representing the LiquidView lifecycle states.
 * State transitions are strict — never skip states, never invent new ones.
 */
export type LiquidViewState =
  | { status: 'idle' }
  | { status: 'generating'; trace: GenerationTrace }
  | { status: 'validating'; rawSpec: unknown }
  | { status: 'rendering'; spec: UISpecification }
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
}
