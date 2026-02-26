import type { Result } from '../errors';
import { err, FLUI_E010, FLUI_E020, FLUI_E023, FluiError, isOk, ok } from '../errors';
import type { UISpecification } from '../spec';
import type { GenerationTrace } from '../types';
import { buildRetryPrompt } from './retry-prompt-builder';
import type {
  AnyValidatorFn,
  RegenerateFn,
  ValidationAttempt,
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

  /** Adds a custom validator to the pipeline after built-in validators. */
  addValidator(validator: AnyValidatorFn): Result<void, FluiError>;

  /** Removes a previously added custom validator. Returns true if found and removed. */
  removeValidator(validator: AnyValidatorFn): boolean;

  /** Validates with automatic retry on failure, using regenerate callback for new specs. */
  validateWithRetry(
    spec: UISpecification,
    context: ValidatorContext,
    regenerate: RegenerateFn,
    trace: GenerationTrace,
    signal?: AbortSignal,
    originalPrompt?: string,
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
  const builtInValidators: AnyValidatorFn[] = [
    schemaValidator,
    componentValidator,
    propValidator,
    a11yValidator,
    dataAuthorizationValidator,
  ];

  const customValidators: AnyValidatorFn[] = [];

  if (config?.additionalValidators) {
    customValidators.push(...config.additionalValidators);
  }

  const maxRetries = config?.retry?.maxRetries ?? 3;
  const retryEnabled = config?.retry?.enabled !== false;

  const pipeline: ValidationPipeline = {
    async validate(spec, context) {
      const allErrors: ValidationError[] = [];
      let currentSpec = spec;

      const validators = [...builtInValidators, ...customValidators];

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

    addValidator(validator: AnyValidatorFn): Result<void, FluiError> {
      customValidators.push(validator);
      return ok(undefined);
    },

    removeValidator(validator: AnyValidatorFn): boolean {
      const index = customValidators.indexOf(validator);
      if (index === -1) {
        return false;
      }
      customValidators.splice(index, 1);
      return true;
    },

    async validateWithRetry(spec, context, regenerate, trace, signal?, originalPrompt = '') {
      if (!retryEnabled) {
        return pipeline.validate(spec, context);
      }

      let currentSpec = spec;
      const attempts: ValidationAttempt[] = [];

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (signal?.aborted) {
          return err(new FluiError(FLUI_E010, 'validation', 'Validation retry cancelled'));
        }

        const startMs = Date.now();
        const result = await pipeline.validate(currentSpec, context);

        if (isOk(result)) {
          trace.addStep({
            module: 'validation',
            operation: 'validateWithRetry',
            durationMs: Date.now() - startMs,
            metadata: {
              attempt: attempt + 1,
              success: true,
              validationResult: { valid: true, errors: [] },
            },
          });
          return result;
        }

        const errors = (result.error.context?.errors as ValidationError[]) ?? [];
        const retryPromptUsed =
          attempt < maxRetries ? buildRetryPrompt(originalPrompt, errors) : undefined;
        attempts.push({ attemptNumber: attempt + 1, errors, retryPromptUsed });

        trace.addStep({
          module: 'validation',
          operation: 'retryAttempt',
          durationMs: Date.now() - startMs,
          metadata: {
            attempt: attempt + 1,
            success: false,
            validationResult: {
              valid: false,
              errors,
            },
          },
        });

        if (attempt < maxRetries) {
          if (signal?.aborted) {
            return err(new FluiError(FLUI_E010, 'validation', 'Validation retry cancelled'));
          }

          const retryPrompt = buildRetryPrompt(originalPrompt, errors);
          const regenResult = await regenerate(retryPrompt, signal);
          if (!isOk(regenResult)) {
            return regenResult as Result<UISpecification, FluiError>;
          }
          currentSpec = regenResult.value;
        }
      }

      return err(
        new FluiError(
          FLUI_E023,
          'validation',
          `Validation retry exhausted after ${attempts.length} attempts`,
          { context: { attempts } },
        ),
      );
    },
  };

  return pipeline;
}
