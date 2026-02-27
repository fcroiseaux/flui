import type { GenerationTrace } from '../types';
import type { TraceTransport } from './observe.types';

/**
 * Creates a console transport that outputs human-readable trace logs.
 * Uses ISO 8601 timestamps and per-step summaries.
 */
export function createConsoleTransport(): TraceTransport {
  return {
    name: 'console',
    async send(trace: GenerationTrace): Promise<void> {
      const timestamp = new Date(trace.startTime).toISOString();
      const steps = trace.steps;
      const totalDuration = steps.reduce((sum, s) => sum + s.durationMs, 0);

      const hasErrors = steps.some((s) => 'error' in s.metadata);

      const header = `[${timestamp}] ${trace.id} | ${steps.length} steps | ${totalDuration}ms total`;
      const stepLines = steps.map(
        (s) => `  ${s.module}.${s.operation}: ${s.durationMs}ms`,
      );
      const output = [header, ...stepLines].join('\n');

      if (hasErrors) {
        console.warn(output);
      } else {
        console.log(output);
      }
    },
  };
}
