import { describe, expect, it } from 'vitest';

describe('@flui/react', () => {
  it('exports FluiProvider', async () => {
    const api = await import('./index');
    expect(typeof api.FluiProvider).toBe('function');
  });

  it('exports LiquidView', async () => {
    const api = await import('./index');
    expect(typeof api.LiquidView).toBe('function');
  });

  it('exports useFluiContext', async () => {
    const api = await import('./index');
    expect(typeof api.useFluiContext).toBe('function');
  });

  it('exports useLiquidView', async () => {
    const api = await import('./index');
    expect(typeof api.useLiquidView).toBe('function');
  });

  it('exports renderSpec', async () => {
    const api = await import('./index');
    expect(typeof api.renderSpec).toBe('function');
  });
});
