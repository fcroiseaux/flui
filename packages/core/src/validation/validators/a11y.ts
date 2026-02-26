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
 * Checks whether a component has a visible text label in its props.
 * Looks for common text content prop names.
 */
function hasVisibleLabel(props: Record<string, unknown>): boolean {
  const textProps = ['label', 'text', 'title', 'children'];
  return textProps.some(
    (key) => typeof props[key] === 'string' && (props[key] as string).trim().length > 0,
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasColumnHeaders(props: Record<string, unknown>): boolean {
  const columns = props['columns'];
  if (Array.isArray(columns) && columns.some((column) => isNonEmptyString(column))) {
    return true;
  }

  const columnHeaders = props['columnHeaders'];
  return Array.isArray(columnHeaders) && columnHeaders.some((header) => isNonEmptyString(header));
}

/**
 * WCAG 2.1 AA category-based ARIA rules:
 *
 * | Category    | Required ARIA                                  | WCAG Criterion                 |
 * |-------------|------------------------------------------------|-------------------------------|
 * | interactive | aria-label OR visible text                      | 4.1.2 Name, Role, Value       |
 * | input/form  | aria-label OR aria-labelledby                   | 1.3.1 Info and Relationships  |
 * | image       | alt prop (non-empty)                            | 1.1.1 Non-text Content        |
 * | display     | aria-live (polite/assertive) for dynamic content| 4.1.3 Status Messages         |
 * | navigation  | role prop                                       | 1.3.1 Info and Relationships  |
 * | data        | aria-label and column headers                   | 1.3.1 Info and Relationships  |
 */

/**
 * Accessibility validator: checks WCAG 2.1 AA compliance based on component category.
 * Uses component registry metadata to determine required ARIA attributes per component type.
 */
export const a11yValidator: AsyncValidatorFn = async (spec, context) => {
  try {
    const allComponents = collectAllComponents(spec.components);
    const errors: ValidationError[] = [];

    for (const component of allComponents) {
      const entry = context.registry.getByName(component.componentType);

      // Skip unregistered components — component validator handles those
      if (entry === undefined) {
        continue;
      }

      const category = entry.category;
      const props = component.props;

      switch (category) {
        case 'interactive': {
          // Interactive components (buttons, links) need aria-label or visible text content
          if (!isNonEmptyString(props['aria-label']) && !hasVisibleLabel(props)) {
            errors.push({
              validator: 'a11y',
              message: `Interactive component '${component.componentType}' requires 'aria-label' or visible text content (WCAG 4.1.2)`,
              field: component.id,
              context: {
                errorCode: 'FLUI_E021',
                componentType: component.componentType,
                category,
                wcagCriterion: '4.1.2 Name, Role, Value',
                remediation:
                  "Add 'aria-label' prop or a visible text label (e.g., 'label', 'text')",
              },
            });
          }
          break;
        }

        case 'input':
        case 'form': {
          // Form inputs need aria-label or aria-labelledby
          if (
            !isNonEmptyString(props['aria-label']) &&
            !isNonEmptyString(props['aria-labelledby'])
          ) {
            errors.push({
              validator: 'a11y',
              message: `Form component '${component.componentType}' requires 'aria-label' or 'aria-labelledby' (WCAG 1.3.1)`,
              field: component.id,
              context: {
                errorCode: 'FLUI_E021',
                componentType: component.componentType,
                category,
                wcagCriterion: '1.3.1 Info and Relationships',
                remediation: "Add 'aria-label' or 'aria-labelledby' prop",
              },
            });
          }
          break;
        }

        case 'image': {
          // Images need non-empty alt prop
          if (typeof props['alt'] !== 'string' || (props['alt'] as string).length === 0) {
            errors.push({
              validator: 'a11y',
              message: `Image component '${component.componentType}' requires non-empty 'alt' prop (WCAG 1.1.1)`,
              field: component.id,
              context: {
                errorCode: 'FLUI_E021',
                componentType: component.componentType,
                category,
                wcagCriterion: '1.1.1 Non-text Content',
                remediation: "Add non-empty 'alt' prop describing the image",
              },
            });
          }
          break;
        }

        case 'display': {
          // Dynamic/live content needs aria-live
          if (props['aria-live'] !== 'polite' && props['aria-live'] !== 'assertive') {
            errors.push({
              validator: 'a11y',
              message: `Dynamic content component '${component.componentType}' requires 'aria-live' (polite or assertive) (WCAG 4.1.3)`,
              field: component.id,
              context: {
                errorCode: 'FLUI_E021',
                componentType: component.componentType,
                category,
                wcagCriterion: '4.1.3 Status Messages',
                remediation: "Add 'aria-live' prop with value 'polite' or 'assertive'",
              },
            });
          }
          break;
        }

        case 'navigation': {
          // Navigation needs role prop
          if (!isNonEmptyString(props['role'])) {
            errors.push({
              validator: 'a11y',
              message: `Navigation component '${component.componentType}' requires 'role' prop (WCAG 1.3.1)`,
              field: component.id,
              context: {
                errorCode: 'FLUI_E021',
                componentType: component.componentType,
                category,
                wcagCriterion: '1.3.1 Info and Relationships',
                remediation: "Add 'role' prop (e.g., 'navigation', 'menu')",
              },
            });
          }
          break;
        }

        case 'data': {
          // Tables/data grids need aria-label and column headers
          if (!isNonEmptyString(props['aria-label']) || !hasColumnHeaders(props)) {
            errors.push({
              validator: 'a11y',
              message: `Data component '${component.componentType}' requires 'aria-label' and column headers (WCAG 1.3.1)`,
              field: component.id,
              context: {
                errorCode: 'FLUI_E021',
                componentType: component.componentType,
                category,
                wcagCriterion: '1.3.1 Info and Relationships',
                remediation:
                  "Add non-empty 'aria-label' and provide column headers via 'columns' or 'columnHeaders'",
              },
            });
          }
          break;
        }

        // layout and other categories: no specific ARIA requirements
        default:
          break;
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
          validator: 'a11y',
          message: 'Accessibility validation failed due to malformed spec structure',
        },
      ],
    };
  }
};
