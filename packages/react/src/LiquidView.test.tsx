import {
  ComponentRegistry,
  err,
  FLUI_E010,
  FLUI_E020,
  FluiError,
  ok,
  type GenerationOrchestrator,
  type UISpecification,
  type ValidationPipeline,
} from '@flui/core';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { FluiProvider } from './FluiProvider';
import { LiquidView } from './LiquidView';
import type { FluiReactConfig, LiquidViewState } from './react.types';

// Mock @flui/core generation and validation modules
vi.mock('@flui/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@flui/core')>();
  return {
    ...original,
    createGenerationOrchestrator: vi.fn(),
    createValidationPipeline: vi.fn(),
  };
});

const mockCreateOrchestrator = vi.mocked(
  (await import('@flui/core')).createGenerationOrchestrator,
);
const mockCreatePipeline = vi.mocked(
  (await import('@flui/core')).createValidationPipeline,
);

function TestButton({ label }: { label: string }) {
  return <button data-testid="rendered-button">{label}</button>;
}

function TestText({ content }: { content: string }) {
  return <p data-testid="rendered-text">{content}</p>;
}

function createTestRegistry(): ComponentRegistry {
  const registry = new ComponentRegistry();
  registry.register({
    name: 'TestButton',
    category: 'input',
    description: 'A test button',
    accepts: z.object({ label: z.string() }),
    component: TestButton,
  });
  registry.register({
    name: 'TestText',
    category: 'display',
    description: 'A test text',
    accepts: z.object({ content: z.string() }),
    component: TestText,
  });
  return registry;
}

function createTestSpec(): UISpecification {
  return {
    version: '1.0',
    components: [
      { id: 'btn1', componentType: 'TestButton', props: { label: 'Generated Button' } },
    ],
    layout: { type: 'stack' },
    interactions: [],
    metadata: { generatedAt: Date.now() },
  };
}

function createMockConfig(): FluiReactConfig {
  return {
    generationConfig: {
      connector: {
        generate: vi.fn().mockResolvedValue(ok({
          content: '{}',
          model: 'test-model',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })),
      },
      model: 'test-model',
    },
  };
}

