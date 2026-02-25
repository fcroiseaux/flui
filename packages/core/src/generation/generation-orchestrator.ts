import { err, FLUI_E010, FluiError, isError } from '../errors';
import type { GenerationTrace, LLMRequestOptions } from '../types';
import type { GenerationConfig, GenerationInput, GenerationOrchestrator } from './generation.types';
import { createPromptBuilder } from './prompt-builder';
import { createSpecParser } from './spec-parser';

/**
 * Creates a GenerationOrchestrator that orchestrates prompt → LLM → parse → UISpecification.
 */
export function createGenerationOrchestrator(config: GenerationConfig): GenerationOrchestrator {
  const promptBuilder = createPromptBuilder();
  const specParser = createSpecParser();

  return {
    async generate(input: GenerationInput, trace: GenerationTrace, signal?: AbortSignal) {
      // Check 1: Before any work
      if (signal?.aborted) {
        return err(new FluiError(FLUI_E010, 'generation', 'Generation cancelled'));
      }

      // Step 1: Build prompt
      const promptStart = Date.now();
      const prompt = promptBuilder.build(input);
      const promptDuration = Date.now() - promptStart;
      trace.addStep({
        module: 'generation',
        operation: 'constructPrompt',
        durationMs: promptDuration,
        metadata: {
          intentLength: input.intent.sanitizedText.length,
          componentCount: input.registry.components.length,
        },
      });

      // Step 2: Call connector
      const requestOptions: LLMRequestOptions = {
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        responseFormat: 'json',
      };

      const connectorStart = Date.now();
      const llmResult = await config.connector.generate(prompt, requestOptions, signal);
      const connectorDuration = Date.now() - connectorStart;
      trace.addStep({
        module: 'generation',
        operation: 'callConnector',
        durationMs: connectorDuration,
        metadata: { model: config.model },
      });

      // Check 2: After async call
      if (signal?.aborted) {
        return err(new FluiError(FLUI_E010, 'generation', 'Generation cancelled'));
      }

      // If connector returns error, propagate as-is
      if (isError(llmResult)) {
        return llmResult;
      }

      // Step 3: Parse response
      const parseStart = Date.now();
      const parseResult = specParser.parse(llmResult.value);
      const parseDuration = Date.now() - parseStart;
      trace.addStep({
        module: 'generation',
        operation: 'parseResponse',
        durationMs: parseDuration,
        metadata: { parseSuccess: !isError(parseResult) },
      });

      // If parse fails, return error as-is
      if (isError(parseResult)) {
        return parseResult;
      }

      // Enrich UISpecification metadata
      const spec = parseResult.value;
      spec.metadata.model = llmResult.value.model;
      spec.metadata.traceId = trace.id;
      spec.metadata.generatedAt = Date.now();
      spec.metadata.custom = {
        ...(spec.metadata.custom ?? {}),
        usage: llmResult.value.usage,
      };

      return parseResult;
    },
  };
}
