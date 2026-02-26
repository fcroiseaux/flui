import type { Result } from '../errors';
import { err, FLUI_E020, FluiError, ok } from '../errors';
import type { UISpecification } from '../spec';

import type {
  AnyValidatorFn,
  ValidationError,
  ValidationPipelineConfig,
  ValidatorContext,
} from './validation.types';
import { a11yValidator } from './validators/a11y';
import { componentValidator } from './validators/component';
import { dataAuthorizationValidator } from './validators/data-authorization';
import { propValidator } from './validators/prop';
import { schemaValidator } from './validators/schema';

/**
 * Validation pipeline interface.
 */
export interface ValidationPipeline {
  /** Validates a UISpecification through all validators in order. */
  validate(
    spec: UISpecification,
    context: ValidatorContext,
  ): Promise<Result<UISpecification, FluiError>>;
}

/**
 * Creates a validation pipeline that runs validators in fixed order:
 * schema -> component -> props -> a11y -> data authorization (+ any additional validators).
 *
 * The pipeline does NOT short-circuit: all validators run to provide a complete error report.
 * Supports both sync and async validators via Promise.resolve() wrapping.
 */
export function createValidationPipeline(config?: ValidationPipelineConfig): ValidationPipeline {
  const validators: AnyValidatorFn[] = [
    schemaValidator,
    componentValidator,
    propValidator,
    a11yValidator,
    dataAuthorizationValidator,
  ];

  if (config?.additionalValidators) {
    validators.push(...config.additionalValidators);
  }

  return {
    async validate(spec, context) {
      const allErrors: ValidationError[] = [];
      let currentSpec = spec;

      for (const validator of validators) {
        const result = await Promise.resolve(validator(currentSpec, context));
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
