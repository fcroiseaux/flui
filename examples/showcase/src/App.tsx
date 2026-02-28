import type { GenerationTrace, UISpecification } from '@flui/core';
import { DebugOverlay, FluiProvider, LiquidView, useFluidDebug } from '@flui/react';
import { useCallback, useEffect, useState } from 'react';

import type { SetupResult } from './flui-setup';
import { setupFlui } from './flui-setup';
import { scenarios } from './scenarios';
import type { IntentVariant, Scenario } from './scenarios';

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
      scenario.enqueue(setup.mockConnector);
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

          {genKey !== null && (
            <ScenarioRunner
              key={genKey}
              intent={activeIntent}
              setup={setup}
            />
          )}
        </main>
      </div>
    </FluiProvider>
  );
}
