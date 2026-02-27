import type { GenerationTrace } from '../types';
import type {
  GenerationPolicyConfig,
  GenerationPolicyEngine,
  PolicyDecision,
  PolicyInput,
} from './generation-policy.types';

/**
 * Creates a generation policy engine that decides whether to generate, serve from cache, or show fallback.
 *
 * The engine is a pure decision function — it does NOT call CacheManager, CostManager,
 * or ConcurrencyController. It receives their outputs as PolicyInput and returns a
 * deterministic PolicyDecision.
 *
 * @param config - Optional configuration for future extensibility (Phase 2)
 * @param trace - Optional GenerationTrace for recording decision metadata
 * @returns A GenerationPolicyEngine with a deterministic evaluate method
 */
export function createGenerationPolicyEngine(
  config?: GenerationPolicyConfig | undefined,
  trace?: GenerationTrace | undefined,
): GenerationPolicyEngine {
  function evaluate(input: PolicyInput): PolicyDecision {
    // 1. Circuit breaker OPEN always overrides everything → show-fallback
    if (input.circuitBreakerState === 'open') {
      const decision: PolicyDecision = {
        action: 'show-fallback',
        reason: 'Circuit breaker is open — LLM calls blocked',
        inputs: input,
      };
      traceDecision(decision);
      return decision;
    }

    // 2. Cache hit → serve from cache (regardless of budget)
    if (input.cacheResult.hit) {
      const decision: PolicyDecision = {
        action: 'serve-from-cache',
        reason: 'Cache hit — serving cached specification',
        inputs: input,
      };
      traceDecision(decision);
      return decision;
    }

    // 3. Cache miss + budget available + circuit closed or half-open → generate
    if (input.budgetCheck.allowed) {
      const decision: PolicyDecision = {
        action: 'generate',
        reason:
          input.circuitBreakerState === 'half-open'
            ? 'Cache miss, budget available, circuit breaker half-open — probe generation'
            : 'Cache miss, budget available — generating via LLM',
        inputs: input,
      };
      traceDecision(decision);
      return decision;
    }

    // 4. Cache miss + budget exhausted → show fallback
    const decision: PolicyDecision = {
      action: 'show-fallback',
      reason: `Cache miss, budget exhausted — ${input.budgetCheck.exhaustedReason ?? 'no budget remaining'}`,
      inputs: input,
    };
    traceDecision(decision);
    return decision;
  }

  function traceDecision(decision: PolicyDecision): void {
    trace?.addStep({
      module: 'generation-policy',
      operation: 'evaluate',
      durationMs: 0,
      metadata: {
        action: decision.action,
        reason: decision.reason,
        cacheHit: decision.inputs.cacheResult.hit,
        budgetAllowed: decision.inputs.budgetCheck.allowed,
        budgetRemaining: decision.inputs.budgetCheck.remainingBudget,
        circuitBreakerState: decision.inputs.circuitBreakerState,
      },
    });
  }

  return { evaluate };
}
