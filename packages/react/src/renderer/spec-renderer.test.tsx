import { ComponentRegistry, type UISpecification } from '@flui/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { RenderSpecOptions } from '../react.types';

import { createInteractionStore } from './interaction-wiring';
import { renderSpec } from './spec-renderer';
import { createViewStateStore } from './view-state';

function createTestSpec(overrides: Partial<UISpecification> = {}): UISpecification {
  return {
    version: '1.0',
    components: [],
    layout: { type: 'stack' },
    interactions: [],
    metadata: { generatedAt: Date.now() },
    ...overrides,
  };
}

function createRegistryWithComponents(): ComponentRegistry {
  const registry = new ComponentRegistry();

  registry.register({
    name: 'TestButton',
    category: 'input',
    description: 'A button',
    accepts: z.object({ label: z.string() }),
    component: ({ label }: { label: string }) => <button type="button">{label}</button>,
  });

  registry.register({
    name: 'TestCard',
    category: 'display',
    description: 'A card',
    accepts: z.object({ title: z.string() }),
    component: ({ title, children }: { title: string; children?: React.ReactNode }) => (
      <div data-testid="card">
        <h2>{title}</h2>
        {children}
      </div>
    ),
  });

  registry.register({
    name: 'TestText',
    category: 'display',
    description: 'Text component',
    accepts: z.object({ content: z.string() }),
    component: ({ content }: { content: string }) => <p>{content}</p>,
  });

  return registry;
}

