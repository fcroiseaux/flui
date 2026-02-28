import { FLUI_E002, FLUI_E010, FLUI_E014, FluiError, isError, isOk } from '@flui/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOpenAIConnector } from './connector';

const mockCreate = vi.fn();

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = { completions: { create: mockCreate } };
    },
  };
});

const defaultOptions = { model: 'gpt-4o' };

describe('OpenAIConnector', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  describe('constructor', () => {
    it('throws FluiError with FLUI_E002 when API key is empty or whitespace', () => {
      expect(() => createOpenAIConnector({ apiKey: '' })).toThrow(FluiError);
      expect(() => createOpenAIConnector({ apiKey: '   ' })).toThrow(FluiError);
      try {
        createOpenAIConnector({ apiKey: '' });
      } catch (e) {
        expect(e).toBeInstanceOf(FluiError);
        expect((e as FluiError).code).toBe(FLUI_E002);
        expect((e as FluiError).category).toBe('config');
      }
    });

    it('creates connector successfully with valid API key', () => {
      expect(() => createOpenAIConnector({ apiKey: 'sk-test' })).not.toThrow();
    });
  });

  describe('generate()', () => {
    it('returns Result.ok with LLMResponse on success', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Hello world' } }],
        model: 'gpt-4o',
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });

      const connector = createOpenAIConnector({ apiKey: 'sk-test' });
      const result = await connector.generate('Say hello', defaultOptions);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect(result.value.content).toBe('Hello world');
      expect(result.value.model).toBe('gpt-4o');
      expect(result.value.usage.promptTokens).toBe(10);
      expect(result.value.usage.completionTokens).toBe(5);
      expect(result.value.usage.totalTokens).toBe(15);
    });

    it('handles missing usage data gracefully', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Hi' } }],
        model: 'gpt-4o',
        usage: undefined,
      });

      const connector = createOpenAIConnector({ apiKey: 'sk-test' });
      const result = await connector.generate('Hi', defaultOptions);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect(result.value.usage.promptTokens).toBe(0);
      expect(result.value.usage.completionTokens).toBe(0);
      expect(result.value.usage.totalTokens).toBe(0);
    });

    it('handles empty choices array gracefully', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [],
        model: 'gpt-4o',
        usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
      });

      const connector = createOpenAIConnector({ apiKey: 'sk-test' });
      const result = await connector.generate('Hi', defaultOptions);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect(result.value.content).toBe('');
    });

    it('passes temperature and maxTokens to the SDK', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OK' } }],
        model: 'gpt-4o',
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });

      const connector = createOpenAIConnector({ apiKey: 'sk-test' });
      await connector.generate('Hi', {
        model: 'gpt-4o',
        temperature: 0.5,
        maxTokens: 100,
        responseFormat: 'json',
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          temperature: 0.5,
          max_tokens: 100,
          response_format: { type: 'json_object' },
        }),
        expect.objectContaining({ signal: undefined }),
      );
    });

    it('maps json_schema responseFormat to OpenAI Structured Outputs', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '{"version":"1.0.0"}' } }],
        model: 'gpt-4o',
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });

      const testSchema = { type: 'object', properties: { version: { type: 'string' } } };
      const connector = createOpenAIConnector({ apiKey: 'sk-test' });
      await connector.generate('Generate UI', {
        model: 'gpt-4o',
        responseFormat: { type: 'json_schema', jsonSchema: testSchema },
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'UISpecification',
              strict: false,
              schema: testSchema,
            },
          },
        }),
        expect.objectContaining({ signal: undefined }),
      );
    });

    it('does not set response_format when responseFormat is undefined', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'text response' } }],
        model: 'gpt-4o',
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      });

      const connector = createOpenAIConnector({ apiKey: 'sk-test' });
      await connector.generate('Hi', { model: 'gpt-4o' });

      const callArgs = mockCreate.mock.calls[0]?.[0];
      expect(callArgs?.response_format).toBeUndefined();
    });

    it('returns FLUI_E010 when AbortSignal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const connector = createOpenAIConnector({ apiKey: 'sk-test' });
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

      const connector = createOpenAIConnector({ apiKey: 'sk-test' });
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

      const connector = createOpenAIConnector({ apiKey: 'sk-test' });
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

      const connector = createOpenAIConnector({ apiKey: 'sk-test' });
      const result = await connector.generate('Hi', defaultOptions);

      expect(isError(result)).toBe(true);
      if (!isError(result)) return;
      expect(result.error.code).toBe(FLUI_E014);
      expect(result.error.category).toBe('connector');
      expect(result.error.cause).toBeInstanceOf(Error);
      expect(result.error.context).toEqual({ model: 'gpt-4o', status: 429 });
    });

    it('returns FLUI_E014 on network error', async () => {
      const networkError = new Error('fetch failed');
      mockCreate.mockRejectedValueOnce(networkError);

      const connector = createOpenAIConnector({ apiKey: 'sk-test' });
      const result = await connector.generate('Hi', defaultOptions);

      expect(isError(result)).toBe(true);
      if (!isError(result)) return;
      expect(result.error.code).toBe(FLUI_E014);
      expect(result.error.category).toBe('connector');
      expect(result.error.cause).toBe(networkError);
    });

    it('wraps non-Error thrown values as FLUI_E014', async () => {
      mockCreate.mockRejectedValueOnce('string error');

      const connector = createOpenAIConnector({ apiKey: 'sk-test' });
      const result = await connector.generate('Hi', defaultOptions);

      expect(isError(result)).toBe(true);
      if (!isError(result)) return;
      expect(result.error.code).toBe(FLUI_E014);
      expect(result.error.cause).toBeUndefined();
      expect(result.error.message).toContain('string error');
    });
  });
});
