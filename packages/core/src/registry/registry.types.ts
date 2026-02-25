import type { z } from 'zod';

/**
 * Input type for registering a component with the registry.
 * The `component` field is `unknown` — @flui/core has zero React awareness.
 * React-specific typing is added at the adapter layer (@flui/react).
 */
export interface ComponentDefinition {
  /** Unique component name used for lookup and serialization */
  name: string;
  /** Classification category (e.g., 'data', 'layout', 'input') */
  category: string;
  /** Human-readable description of the component's purpose */
  description: string;
  /** Zod schema defining accepted props */
  accepts: z.ZodTypeAny;
  /** The component implementation (framework-agnostic, typed at adapter layer) */
  component: unknown;
}

/**
 * Stored type after validation — same shape as ComponentDefinition
 * but guaranteed to have passed schema validation.
 */
export interface RegistryEntry {
  /** Unique component name used for lookup and serialization */
  name: string;
  /** Classification category (e.g., 'data', 'layout', 'input') */
  category: string;
  /** Human-readable description of the component's purpose */
  description: string;
  /** Zod schema defining accepted props */
  accepts: z.ZodTypeAny;
  /** The component implementation (framework-agnostic, typed at adapter layer) */
  component: unknown;
}

/**
 * Serialized form of a single component for LLM prompt construction.
 * Forward-compatible type for Story 2.3 — serialization logic not implemented here.
 */
export interface SerializedComponent {
  /** Component name */
  name: string;
  /** Classification category */
  category: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema representation of accepted props */
  propsSchema: Record<string, unknown>;
}

/**
 * Serialized form of the entire registry for LLM prompt construction.
 * Forward-compatible type for Story 2.3 — serialization logic not implemented here.
 */
export interface SerializedRegistry {
  /** Registry version counter (increments on each registration) */
  version: number;
  /** Serialized component entries */
  components: SerializedComponent[];
}
