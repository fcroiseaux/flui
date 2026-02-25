import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  ComponentSpec,
  ErrorCategory,
  FluiErrorCode,
  GenerationTrace,
  InteractionSpec,
  LayoutSpec,
  LLMConnector,
  LLMRequestOptions,
  LLMResponse,
  LLMUsage,
  Result,
  TraceStep,
  UISpecification,
} from './index';

describe('@flui/core', () => {
  it('exports spec module public API', async () => {
    const api = await import('./index');
    const exportedKeys = Object.keys(api);

    // Schema exports
    expect(exportedKeys).toContain('componentSpecSchema');
    expect(exportedKeys).toContain('layoutSpecSchema');
    expect(exportedKeys).toContain('interactionSpecSchema');
    expect(exportedKeys).toContain('uiSpecificationMetadataSchema');
    expect(exportedKeys).toContain('uiSpecificationSchema');

    // Constants
    expect(exportedKeys).toContain('SPEC_VERSION');
  });

  it('exports errors module public API', async () => {
    const api = await import('./index');
    const exportedKeys = Object.keys(api);

    // FluiError class
    expect(exportedKeys).toContain('FluiError');

    // Error codes
    expect(exportedKeys).toContain('FLUI_E001');
    expect(exportedKeys).toContain('FLUI_E002');
    expect(exportedKeys).toContain('FLUI_E003');
    expect(exportedKeys).toContain('FLUI_E004');
    expect(exportedKeys).toContain('FLUI_E005');
    expect(exportedKeys).toContain('FLUI_E006');
    expect(exportedKeys).toContain('FLUI_E007');
    expect(exportedKeys).toContain('FLUI_E008');
    expect(exportedKeys).toContain('FLUI_E009');
    expect(exportedKeys).toContain('FLUI_E010');
    expect(exportedKeys).toContain('ERROR_CODE_DESCRIPTIONS');

    // Result factories and type guards
    expect(exportedKeys).toContain('ok');
    expect(exportedKeys).toContain('err');
    expect(exportedKeys).toContain('error');
    expect(exportedKeys).toContain('isOk');
    expect(exportedKeys).toContain('isError');
  });

  it('supports public type imports from @flui/core barrel', () => {
    expectTypeOf<ComponentSpec>().toBeObject();
    expectTypeOf<LayoutSpec>().toBeObject();
    expectTypeOf<InteractionSpec>().toBeObject();
    expectTypeOf<UISpecification>().toBeObject();
  });

  it('supports errors type imports from @flui/core barrel', () => {
    expectTypeOf<ErrorCategory>().toBeString();
    expectTypeOf<FluiErrorCode>().toBeString();
    expectTypeOf<Result<number>>().toBeObject();
  });

  it('exports types module public API', async () => {
    const api = await import('./index');
    const exportedKeys = Object.keys(api);

    // createTrace factory
    expect(exportedKeys).toContain('createTrace');
  });

  it('supports shared type imports from @flui/core barrel', () => {
    expectTypeOf<LLMConnector>().toBeObject();
    expectTypeOf<LLMResponse>().toBeObject();
    expectTypeOf<LLMRequestOptions>().toBeObject();
    expectTypeOf<LLMUsage>().toBeObject();
    expectTypeOf<GenerationTrace>().toBeObject();
    expectTypeOf<TraceStep>().toBeObject();
  });
});
