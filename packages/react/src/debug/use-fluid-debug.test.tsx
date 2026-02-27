import type { UISpecification } from '@flui/core';
import { createTrace } from '@flui/core';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useFluidDebug } from './use-fluid-debug';

describe('useFluidDebug', () => {
  describe('initial state', () => {
    it('returns isOpen as false by default', () => {
      const { result } = renderHook(() => useFluidDebug());
      expect(result.current.isOpen).toBe(false);
    });

    it('returns isOpen as true when defaultOpen is true', () => {
      const { result } = renderHook(() => useFluidDebug({ defaultOpen: true }));
      expect(result.current.isOpen).toBe(true);
    });

    it('returns overlayProps with default spec and traces', () => {
      const { result } = renderHook(() => useFluidDebug());
      expect(result.current.overlayProps.spec).toBeNull();
      expect(result.current.overlayProps.traces).toEqual([]);
      expect(result.current.overlayProps.isOpen).toBe(false);
    });

    it('passes explicit overlay data through overlayProps', () => {
      const trace = createTrace({ id: 'trace-1', startTime: 1700000000000 });
      const spec: UISpecification = {
        version: '1.0',
        components: [],
        layout: { type: 'stack', direction: 'vertical' },
        interactions: [],
        metadata: { generatedAt: 1700000000000 },
      };

      const { result } = renderHook(() =>
        useFluidDebug({
          defaultTab: 'trace',
          position: 'bottom',
          spec,
          traces: [trace],
        }),
      );

      expect(result.current.overlayProps.spec).toBe(spec);
      expect(result.current.overlayProps.traces).toEqual([trace]);
      expect(result.current.overlayProps.defaultTab).toBe('trace');
      expect(result.current.overlayProps.position).toBe('bottom');
    });
  });

  describe('toggle', () => {
    it('flips isOpen from false to true', () => {
      const { result } = renderHook(() => useFluidDebug());
      expect(result.current.isOpen).toBe(false);

      act(() => {
        result.current.toggle();
      });
      expect(result.current.isOpen).toBe(true);
    });

    it('flips isOpen from true to false', () => {
      const { result } = renderHook(() => useFluidDebug({ defaultOpen: true }));
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.toggle();
      });
      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('open and close', () => {
    it('open() sets isOpen to true', () => {
      const { result } = renderHook(() => useFluidDebug());
      expect(result.current.isOpen).toBe(false);

      act(() => {
        result.current.open();
      });
      expect(result.current.isOpen).toBe(true);
    });

    it('close() sets isOpen to false', () => {
      const { result } = renderHook(() => useFluidDebug({ defaultOpen: true }));
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.close();
      });
      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('keyboard shortcut', () => {
    it('Ctrl+Shift+D toggles isOpen', () => {
      const { result } = renderHook(() => useFluidDebug());
      expect(result.current.isOpen).toBe(false);

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'D',
            ctrlKey: true,
            shiftKey: true,
          }),
        );
      });
      expect(result.current.isOpen).toBe(true);

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'D',
            ctrlKey: true,
            shiftKey: true,
          }),
        );
      });
      expect(result.current.isOpen).toBe(false);
    });

    it('does not toggle on Ctrl+D without Shift', () => {
      const { result } = renderHook(() => useFluidDebug());

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'D',
            ctrlKey: true,
            shiftKey: false,
          }),
        );
      });
      expect(result.current.isOpen).toBe(false);
    });

    it('cleans up keydown listener on unmount', () => {
      const removeSpy = vi.spyOn(document, 'removeEventListener');
      const { unmount } = renderHook(() => useFluidDebug());

      unmount();

      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      removeSpy.mockRestore();
    });
  });
});
