import type { GenerationTrace, TraceStep } from '@flui/core';
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { TraceFilter } from './debug.types';

/* ---------- Module colors ---------- */

const MODULE_COLORS: Record<string, string> = {
  'intent-parser': '#89b4fa',
  'context-resolver': '#a6e3a1',
  generation: '#f9e2af',
  validation: '#f38ba8',
  rendering: '#cba6f7',
};

function getModuleColor(module: string): string {
  return MODULE_COLORS[module] ?? '#cdd6f4';
}

/* ---------- Styles ---------- */

const filterBarStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  padding: '8px 0',
  borderBottom: '1px solid #45475a',
  marginBottom: '8px',
  alignItems: 'flex-end',
};

const filterInputStyle: CSSProperties = {
  background: '#11111b',
  color: '#cdd6f4',
  border: '1px solid #45475a',
  borderRadius: '4px',
  padding: '4px 8px',
  fontFamily: 'monospace',
  fontSize: '12px',
};

const filterLabelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  fontSize: '11px',
  color: '#a6adc8',
};

const clearButtonStyle: CSSProperties = {
  background: '#313244',
  color: '#cdd6f4',
  border: '1px solid #45475a',
  borderRadius: '4px',
  padding: '4px 8px',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: '12px',
  alignSelf: 'flex-end',
};

const traceRowStyle: CSSProperties = {
  borderBottom: '1px solid #313244',
  padding: '4px 0',
};

const traceSummaryStyle: CSSProperties = {
  cursor: 'pointer',
  padding: '4px',
  color: '#89b4fa',
};

const stepRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '2px 8px',
  fontSize: '12px',
};

const operationStyle: CSSProperties = {
  color: '#cdd6f4',
  minWidth: '120px',
};

const durationStyle: CSSProperties = {
  color: '#f9e2af',
  minWidth: '60px',
  textAlign: 'right' as const,
};

const barContainerStyle: CSSProperties = {
  flex: 1,
  height: '4px',
  background: '#313244',
  borderRadius: '2px',
  overflow: 'hidden',
};

const emptyStateStyle: CSSProperties = {
  color: '#6c7086',
  fontStyle: 'italic',
  padding: '16px',
  textAlign: 'center',
};

const metadataPreStyle: CSSProperties = {
  background: '#11111b',
  padding: '8px',
  borderRadius: '4px',
  overflow: 'auto',
  fontSize: '12px',
  margin: '4px 8px',
  color: '#a6e3a1',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

/* ---------- Debounce interval ---------- */

const DEBOUNCE_MS = 200;

/* ---------- Helpers ---------- */

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString();
}

function getTraceDuration(trace: GenerationTrace): number {
  const steps = trace.steps;
  if (steps.length === 0) return 0;
  return steps.reduce((sum, s) => sum + s.durationMs, 0);
}

