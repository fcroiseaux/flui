import type { GenerationTrace, UISpecification } from '@flui/core';
import { DebugOverlay, FluiProvider, LiquidView, useFluidDebug } from '@flui/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { SetupResult } from './flui-setup';
import { setupFlui } from './flui-setup';
import { scenarios } from './scenarios';
import type { Scenario } from './scenarios';

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
  scenario: Scenario;
  setup: SetupResult;
  role: string;
}

function ScenarioRunner({ scenario, setup, role }: ScenarioRunnerProps) {
  const [currentSpec, setCurrentSpec] = useState<UISpecification | null>(null);
  const [traces, setTraces] = useState<GenerationTrace[]>([]);
  const intentKeyRef = useRef(0);
  const [intentKey, setIntentKey] = useState(0);

  const debug = useFluidDebug({
    defaultOpen: false,
    spec: currentSpec,
    traces,
    position: 'bottom',
    defaultTab: 'spec',
  });

  // Enqueue mock and trigger generation when scenario or role changes
  useEffect(() => {
    if (setup.mockConnector) {
      setup.mockConnector.reset();
      scenario.enqueue(setup.mockConnector, role);
    }
    intentKeyRef.current += 1;
    setIntentKey(intentKeyRef.current);
  }, [scenario, role, setup.mockConnector]);

  const handleStateChange = useCallback(
    (state: { status: string; spec?: UISpecification; trace?: GenerationTrace }) => {
      if (state.status === 'rendering' && state.spec) {
        setCurrentSpec(state.spec);
      }
      if (state.status === 'generating' && state.trace) {
        setTraces((prev) => [...prev, state.trace!]);
      }
    },
    [],
  );

  // Use intentKey to force re-mount of LiquidView when we need re-generation
  const intentWithKey = `${scenario.intent} [${intentKey}]`;

  return (
    <>
      <div className="liquid-view-container">
        <LiquidView
          key={intentKey}
          intent={intentWithKey}
          fallback={<LoadingFallback />}
          onStateChange={handleStateChange}
        />
      </div>
      <DebugOverlay {...debug.overlayProps} />
    </>
  );
}

export function App() {
  const [setup, setSetup] = useState<SetupResult | null>(null);
  const [activeScenario, setActiveScenario] = useState<Scenario>(scenarios[0]!);
  const [activeRole, setActiveRole] = useState('admin');

  useEffect(() => {
    setupFlui().then(setSetup);
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
    setActiveScenario(scenario);
    if (!scenario.supportsRoles) {
      setActiveRole('admin');
    }
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

          {activeScenario.supportsRoles && (
            <div className="role-switcher">
              {['admin', 'editor', 'viewer'].map((role) => (
                <button
                  key={role}
                  type="button"
                  className={`role-btn ${activeRole === role ? 'active' : ''}`}
                  onClick={() => setActiveRole(role)}
                >
                  {role}
                </button>
              ))}
            </div>
          )}

          <ScenarioRunner
            key={activeScenario.id}
            scenario={activeScenario}
            setup={setup}
            role={activeRole}
          />
        </main>
      </div>
    </FluiProvider>
  );
}