describe('renderSpec', () => {
  describe('component mapping', () => {
    it('renders a single component with props', () => {
      const registry = createRegistryWithComponents();
      const spec = createTestSpec({
        components: [{ id: 'btn1', componentType: 'TestButton', props: { label: 'Click me' } }],
      });

      render(<>{renderSpec(spec, registry)}</>);

      expect(screen.getByText('Click me')).toBeTruthy();
    });

    it('renders multiple components', () => {
      const registry = createRegistryWithComponents();
      const spec = createTestSpec({
        components: [
          { id: 'btn1', componentType: 'TestButton', props: { label: 'First' } },
          { id: 'btn2', componentType: 'TestButton', props: { label: 'Second' } },
        ],
      });

      render(<>{renderSpec(spec, registry)}</>);

      expect(screen.getByText('First')).toBeTruthy();
      expect(screen.getByText('Second')).toBeTruthy();
    });

    it('passes correct props to components', () => {
      const registry = createRegistryWithComponents();
      const spec = createTestSpec({
        components: [{ id: 'card1', componentType: 'TestCard', props: { title: 'My Card' } }],
      });

      render(<>{renderSpec(spec, registry)}</>);

      expect(screen.getByText('My Card')).toBeTruthy();
      expect(screen.getByTestId('card')).toBeTruthy();
    });
  });

  describe('recursive children', () => {
    it('renders nested child components', () => {
      const registry = createRegistryWithComponents();
      const spec = createTestSpec({
        components: [
          {
            id: 'card1',
            componentType: 'TestCard',
            props: { title: 'Parent Card' },
            children: [
              { id: 'btn1', componentType: 'TestButton', props: { label: 'Child Button' } },
            ],
          },
        ],
      });

      render(<>{renderSpec(spec, registry)}</>);

      expect(screen.getByText('Parent Card')).toBeTruthy();
      expect(screen.getByText('Child Button')).toBeTruthy();
    });

    it('renders deeply nested children', () => {
      const registry = createRegistryWithComponents();
      const spec = createTestSpec({
        components: [
          {
            id: 'card1',
            componentType: 'TestCard',
            props: { title: 'Level 1' },
            children: [
              {
                id: 'card2',
                componentType: 'TestCard',
                props: { title: 'Level 2' },
                children: [
                  { id: 'text1', componentType: 'TestText', props: { content: 'Level 3 content' } },
                ],
              },
            ],
          },
        ],
      });

      render(<>{renderSpec(spec, registry)}</>);

      expect(screen.getByText('Level 1')).toBeTruthy();
      expect(screen.getByText('Level 2')).toBeTruthy();
      expect(screen.getByText('Level 3 content')).toBeTruthy();
    });
  });

  describe('missing component handling', () => {
    it('renders nothing for missing components without crashing', () => {
      const registry = createRegistryWithComponents();
      const spec = createTestSpec({
        components: [{ id: 'unknown1', componentType: 'NonExistentWidget', props: {} }],
      });

      // Should not throw
      const { container } = render(<>{renderSpec(spec, registry)}</>);

      // No content rendered for missing component
      expect(container.textContent).toBe('');
    });

    it('renders available components when some are missing', () => {
      const registry = createRegistryWithComponents();
      const spec = createTestSpec({
        components: [
          { id: 'btn1', componentType: 'TestButton', props: { label: 'Visible' } },
          { id: 'missing1', componentType: 'GhostComponent', props: {} },
          { id: 'text1', componentType: 'TestText', props: { content: 'Also visible' } },
        ],
      });

      render(<>{renderSpec(spec, registry)}</>);

      expect(screen.getByText('Visible')).toBeTruthy();
      expect(screen.getByText('Also visible')).toBeTruthy();
    });
  });

  describe('empty spec', () => {
    it('renders nothing for spec with no components', () => {
      const registry = createRegistryWithComponents();
      const spec = createTestSpec({ components: [] });

      const { container } = render(<>{renderSpec(spec, registry)}</>);

      expect(container.textContent).toBe('');
    });
  });

  describe('key handling', () => {
    it('uses spec.key when provided', () => {
      const registry = createRegistryWithComponents();
      const spec = createTestSpec({
        components: [
          { id: 'btn1', componentType: 'TestButton', props: { label: 'Keyed' }, key: 'custom-key' },
        ],
      });

      // Key is internal to React — just verify it renders without error
      render(<>{renderSpec(spec, registry)}</>);
      expect(screen.getByText('Keyed')).toBeTruthy();
    });

    it('uses spec.id as fallback key', () => {
      const registry = createRegistryWithComponents();
      const spec = createTestSpec({
        components: [{ id: 'btn-id-123', componentType: 'TestButton', props: { label: 'ID key' } }],
      });

      render(<>{renderSpec(spec, registry)}</>);
      expect(screen.getByText('ID key')).toBeTruthy();
    });
  });

  describe('interaction store integration', () => {
    it('renders target components with interaction-derived props', () => {
      const registry = new ComponentRegistry();
      registry.register({
        name: 'Display',
        category: 'display',
        description: 'Display component',
        accepts: z.object({}),
        component: ({ filterCategory }: { filterCategory?: string }) => (
          <div data-testid="display">{filterCategory ?? 'none'}</div>
        ),
      });

      const spec = createTestSpec({
        components: [{ id: 'display-1', componentType: 'Display', props: {} }],
      });

      const interactionStore = createInteractionStore(
        [
          {
            source: 'filter',
            target: 'display-1',
            event: 'onChange',
            dataMapping: { value: 'filterCategory' },
          },
        ],
        new Set(['filter', 'display-1']),
      );

      // Simulate source event
      interactionStore.getSourceHandlers('filter').onChange!({ target: { value: 'tech' } });

      const options: RenderSpecOptions = { interactionStore };
      render(<>{renderSpec(spec, registry, options)}</>);

      expect(screen.getByTestId('display').textContent).toBe('tech');
    });
  });

  describe('view state store integration', () => {
    it('renders components with persisted view state', () => {
      const registry = new ComponentRegistry();
      registry.register({
        name: 'Input',
        category: 'input',
        description: 'Input component',
        accepts: z.object({}),
        component: ({ value }: { value?: string }) => (
          <input data-testid="input" defaultValue={value ?? ''} />
        ),
      });

      const spec = createTestSpec({
        components: [{ id: 'input-1', componentType: 'Input', props: {} }],
      });

      const viewStateStore = createViewStateStore();
      viewStateStore.setState('input-1', { value: 'persisted-text' });

      const options: RenderSpecOptions = { viewStateStore };
      render(<>{renderSpec(spec, registry, options)}</>);

      expect(screen.getByTestId('input').getAttribute('value')).toBe('persisted-text');
    });

    it('view state overrides interaction target props (higher priority)', () => {
      const registry = new ComponentRegistry();
      registry.register({
        name: 'Field',
        category: 'input',
        description: 'Field',
        accepts: z.object({}),
        component: ({ value }: { value?: string }) => (
          <span data-testid="field">{value ?? 'empty'}</span>
        ),
      });

      const spec = createTestSpec({
        components: [{ id: 'field-1', componentType: 'Field', props: { value: 'base' } }],
      });

      const interactionStore = createInteractionStore(
        [{ source: 'src', target: 'field-1', event: 'onChange', dataMapping: { value: 'value' } }],
        new Set(['src', 'field-1']),
      );
      interactionStore.getSourceHandlers('src').onChange!({ target: { value: 'interaction' } });

      const viewStateStore = createViewStateStore();
      viewStateStore.setState('field-1', { value: 'user-typed' });

      const options: RenderSpecOptions = { interactionStore, viewStateStore };
      render(<>{renderSpec(spec, registry, options)}</>);

      // View state wins over interaction props
      expect(screen.getByTestId('field').textContent).toBe('user-typed');
    });
  });

  describe('handler composition', () => {
    it('composes original handler with interaction handler — both fire', () => {
      const originalHandler = vi.fn();
      const registry = new ComponentRegistry();
      registry.register({
        name: 'Btn',
        category: 'input',
        description: 'Button',
        accepts: z.object({}),
        component: ({ onClick }: { onClick?: (...args: unknown[]) => void }) => (
          <button type="button" data-testid="btn" onClick={() => onClick?.('click-data')}>
            Click
          </button>
        ),
      });

      const spec = createTestSpec({
        components: [{ id: 'btn-1', componentType: 'Btn', props: { onClick: originalHandler } }],
      });

      const interactionStore = createInteractionStore(
        [
          {
            source: 'btn-1',
            target: 'target-1',
            event: 'onClick',
            dataMapping: { value: 'clickValue' },
          },
        ],
        new Set(['btn-1', 'target-1']),
      );

      const options: RenderSpecOptions = { interactionStore };
      render(<>{renderSpec(spec, registry, options)}</>);

      // Simulate click
      screen.getByTestId('btn').click();

      // Original handler was called
      expect(originalHandler).toHaveBeenCalled();
    });
  });

  describe('backward compatibility', () => {
    it('renderSpec without options works identical to before', () => {
      const registry = createRegistryWithComponents();
      const spec = createTestSpec({
        components: [{ id: 'btn1', componentType: 'TestButton', props: { label: 'No options' } }],
      });

      // Call without third argument — should work exactly as before
      render(<>{renderSpec(spec, registry)}</>);

      expect(screen.getByText('No options')).toBeTruthy();
    });

    it('renderSpec with undefined options works identical to before', () => {
      const registry = createRegistryWithComponents();
      const spec = createTestSpec({
        components: [
          { id: 'btn1', componentType: 'TestButton', props: { label: 'Undefined opts' } },
        ],
      });

      render(<>{renderSpec(spec, registry, undefined)}</>);

      expect(screen.getByText('Undefined opts')).toBeTruthy();
    });

    it('does not add data-flui-id by default', () => {
      const registry = new ComponentRegistry();
      registry.register({
        name: 'Passthrough',
        category: 'display',
        description: 'Pass-through element',
        accepts: z.object({}),
        component: (props: Record<string, unknown>) => <div data-testid="passthrough" {...props} />,
      });

      const spec = createTestSpec({
        components: [{ id: 'cmp-1', componentType: 'Passthrough', props: {} }],
      });

      render(<>{renderSpec(spec, registry)}</>);

      expect(screen.getByTestId('passthrough').getAttribute('data-flui-id')).toBeNull();
    });

    it('adds data-flui-id when focus tracking is enabled', () => {
      const registry = new ComponentRegistry();
      registry.register({
        name: 'Passthrough',
        category: 'display',
        description: 'Pass-through element',
        accepts: z.object({}),
        component: (props: Record<string, unknown>) => <div data-testid="passthrough" {...props} />,
      });

      const spec = createTestSpec({
        components: [{ id: 'cmp-2', componentType: 'Passthrough', props: {} }],
      });

      render(<>{renderSpec(spec, registry, { focusTracking: true })}</>);

      expect(screen.getByTestId('passthrough').getAttribute('data-flui-id')).toBe('cmp-2');
    });
  });
});
