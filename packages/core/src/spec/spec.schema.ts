import { z } from 'zod';

import type {
  ComponentSpec,
  InteractionSpec,
  LayoutSpec,
  UISpecification,
  UISpecificationMetadata,
} from './spec.types';

/** Validates LayoutSpec spatial arrangement */
export const layoutSpecSchema: z.ZodType<LayoutSpec> = z.strictObject({
  type: z.enum(['stack', 'grid', 'flex', 'absolute']),
  direction: z.enum(['horizontal', 'vertical']).optional(),
  spacing: z.number().nonnegative().optional(),
  alignment: z.enum(['start', 'center', 'end', 'stretch']).optional(),
  children: z.lazy(() => z.array(layoutSpecSchema)).optional(),
});

/** Validates ComponentSpec component references with typed props */
export const componentSpecSchema: z.ZodType<ComponentSpec> = z.strictObject({
  id: z.string().min(1),
  componentType: z.string().min(1),
  props: z.record(z.string(), z.unknown()),
  key: z.string().optional(),
  children: z.lazy(() => z.array(componentSpecSchema)).optional(),
});

/** Validates InteractionSpec data flow wiring */
export const interactionSpecSchema: z.ZodType<InteractionSpec> = z.strictObject({
  source: z.string().min(1),
  target: z.string().min(1),
  event: z.string().min(1),
  dataMapping: z.record(z.string(), z.string()).optional(),
});

/** Validates UISpecificationMetadata generation info */
export const uiSpecificationMetadataSchema: z.ZodType<UISpecificationMetadata> = z.strictObject({
  generatedAt: z.int().nonnegative(),
  model: z.string().optional(),
  intentHash: z.string().optional(),
  traceId: z.string().optional(),
  custom: z.record(z.string(), z.unknown()).optional(),
});

/** Validates complete UISpecification structure */
export const uiSpecificationSchema: z.ZodType<UISpecification> = z.strictObject({
  version: z.string().min(1),
  components: z.array(componentSpecSchema),
  layout: layoutSpecSchema,
  interactions: z.array(interactionSpecSchema),
  metadata: uiSpecificationMetadataSchema,
});

type AssertEqual<T, U> = [T] extends [U] ? ([U] extends [T] ? true : never) : never;

type _ComponentSpecSchemaMatches = AssertEqual<z.infer<typeof componentSpecSchema>, ComponentSpec>;
type _InteractionSpecSchemaMatches = AssertEqual<
  z.infer<typeof interactionSpecSchema>,
  InteractionSpec
>;
type _LayoutSpecSchemaMatches = AssertEqual<z.infer<typeof layoutSpecSchema>, LayoutSpec>;
type _MetadataSchemaMatches = AssertEqual<
  z.infer<typeof uiSpecificationMetadataSchema>,
  UISpecificationMetadata
>;
type _UISpecificationSchemaMatches = AssertEqual<
  z.infer<typeof uiSpecificationSchema>,
  UISpecification
>;
