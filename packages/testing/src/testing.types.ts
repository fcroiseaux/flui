import type { FluiError, LLMRequestOptions, LLMResponse } from '@flui/core';

/**
 * A single recorded call to MockConnector.generate().
 */
export interface MockConnectorCall {
  /** The prompt string passed to generate() */
  prompt: string;
  /** The options passed to generate() */
  options: LLMRequestOptions;
  /** The AbortSignal passed to generate(), if any */
  signal: AbortSignal | undefined;
}

/**
 * Mock LLM connector for deterministic testing.
 * Returns preconfigured responses from a FIFO queue.
 */
export interface MockConnector {
  /** Enqueue a successful response to be returned by the next generate() call */
  enqueue(response: LLMResponse): void;
  /** Enqueue an error to be returned by the next generate() call */
  enqueueError(error: FluiError): void;
  /** Generate a response from the queue (implements LLMConnector.generate) */
  generate(
    prompt: string,
    options: LLMRequestOptions,
    signal?: AbortSignal,
  ): Promise<import('@flui/core').Result<LLMResponse>>;
  /** Get all recorded generate() calls */
  readonly calls: readonly MockConnectorCall[];
  /** Reset the queue and call history */
  reset(): void;
}
