import {
  ComponentRegistry,
  err,
  FLUI_E010,
  FLUI_E020,
  FluiError,
  type GenerationOrchestrator,
  ok,
  type UISpecification,
  type ValidationPipeline,
} from '@flui/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const mockCreateOrchestrator = vi.mocked((await import('@flui/core')).createGenerationOrchestrator);
const mockCreatePipeline = vi.mocked((await import('@flui/core')).createValidationPipeline);

function TestButton({ label }: { label: string }) {
  return (
    <button data-testid="rendered-button" type="button">
      {label}
    </button>
  );
}

function TestText({ content }: { content: string }) {
  return <p data-testid="rendered-text">{content}</p>;
}

function TestDisplay({ filterCategory, data }: { filterCategory?: string; data?: unknown }) {
  return (
    <div data-testid="display" data-filter={filterCategory ?? ''} data-data={String(data ?? '')} />
  );
}

function TestInput({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
}) {
  return (
    <input
      data-testid="input"
      value={value ?? ''}
      onChange={(e) => onChange?.(e as unknown as { target: { value: string } })}
      readOnly
    />
  );
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
    components: [{ id: 'btn1', componentType: 'TestButton', props: { label: 'Generated Button' } }],
    layout: { type: 'stack' },
    interactions: [],
    metadata: { generatedAt: Date.now() },
  };
}

