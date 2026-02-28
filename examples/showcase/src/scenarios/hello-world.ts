import { createSpecBuilder } from '@flui/testing';
import type { MockConnector } from '@flui/testing';
import type { Scenario } from './index';

function buildSpec() {
  return createSpecBuilder()
    .addComponent({
      id: 'heading-1',
      componentType: 'Heading',
      props: { level: 1, text: 'Hello, Liquid World', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'text-1',
      componentType: 'Text',
      props: { text: 'This UI was generated from a single intent string. No templates, no hardcoded layouts — just a natural-language description transformed into a live component tree.', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'text-2',
      componentType: 'Text',
      props: { text: 'flui parses the intent, resolves context, generates a UISpecification, validates it, and renders React components — all in one seamless pipeline.', variant: 'caption', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'badge-1',
      componentType: 'StatusBadge',
      props: { text: 'Generated', status: 'success', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'card-1',
      componentType: 'Card',
      props: { title: 'How It Works', subtitle: 'The flui generation pipeline' },
      children: [
        {
          id: 'text-pipeline',
          componentType: 'Text',
          props: { text: 'Intent → Prompt → LLM → UISpecification → Validation → React Components', variant: 'code', 'aria-live': 'polite' },
        },
      ],
    })
    .withLayout({ type: 'stack', direction: 'vertical', spacing: 12 })
    .withMetadata({ model: 'mock-model' })
    .build();
}

function enqueue(mock: MockConnector): void {
  const spec = buildSpec();
  mock.enqueue({
    content: JSON.stringify(spec),
    model: 'mock-model',
    usage: { promptTokens: 85, completionTokens: 150, totalTokens: 235 },
  });
}

export const helloWorldScenario: Scenario = {
  id: 'hello-world',
  title: 'Hello Liquid World',
  description: 'Basic generation from a single intent string. Shows FluiProvider, LiquidView, and crossfade transition.',
  tag: 'Basics',
  intent: 'Show a welcome greeting that explains how flui generates UI from intent',
  enqueue,
  getSpec: buildSpec,
};
