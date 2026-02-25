import type { Result } from '../errors';

/**
 * Base type for all context data. All context objects are JSON-serializable records.
 */
export type ContextData = Record<string, unknown>;

/**
 * Viewport dimensions in logical pixels.
 */
export interface ViewportSize {
  width: number;
  height: number;
}

/**
 * Identity context: describes the current user for UI adaptation.
 */
export interface IdentityContext extends ContextData {
  role: string;
  permissions: string[];
  expertiseLevel: 'novice' | 'intermediate' | 'expert';
}

/**
 * Environment context: describes the runtime environment for responsive adaptation.
 */
export interface EnvironmentContext extends ContextData {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  viewportSize: ViewportSize;
  connectionQuality: 'fast' | 'slow' | 'offline';
}

/**
 * A context provider resolves contextual data asynchronously.
 * Providers never throw — they return Result types.
 */
export interface ContextProvider<T extends ContextData = ContextData> {
  readonly name: string;
  resolve(signal?: AbortSignal): Promise<Result<T>>;
}

/**
 * Input to a context factory: either static data or a resolver function.
 */
export type ContextResolver<T> = T | (() => T | Promise<T>);
