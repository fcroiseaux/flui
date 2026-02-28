import type { UISpecification } from '@flui/core';
import { createSpecBuilder } from '@flui/testing';
import type { MockConnector } from '@flui/testing';
import type { IntentVariant, Scenario } from './index';

/* ── Page intents ── */
export const PAGE_INTENTS = {
  overview: 'Show a product overview page with features and a get-started action',
  pricing: 'Show pricing plans with Free, Pro, and Enterprise tiers',
  docs: 'Show a documentation page with search, article table, and quick start guide',
} as const;

/* ── Page A: Product Overview ── */
export function buildOverviewSpec(): UISpecification {
  return createSpecBuilder()
    .addComponent({
      id: 'heading-1',
      componentType: 'Heading',
      props: { level: 2, text: 'Product Overview', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'text-desc',
      componentType: 'Text',
      props: { text: 'Build dynamic, intent-driven user interfaces powered by LLMs. flui transforms natural-language descriptions into live component trees — no templates, no hardcoded layouts.', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'card-features',
      componentType: 'Card',
      props: { title: 'Key Features', subtitle: 'What makes flui different' },
      children: [
        {
          id: 'text-f1',
          componentType: 'Text',
          props: { text: 'Intent-driven generation — describe what you want, get a live UI.', 'aria-live': 'polite' },
        },
        {
          id: 'text-f2',
          componentType: 'Text',
          props: { text: 'Context-aware adaptation — UI adjusts to user role, device, and environment.', 'aria-live': 'polite' },
        },
        {
          id: 'text-f3',
          componentType: 'Text',
          props: { text: 'Built-in caching and prefetching — instant navigation between views.', 'aria-live': 'polite' },
        },
      ],
    })
    .addComponent({
      id: 'btn-start',
      componentType: 'Button',
      props: { label: 'Get Started', variant: 'primary', 'aria-label': 'Get Started' },
    })
    .withLayout({ type: 'stack', direction: 'vertical', spacing: 12 })
    .withMetadata({ model: 'mock-model' })
    .build();
}

/* ── Page B: Pricing Plans ── */
export function buildPricingSpec(): UISpecification {
  return createSpecBuilder()
    .addComponent({
      id: 'heading-1',
      componentType: 'Heading',
      props: { level: 2, text: 'Pricing Plans', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'metric-free',
      componentType: 'MetricCard',
      props: { label: 'Free', value: '$0/mo', trend: 'flat', 'aria-label': 'Free plan: $0/mo', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'metric-pro',
      componentType: 'MetricCard',
      props: { label: 'Pro', value: '$29/mo', trend: 'up', 'aria-label': 'Pro plan: $29/mo', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'metric-enterprise',
      componentType: 'MetricCard',
      props: { label: 'Enterprise', value: 'Custom', trend: 'up', 'aria-label': 'Enterprise plan: Custom pricing', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'text-compare',
      componentType: 'Text',
      props: { text: 'All plans include core generation, context engine, and component registry. Pro adds caching, prefetch, and priority support. Enterprise includes SLA, SSO, and dedicated infrastructure.', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'btn-upgrade',
      componentType: 'Button',
      props: { label: 'Start Free Trial', variant: 'primary', 'aria-label': 'Start Free Trial' },
    })
    .withLayout({ type: 'grid', spacing: 12 })
    .withMetadata({ model: 'mock-model' })
    .build();
}

/* ── Page C: Documentation ── */
export function buildDocsSpec(): UISpecification {
  return createSpecBuilder()
    .addComponent({
      id: 'heading-1',
      componentType: 'Heading',
      props: { level: 2, text: 'Documentation', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'input-search',
      componentType: 'Input',
      props: { label: 'Search Docs', placeholder: 'Search documentation...', type: 'text', 'aria-label': 'Search documentation' },
    })
    .addComponent({
      id: 'table-docs',
      componentType: 'DataTable',
      props: {
        'aria-label': 'Documentation articles',
        columns: ['Article', 'Category', 'Updated'],
        rows: [
          { Article: 'Getting Started', Category: 'Guides', Updated: '2 days ago' },
          { Article: 'Context Engine API', Category: 'Reference', Updated: '1 week ago' },
          { Article: 'Component Registry', Category: 'Reference', Updated: '3 days ago' },
          { Article: 'Prefetch & Caching', Category: 'Advanced', Updated: 'Today' },
        ],
      },
    })
    .addComponent({
      id: 'card-quickstart',
      componentType: 'Card',
      props: { title: 'Quick Start', subtitle: '5-minute setup guide' },
      children: [
        {
          id: 'text-qs',
          componentType: 'Text',
          props: { text: 'npm install @flui/core @flui/react', variant: 'code', 'aria-live': 'polite' },
        },
      ],
    })
    .withLayout({ type: 'stack', direction: 'vertical', spacing: 12 })
    .withMetadata({ model: 'mock-model' })
    .build();
}

/* ── Spec builders by page key ── */
export const PAGE_SPECS: Record<string, () => UISpecification> = {
  overview: buildOverviewSpec,
  pricing: buildPricingSpec,
  docs: buildDocsSpec,
};

/* ── Helper: enqueue a mock response for a given page ── */
export function enqueuePageMock(mock: MockConnector, pageKey: string): void {
  const builder = PAGE_SPECS[pageKey];
  if (!builder) return;
  mock.enqueue({
    content: JSON.stringify(builder()),
    model: 'mock-model',
    usage: { promptTokens: 120, completionTokens: 250, totalTokens: 370 },
  });
}

/* ── Scenario defaults ── */
function buildSpec(): UISpecification {
  return buildOverviewSpec();
}

function enqueue(mock: MockConnector): void {
  mock.enqueue({
    content: JSON.stringify(buildSpec()),
    model: 'mock-model',
    usage: { promptTokens: 120, completionTokens: 250, totalTokens: 370 },
  });
}

/* ── Variants ── */
const variants: IntentVariant[] = [
  {
    label: 'Pricing plans',
    intent: PAGE_INTENTS.pricing,
    enqueue(mock: MockConnector) {
      enqueuePageMock(mock, 'pricing');
    },
    getSpec: buildPricingSpec,
  },
  {
    label: 'Documentation',
    intent: PAGE_INTENTS.docs,
    enqueue(mock: MockConnector) {
      enqueuePageMock(mock, 'docs');
    },
    getSpec: buildDocsSpec,
  },
];

export const prefetchDemoScenario: Scenario = {
  id: 'prefetch-demo',
  title: 'Prefetch: Instant Navigation',
  description: 'Side-by-side comparison: standard loading delay vs. background prefetch for instant tab switching.',
  tag: 'Prefetch',
  intent: PAGE_INTENTS.overview,
  enqueue,
  getSpec: buildSpec,
  variants,
};
