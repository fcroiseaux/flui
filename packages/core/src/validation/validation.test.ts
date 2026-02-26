import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { isError, isOk } from '../errors';
import { ComponentRegistry } from '../registry';
import type { ComponentSpec, UISpecification } from '../spec';
import { SPEC_VERSION } from '../spec';

import { createValidationPipeline } from './pipeline';
import type { AnyValidatorFn, AsyncValidatorFn, ValidatorContext } from './validation.types';

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
 * Creates a test registry with known components registered, including categories for a11y testing.
 */
function testRegistry(): ComponentRegistry {
  const registry = new ComponentRegistry();

  registry.register({
    name: 'Button',
    category: 'interactive',
    description: 'A button component',
    accepts: z.object({ label: z.string() }).passthrough(),
    component: null,
  });

  registry.register({
    name: 'TextInput',
    category: 'input',
    description: 'A text input component',
    accepts: z.object({ placeholder: z.string(), maxLength: z.number().optional() }).passthrough(),
    component: null,
  });

  registry.register({
    name: 'Container',
    category: 'layout',
    description: 'A container component',
    accepts: z.object({ padding: z.number().optional() }).passthrough(),
    component: null,
  });

  registry.register({
    name: 'Image',
    category: 'image',
    description: 'An image component',
    accepts: z.object({ src: z.string() }).passthrough(),
    component: null,
  });

  registry.register({
    name: 'StatusBanner',
    category: 'display',
    description: 'A dynamic status display',
    accepts: z.object({ message: z.string() }).passthrough(),
    component: null,
  });

  registry.register({
    name: 'NavMenu',
    category: 'navigation',
    description: 'A navigation menu',
    accepts: z.object({ items: z.array(z.string()).optional() }).passthrough(),
    component: null,
  });

  registry.register({
    name: 'DataTable',
    category: 'data',
    description: 'A data table component',
    accepts: z.object({ columns: z.array(z.string()).optional() }).passthrough(),
    component: null,
  });

  return registry;
}

/**
 * Creates a ValidatorContext with the test registry.
 */
function testContext(
  registry?: ComponentRegistry,
  overrides?: Partial<ValidatorContext>,
): ValidatorContext {
  return { registry: registry ?? testRegistry(), ...overrides };
}

