import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import type {
  ComponentSpec,
  InteractionSpec,
  LayoutSpec,
  UISpecification,
  UISpecificationMetadata,
} from './index';
import {
  componentSpecSchema,
  interactionSpecSchema,
  layoutSpecSchema,
  SPEC_VERSION,
  uiSpecificationMetadataSchema,
  uiSpecificationSchema,
} from './index';

// ── Test fixtures ──────────────────────────────────────────────────────

const validComponent: ComponentSpec = {
  id: 'data-table-1',
  componentType: 'DataTable',
  props: { dataSource: 'sales', columns: ['name', 'amount'] },
};

const validComponentWithChildren: ComponentSpec = {
  id: 'card-1',
  componentType: 'Card',
  props: { title: 'Dashboard' },
  key: 'dashboard-card',
  children: [
    { id: 'chart-1', componentType: 'Chart', props: { type: 'bar' } },
    { id: 'text-1', componentType: 'Text', props: { content: 'Summary' } },
  ],
};

const validLayout: LayoutSpec = {
  type: 'stack',
  direction: 'vertical',
  spacing: 16,
  alignment: 'start',
};

const validLayoutNested: LayoutSpec = {
  type: 'grid',
  spacing: 8,
  children: [
    { type: 'stack', direction: 'horizontal' },
    { type: 'flex', alignment: 'center' },
  ],
};

const validInteraction: InteractionSpec = {
  source: 'filter-1',
  target: 'data-table-1',
  event: 'onChange',
};

const validInteractionWithMapping: InteractionSpec = {
  source: 'search-1',
  target: 'list-1',
  event: 'onSearch',
  dataMapping: { query: 'filterText', page: 'currentPage' },
};

const validMetadata: UISpecificationMetadata = {
  generatedAt: 1708790400000,
  model: 'gpt-4o',
  intentHash: 'abc123',
  traceId: 'trace-001',
  custom: { experiment: 'A' },
};

const validSpec: UISpecification = {
  version: '1.0.0',
  components: [validComponent],
  layout: validLayout,
  interactions: [validInteraction],
  metadata: validMetadata,
};

// ── SPEC_VERSION ───────────────────────────────────────────────────────

