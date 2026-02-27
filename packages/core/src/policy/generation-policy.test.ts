import { describe, expect, it } from 'vitest';
import type { CacheResult } from '../cache/cache.types';
import type { CircuitBreakerState } from '../concurrency/concurrency.types';
import type { UISpecification } from '../spec';
import { createTrace } from '../types';
import { createGenerationPolicyEngine } from './generation-policy';
import type { PolicyInput } from './generation-policy.types';
import type { BudgetCheckResult } from './policy.types';

const mockSpec: UISpecification = {
  version: '1.0.0',
  root: {
    type: 'container',
    id: 'root',
    children: [],
    layout: { type: 'stack', direction: 'vertical' },
  },
  metadata: {
    generatedAt: '2026-01-01T00:00:00Z',
    model: 'test-model',
    intentHash: 'test-hash',
  },
};

function makeInput(
  overrides: {
    cacheHit?: boolean;
    budgetAllowed?: boolean;
    remainingBudget?: number;
    circuitState?: CircuitBreakerState;
    exhaustedReason?: string;
  } = {},
): PolicyInput {
  const cacheResult: CacheResult = {
    hit: overrides.cacheHit ?? false,
    level: overrides.cacheHit ? 'L1' : undefined,
    value: overrides.cacheHit ? mockSpec : undefined,
  };

  const budgetCheck: BudgetCheckResult = {
    allowed: overrides.budgetAllowed ?? true,
    remainingBudget: overrides.remainingBudget,
    exhaustedReason:
      overrides.budgetAllowed === false
        ? (overrides.exhaustedReason ?? 'Session budget exhausted')
        : undefined,
  };

  return {
    cacheResult,
    budgetCheck,
    circuitBreakerState: overrides.circuitState ?? 'closed',
  };
}

