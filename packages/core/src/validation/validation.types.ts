import type { Result } from '../errors';
import type { ComponentRegistry } from '../registry';
import type { UISpecification } from '../spec';

/**
 * Structured error detail from a validator.
 */
export interface ValidationError {
  /** Name of the validator that produced this error */
  validator: string;
  /** Human-readable error message */
  message: string;
  /** Optional field path where the error occurred */
  field?: string | undefined;
  /** Optional additional context for debugging */
  context?: Record<string, unknown> | undefined;
}

/**
 * Discriminated union result from a single validator.
 * Validators always return this type — they never throw.
 */
export type ValidationResult =
  | { valid: true; spec: UISpecification }
  | { valid: false; errors: ValidationError[] };

/**
 * Context passed to each validator function.
 */
export interface ValidatorContext {
  /** Component registry for looking up registered components */
  registry: ComponentRegistry;
  /** Extensible configuration for validator-specific settings */
  config?: Record<string, unknown> | undefined;
  /** Authorized data identifiers for data authorization validation */
  authorizedDataIdentifiers?: string[] | undefined;
}

/**
 * Synchronous validator function signature.
 * Each validator receives the spec and context, returns a ValidationResult.
 */
export type ValidatorFn = (spec: UISpecification, context: ValidatorContext) => ValidationResult;

/**
 * Asynchronous validator function signature.
 * Used by validators that may perform async operations (e.g., a11y, data authorization).
 */
export type AsyncValidatorFn = (
  spec: UISpecification,
  context: ValidatorContext,
) => Promise<ValidationResult>;

/**
 * Union type accepting both sync and async validator functions.
 */
export type AnyValidatorFn = ValidatorFn | AsyncValidatorFn;

/**
 * Configuration for validation retry behavior.
 */
export interface ValidationRetryConfig {
  /** Maximum number of retry attempts. Defaults to 3. */
  maxRetries?: number | undefined;
  /** Whether retry is enabled. Defaults to true when config is provided. */
  enabled?: boolean | undefined;
}

/**
 * Records a single validation attempt during retry.
 */
export interface ValidationAttempt {
  /** 1-based attempt number */
  attemptNumber: number;
  /** Validation errors from this attempt */
  errors: ValidationError[];
  /** The retry prompt used for this attempt (absent for first attempt) */
  retryPromptUsed?: string | undefined;
}

/**
 * Result of a validation with retry, including attempt history.
 */
export interface ValidationRetryResult {
  /** Final validation result */
  finalResult: Result<UISpecification>;
  /** All validation attempts made */
  attempts: ValidationAttempt[];
}

/**
 * Callback function for regenerating a UISpecification from a retry prompt.
 * Provided by the caller (generation orchestrator) to maintain dependency inversion.
 */
export type RegenerateFn = (
  retryPrompt: string,
  signal?: AbortSignal,
) => Promise<Result<UISpecification>>;

/**
 * Configuration for creating a validation pipeline.
 */
export interface ValidationPipelineConfig {
  /** Optional custom validators to append after core validators */
  additionalValidators?: AnyValidatorFn[] | undefined;
  /** Optional retry configuration for validateWithRetry */
  retry?: ValidationRetryConfig | undefined;
}
