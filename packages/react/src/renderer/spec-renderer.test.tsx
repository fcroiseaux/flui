import { ComponentRegistry, type UISpecification } from '@flui/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { renderSpec } from './spec-renderer';

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
    component: ({ label }: { label: string }) => <button>{label}</button>,
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
        components: [
          { id: 'btn1', componentType: 'TestButton', props: { label: 'Click me' } },
        ],
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
        components: [
          { id: 'card1', componentType: 'TestCard', props: { title: 'My Card' } },
        ],
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
        components: [
          { id: 'unknown1', componentType: 'NonExistentWidget', props: {} },
        ],
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
        components: [
          { id: 'btn-id-123', componentType: 'TestButton', props: { label: 'ID key' } },
        ],
      });

      render(<>{renderSpec(spec, registry)}</>);
      expect(screen.getByText('ID key')).toBeTruthy();
    });
  });
});