describe('GenerationPolicyEngine', () => {
  describe('evaluate — decision matrix', () => {
    it('returns serve-from-cache when cache hit + budget available + circuit CLOSED', () => {
      const engine = createGenerationPolicyEngine();
      const decision = engine.evaluate(
        makeInput({ cacheHit: true, budgetAllowed: true, circuitState: 'closed' }),
      );
      expect(decision.action).toBe('serve-from-cache');
      expect(decision.reason).toContain('Cache hit');
    });

    it('returns show-fallback when cache hit + budget available + circuit OPEN', () => {
      const engine = createGenerationPolicyEngine();
      const decision = engine.evaluate(
        makeInput({ cacheHit: true, budgetAllowed: true, circuitState: 'open' }),
      );
      expect(decision.action).toBe('show-fallback');
      expect(decision.reason).toContain('Circuit breaker is open');
    });

    it('returns serve-from-cache when cache hit + budget exhausted + circuit CLOSED', () => {
      const engine = createGenerationPolicyEngine();
      const decision = engine.evaluate(
        makeInput({ cacheHit: true, budgetAllowed: false, circuitState: 'closed' }),
      );
      expect(decision.action).toBe('serve-from-cache');
      expect(decision.reason).toContain('Cache hit');
    });

    it('returns show-fallback when cache hit + budget exhausted + circuit OPEN', () => {
      const engine = createGenerationPolicyEngine();
      const decision = engine.evaluate(
        makeInput({ cacheHit: true, budgetAllowed: false, circuitState: 'open' }),
      );
      expect(decision.action).toBe('show-fallback');
      expect(decision.reason).toContain('Circuit breaker is open');
    });

    it('returns generate when cache miss + budget available + circuit CLOSED', () => {
      const engine = createGenerationPolicyEngine();
      const decision = engine.evaluate(
        makeInput({ cacheHit: false, budgetAllowed: true, circuitState: 'closed' }),
      );
      expect(decision.action).toBe('generate');
      expect(decision.reason).toContain('generating via LLM');
    });

    it('returns show-fallback when cache miss + budget available + circuit OPEN', () => {
      const engine = createGenerationPolicyEngine();
      const decision = engine.evaluate(
        makeInput({ cacheHit: false, budgetAllowed: true, circuitState: 'open' }),
      );
      expect(decision.action).toBe('show-fallback');
      expect(decision.reason).toContain('Circuit breaker is open');
    });

    it('returns show-fallback when cache miss + budget exhausted + circuit CLOSED', () => {
      const engine = createGenerationPolicyEngine();
      const decision = engine.evaluate(
        makeInput({ cacheHit: false, budgetAllowed: false, circuitState: 'closed' }),
      );
      expect(decision.action).toBe('show-fallback');
      expect(decision.reason).toContain('budget exhausted');
    });

    it('returns show-fallback when cache miss + budget exhausted + circuit OPEN', () => {
      const engine = createGenerationPolicyEngine();
      const decision = engine.evaluate(
        makeInput({ cacheHit: false, budgetAllowed: false, circuitState: 'open' }),
      );
      expect(decision.action).toBe('show-fallback');
      expect(decision.reason).toContain('Circuit breaker is open');
    });

    it('returns generate when cache miss + budget available + circuit HALF-OPEN (probe allowed)', () => {
      const engine = createGenerationPolicyEngine();
      const decision = engine.evaluate(
        makeInput({ cacheHit: false, budgetAllowed: true, circuitState: 'half-open' }),
      );
      expect(decision.action).toBe('generate');
      expect(decision.reason).toContain('half-open');
      expect(decision.reason).toContain('probe');
    });

    it('returns serve-from-cache when cache hit + budget available + circuit HALF-OPEN', () => {
      const engine = createGenerationPolicyEngine();
      const decision = engine.evaluate(
        makeInput({ cacheHit: true, budgetAllowed: true, circuitState: 'half-open' }),
      );
      expect(decision.action).toBe('serve-from-cache');
      expect(decision.reason).toContain('Cache hit');
    });

    it('returns show-fallback when cache miss + budget exhausted + circuit HALF-OPEN', () => {
      const engine = createGenerationPolicyEngine();
      const decision = engine.evaluate(
        makeInput({ cacheHit: false, budgetAllowed: false, circuitState: 'half-open' }),
      );
      expect(decision.action).toBe('show-fallback');
      expect(decision.reason).toContain('budget exhausted');
    });
  });

  describe('evaluate — determinism', () => {
    it('produces the same decision for the same inputs', () => {
      const engine = createGenerationPolicyEngine();
      const input = makeInput({ cacheHit: false, budgetAllowed: true, circuitState: 'closed' });

      const decision1 = engine.evaluate(input);
      const decision2 = engine.evaluate(input);

      expect(decision1.action).toBe(decision2.action);
      expect(decision1.reason).toBe(decision2.reason);
    });

    it('includes all input states in the decision', () => {
      const engine = createGenerationPolicyEngine();
      const input = makeInput({ cacheHit: true, budgetAllowed: true, circuitState: 'closed' });

      const decision = engine.evaluate(input);

      expect(decision.inputs).toBe(input);
      expect(decision.inputs.cacheResult.hit).toBe(true);
      expect(decision.inputs.budgetCheck.allowed).toBe(true);
      expect(decision.inputs.circuitBreakerState).toBe('closed');
    });
  });

  describe('evaluate — trace integration', () => {
    it('records trace step with module generation-policy', () => {
      const trace = createTrace();
      const engine = createGenerationPolicyEngine(undefined, trace);

      engine.evaluate(makeInput({ cacheHit: true }));

      expect(trace.steps).toHaveLength(1);
      expect(trace.steps[0]!.module).toBe('generation-policy');
      expect(trace.steps[0]!.operation).toBe('evaluate');
      expect(trace.steps[0]!.durationMs).toBe(0);
    });

    it('trace metadata includes action, reason, cache state, budget state, circuit breaker state', () => {
      const trace = createTrace();
      const engine = createGenerationPolicyEngine(undefined, trace);

      engine.evaluate(
        makeInput({
          cacheHit: false,
          budgetAllowed: true,
          remainingBudget: 12.5,
          circuitState: 'closed',
        }),
      );

      const metadata = trace.steps[0]!.metadata;
      expect(metadata).toHaveProperty('action', 'generate');
      expect(metadata).toHaveProperty('reason');
      expect(metadata).toHaveProperty('cacheHit', false);
      expect(metadata).toHaveProperty('budgetAllowed', true);
      expect(metadata).toHaveProperty('budgetRemaining', 12.5);
      expect(metadata).toHaveProperty('circuitBreakerState', 'closed');
    });

    it('works correctly without trace (trace is optional)', () => {
      const engine = createGenerationPolicyEngine();

      const decision = engine.evaluate(
        makeInput({ cacheHit: false, budgetAllowed: true, circuitState: 'closed' }),
      );

      expect(decision.action).toBe('generate');
    });

    it('accumulates trace steps across multiple evaluations', () => {
      const trace = createTrace();
      const engine = createGenerationPolicyEngine(undefined, trace);

      engine.evaluate(makeInput({ cacheHit: true }));
      engine.evaluate(makeInput({ cacheHit: false, budgetAllowed: true }));
      engine.evaluate(makeInput({ cacheHit: false, budgetAllowed: false }));

      expect(trace.steps).toHaveLength(3);
      expect(trace.steps[0]!.metadata['action']).toBe('serve-from-cache');
      expect(trace.steps[1]!.metadata['action']).toBe('generate');
      expect(trace.steps[2]!.metadata['action']).toBe('show-fallback');
    });
  });

  describe('createGenerationPolicyEngine — factory', () => {
    it('returns a valid GenerationPolicyEngine', () => {
      const engine = createGenerationPolicyEngine();
      expect(engine).toBeDefined();
      expect(typeof engine.evaluate).toBe('function');
    });

    it('accepts optional config and trace', () => {
      const trace = createTrace();
      const engine = createGenerationPolicyEngine({}, trace);
      expect(engine).toBeDefined();
      expect(typeof engine.evaluate).toBe('function');
    });

    it('accepts undefined config and trace', () => {
      const engine = createGenerationPolicyEngine(undefined, undefined);
      expect(engine).toBeDefined();
    });
  });

  describe('evaluate — exhaustedReason propagation', () => {
    it('includes exhaustedReason from budgetCheck in decision reason', () => {
      const engine = createGenerationPolicyEngine();
      const decision = engine.evaluate(
        makeInput({
          cacheHit: false,
          budgetAllowed: false,
          exhaustedReason: 'Daily budget limit reached',
        }),
      );
      expect(decision.action).toBe('show-fallback');
      expect(decision.reason).toContain('Daily budget limit reached');
    });

    it('uses default message when exhaustedReason is undefined', () => {
      const engine = createGenerationPolicyEngine();
      const input: PolicyInput = {
        cacheResult: { hit: false },
        budgetCheck: { allowed: false },
        circuitBreakerState: 'closed',
      };
      const decision = engine.evaluate(input);
      expect(decision.action).toBe('show-fallback');
      expect(decision.reason).toContain('no budget remaining');
    });
  });
});
