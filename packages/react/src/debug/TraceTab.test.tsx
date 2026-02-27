import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createTrace } from '@flui/core';
import type { GenerationTrace } from '@flui/core';

import { TraceTab } from './TraceTab';

function createMockTrace(overrides?: {
  id?: string;
  startTime?: number;
}): GenerationTrace {
  const trace = createTrace({
    id: overrides?.id ?? 'test-trace-1',
    startTime: overrides?.startTime ?? 1700000000000,
  });
  trace.addStep({
    module: 'intent-parser',
    operation: 'parseIntent',
    durationMs: 15,
    metadata: { intent: 'show user dashboard', type: 'text' },
  });
  trace.addStep({
    module: 'context-resolver',
    operation: 'resolveContext',
    durationMs: 5,
    metadata: { role: 'admin', device: 'desktop' },
  });
  trace.addStep({
    module: 'generation',
    operation: 'generateSpec',
    durationMs: 850,
    metadata: { model: 'gpt-4o', tokens: 1200 },
  });
  return trace;
}

describe('TraceTab', () => {
  it('renders empty state when no traces', () => {
    render(<TraceTab traces={[]} />);
    expect(screen.getByText('No traces recorded yet')).toBeTruthy();
  });

  it('renders trace list with trace IDs and timestamps', () => {
    const trace = createMockTrace();
    render(<TraceTab traces={[trace]} />);
    expect(screen.getByText('test-trace-1')).toBeTruthy();
  });

  it('shows step count and duration in trace summary', () => {
    const trace = createMockTrace();
    render(<TraceTab traces={[trace]} />);
    expect(screen.getByText(/3 steps/)).toBeTruthy();
    expect(screen.getByText(/870ms/)).toBeTruthy();
  });

  it('expands trace to show steps', () => {
    const trace = createMockTrace();
    const { container } = render(<TraceTab traces={[trace]} />);
    // Click the details summary to expand
    const summary = screen.getByText(/test-trace-1/).closest('summary');
    if (summary) fireEvent.click(summary);
    expect(
      container.querySelector('[data-flui-debug-step="intent-parser"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-flui-debug-step="generation"]'),
    ).toBeTruthy();
  });

  describe('filter by intent', () => {
    it('filters by intent substring with real-time filtering', async () => {
      vi.useFakeTimers();
      const trace1 = createMockTrace({ id: 'trace-match' });
      const trace2 = createTrace({
        id: 'trace-no-match',
        startTime: 1700000001000,
      });
      trace2.addStep({
        module: 'intent-parser',
        operation: 'parseIntent',
        durationMs: 10,
        metadata: { intent: 'show login form', type: 'text' },
      });

      render(<TraceTab traces={[trace1, trace2]} />);

      const intentInput = screen.getByLabelText('Filter by intent');
      fireEvent.change(intentInput, { target: { value: 'dashboard' } });

      // Wait for debounce
      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      expect(screen.getByText('trace-match')).toBeTruthy();
      expect(screen.queryByText('trace-no-match')).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('filter by timestamp', () => {
    it('filters by timestamp range', () => {
      // early: 1 Jan 2024 00:00 UTC, late: 1 Feb 2024 00:00 UTC
      const earlyTime = Date.UTC(2024, 0, 1, 0, 0, 0);
      const lateTime = Date.UTC(2024, 1, 1, 0, 0, 0);
      const trace1 = createMockTrace({
        id: 'early-trace',
        startTime: earlyTime,
      });
      const trace2 = createMockTrace({
        id: 'late-trace',
        startTime: lateTime,
      });

      render(<TraceTab traces={[trace1, trace2]} />);

      // Set start time to exclude early trace (mid Jan)
      const startInput = screen.getByLabelText('Filter by start time');
      // 2024-01-15T00:00 local time — always after earlyTime (Jan 1) but before lateTime (Feb 1)
      fireEvent.change(startInput, {
        target: { value: '2024-01-15T00:00' },
      });

      expect(screen.queryByText('early-trace')).toBeNull();
      expect(screen.getByText('late-trace')).toBeTruthy();
    });
  });

  describe('filter by context attribute', () => {
    it('filters by context attribute key-value', () => {
      const trace1 = createMockTrace({ id: 'admin-trace' });
      const trace2 = createTrace({
        id: 'user-trace',
        startTime: 1700000001000,
      });
      trace2.addStep({
        module: 'context-resolver',
        operation: 'resolveContext',
        durationMs: 5,
        metadata: { role: 'user', device: 'mobile' },
      });

      render(<TraceTab traces={[trace1, trace2]} />);

      const contextKeySelect = screen.getByLabelText('Filter by context key');
      fireEvent.change(contextKeySelect, { target: { value: 'role' } });

      // Both have 'role', now filter by value
      const contextValueInput = screen.getByLabelText(
        'Filter by context value',
      );
      fireEvent.change(contextValueInput, { target: { value: 'admin' } });

      expect(screen.getByText('admin-trace')).toBeTruthy();
      expect(screen.queryByText('user-trace')).toBeNull();
    });
  });

  describe('combined filters', () => {
    it('applies AND logic across filters', async () => {
      vi.useFakeTimers();
      const trace1 = createMockTrace({
        id: 'matching-trace',
        startTime: 1700000000000,
      });
      const trace2 = createTrace({
        id: 'non-matching-trace',
        startTime: 1700000001000,
      });
      trace2.addStep({
        module: 'intent-parser',
        operation: 'parseIntent',
        durationMs: 10,
        metadata: { intent: 'show login', type: 'text' },
      });
      trace2.addStep({
        module: 'context-resolver',
        operation: 'resolveContext',
        durationMs: 5,
        metadata: { role: 'admin', device: 'desktop' },
      });

      render(<TraceTab traces={[trace1, trace2]} />);

      // Filter by intent = "dashboard"
      const intentInput = screen.getByLabelText('Filter by intent');
      fireEvent.change(intentInput, { target: { value: 'dashboard' } });
      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      expect(screen.getByText('matching-trace')).toBeTruthy();
      expect(screen.queryByText('non-matching-trace')).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('clear filters', () => {
    it('resets all filters', async () => {
      vi.useFakeTimers();
      const trace1 = createMockTrace({ id: 'trace-a' });
      const trace2 = createTrace({
        id: 'trace-b',
        startTime: 1700000001000,
      });
      trace2.addStep({
        module: 'intent-parser',
        operation: 'parseIntent',
        durationMs: 10,
        metadata: { intent: 'other intent', type: 'text' },
      });

      render(<TraceTab traces={[trace1, trace2]} />);

      // Apply intent filter
      const intentInput = screen.getByLabelText('Filter by intent');
      fireEvent.change(intentInput, { target: { value: 'dashboard' } });
      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      expect(screen.queryByText('trace-b')).toBeNull();

      // Clear filters
      const clearBtn = screen.getByLabelText('Clear all filters');
      fireEvent.click(clearBtn);
      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      expect(screen.getByText('trace-a')).toBeTruthy();
      expect(screen.getByText('trace-b')).toBeTruthy();

      vi.useRealTimers();
    });
  });

  describe('accessibility', () => {
    it('filter inputs have aria-labels', () => {
      const trace = createMockTrace();
      render(<TraceTab traces={[trace]} />);
      expect(screen.getByLabelText('Filter by start time')).toBeTruthy();
      expect(screen.getByLabelText('Filter by end time')).toBeTruthy();
      expect(screen.getByLabelText('Filter by intent')).toBeTruthy();
      expect(screen.getByLabelText('Filter by context key')).toBeTruthy();
      expect(screen.getByLabelText('Clear all filters')).toBeTruthy();
    });
  });
});
