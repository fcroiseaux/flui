import { z } from 'zod';

import type { Result } from '../errors';
import { err, FLUI_E003, FLUI_E005, FluiError, ok } from '../errors';

import { intentSchema } from './intent.schema';
import type { Intent, IntentObject, SanitizationConfig } from './intent.types';
import { sanitizeIntent } from './sanitizer';

/**
 * Parses and normalizes an intent (text or structured) into a unified IntentObject.
 *
 * For text intents: validates non-empty, sanitizes text, returns IntentObject with empty signals.
 * For structured intents: validates schema, constructs synthetic text, populates signals.
 *
 * @param input - A TextIntent or StructuredIntent to parse
 * @param config - Optional sanitization configuration with custom patterns
 * @returns Result.ok(IntentObject) on success, Result.error(FluiError) on failure
 */
export function parseIntent(
  input: Intent,
  config?: SanitizationConfig | undefined,
): Result<IntentObject, FluiError> {
  if (input.type === 'text' && input.text.trim().length === 0) {
    return err(new FluiError(FLUI_E003, 'validation', 'Intent text must not be empty'));
  }

  // Validate against Zod schema
  const parseResult = intentSchema.safeParse(input);

  if (!parseResult.success) {
    const tree = z.treeifyError(parseResult.error);
    return err(
      new FluiError(FLUI_E005, 'validation', `Invalid intent structure: ${JSON.stringify(tree)}`),
    );
  }

  if (input.type === 'text') {
    return parseTextIntent(input.text, config);
  }

  return parseStructuredIntent(input, config);
}

/**
 * Parses a text intent: validates non-empty, sanitizes, and constructs IntentObject.
 */
function parseTextIntent(
  text: string,
  config: SanitizationConfig | undefined,
): Result<IntentObject, FluiError> {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return err(new FluiError(FLUI_E003, 'validation', 'Intent text must not be empty'));
  }

  const sanitizedText = sanitizeIntent(trimmed, config);

  const intentObject: IntentObject = {
    originalText: trimmed,
    sanitizedText,
    signals: {},
    source: 'text',
  };

  return ok(intentObject);
}

/**
 * Parses a structured intent: validates, synthesizes text, populates signals.
 */
function parseStructuredIntent(
  input: {
    type: 'structured';
    componentType: string;
    dataShape?: Record<string, unknown> | undefined;
    interactionPattern?: string | undefined;
  },
  config: SanitizationConfig | undefined,
): Result<IntentObject, FluiError> {
  // Synthesize text representation from structured fields
  let originalText = `component: ${input.componentType}`;
  if (input.dataShape !== undefined) {
    originalText += `, data: ${JSON.stringify(input.dataShape)}`;
  }
  if (input.interactionPattern !== undefined) {
    originalText += `, interaction: ${input.interactionPattern}`;
  }

  const sanitizedText = sanitizeIntent(originalText, config);

  const intentObject: IntentObject = {
    originalText,
    sanitizedText,
    signals: {
      componentType: input.componentType,
      dataShape: input.dataShape,
      interactionPattern: input.interactionPattern,
    },
    source: 'structured',
  };

  return ok(intentObject);
}
