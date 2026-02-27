import type {
  ComponentDefinition,
  ComponentRegistry,
  LLMConnector,
  UISpecification,
} from '@flui/core';
import { ComponentRegistry as CoreComponentRegistry } from '@flui/core';
import type { FluiReactConfig, LiquidViewProps, LiquidViewState } from '@flui/react';
import { FluiProvider, LiquidView } from '@flui/react';
import { type RenderResult, render, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

import type { MockConnector } from './testing.types';

/**
 * Options for renderLiquidView.
 */
export interface RenderLiquidViewOptions {
  /** The MockConnector to use for generation */
  connector: MockConnector & LLMConnector;
  /** Optional pre-built component registry. If omitted, a test registry is created automatically. */
  registry?: ComponentRegistry | undefined;
  /** Optional component definitions to register in the test registry. */
  components?: ComponentDefinition[] | undefined;
  /** Intent to trigger generation */
  intent?: string | undefined;
  /** Generation config (model, temperature, etc.) */
  config?: Partial<FluiReactConfig> | undefined;
  /** Fallback content rendered during loading/error */
  fallback?: ReactNode | undefined;
  /** Callback for state changes */
  onStateChange?: ((state: LiquidViewState) => void) | undefined;
  /** Callback for errors */
  onError?: ((error: import('@flui/core').FluiError) => void) | undefined;
}

/**
 * Result of renderLiquidView.
 */
export interface RenderLiquidViewResult {
  /** The full RTL render result */
  renderResult: RenderResult;
  /** The registry used for rendering */
  registry: ComponentRegistry;
  /** Captured state changes */
  states: LiquidViewState[];
  /** The most recent state */
  latestState: () => LiquidViewState | undefined;
}

/**
 * Creates a test registry and optionally registers provided components.
 */
export function createTestRegistry(
  components?: ComponentDefinition[] | undefined,
): ComponentRegistry {
  const registry = new CoreComponentRegistry();

  for (const component of components ?? []) {
    const registration = registry.register(component);
    if (!registration.ok) {
      throw registration.error;
    }
  }

  return registry;
}

/**
 * Renders a LiquidView with a MockConnector in a single call.
 * Wraps the component in a FluiProvider with the given registry and connector.
 */
export function renderLiquidView(options: RenderLiquidViewOptions): RenderLiquidViewResult {
  const states: LiquidViewState[] = [];
  const registry = options.registry ?? createTestRegistry(options.components);

  const onStateChange = (state: LiquidViewState): void => {
    states.push(state);
    options.onStateChange?.(state);
  };

  const model = options.config?.generationConfig?.model ?? 'mock-model';

  const fluiConfig: FluiReactConfig = {
    ...options.config,
    connector: options.connector,
    generationConfig: {
      connector: options.connector,
      model,
      ...options.config?.generationConfig,
    },
  };

  const fallbackContent =
    options.fallback ?? createElement('div', { 'data-testid': 'fallback' }, 'Loading...');

  const liquidViewProps: LiquidViewProps = {
    intent: options.intent,
    fallback: fallbackContent,
    onStateChange,
    onError: options.onError,
  };

  const liquidViewElement = createElement(LiquidView, liquidViewProps);
  const element = createElement(FluiProvider, {
    registry,
    config: fluiConfig,
    children: liquidViewElement,
  });

  const renderResult = render(element);

  return {
    renderResult,
    registry,
    states,
    latestState: () => states[states.length - 1],
  };
}

/**
 * Waits for the LiquidView to transition to the 'rendering' state.
 * Returns the UISpecification from the rendering state.
 *
 * @param states - The states array from renderLiquidView result
 * @param timeout - Maximum wait time in milliseconds (default: 5000)
 */
export async function waitForGeneration(
  states: LiquidViewState[],
  timeout?: number | undefined,
): Promise<UISpecification> {
  let spec: UISpecification | undefined;

  await waitFor(
    () => {
      const renderingState = states.find((s) => s.status === 'rendering');
      if (!renderingState || renderingState.status !== 'rendering') {
        throw new Error('LiquidView has not reached rendering state yet');
      }
      spec = renderingState.spec;
    },
    { timeout: timeout ?? 5000 },
  );

  return spec!;
}
