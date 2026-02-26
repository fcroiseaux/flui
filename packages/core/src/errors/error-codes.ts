/**
 * Error categories for classifying FluiError instances.
 */
export type ErrorCategory =
  | 'validation'
  | 'generation'
  | 'cache'
  | 'connector'
  | 'config'
  | 'context';

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type NonZeroDigit = Exclude<Digit, '0'>;
type ErrorCodeSuffix = `00${NonZeroDigit}` | `0${NonZeroDigit}${Digit}`;

/**
 * String literal error codes for FluiError.
 * Accepts FLUI_E001–FLUI_E099; FLUI_E001–FLUI_E010 are allocated in Story 1.3.
 */
export type FluiErrorCode = `FLUI_E${ErrorCodeSuffix}`;

/** Invalid configuration: malformed or unrecognized config object */
export const FLUI_E001 = 'FLUI_E001' as const;

/** Missing required configuration: a mandatory config field is absent */
export const FLUI_E002 = 'FLUI_E002' as const;

/** Invalid intent: empty, malformed, or unsanitizable intent string */
export const FLUI_E003 = 'FLUI_E003' as const;

/** Type validation failed: runtime value does not match expected type */
export const FLUI_E004 = 'FLUI_E004' as const;

/** Schema validation failed: Zod schema validation rejected input */
export const FLUI_E005 = 'FLUI_E005' as const;

/** Component not found: referenced component not in registry */
export const FLUI_E006 = 'FLUI_E006' as const;

/** Invalid component props: props do not satisfy component schema */
export const FLUI_E007 = 'FLUI_E007' as const;

/** Initialization failed: module or subsystem failed to initialize */
export const FLUI_E008 = 'FLUI_E008' as const;

/** Unsupported operation: attempted operation not supported in current state */
export const FLUI_E009 = 'FLUI_E009' as const;

/** Operation cancelled: AbortSignal triggered cancellation */
export const FLUI_E010 = 'FLUI_E010' as const;

/** Context resolution failed: a context provider returned an error during resolution */
export const FLUI_E011 = 'FLUI_E011' as const;

/** Invalid context data: context data does not match expected schema */
export const FLUI_E012 = 'FLUI_E012' as const;

/** Duplicate context provider: a provider with this name is already registered */
export const FLUI_E013 = 'FLUI_E013' as const;

/** LLM provider API error: timeout, rate limit, network, or authentication failure */
export const FLUI_E014 = 'FLUI_E014' as const;

/** LLM response parse failed: malformed JSON or unexpected response format */
export const FLUI_E015 = 'FLUI_E015' as const;

/** UISpecification validation failed: LLM response does not conform to UISpecification schema */
export const FLUI_E016 = 'FLUI_E016' as const;

/** Stream terminated unexpectedly: stream ended before producing a complete response */
export const FLUI_E017 = 'FLUI_E017' as const;

/** Unauthorized data identifier: data identifier not in authorized context */
export const FLUI_E018 = 'FLUI_E018' as const;

/** Unresolvable data identifier: no resolver registered for the given pattern */
export const FLUI_E019 = 'FLUI_E019' as const;

/** Validation pipeline failed: one or more validators rejected the specification */
export const FLUI_E020 = 'FLUI_E020' as const;

/** Accessibility validation failed: WCAG 2.1 AA compliance issues detected */
export const FLUI_E021 = 'FLUI_E021' as const;

/** Data authorization validation failed: unauthorized data identifiers referenced */
export const FLUI_E022 = 'FLUI_E022' as const;

export type DefinedFluiErrorCode =
  | typeof FLUI_E001
  | typeof FLUI_E002
  | typeof FLUI_E003
  | typeof FLUI_E004
  | typeof FLUI_E005
  | typeof FLUI_E006
  | typeof FLUI_E007
  | typeof FLUI_E008
  | typeof FLUI_E009
  | typeof FLUI_E010
  | typeof FLUI_E011
  | typeof FLUI_E012
  | typeof FLUI_E013
  | typeof FLUI_E014
  | typeof FLUI_E015
  | typeof FLUI_E016
  | typeof FLUI_E017
  | typeof FLUI_E018
  | typeof FLUI_E019
  | typeof FLUI_E020
  | typeof FLUI_E021
  | typeof FLUI_E022;

/**
 * Human-readable descriptions for all defined error codes.
 */
export const ERROR_CODE_DESCRIPTIONS: Record<DefinedFluiErrorCode, string> = {
  FLUI_E001: 'Invalid configuration: malformed or unrecognized config object',
  FLUI_E002: 'Missing required configuration: a mandatory config field is absent',
  FLUI_E003: 'Invalid intent: empty, malformed, or unsanitizable intent string',
  FLUI_E004: 'Type validation failed: runtime value does not match expected type',
  FLUI_E005: 'Schema validation failed: Zod schema validation rejected input',
  FLUI_E006: 'Component not found: referenced component not in registry',
  FLUI_E007: 'Invalid component props: props do not satisfy component schema',
  FLUI_E008: 'Initialization failed: module or subsystem failed to initialize',
  FLUI_E009: 'Unsupported operation: attempted operation not supported in current state',
  FLUI_E010: 'Operation cancelled: AbortSignal triggered cancellation',
  FLUI_E011: 'Context resolution failed: a context provider returned an error during resolution',
  FLUI_E012: 'Invalid context data: context data does not match expected schema',
  FLUI_E013: 'Duplicate context provider: a provider with this name is already registered',
  FLUI_E014: 'LLM provider API error: timeout, rate limit, network, or authentication failure',
  FLUI_E015: 'LLM response parse failed: malformed JSON or unexpected response format',
  FLUI_E016:
    'UISpecification validation failed: LLM response does not conform to UISpecification schema',
  FLUI_E017: 'Stream terminated unexpectedly: stream ended before producing a complete response',
  FLUI_E018: 'Unauthorized data identifier: data identifier not in authorized context',
  FLUI_E019: 'Unresolvable data identifier: no resolver registered for the given pattern',
  FLUI_E020: 'Validation pipeline failed: one or more validators rejected the specification',
  FLUI_E021: 'Accessibility validation failed: WCAG 2.1 AA compliance issues detected',
  FLUI_E022: 'Data authorization validation failed: unauthorized data identifiers referenced',
};
