import { describe, expect, it } from 'vitest';

describe('@flui/anthropic', () => {
  it('exports createAnthropicConnector factory function', async () => {
    const api = await import('./index');
    expect(api.createAnthropicConnector).toBeDefined();
    expect(typeof api.createAnthropicConnector).toBe('function');
  });
});
