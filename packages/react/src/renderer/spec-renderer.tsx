import type { ComponentRegistry, ComponentSpec, UISpecification } from '@flui/core';
import { type ComponentType, createElement, type ReactNode } from 'react';

import type { RenderSpecOptions } from '../react.types';

const STATEFUL_EVENTS = new Set(['onChange', 'onInput', 'onSelect', 'onToggle']);

function extractViewStateUpdate(arg: unknown): Record<string, unknown> | null {
  if (arg == null) {
    return null;
  }

  if (typeof arg === 'object') {
    if ('target' in arg) {
      const target = (arg as { target: unknown }).target;
      if (target && typeof target === 'object') {
        const update: Record<string, unknown> = {};
        if ('value' in target) {
          update.value = (target as { value: unknown }).value;
        }
        if ('checked' in target) {
          update.checked = (target as { checked: unknown }).checked;
        }
        return Object.keys(update).length > 0 ? update : null;
      }
    }

    return arg as Record<string, unknown>;
  }

  return { value: arg };
}

/**
 * Renders a validated UISpecification into React elements using the ComponentRegistry.
 * Each ComponentSpec is mapped to its registered React component.
 *
 * When options are provided, interaction wiring and view state are integrated:
 * - Interaction target props override base spec props
 * - View state overrides everything (preserves user input)
 * - Source handlers are composed with existing handlers
 */
export function renderSpec(
  spec: UISpecification,
  registry: ComponentRegistry,
  options?: RenderSpecOptions,
): ReactNode {
  return spec.components.map((componentSpec) =>
    renderComponentSpec(componentSpec, registry, options),
  );
}

/**
 * Renders a single ComponentSpec into a React element.
 * Missing components are skipped gracefully (render nothing, don't crash).
 *
 * Prop merge order (highest priority last):
 * 1. Base: spec.props (from LLM generation)
 * 2. Override: interaction target props (data flow results)
 * 3. Compose: interaction source handlers (chained with existing)
 * 4. Override: view state (preserved user input — highest priority)
 */
function renderComponentSpec(
  spec: ComponentSpec,
  registry: ComponentRegistry,
  options?: RenderSpecOptions,
): ReactNode {
  const entry = registry.getByName(spec.componentType);
  if (!entry) {
    return null;
  }
  const Component = entry.component as ComponentType<Record<string, unknown>>;

  // 1. Base props from LLM generation
  let mergedProps: Record<string, unknown> = { ...spec.props };

  if (options?.interactionStore) {
    // 2. Override: interaction target props (data flow results)
    const targetProps = options.interactionStore.getTargetProps(spec.id);
    mergedProps = { ...mergedProps, ...targetProps };

    // 3. Compose: interaction source handlers
    const sourceHandlers = options.interactionStore.getSourceHandlers(spec.id);
    for (const [eventName, handler] of Object.entries(sourceHandlers)) {
      const existingHandler = mergedProps[eventName];
      if (typeof existingHandler === 'function') {
        // Chain: call original first, then interaction handler
        mergedProps[eventName] = (...args: unknown[]) => {
          (existingHandler as (...a: unknown[]) => void)(...args);
          handler(...args);
        };
      } else {
        mergedProps[eventName] = handler;
      }
    }
  }

  if (options?.viewStateStore) {
    // 4. Override: view state (preserved user input takes highest priority)
    const viewState = options.viewStateStore.getState(spec.id);
    mergedProps = { ...mergedProps, ...viewState };

    for (const [eventName, handler] of Object.entries(mergedProps)) {
      if (!STATEFUL_EVENTS.has(eventName) || typeof handler !== 'function') {
        continue;
      }

      mergedProps[eventName] = (...args: unknown[]) => {
        (handler as (...a: unknown[]) => void)(...args);
        const update = extractViewStateUpdate(args[0]);
        if (update) {
          options.viewStateStore?.setState(spec.id, update);
        }
      };
    }

    if (typeof mergedProps.onChange !== 'function') {
      mergedProps.onChange = (...args: unknown[]) => {
        const update = extractViewStateUpdate(args[0]);
        if (update) {
          options.viewStateStore?.setState(spec.id, update);
        }
      };
    }
  }

  const children = spec.children?.map((child) => renderComponentSpec(child, registry, options));
  const componentProps: Record<string, unknown> = {
    ...mergedProps,
    key: spec.key ?? spec.id,
  };

  if (options?.focusTracking) {
    componentProps['data-flui-id'] = spec.id;
  }

  return createElement(Component, componentProps, children);
}
