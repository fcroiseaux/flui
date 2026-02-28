import { buildCacheKey, type CacheConfig, createCacheManager } from './cache';
import { type ConcurrencyConfig, createConcurrencyController } from './concurrency';
import { createContextEngine } from './context';
import { createDataResolverRegistry } from './data';
import { err, FLUI_E026, FLUI_E029, FLUI_E033, FluiError, isError, ok } from './errors';
import type { Result } from './errors';
import type {
  FluiConfig,
  FluiGenerateInput,
  FluiInstance,
  PrefetchInput,
  PrefetchManyOptions,
  PrefetchResult,
  PrefetchStatus,
} from './flui.types';
import { createGenerationOrchestrator, type GenerationConfig } from './generation';
import { type Intent, type IntentObject, parseIntent } from './intent';
import {
  createConsoleTransport,
  createMetricsReporter,
  createObservabilityCollector,
  type ObservabilityCollectorConfig,
} from './observe';
import { type BudgetConfig, createCostManager, createGenerationPolicyEngine } from './policy';
import { ComponentRegistry } from './registry';
import { SPEC_VERSION } from './spec';
import type { UISpecification } from './spec';
import type { GenerationTrace, LLMUsage } from './types';
import { createTrace } from './types';
import { createValidationPipeline, type ValidationError } from './validation';

export const DEFAULT_GENERATION_CONFIG: Omit<GenerationConfig, 'connector'> = {
  model: 'gpt-4o',
};

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxEntries: 100,
  ttl: 300_000,
  l3Enabled: false,
};

export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  modelPricing: {},
};

export const DEFAULT_CONCURRENCY_CONFIG: ConcurrencyConfig = {
  scope: 'global',
  circuitBreaker: {
    failureThreshold: 3,
    resetTimeout: 30_000,
  },
};

export const DEFAULT_OBSERVABILITY_CONFIG: ObservabilityCollectorConfig = {
  transports: [],
};

export const DEFAULT_POLICY_CONFIG = Object.freeze({
  generateOnCacheMiss: true,
});

function getNodeEnv(): string | undefined {
  const maybeProcess = globalThis as { process?: { env?: { NODE_ENV?: string } } };
  return maybeProcess.process?.env?.NODE_ENV;
}

function toIntent(input: string | IntentObject): Intent {
  if (typeof input === 'string') {
    return { type: 'text', text: input };
  }

  if (input.source === 'structured' && typeof input.signals.componentType === 'string') {
    return {
      type: 'structured',
      componentType: input.signals.componentType,
      dataShape: input.signals.dataShape,
      interactionPattern: input.signals.interactionPattern,
    };
  }

  return { type: 'text', text: input.originalText };
}

function isConnector(value: unknown): value is FluiConfig['connector'] {
  return (
    typeof value === 'object' &&
    value !== null &&
    'generate' in value &&
    typeof (value as { generate?: unknown }).generate === 'function'
  );
}

function parseUsage(value: unknown): LLMUsage | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const usage = value as Partial<LLMUsage>;
  if (
    typeof usage.promptTokens === 'number' &&
    typeof usage.completionTokens === 'number' &&
    typeof usage.totalTokens === 'number'
  ) {
    return {
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
    };
  }

  return undefined;
}

function extractValidationErrors(error: FluiError): ValidationError[] {
  const errors = error.context?.errors;
  if (!Array.isArray(errors)) {
    return [];
  }

  return errors.filter((item): item is ValidationError => {
    if (typeof item !== 'object' || item === null) {
      return false;
    }
    const candidate = item as Partial<ValidationError>;
    return typeof candidate.validator === 'string' && typeof candidate.message === 'string';
  });
}

function throwConfigError(details: string, context?: Record<string, unknown>): never {
  throw new FluiError(FLUI_E033, 'config', `Invalid configuration: ${details}`, { context });
}

/**
 * Creates a fully wired Flui instance with sensible defaults.
 */