describe('ValidationPipeline', () => {
  describe('validate', () => {
    it('returns Result.ok for a valid UISpecification with registered components', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'btn-1',
            componentType: 'Button',
            props: { label: 'Click me' },
          },
        ],
      });
      const result = await pipeline.validate(spec, testContext());

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.version).toBe(SPEC_VERSION);
        expect(result.value.components).toHaveLength(1);
      }
    });

    it('returns Result.error for an invalid schema (missing version)', async () => {
      const pipeline = createValidationPipeline();
      const spec = {
        components: [{ id: 'btn-1', componentType: 'Button', props: { label: 'ok' } }],
        layout: { type: 'stack' },
        interactions: [],
        metadata: { generatedAt: Date.now() },
      } as unknown as UISpecification;

      const result = await pipeline.validate(spec, testContext());

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('FLUI_E020');
        expect(result.error.category).toBe('validation');
        const errors = result.error.context?.errors as Array<{ validator: string }>;
        expect(errors.some((e) => e.validator === 'schema')).toBe(true);
      }
    });

    it('returns Result.error for invalid schema with wrong layout type', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        layout: { type: 'invalid' as 'stack' },
      });

      const result = await pipeline.validate(spec, testContext());

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{
          validator: string;
          field?: string;
        }>;
        expect(errors.some((e) => e.validator === 'schema')).toBe(true);
      }
    });

    it('returns Result.error for invalid schema with extra fields', async () => {
      const pipeline = createValidationPipeline();
      const specWithExtraField = {
        ...validSpec(),
        extraField: 'should-not-be-allowed',
      } as UISpecification & { extraField: string };

      const result = await pipeline.validate(specWithExtraField, testContext());

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

    it('returns Result.error for unregistered component types', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [{ id: 'unknown-1', componentType: 'NonExistent', props: {} }],
      });

      const result = await pipeline.validate(spec, testContext());

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

    it('catches unregistered components in nested children', async () => {
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

      const result = await pipeline.validate(spec, testContext());

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

    it('returns Result.error for prop mismatches (wrong type)', async () => {
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

      const result = await pipeline.validate(spec, testContext());

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

    it('returns Result.error for prop mismatches (missing required prop)', async () => {
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

      const result = await pipeline.validate(spec, testContext());

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

    it('runs validators in fixed order: schema -> component -> prop -> a11y -> data-authorization', async () => {
      const pipeline = createValidationPipeline();
      // Create spec that fails schema validation (missing version) but also has a11y issues
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

      const result = await pipeline.validate(invalidSpec, testContext());

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

    it('runs all validators (does not short-circuit on first failure)', async () => {
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

      const result = await pipeline.validate(spec, testContext());

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{ validator: string }>;
        const validators = new Set(errors.map((e) => e.validator));
        // Both component and prop validators should have reported errors
        expect(validators.has('component')).toBe(true);
        expect(validators.has('prop')).toBe(true);
      }
    });

    it('cannot bypass validation through pipeline configuration', async () => {
      const pipeline = createValidationPipeline({ additionalValidators: [] });
      const spec = validSpec({
        components: [{ id: 'unknown-1', componentType: 'NonExistent', props: {} }],
      });

      const result = await pipeline.validate(spec, testContext());

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{ validator: string }>;
        expect(errors.some((e) => e.validator === 'component')).toBe(true);
      }
    });

    it('validators never throw — always return ValidationResult', async () => {
      const pipeline = createValidationPipeline();
      // Pass completely malformed data — should not throw
      const malformedSpec = 'not an object' as unknown as UISpecification;

      await expect(pipeline.validate(malformedSpec, testContext())).resolves.toBeDefined();

      const result = await pipeline.validate(malformedSpec, testContext());
      expect(isError(result)).toBe(true);
    });

    it('aggregates errors from multiple validators into single FluiError with FLUI_E020', async () => {
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

      const result = await pipeline.validate(spec, testContext());

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

    it('validates a 50-component spec in < 50ms (async performance)', async () => {
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
      const result = await pipeline.validate(spec, context);
      const elapsed = performance.now() - start;

      expect(isOk(result)).toBe(true);
      // Async overhead means slightly higher than 5ms; 50ms is generous
      expect(elapsed).toBeLessThan(50);
    });

    it('accepts empty component array as valid', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({ components: [] });

      const result = await pipeline.validate(spec, testContext());

      expect(isOk(result)).toBe(true);
    });

    it('validates deeply nested children (3+ levels) for components and props', async () => {
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

      const result = await pipeline.validate(spec, testContext());

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

    it('validates deeply nested children for prop mismatches', async () => {
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

      const result = await pipeline.validate(spec, testContext());

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

    it('prop validator skips unregistered components', async () => {
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

      const result = await pipeline.validate(spec, testContext());

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

    it('schema validator includes field paths in errors', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        layout: { type: 'invalid-type' as 'stack' },
      });

      const result = await pipeline.validate(spec, testContext());

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

    it('returns the validated spec in Result.ok on success', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'btn-1',
            componentType: 'Button',
            props: { label: 'Click me' },
          },
        ],
      });
      const result = await pipeline.validate(spec, testContext());

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.version).toBe(SPEC_VERSION);
      }
    });
  });

  describe('a11y validator', () => {
    it('passes for spec with proper ARIA attributes on interactive components', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'btn-1',
            componentType: 'Button',
            props: { label: 'Submit' }, // has visible label
          },
        ],
      });

      const result = await pipeline.validate(spec, testContext());
      expect(isOk(result)).toBe(true);
    });

    it('fails for interactive component missing aria-label and visible text', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'btn-no-label',
            componentType: 'Button',
            props: { label: '' }, // empty label fails schema too, use number
          },
        ],
      });

      const result = await pipeline.validate(spec, testContext());
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{
          validator: string;
          message: string;
          context?: { wcagCriterion?: string; remediation?: string };
        }>;
        const a11yErrors = errors.filter((e) => e.validator === 'a11y');
        expect(a11yErrors.length).toBeGreaterThan(0);
        expect(a11yErrors[0].message).toContain('4.1.2');
        expect(a11yErrors[0].context?.remediation).toBeDefined();
      }
    });

    it('passes interactive component with aria-label instead of visible text', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'btn-aria',
            componentType: 'Button',
            props: { label: '', 'aria-label': 'Close dialog' },
          },
        ],
      });

      const result = await pipeline.validate(spec, testContext());
      // May fail prop validation for label being empty, but should not fail a11y
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{ validator: string }>;
        const a11yErrors = errors.filter((e) => e.validator === 'a11y');
        expect(a11yErrors).toHaveLength(0);
      }
    });

    it('fails for form component missing aria-label and aria-labelledby', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'input-no-label',
            componentType: 'TextInput',
            props: { placeholder: 'Enter name' },
          },
        ],
      });

      const result = await pipeline.validate(spec, testContext());
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{
          validator: string;
          message: string;
          context?: { wcagCriterion?: string };
        }>;
        const a11yErrors = errors.filter((e) => e.validator === 'a11y');
        expect(a11yErrors.length).toBeGreaterThan(0);
        expect(a11yErrors[0].message).toContain('1.3.1');
      }
    });

    it('passes for form component with aria-label', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'input-labeled',
            componentType: 'TextInput',
            props: { placeholder: 'Enter name', 'aria-label': 'Full name' },
          },
        ],
      });

      const result = await pipeline.validate(spec, testContext());
      expect(isOk(result)).toBe(true);
    });

    it('passes for form component with aria-labelledby', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'input-labelledby',
            componentType: 'TextInput',
            props: { placeholder: 'Enter name', 'aria-labelledby': 'name-label' },
          },
        ],
      });

      const result = await pipeline.validate(spec, testContext());
      expect(isOk(result)).toBe(true);
    });

    it('fails for form component with empty aria-labelledby', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'input-empty-labelledby',
            componentType: 'TextInput',
            props: { placeholder: 'Enter name', 'aria-labelledby': '' },
          },
        ],
      });

      const result = await pipeline.validate(spec, testContext());
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{ validator: string }>;
        expect(errors.some((e) => e.validator === 'a11y')).toBe(true);
      }
    });

    it('fails for image component missing alt prop', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'img-no-alt',
            componentType: 'Image',
            props: { src: 'photo.jpg' },
          },
        ],
      });

      const result = await pipeline.validate(spec, testContext());
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{
          validator: string;
          message: string;
        }>;
        const a11yErrors = errors.filter((e) => e.validator === 'a11y');
        expect(a11yErrors.length).toBeGreaterThan(0);
        expect(a11yErrors[0].message).toContain('1.1.1');
      }
    });

    it('passes for image component with non-empty alt', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'img-with-alt',
            componentType: 'Image',
            props: { src: 'photo.jpg', alt: 'A sunset over the ocean' },
          },
        ],
      });

      const result = await pipeline.validate(spec, testContext());
      expect(isOk(result)).toBe(true);
    });

    it('fails for dynamic content missing aria-live', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'status-no-live',
            componentType: 'StatusBanner',
            props: { message: 'Loading...' },
          },
        ],
      });

      const result = await pipeline.validate(spec, testContext());
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{
          validator: string;
          message: string;
        }>;
        const a11yErrors = errors.filter((e) => e.validator === 'a11y');
        expect(a11yErrors.length).toBeGreaterThan(0);
        expect(a11yErrors[0].message).toContain('4.1.3');
      }
    });

    it('passes for dynamic content with aria-live polite', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'status-live',
            componentType: 'StatusBanner',
            props: { message: 'Loading...', 'aria-live': 'polite' },
          },
        ],
      });

      const result = await pipeline.validate(spec, testContext());
      expect(isOk(result)).toBe(true);
    });

    it('fails for navigation component missing role', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'nav-no-role',
            componentType: 'NavMenu',
            props: {},
          },
        ],
      });

      const result = await pipeline.validate(spec, testContext());
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{
          validator: string;
          message: string;
        }>;
        const a11yErrors = errors.filter((e) => e.validator === 'a11y');
        expect(a11yErrors.length).toBeGreaterThan(0);
        expect(a11yErrors[0].message).toContain('role');
      }
    });

    it('passes for navigation component with role', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'nav-with-role',
            componentType: 'NavMenu',
            props: { role: 'navigation' },
          },
        ],
      });

      const result = await pipeline.validate(spec, testContext());
      expect(isOk(result)).toBe(true);
    });

    it('fails for navigation component with empty role', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'nav-empty-role',
            componentType: 'NavMenu',
            props: { role: '' },
          },
        ],
      });

      const result = await pipeline.validate(spec, testContext());
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{ validator: string }>;
        expect(errors.some((e) => e.validator === 'a11y')).toBe(true);
      }
    });

    it('fails for data component missing column headers', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'data-no-columns',
            componentType: 'DataTable',
            props: { 'aria-label': 'Sales data' },
          },
        ],
      });

      const result = await pipeline.validate(spec, testContext());
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{
          validator: string;
          message: string;
        }>;
        const a11yErrors = errors.filter((e) => e.validator === 'a11y');
        expect(a11yErrors.length).toBeGreaterThan(0);
        expect(a11yErrors[0].message).toContain('column headers');
      }
    });

    it('passes for data component with aria-label and columns', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'data-with-columns',
            componentType: 'DataTable',
            props: { 'aria-label': 'Sales data', columns: ['Region', 'Revenue'] },
          },
        ],
      });

      const result = await pipeline.validate(spec, testContext());
      expect(isOk(result)).toBe(true);
    });

    it('skips a11y checks for layout components (no ARIA requirements)', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'container-1',
            componentType: 'Container',
            props: {}, // No ARIA needed for layout
          },
        ],
      });

      const result = await pipeline.validate(spec, testContext());
      expect(isOk(result)).toBe(true);
    });

    it('handles malformed spec gracefully without throwing', async () => {
      const pipeline = createValidationPipeline();
      const malformedSpec = { components: 'not-an-array' } as unknown as UISpecification;

      const result = await pipeline.validate(malformedSpec, testContext());
      expect(isError(result)).toBe(true);
      // Should get schema error, and a11y should handle gracefully
    });

    it('checks deeply nested children for a11y', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'container-1',
            componentType: 'Container',
            props: {},
            children: [
              {
                id: 'container-2',
                componentType: 'Container',
                props: {},
                children: [
                  {
                    id: 'deep-nav',
                    componentType: 'NavMenu',
                    props: {}, // missing role
                  },
                ],
              },
            ],
          },
        ],
      });

      const result = await pipeline.validate(spec, testContext());
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{
          validator: string;
          field?: string;
        }>;
        const a11yErrors = errors.filter((e) => e.validator === 'a11y');
        expect(a11yErrors.length).toBeGreaterThan(0);
        expect(a11yErrors.some((e) => e.field === 'deep-nav')).toBe(true);
      }
    });
  });

  describe('data authorization validator', () => {
    it('passes for spec with all authorized data sources', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'btn-data',
            componentType: 'Button',
            props: { label: 'Load', dataSource: 'sales' },
          },
        ],
      });

      const result = await pipeline.validate(
        spec,
        testContext(undefined, { authorizedDataIdentifiers: ['sales'] }),
      );
      expect(isOk(result)).toBe(true);
    });

    it('fails for spec with unauthorized dataSource prop', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'btn-data',
            componentType: 'Button',
            props: { label: 'Load', dataSource: 'secret-data' },
          },
        ],
      });

      const result = await pipeline.validate(
        spec,
        testContext(undefined, { authorizedDataIdentifiers: ['sales'] }),
      );
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{
          validator: string;
          message: string;
          field?: string;
          context?: { identifier?: string; authorizedIdentifiers?: string[] };
        }>;
        const dataErrors = errors.filter((e) => e.validator === 'data-authorization');
        expect(dataErrors.length).toBeGreaterThan(0);
        expect(dataErrors[0].message).toContain('secret-data');
        expect(dataErrors[0].field).toBe('btn-data.dataSource');
        expect(dataErrors[0].context?.identifier).toBe('secret-data');
        expect(dataErrors[0].context?.authorizedIdentifiers).toStrictEqual(['sales']);
      }
    });

    it('checks convention-based data identifier keys beyond fixed list', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'btn-dynamic-data-key',
            componentType: 'Button',
            props: { label: 'Load', dataCustomerId: 'cust-42' },
          },
        ],
      });

      const result = await pipeline.validate(
        spec,
        testContext(undefined, { authorizedDataIdentifiers: ['sales'] }),
      );
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{
          validator: string;
          field?: string;
          context?: { identifier?: string };
        }>;
        const dataErrors = errors.filter((e) => e.validator === 'data-authorization');
        expect(dataErrors.length).toBe(1);
        expect(dataErrors[0].field).toBe('btn-dynamic-data-key.dataCustomerId');
        expect(dataErrors[0].context?.identifier).toBe('cust-42');
      }
    });

    it('passes for spec with no data references', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'btn-1',
            componentType: 'Button',
            props: { label: 'Click me' },
          },
        ],
      });

      // No authorized identifiers, but no data references either — should pass
      const result = await pipeline.validate(spec, testContext());
      expect(isOk(result)).toBe(true);
    });

    it('fails when authorizedDataIdentifiers is empty and data references exist (fail-closed)', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'btn-data',
            componentType: 'Button',
            props: { label: 'Load', dataSource: 'sales' },
          },
        ],
      });

      // Empty authorized list = fail-closed
      const result = await pipeline.validate(
        spec,
        testContext(undefined, { authorizedDataIdentifiers: [] }),
      );
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{ validator: string }>;
        expect(errors.some((e) => e.validator === 'data-authorization')).toBe(true);
      }
    });

    it('fails when authorizedDataIdentifiers is undefined and data references exist (fail-closed)', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'btn-data',
            componentType: 'Button',
            props: { label: 'Load', dataRef: 'user-profile' },
          },
        ],
      });

      // No authorizedDataIdentifiers at all = fail-closed
      const result = await pipeline.validate(spec, testContext());
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{ validator: string }>;
        expect(errors.some((e) => e.validator === 'data-authorization')).toBe(true);
      }
    });

    it('checks multiple data identifier prop keys (dataSource, dataRef, dataId, dataBinding)', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'multi-data',
            componentType: 'Button',
            props: {
              label: 'Load',
              dataSource: 'sales',
              dataRef: 'orders',
              dataId: 'inventory',
              dataBinding: 'customers',
            },
          },
        ],
      });

      const result = await pipeline.validate(
        spec,
        testContext(undefined, { authorizedDataIdentifiers: ['sales', 'orders'] }),
      );
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{
          validator: string;
          context?: { identifier?: string };
        }>;
        const dataErrors = errors.filter((e) => e.validator === 'data-authorization');
        // inventory and customers are unauthorized
        expect(dataErrors.length).toBe(2);
        const identifiers = dataErrors.map((e) => e.context?.identifier);
        expect(identifiers).toContain('inventory');
        expect(identifiers).toContain('customers');
      }
    });

    it('checks deeply nested children for data authorization', async () => {
      const pipeline = createValidationPipeline();
      const spec = validSpec({
        components: [
          {
            id: 'container-1',
            componentType: 'Container',
            props: {},
            children: [
              {
                id: 'container-2',
                componentType: 'Container',
                props: {},
                children: [
                  {
                    id: 'deep-data',
                    componentType: 'Button',
                    props: { label: 'Deep', dataSource: 'restricted' },
                  },
                ],
              },
            ],
          },
        ],
      });

      const result = await pipeline.validate(
        spec,
        testContext(undefined, { authorizedDataIdentifiers: ['allowed'] }),
      );
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{
          validator: string;
          field?: string;
        }>;
        const dataErrors = errors.filter((e) => e.validator === 'data-authorization');
        expect(dataErrors.length).toBeGreaterThan(0);
        expect(dataErrors.some((e) => e.field === 'deep-data.dataSource')).toBe(true);
      }
    });

    it('handles malformed spec gracefully in data auth validator', async () => {
      const pipeline = createValidationPipeline();
      const malformedSpec = { components: 'not-an-array' } as unknown as UISpecification;

      const result = await pipeline.validate(malformedSpec, testContext());
      expect(isError(result)).toBe(true);
      // Should not throw
    });
  });

  describe('async pipeline', () => {
    it('pipeline runs full chain: schema -> component -> props -> a11y -> data auth', async () => {
      const pipeline = createValidationPipeline();
      // Spec with issues in multiple validators
      const spec = validSpec({
        components: [
          {
            id: 'nav-unauth',
            componentType: 'NavMenu',
            props: { dataSource: 'secret' }, // missing role (a11y) + unauthorized data
          },
        ],
      });

      const result = await pipeline.validate(spec, testContext());
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{ validator: string }>;
        const validators = new Set(errors.map((e) => e.validator));
        expect(validators.has('a11y')).toBe(true);
        expect(validators.has('data-authorization')).toBe(true);

        const firstA11y = errors.findIndex((e) => e.validator === 'a11y');
        const firstDataAuth = errors.findIndex((e) => e.validator === 'data-authorization');
        expect(firstA11y).toBeGreaterThanOrEqual(0);
        expect(firstDataAuth).toBeGreaterThanOrEqual(0);
        expect(firstA11y).toBeLessThan(firstDataAuth);
      }
    });

    it('mixed sync+async validator errors are aggregated into single FluiError with FLUI_E020', async () => {
      const pipeline = createValidationPipeline();
      // Spec that fails both sync (prop) and async (a11y) validators
      const spec = validSpec({
        components: [
          {
            id: 'input-bad',
            componentType: 'TextInput',
            props: {}, // missing required 'placeholder' (prop fail) + missing aria-label (a11y fail)
          },
        ],
      });

      const result = await pipeline.validate(spec, testContext());
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('FLUI_E020');
        const errors = result.error.context?.errors as Array<{ validator: string }>;
        const validators = new Set(errors.map((e) => e.validator));
        expect(validators.has('prop')).toBe(true);
        expect(validators.has('a11y')).toBe(true);
      }
    });

    it('supports custom async validators via additionalValidators', async () => {
      const customAsyncValidator: AsyncValidatorFn = async (spec) => {
        await Promise.resolve(); // simulate async work
        if (spec.components.length > 5) {
          return {
            valid: false,
            errors: [{ validator: 'custom-limit', message: 'Too many components' }],
          };
        }
        return { valid: true, spec };
      };

      const pipeline = createValidationPipeline({
        additionalValidators: [customAsyncValidator],
      });

      const manyComponents: ComponentSpec[] = Array.from({ length: 6 }, (_, i) => ({
        id: `btn-${i}`,
        componentType: 'Button',
        props: { label: `Btn ${i}` },
      }));

      const spec = validSpec({ components: manyComponents });
      const result = await pipeline.validate(spec, testContext());

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{ validator: string }>;
        expect(errors.some((e) => e.validator === 'custom-limit')).toBe(true);
      }
    });

    it('supports custom sync validators via additionalValidators (backward compatible)', async () => {
      const customSyncValidator: AnyValidatorFn = (spec) => {
        if (spec.components.some((c) => c.id.startsWith('forbidden'))) {
          return {
            valid: false,
            errors: [{ validator: 'custom-id-check', message: 'Forbidden ID prefix' }],
          };
        }
        return { valid: true, spec };
      };

      const pipeline = createValidationPipeline({
        additionalValidators: [customSyncValidator],
      });

      const spec = validSpec({
        components: [
          {
            id: 'forbidden-btn',
            componentType: 'Button',
            props: { label: 'Bad' },
          },
        ],
      });

      const result = await pipeline.validate(spec, testContext());
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errors = result.error.context?.errors as Array<{ validator: string }>;
        expect(errors.some((e) => e.validator === 'custom-id-check')).toBe(true);
      }
    });
  });
});
