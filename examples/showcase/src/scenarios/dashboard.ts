import { createSpecBuilder } from '@flui/testing';
import type { MockConnector } from '@flui/testing';
import type { IntentVariant, Scenario } from './index';

function buildSpec() {
  return createSpecBuilder()
    .addComponent({
      id: 'heading-1',
      componentType: 'Heading',
      props: { level: 2, text: 'System Dashboard', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'badge-status',
      componentType: 'StatusBadge',
      props: { text: 'All Systems Operational', status: 'success', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'metric-users',
      componentType: 'MetricCard',
      props: { label: 'Active Users', value: '12,847', trend: 'up', 'aria-label': 'Active Users: 12,847', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'metric-requests',
      componentType: 'MetricCard',
      props: { label: 'API Requests', value: '1.2M', trend: 'up', 'aria-label': 'API Requests: 1.2M', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'metric-latency',
      componentType: 'MetricCard',
      props: { label: 'Avg Latency', value: '42ms', trend: 'down', 'aria-label': 'Average Latency: 42ms', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'metric-errors',
      componentType: 'MetricCard',
      props: { label: 'Error Rate', value: '0.03%', trend: 'flat', 'aria-label': 'Error Rate: 0.03%', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'card-context',
      componentType: 'Card',
      props: { title: 'Context-Aware Generation', subtitle: 'This dashboard was adapted based on identity and environment context' },
      children: [
        {
          id: 'text-context',
          componentType: 'Text',
          props: { text: 'The context engine resolved your identity (role, permissions, expertise) and environment (device, viewport, connection) to tailor this layout.', 'aria-live': 'polite' },
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

/* ── Variant: sales dashboard ── */
function buildSalesSpec() {
  return createSpecBuilder()
    .addComponent({
      id: 'heading-1',
      componentType: 'Heading',
      props: { level: 2, text: 'Sales Performance', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'badge-status',
      componentType: 'StatusBadge',
      props: { text: 'Q4 — On Track', status: 'success', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'metric-revenue',
      componentType: 'MetricCard',
      props: { label: 'Revenue', value: '$2.4M', trend: 'up', 'aria-label': 'Revenue: $2.4M', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'metric-deals',
      componentType: 'MetricCard',
      props: { label: 'Closed Deals', value: '187', trend: 'up', 'aria-label': 'Closed Deals: 187', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'metric-pipeline',
      componentType: 'MetricCard',
      props: { label: 'Pipeline Value', value: '$5.1M', trend: 'up', 'aria-label': 'Pipeline Value: $5.1M', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'metric-churn',
      componentType: 'MetricCard',
      props: { label: 'Churn Rate', value: '1.2%', trend: 'down', 'aria-label': 'Churn Rate: 1.2%', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'table-top',
      componentType: 'DataTable',
      props: {
        'aria-label': 'Top deals this quarter',
        columns: ['Deal', 'Value', 'Stage', 'Owner'],
        rows: [
          { Deal: 'Acme Corp', Value: '$420K', Stage: 'Negotiation', Owner: 'Alice' },
          { Deal: 'Globex Inc', Value: '$310K', Stage: 'Proposal', Owner: 'Bob' },
          { Deal: 'Initech', Value: '$280K', Stage: 'Closing', Owner: 'Carol' },
        ],
      },
    })
    .withLayout({ type: 'grid', spacing: 12 })
    .withMetadata({ model: 'mock-model' })
    .build();
}

/* ── Variant: incident dashboard ── */
function buildIncidentSpec() {
  return createSpecBuilder()
    .addComponent({
      id: 'heading-1',
      componentType: 'Heading',
      props: { level: 2, text: 'Incident Response', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'badge-status',
      componentType: 'StatusBadge',
      props: { text: 'Active Incident', status: 'error', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'metric-open',
      componentType: 'MetricCard',
      props: { label: 'Open Incidents', value: '3', trend: 'up', 'aria-label': 'Open Incidents: 3', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'metric-mttr',
      componentType: 'MetricCard',
      props: { label: 'MTTR', value: '24min', trend: 'down', 'aria-label': 'Mean Time to Resolve: 24min', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'metric-affected',
      componentType: 'MetricCard',
      props: { label: 'Affected Users', value: '1,204', trend: 'up', 'aria-label': 'Affected Users: 1,204', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'table-incidents',
      componentType: 'DataTable',
      props: {
        'aria-label': 'Active incidents',
        columns: ['ID', 'Severity', 'Service', 'Status'],
        rows: [
          { ID: 'INC-2847', Severity: 'P1', Service: 'Auth API', Status: 'Investigating' },
          { ID: 'INC-2846', Severity: 'P2', Service: 'CDN', Status: 'Mitigating' },
          { ID: 'INC-2845', Severity: 'P3', Service: 'Search', Status: 'Monitoring' },
        ],
      },
    })
    .addComponent({
      id: 'btn-ack',
      componentType: 'Button',
      props: { label: 'Acknowledge All', variant: 'danger', 'aria-label': 'Acknowledge All Incidents' },
    })
    .withLayout({ type: 'grid', spacing: 12 })
    .withMetadata({ model: 'mock-model' })
    .build();
}

const variants: IntentVariant[] = [
  {
    label: 'Sales performance',
    intent: 'Show a sales performance dashboard with revenue, deals, pipeline, and top deals table',
    enqueue(mock: MockConnector) {
      mock.enqueue({
        content: JSON.stringify(buildSalesSpec()),
        model: 'mock-model',
        usage: { promptTokens: 200, completionTokens: 400, totalTokens: 600 },
      });
    },
    getSpec: buildSalesSpec,
  },
  {
    label: 'Incident response',
    intent: 'Show an incident response dashboard with open incidents, MTTR, and affected users',
    enqueue(mock: MockConnector) {
      mock.enqueue({
        content: JSON.stringify(buildIncidentSpec()),
        model: 'mock-model',
        usage: { promptTokens: 190, completionTokens: 370, totalTokens: 560 },
      });
    },
    getSpec: buildIncidentSpec,
  },
];

export const dashboardScenario: Scenario = {
  id: 'dashboard',
  title: 'Context-Aware Dashboard',
  description: 'Demonstrates the context engine with identity and environment providers driving UI generation.',
  tag: 'Context',
  intent: 'Show a system monitoring dashboard with key metrics for the current user context',
  enqueue,
  getSpec: buildSpec,
  variants,
};
