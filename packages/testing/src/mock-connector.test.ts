import { FLUI_E009, FLUI_E010, FLUI_E014, FluiError } from '@flui/core';
import type { LLMRequestOptions, LLMResponse } from '@flui/core';
import { describe, expect, it } from 'vitest';

import { createMockConnector } from './mock-connector';

// ── Test Data Factories ─────────────────────────────────────────────

function createMockResponse(overrides?: Partial<LLMResponse>): LLMResponse {
  return {
    content: '{"version":"1.0.0","components":[]}',
    model: 'test-model',
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    ...overrides,
  };
}

function createMockOptions(overrides?: Partial<LLMRequestOptions>): LLMRequestOptions {
  return {
    model: 'test-model',
    ...overrides,
  };
}

// ── createMockConnector ─────────────────────────────────────────────

describe('createMockConnector', () => {
  it('returns an object implementing MockConnector interface', () => {
    const connector = createMockConnector();
    expect(connector).toBeDefined();
    expect(typeof connector.enqueue).toBe('function');
    expect(typeof connector.enqueueError).toBe('function');
    expect(typeof connector.generate).toBe('function');
    expect(typeof connector.reset).toBe('function');
    expect(connector.calls).toEqual([]);
  });

  // ── FIFO Response Queue ─────────────────────────────────────────

  describe('enqueue / generate', () => {
    it('returns enqueued responses in FIFO order', async () => {
      const connector = createMockConnector();
      const response1 = createMockResponse({ content: 'first' });
      const response2 = createMockResponse({ content: 'second' });

      connector.enqueue(response1);
      connector.enqueue(response2);

      const result1 = await connector.generate('prompt1', createMockOptions());
      expect(result1.ok).toBe(true);
      if (result1.ok) {
        expect(result1.value.content).toBe('first');
      }

      const result2 = await connector.generate('prompt2', createMockOptions());
      expect(result2.ok).toBe(true);
      if (result2.ok) {
        expect(result2.value.content).toBe('second');
      }
    });

    it('returns Result.error with FLUI_E009 when queue is empty', async () => {
      const connector = createMockConnector();
      const result = await connector.generate('prompt', createMockOptions());

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(FluiError);
        expect(result.error.code).toBe(FLUI_E009);
        expect(result.error.category).toBe('connector');
        expect(result.error.message).toContain('no more queued responses');
      }
    });

    it('returns enqueued response with full LLMResponse fields', async () => {
      const connector = createMockConnector();
      const response = createMockResponse({
        content: '{"test": true}',
        model: 'gpt-4o',
        usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      });

      connector.enqueue(response);
      const result = await connector.generate('test', createMockOptions());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(response);
      }
    });
  });

  // ── Error Queue ─────────────────────────────────────────────────

  describe('enqueueError', () => {
    it('returns enqueued errors via generate()', async () => {
      const connector = createMockConnector();
      const error = new FluiError(FLUI_E014, 'connector', 'Simulated timeout');

      connector.enqueueError(error);
      const result = await connector.generate('prompt', createMockOptions());

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(error);
        expect(result.error.code).toBe(FLUI_E014);
      }
    });

    it('interleaves responses and errors in FIFO order', async () => {
      const connector = createMockConnector();
      const response = createMockResponse({ content: 'ok' });
      const error = new FluiError(FLUI_E014, 'connector', 'Rate limit');

      connector.enqueue(response);
      connector.enqueueError(error);
      connector.enqueue(createMockResponse({ content: 'recovered' }));

      const r1 = await connector.generate('p1', createMockOptions());
      expect(r1.ok).toBe(true);

      const r2 = await connector.generate('p2', createMockOptions());
      expect(r2.ok).toBe(false);
      if (!r2.ok) {
        expect(r2.error.message).toBe('Rate limit');
      }

      const r3 = await connector.generate('p3', createMockOptions());
      expect(r3.ok).toBe(true);
      if (r3.ok) {
        expect(r3.value.content).toBe('recovered');
      }
    });
  });

  // ── AbortSignal Handling ────────────────────────────────────────

  describe('AbortSignal handling', () => {
    it('returns Result.error with FLUI_E010 when signal is already aborted', async () => {
      const connector = createMockConnector();
      connector.enqueue(createMockResponse());

      const controller = new AbortController();
      controller.abort();

      const result = await connector.generate('prompt', createMockOptions(), controller.signal);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(FluiError);
        expect(result.error.code).toBe(FLUI_E010);
        expect(result.error.category).toBe('connector');
      }
    });

    it('does not consume queue entry when signal is already aborted', async () => {
      const connector = createMockConnector();
      const response = createMockResponse();
      connector.enqueue(response);

      const controller = new AbortController();
      controller.abort();

      await connector.generate('prompt', createMockOptions(), controller.signal);

      // The enqueued response should still be available
      const result = await connector.generate('prompt2', createMockOptions());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(response);
      }
    });

    it('succeeds when signal is not aborted', async () => {
      const connector = createMockConnector();
      connector.enqueue(createMockResponse({ content: 'success' }));

      const controller = new AbortController();
      const result = await connector.generate('prompt', createMockOptions(), controller.signal);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.content).toBe('success');
      }
    });

    it('succeeds when no signal is provided', async () => {
      const connector = createMockConnector();
      connector.enqueue(createMockResponse());

      const result = await connector.generate('prompt', createMockOptions());
      expect(result.ok).toBe(true);
    });
  });

  // ── Call Tracking ───────────────────────────────────────────────

  describe('call tracking', () => {
    it('records prompt, options, and signal for each generate() call', async () => {
      const connector = createMockConnector();
      connector.enqueue(createMockResponse());
      connector.enqueue(createMockResponse());

      const opts1 = createMockOptions({ temperature: 0.5 });
      const controller = new AbortController();

      await connector.generate('first prompt', opts1, controller.signal);
      await connector.generate('second prompt', createMockOptions());

      expect(connector.calls).toHaveLength(2);
      expect(connector.calls[0]?.prompt).toBe('first prompt');
      expect(connector.calls[0]?.options).toBe(opts1);
      expect(connector.calls[0]?.signal).toBe(controller.signal);
      expect(connector.calls[1]?.prompt).toBe('second prompt');
      expect(connector.calls[1]?.signal).toBeUndefined();
    });

    it('records calls even when generate() returns an error', async () => {
      const connector = createMockConnector();
      await connector.generate('empty-queue', createMockOptions());

      expect(connector.calls).toHaveLength(1);
      expect(connector.calls[0]?.prompt).toBe('empty-queue');
    });

    it('records calls when signal is aborted', async () => {
      const connector = createMockConnector();
      connector.enqueue(createMockResponse());

      const controller = new AbortController();
      controller.abort();

      await connector.generate('aborted', createMockOptions(), controller.signal);

      expect(connector.calls).toHaveLength(1);
      expect(connector.calls[0]?.prompt).toBe('aborted');
      expect(connector.calls[0]?.signal?.aborted).toBe(true);
    });

    it('returns a copy of calls (not the internal array)', () => {
      const connector = createMockConnector();
      const calls1 = connector.calls;
      const calls2 = connector.calls;
      expect(calls1).not.toBe(calls2);
      expect(calls1).toEqual(calls2);
    });
  });

  // ── Reset ───────────────────────────────────────────────────────

  describe('reset', () => {
    it('clears the response queue', async () => {
      const connector = createMockConnector();
      connector.enqueue(createMockResponse());
      connector.enqueue(createMockResponse());

      connector.reset();

      const result = await connector.generate('prompt', createMockOptions());
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(FLUI_E009);
      }
    });

    it('clears the call history', async () => {
      const connector = createMockConnector();
      connector.enqueue(createMockResponse());
      await connector.generate('prompt', createMockOptions());

      expect(connector.calls).toHaveLength(1);
      connector.reset();
      expect(connector.calls).toHaveLength(0);
    });

    it('allows re-use after reset', async () => {
      const connector = createMockConnector();
      connector.enqueue(createMockResponse({ content: 'before' }));
      await connector.generate('p1', createMockOptions());

      connector.reset();

      connector.enqueue(createMockResponse({ content: 'after' }));
      const result = await connector.generate('p2', createMockOptions());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.content).toBe('after');
      }
      expect(connector.calls).toHaveLength(1);
      expect(connector.calls[0]?.prompt).toBe('p2');
    });
  });

  // ── LLMConnector Interface Compliance ───────────────────────────

  describe('LLMConnector interface compliance', () => {
    it('generate() returns a Promise', () => {
      const connector = createMockConnector();
      const result = connector.generate('prompt', createMockOptions());
      expect(result).toBeInstanceOf(Promise);
    });

    it('generate() accepts all LLMRequestOptions fields', async () => {
      const connector = createMockConnector();
      connector.enqueue(createMockResponse());

      const options: LLMRequestOptions = {
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 1000,
        responseFormat: 'json',
      };

      const result = await connector.generate('prompt', options);
      expect(result.ok).toBe(true);
      expect(connector.calls[0]?.options).toBe(options);
    });
  });
});
