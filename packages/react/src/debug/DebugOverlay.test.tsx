import type { UISpecification } from '@flui/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DebugOverlay } from './DebugOverlay';
import type { DebugOverlayProps } from './debug.types';

function createDefaultProps(overrides?: Partial<DebugOverlayProps>): DebugOverlayProps {
  return {
    spec: null,
    traces: [],
    ...overrides,
  };
}

function createMockSpec(): UISpecification {
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
    interactions: [],
    metadata: { generatedAt: 1700000000000 },
  };
}

describe('DebugOverlay', () => {
  describe('overlay rendering', () => {
    it('renders with two tabs (Spec and Trace)', () => {
      render(<DebugOverlay {...createDefaultProps()} />);
      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(2);
      expect(tabs[0]?.textContent).toBe('Spec');
      expect(tabs[1]?.textContent).toBe('Trace');
    });

    it('defaults to Spec tab active', () => {
      render(<DebugOverlay {...createDefaultProps()} />);
      const specTab = screen.getByRole('tab', { name: 'Spec' });
      expect(specTab.getAttribute('aria-selected')).toBe('true');
      const traceTab = screen.getByRole('tab', { name: 'Trace' });
      expect(traceTab.getAttribute('aria-selected')).toBe('false');
    });

    it('switches tabs on click', () => {
      render(<DebugOverlay {...createDefaultProps()} />);
      const traceTab = screen.getByRole('tab', { name: 'Trace' });
      fireEvent.click(traceTab);
      expect(traceTab.getAttribute('aria-selected')).toBe('true');
      expect(screen.getByRole('tab', { name: 'Spec' }).getAttribute('aria-selected')).toBe('false');
    });

    it('respects defaultTab prop', () => {
      render(<DebugOverlay {...createDefaultProps({ defaultTab: 'trace' })} />);
      expect(screen.getByRole('tab', { name: 'Trace' }).getAttribute('aria-selected')).toBe('true');
      expect(screen.getByRole('tab', { name: 'Spec' }).getAttribute('aria-selected')).toBe('false');
    });

    it('does not render when isOpen is false', () => {
      render(<DebugOverlay {...createDefaultProps({ isOpen: false })} />);
      expect(screen.queryByRole('tablist')).toBeNull();
    });

    it('renders when isOpen is true', () => {
      render(<DebugOverlay {...createDefaultProps({ isOpen: true })} />);
      expect(screen.getByRole('tablist')).toBeTruthy();
    });

    it('has data-flui-debug attribute on root', () => {
      const { container } = render(<DebugOverlay {...createDefaultProps()} />);
      expect(container.querySelector('[data-flui-debug]')).toBeTruthy();
    });
  });

  describe('keyboard navigation', () => {
    it('Arrow Right switches from Spec to Trace', () => {
      render(<DebugOverlay {...createDefaultProps()} />);
      const specTab = screen.getByRole('tab', { name: 'Spec' });
      fireEvent.keyDown(specTab, { key: 'ArrowRight' });
      expect(screen.getByRole('tab', { name: 'Trace' }).getAttribute('aria-selected')).toBe('true');
    });

    it('Arrow Left switches from Trace to Spec', () => {
      render(<DebugOverlay {...createDefaultProps({ defaultTab: 'trace' })} />);
      const traceTab = screen.getByRole('tab', { name: 'Trace' });
      fireEvent.keyDown(traceTab, { key: 'ArrowLeft' });
      expect(screen.getByRole('tab', { name: 'Spec' }).getAttribute('aria-selected')).toBe('true');
    });

    it('Arrow Right wraps from Trace back to Spec', () => {
      render(<DebugOverlay {...createDefaultProps({ defaultTab: 'trace' })} />);
      const traceTab = screen.getByRole('tab', { name: 'Trace' });
      fireEvent.keyDown(traceTab, { key: 'ArrowRight' });
      expect(screen.getByRole('tab', { name: 'Spec' }).getAttribute('aria-selected')).toBe('true');
    });

    it('Arrow Left wraps from Spec back to Trace', () => {
      render(<DebugOverlay {...createDefaultProps()} />);
      const specTab = screen.getByRole('tab', { name: 'Spec' });
      fireEvent.keyDown(specTab, { key: 'ArrowLeft' });
      expect(screen.getByRole('tab', { name: 'Trace' }).getAttribute('aria-selected')).toBe('true');
    });

    it('Tab moves focus into active panel content', () => {
      render(<DebugOverlay {...createDefaultProps({ spec: createMockSpec() })} />);
      const specTab = screen.getByRole('tab', { name: 'Spec' });
      specTab.focus();
      fireEvent.keyDown(specTab, { key: 'Tab' });

      expect(document.activeElement?.textContent).toBe('Metadata');
    });
  });

  describe('accessibility', () => {
    it('tabs have role="tab" and aria-selected', () => {
      render(<DebugOverlay {...createDefaultProps()} />);
      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(2);
      for (const tab of tabs) {
        expect(tab.getAttribute('aria-selected')).toBeTruthy();
      }
    });

    it('tab panels have role="tabpanel" and aria-labelledby', () => {
      render(<DebugOverlay {...createDefaultProps()} />);
      const panels = screen.getAllByRole('tabpanel', { hidden: true });
      expect(panels).toHaveLength(2);
      expect(panels[0]?.getAttribute('aria-labelledby')).toBe('flui-debug-tab-spec');
      expect(panels[1]?.getAttribute('aria-labelledby')).toBe('flui-debug-tab-trace');
    });

    it('tablist has role="tablist" with aria-label', () => {
      render(<DebugOverlay {...createDefaultProps()} />);
      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeTruthy();
      expect(tablist.getAttribute('aria-label')).toBe('Debug overlay tabs');
    });

    it('collapse button has aria-expanded', () => {
      render(<DebugOverlay {...createDefaultProps()} />);
      const collapseBtn = screen.getByLabelText('Collapse debug overlay');
      expect(collapseBtn.getAttribute('aria-expanded')).toBe('true');
    });

    it('tabs have aria-controls linking to panel ids', () => {
      render(<DebugOverlay {...createDefaultProps()} />);
      const specTab = screen.getByRole('tab', { name: 'Spec' });
      const traceTab = screen.getByRole('tab', { name: 'Trace' });
      expect(specTab.getAttribute('aria-controls')).toBe('flui-debug-panel-spec');
      expect(traceTab.getAttribute('aria-controls')).toBe('flui-debug-panel-trace');
    });

    it('inactive tab has tabIndex -1', () => {
      render(<DebugOverlay {...createDefaultProps()} />);
      const traceTab = screen.getByRole('tab', { name: 'Trace' });
      expect(traceTab.getAttribute('tabindex')).toBe('-1');
    });

    it('active tab has tabIndex 0', () => {
      render(<DebugOverlay {...createDefaultProps()} />);
      const specTab = screen.getByRole('tab', { name: 'Spec' });
      expect(specTab.getAttribute('tabindex')).toBe('0');
    });
  });

  describe('collapse/expand', () => {
    it('collapses overlay when toggle button clicked', () => {
      render(<DebugOverlay {...createDefaultProps()} />);
      const collapseBtn = screen.getByLabelText('Collapse debug overlay');
      fireEvent.click(collapseBtn);
      const expandBtn = screen.getByLabelText('Expand debug overlay');
      expect(expandBtn.getAttribute('aria-expanded')).toBe('false');
    });

    it('calls onToggle when collapse state changes', () => {
      const onToggle = vi.fn();
      render(<DebugOverlay {...createDefaultProps({ onToggle })} />);
      const collapseBtn = screen.getByLabelText('Collapse debug overlay');
      fireEvent.click(collapseBtn);
      expect(onToggle).toHaveBeenCalledWith(false);
    });
  });
});
