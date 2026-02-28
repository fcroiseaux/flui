import {
  buildCacheKey,
  type ComponentSpec,
  createGenerationOrchestrator,
  createPromptBuilder,
  createTrace,
  createValidationPipeline,
  FLUI_E010,
  FluiError,
  type GenerationInput,
  type Intent,
  type IntentObject,
  isError,
  parseIntent,
  SPEC_VERSION,
} from '@flui/core';
import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  FluiContextValue,
  LiquidViewState,
  UseLiquidViewOptions,
  UseLiquidViewResult,
} from '../react.types';
import { useViewState } from '../renderer/view-state';

/**
 * Normalizes a string or IntentObject prop into a core Intent for parseIntent().
 */
function normalizeIntent(intent: string | IntentObject): Intent {
  if (typeof intent === 'string') {
    return { type: 'text', text: intent };
  }

  if (intent.source === 'structured' && intent.signals.componentType) {
    return {
      type: 'structured',
      componentType: intent.signals.componentType,
      dataShape: intent.signals.dataShape,
      interactionPattern: intent.signals.interactionPattern,
    };
  }

  return { type: 'text', text: intent.originalText };
}

/**
 * Recursively collects all component IDs from a component tree.
 */
function collectComponentIds(components: ComponentSpec[]): Set<string> {
  const ids = new Set<string>();
  function walk(specs: ComponentSpec[]) {
    for (const spec of specs) {
      ids.add(spec.id);
      if (spec.children) walk(spec.children);
    }
  }
  walk(components);
  return ids;
}

/**
 * Hook that manages the LiquidView generation lifecycle.
 * Watches intent changes and drives: idle → generating → validating → rendering | error.
 */
