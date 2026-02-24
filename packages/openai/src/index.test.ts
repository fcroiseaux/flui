import { describe, expect, it } from 'vitest';

describe('@flui/openai', () => {
  it('exports an empty API barrel for now', async () => {
    const api = await import('./index');
    expect(Object.keys(api)).toEqual([]);
  });
});
