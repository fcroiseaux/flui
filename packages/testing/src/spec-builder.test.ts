import type { ComponentSpec, InteractionSpec, LayoutSpec } from '@flui/core';
import {
  ComponentRegistry,
  createValidationPipeline,
  SPEC_VERSION,
  uiSpecificationSchema,
} from '@flui/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createMinimalSpec, createSpecBuilder, createSpecWithChildren } from './spec-builder';

// ── createSpecBuilder ───────────────────────────────────────────────

describe('createSpecBuilder', () => {
  it('returns a builder object with fluent API methods', () => {
    const builder = createSpecBuilder();
    expect(typeof builder.addComponent).toBe('function');
    expect(typeof builder.withLayout).toBe('function');
    expect(typeof builder.addInteraction).toBe('function');
    expect(typeof builder.withMetadata).toBe('function');
    expect(typeof builder.build).toBe('function');
  });

  describe('build()', () => {
    it('produces a valid UISpecification with defaults', () => {
      const spec = createSpecBuilder().build();

      expect(spec.version).toBe(SPEC_VERSION);
      expect(spec.components).toEqual([]);
      expect(spec.layout).toEqual({ type: 'stack' });
      expect(spec.interactions).toEqual([]);
      expect(spec.metadata).toBeDefined();
      expect(typeof spec.metadata.generatedAt).toBe('number');
    });

    it('returns a new object each time (no shared state)', () => {
      const builder = createSpecBuilder();
      const spec1 = builder.build();
      const spec2 = builder.build();

      expect(spec1).not.toBe(spec2);
      expect(spec1.components).not.toBe(spec2.components);
      expect(spec1.layout).not.toBe(spec2.layout);
      expect(spec1.interactions).not.toBe(spec2.interactions);
      expect(spec1.metadata).not.toBe(spec2.metadata);
    });
  });

  describe('addComponent()', () => {
    it('adds components to the specification', () => {
      const component: ComponentSpec = {
        id: 'btn-1',
        componentType: 'Button',
        props: { label: 'Click me' },
      };

      const spec = createSpecBuilder().addComponent(component).build();

      expect(spec.components).toHaveLength(1);
      expect(spec.components[0]?.id).toBe('btn-1');
      expect(spec.components[0]?.componentType).toBe('Button');
      expect(spec.components[0]?.props).toEqual({ label: 'Click me' });
    });

    it('supports chaining multiple components', () => {
      const spec = createSpecBuilder()
        .addComponent({ id: 'c1', componentType: 'Text', props: { text: 'A' } })
        .addComponent({ id: 'c2', componentType: 'Button', props: { label: 'B' } })
        .build();

      expect(spec.components).toHaveLength(2);
      expect(spec.components[0]?.id).toBe('c1');
      expect(spec.components[1]?.id).toBe('c2');
    });

    it('supports components with children', () => {
      const component: ComponentSpec = {
        id: 'parent',
        componentType: 'Container',
        props: {},
        children: [{ id: 'child', componentType: 'Text', props: { text: 'Nested' } }],
      };

      const spec = createSpecBuilder().addComponent(component).build();

      expect(spec.components[0]?.children).toHaveLength(1);
      expect(spec.components[0]?.children?.[0]?.id).toBe('child');
    });

    it('supports components with key', () => {
      const spec = createSpecBuilder()
        .addComponent({ id: 'c1', componentType: 'Text', props: {}, key: 'unique-key' })
        .build();

      expect(spec.components[0]?.key).toBe('unique-key');
    });
  });

  describe('withLayout()', () => {
    it('sets the layout', () => {
      const layout: LayoutSpec = {
        type: 'grid',
        direction: 'horizontal',
        spacing: 16,
        alignment: 'center',
      };

      const spec = createSpecBuilder().withLayout(layout).build();

      expect(spec.layout.type).toBe('grid');
      expect(spec.layout.direction).toBe('horizontal');
      expect(spec.layout.spacing).toBe(16);
      expect(spec.layout.alignment).toBe('center');
    });

    it('replaces previous layout', () => {
      const spec = createSpecBuilder()
        .withLayout({ type: 'grid' })
        .withLayout({ type: 'flex', direction: 'vertical' })
        .build();

      expect(spec.layout.type).toBe('flex');
      expect(spec.layout.direction).toBe('vertical');
    });

    it('supports nested layout children', () => {
      const layout: LayoutSpec = {
        type: 'stack',
        children: [{ type: 'flex', direction: 'horizontal' }],
      };

      const spec = createSpecBuilder().withLayout(layout).build();

      expect(spec.layout.children).toHaveLength(1);
      expect(spec.layout.children?.[0]?.type).toBe('flex');
    });
  });

  describe('addInteraction()', () => {
    it('adds interactions', () => {
      const interaction: InteractionSpec = {
        source: 'btn-1',
        target: 'text-1',
        event: 'click',
      };

      const spec = createSpecBuilder().addInteraction(interaction).build();

      expect(spec.interactions).toHaveLength(1);
      expect(spec.interactions[0]?.source).toBe('btn-1');
      expect(spec.interactions[0]?.target).toBe('text-1');
      expect(spec.interactions[0]?.event).toBe('click');
    });

    it('supports interactions with dataMapping', () => {
      const spec = createSpecBuilder()
        .addInteraction({
          source: 'input-1',
          target: 'display-1',
          event: 'change',
          dataMapping: { value: 'text' },
        })
        .build();

      expect(spec.interactions[0]?.dataMapping).toEqual({ value: 'text' });
    });

    it('supports chaining multiple interactions', () => {
      const spec = createSpecBuilder()
        .addInteraction({ source: 'a', target: 'b', event: 'click' })
        .addInteraction({ source: 'b', target: 'c', event: 'change' })
        .build();

      expect(spec.interactions).toHaveLength(2);
    });
  });

  describe('withMetadata()', () => {
    it('sets metadata fields', () => {
      const spec = createSpecBuilder()
        .withMetadata({ model: 'gpt-4o', traceId: 'trace-123' })
        .build();

      expect(spec.metadata.model).toBe('gpt-4o');
      expect(spec.metadata.traceId).toBe('trace-123');
      expect(typeof spec.metadata.generatedAt).toBe('number');
    });

    it('merges metadata with existing values', () => {
      const spec = createSpecBuilder()
        .withMetadata({ model: 'gpt-4o' })
        .withMetadata({ traceId: 'trace-456' })
        .build();

      expect(spec.metadata.model).toBe('gpt-4o');
      expect(spec.metadata.traceId).toBe('trace-456');
    });

    it('overrides generatedAt when explicitly provided', () => {
      const spec = createSpecBuilder().withMetadata({ generatedAt: 1000 }).build();

      expect(spec.metadata.generatedAt).toBe(1000);
    });

    it('supports custom metadata', () => {
      const spec = createSpecBuilder()
        .withMetadata({ custom: { environment: 'test', version: 2 } })
        .build();

      expect(spec.metadata.custom).toEqual({ environment: 'test', version: 2 });
    });
  });

  describe('fluent chaining', () => {
    it('supports full builder chain', () => {
      const spec = createSpecBuilder()
        .addComponent({ id: 'input-1', componentType: 'Input', props: { placeholder: 'Type...' } })
        .addComponent({ id: 'btn-1', componentType: 'Button', props: { label: 'Submit' } })
        .withLayout({ type: 'flex', direction: 'horizontal', spacing: 8 })
        .addInteraction({ source: 'btn-1', target: 'input-1', event: 'click' })
        .withMetadata({ model: 'test-model' })
        .build();

      expect(spec.version).toBe('1.0.0');
      expect(spec.components).toHaveLength(2);
      expect(spec.layout.type).toBe('flex');
      expect(spec.interactions).toHaveLength(1);
      expect(spec.metadata.model).toBe('test-model');
    });
  });

  describe('validator compatibility', () => {
    it('passes schema, component, and props validators', async () => {
      const registry = new ComponentRegistry();
      registry.register({
        name: 'Text',
        category: 'display',
        description: 'Text component',
        accepts: z.object({ text: z.string(), 'aria-live': z.enum(['polite', 'assertive']) }),
        component: () => null,
      });

      const spec = createSpecBuilder()
        .addComponent({
          id: 'text-1',
          componentType: 'Text',
          props: { text: 'Hello', 'aria-live': 'polite' },
        })
        .build();

      const schemaResult = uiSpecificationSchema.safeParse(spec);
      expect(schemaResult.success).toBe(true);

      const pipeline = createValidationPipeline();
      const validationResult = await pipeline.validate(spec, { registry });
      expect(validationResult.ok).toBe(true);
    });
  });
});

