import type { GenerationTrace, UISpecification } from '@flui/core';
import { DebugOverlay, FluiProvider, LiquidView, renderSpec, useFluiContext, useFluidDebug, usePrefetch } from '@flui/react';
import type { PrefetchStatus } from '@flui/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { SetupResult } from './flui-setup';
import { setupFlui } from './flui-setup';
import { scenarios } from './scenarios';
import type { IntentVariant, Scenario } from './scenarios';
import { PAGE_INTENTS, PAGE_SPECS, enqueuePageMock } from './scenarios/prefetch-demo';

function LoadingFallback() {
  return (
    <div className="loading-fallback">
      <div className="loading-spinner" />
      Generating UI...
    </div>
  );
}

interface MetricsBarProps {
  setup: SetupResult;
}

function MetricsBar({ setup }: MetricsBarProps) {
  const [metrics, setMetrics] = useState(setup.flui.getMetrics());

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(setup.flui.getMetrics());
    }, 1000);
    return () => clearInterval(interval);
  }, [setup.flui]);

  return (
    <div className="header-metrics">
      <span>
        <span className="metric-label">Cost:</span>
        <span className="metric-value">${metrics.cost.sessionTotal.toFixed(4)}</span>
      </span>
      <span>
        <span className="metric-label">Generations:</span>
        <span className="metric-value">{metrics.cost.generationCount}</span>
      </span>
      <span>
        <span className="metric-label">Cache Hit:</span>
        <span className="metric-value">{metrics.cache.aggregate.hitRate.toFixed(0)}%</span>
      </span>
    </div>
  );
}

interface ScenarioRunnerProps {
  intent: string;
  setup: SetupResult;
}

function ScenarioRunner({ intent, setup }: ScenarioRunnerProps) {
  const [currentSpec, setCurrentSpec] = useState<UISpecification | null>(null);
  const [traces, setTraces] = useState<GenerationTrace[]>([]);

  const debug = useFluidDebug({
    defaultOpen: false,
    spec: currentSpec,
    traces,
    position: 'bottom',
    defaultTab: 'spec',
  });

  const handleStateChange = useCallback(
    (state: { status: string; spec?: UISpecification; trace?: GenerationTrace; error?: unknown }) => {
      console.log('[flui] state →', state.status, state);
      if (state.status === 'rendering' && state.spec) {
        setCurrentSpec(state.spec);
      }
      if (state.status === 'generating' && state.trace) {
        setTraces((prev) => [...prev, state.trace!]);
      }
      if (state.status === 'error') {
        const err = state.error as { context?: { zodErrors?: unknown[] } };
        console.error('[flui] generation error:', state.error);
        if (err.context?.zodErrors) {
          console.error('[flui] zod errors:', JSON.stringify(err.context.zodErrors, null, 2));
        }
      }
    },
    [],
  );

  return (
    <>
      <div className="liquid-view-container">
        <LiquidView
          intent={intent}
          fallback={<LoadingFallback />}
          onStateChange={handleStateChange}
        />
      </div>
      <DebugOverlay {...debug.overlayProps} />
    </>
  );
}

interface IntentEditorProps {
  /** The currently active intent (display value). */
  intent: string;
  /** The scenario's canonical base intent (used for "Default" chip). */
  defaultIntent: string;
  isLiveMode: boolean;
  variants: IntentVariant[];
  onIntentChange: (intent: string, variant?: IntentVariant) => void;
}