export function useLiquidView(
  options: UseLiquidViewOptions,
  ctx: FluiContextValue,
): UseLiquidViewResult {
  const [state, setState] = useState<LiquidViewState>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);
  const viewStateStore = useViewState();

  // Stable reference to callbacks to avoid re-triggering effects
  const onStateChangeRef = useRef(options.onStateChange);
  onStateChangeRef.current = options.onStateChange;
  const onErrorRef = useRef(options.onError);
  onErrorRef.current = options.onError;
  const latestContextRef = useRef(options.context);
  latestContextRef.current = options.context;
  const latestDataRef = useRef(options.data);
  latestDataRef.current = options.data;
  const latestConfigRef = useRef(ctx.config);
  latestConfigRef.current = ctx.config;
  const latestInstanceRef = useRef(ctx.instance);
  latestInstanceRef.current = ctx.instance;

  const updateState = useCallback((newState: LiquidViewState) => {
    setState(newState);
    onStateChangeRef.current?.(newState);
    if (newState.status === 'error') {
      onErrorRef.current?.(newState.error);
    }
  }, []);

  // Cleanup: abort on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Generation trigger when intent changes
  useEffect(() => {
    if (!options.intent) {
      updateState({ status: 'idle' });
      return;
    }

    // Abort previous generation
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const runGeneration = async () => {
      const signal = controller.signal;

      if (signal.aborted) return;

      // Create trace and transition to generating
      const trace = createTrace();
      updateState({ status: 'generating', trace });

      // Parse intent
      const intentInput = normalizeIntent(options.intent!);
      const parseResult = parseIntent(intentInput);
      if (isError(parseResult)) {
        if (signal.aborted) return;
        updateState({ status: 'error', error: parseResult.error, fallback: true });
        return;
      }
      const intentObject = parseResult.value;

      // ── Cache check: serve from instance cache if available ──
      const instance = latestInstanceRef.current;
      if (instance) {
        const requestContext = {
          ...(latestContextRef.current ?? {}),
          ...(latestDataRef.current ?? {}),
        };
        const cacheKey = await buildCacheKey(
          intentObject.sanitizedText,
          { request: requestContext },
          String(ctx.registry.version),
          SPEC_VERSION,
        );
        const cacheResult = await instance.modules.cache.get(cacheKey);
        if (cacheResult.hit && cacheResult.value) {
          if (signal.aborted) return;

          trace.addStep({
            module: 'cache',
            operation: 'hit',
            durationMs: 0,
            metadata: { level: cacheResult.level, key: cacheKey.slice(0, 12) },
          });

          const newComponentIds = collectComponentIds(cacheResult.value.components);
          viewStateStore.reconcile(newComponentIds);
          updateState({ status: 'rendering', spec: cacheResult.value, trace });
          return;
        }
      }

      // ── Generation path: orchestrator + validateWithRetry ──
      const generationConfig = latestConfigRef.current?.generationConfig;
      const connector = latestConfigRef.current?.connector ?? generationConfig?.connector;
      const model = generationConfig?.model;

      if (!connector || !model) {
        if (signal.aborted) return;
        updateState({
          status: 'error',
          error: new FluiError(
            FLUI_E010,
            'generation',
            'Missing generation connector or model in FluiProvider config',
          ),
          fallback: true,
        });
        return;
      }

      const resolvedGenerationConfig = {
        ...generationConfig,
        connector,
        model,
      };

      const orchestrator = createGenerationOrchestrator(resolvedGenerationConfig);
      const promptBuilder = createPromptBuilder();
      const generationInput: GenerationInput = {
        intent: intentObject,
        context: {
          request: {
            ...(latestContextRef.current ?? {}),
            ...(latestDataRef.current ?? {}),
          },
        },
        registry: ctx.registry.serialize(),
      };

      const genResult = await orchestrator.generate(generationInput, trace, signal);

      if (signal.aborted) return;

      if (isError(genResult)) {
        updateState({ status: 'error', error: genResult.error, fallback: true });
        return;
      }

      // Transition to validating
      updateState({ status: 'validating', rawSpec: genResult.value });

      // Validate with retry: on failure, re-generate with error feedback prompt
      const pipeline = createValidationPipeline({
        ...latestConfigRef.current?.validationConfig,
        retry: latestConfigRef.current?.validationConfig?.retry ?? { enabled: true, maxRetries: 2 },
      });

      const regenerate = async (retryPrompt: string, retrySignal?: AbortSignal) => {
        const retryOrchestrator = createGenerationOrchestrator(resolvedGenerationConfig);
        const retryInput: GenerationInput = {
          intent: {
            ...intentObject,
            sanitizedText: retryPrompt,
          },
          context: generationInput.context,
          registry: generationInput.registry,
        };
        const retryTrace = createTrace();
        const retryResult = await retryOrchestrator.generate(retryInput, retryTrace, retrySignal);
        if (!isError(retryResult)) {
          trace.addStep({
            module: 'validation',
            operation: 'retryGeneration',
            durationMs: 0,
            metadata: { model: resolvedGenerationConfig.model },
          });
        }
        return retryResult;
      };

      const validResult = await pipeline.validateWithRetry(
        genResult.value,
        { registry: ctx.registry },
        regenerate,
        trace,
        signal,
        promptBuilder.build(generationInput),
      );

      if (signal.aborted) return;

      if (isError(validResult)) {
        updateState({ status: 'error', error: validResult.error, fallback: true });
        return;
      }

      // Store validated spec in instance cache for future hits
      if (instance) {
        const requestContext = {
          ...(latestContextRef.current ?? {}),
          ...(latestDataRef.current ?? {}),
        };
        const cacheKey = await buildCacheKey(
          intentObject.sanitizedText,
          { request: requestContext },
          String(ctx.registry.version),
          SPEC_VERSION,
        );
        await instance.modules.cache.set(cacheKey, validResult.value);
      }

      // Reconcile view state: prune orphaned component state, preserve matching IDs
      const newComponentIds = collectComponentIds(validResult.value.components);
      viewStateStore.reconcile(newComponentIds);

      // Transition to rendering
      updateState({ status: 'rendering', spec: validResult.value, trace });
    };

    runGeneration().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      const fluiError =
        error instanceof FluiError
          ? error
          : new FluiError(
              FLUI_E010,
              'generation',
              error instanceof Error ? error.message : 'Unknown generation error',
            );
      updateState({ status: 'error', error: fluiError, fallback: true });
    });
  }, [options.intent, ctx.registry, updateState, viewStateStore]);

  return { state, viewStateStore };
}