// ── createMinimalSpec ───────────────────────────────────────────────

describe('createMinimalSpec', () => {
  it('creates a spec with one component and defaults', () => {
    const spec = createMinimalSpec();

    expect(spec.version).toBe(SPEC_VERSION);
    expect(spec.components).toHaveLength(1);
    expect(spec.components[0]?.id).toBe('comp-1');
    expect(spec.components[0]?.componentType).toBe('Text');
    expect(spec.components[0]?.props).toEqual({ text: 'Hello' });
    expect(spec.layout).toEqual({ type: 'stack' });
    expect(spec.interactions).toEqual([]);
  });

  it('accepts componentType override', () => {
    const spec = createMinimalSpec({ componentType: 'Button' });
    expect(spec.components[0]?.componentType).toBe('Button');
  });

  it('accepts props override', () => {
    const spec = createMinimalSpec({ props: { label: 'Click' } });
    expect(spec.components[0]?.props).toEqual({ label: 'Click' });
  });
});

// ── createSpecWithChildren ──────────────────────────────────────────

describe('createSpecWithChildren', () => {
  it('creates a spec with a parent and 2 children by default', () => {
    const spec = createSpecWithChildren();

    expect(spec.components).toHaveLength(1);
    expect(spec.components[0]?.componentType).toBe('Container');
    expect(spec.components[0]?.children).toHaveLength(2);
    expect(spec.components[0]?.children?.[0]?.id).toBe('child-1');
    expect(spec.components[0]?.children?.[1]?.id).toBe('child-2');
  });

  it('accepts custom parent type', () => {
    const spec = createSpecWithChildren('Card');
    expect(spec.components[0]?.componentType).toBe('Card');
  });

  it('accepts custom child count', () => {
    const spec = createSpecWithChildren(undefined, 5);
    expect(spec.components[0]?.children).toHaveLength(5);
    expect(spec.components[0]?.children?.[4]?.id).toBe('child-5');
  });

  it('children are Text components with numbered text', () => {
    const spec = createSpecWithChildren(undefined, 3);
    const children = spec.components[0]?.children;

    expect(children?.[0]?.componentType).toBe('Text');
    expect(children?.[0]?.props).toEqual({ text: 'Child 1' });
    expect(children?.[2]?.props).toEqual({ text: 'Child 3' });
  });
});
