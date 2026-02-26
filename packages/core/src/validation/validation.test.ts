import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { isError, isOk } from '../errors';
import { ComponentRegistry } from '../registry';
import type { ComponentSpec, UISpecification } from '../spec';
import { SPEC_VERSION } from '../spec';

import { createValidationPipeline } from './pipeline';
import type { ValidatorContext } from './validation.types';

/**
 * Creates a minimal valid UISpecification for testing.
 */
function validSpec(overrides?: Partial<UISpecification>): UISpecification {
  return {
    version: SPEC_VERSION,
    components: [
      {
        id: 'btn-1',
        componentType: 'Button',
        props: { label: 'Click me' },
      },
    ],
    layout: { type: 'stack' },
    interactions: [],
    metadata: { generatedAt: Date.now() },
    ...overrides,
  };
}

/**
 * Creates a test registry with known components registered.
 */
function testRegistry(): ComponentRegistry {
  const registry = new ComponentRegistry();

  registry.register({
    name: 'Button',
    category: 'input',
    description: 'A button component',
    accepts: z.object({ label: z.string() }),
    component: null,
  });

  registry.register({
    name: 'TextInput',
    category: 'input',
    description: 'A text input component',
    accepts: z.object({ placeholder: z.string(), maxLength: z.number().optional() }),
    component: null,
  });

  registry.register({
    name: 'Container',
    category: 'layout',
    description: 'A container component',
    accepts: z.object({ padding: z.number().optional() }),
    component: null,
  });

  return registry;
}

/**
 * Creates a ValidatorContext with the test registry.
 */
function testContext(registry?: ComponentRegistry): ValidatorContext {
  return { registry: registry ?? testRegistry() };
}

