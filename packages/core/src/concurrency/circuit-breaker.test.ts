import { afterEach, describe, expect, it, vi } from 'vitest';
import { FLUI_E030, FluiError } from '../errors';
import { createTrace } from '../types';
import { createCircuitBreaker } from './circuit-breaker';
import {
  DEFAULT_FAILURE_THRESHOLD,
  DEFAULT_RESET_TIMEOUT,
} from './concurrency.constants';

describe('CircuitBreaker', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Configuration', () => {
    it('creates circuit breaker with default config', () => {
      const breaker = createCircuitBreaker();
      expect(breaker.state()).toBe('closed');
      const s = breaker.status();
      expect(s.consecutiveFailures).toBe(0);
      expect(s.lastFailureTime).toBeNull();
      expect(s.scope).toBe('global');
    });

    it('creates circuit breaker with custom thresholds', () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 30_000,
        scope: 'per-view',
      });
      expect(breaker.state()).toBe('closed');
      const s = breaker.status();
      expect(s.scope).toBe('per-view');
    });

    it('throws FLUI_E030 for non-positive failureThreshold', () => {
      expect(() => createCircuitBreaker({ failureThreshold: 0 })).toThrow(FluiError);
      expect(() => createCircuitBreaker({ failureThreshold: -1 })).toThrow(FluiError);

      try {
        createCircuitBreaker({ failureThreshold: 0 });
      } catch (e) {
        expect(e).toBeInstanceOf(FluiError);
        expect((e as FluiError).code).toBe(FLUI_E030);
        expect((e as FluiError).category).toBe('concurrency');
      }
    });

    it('throws FLUI_E030 for non-positive resetTimeout', () => {
      expect(() => createCircuitBreaker({ resetTimeout: 0 })).toThrow(FluiError);
      expect(() => createCircuitBreaker({ resetTimeout: -100 })).toThrow(FluiError);

      try {
        createCircuitBreaker({ resetTimeout: 0 });
      } catch (e) {
        expect(e).toBeInstanceOf(FluiError);
        expect((e as FluiError).code).toBe(FLUI_E030);
        expect((e as FluiError).category).toBe('concurrency');
      }
    });

    it('uses default threshold and timeout when not specified', () => {
      const breaker = createCircuitBreaker();
      // Need DEFAULT_FAILURE_THRESHOLD failures to open
      for (let i = 0; i < DEFAULT_FAILURE_THRESHOLD - 1; i++) {
        breaker.recordFailure();
      }
      expect(breaker.state()).toBe('closed');
      breaker.recordFailure();
      expect(breaker.state()).toBe('open');
    });
  });

  describe('State Machine', () => {
    it('initial state is CLOSED', () => {
      const breaker = createCircuitBreaker();
      expect(breaker.state()).toBe('closed');
    });

    it('transitions CLOSED → OPEN after failureThreshold failures', () => {
      const breaker = createCircuitBreaker({ failureThreshold: 3 });

      breaker.recordFailure();
      expect(breaker.state()).toBe('closed');
      breaker.recordFailure();
      expect(breaker.state()).toBe('closed');
      breaker.recordFailure();
      expect(breaker.state()).toBe('open');
    });

    it('transitions OPEN → HALF_OPEN after resetTimeout', () => {
      vi.useFakeTimers();
      const breaker = createCircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 60_000,
      });

      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.state()).toBe('open');

      vi.advanceTimersByTime(59_999);
      expect(breaker.state()).toBe('open');

      vi.advanceTimersByTime(1);
      expect(breaker.state()).toBe('half-open');
    });

    it('transitions HALF_OPEN → CLOSED on probe success', () => {
      vi.useFakeTimers();
      const breaker = createCircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 60_000,
      });

      // Open the circuit
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      // Advance past cooldown
      vi.advanceTimersByTime(60_000);
      breaker.shouldAllow(); // triggers half-open

      // Probe success
      breaker.recordSuccess();
      expect(breaker.state()).toBe('closed');
      expect(breaker.status().consecutiveFailures).toBe(0);
    });

    it('transitions HALF_OPEN → OPEN on probe failure and resets cooldown', () => {
      vi.useFakeTimers();
      const breaker = createCircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 60_000,
      });

      // Open the circuit
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      // Advance past cooldown
      vi.advanceTimersByTime(60_000);
      breaker.shouldAllow(); // triggers half-open

      // Probe failure
      breaker.recordFailure();
      expect(breaker.state()).toBe('open');

      // Cooldown timer was reset, so must wait again
      vi.advanceTimersByTime(59_999);
      expect(breaker.state()).toBe('open');

      vi.advanceTimersByTime(1);
      expect(breaker.state()).toBe('half-open');
    });

    it('shouldAllow returns true when CLOSED', () => {
      const breaker = createCircuitBreaker();
      expect(breaker.shouldAllow()).toBe(true);
    });

    it('shouldAllow returns false when OPEN (before cooldown)', () => {
      const breaker = createCircuitBreaker({ failureThreshold: 2 });
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.shouldAllow()).toBe(false);
    });

    it('shouldAllow returns true once when HALF_OPEN (probe)', () => {
      vi.useFakeTimers();
      const breaker = createCircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 10_000,
      });

      breaker.recordFailure();
      breaker.recordFailure();
      vi.advanceTimersByTime(10_000);

      // First call: allow probe
      expect(breaker.shouldAllow()).toBe(true);
      // Second call: deny (probe already active)
      expect(breaker.shouldAllow()).toBe(false);
    });

    it('resets consecutive failures on success in CLOSED state', () => {
      const breaker = createCircuitBreaker({ failureThreshold: 3 });

      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.status().consecutiveFailures).toBe(2);

      breaker.recordSuccess();
      expect(breaker.status().consecutiveFailures).toBe(0);

      // Should need 3 more failures to open
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.state()).toBe('closed');
      breaker.recordFailure();
      expect(breaker.state()).toBe('open');
    });
  });

  describe('Scope', () => {
    it('global scope: all keys share same counter', () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 3,
        scope: 'global',
      });

      breaker.recordFailure('view-1');
      breaker.recordFailure('view-2');
      breaker.recordFailure('view-3');

      expect(breaker.state('view-1')).toBe('open');
      expect(breaker.state('view-2')).toBe('open');
      expect(breaker.state('anything')).toBe('open');
    });

    it('per-view scope: different keys have independent counters', () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 2,
        scope: 'per-view',
      });

      breaker.recordFailure('view-1');
      breaker.recordFailure('view-1');
      expect(breaker.state('view-1')).toBe('open');
      expect(breaker.state('view-2')).toBe('closed');

      breaker.recordFailure('view-2');
      expect(breaker.state('view-2')).toBe('closed');
      breaker.recordFailure('view-2');
      expect(breaker.state('view-2')).toBe('open');
    });

    it('per-intent scope: different keys have independent counters', () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 2,
        scope: 'per-intent',
      });

      breaker.recordFailure('intent-hash-a');
      breaker.recordFailure('intent-hash-a');
      expect(breaker.state('intent-hash-a')).toBe('open');
      expect(breaker.state('intent-hash-b')).toBe('closed');
    });
  });

  describe('Reset', () => {
    it('reset clears all state back to CLOSED', () => {
      const breaker = createCircuitBreaker({ failureThreshold: 2 });

      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.state()).toBe('open');

      breaker.reset();
      expect(breaker.state()).toBe('closed');
      expect(breaker.status().consecutiveFailures).toBe(0);
    });

    it('reset with key only clears that key in per-view scope', () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 2,
        scope: 'per-view',
      });

      breaker.recordFailure('view-1');
      breaker.recordFailure('view-1');
      breaker.recordFailure('view-2');
      breaker.recordFailure('view-2');

      expect(breaker.state('view-1')).toBe('open');
      expect(breaker.state('view-2')).toBe('open');

      breaker.reset('view-1');
      expect(breaker.state('view-1')).toBe('closed');
      expect(breaker.state('view-2')).toBe('open');
    });

    it('reset without key in global scope clears all state', () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 2,
        scope: 'global',
      });

      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.state()).toBe('open');

      breaker.reset();
      expect(breaker.state()).toBe('closed');
    });
  });

  describe('Trace Integration', () => {
    it('records state change from CLOSED to OPEN in trace', () => {
      const trace = createTrace();
      const breaker = createCircuitBreaker({ failureThreshold: 2 }, trace);

      breaker.recordFailure();
      breaker.recordFailure();

      const steps = trace.steps.filter((s) => s.module === 'circuit-breaker');
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((s) => s.operation === 'stateChange')).toBe(true);

      const openStep = steps.find(
        (s) =>
          s.operation === 'stateChange' &&
          s.metadata['from'] === 'closed' &&
          s.metadata['to'] === 'open',
      );
      expect(openStep).toBeDefined();
    });

    it('records state change from OPEN to HALF_OPEN in trace', () => {
      vi.useFakeTimers();
      const trace = createTrace();
      const breaker = createCircuitBreaker(
        { failureThreshold: 2, resetTimeout: 10_000 },
        trace,
      );

      breaker.recordFailure();
      breaker.recordFailure();
      vi.advanceTimersByTime(10_000);
      breaker.shouldAllow();

      const steps = trace.steps.filter((s) => s.module === 'circuit-breaker');
      const halfOpenStep = steps.find(
        (s) =>
          s.operation === 'stateChange' &&
          s.metadata['from'] === 'open' &&
          s.metadata['to'] === 'half-open',
      );
      expect(halfOpenStep).toBeDefined();
    });

    it('records probe success transition in trace', () => {
      vi.useFakeTimers();
      const trace = createTrace();
      const breaker = createCircuitBreaker(
        { failureThreshold: 2, resetTimeout: 10_000 },
        trace,
      );

      breaker.recordFailure();
      breaker.recordFailure();
      vi.advanceTimersByTime(10_000);
      breaker.shouldAllow();
      breaker.recordSuccess();

      const steps = trace.steps.filter((s) => s.module === 'circuit-breaker');
      const closedStep = steps.find(
        (s) =>
          s.operation === 'stateChange' &&
          s.metadata['from'] === 'half-open' &&
          s.metadata['to'] === 'closed' &&
          s.metadata['reason'] === 'probe-succeeded',
      );
      expect(closedStep).toBeDefined();
    });

    it('records probe failure transition in trace', () => {
      vi.useFakeTimers();
      const trace = createTrace();
      const breaker = createCircuitBreaker(
        { failureThreshold: 2, resetTimeout: 10_000 },
        trace,
      );

      breaker.recordFailure();
      breaker.recordFailure();
      vi.advanceTimersByTime(10_000);
      breaker.shouldAllow();
      breaker.recordFailure();

      const steps = trace.steps.filter((s) => s.module === 'circuit-breaker');
      const openStep = steps.find(
        (s) =>
          s.operation === 'stateChange' &&
          s.metadata['from'] === 'half-open' &&
          s.metadata['to'] === 'open' &&
          s.metadata['reason'] === 'probe-failed',
      );
      expect(openStep).toBeDefined();
    });
  });
});
