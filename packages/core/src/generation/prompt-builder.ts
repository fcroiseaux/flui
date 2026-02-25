import { SPEC_VERSION } from '../spec';
import type { GenerationInput, PromptBuilder } from './generation.types';

function toCompactJson(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Creates a PromptBuilder that constructs structured prompts for LLM generation.
 */
export function createPromptBuilder(): PromptBuilder {
  return {
    build(input: GenerationInput): string {
      const sections: string[] = [];

      // System instructions
      sections.push(`You are a UI specification generator. Your task is to produce a valid JSON UISpecification object.

RULES:
- Output ONLY valid JSON matching the UISpecification schema below.
- Do NOT include markdown, code fences, or any explanation.
- Use ONLY components from the available registry.
- Include at least one component in the "components" array.
- Include valid "layout" and "interactions" arrays.
- Set "metadata.generatedAt" to 0 (will be overridden by the system).`);

      // Available components
      sections.push(`AVAILABLE COMPONENTS:
Registry Version: ${input.registry.version}
${toCompactJson(input.registry.components)}`);

      // Context signals
      const contextKeys = Object.keys(input.context);
      if (contextKeys.length > 0) {
        sections.push(`CONTEXT:
${toCompactJson(input.context)}`);
      }

      // Intent
      sections.push(`INTENT:
Text: ${input.intent.sanitizedText}${formatSignals(input.intent)}`);

      // Output contract
      sections.push(`OUTPUT SCHEMA (UISpecification):
{
  "version": "${SPEC_VERSION}",
  "components": [
    {
      "id": "string (unique identifier)",
      "componentType": "string (must match a registered component name)",
      "props": { "key": "value pairs matching component schema" },
      "key": "string (optional, for reconciliation)",
      "children": "ComponentSpec[] (optional, nested components)"
    }
  ],
  "layout": {
    "type": "stack | grid | flex | absolute",
    "direction": "horizontal | vertical (optional)",
    "spacing": "number (optional, pixels)",
    "alignment": "start | center | end | stretch (optional)",
    "children": "LayoutSpec[] (optional, nested layouts)"
  },
  "interactions": [
    {
      "source": "string (source component id)",
      "target": "string (target component id)",
      "event": "string (event type)",
      "dataMapping": "Record<string, string> (optional)"
    }
  ],
  "metadata": {
    "generatedAt": 0,
    "model": "string (optional)",
    "intentHash": "string (optional)",
    "traceId": "string (optional)",
    "custom": "Record<string, unknown> (optional)"
  }
}`);

      return sections.join('\n\n');
    },
  };
}

function formatSignals(intent: GenerationInput['intent']): string {
  const parts: string[] = [];
  if (intent.signals.componentType) {
    parts.push(`Component Type: ${intent.signals.componentType}`);
  }
  if (intent.signals.dataShape) {
    parts.push(`Data Shape: ${JSON.stringify(intent.signals.dataShape)}`);
  }
  if (intent.signals.interactionPattern) {
    parts.push(`Interaction Pattern: ${intent.signals.interactionPattern}`);
  }
  return parts.length > 0 ? `\n${parts.join('\n')}` : '';
}
