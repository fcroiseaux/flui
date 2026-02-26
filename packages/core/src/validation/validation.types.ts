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
}

/**
 * Synchronous validator function signature.
 * Each validator receives the spec and context, returns a ValidationResult.
 */
export type ValidatorFn = (spec: UISpecification, context: ValidatorContext) => ValidationResult;

/**
 * Configuration for creating a validation pipeline.
 */
export interface ValidationPipelineConfig {
  /** Optional custom validators to append after core validators */
  additionalValidators?: ValidatorFn[] | undefined;
}