function IntentEditor({ intent, defaultIntent, isLiveMode, variants, onIntentChange }: IntentEditorProps) {
  const [draft, setDraft] = useState(intent);

  // Sync draft when external intent changes (scenario switch, chip click, regenerate)
  useEffect(() => {
    setDraft(intent);
  }, [intent]);

  const handleRegenerate = () => {
    if (draft.trim() && draft.trim() !== intent.trim()) {
      onIntentChange(draft.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleRegenerate();
    }
  };

  const isDirty = draft.trim() !== intent.trim();

  return (
    <div className="intent-editor">
      <div className="intent-editor-label">
        Intent sent to LLM:
        {!isLiveMode && isDirty && (
          <span className="intent-mock-hint">Mock mode — use a suggestion chip for different UI</span>
        )}
      </div>
      <div className="intent-editor-row">
        <textarea
          className="intent-textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          aria-label="Edit the intent sent to the LLM"
        />
        <button
          type="button"
          className="intent-regenerate-btn"
          onClick={handleRegenerate}
          disabled={!isDirty}
          aria-label="Regenerate UI from this intent"
        >
          Regenerate
        </button>
      </div>
      {variants.length > 0 && (
        <div className="intent-suggestions">
          <span className="intent-suggestions-label">Try a different intent:</span>
          {variants.map((v) => (
            <button
              key={v.intent}
              type="button"
              className={`intent-chip ${intent === v.intent ? 'active' : ''}`}
              onClick={() => onIntentChange(v.intent, v)}
              aria-pressed={intent === v.intent}
            >
              {v.label}
            </button>
          ))}
          <button
            type="button"
            className={`intent-chip ${intent === defaultIntent ? 'active' : ''}`}
            onClick={() => onIntentChange(defaultIntent)}
            aria-pressed={intent === defaultIntent}
          >
            Default
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Tab definitions for the prefetch demo ── */
const PREFETCH_TABS = [
  { key: 'overview', label: 'Product Overview', intent: PAGE_INTENTS.overview },
  { key: 'pricing', label: 'Pricing Plans', intent: PAGE_INTENTS.pricing },
  { key: 'docs', label: 'Documentation', intent: PAGE_INTENTS.docs },
] as const;

type PrefetchTabKey = (typeof PREFETCH_TABS)[number]['key'];

interface PrefetchDemoProps {
  setup: SetupResult;
}

function PrefetchDemo({ setup }: PrefetchDemoProps) {
  const { registry } = useFluiContext();

  // ── Tab state ──
  const [leftTab, setLeftTab] = useState<PrefetchTabKey>('overview');
  const [rightTab, setRightTab] = useState<PrefetchTabKey>('overview');

  // ── Left panel: simulated loading ──
  const [leftPhase, setLeftPhase] = useState<'idle' | 'loading' | 'rendered'>('rendered');
  const [leftSpec, setLeftSpec] = useState<UISpecification>(PAGE_SPECS.overview!());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLeftTabClick = (tabKey: PrefetchTabKey) => {
    if (tabKey === leftTab) return;
    setLeftTab(tabKey);
    setLeftPhase('loading');

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setLeftSpec(PAGE_SPECS[tabKey]!());
      setLeftPhase('rendered');
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // ── Right panel: prefetch hooks (one per page) ──
  // These fire on mount and populate the cache in the background.
  // The status bar shows the real prefetch lifecycle (idle → in-flight → cached).
  const prefetchA = usePrefetch({ intent: PAGE_INTENTS.overview });
  const prefetchB = usePrefetch({ intent: PAGE_INTENTS.pricing });
  const prefetchC = usePrefetch({ intent: PAGE_INTENTS.docs });

  const prefetchStatuses: Record<PrefetchTabKey, PrefetchStatus> = {
    overview: prefetchA.status,
    pricing: prefetchB.status,
    docs: prefetchC.status,
  };

  // ── Right panel: render directly via renderSpec once prefetch is done ──
  // Using renderSpec instead of LiquidView avoids cache-key matching issues
  // inherent to the MockConnector's intent-agnostic FIFO queue.
  // In a real LLM environment, LiquidView would get a cache hit from prefetch.
  const rightSpec = useMemo(() => PAGE_SPECS[rightTab]!(), [rightTab]);
  const rightStatus = prefetchStatuses[rightTab];

  const handleRightTabClick = (tabKey: PrefetchTabKey) => {
    if (tabKey === rightTab) return;
    setRightTab(tabKey);
  };

  return (
    <div className="prefetch-demo">
      <div className="prefetch-panels">
        {/* ── Left panel: Standard (simulated delay) ── */}
        <div className="prefetch-panel">
          <div className="prefetch-panel-label">Standard</div>
          <div className="prefetch-tabs">
            {PREFETCH_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`prefetch-tab ${leftTab === tab.key ? 'active' : ''}`}
                onClick={() => handleLeftTabClick(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="liquid-view-container">
            {leftPhase === 'loading' ? (
              <div className="loading-fallback">
                <div className="loading-spinner" />
                Generating UI...
              </div>
            ) : (
              renderSpec(leftSpec, registry)
            )}
          </div>
        </div>

        {/* ── Right panel: With Prefetch (instant from cache) ── */}
        <div className="prefetch-panel">
          <div className="prefetch-panel-label">With Prefetch</div>
          <div className="prefetch-tabs">
            {PREFETCH_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`prefetch-tab ${rightTab === tab.key ? 'active' : ''}`}
                onClick={() => handleRightTabClick(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="liquid-view-container">
            {rightStatus === 'cached' || rightTab === 'overview' ? (
              renderSpec(rightSpec, registry)
            ) : rightStatus === 'in-flight' ? (
              <div className="loading-fallback">
                <div className="loading-spinner" />
                Prefetching...
              </div>
            ) : rightStatus === 'failed' ? (
              <div className="loading-fallback">Prefetch failed</div>
            ) : (
              renderSpec(rightSpec, registry)
            )}
          </div>

          {/* ── Status bar ── */}
          <div className="prefetch-status-bar">
            {PREFETCH_TABS.map((tab) => (
              <div key={tab.key} className="prefetch-status-item">
                <span className={`prefetch-status-dot ${prefetchStatuses[tab.key]}`} />
                <span className="prefetch-status-label">{tab.label}</span>
                <span className="prefetch-status-value">{prefetchStatuses[tab.key]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const [setup, setSetup] = useState<SetupResult | null>(null);
  const [activeScenario, setActiveScenario] = useState<Scenario>(scenarios[0]!);
  const [activeRole, setActiveRole] = useState('admin');
  const [activeIntent, setActiveIntent] = useState(scenarios[0]!.intent);
  // Track the active variant separately so role-switch and "Default" chip work reliably.
  // null = using the scenario's base intent or a free-text edit.
  const [activeVariant, setActiveVariant] = useState<IntentVariant | null>(null);
  // genKey gates rendering: null = not ready, number = LiquidView can mount.
  // The mock is enqueued synchronously BEFORE genKey is bumped, so the queue
  // is always populated when LiquidView's effect fires.
  const [genKey, setGenKey] = useState<number | null>(null);

  useEffect(() => {
    setupFlui().then((result) => {
      // Enqueue first scenario's mock BEFORE rendering ScenarioRunner
      if (result.mockConnector) {
        scenarios[0]!.enqueue(result.mockConnector);
      }
      setSetup(result);
      setGenKey(1);
    });
  }, []);

  if (!setup) {
    return (
      <div className="loading-fallback" style={{ height: '100vh' }}>
        <div className="loading-spinner" />
        Initializing flui...
      </div>
    );
  }

  const handleScenarioSelect = (scenario: Scenario) => {
    // Enqueue mock response synchronously BEFORE React re-renders
    if (setup.mockConnector) {
      setup.mockConnector.reset();
      if (scenario.id === 'prefetch-demo') {
        // Only 3 mocks needed: one per prefetch hook (no LiquidView on initial render)
        enqueuePageMock(setup.mockConnector, 'overview');  // prefetch A
        enqueuePageMock(setup.mockConnector, 'pricing');   // prefetch B
        enqueuePageMock(setup.mockConnector, 'docs');      // prefetch C
      } else {
        scenario.enqueue(setup.mockConnector);
      }
    }
    setActiveScenario(scenario);
    setActiveIntent(scenario.intent);
    setActiveVariant(null);
    setActiveRole('admin');
    setGenKey((prev) => (prev ?? 0) + 1);
  };

  const handleRoleChange = (role: string) => {
    // Enqueue mock response synchronously BEFORE React re-renders.
    // Use the tracked activeVariant (not a string lookup) for reliable enqueue.
    if (setup.mockConnector) {
      setup.mockConnector.reset();
      if (activeVariant) {
        activeVariant.enqueue(setup.mockConnector, role);
      } else {
        activeScenario.enqueue(setup.mockConnector, role);
      }
    }
    setActiveRole(role);
    setGenKey((prev) => (prev ?? 0) + 1);
  };

  const handleIntentChange = (newIntent: string, variant?: IntentVariant) => {
    // Enqueue mock response synchronously BEFORE React re-renders
    if (setup.mockConnector) {
      setup.mockConnector.reset();
      if (variant) {
        variant.enqueue(setup.mockConnector, activeRole);
      } else {
        // Default or free-text: use scenario's base spec
        activeScenario.enqueue(setup.mockConnector, activeRole);
      }
    }
    setActiveIntent(newIntent);
    setActiveVariant(variant ?? null);
    setGenKey((prev) => (prev ?? 0) + 1);
  };

  return (
    <FluiProvider instance={setup.flui}>
      <div className="app">
        <header className="header">
          <div className="header-left">
            <div className="header-title">
              <span>flui</span> showcase
            </div>
            <span className="demo-badge">
              {setup.isLiveMode ? 'Live LLM' : 'Mock Mode'}
            </span>
          </div>
          <MetricsBar setup={setup} />
        </header>

        <aside className="sidebar">
          <div className="sidebar-title">Scenarios</div>
          {scenarios.map((scenario) => (
            <div
              key={scenario.id}
              className={`scenario-card ${activeScenario.id === scenario.id ? 'active' : ''}`}
              onClick={() => handleScenarioSelect(scenario)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleScenarioSelect(scenario);
              }}
              role="button"
              tabIndex={0}
            >
              <h3>{scenario.title}</h3>
              <p>{scenario.description}</p>
              <span className="scenario-tag">{scenario.tag}</span>
            </div>
          ))}
        </aside>

        <main className="main-content">
          <div className="scenario-header">
            <h2>{activeScenario.title}</h2>
            <p>{activeScenario.description}</p>
          </div>

          <IntentEditor
            intent={activeIntent}
            defaultIntent={activeScenario.intent}
            isLiveMode={setup.isLiveMode}
            variants={activeScenario.variants ?? []}
            onIntentChange={handleIntentChange}
          />

          {activeScenario.supportsRoles && (
            <div className="role-switcher">
              {['admin', 'editor', 'viewer'].map((role) => (
                <button
                  key={role}
                  type="button"
                  className={`role-btn ${activeRole === role ? 'active' : ''}`}
                  onClick={() => handleRoleChange(role)}
                >
                  {role}
                </button>
              ))}
            </div>
          )}

          {genKey !== null && activeScenario.id === 'prefetch-demo' ? (
            <PrefetchDemo key={genKey} setup={setup} />
          ) : genKey !== null ? (
            <ScenarioRunner
              key={genKey}
              intent={activeIntent}
              setup={setup}
            />
          ) : null}
        </main>
      </div>
    </FluiProvider>
  );
}