export function createFlui(config: FluiConfig): FluiInstance {
  if (typeof config !== 'object' || config === null) {
    throwConfigError('createFlui requires a configuration object');
  }

  if (!isConnector(config.connector)) {
    throwConfigError('createFlui requires a connector with a generate() function');
  }

  if (config.generation?.model !== undefined && config.generation.model.trim().length === 0) {
    throwConfigError('generation.model cannot be an empty string', {
      model: config.generation.model,
    });
  }

  if (config.budget?.sessionBudget !== undefined && config.budget.sessionBudget < 0) {
    throwConfigError('budget.sessionBudget cannot be negative', {
      sessionBudget: config.budget.sessionBudget,
    });
  }

  if (config.concurrency?.circuitBreaker?.failureThreshold !== undefined) {
    if (config.concurrency.circuitBreaker.failureThreshold < 1) {
      throwConfigError('concurrency.circuitBreaker.failureThreshold must be at least 1', {
        failureThreshold: config.concurrency.circuitBreaker.failureThreshold,
      });
    }
  }

  const mergedGenerationConfig: GenerationConfig = {
    connector: config.connector,
    ...DEFAULT_GENERATION_CONFIG,
    ...config.generation,
  };

  const mergedCacheConfig: CacheConfig = {
    ...DEFAULT_CACHE_CONFIG,
    ...config.cache,
  };

  const mergedBudgetConfig: BudgetConfig = {
    ...DEFAULT_BUDGET_CONFIG,
    ...config.budget,
    modelPricing: config.budget?.modelPricing ?? DEFAULT_BUDGET_CONFIG.modelPricing,
  };

  const mergedConcurrencyConfig: ConcurrencyConfig = {
    ...DEFAULT_CONCURRENCY_CONFIG,
    ...config.concurrency,
    circuitBreaker: {
      ...DEFAULT_CONCURRENCY_CONFIG.circuitBreaker,
      ...config.concurrency?.circuitBreaker,
    },
  };

  const isProduction = getNodeEnv() === 'production';
  const mergedObservabilityConfig: ObservabilityCollectorConfig = {
    ...DEFAULT_OBSERVABILITY_CONFIG,
    ...config.observability,
    transports:
      config.observability?.transports ?? (isProduction ? [] : [createConsoleTransport()]),
  };

  const registry = new ComponentRegistry();
  const context = createContextEngine();
  const observer = createObservabilityCollector(mergedObservabilityConfig);
  const metrics = createMetricsReporter();
  const data = createDataResolverRegistry(config.data);

  const generation = createGenerationOrchestrator(mergedGenerationConfig);
  const validation = createValidationPipeline(config.validation);
  const cache = createCacheManager(mergedCacheConfig);
  const cost = createCostManager(mergedBudgetConfig);
  const policy = createGenerationPolicyEngine(config.policy);
  const concurrency = createConcurrencyController(mergedConcurrencyConfig);

  // In-flight request registry for prefetch deduplication
  const inflightRegistry = new Map<
    string,
    { promise: Promise<Result<UISpecification>>; controller: AbortController }
  >();

  // Track failed prefetches for getPrefetchStatus (expires after 60s)
  const failedPrefetches = new Map<string, number>();
  const FAILED_PREFETCH_EXPIRY_MS = 60_000;
  const MAX_FAILED_ENTRIES = 500;

  /**
   * Shared generation pipeline used by both generate() and prefetch().
   * Performs: intent parse → context resolve → cache key build → policy check → generate → validate → cache write.
   */
  async function runGenerationPipeline(
    input: FluiGenerateInput,
    trace: GenerationTrace,
    signal?: AbortSignal,
  ): Promise<{ result: Result<UISpecification>; cacheKey: string }> {
    const intentResult = parseIntent(toIntent(input.intent));
    if (isError(intentResult)) {
      observer.collect(trace);
      return { result: intentResult, cacheKey: '' };
    }

    const resolvedContextResult = await context.resolveAll(signal);
    if (isError(resolvedContextResult)) {
      observer.collect(trace);
      return { result: resolvedContextResult, cacheKey: '' };
    }

    const mergedContext = {
      ...resolvedContextResult.value,
      request: input.context ?? {},
    };

    const cacheKey = await buildCacheKey(
      intentResult.value.sanitizedText,
      mergedContext,
      String(registry.version),
      SPEC_VERSION,
      mergedCacheConfig.contextKeySignals,
    );

    const cacheResult = await cache.get(cacheKey);
    if (cacheResult.hit) {
      metrics.recordCacheEvent(cacheResult.level ?? 'L1', 'hit');
      config.onCacheHit?.(
        {
          intentHash: intentResult.value.sanitizedText,
          contextHash: JSON.stringify(mergedContext),
          registryVersion: String(registry.version),
          specVersion: SPEC_VERSION,
        },
        cacheResult.level ?? 'unknown',
      );
    } else {
      metrics.recordCacheEvent('L1', 'miss');
    }

    const estimate = cost.estimateCost(
      Math.ceil(intentResult.value.sanitizedText.length / 4),
      mergedGenerationConfig.model,
    );
    const budgetCheck = cost.checkBudget(estimate.estimatedCost);
    const decision = policy.evaluate({
      cacheResult,
      budgetCheck,
      circuitBreakerState: concurrency.getCircuitBreakerStatus().state,
    });

    if (
      decision.action === 'serve-from-cache' &&
      cacheResult.hit &&
      cacheResult.value !== undefined
    ) {
      observer.collect(trace);
      config.onGenerationComplete?.(trace);
      return { result: ok(cacheResult.value), cacheKey };
    }

    if (decision.action === 'show-fallback') {
      observer.collect(trace);
      const code = decision.inputs.circuitBreakerState === 'open' ? FLUI_E029 : FLUI_E026;
      const category = decision.inputs.circuitBreakerState === 'open' ? 'concurrency' : 'policy';
      return { result: err(new FluiError(code, category, decision.reason)), cacheKey };
    }

    const generationResult = await generation.generate(
      {
        intent: intentResult.value,
        context: mergedContext,
        registry: registry.serialize(),
      },
      trace,
      signal,
    );

    if (isError(generationResult)) {
      concurrency.recordFailure();
      observer.collect(trace);
      return { result: generationResult, cacheKey };
    }
    concurrency.recordSuccess();

    const validationResult = await validation.validate(generationResult.value, {
      registry,
      authorizedDataIdentifiers: input.authorizedDataIdentifiers,
    });
    if (isError(validationResult)) {
      config.onValidationError?.(extractValidationErrors(validationResult.error));
      observer.collect(trace);
      return { result: validationResult, cacheKey };
    }

    await cache.set(cacheKey, validationResult.value, mergedCacheConfig.ttl);

    const usage = parseUsage(validationResult.value.metadata.custom?.usage);
    if (usage) {
      const costRecord = cost.recordCost(
        usage,
        mergedGenerationConfig.model,
        estimate.estimatedCost,
      );
      metrics.recordCost(costRecord.actualCost);
    }

    observer.collect(trace);
    config.onGenerationComplete?.(trace);
    return { result: ok(validationResult.value), cacheKey };
  }

  /**
   * Resolve input to a cache key.
   * Returns Result<string> so callers can distinguish parse errors from success.
   */
  async function resolveCacheKey(
    input: PrefetchInput,
    signal?: AbortSignal,
  ): Promise<Result<string>> {
    const intentResult = parseIntent(toIntent(input.intent));
    if (isError(intentResult)) {
      return intentResult;
    }

    const resolvedContextResult = await context.resolveAll(signal);
    if (isError(resolvedContextResult)) {
      return resolvedContextResult;
    }

    const mergedContext = {
      ...resolvedContextResult.value,
      request: input.context ?? {},
    };

    const key = await buildCacheKey(
      intentResult.value.sanitizedText,
      mergedContext,
      String(registry.version),
      SPEC_VERSION,
      mergedCacheConfig.contextKeySignals,
    );
    return ok(key);
  }

  // F1: Declare prefetch as a standalone closure so prefetchMany can reference it
  // without needing `this as FluiInstance`
  async function prefetch(input: PrefetchInput): Promise<Result<UISpecification>> {
    const trace = createTrace();
    const startTime = Date.now();

    // F9: propagate errors from resolveCacheKey instead of silently masking
    const cacheKeyResult = await resolveCacheKey(input, input.signal);
    if (isError(cacheKeyResult)) {
      observer.collect(trace);
      return cacheKeyResult;
    }
    const cacheKey = cacheKeyResult.value;

    // Check cache — if hit, return immediately
    const cacheResult = await cache.get(cacheKey);
    if (cacheResult.hit && cacheResult.value !== undefined) {
      trace.addStep({
        module: 'prefetch',
        operation: 'hit',
        durationMs: Date.now() - startTime,
        metadata: { cacheKey },
      });
      observer.collect(trace);
      return ok(cacheResult.value);
    }

    // Check inflight registry — if entry exists, return existing promise (deduplication)
    const existing = inflightRegistry.get(cacheKey);
    if (existing) {
      trace.addStep({
        module: 'prefetch',
        operation: 'dedup',
        durationMs: Date.now() - startTime,
        metadata: { cacheKey },
      });
      observer.collect(trace);
      return existing.promise;
    }

    // Clear any previous failed status for this key
    failedPrefetches.delete(cacheKey);

    trace.addStep({
      module: 'prefetch',
      operation: 'start',
      durationMs: Date.now() - startTime,
      metadata: { cacheKey },
    });

    // F6: Create AbortController, link to caller's signal with robust cleanup
    const internalController = new AbortController();
    const callerSignal = input.signal;
    let onCallerAbort: (() => void) | undefined;
    if (callerSignal) {
      if (callerSignal.aborted) {
        internalController.abort();
      } else {
        onCallerAbort = () => internalController.abort();
        callerSignal.addEventListener('abort', onCallerAbort, { once: true });
      }
    }

    // Start generation pipeline
    const promise = runGenerationPipeline(input, trace, internalController.signal).then(
      ({ result }) => {
        if (isError(result)) {
          trace.addStep({
            module: 'prefetch',
            operation: 'error',
            durationMs: Date.now() - startTime,
            metadata: { cacheKey },
          });
          // F5: cap failedPrefetches map size to prevent memory leak
          if (failedPrefetches.size >= MAX_FAILED_ENTRIES) {
            const firstKey = failedPrefetches.keys().next().value;
            if (firstKey !== undefined) {
              failedPrefetches.delete(firstKey);
            }
          }
          failedPrefetches.set(cacheKey, Date.now());
        } else {
          trace.addStep({
            module: 'prefetch',
            operation: 'complete',
            durationMs: Date.now() - startTime,
            metadata: { cacheKey },
          });
        }
        return result;
      },
    );

    // Store in inflight registry
    inflightRegistry.set(cacheKey, { promise, controller: internalController });

    // F6: Clean up on settle with try/finally for robustness
    promise.finally(() => {
      inflightRegistry.delete(cacheKey);
      if (onCallerAbort && callerSignal) {
        try {
          callerSignal.removeEventListener('abort', onCallerAbort);
        } catch {
          // Signal may have been GC'd; ignore
        }
      }
    });

    return promise;
  }

  return {
    registry,
    context,
    observer,
    metrics,
    data,
    config: {
      connector: config.connector,
      generationConfig: mergedGenerationConfig,
      validationConfig: config.validation ?? {},
    },
    modules: {
      generation,
      validation,
      cache,
      policy,
      cost,
      concurrency,
    },
    getMetrics() {
      return {
        cost: metrics.getCostMetrics(),
        cache: metrics.getCacheMetrics(),
      };
    },
    async generate(input: FluiGenerateInput) {
      const trace = createTrace();
      config.onGenerationStart?.(trace);

      // Check for an in-flight prefetch before starting a new generation.
      // This ensures generate() benefits from prefetched results that are
      // still resolving (cache not yet populated but request already in progress).
      const cacheKeyResult = await resolveCacheKey(input, input.signal);
      if (!isError(cacheKeyResult)) {
        const existing = inflightRegistry.get(cacheKeyResult.value);
        if (existing) {
          trace.addStep({
            module: 'prefetch',
            operation: 'await-inflight',
            durationMs: 0,
            metadata: { cacheKey: cacheKeyResult.value.slice(0, 12) },
          });
          const inflightResult = await existing.promise;
          observer.collect(trace);
          config.onGenerationComplete?.(trace);
          return inflightResult;
        }
      }

      const { result } = await runGenerationPipeline(input, trace, input.signal);
      return result;
    },
    prefetch,

    awaitInflight(cacheKey: string): Promise<Result<UISpecification>> | undefined {
      const entry = inflightRegistry.get(cacheKey);
      if (!entry) return undefined;
      // F8: Return a forked promise so callers cannot affect the internal chain
      return entry.promise.then((r) => r);
    },

    cancelAllPrefetches(): number {
      const count = inflightRegistry.size;
      for (const entry of inflightRegistry.values()) {
        entry.controller.abort();
      }
      // F2: Do NOT clear the map here — let each promise's .finally() handler
      // clean up its own entry so that awaiters still receive their result.
      // F5: Also clear failedPrefetches to prevent stale entries
      failedPrefetches.clear();
      return count;
    },

    async getPrefetchStatus(input: PrefetchInput): Promise<PrefetchStatus> {
      const cacheKeyResult = await resolveCacheKey(input);
      if (isError(cacheKeyResult)) {
        return 'idle';
      }
      const cacheKey = cacheKeyResult.value;

      if (inflightRegistry.has(cacheKey)) {
        return 'in-flight';
      }

      const cacheResult = await cache.get(cacheKey);
      if (cacheResult.hit) {
        return 'cached';
      }

      const failedAt = failedPrefetches.get(cacheKey);
      if (failedAt !== undefined) {
        if (Date.now() - failedAt < FAILED_PREFETCH_EXPIRY_MS) {
          return 'failed';
        }
        failedPrefetches.delete(cacheKey);
      }

      return 'idle';
    },

    async prefetchMany(options: PrefetchManyOptions): Promise<PrefetchResult[]> {
      const maxConcurrency = options.concurrency ?? 2;
      const inputs = options.inputs;
      if (inputs.length === 0) {
        return [];
      }

      // F7: Pre-allocate results array to preserve input order
      const results = new Array<PrefetchResult>(inputs.length);
      let completedCount = 0;
      let nextIndex = 0;

      async function processSingle(index: number, input: PrefetchInput): Promise<void> {
        const cacheKeyResult = await resolveCacheKey(input);
        const cacheKey = isError(cacheKeyResult) ? '' : cacheKeyResult.value;
        // F1: Call the local prefetch closure directly
        const result = await prefetch(input);
        if (isError(result)) {
          results[index] = { cacheKey, status: 'failed', error: result.error };
        } else {
          results[index] = { cacheKey, status: 'cached' };
        }
      }

      return new Promise<PrefetchResult[]>((resolve) => {
        let activeCount = 0;

        function startNext(): void {
          while (activeCount < maxConcurrency && nextIndex < inputs.length) {
            const idx = nextIndex;
            const input = inputs[nextIndex++]!;
            activeCount++;
            processSingle(idx, input).then(() => {
              completedCount++;
              activeCount--;
              if (completedCount === inputs.length) {
                resolve(results);
              } else {
                startNext();
              }
            });
          }
        }

        startNext();
      });
    },
  };
}
