import {
  ComponentRegistry,
  err,
  FLUI_E010,
  FluiError,
  type GenerationOrchestrator,
  type IntentObject,
  type LLMConnector,
  ok,
  type UISpecification,
  type ValidationPipeline,
} from '@flui/core';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { FluiContextValue, FluiReactConfig, LiquidViewState } from '../react.types';

import { useLiquidView } from './use-liquid-view';

// Mock @flui/core generation and validation modules
vi.mock('@flui/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@flui/core')>();
  return {
    ...original,
    createGenerationOrchestrator: vi.fn(),
    createValidationPipeline: vi.fn(),
  };
});

const mockCreateOrchestrator = vi.mocked((await import('@flui/core')).createGenerationOrchestrator);
const mockCreatePipeline = vi.mocked((await import('@flui/core')).createValidationPipeline);

function createTestRegistry(): ComponentRegistry {
  const registry = new ComponentRegistry();
  registry.register({
    name: 'TestButton',
    category: 'input',
    description: 'A test button',
    accepts: z.object({ label: z.string() }),
    component: () => null,
  });
  return registry;
}

function createTestSpec(): UISpecification {
  return {
    version: '1.0',
    components: [{ id: 'c1', componentType: 'TestButton', props: { label: 'test' } }],
    layout: { type: 'stack' },
    interactions: [],
    metadata: { generatedAt: Date.now() },
  };
}

function createMockConnector(): LLMConnector {
  return {
    generate: vi.fn().mockResolvedValue(
      ok({
        content: '{}',
        model: 'test-model',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      }),
    ),
  };
}

function createMockConfig(connector?: LLMConnector): FluiReactConfig {
  return {
    generationConfig: {
      connector: connector ?? createMockConnector(),
      model: 'test-model',
    },
  };
}

function createTestContext(config?: FluiReactConfig): FluiContextValue {
  return {
    registry: createTestRegistry(),
    config,
  };
}