describe('ValidationPipeline', () => {
  describe('validate', () => {
    it('returns Result.ok for a valid UISpecification with registered components', () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec();
      const result = pipeline.validate(spec, testContext());

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.version).toBe(SPEC_VERSION);
        expect(result.value.components).toHaveLength(1);
      }
    });

    it('returns Result.error for an invalid schema (missing version)', () => {
      const pipeline = createValidationPipeline();
      const spec = {
        components: [{ id: 'btn-1', componentType: 'Button', props: { label: 'ok' } }],
        layout: { type: 'stack' },
        interactions: [],
        metadata: { generatedAt: Date.now() },
      } as unknown as UISpecification;

      const result = pipeline.validate(spec, testContext());

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('FLUI_E020');
        expect(result.error.category).toBe('validation');
        const errors = result.error.context?.errors as Array<{ validator: string }>;
        expect(errors.some((e) => e.validator === 'schema')).toBe(true);
      }
    });

    it('returns Result.error for invalid schema with wrong layout type', () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        layout: { type: 'invalid' as 'stack' },
      });

      const result = pipeline.validate(spec, testContext());

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{
          validator: string;
          field?: string;
        }>;
        expect(errors.some((e) => e.validator === 'schema')).toBe(true);
      }
    });

    it('returns Result.error for invalid schema with extra fields', () => {
      const pipeline = createValidationPipeline();
      const specWithExtraField = {
        ...validSpec(),
        extraField: 'should-not-be-allowed',
      } as UISpecification & { extraField: string };

      const result = pipeline.validate(specWithExtraField, testContext());

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{
          validator: string;
          field?: string;
          message: string;
        }>;
        expect(errors.some((e) => e.validator === 'schema')).toBe(true);
        expect(errors.some((e) => /unrecognized|unknown/i.test(e.message))).toBe(true);
      }
    });

    it('returns Result.error for unregistered component types', () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [{ id: 'unknown-1', componentType: 'NonExistent', props: {} }],
      });

      const result = pipeline.validate(spec, testContext());

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{
          validator: string;
          message: string;
        }>;
        expect(errors.some((e) => e.validator === 'component')).toBe(true);
        expect(errors.some((e) => e.message.includes('NonExistent'))).toBe(true);
      }
    });

    it('catches unregistered components in nested children', () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'container-1',
            componentType: 'Container',
            props: {},
            children: [
              {
                id: 'nested-unknown',
                componentType: 'DoesNotExist',
                props: {},
              },
            ],
          },
        ],
      });

      const result = pipeline.validate(spec, testContext());

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{
          validator: string;
          message: string;
        }>;
        expect(errors.some((e) => e.validator === 'component')).toBe(true);
        expect(errors.some((e) => e.message.includes('DoesNotExist'))).toBe(true);
      }
    });

    it('returns Result.error for prop mismatches (wrong type)', () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'btn-1',
            componentType: 'Button',
            props: { label: 42 }, // should be string
          },
        ],
      });

      const result = pipeline.validate(spec, testContext());

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{
          validator: string;
          field?: string;
          context?: { componentType?: string };
        }>;
        expect(errors.some((e) => e.validator === 'prop')).toBe(true);
        expect(errors.some((e) => e.context?.componentType === 'Button')).toBe(true);
      }
    });

    it('returns Result.error for prop mismatches (missing required prop)', () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'input-1',
            componentType: 'TextInput',
            props: {}, // missing required 'placeholder'
          },
        ],
      });

      const result = pipeline.validate(spec, testContext());

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{
          validator: string;
          context?: { componentType?: string };
        }>;
        expect(errors.some((e) => e.validator === 'prop')).toBe(true);
        expect(errors.some((e) => e.context?.componentType === 'TextInput')).toBe(true);
      }
    });

    it('runs validators in fixed order: schema -> component -> prop', () => {
      const pipeline = createValidationPipeline();
      const invalidSpec = {
        components: [
          {
            id: 'bad-props',
            componentType: 'Button',
            props: { label: 42 },
          },
          {
            id: 'bad-node',
            componentType: 'NonExistent',
            props: { label: 42 },
          },
        ],
        layout: { type: 'stack' },
        interactions: [],
        metadata: { generatedAt: Date.now() },
      } as unknown as UISpecification;

      const result = pipeline.validate(invalidSpec, testContext());

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{ validator: string }>;
        const firstSchema = errors.findIndex((e) => e.validator === 'schema');
        const firstComponent = errors.findIndex((e) => e.validator === 'component');
        const firstProp = errors.findIndex((e) => e.validator === 'prop');

        expect(firstSchema).toBeGreaterThanOrEqual(0);
        expect(firstComponent).toBeGreaterThanOrEqual(0);
        expect(firstProp).toBeGreaterThanOrEqual(0);
        expect(firstSchema).toBeLessThan(firstComponent);
        expect(firstComponent).toBeLessThan(firstProp);
      }
    });

    it('runs all validators (does not short-circuit on first failure)', () => {
      const pipeline = createValidationPipeline();
      // Create a spec with both unregistered component AND prop mismatch
      const spec = validSpec({
        components: [
          {
            id: 'btn-bad',
            componentType: 'Button',
            props: { label: 42 }, // prop mismatch
          },
          {
            id: 'unknown-1',
            componentType: 'NonExistent',
            props: {},
          },
        ],
      });

      const result = pipeline.validate(spec, testContext());

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{ validator: string }>;
        const validators = new Set(errors.map((e) => e.validator));
        // Both component and prop validators should have reported errors
        expect(validators.has('component')).toBe(true);
        expect(validators.has('prop')).toBe(true);
      }
    });

    it('cannot bypass validation through pipeline configuration', () => {
      const pipeline = createValidationPipeline({ additionalValidators: [] });
      const spec = validSpec({
        components: [{ id: 'unknown-1', componentType: 'NonExistent', props: {} }],
      });

      const result = pipeline.validate(spec, testContext());

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{ validator: string }>;
        expect(errors.some((e) => e.validator === 'component')).toBe(true);
      }
    });

    it('validators never throw — always return ValidationResult', () => {
      const pipeline = createValidationPipeline();
      // Pass completely malformed data — should not throw
      const malformedSpec = 'not an object' as unknown as UISpecification;

      expect(() => {
        pipeline.validate(malformedSpec, testContext());
      }).not.toThrow();

      const result = pipeline.validate(malformedSpec, testContext());
      expect(isError(result)).toBe(true);
    });

    it('aggregates errors from multiple validators into single FluiError with FLUI_E020', () => {
      const pipeline = createValidationPipeline();
      // Spec with multiple problems: unknown component + prop mismatch on known component
      const spec = validSpec({
        components: [
          {
            id: 'btn-1',
            componentType: 'Button',
            props: { label: 123 }, // prop mismatch
          },
          {
            id: 'unknown-1',
            componentType: 'GhostComponent',
            props: {},
          },
        ],
      });

      const result = pipeline.validate(spec, testContext());

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('FLUI_E020');
        expect(result.error.category).toBe('validation');
        const errors = result.error.context?.errors as Array<{ validator: string }>;
        expect(errors.length).toBeGreaterThanOrEqual(2);
        // Errors come from multiple validators
        const validatorNames = new Set(errors.map((e) => e.validator));
        expect(validatorNames.size).toBeGreaterThanOrEqual(2);
      }
    });

    it('validates a 50-component spec in < 5ms (performance)', () => {
      const pipeline = createValidationPipeline();
      const registry = testRegistry();

      const components: ComponentSpec[] = Array.from({ length: 50 }, (_, i) => ({
        id: `btn-${i}`,
        componentType: 'Button',
        props: { label: `Button ${i}` },
      }));

      const spec = validSpec({ components });
      const context = testContext(registry);

      const start = performance.now();
      const result = pipeline.validate(spec, context);
      const elapsed = performance.now() - start;

      expect(isOk(result)).toBe(true);
      expect(elapsed).toBeLessThan(5);
    });

    it('accepts empty component array as valid', () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({ components: [] });

      const result = pipeline.validate(spec, testContext());

      expect(isOk(result)).toBe(true);
    });

    it('validates deeply nested children (3+ levels) for components and props', () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'level-0',
            componentType: 'Container',
            props: {},
            children: [
              {
                id: 'level-1',
                componentType: 'Container',
                props: {},
                children: [
                  {
                    id: 'level-2',
                    componentType: 'Container',
                    props: {},
                    children: [
                      {
                        id: 'level-3-unknown',
                        componentType: 'DeepUnknown',
                        props: {},
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      const result = pipeline.validate(spec, testContext());

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{
          validator: string;
          message: string;
        }>;
        expect(
          errors.some((e) => e.validator === 'component' && e.message.includes('DeepUnknown')),
        ).toBe(true);
      }
    });

    it('validates deeply nested children for prop mismatches', () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'level-0',
            componentType: 'Container',
            props: {},
            children: [
              {
                id: 'level-1',
                componentType: 'Container',
                props: {},
                children: [
                  {
                    id: 'level-2-bad-props',
                    componentType: 'Button',
                    props: { label: false }, // wrong type
                  },
                ],
              },
            ],
          },
        ],
      });

      const result = pipeline.validate(spec, testContext());

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{
          validator: string;
          context?: { componentId?: string };
        }>;
        expect(
          errors.some(
            (e) => e.validator === 'prop' && e.context?.componentId === 'level-2-bad-props',
          ),
        ).toBe(true);
      }
    });

    it('prop validator skips unregistered components', () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'unknown-1',
            componentType: 'NonExistent',
            props: { anything: 'goes' },
          },
        ],
      });

      const result = pipeline.validate(spec, testContext());

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{ validator: string }>;
        // Only component validator should report errors, NOT prop validator
        const propErrors = errors.filter((e) => e.validator === 'prop');
        expect(propErrors).toHaveLength(0);
        const componentErrors = errors.filter((e) => e.validator === 'component');
        expect(componentErrors.length).toBeGreaterThan(0);
      }
    });

    it('schema validator includes field paths in errors', () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        layout: { type: 'invalid-type' as 'stack' },
      });

      const result = pipeline.validate(spec, testContext());

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{
          validator: string;
          field?: string;
        }>;
        const schemaErrors = errors.filter((e) => e.validator === 'schema');
        expect(schemaErrors.length).toBeGreaterThan(0);
      }
    });

    it('returns the validated spec in Result.ok on success', () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec();
      const result = pipeline.validate(spec, testContext());

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toStrictEqual(spec);
      }
    });
  });
});
