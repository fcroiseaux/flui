import type { Result } from './errors';

const TRACE_SENSITIVE_KEY_PATTERN =
  /(api\s*key|apikey|authorization|auth|token|secret|password|raw\s*response|rawResponse)/i;
const TRACE_SENSITIVE_VALUE_PATTERN =
  /(sk-[a-z0-9]{12,}|bearer\s+[a-z0-9._-]{10,}|api[_-]?key|secret|token)/i;

function sanitizeTraceMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (TRACE_SENSITIVE_KEY_PATTERN.test(key)) {
      continue;
    }

    if (typeof value === 'string' && TRACE_SENSITIVE_VALUE_PATTERN.test(value)) {
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

/**
 * Token usage information returned by an LLM provider.
 * Universal across all providers for cost tracking.
 */
export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Provider-agnostic response from an LLM generation call.
 * Contains only universal fields that every LLM provider returns.
 */
export interface LLMResponse {
  /** The generated text or JSON content. */
  content: string;
  /** Model identifier used for this generation. */
  model: string;
  /** Token usage for cost tracking. */
  usage: LLMUsage;
}

/**
 * Options for an LLM generation request.
 * Contains only universal parameters supported across all providers.
 */
export interface LLMRequestOptions {
  /** Which model to use (e.g., 'gpt-4o', 'claude-sonnet-4-20250514'). */
  model: string;
  /** Creativity control (0-2). */
  temperature?: number | undefined;
  /** Response length limit. */
  maxTokens?: number | undefined;
  /** Structured output hint. */
  responseFormat?: 'json' | 'text' | undefined;
}

/**
 * Provider-agnostic interface for LLM generation.
 * All LLM provider packages implement this single contract.
 * Implementable in < 100 lines per NFR-I1.
 */
export interface LLMConnector {
  /**
   * Generate a response from the LLM.
   * AbortSignal is always the last optional parameter.
   *
   * @param prompt - The prompt text to send to the LLM
   * @param options - Generation options (model, temperature, etc.)
   * @param signal - Optional AbortSignal for cancellation
   * @returns A Result containing the LLM response or a FluiError
   */
  generate(
    prompt: string,
    options: LLMRequestOptions,
    signal?: AbortSignal,
  ): Promise<Result<LLMResponse>>;
}

/**
 * A single step in a generation trace.
 * Records timing and metadata for one operation in the pipeline.
 */
export interface TraceStep {
  /** Kebab-case module name (e.g., 'intent-parser'). */
  module: string;
  /** CamelCase function name (e.g., 'sanitizeIntent'). */
  operation: string;
  /** Duration in milliseconds. */
  durationMs: number;
  /**
   * Structured metadata for the step.
   * **Security contract:** NEVER store sensitive data (API keys, raw LLM responses) in metadata.
   */
  metadata: Record<string, unknown>;
}

/**
 * Cross-cutting trace structure passed through the generation pipeline.
 * Records timing information for each step of the generation process.
 */
export interface GenerationTrace {
  readonly id: string;
  /** Unix milliseconds (Date.now()). */
  readonly startTime: number;
  readonly steps: readonly TraceStep[];
  /** Append a step to the trace. */
  addStep(step: TraceStep): void;
}

/**
 * Initialization options for creating a new GenerationTrace.
 */
export interface GenerationTraceInit {
  /** Trace ID. If omitted, a generated ID is used. */
  id?: string | undefined;
  /** Start time in Unix milliseconds. Defaults to Date.now(). */
  startTime?: number | undefined;
}

/**
 * Creates a new GenerationTrace instance.
 *
 * @param init - Optional initialization options (id, startTime)
 * @returns A mutable GenerationTrace implementation
 */
export function createTrace(init?: GenerationTraceInit): GenerationTrace {
  const steps: TraceStep[] = [];
  const id = init?.id ?? `trace-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const startTime = init?.startTime ?? Date.now();

  return {
    get id() {
      return id;
    },
    get startTime() {
      return startTime;
    },
    get steps(): readonly TraceStep[] {
      return steps.slice();
    },
    addStep(step: TraceStep): void {
      steps.push({
        module: step.module,
        operation: step.operation,
        durationMs: step.durationMs,
        metadata: sanitizeTraceMetadata(step.metadata),
      });
    },
  };
}
