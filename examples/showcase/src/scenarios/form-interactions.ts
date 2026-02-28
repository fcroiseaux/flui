import { createSpecBuilder } from '@flui/testing';
import type { MockConnector } from '@flui/testing';
import type { IntentVariant, Scenario } from './index';

function buildSpec() {
  return createSpecBuilder()
    .addComponent({
      id: 'heading-1',
      componentType: 'Heading',
      props: { level: 2, text: 'Interactive Data Filter', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'text-intro',
      componentType: 'Text',
      props: { text: 'Type in the search field below — the InteractionSpec wires the input event directly to the data table, updating it in real time.', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'search-input',
      componentType: 'Input',
      props: { label: 'Search', placeholder: 'Filter by name...', type: 'text', 'aria-label': 'Search components' },
    })
    .addComponent({
      id: 'category-select',
      componentType: 'Select',
      props: {
        label: 'Category',
        'aria-label': 'Filter by category',
        options: [
          { value: 'all', label: 'All Categories' },
          { value: 'display', label: 'Display' },
          { value: 'input', label: 'Input' },
          { value: 'data', label: 'Data' },
          { value: 'layout', label: 'Layout' },
        ],
      },
    })
    .addComponent({
      id: 'results-table',
      componentType: 'DataTable',
      props: {
        'aria-label': 'Component registry',
        columns: ['Name', 'Category', 'Description'],
        rows: [
          { Name: 'Heading', Category: 'display', Description: 'Renders h1-h6 elements' },
          { Name: 'Text', Category: 'display', Description: 'Text content with variants' },
          { Name: 'Button', Category: 'input', Description: 'Interactive button' },
          { Name: 'Card', Category: 'layout', Description: 'Container with title' },
          { Name: 'Input', Category: 'input', Description: 'Text input field' },
          { Name: 'Select', Category: 'input', Description: 'Dropdown selector' },
          { Name: 'DataTable', Category: 'data', Description: 'Tabular data display' },
          { Name: 'MetricCard', Category: 'data', Description: 'Metric with trend' },
          { Name: 'StatusBadge', Category: 'display', Description: 'Status indicator' },
        ],
      },
    })
    .addComponent({
      id: 'badge-wired',
      componentType: 'StatusBadge',
      props: { text: 'Interactions Active', status: 'info', 'aria-live': 'polite' },
    })
    .addInteraction({
      source: 'search-input',
      target: 'results-table',
      event: 'onChange',
      dataMapping: { value: 'data' },
    })
    .addInteraction({
      source: 'category-select',
      target: 'results-table',
      event: 'onChange',
      dataMapping: { value: 'data' },
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
    usage: { promptTokens: 180, completionTokens: 420, totalTokens: 600 },
  });
}

/* ── Variant: contact form ── */
function buildContactSpec() {
  return createSpecBuilder()
    .addComponent({
      id: 'heading-1',
      componentType: 'Heading',
      props: { level: 2, text: 'Contact Us', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'text-intro',
      componentType: 'Text',
      props: { text: 'Fill out the form below and we\'ll get back to you within 24 hours.', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'input-name',
      componentType: 'Input',
      props: { label: 'Full Name', placeholder: 'Jane Doe', type: 'text', 'aria-label': 'Full Name' },
    })
    .addComponent({
      id: 'input-email',
      componentType: 'Input',
      props: { label: 'Email', placeholder: 'jane@example.com', type: 'email', 'aria-label': 'Email address' },
    })
    .addComponent({
      id: 'select-topic',
      componentType: 'Select',
      props: {
        label: 'Topic',
        'aria-label': 'Select topic',
        options: [
          { value: 'general', label: 'General Inquiry' },
          { value: 'support', label: 'Technical Support' },
          { value: 'billing', label: 'Billing' },
          { value: 'partnership', label: 'Partnership' },
        ],
      },
    })
    .addComponent({
      id: 'btn-submit',
      componentType: 'Button',
      props: { label: 'Send Message', variant: 'primary', 'aria-label': 'Send Message' },
    })
    .withLayout({ type: 'stack', direction: 'vertical', spacing: 12 })
    .withMetadata({ model: 'mock-model' })
    .build();
}

/* ── Variant: settings form ── */
function buildSettingsSpec() {
  return createSpecBuilder()
    .addComponent({
      id: 'heading-1',
      componentType: 'Heading',
      props: { level: 2, text: 'Notification Settings', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'text-intro',
      componentType: 'Text',
      props: { text: 'Configure how and when you receive notifications from the platform.', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'select-frequency',
      componentType: 'Select',
      props: {
        label: 'Email Frequency',
        'aria-label': 'Email notification frequency',
        options: [
          { value: 'realtime', label: 'Real-time' },
          { value: 'daily', label: 'Daily Digest' },
          { value: 'weekly', label: 'Weekly Summary' },
          { value: 'none', label: 'Disabled' },
        ],
      },
    })
    .addComponent({
      id: 'select-channel',
      componentType: 'Select',
      props: {
        label: 'Preferred Channel',
        'aria-label': 'Preferred notification channel',
        options: [
          { value: 'email', label: 'Email' },
          { value: 'slack', label: 'Slack' },
          { value: 'both', label: 'Both' },
        ],
      },
    })
    .addComponent({
      id: 'badge-status',
      componentType: 'StatusBadge',
      props: { text: 'Notifications Active', status: 'success', 'aria-live': 'polite' },
    })
    .addComponent({
      id: 'btn-save',
      componentType: 'Button',
      props: { label: 'Save Preferences', variant: 'primary', 'aria-label': 'Save Preferences' },
    })
    .withLayout({ type: 'stack', direction: 'vertical', spacing: 12 })
    .withMetadata({ model: 'mock-model' })
    .build();
}

const variants: IntentVariant[] = [
  {
    label: 'Contact form',
    intent: 'Show a contact form with name, email, topic selector, and submit button',
    enqueue(mock: MockConnector) {
      mock.enqueue({
        content: JSON.stringify(buildContactSpec()),
        model: 'mock-model',
        usage: { promptTokens: 170, completionTokens: 350, totalTokens: 520 },
      });
    },
    getSpec: buildContactSpec,
  },
  {
    label: 'Notification settings',
    intent: 'Show a notification settings form with frequency and channel preferences',
    enqueue(mock: MockConnector) {
      mock.enqueue({
        content: JSON.stringify(buildSettingsSpec()),
        model: 'mock-model',
        usage: { promptTokens: 160, completionTokens: 320, totalTokens: 480 },
      });
    },
    getSpec: buildSettingsSpec,
  },
];

export const formInteractionsScenario: Scenario = {
  id: 'form-interactions',
  title: 'Interactive Form',
  description: 'Demonstrates InteractionSpec data wiring between Input, Select, and DataTable components.',
  tag: 'Interactions',
  intent: 'Show a searchable data table with filter inputs wired via InteractionSpec',
  enqueue,
  getSpec: buildSpec,
  variants,
};
