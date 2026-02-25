import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import type { Result } from '../errors';
import { FluiError, isError, isOk } from '../errors';
import type {
  ComponentDefinition,
  RegistryEntry,
  SerializedComponent,
  SerializedRegistry,
} from './index';
import { ComponentRegistry, componentDefinitionSchema } from './index';

// ── Test fixtures ──────────────────────────────────────────────────────

const validPropsSchema = z.object({ title: z.string(), count: z.number() });

const validDefinition: ComponentDefinition = {
  name: 'KPICard',
  category: 'data',
  description: 'Displays a key performance indicator',
  accepts: validPropsSchema,
  component: () => 'mock-component',
};

const anotherValidDefinition: ComponentDefinition = {
  name: 'DataTable',
  category: 'data',
  description: 'Displays tabular data',
  accepts: z.object({ rows: z.array(z.unknown()) }),
  component: 'string-component',
};

const chartDefinition: ComponentDefinition = {
  name: 'BarChart',
  category: 'chart',
  description: 'Renders a bar chart',
  accepts: z.object({ data: z.array(z.number()) }),
  component: null,
  metadata: { interactive: true, theme: 'dark' },
};

const formDefinition: ComponentDefinition = {
  name: 'TextInput',
  category: 'form',
  description: 'A text input field',
  accepts: z.object({ label: z.string() }),
  component: null,
  metadata: { interactive: true },
};

const layoutDefinition: ComponentDefinition = {
  name: 'GridLayout',
  category: 'layout',
  description: 'A responsive grid layout',
  accepts: z.object({ columns: z.number() }),
  component: null,
};

// ── ComponentRegistry ──────────────────────────────────────────────────

