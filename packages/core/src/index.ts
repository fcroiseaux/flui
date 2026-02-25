// @flui/core - Core generation engine

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
  FluiError,
  isError,
  isOk,
  ok,
} from './errors';
export type { Result } from './errors/result';

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