function createMockConfig(): FluiReactConfig {
  return {
    generationConfig: {
      connector: {
        generate: vi.fn().mockResolvedValue(
          ok({
            content: '{}',
            model: 'test-model',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          }),
        ),
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
      validateWithRetry: mockValidate,
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

      // After transition completes, fallback is removed from the active content.
      // With crossfade, the exiting fallback may still be in DOM briefly — wait for cleanup.
      await waitFor(() => {
        // The fallback should no longer be visible once transition completes
        const fallbackEl = screen.queryByTestId('fallback');
        if (fallbackEl) {
          // If still present, it should be in the exiting (aria-hidden) layer
          expect(fallbackEl.closest('[aria-hidden="true"]')).toBeTruthy();
        }
      });
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
          <LiquidView intent="show a button" fallback={<div>Fallback</div>} onError={onError} />
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
          <LiquidView intent="show content" fallback={<div>Loading</div>} />
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

      // The container div (data-flui-container) receives className and style
      const container = screen.getByTestId('rendered-button').closest('[data-flui-container]');
      expect(container).toBeTruthy();
      expect((container as HTMLElement).className).toBe('custom-class');
      expect((container as HTMLElement).style.padding).toBe('16px');
    });

    it('always renders container div even when no className or style', async () => {
      const registry = createTestRegistry();

      render(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView intent="show a button" fallback={<div>Loading</div>} />
        </FluiProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('rendered-button')).toBeTruthy();
      });

      // The button should be inside the container div (needed for transitions, focus, ARIA)
      const button = screen.getByTestId('rendered-button');
      const container = button.closest('[data-flui-container]');
      expect(container).toBeTruthy();
    });
  });

  describe('FluiProvider requirement', () => {
    it('throws when LiquidView is used outside FluiProvider', () => {
      const originalError = console.error;
      console.error = () => {};

      expect(() =>
        render(<LiquidView intent="show a button" fallback={<div>Fallback</div>} />),
      ).toThrow('useFluiContext must be used within a FluiProvider');

      console.error = originalError;
    });
  });

  describe('interaction wiring end-to-end', () => {
    it('propagates source input changes to target component props', async () => {
      const registry = new ComponentRegistry();
      registry.register({
        name: 'Display',
        category: 'display',
        description: 'Display component',
        accepts: z.object({}),
        component: TestDisplay,
      });
      registry.register({
        name: 'Filter',
        category: 'input',
        description: 'Filter component',
        accepts: z.object({}),
        component: TestInput,
      });

      const specWithInteractions: UISpecification = {
        version: '1.0',
        components: [
          { id: 'filter-1', componentType: 'Filter', props: {} },
          { id: 'display-1', componentType: 'Display', props: {} },
        ],
        layout: { type: 'stack' },
        interactions: [
          {
            source: 'filter-1',
            target: 'display-1',
            event: 'onChange',
            dataMapping: { value: 'filterCategory' },
          },
        ],
        metadata: { generatedAt: Date.now() },
      };

      mockGenerate.mockResolvedValue(ok(specWithInteractions));
      mockValidate.mockResolvedValue(ok(specWithInteractions));

      render(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView intent="show filter and display" fallback={<div>Loading</div>} />
        </FluiProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('display')).toBeTruthy();
      });

      fireEvent.change(screen.getByTestId('input'), { target: { value: 'electronics' } });

      await waitFor(() => {
        expect(screen.getByTestId('display').getAttribute('data-filter')).toBe('electronics');
      });
    });
  });

  describe('missing interaction component handling', () => {
    it('does not crash when interaction references missing component', async () => {
      const registry = createTestRegistry();

      const specWithBadInteraction: UISpecification = {
        version: '1.0',
        components: [{ id: 'btn1', componentType: 'TestButton', props: { label: 'Good button' } }],
        layout: { type: 'stack' },
        interactions: [{ source: 'missing-src', target: 'btn1', event: 'onClick' }],
        metadata: { generatedAt: Date.now() },
      };

      mockGenerate.mockResolvedValue(ok(specWithBadInteraction));
      mockValidate.mockResolvedValue(ok(specWithBadInteraction));

      render(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView intent="show a button" fallback={<div data-testid="fallback">Loading</div>} />
        </FluiProvider>,
      );

      // Should render normally despite missing interaction component
      await waitFor(() => {
        expect(screen.getByTestId('rendered-button')).toBeTruthy();
      });

      expect(screen.getByText('Good button')).toBeTruthy();
    });
  });

  describe('view state persistence', () => {
    it('preserves user-entered state across regeneration for matching component ids', async () => {
      const registry = new ComponentRegistry();
      registry.register({
        name: 'Filter',
        category: 'input',
        description: 'Filter input',
        accepts: z.object({}),
        component: TestInput,
      });

      const firstSpec: UISpecification = {
        version: '1.0',
        components: [{ id: 'filter-1', componentType: 'Filter', props: {} }],
        layout: { type: 'stack' },
        interactions: [],
        metadata: { generatedAt: Date.now() },
      };

      const secondSpec: UISpecification = {
        version: '1.0',
        components: [{ id: 'filter-1', componentType: 'Filter', props: { value: '' } }],
        layout: { type: 'stack' },
        interactions: [],
        metadata: { generatedAt: Date.now() + 1 },
      };

      let generationCount = 0;
      mockGenerate.mockImplementation(async () => {
        generationCount += 1;
        return ok(generationCount === 1 ? firstSpec : secondSpec);
      });
      mockValidate.mockImplementation(async (spec: unknown) => ok(spec as UISpecification));

      const { rerender } = render(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView intent="show filter" fallback={<div>Loading</div>} />
        </FluiProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('input')).toBeTruthy();
      });

      fireEvent.change(screen.getByTestId('input'), { target: { value: 'saved-value' } });

      await waitFor(() => {
        expect((screen.getByTestId('input') as HTMLInputElement).value).toBe('saved-value');
      });

      rerender(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView intent="show filter updated" fallback={<div>Loading</div>} />
        </FluiProvider>,
      );

      await waitFor(() => {
        expect(generationCount).toBe(2);
      });

      await waitFor(() => {
        expect((screen.getByTestId('input') as HTMLInputElement).value).toBe('saved-value');
      });
    });
  });

  describe('transition integration', () => {
    it('applies crossfade transition on spec change', async () => {
      const registry = createTestRegistry();
      const firstSpec = createTestSpec();
      const secondSpec: UISpecification = {
        version: '1.0',
        components: [
          { id: 'txt1', componentType: 'TestText', props: { content: 'Updated content' } },
        ],
        layout: { type: 'stack' },
        interactions: [],
        metadata: { generatedAt: Date.now() + 1000 },
      };

      let generationCount = 0;
      mockGenerate.mockImplementation(async () => {
        generationCount += 1;
        return ok(generationCount === 1 ? firstSpec : secondSpec);
      });
      mockValidate.mockImplementation(async (spec: unknown) => ok(spec as UISpecification));

      const { rerender } = render(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView intent="show a button" fallback={<div>Loading</div>} />
        </FluiProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('rendered-button')).toBeTruthy();
      });

      // Trigger second generation
      rerender(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView intent="show text" fallback={<div>Loading</div>} />
        </FluiProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText('Updated content')).toBeTruthy();
      });
    });

    it('transitions disabled via config renders without crossfade wrapper', async () => {
      const registry = createTestRegistry();

      render(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView
            intent="show a button"
            fallback={<div>Loading</div>}
            transition={{ enabled: false }}
          />
        </FluiProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('rendered-button')).toBeTruthy();
      });

      // No transition wrapper should be present
      expect(screen.getByTestId('rendered-button').closest('[data-flui-transition]')).toBeNull();
    });

    it('backward compatibility: LiquidView without transition props works as before', async () => {
      const registry = createTestRegistry();

      render(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView intent="show a button" fallback={<div>Loading</div>} />
        </FluiProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('rendered-button')).toBeTruthy();
      });

      // Content renders correctly, container exists
      expect(screen.getByText('Generated Button')).toBeTruthy();
      expect(screen.getByTestId('rendered-button').closest('[data-flui-container]')).toBeTruthy();
    });

    it('shows ARIA announcement on transition', async () => {
      const registry = createTestRegistry();
      const specWithTitle: UISpecification = {
        version: '1.0',
        components: [{ id: 'btn1', componentType: 'TestButton', props: { label: 'Hello' } }],
        layout: { type: 'stack' },
        interactions: [],
        metadata: { generatedAt: Date.now(), custom: { title: 'Dashboard loaded' } },
      };

      mockGenerate.mockResolvedValue(ok(specWithTitle));
      mockValidate.mockResolvedValue(ok(specWithTitle));

      render(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView intent="show dashboard" fallback={<div>Loading</div>} />
        </FluiProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('rendered-button')).toBeTruthy();
      });

      // ARIA live region should announce the transition
      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toBeTruthy();
      expect(statusRegion.textContent).toBe('Dashboard loaded');
    });

    it('renders fallback within container on error with transitions enabled', async () => {
      const registry = createTestRegistry();
      mockGenerate.mockResolvedValue(
        err(new FluiError(FLUI_E010, 'generation', 'Generation failed')),
      );

      render(
        <FluiProvider registry={registry} config={createMockConfig()}>
          <LiquidView
            intent="show a button"
            fallback={<div data-testid="error-fb">Error fallback</div>}
          />
        </FluiProvider>,
      );

      await waitFor(() => {
        // At least one error-fb element should be present
        expect(screen.getAllByTestId('error-fb').length).toBeGreaterThan(0);
      });

      // All fallback elements should be within the data-flui-container
      const fallbacks = screen.getAllByTestId('error-fb');
      for (const fb of fallbacks) {
        expect(fb.closest('[data-flui-container]')).toBeTruthy();
      }
    });
  });
});
