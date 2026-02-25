import { err, FLUI_E009, FLUI_E010, FLUI_E017, FluiError, isError } from '../errors';
import type { GenerationTrace, LLMRequestOptions, LLMUsage } from '../types';
import { isStreamingConnector } from '../types';
import type {
  GenerationConfig,
  GenerationInput,
  StreamingGenerationOptions,
  StreamingGenerationOrchestrator,
} from './generation.types';
import { createGenerationOrchestrator } from './generation-orchestrator';
import { createPromptBuilder } from './prompt-builder';
import { createStreamingSpecParser } from './streaming-spec-parser';

/**
 * Creates a StreamingGenerationOrchestrator that supports both streaming and non-streaming generation.
 *
 * The streaming orchestrator consumes AsyncIterable<GenerationChunk> from a StreamingLLMConnector,
 * progressively parses the response, and invokes onProgress callbacks as new structure is detected.
 */
export function createStreamingOrchestrator(
  config: GenerationConfig,
): StreamingGenerationOrchestrator {
  const promptBuilder = createPromptBuilder();
  const nonStreamingOrchestrator = createGenerationOrchestrator(config);

  return {
    // Delegate non-streaming generate to existing orchestrator
    generate(input: GenerationInput, trace: GenerationTrace, signal?: AbortSignal) {
      return nonStreamingOrchestrator.generate(input, trace, signal);
    },

    async generateStream(
      input: GenerationInput,
      trace: GenerationTrace,
      options?: StreamingGenerationOptions,
      signal?: AbortSignal,
    ) {
      // Check 1: Before any work
      if (signal?.aborted) {
        return err(new FluiError(FLUI_E010, 'generation', 'Streaming generation cancelled'));
      }

      // Check 2: Verify connector supports streaming
      if (!isStreamingConnector(config.connector)) {
        return err(
          new FluiError(
            FLUI_E009,
            'generation',
            'Unsupported operation: connector does not support streaming',
          ),
        );
      }

      const connector = config.connector;

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

      // Step 2: Start stream
      const requestOptions: LLMRequestOptions = {
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        responseFormat: 'json',
      };

      const streamResult = await connector.streamGenerate(prompt, requestOptions, signal);
      if (isError(streamResult)) {
        return streamResult;
      }

      // Step 3: Consume stream
      const parser = createStreamingSpecParser();
      let model: string | undefined;
      let usage: LLMUsage | undefined;
      let chunkCount = 0;
      let totalContentLength = 0;
      let progressCallbackCount = 0;

      const consumeStart = Date.now();
      try {
        for await (const chunk of streamResult.value) {
          // Check abort between chunks
          if (signal?.aborted) {
            return err(new FluiError(FLUI_E010, 'generation', 'Streaming generation cancelled'));
          }

          chunkCount++;
          totalContentLength += chunk.delta.length;
          const partial = parser.processChunk(chunk.delta);

          if (partial && options?.onProgress) {
            options.onProgress(partial);
            progressCallbackCount++;
          }

          if (chunk.model) model = chunk.model;
          if (chunk.done && chunk.usage) usage = chunk.usage;
        }
      } catch (cause) {
        const consumeDuration = Date.now() - consumeStart;
        trace.addStep({
          module: 'generation',
          operation: 'streamConsume',
          durationMs: consumeDuration,
          metadata: {
            chunkCount,
            totalContentLength,
            progressCallbackCount,
            completed: false,
            failurePoint: 'stream-iteration',
          },
        });

        return err(
          new FluiError(FLUI_E017, 'generation', 'Stream terminated unexpectedly', {
            cause: cause instanceof Error ? cause : undefined,
            context: { chunkCount },
          }),
        );
      }
      const consumeDuration = Date.now() - consumeStart;

      trace.addStep({
        module: 'generation',
        operation: 'streamConsume',
        durationMs: consumeDuration,
        metadata: { chunkCount, totalContentLength, progressCallbackCount },
      });

      // Check 3: After stream completes
      if (signal?.aborted) {
        return err(new FluiError(FLUI_E010, 'generation', 'Streaming generation cancelled'));
      }

      // Step 4: Finalize and validate
      const parseStart = Date.now();
      const parseResult = parser.finalize();
      const parseDuration = Date.now() - parseStart;
      const parseErrorCode = isError(parseResult) ? parseResult.error.code : undefined;
      trace.addStep({
        module: 'generation',
        operation: 'parseResponse',
        durationMs: parseDuration,
        metadata: {
          parseSuccess: !isError(parseResult),
          failurePoint: isError(parseResult) ? 'parse-finalize' : undefined,
          parseErrorCode,
        },
      });

      if (isError(parseResult)) {
        return parseResult;
      }

      // Enrich UISpecification metadata
      const spec = parseResult.value;
      if (model) spec.metadata.model = model;
      spec.metadata.traceId = trace.id;
      spec.metadata.generatedAt = Date.now();
      spec.metadata.custom = {
        ...(spec.metadata.custom ?? {}),
        usage,
      };

      return parseResult;
    },
  };
}
