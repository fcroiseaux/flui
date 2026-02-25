import { describe, expect, it } from 'vitest';

describe('@flui/openai', () => {
  it('exports createOpenAIConnector factory function', async () => {
    const api = await import('./index');
    expect(api.createOpenAIConnector).toBeDefined();
    expect(typeof api.createOpenAIConnector).toBe('function');
  });
});
