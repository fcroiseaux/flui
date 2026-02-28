import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { uiSpecificationJsonSchema } from './spec.json-schema';

const ajv = new Ajv();
const validate = ajv.compile(uiSpecificationJsonSchema);

const validSpec = {
  version: '1.0.0',
  components: [
    {
      id: 'btn-1',
      componentType: 'Button',
      props: { label: 'Click me' },
      key: null,
      children: null,
    },
  ],
  layout: {
    type: 'stack',
    direction: 'vertical',
    spacing: 16,
    alignment: 'start',
    children: null,
  },
  interactions: [
    {
      source: 'btn-1',
      target: 'output-1',
      event: 'onClick',
      dataMapping: null,
    },
  ],
  metadata: {
    generatedAt: 1708790400000,
    model: 'gpt-4o',
    intentHash: null,
    traceId: null,
    custom: null,
  },
};

describe('uiSpecificationJsonSchema', () => {
  it('is a valid JSON Schema that compiles without errors', () => {
    expect(validate).toBeDefined();
    expect(typeof validate).toBe('function');
  });

  it('validates a complete UISpecification', () => {
    const valid = validate(validSpec);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
  });

  it('validates spec with nested component children', () => {
    const spec = {
      ...validSpec,
      components: [
        {
          id: 'card-1',
          componentType: 'Card',
          props: { title: 'Dashboard' },
          key: 'dash-card',
          children: [
            {
              id: 'text-1',
              componentType: 'Text',
              props: { content: 'Hello' },
              key: null,
              children: null,
            },
          ],
        },
      ],
    };
    expect(validate(spec)).toBe(true);
  });

  it('validates spec with nested layout children', () => {
    const spec = {
      ...validSpec,
      layout: {
        type: 'grid',
        direction: null,
        spacing: 8,
        alignment: null,
        children: [
          { type: 'stack', direction: 'horizontal', spacing: null, alignment: null, children: null },
          { type: 'flex', direction: null, spacing: null, alignment: 'center', children: null },
        ],
      },
    };
    expect(validate(spec)).toBe(true);
  });

  it('validates spec with interaction dataMapping', () => {
    const spec = {
      ...validSpec,
      interactions: [
        {
          source: 'search-1',
          target: 'list-1',
          event: 'onSearch',
          dataMapping: { query: 'filterText', page: 'currentPage' },
        },
      ],
    };
    expect(validate(spec)).toBe(true);
  });

  it('validates spec with full metadata', () => {
    const spec = {
      ...validSpec,
      metadata: {
        generatedAt: Date.now(),
        model: 'gpt-4o',
        intentHash: 'abc123',
        traceId: 'trace-001',
        custom: { experiment: 'A', nested: { deep: true } },
      },
    };
    expect(validate(spec)).toBe(true);
  });

  it('rejects invalid layout type', () => {
    const spec = {
      ...validSpec,
      layout: { ...validSpec.layout, type: 'table' },
    };
    expect(validate(spec)).toBe(false);
    expect(validate.errors).not.toBeNull();
  });

  it('rejects missing version', () => {
    const { version: _, ...noVersion } = validSpec;
    expect(validate(noVersion)).toBe(false);
  });

  it('rejects missing components', () => {
    const { components: _, ...noComponents } = validSpec;
    expect(validate(noComponents)).toBe(false);
  });

  it('rejects missing layout', () => {
    const { layout: _, ...noLayout } = validSpec;
    expect(validate(noLayout)).toBe(false);
  });

  it('rejects missing interactions', () => {
    const { interactions: _, ...noInteractions } = validSpec;
    expect(validate(noInteractions)).toBe(false);
  });

  it('rejects missing metadata', () => {
    const { metadata: _, ...noMetadata } = validSpec;
    expect(validate(noMetadata)).toBe(false);
  });

  it('rejects additional properties at root level', () => {
    const spec = { ...validSpec, extraField: 'should fail' };
    expect(validate(spec)).toBe(false);
  });

  it('rejects component with empty id', () => {
    const spec = {
      ...validSpec,
      components: [
        { id: '', componentType: 'Button', props: {}, key: null, children: null },
      ],
    };
    expect(validate(spec)).toBe(false);
  });

  it('rejects component with empty componentType', () => {
    const spec = {
      ...validSpec,
      components: [
        { id: 'btn-1', componentType: '', props: {}, key: null, children: null },
      ],
    };
    expect(validate(spec)).toBe(false);
  });

  it('rejects interaction with empty source', () => {
    const spec = {
      ...validSpec,
      interactions: [
        { source: '', target: 'x', event: 'y', dataMapping: null },
      ],
    };
    expect(validate(spec)).toBe(false);
  });

  it('rejects negative spacing', () => {
    const spec = {
      ...validSpec,
      layout: { ...validSpec.layout, spacing: -5 },
    };
    expect(validate(spec)).toBe(false);
  });

  it('rejects invalid direction', () => {
    const spec = {
      ...validSpec,
      layout: { ...validSpec.layout, direction: 'diagonal' },
    };
    expect(validate(spec)).toBe(false);
  });

  it('rejects invalid alignment', () => {
    const spec = {
      ...validSpec,
      layout: { ...validSpec.layout, alignment: 'middle' },
    };
    expect(validate(spec)).toBe(false);
  });

  it('rejects negative generatedAt', () => {
    const spec = {
      ...validSpec,
      metadata: { ...validSpec.metadata, generatedAt: -1 },
    };
    expect(validate(spec)).toBe(false);
  });

  it('rejects non-integer generatedAt', () => {
    const spec = {
      ...validSpec,
      metadata: { ...validSpec.metadata, generatedAt: 1.5 },
    };
    expect(validate(spec)).toBe(false);
  });

  it('constrains layout type to exactly 4 valid values', () => {
    const layoutDef = (uiSpecificationJsonSchema.$defs as Record<string, Record<string, unknown>>)
      ?.LayoutSpec;
    const properties = layoutDef?.properties as Record<string, Record<string, unknown>>;
    const typeEnum = properties?.type?.enum as string[];
    expect(typeEnum).toEqual(['stack', 'grid', 'flex', 'absolute']);
  });

  it('exports a plain object (not a class instance)', () => {
    expect(typeof uiSpecificationJsonSchema).toBe('object');
    expect(uiSpecificationJsonSchema).not.toBeNull();
    expect(Object.getPrototypeOf(uiSpecificationJsonSchema)).toBe(Object.prototype);
  });
});
