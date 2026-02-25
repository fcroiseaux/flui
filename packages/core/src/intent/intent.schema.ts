import { z } from 'zod';

import type { Intent, StructuredIntent, TextIntent } from './intent.types';

/** Validates a text intent input */
export const textIntentSchema = z.strictObject({
  type: z.literal('text'),
  text: z.string().min(1),
});

/** Validates a structured intent input */
export const structuredIntentSchema = z.strictObject({
  type: z.literal('structured'),
  componentType: z.string().min(1),
  dataShape: z.record(z.string(), z.unknown()).optional(),
  interactionPattern: z.string().optional(),
});

/** Discriminated union schema for all intent types */
export const intentSchema = z.discriminatedUnion('type', [
  textIntentSchema,
  structuredIntentSchema,
]);

// ── AssertEqual type assertions: schema ↔ TypeScript type sync ──────────

type AssertEqual<T, U> = [T] extends [U] ? ([U] extends [T] ? true : never) : never;

type _TextIntentSchemaMatches = AssertEqual<z.infer<typeof textIntentSchema>, TextIntent>;
const _assertTextIntentSchemaMatches: _TextIntentSchemaMatches = true;
void _assertTextIntentSchemaMatches;

type _StructuredIntentSchemaMatches = AssertEqual<
  z.infer<typeof structuredIntentSchema>,
  StructuredIntent
>;
const _assertStructuredIntentSchemaMatches: _StructuredIntentSchemaMatches = true;
void _assertStructuredIntentSchemaMatches;

type _IntentSchemaMatches = AssertEqual<z.infer<typeof intentSchema>, Intent>;
const _assertIntentSchemaMatches: _IntentSchemaMatches = true;
void _assertIntentSchemaMatches;
