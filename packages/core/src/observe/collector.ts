import type { GenerationTrace } from '../types';
import type {
  ObservabilityCollector,
  ObservabilityCollectorConfig,
  TraceTransport,
} from './observe.types';
import { redactTrace } from './redaction';

function normalizeBufferSize(size: number | undefined, fallback: number): number {
  if (size === undefined) {
    return fallback;
  }

  if (!Number.isFinite(size)) {
    return fallback;
  }

  return Math.max(0, Math.floor(size));
}

/**
 * Creates an observability collector that receives completed GenerationTrace instances
 * and fans them out to configured transports with optional PII redaction.
 *
 * The collect() method is synchronous — transports receive traces asynchronously
 * via Promise.allSettled, guaranteeing zero latency impact on the generation pipeline.
 */
export function createObservabilityCollector(
  config?: ObservabilityCollectorConfig | undefined,
): ObservabilityCollector {
  const transports: TraceTransport[] = [...(config?.transports ?? [])];
  const maxBufferSize = normalizeBufferSize(config?.bufferSize, 100);
  const buffer: GenerationTrace[] = [];

  function collect(trace: GenerationTrace): void {
    const processedTrace = config?.redaction ? redactTrace(trace, config.redaction) : trace;

    if (maxBufferSize > 0) {
      buffer.push(processedTrace);
      while (buffer.length > maxBufferSize) {
        buffer.shift();
      }
    }

    if (transports.length > 0) {
      const currentTransports = transports.slice();
      Promise.allSettled(currentTransports.map((t) => t.send(processedTrace)))
        .then((results) => {
          results.forEach((result, i) => {
            if (result.status === 'rejected') {
              console.error(
                `[flui:observe] Transport '${currentTransports[i]!.name}' failed: ${String(result.reason)}`,
              );
            }
          });
        })
        .catch(() => {
          // Promise.allSettled never rejects, but defensive
        });
    }
  }

  function getBufferedTraces(): readonly GenerationTrace[] {
    return buffer.slice();
  }

  function clearBuffer(): void {
    buffer.length = 0;
  }

  function addTransport(transport: TraceTransport): void {
    transports.push(transport);
  }

  function removeTransport(name: string): void {
    const index = transports.findIndex((t) => t.name === name);
    if (index !== -1) {
      transports.splice(index, 1);
    }
  }

  return { collect, getBufferedTraces, clearBuffer, addTransport, removeTransport };
}
