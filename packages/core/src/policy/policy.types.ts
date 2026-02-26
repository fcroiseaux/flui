import type { GenerationTrace, LLMUsage } from '../types';

/**
 * Pricing configuration for a specific LLM model.
 * Costs are expressed per 1,000 tokens.
 */
export interface ModelPricing {
  promptCostPer1kTokens: number;
  completionCostPer1kTokens: number;
}

/**
 * Budget configuration for the cost manager.
 * At least one budget (session or daily) should be configured for enforcement.
 */
export interface BudgetConfig {
  /** Maximum spend per session in dollars. Undefined means no session limit. */
  sessionBudget?: number | undefined;
  /** Maximum spend per 24-hour period in dollars. Undefined means no daily limit. */
  dailyBudget?: number | undefined;
  /** Model-specific pricing lookup. Keys are model identifiers. */
  modelPricing: Record<string, ModelPricing>;
  /** Fallback pricing when a model is not found in modelPricing. */
  defaultModelPricing?: ModelPricing | undefined;
  /** Behavior when budget is exhausted. Defaults to 'error'. */
  onBudgetExhausted?: 'error' | 'warn' | undefined;
}

/**
 * Pre-call cost estimate based on prompt token count and model pricing.
 * Completion cost is excluded because token count is unknown before the LLM responds.
 */
export interface CostEstimate {
  estimatedPromptTokens: number;
  estimatedCost: number;
  model: string;
  budgetType: 'session' | 'daily';
  remainingBudget: number;
}

/**
 * Record of actual cost after an LLM call completes.
 * Includes both estimated and actual cost for comparison.
 */
export interface CostRecord {
  timestamp: number;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  actualCost: number;
  budgetType: 'session' | 'daily';
}

/**
 * Result of a budget check before making an LLM call.
 * Budget exhaustion is expected control flow, not an error.
 */
export interface BudgetCheckResult {
  allowed: boolean;
  budgetType?: 'session' | 'daily' | undefined;
  remainingBudget?: number | undefined;
  estimatedCost?: number | undefined;
  exhaustedReason?: string | undefined;
}

/**
 * Budget utilization statistics and introspection data.
 */
export interface BudgetStats {
  sessionBudget: number | null;
  dailyBudget: number | null;
  sessionSpent: number;
  dailySpent: number;
  sessionRemaining: number | null;
  dailyRemaining: number | null;
  totalGenerations: number;
  averageCostPerGeneration: number;
  records: readonly CostRecord[];
}

/**
 * Cost management interface for budget tracking and enforcement.
 * All check/estimate methods are synchronous (in-memory arithmetic only).
 */
export interface CostManager {
  /** Estimate cost based on prompt token count and model pricing. */
  estimateCost(promptTokens: number, model: string): CostEstimate;
  /** Check if estimated cost is within budget. Never throws. */
  checkBudget(estimatedCost: number): BudgetCheckResult;
  /** Record actual cost after LLM call completes. */
  recordCost(usage: LLMUsage, model: string, estimatedCost: number): CostRecord;
  /** Get current budget utilization statistics. */
  stats(): BudgetStats;
  /** Reset session budget counters. */
  resetSession(): void;
  /** Reset daily budget counters. */
  resetDaily(): void;
}
