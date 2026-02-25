import { z } from 'zod';

import type { Result } from '../errors';
import { err, FLUI_E005, FluiError, ok } from '../errors';

import { componentDefinitionSchema } from './registry.schema';
import type { ComponentDefinition, RegistryEntry } from './registry.types';

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
    };

    this.entries.set(entry.name, entry);
    this.registryVersion += 1;

    return ok(undefined);
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
}
