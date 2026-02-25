import Anthropic from '@anthropic-ai/sdk';
import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';
import type { LLMConnector, LLMRequestOptions, LLMResponse, Result } from '@flui/core';
import { err, FLUI_E002, FLUI_E010, FLUI_E014, FluiError, ok } from '@flui/core';

import type { AnthropicConnectorConfig } from './anthropic.types';

class AnthropicConnectorImpl implements LLMConnector {
  private readonly client: Anthropic;

  constructor(config: AnthropicConnectorConfig) {
    if (config.apiKey.trim().length === 0) {
      throw new FluiError(FLUI_E002, 'config', 'Anthropic API key is required');
    }
    this.client = new Anthropic({
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
      const body: MessageCreateParamsNonStreaming = {
        model: options.model,
        max_tokens: options.maxTokens ?? 4096,
        messages: [{ role: 'user', content: prompt }],
        ...(options.temperature !== undefined && { temperature: options.temperature }),
      };

      const message = await this.client.messages.create(body, { signal });

      if (signal?.aborted) {
        return err(new FluiError(FLUI_E010, 'connector', 'Generation cancelled'));
      }

      const textBlock = message.content.find((block) => block.type === 'text');
      return ok({
        content: textBlock && 'text' in textBlock ? textBlock.text : '',
        model: message.model,
        usage: {
          promptTokens: message.usage.input_tokens,
          completionTokens: message.usage.output_tokens,
          totalTokens: message.usage.input_tokens + message.usage.output_tokens,
        },
      });
    } catch (caught: unknown) {
      if (signal?.aborted) {
        return err(new FluiError(FLUI_E010, 'connector', 'Generation cancelled'));
      }

      const errorMessage = caught instanceof Error ? caught.message : String(caught);
      const status =
        typeof caught === 'object' &&
        caught !== null &&
        'status' in caught &&
        typeof (caught as { status: unknown }).status === 'number'
          ? (caught as { status: number }).status
          : undefined;
      return err(
        new FluiError(FLUI_E014, 'connector', `Anthropic API error: ${errorMessage}`, {
          cause: caught instanceof Error ? caught : undefined,
          context: { model: options.model, ...(status !== undefined && { status }) },
        }),
      );
    }
  }
}

export function createAnthropicConnector(config: AnthropicConnectorConfig): LLMConnector {
  return new AnthropicConnectorImpl(config);
}
