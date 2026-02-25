// @flui/core - Core generation engine

// context/ module
export type {
  AggregatedContext,
  ContextData,
  ContextEngine,
  ContextProvider,
  ContextResolver,
  EnvironmentContext,
  IdentityContext,
  ViewportSize,
} from './context';
export {
  createContextEngine,
  createEnvironmentProvider,
  createIdentityProvider,
  environmentContextSchema,
  identityContextSchema,
  viewportSizeSchema,
} from './context';
// errors/ module
export type { ErrorCategory, FluiErrorCode, FluiErrorOptions } from './errors';
export {
  ERROR_CODE_DESCRIPTIONS,
  err,
  error,
  FLUI_E001,
  FLUI_E002,
  FLUI_E003,
  FLUI_E004,
  FLUI_E005,
  FLUI_E006,
  FLUI_E007,
  FLUI_E008,
  FLUI_E009,
  FLUI_E010,
  FLUI_E011,
  FLUI_E012,
  FLUI_E013,
  FLUI_E014,
  FluiError,
  isError,
  isOk,
  ok,
} from './errors';
export type { Result } from './errors/result';

// intent/ module
export type {
  Intent,
  IntentObject,
  IntentSignals,
  SanitizationConfig,
  StructuredIntent,
  TextIntent,
} from './intent';
export {
  intentSchema,
  parseIntent,
  sanitizeIntent,
  structuredIntentSchema,
  textIntentSchema,
} from './intent';

// registry/ module
export type {
  ComponentDefinition,
  RegistryEntry,
  SerializedComponent,
  SerializedRegistry,
} from './registry';
export { ComponentRegistry, componentDefinitionSchema } from './registry';

// spec/ module
export type {
  ComponentSpec,
  InteractionSpec,
  LayoutAlignment,
  LayoutDirection,
  LayoutSpec,
  LayoutType,
  UISpecification,
  UISpecificationMetadata,
} from './spec';
export {
  componentSpecSchema,
  interactionSpecSchema,
  layoutSpecSchema,
  SPEC_VERSION,
  uiSpecificationMetadataSchema,
  uiSpecificationSchema,
} from './spec';

// types (shared cross-cutting types)
export type {
  GenerationTrace,
  GenerationTraceInit,
  LLMConnector,
  LLMRequestOptions,
  LLMResponse,
  LLMUsage,
  TraceStep,
} from './types';
export { createTrace } from './types';
