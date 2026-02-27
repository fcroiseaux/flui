import type { GenerationTrace } from '../types';
import type { MetricsReporter } from './metrics.types';
import type { TraceTransport } from './observe.types';

/**
 * Creates a TraceTransport that extracts cost and cache data
 * from GenerationTrace steps and feeds them to a MetricsReporter.
 */
export function createMetricsTransport(reporter: MetricsReporter): TraceTransport {
  return {
    name: 'metrics',
    async send(trace: GenerationTrace): Promise<void> {
      for (const step of trace.steps) {
        if (step.module === 'cost-manager' && step.operation === 'recordCost') {
          const actualCost = step.metadata.actualCost;
          if (typeof actualCost === 'number') {
            reporter.recordCost(actualCost);
          }
        }

        if (step.module === 'cache' && step.operation === 'lookup') {
          const result = step.metadata.result;
          const level = step.metadata.level;
          if (result === 'hit' && (level === 'L1' || level === 'L2' || level === 'L3')) {
            reporter.recordCacheEvent(level, 'hit');
          } else if (result === 'miss') {
            reporter.recordCacheEvent('L1', 'miss');
          }
        }
      }
    },
  };
}
