import type { Result } from '../errors';
import { err, FLUI_E020, FluiError, ok } from '../errors';
import type { UISpecification } from '../spec';

import type {
  ValidationError,
  ValidationPipelineConfig,
  ValidatorContext,
  ValidatorFn,
} from './validation.types';
import { componentValidator } from './validators/component';
import { propValidator } from './validators/prop';
import { schemaValidator } from './validators/schema';

/**
 * Validation pipeline interface.
 */
export interface ValidationPipeline {
  /** Validates a UISpecification through all validators in order. */
  validate(spec: UISpecification, context: ValidatorContext): Result<UISpecification, FluiError>;
}

/**
 * Creates a validation pipeline that runs validators in fixed order:
 * schema -> component -> props (+ any additional validators).
 *
 * The pipeline does NOT short-circuit: all validators run to provide a complete error report.
 */
export function createValidationPipeline(config?: ValidationPipelineConfig): ValidationPipeline {
  const validators: ValidatorFn[] = [schemaValidator, componentValidator, propValidator];

  if (config?.additionalValidators) {
    validators.push(...config.additionalValidators);
  }

  return {
    validate(spec, context) {
      const allErrors: ValidationError[] = [];
      let currentSpec = spec;

      for (const validator of validators) {
        const result = validator(currentSpec, context);
        if (!result.valid) {
          allErrors.push(...result.errors);
          continue;
        }

        currentSpec = result.spec;
      }

      if (allErrors.length > 0) {
        const message = `Validation pipeline failed: ${allErrors.length} error(s) from ${new Set(allErrors.map((e) => e.validator)).size} validator(s)`;
        return err(
          new FluiError(FLUI_E020, 'validation', message, {
            context: { errors: allErrors },
          }),
        );
      }

      return ok(currentSpec);
    },
  };
}
