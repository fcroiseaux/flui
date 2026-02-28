import type { UISpecification } from '@flui/core';
import { createSpecBuilder } from '@flui/testing';
import type { MockConnector } from '@flui/testing';
import type { Scenario } from './index';

const specsByRole: Record<string, () => UISpecification> = {
  admin: () =>
    createSpecBuilder()
      .addComponent({
        id: 'heading-1',
        componentType: 'Heading',
        props: { level: 2, text: 'Admin Control Panel', 'aria-live': 'polite' },
      })
      .addComponent({
        id: 'badge-role',
        componentType: 'StatusBadge',
        props: { text: 'Admin', status: 'error', 'aria-live': 'polite' },
      })
      .addComponent({
        id: 'text-intro',
        componentType: 'Text',
        props: { text: 'Full administrative access. All system controls and data management tools are visible.', 'aria-live': 'polite' },
      })
      .addComponent({
        id: 'metric-1',
        componentType: 'MetricCard',
        props: { label: 'Total Users', value: '45,231', trend: 'up', 'aria-label': 'Total Users: 45,231', 'aria-live': 'polite' },
      })
      .addComponent({
        id: 'metric-2',
        componentType: 'MetricCard',
        props: { label: 'Revenue', value: '$128K', trend: 'up', 'aria-label': 'Revenue: $128K', 'aria-live': 'polite' },
      })
      .addComponent({
        id: 'table-1',
        componentType: 'DataTable',
        props: {
          'aria-label': 'User management',
          columns: ['User', 'Role', 'Status', 'Actions'],
          rows: [
            { User: 'alice@co.dev', Role: 'editor', Status: 'active', Actions: 'edit / delete' },
            { User: 'bob@co.dev', Role: 'viewer', Status: 'active', Actions: 'edit / delete' },
            { User: 'carol@co.dev', Role: 'admin', Status: 'suspended', Actions: 'edit / restore' },
          ],
        },
      })
      .addComponent({
        id: 'btn-danger',
        componentType: 'Button',
        props: { label: 'Reset All Sessions', variant: 'danger', 'aria-label': 'Reset All Sessions' },
      })
      .withLayout({ type: 'stack', direction: 'vertical', spacing: 12 })
      .withMetadata({ model: 'mock-model' })
      .build(),

  editor: () =>
    createSpecBuilder()
      .addComponent({
        id: 'heading-1',
        componentType: 'Heading',
        props: { level: 2, text: 'Editor Workspace', 'aria-live': 'polite' },
      })
      .addComponent({
        id: 'badge-role',
        componentType: 'StatusBadge',
        props: { text: 'Editor', status: 'warning', 'aria-live': 'polite' },
      })
      .addComponent({
        id: 'text-intro',
        componentType: 'Text',
        props: { text: 'Content editing access. You can create and modify entries but cannot manage users or system settings.', 'aria-live': 'polite' },
      })
      .addComponent({
        id: 'card-drafts',
        componentType: 'Card',
        props: { title: 'Recent Drafts', subtitle: '3 unpublished items' },
        children: [
          {
            id: 'table-drafts',
            componentType: 'DataTable',
            props: {
              'aria-label': 'Recent drafts',
              columns: ['Title', 'Modified', 'Status'],
              rows: [
                { Title: 'Getting Started Guide', Modified: '2 hours ago', Status: 'draft' },
                { Title: 'API Reference v2', Modified: '1 day ago', Status: 'review' },
                { Title: 'Migration Notes', Modified: '3 days ago', Status: 'draft' },
              ],
            },
          },
        ],
      })
      .addComponent({
        id: 'btn-new',
        componentType: 'Button',
        props: { label: 'New Draft', variant: 'primary', 'aria-label': 'New Draft' },
      })
      .withLayout({ type: 'stack', direction: 'vertical', spacing: 12 })
      .withMetadata({ model: 'mock-model' })
      .build(),

  viewer: () =>
    createSpecBuilder()
      .addComponent({
        id: 'heading-1',
        componentType: 'Heading',
        props: { level: 2, text: 'Viewer Dashboard', 'aria-live': 'polite' },
      })
      .addComponent({
        id: 'badge-role',
        componentType: 'StatusBadge',
        props: { text: 'Viewer', status: 'info', 'aria-live': 'polite' },
      })
      .addComponent({
        id: 'text-intro',
        componentType: 'Text',
        props: { text: 'Read-only access. You can view reports and published content. Editing controls are hidden.', 'aria-live': 'polite' },
      })
      .addComponent({
        id: 'card-reports',
        componentType: 'Card',
        props: { title: 'Published Reports', subtitle: 'Read-only view' },
        children: [
          {
            id: 'table-reports',
            componentType: 'DataTable',
            props: {
              'aria-label': 'Published reports',
              columns: ['Report', 'Published', 'Author'],
              rows: [
                { Report: 'Q4 Summary', Published: 'Jan 15', Author: 'alice' },
                { Report: 'Annual Review', Published: 'Jan 02', Author: 'bob' },
              ],
            },
          },
        ],
      })
      .addComponent({
        id: 'text-notice',
        componentType: 'Text',
        props: { text: 'Contact an admin to request editing permissions.', variant: 'caption', 'aria-live': 'polite' },
      })
      .withLayout({ type: 'stack', direction: 'vertical', spacing: 12 })
      .withMetadata({ model: 'mock-model' })
      .build(),
};

function buildSpec(role?: string): UISpecification {
  const key = role ?? 'admin';
  const builder = specsByRole[key] ?? specsByRole.admin;
  return builder!();
}

function enqueue(mock: MockConnector, role?: string): void {
  const spec = buildSpec(role);
  mock.enqueue({
    content: JSON.stringify(spec),
    model: 'mock-model',
    usage: { promptTokens: 150, completionTokens: 350, totalTokens: 500 },
  });
}

export const adaptiveUiScenario: Scenario = {
  id: 'adaptive-ui',
  title: 'Role-Adaptive UI',
  description: 'Switching user roles re-triggers generation with different specs. Admin sees controls, viewer sees read-only.',
  tag: 'Adaptive',
  intent: 'Show a role-appropriate interface for the current user',
  supportsRoles: true,
  enqueue,
  getSpec: buildSpec,
};
