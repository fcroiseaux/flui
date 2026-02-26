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
 * Prop validator: checks that props for each component conform to the component's declared Zod schema.
 * Skips components not found in the registry (component validator handles that).
 */
export const propValidator: ValidatorFn = (spec, context) => {
  try {
    const allComponents = collectAllComponents(spec.components);
    const errors: ValidationError[] = [];

    for (const component of allComponents) {
      const entry = context.registry.getByName(component.componentType);

      // Skip unregistered components — component validator handles those
      if (entry === undefined) {
        continue;
      }

      const parseResult = entry.accepts.safeParse(component.props);
      if (!parseResult.success) {
        const expectedSchema = entry.accepts.description ?? entry.accepts.constructor.name;

        for (const issue of parseResult.error.issues) {
          const fieldPath =
            issue.path.length > 0 ? `${component.id}.${issue.path.join('.')}` : component.id;

          errors.push({
            validator: 'prop',
            message: `Prop validation failed for '${component.componentType}': ${issue.message}`,
            field: fieldPath,
            context: {
              componentType: component.componentType,
              componentId: component.id,
              expectedSchema,
              actualProps: component.props,
              zodPath: issue.path,
            },
          });
        }
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
          validator: 'prop',
          message: 'Prop validation failed due to malformed spec structure',
        },
      ],
    };
  }
};
