import type { AggregatedContext } from '../context';
import type { Result } from '../errors';
import type { IntentObject } from '../intent';
import type { SerializedRegistry } from '../registry';
import type { UISpecification } from '../spec';
import type { GenerationTrace, LLMConnector, LLMResponse } from '../types';

/**
 * Configuration for the generation orchestrator.
 */
export interface GenerationConfig {
  /** The LLM connector to use for generation. */
  connector: LLMConnector;
  /** Model identifier (e.g., 'gpt-4o', 'claude-sonnet-4-20250514'). */
  model: string;
  /** Creativity control (0-2). */
  temperature?: number | undefined;
  /** Response length limit. */
  maxTokens?: number | undefined;
  /** Structured output hint. */
  responseFormat?: 'json' | 'text' | undefined;
}

/**
 * Input for a generation operation.
 */
export interface GenerationInput {
  /** Parsed and normalized intent. */
  intent: IntentObject;
  /** Aggregated context from all providers. */
  context: AggregatedContext;
  /** Serialized component registry for prompt construction. */
  registry: SerializedRegistry;
}

/**
 * Final successful generation output.
 */
export type GenerationResult = UISpecification;

/**
 * Builds a prompt string from generation input.
 */
export interface PromptBuilder {
  build(input: GenerationInput): string;
}

/**
 * Parses and validates an LLM response into a UISpecification.
 */
export interface SpecParser {
  parse(response: LLMResponse): Result<GenerationResult>;
}

/**
 * Orchestrates the full generation flow: prompt → LLM → parse → UISpecification.
 */
export interface GenerationOrchestrator {
  generate(
    input: GenerationInput,
    trace: GenerationTrace,
    signal?: AbortSignal,
  ): Promise<Result<GenerationResult>>;
}

/**
 * Options for streaming generation, including progress callbacks.
 */
export interface StreamingGenerationOptions {
  /** Called when new structure is parsed from the stream. */
  onProgress?: ((partialSpec: Partial<UISpecification>) => void) | undefined;
}

/**
 * Incrementally parses streaming LLM output into a UISpecification.
 */
export interface StreamingSpecParser {
  /** Feed a text delta and return partial spec if new structure detected. */
  processChunk(delta: string): Partial<UISpecification> | undefined;
  /** Finalize and validate the complete accumulated spec. */
  finalize(): Result<UISpecification>;
}

/**
 * Extended orchestrator with streaming generation support.
 */
export interface StreamingGenerationOrchestrator extends GenerationOrchestrator {
  generateStream(
    input: GenerationInput,
    trace: GenerationTrace,
    options?: StreamingGenerationOptions,
    signal?: AbortSignal,
  ): Promise<Result<GenerationResult>>;
}