describe('ComponentRegistry', () => {
  describe('register', () => {
    it('succeeds with valid definition and returns Result.ok', () => {
      const registry = new ComponentRegistry();
      const result = registry.register(validDefinition);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeUndefined();
      }
    });

    it('stores the component retrievable by name', () => {
      const registry = new ComponentRegistry();
      registry.register(validDefinition);
      const entry = registry.getByName('KPICard');
      expect(entry).toBeDefined();
      expect(entry?.name).toBe('KPICard');
      expect(entry?.category).toBe('data');
      expect(entry?.description).toBe('Displays a key performance indicator');
      expect(entry?.accepts).toBe(validPropsSchema);
      expect(entry?.component).toBe(validDefinition.component);
    });

    it('increments version on each registration', () => {
      const registry = new ComponentRegistry();
      expect(registry.version).toBe(0);
      registry.register(validDefinition);
      expect(registry.version).toBe(1);
      registry.register(anotherValidDefinition);
      expect(registry.version).toBe(2);
    });

    it('rejects missing name with Result.error containing FluiError', () => {
      const registry = new ComponentRegistry();
      const result = registry.register({
        ...validDefinition,
        name: '',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(FluiError);
        expect(result.error.code).toBe('FLUI_E005');
        expect(result.error.category).toBe('validation');
        expect(result.error.message).toContain('name');
      }
    });

    it('rejects empty category with Result.error', () => {
      const registry = new ComponentRegistry();
      const result = registry.register({
        ...validDefinition,
        category: '',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(FluiError);
        expect(result.error.code).toBe('FLUI_E005');
        expect(result.error.message).toContain('category');
      }
    });

    it('rejects missing description with Result.error', () => {
      const registry = new ComponentRegistry();
      const result = registry.register({
        ...validDefinition,
        description: '',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(FluiError);
        expect(result.error.code).toBe('FLUI_E005');
        expect(result.error.message).toContain('description');
      }
    });

    it('rejects invalid accepts (not a Zod schema) with Result.error', () => {
      const registry = new ComponentRegistry();
      const result = registry.register({
        ...validDefinition,
        // biome-ignore lint/suspicious/noExplicitAny: testing invalid input
        accepts: 'not-a-schema' as any,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(FluiError);
        expect(result.error.code).toBe('FLUI_E005');
      }
    });

    it('rejects duplicate name registration with Result.error', () => {
      const registry = new ComponentRegistry();
      registry.register(validDefinition);
      const result = registry.register({
        ...anotherValidDefinition,
        name: 'KPICard',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(FluiError);
        expect(result.error.code).toBe('FLUI_E005');
        expect(result.error.message).toContain("'KPICard'");
        expect(result.error.message).toContain('already registered');
      }
    });

    it('preserves original registration on duplicate attempt', () => {
      const registry = new ComponentRegistry();
      registry.register(validDefinition);
      registry.register({
        ...anotherValidDefinition,
        name: 'KPICard',
      });
      const entry = registry.getByName('KPICard');
      expect(entry?.description).toBe('Displays a key performance indicator');
    });

    it('does not increment version on failed registration', () => {
      const registry = new ComponentRegistry();
      registry.register(validDefinition);
      expect(registry.version).toBe(1);
      registry.register({ ...validDefinition, name: '' });
      expect(registry.version).toBe(1);
      registry.register(validDefinition); // duplicate
      expect(registry.version).toBe(1);
    });

    it('accepts unknown component values (no React awareness)', () => {
      const registry = new ComponentRegistry();
      const withNull = registry.register({ ...validDefinition, name: 'c1', component: null });
      expect(withNull.ok).toBe(true);
      const withNumber = registry.register({
        ...validDefinition,
        name: 'c2',
        component: 42,
      });
      expect(withNumber.ok).toBe(true);
      const withObject = registry.register({
        ...validDefinition,
        name: 'c3',
        component: { render: true },
      });
      expect(withObject.ok).toBe(true);
    });
  });

  describe('getByName', () => {
    it('returns undefined for unknown name', () => {
      const registry = new ComponentRegistry();
      expect(registry.getByName('NonExistent')).toBeUndefined();
    });

    it('returns the correct entry after multiple registrations', () => {
      const registry = new ComponentRegistry();
      registry.register(validDefinition);
      registry.register(anotherValidDefinition);
      const entry = registry.getByName('DataTable');
      expect(entry?.name).toBe('DataTable');
      expect(entry?.category).toBe('data');
    });
  });

  describe('version', () => {
    it('starts at 0', () => {
      const registry = new ComponentRegistry();
      expect(registry.version).toBe(0);
    });
  });

  describe('batchRegister', () => {
    it('registers all valid definitions and increments version once', () => {
      const registry = new ComponentRegistry();
      const result = registry.batchRegister([chartDefinition, formDefinition, layoutDefinition]);
      expect(result.ok).toBe(true);
      expect(registry.version).toBe(1);
      expect(registry.getByName('BarChart')).toBeDefined();
      expect(registry.getByName('TextInput')).toBeDefined();
      expect(registry.getByName('GridLayout')).toBeDefined();
    });

    it('returns Result.error listing all failures when one definition is invalid', () => {
      const registry = new ComponentRegistry();
      const invalidDef: ComponentDefinition = {
        ...chartDefinition,
        name: '',
      };
      const result = registry.batchRegister([formDefinition, invalidDef]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(FluiError);
        expect(result.error.code).toBe('FLUI_E005');
        expect(result.error.message).toContain('Batch registration failed with 1 error(s)');
      }
      expect(registry.getByName('TextInput')).toBeUndefined();
      expect(registry.version).toBe(0);
    });

    it('rejects intra-batch duplicate names and registers none', () => {
      const registry = new ComponentRegistry();
      const duplicate: ComponentDefinition = {
        ...formDefinition,
        name: 'BarChart',
        description: 'Duplicate bar chart',
      };
      const result = registry.batchRegister([chartDefinition, duplicate]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(FluiError);
        expect(result.error.code).toBe('FLUI_E005');
        expect(result.error.message).toContain('"BarChart"');
        expect(result.error.message).toContain('duplicate name within batch');
      }
      expect(registry.getByName('BarChart')).toBeUndefined();
      expect(registry.version).toBe(0);
    });

    it('rejects name conflicting with existing entry and registers none', () => {
      const registry = new ComponentRegistry();
      registry.register(validDefinition);
      expect(registry.version).toBe(1);

      const conflicting: ComponentDefinition = {
        ...chartDefinition,
        name: 'KPICard',
      };
      const result = registry.batchRegister([conflicting, formDefinition]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('"KPICard"');
        expect(result.error.message).toContain('already registered');
      }
      expect(registry.getByName('TextInput')).toBeUndefined();
      expect(registry.version).toBe(1);
    });

    it('returns Result.ok for empty array (no-op, no version change)', () => {
      const registry = new ComponentRegistry();
      const result = registry.batchRegister([]);
      expect(result.ok).toBe(true);
      expect(registry.version).toBe(0);
    });

    it('collects all errors from multiple invalid definitions', () => {
      const registry = new ComponentRegistry();
      const invalid1: ComponentDefinition = { ...chartDefinition, name: '' };
      const invalid2: ComponentDefinition = { ...formDefinition, category: '' };
      const result = registry.batchRegister([invalid1, invalid2]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('2 error(s)');
        expect(result.error.message).toContain('[0]');
        expect(result.error.message).toContain('[1]');
      }
    });

    it('numbers batch errors sequentially by error count, not input index', () => {
      const registry = new ComponentRegistry();
      const invalidSecond: ComponentDefinition = { ...formDefinition, name: '' };
      const result = registry.batchRegister([chartDefinition, invalidSecond]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('[0] ""');
        expect(result.error.message).not.toContain('[1] ""');
      }
    });

    it('preserves previously registered components on batch failure', () => {
      const registry = new ComponentRegistry();
      registry.register(validDefinition);
      const entry = registry.getByName('KPICard');
      expect(entry).toBeDefined();

      const conflicting: ComponentDefinition = { ...chartDefinition, name: 'KPICard' };
      registry.batchRegister([conflicting]);

      const preserved = registry.getByName('KPICard');
      expect(preserved?.description).toBe('Displays a key performance indicator');
    });

    it('stores metadata on batch-registered entries', () => {
      const registry = new ComponentRegistry();
      registry.batchRegister([chartDefinition, formDefinition]);
      const chart = registry.getByName('BarChart');
      expect(chart?.metadata).toEqual({ interactive: true, theme: 'dark' });
      const form = registry.getByName('TextInput');
      expect(form?.metadata).toEqual({ interactive: true });
    });
  });

  describe('queryByCategory', () => {
    it('returns matching entries for a given category', () => {
      const registry = new ComponentRegistry();
      registry.batchRegister([
        validDefinition,
        anotherValidDefinition,
        chartDefinition,
        formDefinition,
      ]);
      const dataEntries = registry.queryByCategory('data');
      expect(dataEntries).toHaveLength(2);
      expect(dataEntries.map((e) => e.name).sort()).toEqual(['DataTable', 'KPICard']);
    });

    it('returns empty array for no matches', () => {
      const registry = new ComponentRegistry();
      registry.register(validDefinition);
      const result = registry.queryByCategory('nonexistent');
      expect(result).toEqual([]);
    });

    it('returns empty array on empty registry', () => {
      const registry = new ComponentRegistry();
      const result = registry.queryByCategory('data');
      expect(result).toEqual([]);
    });

    it('is case-sensitive', () => {
      const registry = new ComponentRegistry();
      registry.register(chartDefinition);
      expect(registry.queryByCategory('Chart')).toEqual([]);
      expect(registry.queryByCategory('chart')).toHaveLength(1);
    });

    it('returns empty array for empty category query', () => {
      const registry = new ComponentRegistry();
      registry.batchRegister([validDefinition, chartDefinition]);
      expect(registry.queryByCategory('')).toEqual([]);
    });
  });

  describe('queryByMetadata', () => {
    it('returns matching entries by metadata key-value pairs', () => {
      const registry = new ComponentRegistry();
      registry.batchRegister([chartDefinition, formDefinition, layoutDefinition]);
      const result = registry.queryByMetadata({ interactive: true });
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.name).sort()).toEqual(['BarChart', 'TextInput']);
    });

    it('returns empty array for components without metadata', () => {
      const registry = new ComponentRegistry();
      registry.register(validDefinition);
      const result = registry.queryByMetadata({ interactive: true });
      expect(result).toEqual([]);
    });

    it('requires ALL query keys to match (subset match)', () => {
      const registry = new ComponentRegistry();
      registry.batchRegister([chartDefinition, formDefinition]);
      const result = registry.queryByMetadata({ interactive: true, theme: 'dark' });
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('BarChart');
    });

    it('returns all entries with metadata defined when query is empty object', () => {
      const registry = new ComponentRegistry();
      registry.batchRegister([chartDefinition, formDefinition, layoutDefinition, validDefinition]);
      const result = registry.queryByMetadata({});
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.name).sort()).toEqual(['BarChart', 'TextInput']);
    });

    it('returns empty array on empty registry', () => {
      const registry = new ComponentRegistry();
      const result = registry.queryByMetadata({ interactive: true });
      expect(result).toEqual([]);
    });

    it('uses strict equality for value comparison', () => {
      const registry = new ComponentRegistry();
      registry.register(chartDefinition);
      expect(registry.queryByMetadata({ interactive: 'true' })).toEqual([]);
      expect(registry.queryByMetadata({ interactive: 1 })).toEqual([]);
      expect(registry.queryByMetadata({ interactive: true })).toHaveLength(1);
    });
  });

  describe('getAll', () => {
    it('returns all registered entries', () => {
      const registry = new ComponentRegistry();
      registry.batchRegister([validDefinition, chartDefinition, formDefinition]);
      const all = registry.getAll();
      expect(all).toHaveLength(3);
      expect(all.map((e) => e.name).sort()).toEqual(['BarChart', 'KPICard', 'TextInput']);
    });

    it('returns empty array on empty registry', () => {
      const registry = new ComponentRegistry();
      expect(registry.getAll()).toEqual([]);
    });
  });
});

