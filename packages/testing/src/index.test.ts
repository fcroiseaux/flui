import { describe, expect, it } from 'vitest';

describe('@flui/testing', () => {
  it('exports all public API members', async () => {
    const api = await import('./index');
    const exportedKeys = Object.keys(api);

    // MockConnector
    expect(exportedKeys).toContain('createMockConnector');

    // UISpecification Builder
    expect(exportedKeys).toContain('createSpecBuilder');
    expect(exportedKeys).toContain('createMinimalSpec');
    expect(exportedKeys).toContain('createSpecWithChildren');

    // Render Helpers
    expect(exportedKeys).toContain('createTestRegistry');
    expect(exportedKeys).toContain('renderLiquidView');
    expect(exportedKeys).toContain('waitForGeneration');
  });

  it('exports createMockConnector as a function', async () => {
    const { createMockConnector } = await import('./index');
    expect(typeof createMockConnector).toBe('function');
  });

  it('exports createSpecBuilder as a function', async () => {
    const { createSpecBuilder } = await import('./index');
    expect(typeof createSpecBuilder).toBe('function');
  });

  it('exports createTestRegistry as a function', async () => {
    const { createTestRegistry } = await import('./index');
    expect(typeof createTestRegistry).toBe('function');
  });

  it('exports renderLiquidView as a function', async () => {
    const { renderLiquidView } = await import('./index');
    expect(typeof renderLiquidView).toBe('function');
  });

  it('exports waitForGeneration as a function', async () => {
    const { waitForGeneration } = await import('./index');
    expect(typeof waitForGeneration).toBe('function');
  });
});
