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

      // Accessibility requirements — with per-component examples from the registry
      const ariaExamples = buildAriaExamples(input.registry.components);
      sections.push(`ACCESSIBILITY (WCAG 2.1 AA) — MANDATORY ARIA PROPS:
Every component MUST include the ARIA props required by its category. The spec WILL BE REJECTED if any are missing.

Rules by category:
- "display": MUST include "aria-live": "polite" in props.
- "input" / "form": MUST include "aria-label": "<descriptive text>" in props.
- "interactive": MUST include "aria-label" OR a visible text prop ("label", "text") in props.
- "data": MUST include "aria-label": "<descriptive text>" AND "columns": ["col1", "col2"] in props.
- "image": MUST include "alt": "<description>" in props.
- "navigation": MUST include "role": "navigation" in props.
- "layout": no ARIA requirements.

${ariaExamples}
CRITICAL: Omitting these ARIA props is the most common cause of rejected specs. Always include them.`);

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

const ARIA_REQUIREMENT_BY_CATEGORY: Record<string, string> = {
  display: '"aria-live": "polite"',
  input: '"aria-label": "<descriptive label>"',
  form: '"aria-label": "<descriptive label>"',
  interactive: '"aria-label": "<descriptive label>" (or visible "label"/"text" prop)',
  data: '"aria-label": "<descriptive label>", "columns": ["Col1", "Col2"]',
  image: '"alt": "<image description>"',
  navigation: '"role": "navigation"',
};

function buildAriaExamples(
  components: { name: string; category: string }[],
): string {
  const lines: string[] = [];
  for (const comp of components) {
    const req = ARIA_REQUIREMENT_BY_CATEGORY[comp.category];
    if (req) {
      lines.push(`- ${comp.name} (${comp.category}): props MUST contain ${req}`);
    }
  }
  if (lines.length === 0) return '';
  return `Required ARIA props for each registered component:\n${lines.join('\n')}\n`;
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
