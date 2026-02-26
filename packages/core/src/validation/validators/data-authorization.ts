import type { ComponentSpec } from '../../spec';
import type { AsyncValidatorFn, ValidationError } from '../validation.types';

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
 * Prop keys that may contain data identifiers (convention-based detection).
 */
const DATA_IDENTIFIER_PROP_KEYS = ['dataSource', 'dataRef', 'dataId', 'dataBinding'];
const DATA_IDENTIFIER_DYNAMIC_KEY = /^data(?:[A-Z].*|[_-].*)$/;
const DATA_IDENTIFIER_KEY_SUFFIX = /(source|ref|id|binding|identifier)$/i;

function isDataIdentifierPropKey(key: string): boolean {
  return (
    DATA_IDENTIFIER_PROP_KEYS.includes(key) ||
    (DATA_IDENTIFIER_DYNAMIC_KEY.test(key) && DATA_IDENTIFIER_KEY_SUFFIX.test(key))
  );
}

/**
 * Data authorization validator: checks that all data identifiers referenced in
 * component props are explicitly authorized in the context.
 *
 * Fail-closed: if authorizedDataIdentifiers is undefined/empty and data identifiers
 * exist in the spec, ALL data references fail validation.
 */
export const dataAuthorizationValidator: AsyncValidatorFn = async (spec, context) => {
  try {
    const authorizedSet = new Set(context.authorizedDataIdentifiers ?? []);
    const allComponents = collectAllComponents(spec.components);
    const errors: ValidationError[] = [];

    for (const component of allComponents) {
      for (const [key, rawValue] of Object.entries(component.props)) {
        if (!isDataIdentifierPropKey(key)) {
          continue;
        }

        if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
          const value = rawValue.trim();
          if (authorizedSet.size === 0 || !authorizedSet.has(value)) {
            errors.push({
              validator: 'data-authorization',
              message: `Unauthorized data identifier '${value}' in component '${component.componentType}' prop '${key}'`,
              field: `${component.id}.${key}`,
              context: {
                errorCode: 'FLUI_E022',
                identifier: value,
                componentType: component.componentType,
                propKey: key,
                authorizedIdentifiers: [...authorizedSet],
              },
            });
          }
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
          validator: 'data-authorization',
          message: 'Data authorization validation failed due to malformed spec structure',
        },
      ],
    };
  }
};
