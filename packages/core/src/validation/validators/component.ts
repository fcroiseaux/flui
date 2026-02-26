import type { ComponentSpec } from '../../spec';
import type { ValidationError, ValidatorFn } from '../validation.types';

/**
 * Collects all ComponentSpec nodes from the tree, including nested children.
 */
function collectAllComponents(components: ComponentSpec[]): ComponentSpec[] {
  const all: ComponentSpec[] = [];
  function walk(specs: ComponentSpec[]) {
    for (const spec of specs) {
      all.push(spec);
      if (spec.children) walk(spec.children);
    }
  }
  walk(components);
  return all;
}

/**
 * Component validator: checks that every componentType in the spec exists in the registry.
 * Traverses the full component tree including nested children.
 */
export const componentValidator: ValidatorFn = (spec, context) => {
  try {
    const allComponents = collectAllComponents(spec.components);
    const errors: ValidationError[] = [];

    for (const component of allComponents) {
      const entry = context.registry.getByName(component.componentType);
      if (entry === undefined) {
        errors.push({
          validator: 'component',
          message: `Unknown component type: '${component.componentType}'`,
          field: component.id,
          context: { componentType: component.componentType },
        });
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true, spec };
  } catch {
    return {
      valid: false,
      errors: [
        {
          validator: 'component',
          message: 'Component validation failed due to malformed spec structure',
        },
      ],
    };
  }
};
