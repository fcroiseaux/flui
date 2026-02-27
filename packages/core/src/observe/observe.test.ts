import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GenerationTrace } from '../types';
import { createTrace } from '../types';
import { createBufferTransport } from './buffer-transport';
import { createObservabilityCollector } from './collector';
import { createConsoleTransport } from './console-transport';
import type { TraceTransport } from './observe.types';
import { redactTrace } from './redaction';

// --- Test Helpers ---

function createMockTransport(name: string): TraceTransport & { calls: GenerationTrace[] } {
  const calls: GenerationTrace[] = [];
  return {
    name,
    async send(trace: GenerationTrace): Promise<void> {
      calls.push(trace);
    },
    calls,
  };
}

function createFailingTransport(name: string): TraceTransport {
  return {
    name,
    async send(): Promise<void> {
      throw new Error('Transport failed');
    },
  };
}

function makeTestTrace(stepCount: number = 3): GenerationTrace {
  const trace = createTrace({ id: 'test-trace-1' });
  for (let i = 0; i < stepCount; i++) {
    trace.addStep({
      module: `module-${i}`,
      operation: `operation${i}`,
      durationMs: (i + 1) * 10,
      metadata: { index: i },
    });
  }
  return trace;
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

// --- Tests ---

describe('ObservabilityCollector', () => {
  describe('collect', () => {
    it('stores trace in buffer', () => {
      const collector = createObservabilityCollector();
      const trace = makeTestTrace();

      collector.collect(trace);

      expect(collector.getBufferedTraces()).toHaveLength(1);
      expect(collector.getBufferedTraces()[0]!.id).toBe('test-trace-1');
    });

    it('fans out to all registered transports', async () => {
      const transport1 = createMockTransport('t1');
      const transport2 = createMockTransport('t2');
      const collector = createObservabilityCollector({
        transports: [transport1, transport2],
      });
      const trace = makeTestTrace();

      collector.collect(trace);
      await flushPromises();

      expect(transport1.calls).toHaveLength(1);
      expect(transport2.calls).toHaveLength(1);
      expect(transport1.calls[0]!.id).toBe('test-trace-1');
      expect(transport2.calls[0]!.id).toBe('test-trace-1');
    });

    it('applies PII redaction before transport', async () => {
      const transport = createMockTransport('t1');
      const collector = createObservabilityCollector({
        transports: [transport],
        redaction: { fieldPaths: ['context.identity.role'] },
      });

      const trace = createTrace({ id: 'redact-test' });
      trace.addStep({
        module: 'context',
        operation: 'resolve',
        durationMs: 5,
        metadata: { identity: { role: 'admin', name: 'Alice' } },
      });

      collector.collect(trace);
      await flushPromises();

      expect(transport.calls).toHaveLength(1);
      const receivedStep = transport.calls[0]!.steps[0]!;
      const meta = receivedStep.metadata as { identity: { role: string; name: string } };
      expect(meta.identity.role).toBe('[REDACTED]');
      expect(meta.identity.name).toBe('Alice');
    });

    it('transport failure does not throw', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failing = createFailingTransport('bad');
      const collector = createObservabilityCollector({
        transports: [failing],
      });

      // Should not throw
      expect(() => collector.collect(makeTestTrace())).not.toThrow();
      await flushPromises();

      errorSpy.mockRestore();
    });

    it('transport failure does not block other transports', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failing = createFailingTransport('bad');
      const good = createMockTransport('good');
      const collector = createObservabilityCollector({
        transports: [failing, good],
      });

      collector.collect(makeTestTrace());
      await flushPromises();

      expect(good.calls).toHaveLength(1);
      errorSpy.mockRestore();
    });

    it('buffer respects maxSize with FIFO eviction', () => {
      const collector = createObservabilityCollector({ bufferSize: 2 });

      const trace1 = createTrace({ id: 'trace-1' });
      trace1.addStep({ module: 'm', operation: 'o', durationMs: 1, metadata: {} });
      const trace2 = createTrace({ id: 'trace-2' });
      trace2.addStep({ module: 'm', operation: 'o', durationMs: 1, metadata: {} });
      const trace3 = createTrace({ id: 'trace-3' });
      trace3.addStep({ module: 'm', operation: 'o', durationMs: 1, metadata: {} });

      collector.collect(trace1);
      collector.collect(trace2);
      collector.collect(trace3);

      const buffered = collector.getBufferedTraces();
      expect(buffered).toHaveLength(2);
      expect(buffered[0]!.id).toBe('trace-2');
      expect(buffered[1]!.id).toBe('trace-3');
    });

    it('getBufferedTraces returns defensive copy', () => {
      const collector = createObservabilityCollector();
      collector.collect(makeTestTrace());

      const copy1 = collector.getBufferedTraces();
      const copy2 = collector.getBufferedTraces();

      expect(copy1).not.toBe(copy2);
      expect(copy1).toStrictEqual(copy2);
    });

    it('clearBuffer empties internal buffer', () => {
      const collector = createObservabilityCollector();
      collector.collect(makeTestTrace());
      expect(collector.getBufferedTraces()).toHaveLength(1);

      collector.clearBuffer();

      expect(collector.getBufferedTraces()).toHaveLength(0);
    });

    it('addTransport registers new transport', async () => {
      const collector = createObservabilityCollector();
      const transport = createMockTransport('late');

      collector.addTransport(transport);
      collector.collect(makeTestTrace());
      await flushPromises();

      expect(transport.calls).toHaveLength(1);
    });

    it('removeTransport unregisters by name', async () => {
      const transport = createMockTransport('removable');
      const collector = createObservabilityCollector({
        transports: [transport],
      });

      collector.removeTransport('removable');
      collector.collect(makeTestTrace());
      await flushPromises();

      expect(transport.calls).toHaveLength(0);
    });

    it('collect with no transports still buffers', () => {
      const collector = createObservabilityCollector();
      collector.collect(makeTestTrace());

      expect(collector.getBufferedTraces()).toHaveLength(1);
    });
  });
});

