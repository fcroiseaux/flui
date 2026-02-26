import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CrossfadeTransition, type CrossfadeTransitionProps } from './transitions';

function renderTransition(overrides: Partial<CrossfadeTransitionProps> = {}) {
  const defaultProps: CrossfadeTransitionProps = {
    content: <div data-testid="content-a">Content A</div>,
    contentKey: 'key-a',
    config: { enabled: true, durationMs: 200, timingFunction: 'ease-in-out' },
    ...overrides,
  };
  return render(<CrossfadeTransition {...defaultProps} />);
}

describe('CrossfadeTransition', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic rendering', () => {
    it('renders content when no transition is occurring', () => {
      renderTransition();
      expect(screen.getByTestId('content-a')).toBeTruthy();
      expect(screen.getByText('Content A')).toBeTruthy();
    });

    it('renders without transition wrapper when idle', () => {
      const { container } = renderTransition();
      // No transition-active wrapper when idle
      expect(container.querySelector('[data-flui-transition]')).toBeNull();
    });
  });

  describe('crossfade on content key change', () => {
    it('renders new content with opacity transition on key change', () => {
      const { rerender } = renderTransition();
      expect(screen.getByText('Content A')).toBeTruthy();

      rerender(
        <CrossfadeTransition
          content={<div data-testid="content-b">Content B</div>}
          contentKey="key-b"
          config={{ enabled: true, durationMs: 200, timingFunction: 'ease-in-out' }}
        />,
      );

      // Both contents should be visible during transition
      expect(screen.getByText('Content B')).toBeTruthy();
      // Transition wrapper should be active
      expect(screen.getByText('Content B').closest('[data-flui-transition="active"]')).toBeTruthy();
    });

    it('old content fades out while new content fades in', () => {
      const { rerender } = renderTransition();

      rerender(
        <CrossfadeTransition
          content={<div data-testid="content-b">Content B</div>}
          contentKey="key-b"
          config={{ enabled: true, durationMs: 200, timingFunction: 'ease-in-out' }}
        />,
      );

      // During transition, old content is in an aria-hidden exiting layer
      const contentA = screen.getByText('Content A');
      const exitingLayer = contentA.closest('[aria-hidden="true"]') as HTMLElement;
      expect(exitingLayer).toBeTruthy();
      expect(exitingLayer.style.opacity).toBe('1');

      act(() => {
        vi.advanceTimersByTime(16);
      });
      expect(exitingLayer.style.opacity).toBe('0');

      // New content is in the entering layer
      const contentB = screen.getByText('Content B');
      expect(contentB.closest('[aria-hidden="true"]')).toBeNull();
    });

    it('does not cause layout shift: container uses position relative', () => {
      const { rerender, container } = renderTransition();

      rerender(
        <CrossfadeTransition
          content={<div data-testid="content-b">Content B</div>}
          contentKey="key-b"
          config={{ enabled: true, durationMs: 200 }}
        />,
      );

      const transitionContainer = container.querySelector(
        '[data-flui-transition="active"]',
      ) as HTMLElement;
      expect(transitionContainer).toBeTruthy();
      expect(transitionContainer.style.position).toBe('relative');

      // Exiting layer uses absolute positioning
      const exitingLayer = screen.getByText('Content A').parentElement as HTMLElement;
      expect(exitingLayer.style.position).toBe('absolute');
    });
  });

  describe('transition cleanup', () => {
    it('removes exiting content from DOM after transition completes via transitionend', () => {
      const { rerender } = renderTransition();

      rerender(
        <CrossfadeTransition
          content={<div data-testid="content-b">Content B</div>}
          contentKey="key-b"
          config={{ enabled: true, durationMs: 200 }}
        />,
      );

      // Both present during transition
      expect(screen.getByText('Content A')).toBeTruthy();
      expect(screen.getByText('Content B')).toBeTruthy();

      // Simulate transitionend on the entering element
      const enteringLayer = screen.getByText('Content B').parentElement as HTMLElement;
      act(() => {
        fireEvent.transitionEnd(enteringLayer);
      });

      // Old content should be removed
      expect(screen.queryByText('Content A')).toBeNull();
      expect(screen.getByText('Content B')).toBeTruthy();
    });

    it('removes exiting content via fallback timeout if transitionend does not fire', () => {
      const { rerender } = renderTransition();

      rerender(
        <CrossfadeTransition
          content={<div data-testid="content-b">Content B</div>}
          contentKey="key-b"
          config={{ enabled: true, durationMs: 200 }}
        />,
      );

      expect(screen.getByText('Content A')).toBeTruthy();

      // Advance past durationMs + 50ms fallback margin
      act(() => {
        vi.advanceTimersByTime(250);
      });

      // Old content should be cleaned up by fallback timer
      expect(screen.queryByText('Content A')).toBeNull();
      expect(screen.getByText('Content B')).toBeTruthy();
    });
  });

  describe('disabled transitions', () => {
    it('renders content directly when transition.enabled is false', () => {
      const { container } = renderTransition({
        config: { enabled: false },
      });

      expect(screen.getByText('Content A')).toBeTruthy();
      // No transition wrapper
      expect(container.querySelector('[data-flui-transition]')).toBeNull();
    });

    it('switches content immediately without animation when disabled', () => {
      const { rerender } = render(
        <CrossfadeTransition
          content={<div>Content A</div>}
          contentKey="key-a"
          config={{ enabled: false }}
        />,
      );

      rerender(
        <CrossfadeTransition
          content={<div>Content B</div>}
          contentKey="key-b"
          config={{ enabled: false }}
        />,
      );

      expect(screen.getByText('Content B')).toBeTruthy();
      expect(screen.queryByText('Content A')).toBeNull();
    });
  });

  describe('configurable duration and timing', () => {
    it('applies custom duration to transition style', () => {
      const { rerender } = renderTransition({
        config: { enabled: true, durationMs: 500, timingFunction: 'linear' },
      });

      rerender(
        <CrossfadeTransition
          content={<div>Content B</div>}
          contentKey="key-b"
          config={{ enabled: true, durationMs: 500, timingFunction: 'linear' }}
        />,
      );

      const enteringLayer = screen.getByText('Content B').parentElement as HTMLElement;
      expect(enteringLayer.style.transition).toContain('500ms');
      expect(enteringLayer.style.transition).toContain('linear');
    });

    it('uses default 200ms ease-in-out when not specified', () => {
      const { rerender } = renderTransition({
        config: { enabled: true },
      });

      rerender(
        <CrossfadeTransition
          content={<div>Content B</div>}
          contentKey="key-b"
          config={{ enabled: true }}
        />,
      );

      const enteringLayer = screen.getByText('Content B').parentElement as HTMLElement;
      expect(enteringLayer.style.transition).toContain('200ms');
      expect(enteringLayer.style.transition).toContain('ease-in-out');
    });
  });

  describe('rapid successive transitions', () => {
    it('finalizes previous transition immediately when a new one starts', () => {
      const { rerender } = renderTransition();

      // First transition
      rerender(
        <CrossfadeTransition
          content={<div>Content B</div>}
          contentKey="key-b"
          config={{ enabled: true, durationMs: 200 }}
        />,
      );

      expect(screen.getByText('Content B')).toBeTruthy();

      // Second transition before first completes
      rerender(
        <CrossfadeTransition
          content={<div>Content C</div>}
          contentKey="key-c"
          config={{ enabled: true, durationMs: 200 }}
        />,
      );

      // Content C is the new entering content
      expect(screen.getByText('Content C')).toBeTruthy();
    });
  });

  describe('onTransitionEnd callback', () => {
    it('calls onTransitionEnd after transition completes', () => {
      const onTransitionEnd = vi.fn();
      const { rerender } = render(
        <CrossfadeTransition
          content={<div>Content A</div>}
          contentKey="key-a"
          config={{ enabled: true, durationMs: 200 }}
          onTransitionEnd={onTransitionEnd}
        />,
      );

      rerender(
        <CrossfadeTransition
          content={<div>Content B</div>}
          contentKey="key-b"
          config={{ enabled: true, durationMs: 200 }}
          onTransitionEnd={onTransitionEnd}
        />,
      );

      // Simulate transitionend
      const enteringLayer = screen.getByText('Content B').parentElement as HTMLElement;
      act(() => {
        fireEvent.transitionEnd(enteringLayer);
      });

      expect(onTransitionEnd).toHaveBeenCalled();
    });

    it('calls onTransitionEnd immediately when transition is disabled', () => {
      const onTransitionEnd = vi.fn();
      const { rerender } = render(
        <CrossfadeTransition
          content={<div>Content A</div>}
          contentKey="key-a"
          config={{ enabled: false }}
          onTransitionEnd={onTransitionEnd}
        />,
      );

      rerender(
        <CrossfadeTransition
          content={<div>Content B</div>}
          contentKey="key-b"
          config={{ enabled: false }}
          onTransitionEnd={onTransitionEnd}
        />,
      );

      expect(onTransitionEnd).toHaveBeenCalled();
    });
  });

  describe('prefers-reduced-motion', () => {
    it('skips animation when user prefers reduced motion', () => {
      // Mock matchMedia to return reduced-motion preference
      vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const onTransitionEnd = vi.fn();
      const { rerender } = render(
        <CrossfadeTransition
          content={<div>Content A</div>}
          contentKey="key-a"
          config={{ enabled: true, durationMs: 200 }}
          onTransitionEnd={onTransitionEnd}
        />,
      );

      rerender(
        <CrossfadeTransition
          content={<div>Content B</div>}
          contentKey="key-b"
          config={{ enabled: true, durationMs: 200 }}
          onTransitionEnd={onTransitionEnd}
        />,
      );

      // Should render new content immediately without transition wrapper
      expect(screen.getByText('Content B')).toBeTruthy();
      expect(screen.queryByText('Content A')).toBeNull();
      expect(onTransitionEnd).toHaveBeenCalled();
    });
  });

  describe('transition from rendering to fallback', () => {
    it('applies crossfade when transitioning from spec content to fallback', () => {
      vi.useRealTimers();

      // First render: showing generated UI
      const { rerender } = render(
        <CrossfadeTransition
          content={<div data-testid="spec-content">Generated UI</div>}
          contentKey="rendering-123"
          config={{ enabled: true, durationMs: 200 }}
        />,
      );

      expect(screen.getByTestId('spec-content')).toBeTruthy();

      // Transition to fallback (error state)
      rerender(
        <CrossfadeTransition
          content={<div data-testid="fallback">Error occurred</div>}
          contentKey="error"
          config={{ enabled: true, durationMs: 200 }}
        />,
      );

      // During crossfade: new content is visible, old content is in aria-hidden exiting layer
      expect(screen.getByTestId('fallback')).toBeTruthy();
      const specContent = screen.queryByTestId('spec-content');
      if (specContent) {
        expect(specContent.closest('[aria-hidden="true"]')).toBeTruthy();
      }

      // Complete the transition
      const enteringLayer = screen.getByTestId('fallback').parentElement as HTMLElement;
      act(() => {
        fireEvent.transitionEnd(enteringLayer);
      });

      // Old content removed after transition completes
      expect(screen.queryByTestId('spec-content')).toBeNull();
      expect(screen.getByTestId('fallback')).toBeTruthy();

      vi.useFakeTimers();
    });
  });
});
