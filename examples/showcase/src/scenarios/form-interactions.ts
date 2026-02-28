import { createSpecBuilder } from '@flui/testing';
import type { MockConnector } from '@flui/testing';
import type { Scenario } from './index';

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

export const formInteractionsScenario: Scenario = {
  id: 'form-interactions',
  title: 'Interactive Form',
  description: 'Demonstrates InteractionSpec data wiring between Input, Select, and DataTable components.',
  tag: 'Interactions',
  intent: 'Show a searchable data table with filter inputs wired via InteractionSpec',
  enqueue,
  getSpec: buildSpec,
};