describe('ConsoleTransport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('outputs human-readable log with ISO 8601 timestamp', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const transport = createConsoleTransport();

    const trace = createTrace({ id: 'console-test', startTime: 1709000000000 });
    trace.addStep({ module: 'intent', operation: 'parse', durationMs: 5, metadata: {} });

    await transport.send(trace);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const output = logSpy.mock.calls[0]![0] as string;
    // ISO 8601 timestamp
    expect(output).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
  });

  it('includes trace ID, step count, total duration', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const transport = createConsoleTransport();

    const trace = createTrace({ id: 'my-trace-id', startTime: 1709000000000 });
    trace.addStep({ module: 'a', operation: 'op1', durationMs: 10, metadata: {} });
    trace.addStep({ module: 'b', operation: 'op2', durationMs: 20, metadata: {} });

    await transport.send(trace);

    const output = logSpy.mock.calls[0]![0] as string;
    expect(output).toContain('my-trace-id');
    expect(output).toContain('2 steps');
    expect(output).toContain('30ms total');
  });

  it('per-step summary shows module.operation and timing', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const transport = createConsoleTransport();

    const trace = createTrace({ id: 'step-detail', startTime: 1709000000000 });
    trace.addStep({
      module: 'intent-parser',
      operation: 'parseIntent',
      durationMs: 2,
      metadata: {},
    });
    trace.addStep({ module: 'context', operation: 'resolve', durationMs: 15, metadata: {} });

    await transport.send(trace);

    const output = logSpy.mock.calls[0]![0] as string;
    expect(output).toContain('intent-parser.parseIntent: 2ms');
    expect(output).toContain('context.resolve: 15ms');
  });

  it('uses console.warn for traces with error metadata', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const transport = createConsoleTransport();

    const trace = createTrace({ id: 'error-trace', startTime: 1709000000000 });
    trace.addStep({
      module: 'validation',
      operation: 'validate',
      durationMs: 20,
      metadata: { error: 'validation failed' },
    });

    await transport.send(trace);

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe('BufferTransport', () => {
  it('stores traces in FIFO order', async () => {
    const transport = createBufferTransport();

    const trace1 = createTrace({ id: 'bt-1' });
    trace1.addStep({ module: 'm', operation: 'o', durationMs: 1, metadata: {} });
    const trace2 = createTrace({ id: 'bt-2' });
    trace2.addStep({ module: 'm', operation: 'o', durationMs: 1, metadata: {} });

    await transport.send(trace1);
    await transport.send(trace2);

    const traces = transport.getTraces();
    expect(traces[0]!.id).toBe('bt-1');
    expect(traces[1]!.id).toBe('bt-2');
  });

  it('evicts oldest when maxSize reached', async () => {
    const transport = createBufferTransport(2);

    const t1 = createTrace({ id: 'evict-1' });
    t1.addStep({ module: 'm', operation: 'o', durationMs: 1, metadata: {} });
    const t2 = createTrace({ id: 'evict-2' });
    t2.addStep({ module: 'm', operation: 'o', durationMs: 1, metadata: {} });
    const t3 = createTrace({ id: 'evict-3' });
    t3.addStep({ module: 'm', operation: 'o', durationMs: 1, metadata: {} });

    await transport.send(t1);
    await transport.send(t2);
    await transport.send(t3);

    const traces = transport.getTraces();
    expect(traces).toHaveLength(2);
    expect(traces[0]!.id).toBe('evict-2');
    expect(traces[1]!.id).toBe('evict-3');
  });

  it('getTraces returns defensive copy', async () => {
    const transport = createBufferTransport();
    const trace = createTrace({ id: 'copy-test' });
    trace.addStep({ module: 'm', operation: 'o', durationMs: 1, metadata: {} });
    await transport.send(trace);

    const copy1 = transport.getTraces();
    const copy2 = transport.getTraces();

    expect(copy1).not.toBe(copy2);
    expect(copy1).toStrictEqual(copy2);
  });

  it('clear empties buffer', async () => {
    const transport = createBufferTransport();
    const trace = createTrace({ id: 'clear-test' });
    trace.addStep({ module: 'm', operation: 'o', durationMs: 1, metadata: {} });
    await transport.send(trace);

    expect(transport.getTraces()).toHaveLength(1);

    transport.clear();

    expect(transport.getTraces()).toHaveLength(0);
  });

  it('default maxSize is 100', async () => {
    const transport = createBufferTransport();

    for (let i = 0; i < 105; i++) {
      const trace = createTrace({ id: `overflow-${i}` });
      trace.addStep({ module: 'm', operation: 'o', durationMs: 1, metadata: {} });
      await transport.send(trace);
    }

    const traces = transport.getTraces();
    expect(traces).toHaveLength(100);
    expect(traces[0]!.id).toBe('overflow-5');
    expect(traces[99]!.id).toBe('overflow-104');
  });

  it('treats negative maxSize as 0 to avoid infinite eviction loop', async () => {
    const transport = createBufferTransport(-1);
    const trace = createTrace({ id: 'negative-size' });
    trace.addStep({ module: 'm', operation: 'o', durationMs: 1, metadata: {} });

    await transport.send(trace);

    expect(transport.getTraces()).toHaveLength(0);
  });
});

describe('Redaction', () => {
  it('redacts field at dot-notation path', () => {
    const trace = createTrace({ id: 'redact-dot' });
    trace.addStep({
      module: 'context',
      operation: 'resolve',
      durationMs: 5,
      metadata: { identity: { role: 'admin', name: 'Alice' } },
    });

    const result = redactTrace(trace, { fieldPaths: ['context.identity.role'] });

    const meta = result.steps[0]!.metadata as { identity: { role: string; name: string } };
    expect(meta.identity.role).toBe('[REDACTED]');
    expect(meta.identity.name).toBe('Alice');
  });

  it('redacts nested fields in trace step metadata', () => {
    const trace = createTrace({ id: 'redact-nested' });
    trace.addStep({
      module: 'context',
      operation: 'resolve',
      durationMs: 5,
      metadata: { identity: { permissions: ['read', 'write'] } },
    });

    const result = redactTrace(trace, { fieldPaths: ['context.identity.permissions'] });

    const meta = result.steps[0]!.metadata as { identity: { permissions: string } };
    expect(meta.identity.permissions).toBe('[REDACTED]');
  });

  it('non-matching paths leave trace unchanged', () => {
    const trace = createTrace({ id: 'no-match' });
    trace.addStep({
      module: 'generation',
      operation: 'generate',
      durationMs: 100,
      metadata: { model: 'gpt-4' },
    });

    const result = redactTrace(trace, { fieldPaths: ['context.identity.role'] });

    const meta = result.steps[0]!.metadata as { model: string };
    expect(meta.model).toBe('gpt-4');
  });

  it('returns new trace (does not mutate original)', () => {
    const trace = createTrace({ id: 'immutable' });
    trace.addStep({
      module: 'context',
      operation: 'resolve',
      durationMs: 5,
      metadata: { identity: { role: 'admin' } },
    });

    const result = redactTrace(trace, { fieldPaths: ['context.identity.role'] });

    expect(result).not.toBe(trace);
    // Original is unchanged
    const originalMeta = trace.steps[0]!.metadata as { identity: { role: string } };
    expect(originalMeta.identity.role).toBe('admin');

    // Result is redacted
    const redactedMeta = result.steps[0]!.metadata as { identity: { role: string } };
    expect(redactedMeta.identity.role).toBe('[REDACTED]');
  });

  it('handles missing intermediate paths gracefully', () => {
    const trace = createTrace({ id: 'missing-path' });
    trace.addStep({
      module: 'context',
      operation: 'resolve',
      durationMs: 5,
      metadata: { safe: 'value' },
    });

    const result = redactTrace(trace, { fieldPaths: ['context.identity.role'] });

    const meta = result.steps[0]!.metadata as { safe: string };
    expect(meta.safe).toBe('value');
  });

  it('throws on malformed redaction path', () => {
    const trace = createTrace({ id: 'invalid-redaction' });
    trace.addStep({
      module: 'context',
      operation: 'resolve',
      durationMs: 1,
      metadata: { identity: { role: 'admin' } },
    });

    expect(() => redactTrace(trace, { fieldPaths: ['context..role'] })).toThrow(
      /Invalid redaction config/,
    );
  });

  it('keeps returned trace addStep and steps in sync', () => {
    const trace = createTrace({ id: 'add-step-sync' });
    trace.addStep({
      module: 'context',
      operation: 'resolve',
      durationMs: 1,
      metadata: { identity: { role: 'admin' } },
    });

    const redacted = redactTrace(trace, { fieldPaths: ['context.identity.role'] });
    redacted.addStep({
      module: 'observe',
      operation: 'postProcess',
      durationMs: 2,
      metadata: { status: 'ok' },
    });

    expect(redacted.steps).toHaveLength(2);
    expect(redacted.steps[1]!.operation).toBe('postProcess');
  });

  it('redacts single-segment paths in all steps', () => {
    const trace = createTrace({ id: 'single-segment' });
    trace.addStep({
      module: 'a',
      operation: 'op1',
      durationMs: 1,
      metadata: { userRole: 'admin', visible: 'ok' },
    });
    trace.addStep({
      module: 'b',
      operation: 'op2',
      durationMs: 1,
      metadata: { userRole: 'editor', other: 'fine' },
    });

    const result = redactTrace(trace, { fieldPaths: ['userRole'] });

    expect(result.steps[0]!.metadata.userRole).toBe('[REDACTED]');
    expect(result.steps[0]!.metadata.visible).toBe('ok');
    expect(result.steps[1]!.metadata.userRole).toBe('[REDACTED]');
    expect(result.steps[1]!.metadata.other).toBe('fine');
  });
});

describe('API Key Security', () => {
  it('API keys in metadata are stripped by existing sanitizeTraceMetadata', () => {
    const trace = createTrace({ id: 'api-key-test' });
    trace.addStep({
      module: 'connector',
      operation: 'call',
      durationMs: 100,
      metadata: { apiKey: 'sk-12345678901234', model: 'gpt-4' },
    });

    // sanitizeTraceMetadata is called in addStep — apiKey should be stripped
    const meta = trace.steps[0]!.metadata;
    expect(meta).not.toHaveProperty('apiKey');
    expect(meta).toHaveProperty('model');
  });

  it('raw LLM responses never appear in trace data', () => {
    const trace = createTrace({ id: 'raw-response-test' });
    trace.addStep({
      module: 'generation',
      operation: 'parse',
      durationMs: 50,
      metadata: { rawResponse: '{"choices":[...]}', parsed: true },
    });

    const meta = trace.steps[0]!.metadata;
    expect(meta).not.toHaveProperty('rawResponse');
  });

  it('bearer tokens never appear in trace metadata', () => {
    const trace = createTrace({ id: 'bearer-test' });
    trace.addStep({
      module: 'connector',
      operation: 'call',
      durationMs: 100,
      metadata: { authorization: 'Bearer abc123xyz', status: 200 },
    });

    const meta = trace.steps[0]!.metadata;
    expect(meta).not.toHaveProperty('authorization');
    expect(meta).toHaveProperty('status');
  });
});

describe('Factory Functions', () => {
  it('createObservabilityCollector returns valid collector', () => {
    const collector = createObservabilityCollector();

    expect(collector.collect).toBeTypeOf('function');
    expect(collector.getBufferedTraces).toBeTypeOf('function');
    expect(collector.clearBuffer).toBeTypeOf('function');
    expect(collector.addTransport).toBeTypeOf('function');
    expect(collector.removeTransport).toBeTypeOf('function');
  });

  it('createObservabilityCollector accepts optional config', () => {
    const transport = createMockTransport('test');
    const collector = createObservabilityCollector({
      transports: [transport],
      redaction: { fieldPaths: ['secret'] },
      bufferSize: 50,
    });

    expect(collector.getBufferedTraces()).toHaveLength(0);
  });

  it('createConsoleTransport returns transport with name console', () => {
    const transport = createConsoleTransport();

    expect(transport.name).toBe('console');
    expect(transport.send).toBeTypeOf('function');
  });

  it('createBufferTransport returns transport with buffer methods', () => {
    const transport = createBufferTransport();

    expect(transport.name).toBe('buffer');
    expect(transport.send).toBeTypeOf('function');
    expect(transport.getTraces).toBeTypeOf('function');
    expect(transport.clear).toBeTypeOf('function');
  });
});

describe('Collector bufferSize=0', () => {
  it('does not buffer traces when bufferSize is 0', () => {
    const collector = createObservabilityCollector({ bufferSize: 0 });
    collector.collect(makeTestTrace());

    expect(collector.getBufferedTraces()).toHaveLength(0);
  });

  it('still sends to transports when bufferSize is 0', async () => {
    const transport = createMockTransport('t1');
    const collector = createObservabilityCollector({
      transports: [transport],
      bufferSize: 0,
    });

    collector.collect(makeTestTrace());
    await flushPromises();

    expect(transport.calls).toHaveLength(1);
  });

  it('normalizes negative bufferSize to 0', () => {
    const collector = createObservabilityCollector({ bufferSize: -5 });
    collector.collect(makeTestTrace());

    expect(collector.getBufferedTraces()).toHaveLength(0);
  });
});

describe('Collector removeTransport edge cases', () => {
  it('removes only the first transport with matching name', async () => {
    const t1 = createMockTransport('dup');
    const t2 = createMockTransport('dup');
    const collector = createObservabilityCollector({
      transports: [t1, t2],
    });

    collector.removeTransport('dup');
    collector.collect(makeTestTrace());
    await flushPromises();

    // Only one 'dup' transport should remain
    expect(t1.calls.length + t2.calls.length).toBe(1);
  });

  it('removeTransport is a no-op for unknown names', () => {
    const collector = createObservabilityCollector();
    expect(() => collector.removeTransport('nonexistent')).not.toThrow();
  });
});
