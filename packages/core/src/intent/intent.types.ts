/**
 * A text-based intent: free-form natural language describing desired UI.
 */
export interface TextIntent {
  type: 'text';
  text: string;
}

/**
 * A structured intent: explicit component type, optional data shape and interaction pattern.
 */
export interface StructuredIntent {
  type: 'structured';
  componentType: string;
  dataShape?: Record<string, unknown> | undefined;
  interactionPattern?: string | undefined;
}

/**
 * Union of all supported intent input formats.
 */
export type Intent = TextIntent | StructuredIntent;

/**
 * Extracted signals from an intent (populated for structured intents, empty for text intents).
 */
export interface IntentSignals {
  componentType?: string | undefined;
  dataShape?: Record<string, unknown> | undefined;
  interactionPattern?: string | undefined;
}

/**
 * Unified normalized representation of a parsed intent.
 * Produced by parseIntent() regardless of input format.
 */
export interface IntentObject {
  originalText: string;
  sanitizedText: string;
  signals: IntentSignals;
  source: 'text' | 'structured';
}

/**
 * Configuration for extensible sanitization patterns.
 */
export interface SanitizationConfig {
  customPatterns?: RegExp[] | undefined;
}
