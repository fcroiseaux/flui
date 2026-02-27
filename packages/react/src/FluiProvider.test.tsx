import { ComponentRegistry, type LLMConnector, ok } from '@flui/core';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FluiProvider, useFluiContext } from './FluiProvider';

function TestConsumer() {
  const ctx = useFluiContext();
  return <div data-testid="ctx">{String(Boolean(ctx.registry))}</div>;
}

function createConnector(): LLMConnector {
  return {
    async generate() {
      return ok({
        content: JSON.stringify({
          version: '1.0.0',
          components: [],
          layout: { type: 'stack', direction: 'vertical' },
          interactions: [],
          metadata: {
            generatedAt: Date.now(),
            model: 'gpt-4o',
            intentHash: 'hash',
            traceId: 'trace',
          },
        }),
        model: 'gpt-4o',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      });
    },
  };
}

describe('FluiProvider', () => {
  it('accepts createFlui instance prop', () => {
    const instance = {
      registry: new ComponentRegistry(),
      config: {
        connector: createConnector(),
        generationConfig: {
          connector: createConnector(),
          model: 'gpt-4o',
        },
        validationConfig: {},
      },
    };
    const ui = render(
      <FluiProvider instance={instance as import('@flui/core').FluiInstance}>
        <TestConsumer />
      </FluiProvider>,
    );

    expect(ui.getByTestId('ctx').textContent).toBe('true');
  });

  it('throws when neither instance nor registry is provided', () => {
    expect(() =>
      render(
        <FluiProvider>
          <div>child</div>
        </FluiProvider>,
      ),
    ).toThrow('FluiProvider requires either an instance or a registry');
  });
});
