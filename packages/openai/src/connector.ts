import type { LLMConnector, LLMRequestOptions, LLMResponse, Result } from '@flui/core';
import { err, FLUI_E002, FLUI_E010, FLUI_E014, FluiError, ok } from '@flui/core';
import OpenAI from 'openai';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';

import type { OpenAIConnectorConfig } from './openai.types';

class OpenAIConnectorImpl implements LLMConnector {
  private readonly client: OpenAI;

  constructor(config: OpenAIConnectorConfig) {
    if (config.apiKey.trim().length === 0) {
      throw new FluiError(FLUI_E002, 'config', 'OpenAI API key is required');
    }
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout,
    });
  }

  async generate(
    prompt: string,
    options: LLMRequestOptions,
    signal?: AbortSignal,
  ): Promise<Result<LLMResponse>> {
    if (signal?.aborted) {
      return err(new FluiError(FLUI_E010, 'connector', 'Generation cancelled'));
    }

    try {
      const body: ChatCompletionCreateParamsNonStreaming = {
        model: options.model,
        messages: [{ role: 'user', content: prompt }],
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.maxTokens !== undefined && { max_tokens: options.maxTokens }),
        ...(options.responseFormat === 'json' && { response_format: { type: 'json_object' } }),
      };

      const response = await this.client.chat.completions.create(body, { signal });

      if (signal?.aborted) {
        return err(new FluiError(FLUI_E010, 'connector', 'Generation cancelled'));
      }

      const choice = response.choices[0];
      return ok({
        content: choice?.message.content ?? '',
        model: response.model,
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
      });
    } catch (caught: unknown) {
      if (signal?.aborted) {
        return err(new FluiError(FLUI_E010, 'connector', 'Generation cancelled'));
      }

      const message = caught instanceof Error ? caught.message : String(caught);
      const status =
        typeof caught === 'object' &&
        caught !== null &&
        'status' in caught &&
        typeof (caught as { status: unknown }).status === 'number'
          ? (caught as { status: number }).status
          : undefined;
      return err(
        new FluiError(FLUI_E014, 'connector', `OpenAI API error: ${message}`, {
          cause: caught instanceof Error ? caught : undefined,
          context: { model: options.model, ...(status !== undefined && { status }) },
        }),
      );
    }
  }
}

export function createOpenAIConnector(config: OpenAIConnectorConfig): LLMConnector {
  return new OpenAIConnectorImpl(config);
}
