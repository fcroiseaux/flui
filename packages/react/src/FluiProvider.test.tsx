import { ComponentRegistry } from '@flui/core';
import { render, screen } from '@testing-library/react';
import { createContext, useContext } from 'react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { FluiProvider, useFluiContext } from './FluiProvider';

function createTestRegistry(): ComponentRegistry {
  const registry = new ComponentRegistry();
  registry.register({
    name: 'TestButton',
    category: 'input',
    description: 'A test button',
    accepts: z.object({ label: z.string() }),
    component: () => null,
  });
  return registry;
}

describe('FluiProvider', () => {
  describe('context value', () => {
    it('provides registry to children via context', () => {
      const registry = createTestRegistry();

      function Consumer() {
        const ctx = useFluiContext();
        return <div data-testid="result">{ctx.registry.getAll().length}</div>;
      }

      render(
        <FluiProvider registry={registry}>
          <Consumer />
        </FluiProvider>,
      );

      expect(screen.getByTestId('result').textContent).toBe('1');
    });

    it('provides config when supplied', () => {
      const registry = createTestRegistry();
      const config = { connector: undefined };

      function Consumer() {
        const ctx = useFluiContext();
        return <div data-testid="has-config">{ctx.config !== undefined ? 'yes' : 'no'}</div>;
      }

      render(
        <FluiProvider registry={registry} config={config}>
          <Consumer />
        </FluiProvider>,
      );

      expect(screen.getByTestId('has-config').textContent).toBe('yes');
    });

    it('provides undefined config when not supplied', () => {
      const registry = createTestRegistry();

      function Consumer() {
        const ctx = useFluiContext();
        return <div data-testid="has-config">{ctx.config !== undefined ? 'yes' : 'no'}</div>;
      }

      render(
        <FluiProvider registry={registry}>
          <Consumer />
        </FluiProvider>,
      );

      expect(screen.getByTestId('has-config').textContent).toBe('no');
    });
  });

  describe('error without provider', () => {
    it('throws descriptive error when useFluiContext is used outside FluiProvider', () => {
      function OrphanConsumer() {
        useFluiContext();
        return null;
      }

      const originalError = console.error;
      console.error = () => {};

      expect(() => render(<OrphanConsumer />)).toThrow(
        'useFluiContext must be used within a FluiProvider',
      );

      console.error = originalError;
    });
  });

  describe('provider isolation', () => {
    it('does not conflict with other React context providers', () => {
      const registry = createTestRegistry();
      const OtherContext = createContext('other-default');

      function DoubleConsumer() {
        const fluiCtx = useFluiContext();
        const otherValue = useContext(OtherContext);
        return (
          <div>
            <span data-testid="flui">{fluiCtx.registry.getAll().length}</span>
            <span data-testid="other">{otherValue}</span>
          </div>
        );
      }

      render(
        <OtherContext.Provider value="custom-value">
          <FluiProvider registry={registry}>
            <DoubleConsumer />
          </FluiProvider>
        </OtherContext.Provider>,
      );

      expect(screen.getByTestId('flui').textContent).toBe('1');
      expect(screen.getByTestId('other').textContent).toBe('custom-value');
    });

    it('does not interfere with nested FluiProviders', () => {
      const outerRegistry = createTestRegistry();
      const innerRegistry = new ComponentRegistry();
      innerRegistry.register({
        name: 'InnerComp',
        category: 'display',
        description: 'inner component',
        accepts: z.object({}),
        component: () => null,
      });
      innerRegistry.register({
        name: 'InnerComp2',
        category: 'display',
        description: 'inner component 2',
        accepts: z.object({}),
        component: () => null,
      });

      function OuterConsumer() {
        const ctx = useFluiContext();
        return <span data-testid="outer">{ctx.registry.getAll().length}</span>;
      }

      function InnerConsumer() {
        const ctx = useFluiContext();
        return <span data-testid="inner">{ctx.registry.getAll().length}</span>;
      }

      render(
        <FluiProvider registry={outerRegistry}>
          <OuterConsumer />
          <FluiProvider registry={innerRegistry}>
            <InnerConsumer />
          </FluiProvider>
        </FluiProvider>,
      );

      expect(screen.getByTestId('outer').textContent).toBe('1');
      expect(screen.getByTestId('inner').textContent).toBe('2');
    });
  });
});
