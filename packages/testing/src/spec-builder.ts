import type {
  ComponentSpec,
  InteractionSpec,
  LayoutSpec,
  UISpecification,
  UISpecificationMetadata,
} from '@flui/core';

/**
 * Fluent builder for creating valid UISpecification objects.
 * Used in tests to programmatically construct specs without manual JSON.
 */
export interface SpecBuilder {
  /** Add a component to the specification */
  addComponent(component: ComponentSpec): SpecBuilder;
  /** Set the layout for the specification */
  withLayout(layout: LayoutSpec): SpecBuilder;
  /** Add an interaction between components */
  addInteraction(interaction: InteractionSpec): SpecBuilder;
  /** Set or merge metadata */
  withMetadata(metadata: Partial<UISpecificationMetadata>): SpecBuilder;
  /** Build the final UISpecification */
  build(): UISpecification;
}

/**
 * Creates a fluent builder for UISpecification objects.
 * Produces valid specs that pass all built-in validators.
 */
export function createSpecBuilder(): SpecBuilder {
  const components: ComponentSpec[] = [];
  const interactions: InteractionSpec[] = [];
  let layout: LayoutSpec = { type: 'stack' };
  let metadata: UISpecificationMetadata = { generatedAt: Date.now() };

  const builder: SpecBuilder = {
    addComponent(component: ComponentSpec): SpecBuilder {
      components.push(component);
      return builder;
    },

    withLayout(newLayout: LayoutSpec): SpecBuilder {
      layout = newLayout;
      return builder;
    },

    addInteraction(interaction: InteractionSpec): SpecBuilder {
      interactions.push(interaction);
      return builder;
    },

    withMetadata(partial: Partial<UISpecificationMetadata>): SpecBuilder {
      metadata = { ...metadata, ...partial };
      return builder;
    },

    build(): UISpecification {
      return {
        version: '1.0.0',
        components: [...components],
        layout: { ...layout },
        interactions: [...interactions],
        metadata: { ...metadata },
      };
    },
  };

  return builder;
}

/**
 * Creates a minimal valid UISpecification with a single component.
 * Useful as a quick test fixture.
 */
export function createMinimalSpec(overrides?: {
  componentType?: string | undefined;
  props?: Record<string, unknown> | undefined;
}): UISpecification {
  return createSpecBuilder()
    .addComponent({
      id: 'comp-1',
      componentType: overrides?.componentType ?? 'Text',
      props: overrides?.props ?? { text: 'Hello' },
    })
    .build();
}

/**
 * Creates a UISpecification with a parent component containing children.
 * Useful for testing nested rendering scenarios.
 */
export function createSpecWithChildren(
  parentType?: string | undefined,
  childCount?: number | undefined,
): UISpecification {
  const count = childCount ?? 2;
  const children: ComponentSpec[] = [];
  for (let i = 0; i < count; i++) {
    children.push({
      id: `child-${i + 1}`,
      componentType: 'Text',
      props: { text: `Child ${i + 1}` },
    });
  }

  return createSpecBuilder()
    .addComponent({
      id: 'parent-1',
      componentType: parentType ?? 'Container',
      props: {},
      children,
    })
    .build();
}
