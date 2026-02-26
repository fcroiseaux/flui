import type { ComponentRegistry, ComponentSpec, UISpecification } from '@flui/core';
import { createElement, type ComponentType, type ReactNode } from 'react';

/**
 * Renders a validated UISpecification into React elements using the ComponentRegistry.
 * Each ComponentSpec is mapped to its registered React component.
 */
export function renderSpec(spec: UISpecification, registry: ComponentRegistry): ReactNode {
  return spec.components.map((componentSpec) =>
    renderComponentSpec(componentSpec, registry),
  );
}

/**
 * Renders a single ComponentSpec into a React element.
 * Missing components are skipped gracefully (render nothing, don't crash).
 */
function renderComponentSpec(spec: ComponentSpec, registry: ComponentRegistry): ReactNode {
  const entry = registry.getByName(spec.componentType);
  if (!entry) {
    return null;
  }
  const Component = entry.component as ComponentType<Record<string, unknown>>;
  const children = spec.children?.map((child) => renderComponentSpec(child, registry));
  return createElement(Component, { ...spec.props, key: spec.key ?? spec.id }, children);
}
