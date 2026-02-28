import type { CacheConfig, CacheKey, CacheManager } from './cache';
import type { ConcurrencyConfig, ConcurrencyController } from './concurrency';
import type { ContextEngine } from './context';
import type { DataResolverConfig, DataResolverRegistry } from './data';
import type { Result } from './errors';
import type { GenerationConfig, GenerationOrchestrator } from './generation';
import type {
  CacheMetrics,
  CostMetrics,
  MetricsReporter,
  ObservabilityCollector,
  ObservabilityCollectorConfig,
} from './observe';
import type {
  BudgetConfig,
  CostManager,
  GenerationPolicyConfig,
  GenerationPolicyEngine,
} from './policy';
import type { ComponentRegistry } from './registry';
import type { FluiError } from './errors';
import type { UISpecification } from './spec';
import type { GenerationTrace, LLMConnector } from './types';
import type { ValidationError, ValidationPipeline, ValidationPipelineConfig } from './validation';

/**
 * Runtime config shape consumed by FluiProvider.
 * This mirrors @flui/react's FluiReactConfig without importing from @flui/react.
 */
export interface FluiInstanceConfig {
  connector: LLMConnector;
  generationConfig: GenerationConfig;
  validationConfig: ValidationPipelineConfig;
}

/**
 * Input configuration for createFlui().
 */
export interface FluiConfig {
  connector: LLMConnector;
  generation?: Partial<Omit<GenerationConfig, 'connector'>> | undefined;
  validation?: ValidationPipelineConfig | undefined;
  cache?: CacheConfig | undefined;
  budget?: Partial<BudgetConfig> | undefined;
  concurrency?: ConcurrencyConfig | undefined;
  observability?: ObservabilityCollectorConfig | undefined;
  policy?: GenerationPolicyConfig | undefined;
  data?: DataResolverConfig | undefined;
  onGenerationStart?: ((trace: GenerationTrace) => void) | undefined;
  onGenerationComplete?: ((trace: GenerationTrace) => void) | undefined;
  onValidationError?: ((errors: ValidationError[]) => void) | undefined;
  onCacheHit?: ((key: CacheKey, level: string) => void) | undefined;
}

/**
 * Input to FluiInstance.generate().
 */
export interface FluiGenerateInput {
  intent: string | import('./intent').IntentObject;
  context?: Record<string, unknown> | undefined;
  authorizedDataIdentifiers?: string[] | undefined;
  signal?: AbortSignal | undefined;
}

/**
 * Accessors for the fully wired core subsystems.
 */
export interface FluiModules {
  generation: GenerationOrchestrator;
  validation: ValidationPipeline;
  cache: CacheManager;
  policy: GenerationPolicyEngine;
  cost: CostManager;
  concurrency: ConcurrencyController;
}

/**
 * Input to FluiInstance.prefetch().
 * Same shape as FluiGenerateInput for API consistency.
 */
export type PrefetchInput = FluiGenerateInput;

/**
 * Status of a prefetch operation.
 */
export type PrefetchStatus = 'idle' | 'in-flight' | 'cached' | 'failed';

/**
 * Options for FluiInstance.prefetchMany().
 */
export interface PrefetchManyOptions {
  inputs: PrefetchInput[];
  concurrency?: number | undefined;
}

/**
 * Result of a single prefetch operation within prefetchMany().
 */
export interface PrefetchResult {
  cacheKey: string;
  status: 'cached' | 'failed';
  error?: FluiError | undefined;
}

/**
 * Fully wired factory result.
 */
export interface FluiInstance {
  readonly registry: ComponentRegistry;
  readonly context: ContextEngine;
  readonly observer: ObservabilityCollector;
  readonly metrics: MetricsReporter;
  readonly data: DataResolverRegistry;
  readonly config: FluiInstanceConfig;
  readonly modules: FluiModules;
  readonly getMetrics: () => { cost: CostMetrics; cache: CacheMetrics };
  generate(input: FluiGenerateInput): Promise<Result<UISpecification>>;
  prefetch(input: PrefetchInput): Promise<Result<UISpecification>>;
  prefetchMany(options: PrefetchManyOptions): Promise<PrefetchResult[]>;
  getPrefetchStatus(input: PrefetchInput): Promise<PrefetchStatus>;
  cancelAllPrefetches(): number;
  awaitInflight(cacheKey: string): Promise<Result<UISpecification>> | undefined;
}
