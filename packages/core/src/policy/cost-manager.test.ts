import { afterEach, describe, expect, it, vi } from 'vitest';

import { FLUI_E027, FluiError } from '../errors';
import type { LLMUsage } from '../types';
import { createTrace } from '../types';
import { createCostManager } from './cost-manager';
import { DAILY_RESET_INTERVAL_MS } from './cost-manager.constants';
import type { ModelPricing } from './policy.types';

const TEST_PRICING: Record<string, ModelPricing> = {
  'gpt-4o': { promptCostPer1kTokens: 0.005, completionCostPer1kTokens: 0.015 },
  'claude-sonnet': { promptCostPer1kTokens: 0.003, completionCostPer1kTokens: 0.015 },
};

const DEFAULT_PRICING: ModelPricing = {
  promptCostPer1kTokens: 0.01,
  completionCostPer1kTokens: 0.03,
};

function makeUsage(prompt: number, completion: number): LLMUsage {
  return { promptTokens: prompt, completionTokens: completion, totalTokens: prompt + completion };
}

describe('CostManager', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Budget Configuration', () => {
    it('creates cost manager with session budget only', () => {
      const manager = createCostManager({
        sessionBudget: 1.0,
        modelPricing: TEST_PRICING,
      });

      const stats = manager.stats();
      expect(stats.sessionBudget).toBe(1.0);
      expect(stats.dailyBudget).toBeNull();
      expect(stats.sessionSpent).toBe(0);
      expect(stats.sessionRemaining).toBe(1.0);
      expect(stats.dailyRemaining).toBeNull();
    });

    it('creates cost manager with daily budget only', () => {
      const manager = createCostManager({
        dailyBudget: 5.0,
        modelPricing: TEST_PRICING,
      });

      const stats = manager.stats();
      expect(stats.sessionBudget).toBeNull();
      expect(stats.dailyBudget).toBe(5.0);
      expect(stats.dailySpent).toBe(0);
      expect(stats.dailyRemaining).toBe(5.0);
      expect(stats.sessionRemaining).toBeNull();
    });

    it('creates cost manager with both budgets', () => {
      const manager = createCostManager({
        sessionBudget: 0.5,
        dailyBudget: 2.0,
        modelPricing: TEST_PRICING,
      });

      const stats = manager.stats();
      expect(stats.sessionBudget).toBe(0.5);
      expect(stats.dailyBudget).toBe(2.0);
      expect(stats.sessionRemaining).toBe(0.5);
      expect(stats.dailyRemaining).toBe(2.0);
    });

    it('creates cost manager with no budgets (all calls allowed)', () => {
      const manager = createCostManager({
        modelPricing: TEST_PRICING,
      });

      const stats = manager.stats();
      expect(stats.sessionBudget).toBeNull();
      expect(stats.dailyBudget).toBeNull();
      expect(stats.sessionRemaining).toBeNull();
      expect(stats.dailyRemaining).toBeNull();

      // All calls should be allowed
      const check = manager.checkBudget(999_999);
      expect(check.allowed).toBe(true);
    });

    it('throws FLUI_E027 for negative session budget', () => {
      expect(() =>
        createCostManager({
          sessionBudget: -1,
          modelPricing: TEST_PRICING,
        }),
      ).toThrow(FluiError);

      try {
        createCostManager({ sessionBudget: -0.01, modelPricing: TEST_PRICING });
      } catch (e) {
        expect(e).toBeInstanceOf(FluiError);
        expect((e as FluiError).code).toBe(FLUI_E027);
        expect((e as FluiError).category).toBe('policy');
      }
    });

    it('throws FLUI_E027 for negative daily budget', () => {
      expect(() =>
        createCostManager({
          dailyBudget: -5,
          modelPricing: TEST_PRICING,
        }),
      ).toThrow(FluiError);

      try {
        createCostManager({ dailyBudget: -0.001, modelPricing: TEST_PRICING });
      } catch (e) {
        expect(e).toBeInstanceOf(FluiError);
        expect((e as FluiError).code).toBe(FLUI_E027);
        expect((e as FluiError).category).toBe('policy');
      }
    });

    it('logs warning when no model pricing configured', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      createCostManager({ modelPricing: {} });

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No model pricing configured'));

      warnSpy.mockRestore();
    });

    it('does not log warning when defaultModelPricing is set', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      createCostManager({ modelPricing: {}, defaultModelPricing: DEFAULT_PRICING });

      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  describe('Cost Estimation', () => {
    it('estimates cost with known model pricing', () => {
      const manager = createCostManager({ modelPricing: TEST_PRICING });

      const estimate = manager.estimateCost(1000, 'gpt-4o');

      // 1000 / 1000 * 0.005 = 0.005
      expect(estimate.estimatedCost).toBe(0.005);
      expect(estimate.estimatedPromptTokens).toBe(1000);
      expect(estimate.model).toBe('gpt-4o');
    });

    it('estimates cost with different model', () => {
      const manager = createCostManager({ modelPricing: TEST_PRICING });

      const estimate = manager.estimateCost(2000, 'claude-sonnet');

      // 2000 / 1000 * 0.003 = 0.006
      expect(estimate.estimatedCost).toBe(0.006);
    });

    it('estimates cost with default model pricing fallback', () => {
      const manager = createCostManager({
        modelPricing: {},
        defaultModelPricing: DEFAULT_PRICING,
      });

      const estimate = manager.estimateCost(500, 'unknown-model');

      // 500 / 1000 * 0.01 = 0.005
      expect(estimate.estimatedCost).toBe(0.005);
    });

    it('returns zero cost for unknown model with no pricing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const manager = createCostManager({ modelPricing: {} });
      warnSpy.mockRestore();

      const estimate = manager.estimateCost(10000, 'no-pricing-model');

      expect(estimate.estimatedCost).toBe(0);
    });

    it('reflects remaining budget from most constrained type', () => {
      const manager = createCostManager({
        sessionBudget: 0.1,
        dailyBudget: 1.0,
        modelPricing: TEST_PRICING,
      });

      const estimate = manager.estimateCost(1000, 'gpt-4o');

      // Session is more constrained (0.10 < 1.00)
      expect(estimate.budgetType).toBe('session');
      expect(estimate.remainingBudget).toBe(0.1);
    });

    it('reflects daily as most constrained when session is larger', () => {
      const manager = createCostManager({
        sessionBudget: 10.0,
        dailyBudget: 0.05,
        modelPricing: TEST_PRICING,
      });

      const estimate = manager.estimateCost(1000, 'gpt-4o');

      expect(estimate.budgetType).toBe('daily');
      expect(estimate.remainingBudget).toBe(0.05);
    });

    it('records trace step with module cost-manager', () => {
      const trace = createTrace();
      const manager = createCostManager({ modelPricing: TEST_PRICING }, trace);

      manager.estimateCost(1000, 'gpt-4o');

      const steps = trace.steps.filter((s) => s.module === 'cost-manager');
      expect(steps).toHaveLength(1);
      expect(steps[0].operation).toBe('estimateCost');
      expect(steps[0].metadata).toMatchObject({
        model: 'gpt-4o',
        promptCount: 1000,
        estimatedCost: 0.005,
      });
    });
  });

  describe('Budget Check', () => {
    it('allows call within session budget', () => {
      const manager = createCostManager({
        sessionBudget: 1.0,
        modelPricing: TEST_PRICING,
      });

      const check = manager.checkBudget(0.5);

      expect(check.allowed).toBe(true);
    });

    it('allows call within daily budget', () => {
      const manager = createCostManager({
        dailyBudget: 1.0,
        modelPricing: TEST_PRICING,
      });

      const check = manager.checkBudget(0.5);

      expect(check.allowed).toBe(true);
    });

    it('blocks call exceeding session budget', () => {
      const manager = createCostManager({
        sessionBudget: 0.01,
        modelPricing: TEST_PRICING,
      });

      const check = manager.checkBudget(0.02);

      expect(check.allowed).toBe(false);
      expect(check.budgetType).toBe('session');
      expect(check.remainingBudget).toBe(0.01);
      expect(check.estimatedCost).toBe(0.02);
      expect(check.exhaustedReason).toContain('Session budget exhausted');
    });

    it('blocks call exceeding daily budget', () => {
      const manager = createCostManager({
        dailyBudget: 0.01,
        modelPricing: TEST_PRICING,
      });

      const check = manager.checkBudget(0.02);

      expect(check.allowed).toBe(false);
      expect(check.budgetType).toBe('daily');
      expect(check.remainingBudget).toBe(0.01);
      expect(check.estimatedCost).toBe(0.02);
      expect(check.exhaustedReason).toContain('Daily budget exhausted');
    });

    it('reports more restrictive budget when both configured', () => {
      const manager = createCostManager({
        sessionBudget: 0.01,
        dailyBudget: 0.05,
        modelPricing: TEST_PRICING,
      });

      // Session budget (0.01) is more restrictive than daily (0.05)
      const check = manager.checkBudget(0.02);

      expect(check.allowed).toBe(false);
      expect(check.budgetType).toBe('session');
    });

    it('reports daily budget when daily is more restrictive', () => {
      const manager = createCostManager({
        sessionBudget: 1.0,
        dailyBudget: 0.005,
        modelPricing: TEST_PRICING,
      });

      const check = manager.checkBudget(0.01);

      expect(check.allowed).toBe(false);
      expect(check.budgetType).toBe('daily');
    });

    it('chooses the more restrictive exhausted budget when both are exceeded', () => {
      const manager = createCostManager({
        sessionBudget: 0.03,
        dailyBudget: 0.02,
        modelPricing: TEST_PRICING,
      });

      manager.recordCost(makeUsage(1000, 500), 'gpt-4o', 0.005); // actual 0.0125

      // Both would be exceeded: session remaining 0.0175, daily remaining 0.0075
      const check = manager.checkBudget(0.01);

      expect(check.allowed).toBe(false);
      expect(check.budgetType).toBe('daily');
      expect(check.remainingBudget).toBeCloseTo(0.0075, 10);
    });

    it('rejects negative estimated cost input', () => {
      const manager = createCostManager({
        sessionBudget: 1,
        modelPricing: TEST_PRICING,
      });

      const check = manager.checkBudget(-0.001);

      expect(check.allowed).toBe(false);
      expect(check.budgetType).toBeUndefined();
      expect(check.exhaustedReason).toContain('Invalid estimated cost');
    });

    it('returns correct BudgetCheckResult fields for allowed call', () => {
      const manager = createCostManager({
        sessionBudget: 1.0,
        modelPricing: TEST_PRICING,
      });

      const check = manager.checkBudget(0.001);

      expect(check.allowed).toBe(true);
      expect(check.exhaustedReason).toBeUndefined();
    });

    it('records trace step for budget check', () => {
      const trace = createTrace();
      const manager = createCostManager({ sessionBudget: 1.0, modelPricing: TEST_PRICING }, trace);

      manager.checkBudget(0.5);

      const steps = trace.steps.filter(
        (s) => s.module === 'cost-manager' && s.operation === 'checkBudget',
      );
      expect(steps).toHaveLength(1);
      expect(steps[0].metadata).toMatchObject({ allowed: true, estimatedCost: 0.5 });
    });

    it('records trace step for blocked budget check', () => {
      const trace = createTrace();
      const manager = createCostManager({ sessionBudget: 0.01, modelPricing: TEST_PRICING }, trace);

      manager.checkBudget(0.5);

      const steps = trace.steps.filter(
        (s) => s.module === 'cost-manager' && s.operation === 'checkBudget',
      );
      expect(steps).toHaveLength(1);
      expect(steps[0].metadata).toMatchObject({
        allowed: false,
        budgetType: 'session',
      });
    });
  });

  describe('Cost Recording', () => {
    it('deducts actual cost from session budget', () => {
      const manager = createCostManager({
        sessionBudget: 1.0,
        modelPricing: TEST_PRICING,
      });

      // Record: (500/1000)*0.005 + (200/1000)*0.015 = 0.0025 + 0.003 = 0.0055
      manager.recordCost(makeUsage(500, 200), 'gpt-4o', 0.0025);

      const stats = manager.stats();
      expect(stats.sessionSpent).toBeCloseTo(0.0055, 10);
      expect(stats.sessionRemaining).toBeCloseTo(1.0 - 0.0055, 10);
    });

    it('deducts actual cost from daily budget', () => {
      const manager = createCostManager({
        dailyBudget: 1.0,
        modelPricing: TEST_PRICING,
      });

      manager.recordCost(makeUsage(1000, 500), 'gpt-4o', 0.005);
      // Actual: (1000/1000)*0.005 + (500/1000)*0.015 = 0.005 + 0.0075 = 0.0125

      const stats = manager.stats();
      expect(stats.dailySpent).toBeCloseTo(0.0125, 10);
      expect(stats.dailyRemaining).toBeCloseTo(1.0 - 0.0125, 10);
    });

    it('creates accurate CostRecord with estimated vs actual', () => {
      const manager = createCostManager({ modelPricing: TEST_PRICING });

      const record = manager.recordCost(makeUsage(1000, 300), 'gpt-4o', 0.005);

      expect(record.model).toBe('gpt-4o');
      expect(record.promptTokens).toBe(1000);
      expect(record.completionTokens).toBe(300);
      expect(record.totalTokens).toBe(1300);
      expect(record.estimatedCost).toBe(0.005);
      // Actual: (1000/1000)*0.005 + (300/1000)*0.015 = 0.005 + 0.0045 = 0.0095
      expect(record.actualCost).toBeCloseTo(0.0095, 10);
      expect(record.timestamp).toBeGreaterThan(0);
    });

    it('handles actual cost different from estimate', () => {
      const manager = createCostManager({ modelPricing: TEST_PRICING });

      // Estimate was for 500 prompt tokens = 0.0025
      // Actual: 500 prompt + 1000 completion
      const record = manager.recordCost(makeUsage(500, 1000), 'gpt-4o', 0.0025);

      // Actual: (500/1000)*0.005 + (1000/1000)*0.015 = 0.0025 + 0.015 = 0.0175
      expect(record.estimatedCost).toBe(0.0025);
      expect(record.actualCost).toBeCloseTo(0.0175, 10);
    });

    it('records trace step for cost recording', () => {
      const trace = createTrace();
      const manager = createCostManager({ modelPricing: TEST_PRICING }, trace);

      manager.recordCost(makeUsage(1000, 500), 'gpt-4o', 0.005);

      const steps = trace.steps.filter(
        (s) => s.module === 'cost-manager' && s.operation === 'recordCost',
      );
      expect(steps).toHaveLength(1);
      expect(steps[0].metadata).toMatchObject({
        model: 'gpt-4o',
        totalUsage: 1500,
      });
    });

    it('tracks cumulative cost across multiple generations', () => {
      const manager = createCostManager({
        sessionBudget: 1.0,
        modelPricing: TEST_PRICING,
      });

      // First call: actual = 0.0055
      manager.recordCost(makeUsage(500, 200), 'gpt-4o', 0.0025);
      // Second call: actual = (1000/1000)*0.003 + (300/1000)*0.015 = 0.003 + 0.0045 = 0.0075
      manager.recordCost(makeUsage(1000, 300), 'claude-sonnet', 0.003);

      const stats = manager.stats();
      expect(stats.sessionSpent).toBeCloseTo(0.0055 + 0.0075, 10);
      expect(stats.totalGenerations).toBe(2);
    });

    it('records zero cost for unknown model without pricing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const manager = createCostManager({ modelPricing: {} });
      warnSpy.mockRestore();

      const record = manager.recordCost(makeUsage(1000, 500), 'unknown-model', 0);

      expect(record.actualCost).toBe(0);
    });
  });

  describe('Time-Period Budget', () => {
    it('resets daily budget after 24 hours', () => {
      vi.useFakeTimers();

      const manager = createCostManager({
        dailyBudget: 0.1,
        modelPricing: TEST_PRICING,
      });

      // Spend some budget
      manager.recordCost(makeUsage(5000, 2000), 'gpt-4o', 0.025);

      // Verify budget was consumed
      const statsBefore = manager.stats();
      expect(statsBefore.dailySpent).toBeGreaterThan(0);

      // Advance 24 hours
      vi.advanceTimersByTime(DAILY_RESET_INTERVAL_MS);

      // Budget should reset on next check
      const check = manager.checkBudget(0.05);
      expect(check.allowed).toBe(true);
    });

    it('does NOT reset daily budget before period expires', () => {
      vi.useFakeTimers();

      const manager = createCostManager({
        dailyBudget: 0.01,
        modelPricing: TEST_PRICING,
      });

      // Spend all budget
      manager.recordCost(makeUsage(1000, 500), 'gpt-4o', 0.005);
      // Actual: 0.005 + 0.0075 = 0.0125 > 0.01 daily budget

      // Advance 23 hours (not enough)
      vi.advanceTimersByTime(DAILY_RESET_INTERVAL_MS - 3_600_000);

      const check = manager.checkBudget(0.001);
      expect(check.allowed).toBe(false);
    });

    it('preserves historical records after daily reset', () => {
      vi.useFakeTimers();

      const manager = createCostManager({
        dailyBudget: 1.0,
        modelPricing: TEST_PRICING,
      });

      // Record cost before reset
      manager.recordCost(makeUsage(1000, 500), 'gpt-4o', 0.005);

      // Advance 24 hours
      vi.advanceTimersByTime(DAILY_RESET_INTERVAL_MS);

      // Trigger reset via checkBudget
      manager.checkBudget(0.001);

      // Record cost after reset
      manager.recordCost(makeUsage(500, 200), 'gpt-4o', 0.0025);

      const stats = manager.stats();
      // Both records should be preserved
      expect(stats.totalGenerations).toBe(2);
      expect(stats.records).toHaveLength(2);
    });

    it('resets session counters with resetSession()', () => {
      const manager = createCostManager({
        sessionBudget: 0.1,
        modelPricing: TEST_PRICING,
      });

      manager.recordCost(makeUsage(1000, 500), 'gpt-4o', 0.005);

      const statsBefore = manager.stats();
      expect(statsBefore.sessionSpent).toBeGreaterThan(0);

      manager.resetSession();

      const statsAfter = manager.stats();
      expect(statsAfter.sessionSpent).toBe(0);
      expect(statsAfter.sessionRemaining).toBe(0.1);
      // Records still preserved
      expect(statsAfter.totalGenerations).toBe(1);
    });

    it('resets daily counters with resetDaily()', () => {
      const manager = createCostManager({
        dailyBudget: 0.1,
        modelPricing: TEST_PRICING,
      });

      manager.recordCost(makeUsage(1000, 500), 'gpt-4o', 0.005);

      const statsBefore = manager.stats();
      expect(statsBefore.dailySpent).toBeGreaterThan(0);

      manager.resetDaily();

      const statsAfter = manager.stats();
      expect(statsAfter.dailySpent).toBe(0);
      expect(statsAfter.dailyRemaining).toBe(0.1);
      // Records still preserved
      expect(statsAfter.totalGenerations).toBe(1);
    });
  });

  describe('Stats', () => {
    it('returns zeros with no generations', () => {
      const manager = createCostManager({
        sessionBudget: 1.0,
        dailyBudget: 5.0,
        modelPricing: TEST_PRICING,
      });

      const stats = manager.stats();

      expect(stats.sessionSpent).toBe(0);
      expect(stats.dailySpent).toBe(0);
      expect(stats.totalGenerations).toBe(0);
      expect(stats.averageCostPerGeneration).toBe(0);
      expect(stats.records).toHaveLength(0);
    });

    it('reflects correct budget utilization after multiple generations', () => {
      const manager = createCostManager({
        sessionBudget: 1.0,
        dailyBudget: 5.0,
        modelPricing: TEST_PRICING,
      });

      // Gen 1: actual = (1000/1000)*0.005 + (500/1000)*0.015 = 0.005 + 0.0075 = 0.0125
      manager.recordCost(makeUsage(1000, 500), 'gpt-4o', 0.005);
      // Gen 2: actual = (2000/1000)*0.003 + (800/1000)*0.015 = 0.006 + 0.012 = 0.018
      manager.recordCost(makeUsage(2000, 800), 'claude-sonnet', 0.006);

      const stats = manager.stats();
      const totalSpent = 0.0125 + 0.018;

      expect(stats.sessionSpent).toBeCloseTo(totalSpent, 10);
      expect(stats.dailySpent).toBeCloseTo(totalSpent, 10);
      expect(stats.sessionRemaining).toBeCloseTo(1.0 - totalSpent, 10);
      expect(stats.dailyRemaining).toBeCloseTo(5.0 - totalSpent, 10);
      expect(stats.totalGenerations).toBe(2);
    });

    it('returns read-only copy of records', () => {
      const manager = createCostManager({ modelPricing: TEST_PRICING });

      manager.recordCost(makeUsage(1000, 500), 'gpt-4o', 0.005);

      const stats1 = manager.stats();
      const stats2 = manager.stats();

      // Different array references
      expect(stats1.records).not.toBe(stats2.records);
      // Same content
      expect(stats1.records).toEqual(stats2.records);
    });

    it('calculates average cost per generation', () => {
      const manager = createCostManager({ modelPricing: TEST_PRICING });

      // Gen 1: actual = 0.0125
      manager.recordCost(makeUsage(1000, 500), 'gpt-4o', 0.005);
      // Gen 2: actual = 0.018
      manager.recordCost(makeUsage(2000, 800), 'claude-sonnet', 0.006);

      const stats = manager.stats();
      // Average = sessionSpent / totalGenerations
      expect(stats.averageCostPerGeneration).toBeCloseTo(stats.sessionSpent / 2, 10);
    });

    it('keeps average cost stable after resetSession()', () => {
      const manager = createCostManager({
        sessionBudget: 1.0,
        modelPricing: TEST_PRICING,
      });

      manager.recordCost(makeUsage(1000, 500), 'gpt-4o', 0.005); // 0.0125
      manager.recordCost(makeUsage(2000, 800), 'claude-sonnet', 0.006); // 0.018

      const beforeReset = manager.stats();
      const expectedAverage = beforeReset.averageCostPerGeneration;

      manager.resetSession();

      const afterReset = manager.stats();
      expect(afterReset.totalGenerations).toBe(2);
      expect(afterReset.averageCostPerGeneration).toBeCloseTo(expectedAverage, 10);
    });
  });

  describe('GenerationTrace Enrichment', () => {
    it('all three operations add trace steps', () => {
      const trace = createTrace();
      const manager = createCostManager({ sessionBudget: 1.0, modelPricing: TEST_PRICING }, trace);

      manager.estimateCost(1000, 'gpt-4o');
      manager.checkBudget(0.005);
      manager.recordCost(makeUsage(1000, 500), 'gpt-4o', 0.005);

      const costSteps = trace.steps.filter((s) => s.module === 'cost-manager');
      expect(costSteps).toHaveLength(3);
      expect(costSteps[0].operation).toBe('estimateCost');
      expect(costSteps[1].operation).toBe('checkBudget');
      expect(costSteps[2].operation).toBe('recordCost');
    });

    it('trace metadata includes relevant cost information', () => {
      const trace = createTrace();
      const manager = createCostManager({ sessionBudget: 1.0, modelPricing: TEST_PRICING }, trace);

      manager.estimateCost(1000, 'gpt-4o');

      const step = trace.steps.find(
        (s) => s.module === 'cost-manager' && s.operation === 'estimateCost',
      );
      expect(step).toBeDefined();
      expect(step!.metadata).toHaveProperty('model');
      expect(step!.metadata).toHaveProperty('estimatedCost');
      expect(step!.metadata).toHaveProperty('promptCount');
      expect(step!.metadata).toHaveProperty('remainingBudget');
      expect(step!.metadata).toHaveProperty('budgetType');
    });

    it('trace step module is cost-manager', () => {
      const trace = createTrace();
      const manager = createCostManager({ modelPricing: TEST_PRICING }, trace);

      manager.estimateCost(500, 'gpt-4o');
      manager.checkBudget(0.001);
      manager.recordCost(makeUsage(500, 100), 'gpt-4o', 0.001);

      const costSteps = trace.steps.filter((s) => s.module === 'cost-manager');
      expect(costSteps).toHaveLength(3);
      for (const step of costSteps) {
        expect(step.module).toBe('cost-manager');
        expect(step.durationMs).toBe(0);
      }
    });

    it('works without trace (no errors thrown)', () => {
      const manager = createCostManager({ modelPricing: TEST_PRICING });

      expect(() => {
        manager.estimateCost(1000, 'gpt-4o');
        manager.checkBudget(0.005);
        manager.recordCost(makeUsage(1000, 500), 'gpt-4o', 0.005);
      }).not.toThrow();
    });
  });

  describe('Budget Enforcement Integration', () => {
    it('blocks call when session budget would be exceeded after prior spending', () => {
      const manager = createCostManager({
        sessionBudget: 0.01,
        modelPricing: TEST_PRICING,
      });

      // First call estimate: 500 prompt tokens * $0.005/1k = $0.0025
      const estimate = manager.estimateCost(500, 'gpt-4o');
      expect(estimate.estimatedCost).toBe(0.0025);

      // Record cost consuming most of budget
      // Actual: (500/1000)*0.005 + (200/1000)*0.015 = 0.0025 + 0.003 = 0.0055
      manager.recordCost(makeUsage(500, 200), 'gpt-4o', 0.0025);

      // Next call estimate: 2000 tokens * $0.005/1k = $0.01
      const check = manager.checkBudget(0.01);
      expect(check.allowed).toBe(false);
      expect(check.budgetType).toBe('session');
    });

    it('allows call that exactly fits remaining budget', () => {
      const manager = createCostManager({
        sessionBudget: 0.01,
        modelPricing: TEST_PRICING,
      });

      // Spend exactly $0.005
      // Force actual cost by using known pricing: (1000/1000)*0.005 + (0/1000)*0.015 = 0.005
      manager.recordCost(makeUsage(1000, 0), 'gpt-4o', 0.005);

      // Remaining: 0.01 - 0.005 = 0.005
      // Check for exactly remaining amount
      const check = manager.checkBudget(0.005);
      expect(check.allowed).toBe(true);
    });

    it('blocks call that exceeds remaining budget by a tiny amount', () => {
      const manager = createCostManager({
        sessionBudget: 0.01,
        modelPricing: TEST_PRICING,
      });

      // Spend $0.005
      manager.recordCost(makeUsage(1000, 0), 'gpt-4o', 0.005);

      // Check for slightly more than remaining
      const check = manager.checkBudget(0.005001);
      expect(check.allowed).toBe(false);
    });
  });
});
