import type { FluiError, LLMRequestOptions, LLMResponse, Result } from '@flui/core';
import { FLUI_E009, FLUI_E010, err, ok } from '@flui/core';
import { FluiError as FluiErrorClass } from '@flui/core';

import type { MockConnector, MockConnectorCall } from './testing.types';

type QueueEntry =
  | { type: 'response'; value: LLMResponse }
  | { type: 'error'; value: FluiError };

/**
 * Creates a mock LLM connector for deterministic testing.
 *
 * Implements the LLMConnector interface from @flui/core.
 * Returns preconfigured responses from a FIFO queue.
 * Tracks all generate() calls for assertion.
 */
export function createMockConnector(): MockConnector {
  const queue: QueueEntry[] = [];
  const callHistory: MockConnectorCall[] = [];

  return {
    enqueue(response: LLMResponse): void {
      queue.push({ type: 'response', value: response });
    },

    enqueueError(error: FluiError): void {
      queue.push({ type: 'error', value: error });
    },

    async generate(
      prompt: string,
      options: LLMRequestOptions,
      signal?: AbortSignal,
    ): Promise<Result<LLMResponse>> {
      callHistory.push({ prompt, options, signal });

      if (signal?.aborted) {
        return err(
          new FluiErrorClass(
            FLUI_E010,
            'connector',
            'Operation cancelled: AbortSignal was already aborted',
          ),
        );
      }

      const entry = queue.shift();
      if (!entry) {
        return err(
          new FluiErrorClass(
            FLUI_E009,
            'connector',
            'MockConnector: no more queued responses. Call enqueue() or enqueueError() before generate().',
          ),
        );
      }

      if (entry.type === 'error') {
        return err(entry.value);
      }

      return ok(entry.value);
    },

    get calls(): readonly MockConnectorCall[] {
      return callHistory.slice();
    },

    reset(): void {
      queue.length = 0;
      callHistory.length = 0;
    },
  };
}
