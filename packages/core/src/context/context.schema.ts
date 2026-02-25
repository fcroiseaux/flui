import { z } from 'zod';

import type { EnvironmentContext, IdentityContext, ViewportSize } from './context.types';

/** Validates viewport dimensions (positive integers). */
export const viewportSizeSchema = z.strictObject({
  width: z.number().positive(),
  height: z.number().positive(),
});

/** Validates identity context data. */
export const identityContextSchema = z.strictObject({
  role: z.string().min(1),
  permissions: z.array(z.string()),
  expertiseLevel: z.enum(['novice', 'intermediate', 'expert']),
});

/** Validates environment context data. */
export const environmentContextSchema = z.strictObject({
  deviceType: z.enum(['mobile', 'tablet', 'desktop']),
  viewportSize: viewportSizeSchema,
  connectionQuality: z.enum(['fast', 'slow', 'offline']),
});

// ── AssertEqual type assertions: schema ↔ TypeScript type sync ──────────

type AssertEqual<T, U> = [T] extends [U] ? ([U] extends [T] ? true : never) : never;

type _ViewportSizeSchemaMatches = AssertEqual<z.infer<typeof viewportSizeSchema>, ViewportSize>;
const _assertViewportSizeSchemaMatches: _ViewportSizeSchemaMatches = true;
void _assertViewportSizeSchemaMatches;

type _IdentityContextSchemaMatches = AssertEqual<
  z.infer<typeof identityContextSchema>,
  IdentityContext
>;
const _assertIdentityContextSchemaMatches: _IdentityContextSchemaMatches = true;
void _assertIdentityContextSchemaMatches;

type _EnvironmentContextSchemaMatches = AssertEqual<
  z.infer<typeof environmentContextSchema>,
  EnvironmentContext
>;
const _assertEnvironmentContextSchemaMatches: _EnvironmentContextSchemaMatches = true;
void _assertEnvironmentContextSchemaMatches;
