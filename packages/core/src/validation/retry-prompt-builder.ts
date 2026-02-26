import type { ValidationError } from './validation.types';

/**
 * Builds a retry prompt that appends validation error details to the original prompt.
 * The LLM receives both the original intent and specific instructions to fix validation failures.
 */
export function buildRetryPrompt(originalPrompt: string, errors: ValidationError[]): string {
  const errorSection = errors
    .map(
      (e, i) => `${i + 1}. [${e.validator}] ${e.message}${e.field ? ` (field: ${e.field})` : ''}`,
    )
    .join('\n');

  return `${originalPrompt}

VALIDATION ERRORS FROM PREVIOUS ATTEMPT:
The previous generation had the following validation errors. Fix ALL of them:

${errorSection}

Generate a corrected UISpecification that resolves all listed issues.`;
}