describe('useLiquidView', () => {
  let mockGenerate: ReturnType<typeof vi.fn>;
  let mockValidate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const testSpec = createTestSpec();
    mockGenerate = vi.fn().mockResolvedValue(ok(testSpec));
    mockValidate = vi.fn().mockResolvedValue(ok(testSpec));

    mockCreateOrchestrator.mockReturnValue({
      generate: mockGenerate,
    } as unknown as GenerationOrchestrator);

    mockCreatePipeline.mockReturnValue({
      validate: mockValidate,
      addValidator: vi.fn().mockReturnValue(ok(undefined)),
      removeValidator: vi.fn().mockReturnValue(false),
      validateWithRetry: vi.fn(),
    } as unknown as ValidationPipeline);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('state transitions', () => {
    it('starts in idle state when no intent is provided', () => {
      const ctx = createTestContext(createMockConfig());
      const { result } = renderHook(() => useLiquidView({}, ctx));

      expect(result.current.state.status).toBe('idle');
    });

    it('transitions to idle when intent is cleared', async () => {
      const ctx = createTestContext(createMockConfig());
      const { result, rerender } = renderHook(
        ({ intent }: { intent?: string }) => useLiquidView({ intent }, ctx),
        { initialProps: { intent: 'show a form' } },
      );

      // Wait for generation to complete
      await waitFor(() => {
        expect(result.current.state.status).toBe('rendering');
      });

      // Clear intent
      rerender({ intent: undefined });

      await waitFor(() => {
        expect(result.current.state.status).toBe('idle');
      });
    });

    it('progresses through generating → validating → rendering on success', async () => {
      const states: string[] = [];
      const ctx = createTestContext(createMockConfig());
      const onStateChange = (state: LiquidViewState) => states.push(state.status);

      const { result } = renderHook(() =>
        useLiquidView({ intent: 'show a button', onStateChange }, ctx),
      );

      await waitFor(() => {
        expect(result.current.state.status).toBe('rendering');
      });

      expect(states).toContain('generating');
      expect(states).toContain('validating');
      expect(states).toContain('rendering');

      // Verify order
      const genIdx = states.indexOf('generating');
      const valIdx = states.indexOf('validating');
      const renIdx = states.indexOf('rendering');
      expect(genIdx).toBeLessThan(valIdx);
      expect(valIdx).toBeLessThan(renIdx);
    });

    it('provides UISpecification in rendering state', async () => {
      const ctx = createTestContext(createMockConfig());
      const { result } = renderHook(() => useLiquidView({ intent: 'show a button' }, ctx));

      await waitFor(() => {
        expect(result.current.state.status).toBe('rendering');
      });

      const state = result.current.state;
      if (state.status === 'rendering') {
        expect(state.spec.version).toBe('1.0');
        expect(state.spec.components).toHaveLength(1);
      }
    });

    it('preserves structured intent signals in generation input', async () => {
      const ctx = createTestContext(createMockConfig());
      const structuredIntent: IntentObject = {
        originalText: 'component: TestButton, interaction: click',
        sanitizedText: 'component: TestButton, interaction: click',
        source: 'structured',
        signals: {
          componentType: 'TestButton',
          interactionPattern: 'click',
        },
      };

      renderHook(() => useLiquidView({ intent: structuredIntent }, ctx));

      await waitFor(() => {
        expect(mockGenerate).toHaveBeenCalled();
      });

      const generationInput = mockGenerate.mock.calls[0]?.[0] as { intent: IntentObject };
      expect(generationInput.intent.source).toBe('structured');
      expect(generationInput.intent.signals.componentType).toBe('TestButton');
    });
  });

  describe('error handling', () => {
    it('transitions to error state on generation failure', async () => {
      const genError = new FluiError(FLUI_E010, 'generation', 'LLM timeout');
      mockGenerate.mockResolvedValue(err(genError));

      const ctx = createTestContext(createMockConfig());
      const { result } = renderHook(() => useLiquidView({ intent: 'show a button' }, ctx));

      await waitFor(() => {
        expect(result.current.state.status).toBe('error');
      });

      const state = result.current.state;
      if (state.status === 'error') {
        expect(state.error.message).toBe('LLM timeout');
        expect(state.fallback).toBe(true);
      }
    });

    it('transitions to error state on validation failure', async () => {
      const valError = new FluiError(FLUI_E010, 'validation', 'Validation failed');
      mockValidate.mockResolvedValue(err(valError));

      const ctx = createTestContext(createMockConfig());
      const { result } = renderHook(() => useLiquidView({ intent: 'show a button' }, ctx));

      await waitFor(() => {
        expect(result.current.state.status).toBe('error');
      });

      const state = result.current.state;
      if (state.status === 'error') {
        expect(state.error.message).toBe('Validation failed');
        expect(state.fallback).toBe(true);
      }
    });

    it('transitions to error state when no generation config is provided', async () => {
      const ctx = createTestContext(); // No config
      const { result } = renderHook(() => useLiquidView({ intent: 'show a button' }, ctx));

      await waitFor(() => {
        expect(result.current.state.status).toBe('error');
      });

      const state = result.current.state;
      if (state.status === 'error') {
        expect(state.error.message).toContain('Missing generation connector or model');
      }
    });

    it('uses top-level connector in FluiReactConfig when present', async () => {
      const connector = createMockConnector();
      const ctx = createTestContext({
        connector,
        generationConfig: {
          model: 'test-model',
        } as unknown as FluiReactConfig['generationConfig'],
      });

      renderHook(() => useLiquidView({ intent: 'show a button' }, ctx));

      await waitFor(() => {
        expect(mockCreateOrchestrator).toHaveBeenCalled();
      });

      expect(mockCreateOrchestrator).toHaveBeenCalledWith(expect.objectContaining({ connector }));
    });

    it('calls onError callback on error state', async () => {
      const genError = new FluiError(FLUI_E010, 'generation', 'Network error');
      mockGenerate.mockResolvedValue(err(genError));

      const onError = vi.fn();
      const ctx = createTestContext(createMockConfig());
      renderHook(() => useLiquidView({ intent: 'show a button', onError }, ctx));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(genError);
      });
    });

    it('transitions to error on unexpected throw during generation', async () => {
      mockGenerate.mockRejectedValue(new Error('Unexpected crash'));

      const ctx = createTestContext(createMockConfig());
      const { result } = renderHook(() => useLiquidView({ intent: 'show a button' }, ctx));

      await waitFor(() => {
        expect(result.current.state.status).toBe('error');
      });

      const state = result.current.state;
      if (state.status === 'error') {
        expect(state.error.message).toBe('Unexpected crash');
      }
    });
  });

  describe('abort on unmount', () => {
    it('aborts in-flight generation when component unmounts', async () => {
      // Use a never-resolving promise to simulate in-flight generation
      let abortSignalRef: AbortSignal | undefined;
      mockGenerate.mockImplementation(
        async (_input: unknown, _trace: unknown, signal?: AbortSignal) => {
          abortSignalRef = signal;
          return new Promise(() => {}); // Never resolves
        },
      );

      const ctx = createTestContext(createMockConfig());
      const { unmount } = renderHook(() => useLiquidView({ intent: 'show a button' }, ctx));

      // Wait for generation to be called
      await waitFor(() => {
        expect(mockGenerate).toHaveBeenCalled();
      });

      // Unmount should abort
      unmount();

      expect(abortSignalRef?.aborted).toBe(true);
    });

    it('aborts previous generation when intent changes', async () => {
      const abortSignals: AbortSignal[] = [];
      let callCount = 0;

      mockGenerate.mockImplementation(
        async (_input: unknown, _trace: unknown, signal?: AbortSignal) => {
          callCount++;
          if (signal) abortSignals.push(signal);

          if (callCount === 1) {
            // First call: wait for a promise that won't auto-resolve
            return new Promise(() => {});
          }

          // Second call: resolve immediately
          return ok(createTestSpec());
        },
      );

      const ctx = createTestContext(createMockConfig());
      const { rerender } = renderHook(
        ({ intent }: { intent: string }) => useLiquidView({ intent }, ctx),
        { initialProps: { intent: 'first intent' } },
      );

      // Wait for first generation call
      await waitFor(() => {
        expect(mockGenerate).toHaveBeenCalledTimes(1);
      });

      // Change intent — should abort previous
      rerender({ intent: 'second intent' });

      await waitFor(() => {
        expect(abortSignals.length).toBeGreaterThanOrEqual(1);
        expect(abortSignals[0]?.aborted).toBe(true);
      });
    });
  });

  describe('onStateChange callback', () => {
    it('calls onStateChange for each state transition', async () => {
      const stateChanges: LiquidViewState[] = [];
      const onStateChange = (state: LiquidViewState) => stateChanges.push(state);

      const ctx = createTestContext(createMockConfig());
      renderHook(() => useLiquidView({ intent: 'show a button', onStateChange }, ctx));

      await waitFor(() => {
        expect(stateChanges.some((s) => s.status === 'rendering')).toBe(true);
      });

      expect(stateChanges.some((s) => s.status === 'generating')).toBe(true);
      expect(stateChanges.some((s) => s.status === 'validating')).toBe(true);
    });

    it('does not retrigger generation when only context changes', async () => {
      const ctx = createTestContext(createMockConfig());
      const { rerender } = renderHook(
        ({ intent, context }: { intent: string; context: Record<string, unknown> }) =>
          useLiquidView({ intent, context }, ctx),
        {
          initialProps: {
            intent: 'show a button',
            context: { page: 'one' },
          },
        },
      );

      await waitFor(() => {
        expect(mockGenerate).toHaveBeenCalledTimes(1);
      });

      rerender({ intent: 'show a button', context: { page: 'two' } });

      await waitFor(() => {
        expect(mockGenerate).toHaveBeenCalledTimes(1);
      });
    });
  });
});
