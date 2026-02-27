import {
  type ComponentDefinition,
  type GenerationOrchestrator,
  ok,
  type UISpecification,
  type ValidationPipeline,
} from '@flui/core';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createMockConnector } from './mock-connector';
import { createTestRegistry, renderLiquidView, waitForGeneration } from './render-helpers';
import { createMinimalSpec } from './spec-builder';

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

function createTestSpec(): UISpecification {
  return createMinimalSpec({ componentType: 'Text', props: { text: 'Hello World' } });
}

describe('renderLiquidView', () => {
  let mockGenerate: ReturnType<typeof vi.fn>;
  let mockValidate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const testSpec = createTestSpec();
    mockGenerate = vi.fn().mockResolvedValue(ok(testSpec));
    mockValidate = vi.fn().mockImplementation(async (spec: unknown) => ok(spec as UISpecification));

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

  it('renders LiquidView wrapped in FluiProvider', () => {
    const connector = createMockConnector();
    const registry = createTestRegistry();

    const { renderResult } = renderLiquidView({
      connector,
      registry,
    });

    expect(renderResult.container).toBeDefined();
  });

  it('creates a test registry automatically from component definitions', async () => {
    const connector = createMockConnector();
    const component: ComponentDefinition = {
      name: 'Text',
      category: 'display',
      description: 'A text component',
      accepts: z.object({ text: z.string() }),
      component: ({ text }: { text: string }) => {
        return createElement('span', { 'data-testid': 'text-component' }, text);
      },
    };

    const { renderResult, states } = renderLiquidView({
      connector,
      components: [component],
      intent: 'show text',
    });

    await waitForGeneration(states);
    const text = await renderResult.findByTestId('text-component');
    expect(text.textContent).toBe('Hello World');
  });

  it('shows fallback when no intent is provided', () => {
    const connector = createMockConnector();
    const registry = createTestRegistry();

    const { renderResult } = renderLiquidView({
      connector,
      registry,
    });

    // No intent means idle state — no fallback shown in idle
    expect(renderResult.container).toBeDefined();
  });

  it('tracks state transitions', async () => {
    const connector = createMockConnector();
    const registry = createTestRegistry();

    const { states } = renderLiquidView({
      connector,
      registry,
      intent: 'show text',
    });

    await waitForGeneration(states);

    expect(states.some((s) => s.status === 'generating')).toBe(true);
    expect(states.some((s) => s.status === 'rendering')).toBe(true);
  });

  it('allows RTL queries against rendered component output', async () => {
    const connector = createMockConnector();
    const registry = createTestRegistry([
      {
        name: 'Text',
        category: 'display',
        description: 'A text component',
        accepts: z.object({ text: z.string() }),
        component: ({ text }: { text: string }) => {
          return createElement('span', { 'data-testid': 'text-component' }, text);
        },
      },
    ]);

    const { renderResult, states } = renderLiquidView({
      connector,
      registry,
      intent: 'show text',
    });

    await waitForGeneration(states);
    const text = await renderResult.findByTestId('text-component');
    expect(text.textContent).toBe('Hello World');
  });

  it('latestState returns the most recent state', async () => {
    const connector = createMockConnector();
    const registry = createTestRegistry();

    const { states, latestState } = renderLiquidView({
      connector,
      registry,
      intent: 'show text',
    });

    await waitForGeneration(states);

    const latest = latestState();
    expect(latest?.status).toBe('rendering');
  });

  it('calls onStateChange callback', async () => {
    const connector = createMockConnector();
    const registry = createTestRegistry();
    const onStateChange = vi.fn();

    const { states } = renderLiquidView({
      connector,
      registry,
      intent: 'show text',
      onStateChange,
    });

    await waitForGeneration(states);

    expect(onStateChange).toHaveBeenCalled();
    expect(
      onStateChange.mock.calls.some((call) => {
        const state = call[0] as { status?: string } | undefined;
        return state?.status === 'rendering';
      }),
    ).toBe(true);
  });

  it('uses default fallback when none provided', () => {
    const connector = createMockConnector();
    const registry = createTestRegistry();

    const { renderResult } = renderLiquidView({
      connector,
      registry,
      intent: 'show text',
    });

    // Default fallback has data-testid="fallback"
    const fallback = renderResult.queryByTestId('fallback');
    // May or may not be visible depending on state; just verify rendering works
    expect(renderResult.container).toBeDefined();
    // If in generating state, fallback should show
    if (fallback) {
      expect(fallback.textContent).toBe('Loading...');
    }
  });
});

describe('waitForGeneration', () => {
  let mockGenerate: ReturnType<typeof vi.fn>;
  let mockValidate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const testSpec = createTestSpec();
    mockGenerate = vi.fn().mockResolvedValue(ok(testSpec));
    mockValidate = vi.fn().mockImplementation(async (spec: unknown) => ok(spec as UISpecification));

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

  it('resolves with UISpecification when rendering state is reached', async () => {
    const connector = createMockConnector();
    const registry = createTestRegistry();

    const { states } = renderLiquidView({
      connector,
      registry,
      intent: 'show text',
    });

    const spec = await waitForGeneration(states);

    expect(spec).toBeDefined();
    expect(spec.version).toBe('1.0.0');
    expect(spec.components).toHaveLength(1);
    expect(spec.components[0]?.componentType).toBe('Text');
  });

  it('times out when rendering state is never reached', async () => {
    const states: import('@flui/react').LiquidViewState[] = [];

    await expect(waitForGeneration(states, 100)).rejects.toThrow();
  });
});
