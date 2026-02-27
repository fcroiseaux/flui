import { buildCacheKey, type CacheConfig, createCacheManager } from './cache';
import { type ConcurrencyConfig, createConcurrencyController } from './concurrency';
import { createContextEngine } from './context';
import { createDataResolverRegistry } from './data';
import { err, FLUI_E026, FLUI_E029, FLUI_E033, FluiError, isError, ok } from './errors';
import type { FluiConfig, FluiGenerateInput, FluiInstance } from './flui.types';
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
import type { LLMUsage } from './types';
import { createTrace } from './types';
import { createValidationPipeline, type ValidationError } from './validation';

export const DEFAULT_GENERATION_CONFIG: Omit<GenerationConfig, 'connector'> = {
  model: 'gpt-4o',
  responseFormat: 'json',
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

      const intentResult = parseIntent(toIntent(input.intent));
      if (isError(intentResult)) {
        observer.collect(trace);
        return intentResult;
      }

      const resolvedContextResult = await context.resolveAll(input.signal);
      if (isError(resolvedContextResult)) {
        observer.collect(trace);
        return resolvedContextResult;
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
        return ok(cacheResult.value);
      }

      if (decision.action === 'show-fallback') {
        observer.collect(trace);
        const code = decision.inputs.circuitBreakerState === 'open' ? FLUI_E029 : FLUI_E026;
        const category = decision.inputs.circuitBreakerState === 'open' ? 'concurrency' : 'policy';
        return err(new FluiError(code, category, decision.reason));
      }

      const generationResult = await generation.generate(
        {
          intent: intentResult.value,
          context: mergedContext,
          registry: registry.serialize(),
        },
        trace,
        input.signal,
      );

      if (isError(generationResult)) {
        concurrency.recordFailure();
        observer.collect(trace);
        return generationResult;
      }
      concurrency.recordSuccess();

      const validationResult = await validation.validate(generationResult.value, {
        registry,
        authorizedDataIdentifiers: input.authorizedDataIdentifiers,
      });
      if (isError(validationResult)) {
        config.onValidationError?.(extractValidationErrors(validationResult.error));
        observer.collect(trace);
        return validationResult;
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
      return ok(validationResult.value);
    },
  };
}