describe('SPEC_VERSION', () => {
  it('is a semver-formatted string', () => {
    expect(SPEC_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('equals 1.0.0', () => {
    expect(SPEC_VERSION).toBe('1.0.0');
  });
});

// ── componentSpecSchema ────────────────────────────────────────────────

describe('componentSpecSchema', () => {
  it('validates a minimal component', () => {
    const result = componentSpecSchema.safeParse(validComponent);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('data-table-1');
      expect(result.data.componentType).toBe('DataTable');
      expect(result.data.props).toEqual({ dataSource: 'sales', columns: ['name', 'amount'] });
    }
  });

  it('validates a component with key and children', () => {
    const result = componentSpecSchema.safeParse(validComponentWithChildren);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.key).toBe('dashboard-card');
      expect(result.data.children).toHaveLength(2);
    }
  });

  it('validates deeply nested children recursively', () => {
    const deepSpec: ComponentSpec = {
      id: 'root-1',
      componentType: 'Root',
      props: {},
      children: [
        {
          id: 'level-1',
          componentType: 'Level1',
          props: {},
          children: [
            {
              id: 'level-2',
              componentType: 'Level2',
              props: {},
              children: [{ id: 'level-3', componentType: 'Level3', props: { value: 42 } }],
            },
          ],
        },
      ],
    };
    const result = componentSpecSchema.safeParse(deepSpec);
    expect(result.success).toBe(true);
  });

  it('rejects empty componentType', () => {
    const result = componentSpecSchema.safeParse({ id: 'a', componentType: '', props: {} });
    expect(result.success).toBe(false);
  });

  it('rejects missing id', () => {
    const result = componentSpecSchema.safeParse({ componentType: 'Btn', props: {} });
    expect(result.success).toBe(false);
  });

  it('rejects missing componentType', () => {
    const result = componentSpecSchema.safeParse({ id: 'a', props: {} });
    expect(result.success).toBe(false);
  });

  it('rejects missing props', () => {
    const result = componentSpecSchema.safeParse({ id: 'a', componentType: 'Btn' });
    expect(result.success).toBe(false);
  });

  it('accepts component with empty props', () => {
    const result = componentSpecSchema.safeParse({
      id: 'spacer-1',
      componentType: 'Spacer',
      props: {},
    });
    expect(result.success).toBe(true);
  });

  it('accepts component with unknown prop values', () => {
    const result = componentSpecSchema.safeParse({
      id: 'custom-1',
      componentType: 'Custom',
      props: { nested: { deep: [1, 2, 3] }, flag: true, count: 42 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects unrecognized top-level fields', () => {
    const result = componentSpecSchema.safeParse({
      id: 'btn-1',
      componentType: 'Btn',
      props: {},
      extraField: 'should be stripped',
    });
    expect(result.success).toBe(false);
  });

  it('provides field path in validation errors', () => {
    const result = componentSpecSchema.safeParse({ id: 'x', componentType: 123, props: {} });
    expect(result.success).toBe(false);
    if (!result.success) {
      const tree = z.treeifyError(result.error);
      expect(tree.properties?.componentType).toBeDefined();
    }
  });
});

// ── layoutSpecSchema ───────────────────────────────────────────────────

describe('layoutSpecSchema', () => {
  it('validates a complete layout', () => {
    const result = layoutSpecSchema.safeParse(validLayout);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('stack');
      expect(result.data.direction).toBe('vertical');
      expect(result.data.spacing).toBe(16);
    }
  });

  it('validates a minimal layout (type only)', () => {
    const result = layoutSpecSchema.safeParse({ type: 'grid' });
    expect(result.success).toBe(true);
  });

  it('validates nested layout children recursively', () => {
    const result = layoutSpecSchema.safeParse(validLayoutNested);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.children).toHaveLength(2);
    }
  });

  it('rejects invalid layout type', () => {
    const result = layoutSpecSchema.safeParse({ type: 'table' });
    expect(result.success).toBe(false);
  });

  it('rejects missing type field', () => {
    const result = layoutSpecSchema.safeParse({ direction: 'vertical' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid direction', () => {
    const result = layoutSpecSchema.safeParse({ type: 'stack', direction: 'diagonal' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid alignment', () => {
    const result = layoutSpecSchema.safeParse({ type: 'flex', alignment: 'middle' });
    expect(result.success).toBe(false);
  });

  it('rejects negative spacing', () => {
    const result = layoutSpecSchema.safeParse({ type: 'stack', spacing: -5 });
    expect(result.success).toBe(false);
  });

  it('accepts zero spacing', () => {
    const result = layoutSpecSchema.safeParse({ type: 'stack', spacing: 0 });
    expect(result.success).toBe(true);
  });

  it('validates all four layout types', () => {
    for (const type of ['stack', 'grid', 'flex', 'absolute'] as const) {
      const result = layoutSpecSchema.safeParse({ type });
      expect(result.success).toBe(true);
    }
  });

  it('provides field path for invalid nested children', () => {
    const result = layoutSpecSchema.safeParse({
      type: 'grid',
      children: [{ type: 'invalid_type' }],
    });
    expect(result.success).toBe(false);
  });
});

// ── interactionSpecSchema ──────────────────────────────────────────────

describe('interactionSpecSchema', () => {
  it('validates a minimal interaction', () => {
    const result = interactionSpecSchema.safeParse(validInteraction);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe('filter-1');
      expect(result.data.target).toBe('data-table-1');
      expect(result.data.event).toBe('onChange');
    }
  });

  it('validates interaction with dataMapping', () => {
    const result = interactionSpecSchema.safeParse(validInteractionWithMapping);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dataMapping).toEqual({ query: 'filterText', page: 'currentPage' });
    }
  });

  it('rejects empty source', () => {
    const result = interactionSpecSchema.safeParse({ source: '', target: 'x', event: 'y' });
    expect(result.success).toBe(false);
  });

  it('rejects empty target', () => {
    const result = interactionSpecSchema.safeParse({ source: 'x', target: '', event: 'y' });
    expect(result.success).toBe(false);
  });

  it('rejects empty event', () => {
    const result = interactionSpecSchema.safeParse({ source: 'x', target: 'y', event: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = interactionSpecSchema.safeParse({ source: 'x' });
    expect(result.success).toBe(false);
  });

  it('rejects non-string dataMapping values', () => {
    const result = interactionSpecSchema.safeParse({
      source: 'a',
      target: 'b',
      event: 'click',
      dataMapping: { key: 123 },
    });
    expect(result.success).toBe(false);
  });
});

// ── uiSpecificationMetadataSchema ──────────────────────────────────────

describe('uiSpecificationMetadataSchema', () => {
  it('validates complete metadata', () => {
    const result = uiSpecificationMetadataSchema.safeParse(validMetadata);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.generatedAt).toBe(1708790400000);
      expect(result.data.model).toBe('gpt-4o');
    }
  });

  it('validates minimal metadata (generatedAt only)', () => {
    const result = uiSpecificationMetadataSchema.safeParse({ generatedAt: Date.now() });
    expect(result.success).toBe(true);
  });

  it('rejects missing generatedAt', () => {
    const result = uiSpecificationMetadataSchema.safeParse({ model: 'gpt-4o' });
    expect(result.success).toBe(false);
  });

  it('rejects non-number generatedAt', () => {
    const result = uiSpecificationMetadataSchema.safeParse({ generatedAt: '2026-01-01' });
    expect(result.success).toBe(false);
  });

  it('rejects negative generatedAt', () => {
    const result = uiSpecificationMetadataSchema.safeParse({ generatedAt: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer generatedAt', () => {
    const result = uiSpecificationMetadataSchema.safeParse({ generatedAt: 1.5 });
    expect(result.success).toBe(false);
  });

  it('accepts custom metadata with arbitrary values', () => {
    const result = uiSpecificationMetadataSchema.safeParse({
      generatedAt: 1000,
      custom: { nested: { deep: true }, list: [1, 2] },
    });
    expect(result.success).toBe(true);
  });
});

// ── uiSpecificationSchema ──────────────────────────────────────────────

describe('uiSpecificationSchema', () => {
  it('validates a complete UISpecification', () => {
    const result = uiSpecificationSchema.safeParse(validSpec);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe('1.0.0');
      expect(result.data.components).toHaveLength(1);
      expect(result.data.interactions).toHaveLength(1);
    }
  });

  it('validates spec with multiple components and interactions', () => {
    const spec: UISpecification = {
      version: '1.0.0',
      components: [validComponent, validComponentWithChildren],
      layout: validLayoutNested,
      interactions: [validInteraction, validInteractionWithMapping],
      metadata: { generatedAt: Date.now() },
    };
    const result = uiSpecificationSchema.safeParse(spec);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.components).toHaveLength(2);
      expect(result.data.interactions).toHaveLength(2);
    }
  });

  it('validates spec with empty components and interactions arrays', () => {
    const result = uiSpecificationSchema.safeParse({
      version: '1.0.0',
      components: [],
      layout: { type: 'stack' },
      interactions: [],
      metadata: { generatedAt: Date.now() },
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing version', () => {
    const { version: _, ...noVersion } = validSpec;
    const result = uiSpecificationSchema.safeParse(noVersion);
    expect(result.success).toBe(false);
  });

  it('rejects empty version string', () => {
    const result = uiSpecificationSchema.safeParse({ ...validSpec, version: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing components', () => {
    const { components: _, ...noComponents } = validSpec;
    const result = uiSpecificationSchema.safeParse(noComponents);
    expect(result.success).toBe(false);
  });

  it('rejects missing layout', () => {
    const { layout: _, ...noLayout } = validSpec;
    const result = uiSpecificationSchema.safeParse(noLayout);
    expect(result.success).toBe(false);
  });

  it('rejects missing interactions', () => {
    const { interactions: _, ...noInteractions } = validSpec;
    const result = uiSpecificationSchema.safeParse(noInteractions);
    expect(result.success).toBe(false);
  });

  it('rejects missing metadata', () => {
    const { metadata: _, ...noMetadata } = validSpec;
    const result = uiSpecificationSchema.safeParse(noMetadata);
    expect(result.success).toBe(false);
  });

  it('rejects invalid component inside components array', () => {
    const result = uiSpecificationSchema.safeParse({
      ...validSpec,
      components: [{ id: 'bad-1', componentType: '', props: {} }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid interaction inside interactions array', () => {
    const result = uiSpecificationSchema.safeParse({
      ...validSpec,
      interactions: [{ source: '', target: 'x', event: 'y' }],
    });
    expect(result.success).toBe(false);
  });

  it('produces structured errors with field paths via treeifyError', () => {
    const result = uiSpecificationSchema.safeParse({
      version: 123,
      components: 'not-array',
      layout: {},
      interactions: [],
      metadata: {},
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const tree = z.treeifyError(result.error);
      expect(tree.properties?.version).toBeDefined();
      expect(tree.properties?.components).toBeDefined();
      expect(tree.properties?.layout).toBeDefined();
      expect(tree.properties?.metadata).toBeDefined();
    }
  });

  it('produces errors with path information in issues array', () => {
    const result = uiSpecificationSchema.safeParse({
      version: '1.0.0',
      components: [{ id: 'bad-2', componentType: 123, props: {} }],
      layout: { type: 'stack' },
      interactions: [],
      metadata: { generatedAt: Date.now() },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path);
      expect(paths.some((p) => p.length > 1)).toBe(true);
    }
  });
});

// ── Barrel exports ─────────────────────────────────────────────────────

describe('barrel exports', () => {
  it('exports all schemas from @flui/core barrel', async () => {
    const api = await import('../index');
    expect(api.componentSpecSchema).toBeDefined();
    expect(api.layoutSpecSchema).toBeDefined();
    expect(api.interactionSpecSchema).toBeDefined();
    expect(api.uiSpecificationMetadataSchema).toBeDefined();
    expect(api.uiSpecificationSchema).toBeDefined();
    expect(api.SPEC_VERSION).toBeDefined();
  });

  it('exports SPEC_VERSION as a string', async () => {
    const api = await import('../index');
    expect(typeof api.SPEC_VERSION).toBe('string');
  });

  it('keeps schema and type definitions in sync', () => {
    expectTypeOf<z.infer<typeof componentSpecSchema>>().toEqualTypeOf<ComponentSpec>();
    expectTypeOf<z.infer<typeof layoutSpecSchema>>().toEqualTypeOf<LayoutSpec>();
    expectTypeOf<z.infer<typeof interactionSpecSchema>>().toEqualTypeOf<InteractionSpec>();
    expectTypeOf<
      z.infer<typeof uiSpecificationMetadataSchema>
    >().toEqualTypeOf<UISpecificationMetadata>();
    expectTypeOf<z.infer<typeof uiSpecificationSchema>>().toEqualTypeOf<UISpecification>();
  });
});
