import {
  type ComponentSpec,
  createGenerationOrchestrator,
  createTrace,
  createValidationPipeline,
  FLUI_E010,
  FluiError,
  type GenerationInput,
  type Intent,
  type IntentObject,
  isError,
  parseIntent,
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

      // Parse intent
      const intentInput = normalizeIntent(options.intent!);
      const parseResult = parseIntent(intentInput);
      if (isError(parseResult)) {
        if (signal.aborted) return;
        updateState({ status: 'error', error: parseResult.error, fallback: true });
        return;
      }
      const intentObject = parseResult.value;

      // Create trace and transition to generating
      const trace = createTrace();
      updateState({ status: 'generating', trace });

      // Check if we have a complete generation config
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

      // Generate
      const orchestrator = createGenerationOrchestrator(resolvedGenerationConfig);
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

      // Validate
      const pipeline = createValidationPipeline(latestConfigRef.current?.validationConfig);
      const validResult = await pipeline.validate(genResult.value, { registry: ctx.registry });

      if (signal.aborted) return;

      if (isError(validResult)) {
        updateState({ status: 'error', error: validResult.error, fallback: true });
        return;
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
