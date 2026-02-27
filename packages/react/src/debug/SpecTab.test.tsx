import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { UISpecification } from '@flui/core';

import { SpecTab } from './SpecTab';

function createMockSpec(
  overrides?: Partial<UISpecification>,
): UISpecification {
  return {
    version: '1.0',
    components: [
      {
        id: 'btn-1',
        componentType: 'Button',
        props: { label: 'Click me' },
        children: [],
      },
    ],
    layout: { type: 'stack', direction: 'vertical' },
    interactions: [
      { source: 'input-1', target: 'btn-1', event: 'onChange' },
    ],
    metadata: {
      generatedAt: 1700000000000,
      model: 'gpt-4o',
      traceId: 'trace-123',
    },
    ...overrides,
  };
}

describe('SpecTab', () => {
  it('renders empty state when spec is null', () => {
    render(<SpecTab spec={null} />);
    expect(screen.getByText('No specification generated yet')).toBeTruthy();
  });

  it('renders component tree from spec', () => {
    render(<SpecTab spec={createMockSpec()} />);
    expect(screen.getByText('Button')).toBeTruthy();
    expect(screen.getByText('#btn-1')).toBeTruthy();
  });

  it('displays metadata section with model and traceId', () => {
    render(<SpecTab spec={createMockSpec()} />);
    expect(screen.getByText('trace-123')).toBeTruthy();
    // model appears in both version row and model row
    expect(screen.getAllByText('gpt-4o').length).toBeGreaterThanOrEqual(1);
  });

  it('displays interactions with source/target mapping', () => {
    render(<SpecTab spec={createMockSpec()} />);
    expect(screen.getByText('input-1')).toBeTruthy();
    expect(screen.getByText('btn-1')).toBeTruthy();
    expect(screen.getByText(/\[onChange\]/)).toBeTruthy();
  });

  it('renders collapsible sections', () => {
    const { container } = render(<SpecTab spec={createMockSpec()} />);
    const details = container.querySelectorAll('details');
    // Metadata (open), Components (open), Layout, Interactions, plus component-level details
    expect(details.length).toBeGreaterThanOrEqual(4);
  });

  it('renders nested children recursively', () => {
    const spec = createMockSpec({
      components: [
        {
          id: 'container-1',
          componentType: 'Container',
          props: {},
          children: [
            {
              id: 'nested-btn',
              componentType: 'NestedButton',
              props: { label: 'Nested' },
              children: [],
            },
          ],
        },
      ],
    });
    render(<SpecTab spec={spec} />);
    expect(screen.getByText('Container')).toBeTruthy();
    expect(screen.getByText('NestedButton')).toBeTruthy();
    expect(screen.getByText('#nested-btn')).toBeTruthy();
  });

  it('shows children count badge', () => {
    const spec = createMockSpec({
      components: [
        {
          id: 'parent',
          componentType: 'Parent',
          props: {},
          children: [
            {
              id: 'c1',
              componentType: 'Child1',
              props: {},
              children: [],
            },
            {
              id: 'c2',
              componentType: 'Child2',
              props: {},
              children: [],
            },
          ],
        },
      ],
    });
    render(<SpecTab spec={spec} />);
    expect(screen.getByText('(2 children)')).toBeTruthy();
  });

  it('displays component props as JSON', () => {
    render(<SpecTab spec={createMockSpec()} />);
    expect(screen.getByText(/"label": "Click me"/)).toBeTruthy();
  });

  it('does not render interactions section when empty', () => {
    const spec = createMockSpec({ interactions: [] });
    render(<SpecTab spec={spec} />);
    expect(screen.queryByText(/Interactions/)).toBeNull();
  });

  it('renders layout section', () => {
    render(<SpecTab spec={createMockSpec()} />);
    expect(screen.getByText('Layout')).toBeTruthy();
  });
});