function toDatetimeLocal(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ---------- Step renderer ---------- */

function renderTraceStep(step: TraceStep, maxDuration: number): ReactNode {
  const widthPercent = maxDuration > 0 ? (step.durationMs / maxDuration) * 100 : 0;

  return (
    <div data-flui-debug-step={step.module} style={stepRowStyle}>
      <span style={{ color: getModuleColor(step.module), minWidth: '120px' }}>{step.module}</span>
      <span style={operationStyle}>{step.operation}</span>
      <span style={durationStyle}>{step.durationMs}ms</span>
      <div style={barContainerStyle}>
        <div
          style={{
            width: `${widthPercent}%`,
            height: '100%',
            background: getModuleColor(step.module),
            borderRadius: '2px',
          }}
          aria-hidden="true"
        />
      </div>
      <details>
        <summary style={{ cursor: 'pointer', color: '#6c7086', fontSize: '11px' }}>
          metadata
        </summary>
        <pre style={metadataPreStyle}>{JSON.stringify(step.metadata, null, 2)}</pre>
      </details>
    </div>
  );
}

function getStepSortTime(step: TraceStep): number {
  const timestampLike =
    step.metadata.timestamp ??
    step.metadata.time ??
    step.metadata.startTime ??
    step.metadata.startedAt;

  if (typeof timestampLike === 'number' && Number.isFinite(timestampLike)) {
    return timestampLike;
  }

  if (typeof timestampLike === 'string') {
    const parsed = Date.parse(timestampLike);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return Number.POSITIVE_INFINITY;
}

/* ---------- Extract context keys ---------- */

function extractContextKeys(traces: readonly GenerationTrace[]): string[] {
  const keys = new Set<string>();
  for (const trace of traces) {
    for (const step of trace.steps) {
      if (step.module === 'context-resolver') {
        for (const key of Object.keys(step.metadata)) {
          keys.add(key);
        }
      }
    }
  }
  return Array.from(keys).sort();
}

/* ---------- TraceTab component ---------- */

/**
 * Trace tab displays generation traces with timeline, filtering, and search.
 * Supports filtering by timestamp range, intent substring, and context attributes.
 */
export function TraceTab({ traces }: { traces: readonly GenerationTrace[] }): ReactNode {
  const [filter, setFilter] = useState<TraceFilter>({});
  const [intentInput, setIntentInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const contextKeys = useMemo(() => extractContextKeys(traces), [traces]);

  // Debounced intent filter
  useEffect(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setFilter((prev) => ({ ...prev, intent: intentInput || undefined }));
      debounceRef.current = null;
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [intentInput]);

  const filteredTraces = useMemo(() => {
    return traces.filter((trace) => {
      // Timestamp filter
      if (filter.startTime && trace.startTime < filter.startTime) return false;
      if (filter.endTime && trace.startTime > filter.endTime) return false;

      // Intent filter — search intent-parser module steps
      if (filter.intent) {
        const hasIntent = trace.steps.some(
          (step) =>
            step.module === 'intent-parser' &&
            JSON.stringify(step.metadata).toLowerCase().includes(filter.intent!.toLowerCase()),
        );
        if (!hasIntent) return false;
      }

      // Context attribute filter — search context-resolver module steps
      if (filter.contextKey) {
        const hasContext = trace.steps.some(
          (step) =>
            step.module === 'context-resolver' &&
            step.metadata[filter.contextKey!] !== undefined &&
            (!filter.contextValue ||
              String(step.metadata[filter.contextKey!]).includes(filter.contextValue)),
        );
        if (!hasContext) return false;
      }

      return true;
    });
  }, [traces, filter]);

  const handleClearFilters = useCallback(() => {
    setFilter({});
    setIntentInput('');
  }, []);

  if (traces.length === 0) {
    return <div style={emptyStateStyle}>No traces recorded yet</div>;
  }

  return (
    <div data-flui-debug-trace>
      {/* Filter bar */}
      <div style={filterBarStyle}>
        <label style={filterLabelStyle}>
          Start time
          <input
            type="datetime-local"
            aria-label="Filter by start time"
            style={filterInputStyle}
            value={filter.startTime ? toDatetimeLocal(filter.startTime) : ''}
            onChange={(e) => {
              const val = e.target.value;
              setFilter((prev) => ({
                ...prev,
                startTime: val ? new Date(val).getTime() : undefined,
              }));
            }}
          />
        </label>
        <label style={filterLabelStyle}>
          End time
          <input
            type="datetime-local"
            aria-label="Filter by end time"
            style={filterInputStyle}
            value={filter.endTime ? toDatetimeLocal(filter.endTime) : ''}
            onChange={(e) => {
              const val = e.target.value;
              setFilter((prev) => ({
                ...prev,
                endTime: val ? new Date(val).getTime() : undefined,
              }));
            }}
          />
        </label>
        <label style={filterLabelStyle}>
          Intent
          <input
            type="text"
            aria-label="Filter by intent"
            placeholder="Search intent..."
            style={filterInputStyle}
            value={intentInput}
            onChange={(e) => setIntentInput(e.target.value)}
          />
        </label>
        <label style={filterLabelStyle}>
          Context key
          <select
            aria-label="Filter by context key"
            style={filterInputStyle}
            value={filter.contextKey ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              setFilter((prev) => ({
                ...prev,
                contextKey: val || undefined,
                contextValue: val ? prev.contextValue : undefined,
              }));
            }}
          >
            <option value="">All</option>
            {contextKeys.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </label>
        {filter.contextKey && (
          <label style={filterLabelStyle}>
            Context value
            <input
              type="text"
              aria-label="Filter by context value"
              placeholder="Value..."
              style={filterInputStyle}
              value={filter.contextValue ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                setFilter((prev) => ({
                  ...prev,
                  contextValue: val || undefined,
                }));
              }}
            />
          </label>
        )}
        <button
          type="button"
          onClick={handleClearFilters}
          style={clearButtonStyle}
          aria-label="Clear all filters"
        >
          Clear filters
        </button>
      </div>

      {/* Trace list */}
      {filteredTraces.length === 0 ? (
        <div style={emptyStateStyle}>No traces match current filters</div>
      ) : (
        filteredTraces.map((trace) => {
          const duration = getTraceDuration(trace);
          const sortedSteps = trace.steps
            .map((step, index) => ({ step, index }))
            .sort((a, b) => {
              const aTime = getStepSortTime(a.step);
              const bTime = getStepSortTime(b.step);

              if (aTime !== bTime) {
                return aTime - bTime;
              }

              return a.index - b.index;
            })
            .map(({ step }) => step);
          const maxStepDuration = Math.max(...sortedSteps.map((s) => s.durationMs), 0);

          return (
            <div key={trace.id} style={traceRowStyle} data-flui-debug-trace-id={trace.id}>
              <details>
                <summary style={traceSummaryStyle}>
                  <code>{trace.id}</code>
                  {' — '}
                  {formatTimestamp(trace.startTime)}
                  {' — '}
                  {sortedSteps.length} steps
                  {' — '}
                  {duration}ms
                </summary>
                <div>
                  {sortedSteps.map((step, index) => (
                    <div key={`${trace.id}-${step.module}-${step.operation}-${index}`}>
                      {renderTraceStep(step, maxStepDuration)}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          );
        })
      )}
    </div>
  );
}
