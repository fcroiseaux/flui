import { describe, expect, it } from 'vitest';
import type { AggregatedContext } from '../context/context.types';
import type { IntentObject } from '../intent/intent.types';
import type { SerializedRegistry } from '../registry/registry.types';
import { SPEC_VERSION } from '../spec';
import type { GenerationInput } from './generation.types';
import { createPromptBuilder } from './prompt-builder';

function makeInput(overrides?: Partial<GenerationInput>): GenerationInput {
  const intent: IntentObject = {
    originalText: 'show a user table',
    sanitizedText: 'show a user table',
    signals: {},
    source: 'text',
  };

  const context: AggregatedContext = {
    identity: { role: 'admin', permissions: ['read', 'write'], expertiseLevel: 'expert' },
    environment: {
      deviceType: 'desktop',
      viewportSize: { width: 1920, height: 1080 },
      connectionQuality: 'fast',
    },
  };

  const registry: SerializedRegistry = {
    version: 1,
    components: [
      {
        name: 'DataTable',
        category: 'data',
        description: 'Displays tabular data',
        propsSchema: { type: 'object', properties: { columns: { type: 'array' } } },
      },
      {
        name: 'Button',
        category: 'input',
        description: 'A clickable button',
        propsSchema: { type: 'object', properties: { label: { type: 'string' } } },
      },
    ],
  };

  return { intent, context, registry, ...overrides };
}

describe('PromptBuilder', () => {
  const builder = createPromptBuilder();

  it('includes serialized registry components', () => {
    const input = makeInput();
    const prompt = builder.build(input);
    expect(prompt).toContain('DataTable');
    expect(prompt).toContain('Button');
    expect(prompt).toContain('Displays tabular data');
    expect(prompt).toContain('A clickable button');
    expect(prompt).toContain('Registry Version: 1');
    expect(prompt).toContain('"category":"data"');
    expect(prompt).toContain('"category":"input"');
  });

  it('includes context signals (identity, environment)', () => {
    const input = makeInput();
    const prompt = builder.build(input);
    expect(prompt).toContain('admin');
    expect(prompt).toContain('desktop');
    expect(prompt).toContain('1920');
    expect(prompt).toContain('fast');
  });

  it('includes intent text and signals', () => {
    const input = makeInput({
      intent: {
        originalText: 'create a data grid',
        sanitizedText: 'create a data grid',
        signals: {
          componentType: 'DataTable',
          dataShape: { users: 'array' },
          interactionPattern: 'sortable',
        },
        source: 'structured',
      },
    });
    const prompt = builder.build(input);
    expect(prompt).toContain('create a data grid');
    expect(prompt).toContain('Component Type: DataTable');
    expect(prompt).toContain('Data Shape:');
    expect(prompt).toContain('Interaction Pattern: sortable');
  });

  it('includes UISpecification schema contract', () => {
    const input = makeInput();
    const prompt = builder.build(input);
    expect(prompt).toContain('OUTPUT SCHEMA (UISpecification)');
    expect(prompt).toContain('"version"');
    expect(prompt).toContain('"components"');
    expect(prompt).toContain('"layout"');
    expect(prompt).toContain('"interactions"');
    expect(prompt).toContain('"metadata"');
    expect(prompt).toContain('"componentType"');
  });

  it('includes SPEC_VERSION in the schema contract', () => {
    const input = makeInput();
    const prompt = builder.build(input);
    expect(prompt).toContain(SPEC_VERSION);
  });

  it('includes generation rules in system instructions', () => {
    const input = makeInput();
    const prompt = builder.build(input);
    expect(prompt).toContain('Output ONLY valid JSON');
    expect(prompt).toContain('Use ONLY components from the available registry');
  });

  it('handles empty context', () => {
    const input = makeInput({ context: {} });
    const prompt = builder.build(input);
    expect(prompt).not.toContain('CONTEXT:');
    expect(prompt).toContain('INTENT:');
  });

  it('handles intent without signals', () => {
    const input = makeInput({
      intent: {
        originalText: 'simple text',
        sanitizedText: 'simple text',
        signals: {},
        source: 'text',
      },
    });
    const prompt = builder.build(input);
    expect(prompt).toContain('simple text');
    expect(prompt).not.toContain('Component Type:');
    expect(prompt).not.toContain('Data Shape:');
    expect(prompt).not.toContain('Interaction Pattern:');
  });
});
