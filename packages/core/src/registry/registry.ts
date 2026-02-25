import { z } from 'zod';

import type { Result } from '../errors';
import { err, FLUI_E005, FluiError, ok } from '../errors';

import { componentDefinitionSchema } from './registry.schema';
import type {
  ComponentDefinition,
  RegistryEntry,
  SerializedComponent,
  SerializedRegistry,
} from './registry.types';

/**
 * Component registry for storing and retrieving registered UI components.
 * All operations are synchronous (no I/O). Methods that can fail return Result<T, FluiError>.
 */
export class ComponentRegistry {
  private readonly entries = new Map<string, RegistryEntry>();
  private registryVersion = 0;

  /**
   * Registers a component definition after validating its metadata.
   * Returns Result.error with FLUI_E005 if validation fails or name is duplicate.
   */
  register(definition: ComponentDefinition): Result<void, FluiError> {
    const parseResult = componentDefinitionSchema.safeParse(definition);

    if (!parseResult.success) {
      const tree = z.treeifyError(parseResult.error);
      return err(
        new FluiError(FLUI_E005, 'validation', `Schema validation failed: ${JSON.stringify(tree)}`),
      );
    }

    if (this.entries.has(definition.name)) {
      return err(
        new FluiError(
          FLUI_E005,
          'validation',
          `Schema validation failed: component '${definition.name}' already registered`,
        ),
      );
    }

    const entry: RegistryEntry = {
      name: definition.name,
      category: definition.category,
      description: definition.description,
      accepts: definition.accepts,
      component: definition.component,
      metadata: definition.metadata,
    };

    this.entries.set(entry.name, entry);
    this.registryVersion += 1;

    return ok(undefined);
  }

  /**
   * Registers multiple component definitions atomically.
   * All definitions are validated first; if any fail, none are registered.
   * The registry version increments once (not per-component).
   */
  batchRegister(definitions: ComponentDefinition[]): Result<void, FluiError> {
    if (definitions.length === 0) {
      return ok(undefined);
    }

    const errors: string[] = [];
    const seenNames = new Set<string>();

    for (const definition of definitions) {
      const parseResult = componentDefinitionSchema.safeParse(definition);
      if (!parseResult.success) {
        const tree = z.treeifyError(parseResult.error);
        errors.push(
          `[${errors.length}] "${definition.name}": schema validation failed: ${JSON.stringify(tree)}`,
        );
        continue;
      }

      if (seenNames.has(definition.name)) {
        errors.push(`[${errors.length}] "${definition.name}": duplicate name within batch`);
        continue;
      }

      if (this.entries.has(definition.name)) {
        errors.push(`[${errors.length}] "${definition.name}": component already registered`);
        continue;
      }

      seenNames.add(definition.name);
    }

    if (errors.length > 0) {
      return err(
        new FluiError(
          FLUI_E005,
          'validation',
          `Batch registration failed with ${errors.length} error(s):\n  ${errors.join('\n  ')}`,
        ),
      );
    }

    for (const definition of definitions) {
      const entry: RegistryEntry = {
        name: definition.name,
        category: definition.category,
        description: definition.description,
        accepts: definition.accepts,
        component: definition.component,
        metadata: definition.metadata,
      };
      this.entries.set(entry.name, entry);
    }

    this.registryVersion += 1;

    return ok(undefined);
  }

  /**
   * Returns all registry entries matching the given category (exact, case-sensitive).
   */
  queryByCategory(category: string): RegistryEntry[] {
    const results: RegistryEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.category === category) {
        results.push(entry);
      }
    }
    return results;
  }

  /**
   * Returns all registry entries whose metadata contains all specified key-value pairs.
   * Components without metadata are never returned.
   * Empty query object returns all entries that have metadata defined.
   */
  queryByMetadata(query: Record<string, unknown>): RegistryEntry[] {
    const queryEntries = Object.entries(query);
    const results: RegistryEntry[] = [];

    for (const entry of this.entries.values()) {
      if (entry.metadata === undefined) {
        continue;
      }

      let matches = true;
      for (const [key, value] of queryEntries) {
        if (entry.metadata[key] !== value) {
          matches = false;
          break;
        }
      }

      if (matches) {
        results.push(entry);
      }
    }

    return results;
  }

  /**
   * Returns all registered entries as an array.
   */
  getAll(): RegistryEntry[] {
    return [...this.entries.values()];
  }

  /**
   * Retrieves a registered component by name.
   * Returns undefined if not found.
   */
  getByName(name: string): RegistryEntry | undefined {
    return this.entries.get(name);
  }

  /**
   * Returns the current registry version (increments on each registration).
   * Used for cache key computation.
   */
  get version(): number {
    return this.registryVersion;
  }

  /**
   * Serializes the registry contents into a format optimized for LLM prompt construction.
   * Components are sorted alphabetically by name for deterministic output.
   * Returns SerializedRegistry directly (no Result wrapper — registry state is always valid).
   */
  serialize(): SerializedRegistry {
    if (this.entries.size === 0) {
      return { version: 0, components: [] };
    }

    const sortedEntries = [...this.entries.values()].sort((a, b) => a.name.localeCompare(b.name));

    const components: SerializedComponent[] = sortedEntries.map((entry) => ({
      name: entry.name,
      category: entry.category,
      description: entry.description,
      propsSchema: this.zodSchemaToPropsSchema(entry.accepts),
    }));

    return {
      version: this.registryVersion,
      components,
    };
  }

  /**
   * Converts a Zod schema to a simplified human-readable props schema for LLM consumption.
   * Uses z.toJSONSchema() for conversion, with fallback to {} on failure.
   */
  private zodSchemaToPropsSchema(schema: z.ZodTypeAny): Record<string, unknown> {
    try {
      const jsonSchema = z.toJSONSchema(schema);
      const properties = (jsonSchema as Record<string, unknown>).properties;

      if (properties === undefined || properties === null || typeof properties !== 'object') {
        return { value: this.simplifyJsonSchemaType(jsonSchema) };
      }

      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(properties as Record<string, unknown>)) {
        result[key] = this.simplifyJsonSchemaType(value);
      }
      return result;
    } catch {
      return {};
    }
  }

  /**
   * Simplifies a JSON Schema type descriptor to a human-readable string.
   */
  private simplifyJsonSchemaType(schemaProperty: unknown): string {
    if (
      schemaProperty === null ||
      schemaProperty === undefined ||
      typeof schemaProperty !== 'object'
    ) {
      return 'unknown';
    }

    const prop = schemaProperty as Record<string, unknown>;
    const type = prop.type;

    if (type === 'array') {
      const items = prop.items;
      if (items !== null && items !== undefined && typeof items === 'object') {
        const itemType = (items as Record<string, unknown>).type;
        if (typeof itemType === 'string') {
          return `array<${itemType}>`;
        }
      }
      return 'array';
    }

    if (typeof type === 'string') {
      return type;
    }

    // Handle anyOf/oneOf (e.g., optional fields in Zod 4 JSON Schema)
    const anyOf = prop.anyOf;
    if (Array.isArray(anyOf)) {
      const nonNullTypes = anyOf.filter(
        (t): t is Record<string, unknown> =>
          t !== null && typeof t === 'object' && (t as Record<string, unknown>).type !== 'null',
      );
      if (nonNullTypes.length === 1 && nonNullTypes[0] !== undefined) {
        return this.simplifyJsonSchemaType(nonNullTypes[0]);
      }
    }

    return 'unknown';
  }
}
