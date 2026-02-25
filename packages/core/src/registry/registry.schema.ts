import { z } from 'zod';

import type { ComponentDefinition } from './registry.types';

/** Validates ComponentDefinition input at registration time */
export const componentDefinitionSchema = z.strictObject({
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  accepts: z.custom<z.ZodTypeAny>(
    (val) => val instanceof z.ZodType,
    'accepts must be a Zod schema instance',
  ),
  component: z.unknown(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type AssertEqual<T, U> = [T] extends [U] ? ([U] extends [T] ? true : never) : never;

type _ComponentDefinitionSchemaMatches = AssertEqual<
  z.infer<typeof componentDefinitionSchema>,
  ComponentDefinition
>;

const _assertComponentDefinitionSchemaMatches: _ComponentDefinitionSchemaMatches = true;
void _assertComponentDefinitionSchemaMatches;
