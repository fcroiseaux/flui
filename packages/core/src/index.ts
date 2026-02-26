// @flui/core - Core generation engine

// cache/ module
export type {
  CacheConfig,
  CacheEntry,
  CacheKey,
  CacheManager,
  CacheResult,
  CacheStats,
  CacheStorage,
} from './cache';
export { buildCacheKey, createCacheManager } from './cache';
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
// data/ module
export type {
  DataIdentifier,
  DataResolutionResult,
  DataResolverConfig,
  DataResolverFn,
  DataResolverRegistry,
} from './data';
export { createDataResolverRegistry } from './data';
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
  FLUI_E015,
  FLUI_E016,
  FLUI_E017,
  FLUI_E018,
  FLUI_E019,
  FLUI_E020,
  FLUI_E021,
  FLUI_E022,
  FLUI_E023,
  FLUI_E024,
  FLUI_E025,
  FluiError,
  isError,
  isOk,
  ok,
} from './errors';
export type { Result } from './errors/result';
// generation/ module
export type {
  GenerationConfig,
  GenerationInput,
  GenerationOrchestrator,
  GenerationResult,
  PromptBuilder,
  SpecParser,
  StreamingGenerationOptions,
  StreamingGenerationOrchestrator,
  StreamingSpecParser,
} from './generation';
export {
  createGenerationOrchestrator,
  createPromptBuilder,
  createSpecParser,
  createStreamingOrchestrator,
  createStreamingSpecParser,
} from './generation';
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
  GenerationChunk,
  GenerationTrace,
  GenerationTraceInit,
  LLMConnector,
  LLMRequestOptions,
  LLMResponse,
  LLMUsage,
  StreamingLLMConnector,
  TraceStep,
} from './types';
export { createTrace, isStreamingConnector } from './types';
// validation/ module
export type {
  AnyValidatorFn,
  AsyncValidatorFn,
  RegenerateFn,
  ValidationAttempt,
  ValidationError,
  ValidationPipeline,
  ValidationPipelineConfig,
  ValidationResult,
  ValidationRetryConfig,
  ValidationRetryResult,
  ValidatorContext,
  ValidatorFn,
} from './validation';
export {
  a11yValidator,
  buildRetryPrompt,
  createValidationPipeline,
  dataAuthorizationValidator,
} from './validation';
