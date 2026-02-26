import { FLUI_E027, FluiError } from '../errors';
import type { GenerationTrace, LLMUsage } from '../types';

import { DAILY_RESET_INTERVAL_MS, TOKENS_PER_1K } from './cost-manager.constants';
import type {
  BudgetCheckResult,
  BudgetConfig,
  BudgetStats,
  CostEstimate,
  CostManager,
  CostRecord,
} from './policy.types';

/**
 * Creates a CostManager for budget tracking and enforcement.
 *
 * @param config - Budget configuration with model pricing
 * @param trace - Optional GenerationTrace for recording cost operations
 * @returns A CostManager implementation
 * @throws FluiError with FLUI_E027 if budget config is invalid (negative values)
 */
export function createCostManager(config: BudgetConfig, trace?: GenerationTrace): CostManager {
  if (config.sessionBudget !== undefined && config.sessionBudget < 0) {
    throw new FluiError(FLUI_E027, 'policy', 'Session budget cannot be negative', {
      context: { sessionBudget: config.sessionBudget },
    });
  }
  if (config.dailyBudget !== undefined && config.dailyBudget < 0) {
    throw new FluiError(FLUI_E027, 'policy', 'Daily budget cannot be negative', {
      context: { dailyBudget: config.dailyBudget },
    });
  }

  if (Object.keys(config.modelPricing).length === 0 && config.defaultModelPricing === undefined) {
    // eslint-disable-next-line no-console
    console.warn(
      '[flui:cost-manager] No model pricing configured and no default pricing set. All cost estimates will be zero.',
    );
  }

  let sessionSpent = 0;
  let dailySpent = 0;
  let dailyPeriodStart = Date.now();
  const records: CostRecord[] = [];

  function maybeResetDailyPeriod(): void {
    if (config.dailyBudget === undefined) return;
    const now = Date.now();
    if (now - dailyPeriodStart >= DAILY_RESET_INTERVAL_MS) {
      dailySpent = 0;
      dailyPeriodStart = now;
    }
  }

  function estimateCost(promptTokens: number, model: string): CostEstimate {
    const pricing = config.modelPricing[model] ?? config.defaultModelPricing;
    const estimatedCost = pricing
      ? (promptTokens / TOKENS_PER_1K) * pricing.promptCostPer1kTokens
      : 0;

    const sessionRemaining =
      config.sessionBudget !== undefined ? config.sessionBudget - sessionSpent : Infinity;
    const dailyRemaining =
      config.dailyBudget !== undefined ? config.dailyBudget - dailySpent : Infinity;

    const budgetType: 'session' | 'daily' =
      sessionRemaining <= dailyRemaining ? 'session' : 'daily';
    const remainingBudget = Math.min(sessionRemaining, dailyRemaining);

    const estimate: CostEstimate = {
      estimatedPromptTokens: promptTokens,
      estimatedCost,
      model,
      budgetType,
      remainingBudget,
    };

    trace?.addStep({
      module: 'cost-manager',
      operation: 'estimateCost',
      durationMs: 0,
      metadata: {
        model,
        promptCount: promptTokens,
        estimatedCost,
        remainingBudget,
        budgetType,
      },
    });

    return estimate;
  }

  function checkBudget(estimatedCost: number): BudgetCheckResult {
    maybeResetDailyPeriod();

    if (!Number.isFinite(estimatedCost) || estimatedCost < 0) {
      const result: BudgetCheckResult = {
        allowed: false,
        estimatedCost,
        exhaustedReason: 'Invalid estimated cost: expected a finite number >= 0',
      };

      trace?.addStep({
        module: 'cost-manager',
        operation: 'checkBudget',
        durationMs: 0,
        metadata: {
          allowed: false,
          estimatedCost,
          reason: 'invalid-estimate',
        },
      });

      return result;
    }

    const sessionExceeded =
      config.sessionBudget !== undefined && sessionSpent + estimatedCost > config.sessionBudget;
    const dailyExceeded =
      config.dailyBudget !== undefined && dailySpent + estimatedCost > config.dailyBudget;

    if (sessionExceeded || dailyExceeded) {
      const sessionRemaining =
        config.sessionBudget !== undefined ? config.sessionBudget - sessionSpent : Infinity;
      const dailyRemaining =
        config.dailyBudget !== undefined ? config.dailyBudget - dailySpent : Infinity;

      const budgetType: 'session' | 'daily' =
        sessionExceeded && dailyExceeded
          ? sessionRemaining <= dailyRemaining
            ? 'session'
            : 'daily'
          : sessionExceeded
            ? 'session'
            : 'daily';

      const remainingBudget = budgetType === 'session' ? sessionRemaining : dailyRemaining;

      const exhaustedReason =
        budgetType === 'session'
          ? `Session budget exhausted: $${sessionSpent.toFixed(4)} spent of $${(config.sessionBudget ?? 0).toFixed(4)} budget`
          : `Daily budget exhausted: $${dailySpent.toFixed(4)} spent of $${(config.dailyBudget ?? 0).toFixed(4)} budget`;

      const result: BudgetCheckResult = {
        allowed: false,
        budgetType,
        remainingBudget,
        estimatedCost,
        exhaustedReason,
      };

      trace?.addStep({
        module: 'cost-manager',
        operation: 'checkBudget',
        durationMs: 0,
        metadata: {
          allowed: false,
          estimatedCost,
          budgetType,
          remainingBudget,
        },
      });

      return result;
    }

    const result: BudgetCheckResult = { allowed: true };

    trace?.addStep({
      module: 'cost-manager',
      operation: 'checkBudget',
      durationMs: 0,
      metadata: {
        allowed: true,
        estimatedCost,
      },
    });

    return result;
  }

  function recordCost(usage: LLMUsage, model: string, estimatedCost: number): CostRecord {
    maybeResetDailyPeriod();

    const pricing = config.modelPricing[model] ?? config.defaultModelPricing;
    const actualCost = pricing
      ? (usage.promptTokens / TOKENS_PER_1K) * pricing.promptCostPer1kTokens +
        (usage.completionTokens / TOKENS_PER_1K) * pricing.completionCostPer1kTokens
      : 0;

    sessionSpent += actualCost;
    dailySpent += actualCost;

    const sessionRemaining =
      config.sessionBudget !== undefined ? config.sessionBudget - sessionSpent : Infinity;
    const dailyRemaining =
      config.dailyBudget !== undefined ? config.dailyBudget - dailySpent : Infinity;
    const budgetType: 'session' | 'daily' =
      sessionRemaining <= dailyRemaining ? 'session' : 'daily';

    const record: CostRecord = {
      timestamp: Date.now(),
      model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      estimatedCost,
      actualCost,
      budgetType,
    };

    records.push(record);

    trace?.addStep({
      module: 'cost-manager',
      operation: 'recordCost',
      durationMs: 0,
      metadata: {
        model,
        actualCost: record.actualCost,
        estimatedCost: record.estimatedCost,
        totalUsage: usage.totalTokens,
        sessionSpent,
        dailySpent,
      },
    });

    return record;
  }

  function stats(): BudgetStats {
    const totalActualCost = records.reduce((sum, record) => sum + record.actualCost, 0);

    return {
      sessionBudget: config.sessionBudget ?? null,
      dailyBudget: config.dailyBudget ?? null,
      sessionSpent,
      dailySpent,
      sessionRemaining:
        config.sessionBudget !== undefined ? config.sessionBudget - sessionSpent : null,
      dailyRemaining: config.dailyBudget !== undefined ? config.dailyBudget - dailySpent : null,
      totalGenerations: records.length,
      averageCostPerGeneration: records.length > 0 ? totalActualCost / records.length : 0,
      records: records.slice(),
    };
  }

  function resetSession(): void {
    sessionSpent = 0;
  }

  function resetDaily(): void {
    dailySpent = 0;
    dailyPeriodStart = Date.now();
  }

  return {
    estimateCost,
    checkBudget,
    recordCost,
    stats,
    resetSession,
    resetDaily,
  };
}