// ── componentDefinitionSchema ──────────────────────────────────────────

describe('componentDefinitionSchema', () => {
  it('validates a correct ComponentDefinition', () => {
    const result = componentDefinitionSchema.safeParse(validDefinition);
    expect(result.success).toBe(true);
  });

  it('rejects extra properties (strictObject)', () => {
    const result = componentDefinitionSchema.safeParse({
      ...validDefinition,
      extraField: 'should fail',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-string name', () => {
    const result = componentDefinitionSchema.safeParse({
      ...validDefinition,
      name: 123,
    });
    expect(result.success).toBe(false);
  });
});

// ── Result type integration ────────────────────────────────────────────

describe('Result type integration', () => {
  it('register result narrows correctly with isOk', () => {
    const registry = new ComponentRegistry();
    const result: Result<void, FluiError> = registry.register(validDefinition);
    if (isOk(result)) {
      expect(result.value).toBeUndefined();
    } else {
      expect.unreachable('Expected ok result');
    }
  });

  it('register error narrows correctly with isError', () => {
    const registry = new ComponentRegistry();
    const result: Result<void, FluiError> = registry.register({
      ...validDefinition,
      name: '',
    });
    if (isError(result)) {
      expectTypeOf(result.error).toMatchTypeOf<FluiError>();
      expect(result.error.code).toBe('FLUI_E005');
    } else {
      expect.unreachable('Expected error result');
    }
  });
});

// ── Barrel exports ─────────────────────────────────────────────────────

describe('barrel exports', () => {
  it('exports ComponentRegistry from registry barrel', async () => {
    const api = await import('./index');
    expect(api.ComponentRegistry).toBeDefined();
  });

  it('exports componentDefinitionSchema from registry barrel', async () => {
    const api = await import('./index');
    expect(api.componentDefinitionSchema).toBeDefined();
  });

  it('exports all registry types from @flui/core barrel', async () => {
    const api = await import('../index');
    expect(api.ComponentRegistry).toBeDefined();
    expect(api.componentDefinitionSchema).toBeDefined();
  });

  it('type exports are accessible', () => {
    expectTypeOf<ComponentDefinition>().toHaveProperty('name');
    expectTypeOf<ComponentDefinition>().toHaveProperty('category');
    expectTypeOf<ComponentDefinition>().toHaveProperty('description');
    expectTypeOf<ComponentDefinition>().toHaveProperty('accepts');
    expectTypeOf<ComponentDefinition>().toHaveProperty('component');

    expectTypeOf<RegistryEntry>().toHaveProperty('name');
    expectTypeOf<RegistryEntry>().toHaveProperty('category');

    expectTypeOf<SerializedComponent>().toHaveProperty('propsSchema');
    expectTypeOf<SerializedRegistry>().toHaveProperty('version');
    expectTypeOf<SerializedRegistry>().toHaveProperty('components');
  });
});
