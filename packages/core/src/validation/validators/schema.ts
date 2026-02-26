import { uiSpecificationSchema } from '../../spec';
import type { ValidatorFn } from '../validation.types';

/**
 * Schema validator: checks that a UISpecification conforms to the Zod schema.
 * Uses safeParse to never throw — returns ValidationResult.
 */
export const schemaValidator: ValidatorFn = (spec) => {
  const parseResult = uiSpecificationSchema.safeParse(spec);

  if (parseResult.success) {
    return { valid: true, spec: parseResult.data };
  }

  const errors = parseResult.error.issues.map((issue) => ({
    validator: 'schema' as const,
    message: issue.message,
    field: issue.path.length > 0 ? issue.path.join('.') : undefined,
  }));

  return { valid: false, errors };
};
