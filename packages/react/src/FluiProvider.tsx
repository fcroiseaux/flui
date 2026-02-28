import { createContext, type ReactNode, useContext, useMemo } from 'react';

import type { FluiContextValue, FluiProviderProps } from './react.types';

/**
 * React context for FluiProvider.
 * null default enables detection of missing provider.
 */
const FluiContext = createContext<FluiContextValue | null>(null);

/**
 * Context provider that makes the ComponentRegistry and optional config
 * available to LiquidView components.
 *
 * FluiProvider is a lightweight context wrapper — no side effects,
 * no state management library dependency.
 */
export function FluiProvider({
  instance,
  registry,
  config,
  children,
}: FluiProviderProps): ReactNode {
  const resolvedRegistry = instance?.registry ?? registry;
  if (!resolvedRegistry) {
    throw new Error('FluiProvider requires either an instance or a registry');
  }

  const resolvedConfig = instance?.config ?? config;
  const value = useMemo(
    () => ({ registry: resolvedRegistry, config: resolvedConfig, instance }),
    [resolvedRegistry, resolvedConfig, instance],
  );
  return <FluiContext.Provider value={value}>{children}</FluiContext.Provider>;
}

/**
 * Hook to access the FluiProvider context value.
 * Throws a descriptive error if used outside a FluiProvider.
 */
export function useFluiContext(): FluiContextValue {
  const ctx = useContext(FluiContext);
  if (!ctx) {
    throw new Error('useFluiContext must be used within a FluiProvider');
  }
  return ctx;
}
