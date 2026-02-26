import type { UISpecification } from '@flui/core';
import { act, render, screen, waitFor } from '@testing-library/react';
import { type RefObject, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AriaAnnouncementConfig } from '../react.types';

import { AriaLiveRegion, useFocusManagement } from './a11y';

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

/**
 * Test harness for useFocusManagement hook.
 */
function FocusTestHarness({
  previousFocusedId,
  shouldFocus,
  children,
}: {
  previousFocusedId: string | null;
  shouldFocus: boolean;
  children?: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusManagement(containerRef, previousFocusedId, shouldFocus);
  return (
    <div ref={containerRef} data-testid="container">
      {children}
    </div>
  );
}

describe('useFocusManagement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns focus to same component by data-flui-id after transition', async () => {
    render(
      <FocusTestHarness previousFocusedId="btn-1" shouldFocus={true}>
        <button data-flui-id="btn-1" data-testid="target-button">
          Click me
        </button>
        <input data-flui-id="input-1" data-testid="other-input" />
      </FocusTestHarness>,
    );

    // Run requestAnimationFrame
    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(document.activeElement).toBe(screen.getByTestId('target-button'));
  });

  it('focuses first focusable element when previous component is gone', async () => {
    render(
      <FocusTestHarness previousFocusedId="removed-component" shouldFocus={true}>
        <button data-flui-id="btn-2" data-testid="first-button">
          First
        </button>
        <input data-flui-id="input-2" data-testid="second-input" />
      </FocusTestHarness>,
    );

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(document.activeElement).toBe(screen.getByTestId('first-button'));
  });

  it('focuses container root when no focusable elements exist', async () => {
    render(
      <FocusTestHarness previousFocusedId={null} shouldFocus={true}>
        <div data-flui-id="static-text">Non-focusable content</div>
      </FocusTestHarness>,
    );

    act(() => {
      vi.advanceTimersByTime(16);
    });

    const container = screen.getByTestId('container');
    expect(document.activeElement).toBe(container);
    expect(container.getAttribute('tabindex')).toBe('-1');
  });

  it('does NOT jump focus to document body', async () => {
    render(
      <FocusTestHarness previousFocusedId={null} shouldFocus={true}>
        <div>Non-focusable</div>
      </FocusTestHarness>,
    );

    act(() => {
      vi.advanceTimersByTime(16);
    });

    // Focus should be on container, NOT on body
    expect(document.activeElement).not.toBe(document.body);
  });

  it('does not move focus when shouldFocus is false', async () => {
    render(
      <FocusTestHarness previousFocusedId={null} shouldFocus={false}>
        <button data-testid="some-button">Button</button>
      </FocusTestHarness>,
    );

    act(() => {
      vi.advanceTimersByTime(16);
    });

    // Focus should remain on body (not moved to button or container)
    expect(document.activeElement).toBe(document.body);
  });

  it('focuses href elements as focusable', async () => {
    render(
      <FocusTestHarness previousFocusedId="gone" shouldFocus={true}>
        <a href="#test" data-testid="link">
          A link
        </a>
      </FocusTestHarness>,
    );

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(document.activeElement).toBe(screen.getByTestId('link'));
  });
});

describe('AriaLiveRegion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with correct role and aria-live attributes', () => {
    render(<AriaLiveRegion spec={createTestSpec()} />);

    const region = screen.getByRole('status');
    expect(region).toBeTruthy();
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-atomic')).toBe('true');
  });

  it('uses spec.metadata.custom.title when available', () => {
    const spec = createTestSpec({
      metadata: {
        generatedAt: Date.now(),
        custom: { title: 'Dashboard updated' },
      },
    });

    render(<AriaLiveRegion spec={spec} />);

    const region = screen.getByRole('status');
    expect(region.textContent).toBe('Dashboard updated');
  });

  it('uses "Content updated" as default announcement', () => {
    const spec = createTestSpec();
    render(<AriaLiveRegion spec={spec} />);

    const region = screen.getByRole('status');
    expect(region.textContent).toBe('Content updated');
  });

  it('uses custom formatMessage when provided', () => {
    const spec = createTestSpec({
      metadata: { generatedAt: Date.now() },
    });
    const config: AriaAnnouncementConfig = {
      formatMessage: (s) => `UI version ${s.version} loaded`,
    };

    render(<AriaLiveRegion spec={spec} config={config} />);

    const region = screen.getByRole('status');
    expect(region.textContent).toBe('UI version 1.0 loaded');
  });

  it('clears announcement after timeout', () => {
    const spec = createTestSpec();
    render(<AriaLiveRegion spec={spec} />);

    const region = screen.getByRole('status');
    expect(region.textContent).toBe('Content updated');

    // Advance past the 1 second clear delay
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(region.textContent).toBe('');
  });

  it('renders empty when spec is null', () => {
    render(<AriaLiveRegion spec={null} />);

    const region = screen.getByRole('status');
    expect(region.textContent).toBe('');
  });

  it('uses assertive politeness when configured', () => {
    render(<AriaLiveRegion spec={createTestSpec()} config={{ politeness: 'assertive' }} />);

    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-live')).toBe('assertive');
  });

  it('is visually hidden but accessible', () => {
    render(<AriaLiveRegion spec={createTestSpec()} />);

    const region = screen.getByRole('status');
    const style = region.style;
    expect(style.position).toBe('absolute');
    expect(style.width).toBe('1px');
    expect(style.height).toBe('1px');
    expect(style.overflow).toBe('hidden');
  });

  it('updates announcement when spec changes', () => {
    const spec1 = createTestSpec({
      metadata: { generatedAt: 1, custom: { title: 'First view' } },
    });
    const spec2 = createTestSpec({
      metadata: { generatedAt: 2, custom: { title: 'Second view' } },
    });

    const { rerender } = render(<AriaLiveRegion spec={spec1} />);
    expect(screen.getByRole('status').textContent).toBe('First view');

    rerender(<AriaLiveRegion spec={spec2} />);
    expect(screen.getByRole('status').textContent).toBe('Second view');
  });
});
