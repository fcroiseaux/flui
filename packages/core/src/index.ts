// @flui/core - Core generation engine

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
