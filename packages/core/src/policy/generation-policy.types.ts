import type { CacheResult } from '../cache';
import type { CircuitBreakerState } from '../concurrency';
import type { BudgetCheckResult } from './policy.types';

/**
 * Possible actions the generation policy engine can decide.
 */
export type PolicyAction = 'generate' | 'serve-from-cache' | 'show-fallback';

/**
 * Inputs evaluated by the policy engine to make a decision.
 * Composed from outputs of CacheManager, CostManager, and ConcurrencyController.
 */
export interface PolicyInput {
  cacheResult: CacheResult;
  budgetCheck: BudgetCheckResult;
  circuitBreakerState: CircuitBreakerState;
}

/**
 * Result of a policy evaluation containing the action, reasoning, and inputs.
 * Deterministic: same inputs always produce the same decision.
 */
export interface PolicyDecision {
  action: PolicyAction;
  reason: string;
  inputs: PolicyInput;
}

/**
 * Interface for the generation policy engine.
 */
export interface GenerationPolicyEngine {
  evaluate(input: PolicyInput): PolicyDecision;
}

/**
 * Configuration for the generation policy engine.
 * Reserved for future per-view/per-intent customization — no fields needed for Story 7.4.
 */
export interface GenerationPolicyConfig {
  /* Reserved for future Phase 2 configuration (triggers, debounce, rate limiting) */
}
