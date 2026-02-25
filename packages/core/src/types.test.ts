import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Result } from './errors/result';
import type {
  GenerationTraceInit,
  LLMConnector,
  LLMRequestOptions,
  LLMResponse,
  LLMUsage,
  TraceStep,
} from './types';
import { createTrace } from './types';

describe('LLMConnector', () => {
  it('accepts a minimal object satisfying the interface (structural typing)', () => {
    const connector: LLMConnector = {
      generate: async (_prompt: string, _options: LLMRequestOptions) => {
        return {
          ok: true as const,
          value: {
            content: '',
            model: 'test',
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          },
        };
      },
    };
    expect(connector).toBeDefined();
    expectTypeOf(connector).toMatchTypeOf<LLMConnector>();
  });

  it('generate returns Promise<Result<LLMResponse>>', () => {
    expectTypeOf<LLMConnector['generate']>().returns.toEqualTypeOf<Promise<Result<LLMResponse>>>();
  });

  it('AbortSignal parameter is optional', () => {
    const connector: LLMConnector = {
      generate: async (_prompt, _options, _signal?) => {
        return {
          ok: true as const,
          value: {
            content: '',
            model: 'test',
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          },
        };
      },
    };

    // Can call without signal
    const withoutSignal = connector.generate('test', { model: 'test' });
    expectTypeOf(withoutSignal).toEqualTypeOf<Promise<Result<LLMResponse>>>();

    // Can call with signal
    const controller = new AbortController();
    const withSignal = connector.generate('test', { model: 'test' }, controller.signal);
    expectTypeOf(withSignal).toEqualTypeOf<Promise<Result<LLMResponse>>>();
  });

  it('has no provider-specific properties', () => {
    // LLMConnector should only have the generate method
    expectTypeOf<LLMConnector>().toHaveProperty('generate');

    // Verify it doesn't have provider-specific properties
    type LLMConnectorKeys = keyof LLMConnector;
    expectTypeOf<LLMConnectorKeys>().toEqualTypeOf<'generate'>();
  });
});

describe('LLMRequestOptions', () => {
  it('requires model field', () => {
    const options: LLMRequestOptions = { model: 'gpt-4o' };
    expect(options.model).toBe('gpt-4o');
  });

  it('accepts all optional fields', () => {
    const options: LLMRequestOptions = {
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 1000,
      responseFormat: 'json',
    };
    expect(options.temperature).toBe(0.7);
    expect(options.maxTokens).toBe(1000);
    expect(options.responseFormat).toBe('json');
  });

  it('accepts undefined for optional fields (exactOptionalPropertyTypes)', () => {
    const options: LLMRequestOptions = {
      model: 'test',
      temperature: undefined,
      maxTokens: undefined,
      responseFormat: undefined,
    };
    expect(options.model).toBe('test');
  });
});

describe('LLMResponse', () => {
  it('contains content, model, and usage', () => {
    const response: LLMResponse = {
      content: '{"type": "container"}',
      model: 'gpt-4o',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    };
    expect(response.content).toBe('{"type": "container"}');
    expect(response.model).toBe('gpt-4o');
    expect(response.usage.totalTokens).toBe(150);
  });
});

describe('LLMUsage', () => {
  it('contains token count fields', () => {
    const usage: LLMUsage = {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    };
    expectTypeOf(usage.promptTokens).toBeNumber();
    expectTypeOf(usage.completionTokens).toBeNumber();
    expectTypeOf(usage.totalTokens).toBeNumber();
  });
});

