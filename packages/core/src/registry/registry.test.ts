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
