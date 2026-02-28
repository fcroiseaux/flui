import type { UISpecification } from '@flui/core';
import { createSpecBuilder } from '@flui/testing';
import type { MockConnector } from '@flui/testing';
import type { IntentVariant, Scenario } from './index';

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

/* ── Variant: permission-aware settings ── */
const settingsByRole: Record<string, () => UISpecification> = {
  admin: () =>
    createSpecBuilder()
      .addComponent({
        id: 'heading-1',
        componentType: 'Heading',
        props: { level: 2, text: 'System Configuration', 'aria-live': 'polite' },
      })
      .addComponent({
        id: 'badge-role',
        componentType: 'StatusBadge',
        props: { text: 'Admin', status: 'error', 'aria-live': 'polite' },
      })
      .addComponent({
        id: 'text-intro',
        componentType: 'Text',
        props: { text: 'Full access to all system settings, security policies, and integration configurations.', 'aria-live': 'polite' },
      })
      .addComponent({
        id: 'select-auth',
        componentType: 'Select',
        props: {
          label: 'Auth Provider',
          'aria-label': 'Authentication provider',
          options: [
            { value: 'oauth', label: 'OAuth 2.0' },
            { value: 'saml', label: 'SAML SSO' },
            { value: 'ldap', label: 'LDAP' },
          ],
        },
      })
      .addComponent({
        id: 'select-mfa',
        componentType: 'Select',
        props: {
          label: 'MFA Policy',
          'aria-label': 'Multi-factor authentication policy',
          options: [
            { value: 'required', label: 'Required for All' },
            { value: 'optional', label: 'Optional' },
            { value: 'admin-only', label: 'Admins Only' },
          ],
        },
      })
      .addComponent({
        id: 'btn-save',
        componentType: 'Button',
        props: { label: 'Save Configuration', variant: 'primary', 'aria-label': 'Save Configuration' },
      })
      .addComponent({
        id: 'btn-reset',
        componentType: 'Button',
        props: { label: 'Reset to Defaults', variant: 'danger', 'aria-label': 'Reset to Defaults' },
      })
      .withLayout({ type: 'stack', direction: 'vertical', spacing: 12 })
      .withMetadata({ model: 'mock-model' })
      .build(),

  editor: () =>
    createSpecBuilder()
      .addComponent({
        id: 'heading-1',
        componentType: 'Heading',
        props: { level: 2, text: 'Profile Settings', 'aria-live': 'polite' },
      })
      .addComponent({
        id: 'badge-role',
        componentType: 'StatusBadge',
        props: { text: 'Editor', status: 'warning', 'aria-live': 'polite' },
      })
      .addComponent({
        id: 'text-intro',
        componentType: 'Text',
        props: { text: 'You can update your personal settings. System-wide configuration requires admin access.', 'aria-live': 'polite' },
      })
      .addComponent({
        id: 'input-name',
        componentType: 'Input',
        props: { label: 'Display Name', placeholder: 'Your display name', type: 'text', 'aria-label': 'Display Name' },
      })
      .addComponent({
        id: 'select-theme',
        componentType: 'Select',
        props: {
          label: 'Theme',
          'aria-label': 'Interface theme',
          options: [
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
            { value: 'auto', label: 'System' },
          ],
        },
      })
      .addComponent({
        id: 'btn-save',
        componentType: 'Button',
        props: { label: 'Update Profile', variant: 'primary', 'aria-label': 'Update Profile' },
      })
      .withLayout({ type: 'stack', direction: 'vertical', spacing: 12 })
      .withMetadata({ model: 'mock-model' })
      .build(),

  viewer: () =>
    createSpecBuilder()
      .addComponent({
        id: 'heading-1',
        componentType: 'Heading',
        props: { level: 2, text: 'Account Info', 'aria-live': 'polite' },
      })
      .addComponent({
        id: 'badge-role',
        componentType: 'StatusBadge',
        props: { text: 'Viewer', status: 'info', 'aria-live': 'polite' },
      })
      .addComponent({
        id: 'text-intro',
        componentType: 'Text',
        props: { text: 'Read-only view of your account information. Contact an admin to request changes.', 'aria-live': 'polite' },
      })
      .addComponent({
        id: 'card-info',
        componentType: 'Card',
        props: { title: 'Account Details', subtitle: 'Last updated 2 days ago' },
        children: [
          {
            id: 'text-email',
            componentType: 'Text',
            props: { text: 'Email: viewer@company.dev', 'aria-live': 'polite' },
          },
          {
            id: 'text-joined',
            componentType: 'Text',
            props: { text: 'Joined: January 2026', variant: 'caption', 'aria-live': 'polite' },
          },
        ],
      })
      .withLayout({ type: 'stack', direction: 'vertical', spacing: 12 })
      .withMetadata({ model: 'mock-model' })
      .build(),
};

const variants: IntentVariant[] = [
  {
    label: 'Permission-aware settings',
    intent: 'Show a settings page where available options depend on the user role',
    enqueue(mock: MockConnector, role?: string) {
      const key = role ?? 'admin';
      const builder = settingsByRole[key] ?? settingsByRole.admin;
      mock.enqueue({
        content: JSON.stringify(builder!()),
        model: 'mock-model',
        usage: { promptTokens: 160, completionTokens: 340, totalTokens: 500 },
      });
    },
    getSpec(role?: string) {
      const key = role ?? 'admin';
      const builder = settingsByRole[key] ?? settingsByRole.admin;
      return builder!();
    },
  },
];

export const adaptiveUiScenario: Scenario = {
  id: 'adaptive-ui',
  title: 'Role-Adaptive UI',
  description: 'Switching user roles re-triggers generation with different specs. Admin sees controls, viewer sees read-only.',
  tag: 'Adaptive',
  intent: 'Show a role-appropriate interface for the current user',
  supportsRoles: true,
  enqueue,
  getSpec: buildSpec,
  variants,
};
