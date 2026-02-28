import { createSpecBuilder } from '@flui/testing';
import type { MockConnector } from '@flui/testing';
import type { IntentVariant, Scenario } from './index';

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

/* ── Variant: error status page ── */
function buildErrorSpec() {
  return createSpecBuilder()
    .addComponent({
      id: 'heading-1',
      componentType: 'Heading',
      props: { level: 1, text: 'System Alert', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'badge-1',
      componentType: 'StatusBadge',
      props: { text: 'Critical', status: 'error', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'text-1',
      componentType: 'Text',
      props: { text: 'An error has been detected in the deployment pipeline. The latest build failed validation checks and has been rolled back automatically.', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'card-1',
      componentType: 'Card',
      props: { title: 'Error Details', subtitle: 'Build #4827 — failed at 14:32 UTC' },
      children: [
        {
          id: 'text-detail',
          componentType: 'Text',
          props: { text: 'TypeError: Cannot read properties of undefined (reading \'validate\')', variant: 'code', 'aria-live': 'polite' },
        },
      ],
    })
    .addComponent({
      id: 'btn-retry',
      componentType: 'Button',
      props: { label: 'Retry Build', variant: 'danger', 'aria-label': 'Retry Build' },
    })
    .withLayout({ type: 'stack', direction: 'vertical', spacing: 12 })
    .withMetadata({ model: 'mock-model' })
    .build();
}

/* ── Variant: onboarding wizard ── */
function buildOnboardingSpec() {
  return createSpecBuilder()
    .addComponent({
      id: 'heading-1',
      componentType: 'Heading',
      props: { level: 1, text: 'Welcome Aboard!', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'badge-1',
      componentType: 'StatusBadge',
      props: { text: 'Step 1 of 3', status: 'info', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'text-1',
      componentType: 'Text',
      props: { text: 'Let\'s get your workspace set up. We\'ll walk you through the essentials so you can start building right away.', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'input-name',
      componentType: 'Input',
      props: { label: 'Your Name', placeholder: 'Enter your display name', type: 'text', 'aria-label': 'Your name' },
    })
    .addComponent({
      id: 'select-role',
      componentType: 'Select',
      props: {
        label: 'Your Role',
        'aria-label': 'Select your role',
        options: [
          { value: 'developer', label: 'Developer' },
          { value: 'designer', label: 'Designer' },
          { value: 'pm', label: 'Product Manager' },
        ],
      },
    })
    .addComponent({
      id: 'btn-next',
      componentType: 'Button',
      props: { label: 'Continue to Step 2', variant: 'primary', 'aria-label': 'Continue to Step 2' },
    })
    .withLayout({ type: 'stack', direction: 'vertical', spacing: 12 })
    .withMetadata({ model: 'mock-model' })
    .build();
}

const variants: IntentVariant[] = [
  {
    label: 'Error status page',
    intent: 'Show an error status page with alert details and a retry action',
    enqueue(mock: MockConnector) {
      mock.enqueue({
        content: JSON.stringify(buildErrorSpec()),
        model: 'mock-model',
        usage: { promptTokens: 90, completionTokens: 180, totalTokens: 270 },
      });
    },
    getSpec: buildErrorSpec,
  },
  {
    label: 'Onboarding wizard',
    intent: 'Show a user onboarding form with name input, role selection, and a next step button',
    enqueue(mock: MockConnector) {
      mock.enqueue({
        content: JSON.stringify(buildOnboardingSpec()),
        model: 'mock-model',
        usage: { promptTokens: 95, completionTokens: 200, totalTokens: 295 },
      });
    },
    getSpec: buildOnboardingSpec,
  },
];

export const helloWorldScenario: Scenario = {
  id: 'hello-world',
  title: 'Hello Liquid World',
  description: 'Basic generation from a single intent string. Shows FluiProvider, LiquidView, and crossfade transition.',
  tag: 'Basics',
  intent: 'Show a welcome greeting that explains how flui generates UI from intent',
  enqueue,
  getSpec: buildSpec,
  variants,
};
