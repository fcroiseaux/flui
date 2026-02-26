import type { ReactNode } from 'react';

import { useFluiContext } from './FluiProvider';
import { useLiquidView } from './hooks';
import type { LiquidViewProps } from './react.types';
import { renderSpec } from './renderer';

/**
 * LiquidView renders LLM-generated UI specifications into React components.
 *
 * Requires a mandatory `fallback` prop that is rendered during loading, validation,
 * and error states. Must be placed within a FluiProvider.
 *
 * State progression: idle → generating → validating → rendering | error
 */
export function LiquidView({
  intent,
  context,
  data,
  fallback,
  onStateChange,
  onError,
  className,
  style,
}: LiquidViewProps): ReactNode {
  const ctx = useFluiContext();
  const { state } = useLiquidView(
    { intent, context, data, onStateChange, onError },
    ctx,
  );

  let content: ReactNode;
  switch (state.status) {
    case 'idle':
      content = null;
      break;
    case 'generating':
    case 'validating':
      content = fallback;
      break;
    case 'rendering':
      content = renderSpec(state.spec, ctx.registry);
      break;
    case 'error':
      content = fallback;
      break;
  }

  if (className || style) {
    return <div className={className} style={style}>{content}</div>;
  }

  return content;
}