describe('GenerationTrace', () => {
  describe('createTrace', () => {
    it('returns a GenerationTrace with empty steps and an id', () => {
      const trace = createTrace();
      expect(trace.id).toBeTypeOf('string');
      expect(trace.id.length).toBeGreaterThan(0);
      expect(trace.steps).toEqual([]);
    });

    it('with custom init sets provided values', () => {
      const trace = createTrace({ id: 'custom-id', startTime: 1000 });
      expect(trace.id).toBe('custom-id');
      expect(trace.startTime).toBe(1000);
      expect(trace.steps).toEqual([]);
    });

    it('defaults startTime to Unix ms (number, not Date)', () => {
      const before = Date.now();
      const trace = createTrace();
      const after = Date.now();

      expect(trace.startTime).toBeTypeOf('number');
      expect(trace.startTime).toBeGreaterThanOrEqual(before);
      expect(trace.startTime).toBeLessThanOrEqual(after);
    });

    it('accepts partial init (id only)', () => {
      const before = Date.now();
      const trace = createTrace({ id: 'partial-id' });
      const after = Date.now();

      expect(trace.id).toBe('partial-id');
      expect(trace.startTime).toBeGreaterThanOrEqual(before);
      expect(trace.startTime).toBeLessThanOrEqual(after);
    });

    it('accepts partial init (startTime only)', () => {
      const trace = createTrace({ startTime: 42 });
      expect(trace.id).toBeTypeOf('string');
      expect(trace.startTime).toBe(42);
    });
  });

  describe('addStep', () => {
    it('appends a TraceStep to the trace', () => {
      const trace = createTrace();
      const step: TraceStep = {
        module: 'intent-parser',
        operation: 'sanitizeIntent',
        durationMs: 15,
        metadata: { inputLength: 42 },
      };

      trace.addStep(step);

      expect(trace.steps).toHaveLength(1);
      expect(trace.steps[0]).toEqual(step);
    });

    it('multiple calls preserve insertion order', () => {
      const trace = createTrace();
      const step1: TraceStep = {
        module: 'intent-parser',
        operation: 'parse',
        durationMs: 10,
        metadata: {},
      };
      const step2: TraceStep = {
        module: 'context-resolver',
        operation: 'resolve',
        durationMs: 20,
        metadata: { providers: 3 },
      };
      const step3: TraceStep = {
        module: 'generation',
        operation: 'generate',
        durationMs: 500,
        metadata: { model: 'gpt-4o' },
      };

      trace.addStep(step1);
      trace.addStep(step2);
      trace.addStep(step3);

      expect(trace.steps).toHaveLength(3);
      expect(trace.steps[0]).toEqual(step1);
      expect(trace.steps[1]).toEqual(step2);
      expect(trace.steps[2]).toEqual(step3);
    });

    it('strips sensitive metadata fields and values', () => {
      const trace = createTrace();

      trace.addStep({
        module: 'generation',
        operation: 'callLlm',
        durationMs: 120,
        metadata: {
          model: 'gpt-4o',
          apiKey: 'sk-12345678901234567890',
          authorization: 'Bearer abcdefghijklmnopqrst',
          note: 'safe',
          rawResponse: '{"content":"secret"}',
          providerMessage: 'token leaked',
        },
      });

      expect(trace.steps).toHaveLength(1);
      expect(trace.steps[0]?.metadata).toEqual({
        model: 'gpt-4o',
        note: 'safe',
      });
    });
  });

  describe('steps', () => {
    it('returns readonly array of all added steps', () => {
      const trace = createTrace();
      expectTypeOf(trace.steps).toEqualTypeOf<readonly TraceStep[]>();
    });

    it('returns a defensive copy, not internal array reference', () => {
      const trace = createTrace();
      trace.addStep({
        module: 'intent-parser',
        operation: 'parseIntent',
        durationMs: 3,
        metadata: {},
      });

      const firstRead = trace.steps;
      const secondRead = trace.steps;

      expect(firstRead).toEqual(secondRead);
      expect(firstRead).not.toBe(secondRead);
    });
  });
});

describe('TraceStep', () => {
  it('requires all four fields', () => {
    const step: TraceStep = {
      module: 'validation',
      operation: 'validateSchema',
      durationMs: 5,
      metadata: { schemaVersion: '1.0.0' },
    };
    expect(step.module).toBe('validation');
    expect(step.operation).toBe('validateSchema');
    expect(step.durationMs).toBe(5);
    expect(step.metadata).toEqual({ schemaVersion: '1.0.0' });
  });
});

describe('GenerationTraceInit', () => {
  it('is a valid type with optional fields', () => {
    const init1: GenerationTraceInit = {};
    const init2: GenerationTraceInit = { id: 'test' };
    const init3: GenerationTraceInit = { startTime: 1000 };
    const init4: GenerationTraceInit = { id: 'test', startTime: 1000 };

    expect(init1).toBeDefined();
    expect(init2).toBeDefined();
    expect(init3).toBeDefined();
    expect(init4).toBeDefined();
  });
});
