import type { GenerationTrace } from '../types';
import type { TraceTransport } from './observe.types';

function normalizeMaxSize(size: number | undefined): number {
  if (size === undefined) {
    return 100;
  }

  if (!Number.isFinite(size)) {
    return 100;
  }

  return Math.max(0, Math.floor(size));
}

/**
 * Creates an in-memory buffer transport that stores traces for programmatic access.
 * Buffer uses FIFO eviction when maxSize is reached.
 */
export function createBufferTransport(
  maxSize?: number | undefined,
): TraceTransport & { getTraces(): readonly GenerationTrace[]; clear(): void } {
  const effectiveMaxSize = normalizeMaxSize(maxSize);
  const buffer: GenerationTrace[] = [];

  return {
    name: 'buffer',
    async send(trace: GenerationTrace): Promise<void> {
      buffer.push(trace);
      while (buffer.length > effectiveMaxSize) {
        buffer.shift();
      }
    },
    getTraces(): readonly GenerationTrace[] {
      return buffer.slice();
    },
    clear(): void {
      buffer.length = 0;
    },
  };
}
