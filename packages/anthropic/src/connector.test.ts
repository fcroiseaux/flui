import { FLUI_E002, FLUI_E010, FLUI_E014, FluiError, isError, isOk } from '@flui/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnthropicConnector } from './connector';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
    },
  };
});

const defaultOptions = { model: 'claude-sonnet-4-20250514' };

describe('AnthropicConnector', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  describe('constructor', () => {
    it('throws FluiError with FLUI_E002 when API key is empty or whitespace', () => {
      expect(() => createAnthropicConnector({ apiKey: '' })).toThrow(FluiError);
      expect(() => createAnthropicConnector({ apiKey: '   ' })).toThrow(FluiError);
      try {
        createAnthropicConnector({ apiKey: '' });
      } catch (e) {
        expect(e).toBeInstanceOf(FluiError);
        expect((e as FluiError).code).toBe(FLUI_E002);
        expect((e as FluiError).category).toBe('config');
      }
    });

    it('creates connector successfully with valid API key', () => {
      expect(() => createAnthropicConnector({ apiKey: 'sk-ant-test' })).not.toThrow();
    });
  });

  describe('generate()', () => {
    it('returns Result.ok with LLMResponse on success', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Hello world' }],
        model: 'claude-sonnet-4-20250514',
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      const connector = createAnthropicConnector({ apiKey: 'sk-ant-test' });
      const result = await connector.generate('Say hello', defaultOptions);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect(result.value.content).toBe('Hello world');
      expect(result.value.model).toBe('claude-sonnet-4-20250514');
      expect(result.value.usage.promptTokens).toBe(10);
      expect(result.value.usage.completionTokens).toBe(5);
      expect(result.value.usage.totalTokens).toBe(15);
    });

    it('handles response with no text blocks gracefully', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [],
        model: 'claude-sonnet-4-20250514',
        usage: { input_tokens: 5, output_tokens: 0 },
      });

      const connector = createAnthropicConnector({ apiKey: 'sk-ant-test' });
      const result = await connector.generate('Hi', defaultOptions);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect(result.value.content).toBe('');
    });

    it('defaults max_tokens to 4096 when not specified', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'OK' }],
        model: 'claude-sonnet-4-20250514',
        usage: { input_tokens: 1, output_tokens: 1 },
      });

      const connector = createAnthropicConnector({ apiKey: 'sk-ant-test' });
      await connector.generate('Hi', { model: 'claude-sonnet-4-20250514' });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 4096,
        }),
        expect.objectContaining({ signal: undefined }),
      );
    });

    it('passes temperature and maxTokens to the SDK', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'OK' }],
        model: 'claude-sonnet-4-20250514',
        usage: { input_tokens: 1, output_tokens: 1 },
      });

      const connector = createAnthropicConnector({ apiKey: 'sk-ant-test' });
      await connector.generate('Hi', {
        model: 'claude-sonnet-4-20250514',
        temperature: 0.7,
        maxTokens: 200,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-20250514',
          temperature: 0.7,
          max_tokens: 200,
        }),
        expect.objectContaining({ signal: undefined }),
      );
    });

    it('returns FLUI_E010 when AbortSignal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const connector = createAnthropicConnector({ apiKey: 'sk-ant-test' });
      const result = await connector.generate('Hi', defaultOptions, controller.signal);

      expect(isError(result)).toBe(true);
      if (!isError(result)) return;
      expect(result.error.code).toBe(FLUI_E010);
      expect(result.error.category).toBe('connector');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns FLUI_E010 when AbortSignal aborts during request', async () => {
      const controller = new AbortController();
      mockCreate.mockImplementationOnce(() => {
        controller.abort();
        throw new Error('Request aborted');
      });

      const connector = createAnthropicConnector({ apiKey: 'sk-ant-test' });
      const result = await connector.generate('Hi', defaultOptions, controller.signal);

      expect(isError(result)).toBe(true);
      if (!isError(result)) return;
      expect(result.error.code).toBe(FLUI_E010);
      expect(result.error.category).toBe('connector');
    });

    it('returns FLUI_E014 on timeout error', async () => {
      const timeoutError = new Error('Request timed out');
      timeoutError.name = 'APIError';
      mockCreate.mockRejectedValueOnce(timeoutError);

      const connector = createAnthropicConnector({ apiKey: 'sk-ant-test' });
      const result = await connector.generate('Hi', defaultOptions);

      expect(isError(result)).toBe(true);
      if (!isError(result)) return;
      expect(result.error.code).toBe(FLUI_E014);
      expect(result.error.category).toBe('connector');
      expect(result.error.cause).toBe(timeoutError);
    });

    it('returns FLUI_E014 on rate limit (429) error', async () => {
      const rateLimitError = new Error('Rate limited');
      rateLimitError.name = 'APIError';
      Object.assign(rateLimitError, { status: 429 });
      mockCreate.mockRejectedValueOnce(rateLimitError);

      const connector = createAnthropicConnector({ apiKey: 'sk-ant-test' });
      const result = await connector.generate('Hi', defaultOptions);

      expect(isError(result)).toBe(true);
      if (!isError(result)) return;
      expect(result.error.code).toBe(FLUI_E014);
      expect(result.error.category).toBe('connector');
      expect(result.error.cause).toBeInstanceOf(Error);
      expect(result.error.context).toEqual({ model: 'claude-sonnet-4-20250514', status: 429 });
    });

    it('returns FLUI_E014 on network error', async () => {
      const networkError = new Error('fetch failed');
      mockCreate.mockRejectedValueOnce(networkError);

      const connector = createAnthropicConnector({ apiKey: 'sk-ant-test' });
      const result = await connector.generate('Hi', defaultOptions);

      expect(isError(result)).toBe(true);
      if (!isError(result)) return;
      expect(result.error.code).toBe(FLUI_E014);
      expect(result.error.category).toBe('connector');
      expect(result.error.cause).toBe(networkError);
    });

    it('wraps non-Error thrown values as FLUI_E014', async () => {
      mockCreate.mockRejectedValueOnce('string error');

      const connector = createAnthropicConnector({ apiKey: 'sk-ant-test' });
      const result = await connector.generate('Hi', defaultOptions);

      expect(isError(result)).toBe(true);
      if (!isError(result)) return;
      expect(result.error.code).toBe(FLUI_E014);
      expect(result.error.cause).toBeUndefined();
      expect(result.error.message).toContain('string error');
    });
  });
});
