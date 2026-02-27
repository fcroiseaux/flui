import { type CSSProperties, type ReactNode, useCallback, useRef, useState } from 'react';

import type { DebugOverlayProps, DebugTabId } from './debug.types';
import { SpecTab } from './SpecTab';
import { TraceTab } from './TraceTab';

const TAB_IDS: readonly DebugTabId[] = ['spec', 'trace'];

const TAB_LABELS: Record<DebugTabId, string> = {
  spec: 'Spec',
  trace: 'Trace',
};

/* ---------- Styles ---------- */

const overlayBaseStyle: CSSProperties = {
  position: 'fixed',
  backgroundColor: '#1e1e2e',
  color: '#cdd6f4',
  fontFamily: 'monospace',
  fontSize: '13px',
  zIndex: 99999,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
};

function getOverlayStyle(position: 'right' | 'bottom', collapsed: boolean): CSSProperties {
  if (position === 'bottom') {
    return {
      ...overlayBaseStyle,
      bottom: 0,
      left: 0,
      width: '100%',
      height: collapsed ? '36px' : '300px',
      borderTop: '1px solid #45475a',
    };
  }
  return {
    ...overlayBaseStyle,
    top: 0,
    right: 0,
    width: collapsed ? '36px' : '400px',
    height: '100vh',
    borderLeft: '1px solid #45475a',
  };
}

const tablistStyle: CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid #45475a',
  flexShrink: 0,
};

function getTabStyle(isActive: boolean): CSSProperties {
  return {
    padding: '8px 16px',
    background: isActive ? '#313244' : 'transparent',
    color: isActive ? '#cdd6f4' : '#a6adc8',
    border: 'none',
    borderBottom: isActive ? '2px solid #89b4fa' : '2px solid transparent',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: '13px',
    outline: 'none',
  };
}

const toggleButtonStyle: CSSProperties = {
  marginLeft: 'auto',
  padding: '4px 8px',
  background: 'transparent',
  color: '#a6adc8',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: '13px',
};

const panelStyle: CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: '8px',
};

/**
 * Debug overlay component with Spec and Trace tabs.
 * Provides developer tooling for inspecting UISpecification and generation traces.
 */
export function DebugOverlay({
  spec,
  traces,
  position = 'right',
  defaultTab = 'spec',
  isOpen,
  onToggle,
}: DebugOverlayProps): ReactNode {
  const [activeTab, setActiveTab] = useState<DebugTabId>(defaultTab);
  const [collapsed, setCollapsed] = useState(false);
  const tabRefs = useRef<Map<DebugTabId, HTMLButtonElement | null>>(new Map());
  const panelRefs = useRef<Map<DebugTabId, HTMLDivElement | null>>(new Map());

  const setTabRef = useCallback(
    (id: DebugTabId) => (el: HTMLButtonElement | null) => {
      tabRefs.current.set(id, el);
    },
    [],
  );

  const setPanelRef = useCallback(
    (id: DebugTabId) => (el: HTMLDivElement | null) => {
      panelRefs.current.set(id, el);
    },
    [],
  );

  if (isOpen === false) {
    return null;
  }

  function handleTabKeyDown(e: React.KeyboardEvent): void {
    const currentIndex = TAB_IDS.indexOf(activeTab);
    let nextTab: DebugTabId | undefined;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextTab = TAB_IDS[(currentIndex + 1) % TAB_IDS.length];
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextTab = TAB_IDS[(currentIndex - 1 + TAB_IDS.length) % TAB_IDS.length];
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();

      const panel = panelRefs.current.get(activeTab);

      if (!panel) {
        return;
      }

      const firstFocusable = panel.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])',
      );

      (firstFocusable ?? panel).focus();
      return;
    }

    if (nextTab) {
      setActiveTab(nextTab);
      tabRefs.current.get(nextTab)?.focus();
    }
  }

  function handleToggleCollapse(): void {
    const next = !collapsed;
    setCollapsed(next);
    onToggle?.(!next);
  }

  return (
    <div data-flui-debug style={getOverlayStyle(position, collapsed)}>
      <div role="tablist" aria-label="Debug overlay tabs" style={tablistStyle}>
        {TAB_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            ref={setTabRef(id)}
            id={`flui-debug-tab-${id}`}
            aria-selected={activeTab === id}
            aria-controls={`flui-debug-panel-${id}`}
            tabIndex={activeTab === id ? 0 : -1}
            onClick={() => setActiveTab(id)}
            onKeyDown={handleTabKeyDown}
            style={getTabStyle(activeTab === id)}
          >
            {TAB_LABELS[id]}
          </button>
        ))}
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand debug overlay' : 'Collapse debug overlay'}
          onClick={handleToggleCollapse}
          style={toggleButtonStyle}
        >
          {collapsed ? '◀' : '▶'}
        </button>
      </div>
      {!collapsed && (
        <>
          <div
            role="tabpanel"
            ref={setPanelRef('spec')}
            id="flui-debug-panel-spec"
            aria-labelledby="flui-debug-tab-spec"
            hidden={activeTab !== 'spec'}
            style={panelStyle}
            tabIndex={-1}
          >
            {activeTab === 'spec' && <SpecTab spec={spec} />}
          </div>
          <div
            role="tabpanel"
            ref={setPanelRef('trace')}
            id="flui-debug-panel-trace"
            aria-labelledby="flui-debug-tab-trace"
            hidden={activeTab !== 'trace'}
            style={panelStyle}
            tabIndex={-1}
          >
            {activeTab === 'trace' && <TraceTab traces={traces} />}
          </div>
        </>
      )}
    </div>
  );
}
