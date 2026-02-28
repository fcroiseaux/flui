/**
 * Static JSON Schema for UISpecification.
 *
 * Used with OpenAI Structured Outputs to guarantee schema-conformant responses.
 * Mirrors the TypeScript types in spec.types.ts and the Zod schemas in spec.schema.ts.
 *
 * OpenAI Structured Outputs requires `additionalProperties: false` at every object level
 * and all properties listed in `required` (optional fields use nullable types or
 * are wrapped in anyOf with null).
 */
export const uiSpecificationJsonSchema: Record<string, unknown> = {
  title: 'UISpecification',
  description: 'Root specification type for LLM-generated UIs',
  type: 'object',
  properties: {
    version: {
      type: 'string',
      description: 'Specification format version (e.g. "1.0.0")',
      minLength: 1,
    },
    components: {
      type: 'array',
      description: 'Components to render',
      items: { $ref: '#/$defs/ComponentSpec' },
    },
    layout: { $ref: '#/$defs/LayoutSpec' },
    interactions: {
      type: 'array',
      description: 'Data flow interactions between components',
      items: { $ref: '#/$defs/InteractionSpec' },
    },
    metadata: { $ref: '#/$defs/UISpecificationMetadata' },
  },
  required: ['version', 'components', 'layout', 'interactions', 'metadata'],
  additionalProperties: false,
  $defs: {
    ComponentSpec: {
      type: 'object',
      description: 'Component reference with typed props',
      properties: {
        id: {
          type: 'string',
          description: 'Unique component identifier',
          minLength: 1,
        },
        componentType: {
          type: 'string',
          description: 'Registered component type name',
          minLength: 1,
        },
        props: {
          type: 'object',
          description:
            'Component props as key-value pairs. MUST include ARIA accessibility props based on the component category: ' +
            'display → "aria-live": "polite"; ' +
            'input/form → "aria-label": "<descriptive text>"; ' +
            'interactive → "aria-label" or visible "label"/"text" prop; ' +
            'data → "aria-label" and "columns" array; ' +
            'image → "alt": "<description>"; ' +
            'navigation → "role": "navigation". ' +
            'Omitting required ARIA props will cause validation failure.',
          additionalProperties: true,
        },
        key: {
          anyOf: [{ type: 'string' }, { type: 'null' }],
          description: 'Optional key for component reconciliation',
        },
        children: {
          anyOf: [
            {
              type: 'array',
              items: { $ref: '#/$defs/ComponentSpec' },
            },
            { type: 'null' },
          ],
          description: 'Optional nested child components',
        },
      },
      required: ['id', 'componentType', 'props', 'key', 'children'],
      additionalProperties: false,
    },
    LayoutSpec: {
      type: 'object',
      description: 'Spatial arrangement of components',
      properties: {
        type: {
          type: 'string',
          enum: ['stack', 'grid', 'flex', 'absolute'],
          description: 'Layout strategy',
        },
        direction: {
          anyOf: [
            { type: 'string', enum: ['horizontal', 'vertical'] },
            { type: 'null' },
          ],
          description: 'Layout direction',
        },
        spacing: {
          anyOf: [{ type: 'number', minimum: 0 }, { type: 'null' }],
          description: 'Spacing between items in pixels',
        },
        alignment: {
          anyOf: [
            { type: 'string', enum: ['start', 'center', 'end', 'stretch'] },
            { type: 'null' },
          ],
          description: 'Alignment of items',
        },
        children: {
          anyOf: [
            {
              type: 'array',
              items: { $ref: '#/$defs/LayoutSpec' },
            },
            { type: 'null' },
          ],
          description: 'Nested layout containers',
        },
      },
      required: ['type', 'direction', 'spacing', 'alignment', 'children'],
      additionalProperties: false,
    },
    InteractionSpec: {
      type: 'object',
      description: 'Data flow wiring between components',
      properties: {
        source: {
          type: 'string',
          description: 'Source component ID',
          minLength: 1,
        },
        target: {
          type: 'string',
          description: 'Target component ID',
          minLength: 1,
        },
        event: {
          type: 'string',
          description: 'Event type that triggers the interaction',
          minLength: 1,
        },
        dataMapping: {
          anyOf: [
            {
              type: 'object',
              additionalProperties: { type: 'string' },
              description: 'Mapping of data fields from source to target',
            },
            { type: 'null' },
          ],
          description: 'Optional mapping of data fields from source to target',
        },
      },
      required: ['source', 'target', 'event', 'dataMapping'],
      additionalProperties: false,
    },
    UISpecificationMetadata: {
      type: 'object',
      description: 'Metadata about the generation',
      properties: {
        generatedAt: {
          type: 'integer',
          description: 'Timestamp of generation (Unix ms)',
          minimum: 0,
        },
        model: {
          anyOf: [{ type: 'string' }, { type: 'null' }],
          description: 'LLM model used for generation',
        },
        intentHash: {
          anyOf: [{ type: 'string' }, { type: 'null' }],
          description: 'Hash of the intent that triggered generation',
        },
        traceId: {
          anyOf: [{ type: 'string' }, { type: 'null' }],
          description: 'Trace ID for observability',
        },
        custom: {
          anyOf: [
            {
              type: 'object',
              additionalProperties: true,
              description: 'Custom metadata key-value pairs',
            },
            { type: 'null' },
          ],
          description: 'Custom metadata key-value pairs',
        },
      },
      required: ['generatedAt', 'model', 'intentHash', 'traceId', 'custom'],
      additionalProperties: false,
    },
  },
};
