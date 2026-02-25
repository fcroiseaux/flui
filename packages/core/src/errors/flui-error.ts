import type { ErrorCategory, FluiErrorCode } from './error-codes';

/**
 * Options for FluiError construction.
 */
export interface FluiErrorOptions {
  /** Structured metadata for debugging (never include sensitive data) */
  context?: Record<string, unknown> | undefined;
  /** Original error being wrapped */
  cause?: Error | undefined;
}

/**
 * Typed error class for all flui error conditions.
 * Extends Error with structured code, category, and optional context.
 */
export class FluiError extends Error {
  readonly code: FluiErrorCode;
  readonly category: ErrorCategory;
  readonly context: Record<string, unknown> | undefined;
  override readonly cause: Error | undefined;

  constructor(
    code: FluiErrorCode,
    category: ErrorCategory,
    message: string,
    options?: FluiErrorOptions | undefined,
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'FluiError';
    this.code = code;
    this.category = category;
    this.context = options?.context;
    this.cause = options?.cause;
  }

  /**
   * Serializes FluiError to a JSON-safe object.
   * Includes code, category, message, and context.
   * Never serializes cause stack traces.
   */
  toJSON(): {
    name: string;
    code: FluiErrorCode;
    category: ErrorCategory;
    message: string;
    context: Record<string, unknown> | undefined;
  } {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      message: this.message,
      context: this.context,
    };
  }
}
