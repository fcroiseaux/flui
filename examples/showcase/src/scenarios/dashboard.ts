import { createSpecBuilder } from '@flui/testing';
import type { MockConnector } from '@flui/testing';
import type { Scenario } from './index';

function buildSpec() {
  return createSpecBuilder()
    .addComponent({
      id: 'heading-1',
      componentType: 'Heading',
      props: { level: 2, text: 'System Dashboard' },
    })
    .addComponent({
      id: 'badge-status',
      componentType: 'StatusBadge',
      props: { text: 'All Systems Operational', status: 'success' },
    })
    .addComponent({
      id: 'metric-users',
      componentType: 'MetricCard',
      props: { label: 'Active Users', value: '12,847', trend: 'up' },
    })
    .addComponent({
      id: 'metric-requests',
      componentType: 'MetricCard',
      props: { label: 'API Requests', value: '1.2M', trend: 'up' },
    })
    .addComponent({
      id: 'metric-latency',
      componentType: 'MetricCard',
      props: { label: 'Avg Latency', value: '42ms', trend: 'down' },
    })
    .addComponent({
      id: 'metric-errors',
      componentType: 'MetricCard',
      props: { label: 'Error Rate', value: '0.03%', trend: 'flat' },
    })
    .addComponent({
      id: 'card-context',
      componentType: 'Card',
      props: { title: 'Context-Aware Generation', subtitle: 'This dashboard was adapted based on identity and environment context' },
      children: [
        {
          id: 'text-context',
          componentType: 'Text',
          props: { text: 'The context engine resolved your identity (role, permissions, expertise) and environment (device, viewport, connection) to tailor this layout.' },
        },
      ],
    })
    .withLayout({ type: 'grid', spacing: 12 })
    .withMetadata({ model: 'mock-model' })
    .build();
}

function enqueue(mock: MockConnector): void {
  const spec = buildSpec();
  mock.enqueue({
    content: JSON.stringify(spec),
    model: 'mock-model',
    usage: { promptTokens: 210, completionTokens: 380, totalTokens: 590 },
  });
}

export const dashboardScenario: Scenario = {
  id: 'dashboard',
  title: 'Context-Aware Dashboard',
  description: 'Demonstrates the context engine with identity and environment providers driving UI generation.',
  tag: 'Context',
  intent: 'Show a system monitoring dashboard with key metrics for the current user context',
  enqueue,
  getSpec: buildSpec,
};
