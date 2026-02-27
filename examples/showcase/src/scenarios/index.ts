import type { UISpecification } from '@flui/core';
import type { MockConnector } from '@flui/testing';

export interface Scenario {
  id: string;
  title: string;
  description: string;
  tag: string;
  intent: string;
  supportsRoles?: boolean;
  enqueue(mock: MockConnector, role?: string): void;
  getSpec(role?: string): UISpecification;
}

export { helloWorldScenario } from './hello-world';
export { dashboardScenario } from './dashboard';
export { formInteractionsScenario } from './form-interactions';
export { adaptiveUiScenario } from './adaptive-ui';

import { helloWorldScenario } from './hello-world';
import { dashboardScenario } from './dashboard';
import { formInteractionsScenario } from './form-interactions';
import { adaptiveUiScenario } from './adaptive-ui';

export const scenarios: Scenario[] = [
  helloWorldScenario,
  dashboardScenario,
  formInteractionsScenario,
  adaptiveUiScenario,
];
