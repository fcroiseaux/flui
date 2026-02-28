import {
  createFlui,
  createIdentityProvider,
  createEnvironmentProvider,
  type FluiInstance,
  type LLMConnector,
} from '@flui/core';
import { createMockConnector } from '@flui/testing';
import type { MockConnector } from '@flui/testing';

import { registerComponents } from './components';

export type { MockConnector };

let fluiInstance: FluiInstance | undefined;
let mockConnectorInstance: MockConnector | undefined;

export interface SetupResult {
  flui: FluiInstance;
  mockConnector: MockConnector | undefined;
  isLiveMode: boolean;
}

export async function setupFlui(identityOverride?: {
  role: string;
  permissions: string[];
  expertiseLevel: 'novice' | 'intermediate' | 'expert';
}): Promise<SetupResult> {
  let connector: LLMConnector;
  let isLiveMode = false;
  let mock: MockConnector | undefined;

  const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;

  if (apiKey) {
    try {
      const { createOpenAIConnector } = await import('@flui/openai');
      connector = createOpenAIConnector({ apiKey, dangerouslyAllowBrowser: true });
      isLiveMode = true;
    } catch {
      console.warn('Failed to load @flui/openai, falling back to MockConnector');
      mock = createMockConnector();
      connector = mock;
    }
  } else {
    mock = createMockConnector();
    connector = mock;
  }

  mockConnectorInstance = mock;

  const flui = createFlui({
    connector,
    budget: {
      modelPricing: {
        'mock-model': {
          promptCostPer1kTokens: 0.01,
          completionCostPer1kTokens: 0.03,
        },
        'gpt-4o': {
          promptCostPer1kTokens: 0.005,
          completionCostPer1kTokens: 0.015,
        },
      },
    },
    generation: {
      model: isLiveMode ? 'gpt-4o' : 'mock-model',
    },
  });

  registerComponents(flui.registry);

  flui.context.registerProvider(
    createIdentityProvider(identityOverride ?? {
      role: 'developer',
      permissions: ['read', 'write', 'admin'],
      expertiseLevel: 'intermediate',
    }),
  );

  flui.context.registerProvider(
    createEnvironmentProvider(() => ({
      deviceType: 'desktop' as const,
      viewportSize: { width: window.innerWidth, height: window.innerHeight },
      connectionQuality: 'fast' as const,
    })),
  );

  fluiInstance = flui;
  return { flui, mockConnector: mock, isLiveMode };
}

export function getFlui(): FluiInstance {
  if (!fluiInstance) {
    throw new Error('Flui not initialized. Call setupFlui() first.');
  }
  return fluiInstance;
}

export function getMockConnector(): MockConnector | undefined {
  return mockConnectorInstance;
}
