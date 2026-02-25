import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ComponentSpec, InteractionSpec, LayoutSpec, UISpecification } from './index';

describe('@flui/core', () => {
  it('exports spec module public API', async () => {
    const api = await import('./index');
    const exportedKeys = Object.keys(api);

    // Schema exports
    expect(exportedKeys).toContain('componentSpecSchema');
    expect(exportedKeys).toContain('layoutSpecSchema');
    expect(exportedKeys).toContain('interactionSpecSchema');
    expect(exportedKeys).toContain('uiSpecificationMetadataSchema');
    expect(exportedKeys).toContain('uiSpecificationSchema');

    // Constants
    expect(exportedKeys).toContain('SPEC_VERSION');
  });

  it('supports public type imports from @flui/core barrel', () => {
    expectTypeOf<ComponentSpec>().toBeObject();
    expectTypeOf<LayoutSpec>().toBeObject();
    expectTypeOf<InteractionSpec>().toBeObject();
    expectTypeOf<UISpecification>().toBeObject();
  });
});