describe('LiquidView', () => {
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

  describe('fallback rendering', () => {
    it('renders nothing in idle state (no intent)', () => {
      const registry = createTestRegistry();

      render(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView fallback={<div data-testid="fallback">Loading...</div>} />
        </FluiProvider>,
      );

      expect(screen.queryByTestId('fallback')).toBeNull();
      expect(screen.queryByTestId('rendered-button')).toBeNull();
    });

    it('renders fallback during generating state', async () => {
      const registry = createTestRegistry();

      // Make generation hang
      mockGenerate.mockImplementation(() => new Promise(() => {}));

      render(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView
            intent="show a button"
            fallback={<div data-testid="fallback">Loading...</div>}
          />
        </FluiProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('fallback')).toBeTruthy();
      });
    });

    it('renders fallback during error state', async () => {
      const registry = createTestRegistry();
      mockGenerate.mockResolvedValue(
        err(new FluiError(FLUI_E010, 'generation', 'Generation failed')),
      );

      render(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView
            intent="show a button"
            fallback={<div data-testid="fallback">Error occurred</div>}
          />
        </FluiProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('fallback')).toBeTruthy();
      });
    });

    it('renders generated component after successful generation', async () => {
      const registry = createTestRegistry();

      render(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView
            intent="show a button"
            fallback={<div data-testid="fallback">Loading...</div>}
          />
        </FluiProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('rendered-button')).toBeTruthy();
      });

      expect(screen.getByText('Generated Button')).toBeTruthy();
      expect(screen.queryByTestId('fallback')).toBeNull();
    });
  });

  describe('state progression', () => {
    it('progresses through states in order', async () => {
      const registry = createTestRegistry();
      const states: string[] = [];
      const onStateChange = (state: LiquidViewState) => states.push(state.status);

      render(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView
            intent="show a button"
            fallback={<div>Loading</div>}
            onStateChange={onStateChange}
          />
        </FluiProvider>,
      );

      await waitFor(() => {
        expect(states).toContain('rendering');
      });

      const genIdx = states.indexOf('generating');
      const valIdx = states.indexOf('validating');
      const renIdx = states.indexOf('rendering');
      expect(genIdx).toBeLessThan(valIdx);
      expect(valIdx).toBeLessThan(renIdx);
    });
  });

  describe('error → fallback for all failure modes', () => {
    it('shows fallback on LLM timeout error', async () => {
      const registry = createTestRegistry();
      mockGenerate.mockResolvedValue(
        err(new FluiError(FLUI_E010, 'generation', 'LLM request timed out')),
      );

      render(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView
            intent="show a button"
            fallback={<div data-testid="fallback">Fallback</div>}
          />
        </FluiProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('fallback')).toBeTruthy();
      });
    });

    it('shows fallback on network error', async () => {
      const registry = createTestRegistry();
      mockGenerate.mockResolvedValue(
        err(new FluiError(FLUI_E010, 'generation', 'Network error: Failed to fetch')),
      );

      render(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView
            intent="show a button"
            fallback={<div data-testid="fallback">Fallback</div>}
          />
        </FluiProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('fallback')).toBeTruthy();
      });
    });

    it('shows fallback on rate limit error', async () => {
      const registry = createTestRegistry();
      mockGenerate.mockResolvedValue(
        err(new FluiError(FLUI_E010, 'generation', 'Rate limit exceeded')),
      );

      render(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView
            intent="show a button"
            fallback={<div data-testid="fallback">Fallback</div>}
          />
        </FluiProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('fallback')).toBeTruthy();
      });
    });

    it('shows fallback on malformed response', async () => {
      const registry = createTestRegistry();
      mockGenerate.mockResolvedValue(
        err(new FluiError(FLUI_E010, 'generation', 'Malformed LLM response')),
      );

      render(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView
            intent="show a button"
            fallback={<div data-testid="fallback">Fallback</div>}
          />
        </FluiProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('fallback')).toBeTruthy();
      });
    });

    it('shows fallback on validation failure', async () => {
      const registry = createTestRegistry();
      mockValidate.mockResolvedValue(
        err(new FluiError(FLUI_E020, 'validation', 'Validation failed')),
      );

      render(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView
            intent="show a button"
            fallback={<div data-testid="fallback">Fallback</div>}
          />
        </FluiProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('fallback')).toBeTruthy();
      });
    });
  });

  describe('error callback', () => {
    it('calls onError when generation fails', async () => {
      const registry = createTestRegistry();
      const genError = new FluiError(FLUI_E010, 'generation', 'Generation broke');
      mockGenerate.mockResolvedValue(err(genError));
      const onError = vi.fn();

      render(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView
            intent="show a button"
            fallback={<div>Fallback</div>}
            onError={onError}
          />
        </FluiProvider>,
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(genError);
      });
    });
  });

  describe('spec rendering', () => {
    it('maps ComponentSpec to registered React components with correct props', async () => {
      const registry = createTestRegistry();
      const multiSpec: UISpecification = {
        version: '1.0',
        components: [
          { id: 'btn1', componentType: 'TestButton', props: { label: 'Hello' } },
          { id: 'txt1', componentType: 'TestText', props: { content: 'World' } },
        ],
        layout: { type: 'stack' },
        interactions: [],
        metadata: { generatedAt: Date.now() },
      };
      mockGenerate.mockResolvedValue(ok(multiSpec));
      mockValidate.mockResolvedValue(ok(multiSpec));

      render(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView
            intent="show content"
            fallback={<div>Loading</div>}
          />
        </FluiProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('rendered-button')).toBeTruthy();
      });

      expect(screen.getByText('Hello')).toBeTruthy();
      expect(screen.getByText('World')).toBeTruthy();
      expect(screen.getByTestId('rendered-text')).toBeTruthy();
    });
  });

  describe('wrapper element', () => {
    it('applies className and style props to wrapper div', async () => {
      const registry = createTestRegistry();

      render(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView
            intent="show a button"
            fallback={<div>Loading</div>}
            className="custom-class"
            style={{ padding: '16px' }}
          />
        </FluiProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('rendered-button')).toBeTruthy();
      });

      const wrapper = screen.getByTestId('rendered-button').parentElement;
      expect(wrapper?.className).toBe('custom-class');
      expect(wrapper?.style.padding).toBe('16px');
    });

    it('does not render wrapper div when no className or style', async () => {
      const registry = createTestRegistry();

      const { container } = render(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView
            intent="show a button"
            fallback={<div>Loading</div>}
          />
        </FluiProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('rendered-button')).toBeTruthy();
      });

      // The button should be a direct child, no extra wrapper div
      const button = screen.getByTestId('rendered-button');
      expect(button.parentElement).toBe(container);
    });
  });

  describe('FluiProvider requirement', () => {
    it('throws when LiquidView is used outside FluiProvider', () => {
      const originalError = console.error;
      console.error = () => {};

      expect(() =>
        render(
          <LiquidView
            intent="show a button"
            fallback={<div>Fallback</div>}
          />,
        ),
      ).toThrow('useFluiContext must be used within a FluiProvider');

      console.error = originalError;
    });
  });
});
