import { FLUI_E032, FluiError } from '../errors';
import type { GenerationTrace, TraceStep } from '../types';
import type { RedactionConfig } from './observe.types';

const REDACTED = '[REDACTED]';

/**
 * Redacts PII fields from a trace based on declarative field path configuration.
 *
 * Path resolution:
 * - Multi-segment paths (e.g., 'context.identity.role'): first segment matches step.module,
 *   subsequent segments traverse step.metadata.
 * - Single-segment paths (e.g., 'secret'): match top-level key in ALL steps' metadata.
 *
 * Returns a new trace — does not mutate the original.
 */
export function redactTrace(trace: GenerationTrace, config: RedactionConfig): GenerationTrace {
  validateRedactionConfig(config);

  if (config.fieldPaths.length === 0) {
    return trace;
  }

  const redactedSteps = trace.steps.map((step) => redactStep(step, config.fieldPaths));

  return {
    get id() {
      return trace.id;
    },
    get startTime() {
      return trace.startTime;
    },
    get steps(): readonly TraceStep[] {
      return redactedSteps.slice();
    },
    addStep(step: TraceStep): void {
      redactedSteps.push({
        module: step.module,
        operation: step.operation,
        durationMs: step.durationMs,
        metadata: deepClone(step.metadata),
      });
    },
  };
}

function validateRedactionConfig(config: RedactionConfig): void {
  for (const rawPath of config.fieldPaths) {
    const path = rawPath.trim();
    if (path.length === 0 || path.startsWith('.') || path.endsWith('.')) {
      throw new FluiError(
        FLUI_E032,
        'observe',
        `Invalid redaction config: malformed field path '${rawPath}'`,
      );
    }

    const segments = path.split('.');
    if (segments.some((segment) => segment.trim().length === 0)) {
      throw new FluiError(
        FLUI_E032,
        'observe',
        `Invalid redaction config: malformed field path '${rawPath}'`,
      );
    }
  }
}

function redactStep(step: TraceStep, fieldPaths: string[]): TraceStep {
  let metadata = deepClone(step.metadata);

  for (const path of fieldPaths) {
    const segments = path.split('.');
    const firstSegment = segments[0];

    if (firstSegment === undefined) {
      continue;
    }

    if (segments.length === 1) {
      // Single-segment: redact top-level key in ALL steps' metadata
      if (firstSegment in metadata) {
        metadata[firstSegment] = REDACTED;
      }
    } else {
      // Multi-segment: first segment must match step.module
      const metadataPath = segments.slice(1);
      if (step.module === firstSegment) {
        metadata = redactAtPath(metadata, metadataPath);
      }
    }
  }

  return {
    module: step.module,
    operation: step.operation,
    durationMs: step.durationMs,
    metadata,
  };
}

function redactAtPath(obj: Record<string, unknown>, path: string[]): Record<string, unknown> {
  if (path.length === 0) {
    return obj;
  }

  const head = path[0]!;
  const rest = path.slice(1);

  if (!(head in obj)) {
    return obj;
  }

  if (rest.length === 0) {
    return { ...obj, [head]: REDACTED };
  }

  const nested = obj[head];
  if (typeof nested !== 'object' || nested === null) {
    return obj;
  }

  return {
    ...obj,
    [head]: redactAtPath(nested as Record<string, unknown>, rest),
  };
}

function deepClone(obj: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(obj));
}
