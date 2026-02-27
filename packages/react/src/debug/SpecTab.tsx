import type { ComponentSpec, InteractionSpec, LayoutSpec, UISpecification } from '@flui/core';
import type { CSSProperties, ReactNode } from 'react';

/* ---------- Styles ---------- */

const sectionStyle: CSSProperties = {
  marginBottom: '8px',
};

const summaryStyle: CSSProperties = {
  cursor: 'pointer',
  fontWeight: 'bold',
  color: '#89b4fa',
  padding: '4px 0',
};

const propsStyle: CSSProperties = {
  background: '#11111b',
  padding: '8px',
  borderRadius: '4px',
  overflow: 'auto',
  fontSize: '12px',
  margin: '4px 0',
  color: '#a6e3a1',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const metadataLabelStyle: CSSProperties = {
  color: '#89b4fa',
  marginRight: '8px',
};

const metadataValueStyle: CSSProperties = {
  color: '#a6e3a1',
};

const metadataRowStyle: CSSProperties = {
  padding: '2px 0',
};

const interactionRowStyle: CSSProperties = {
  padding: '4px 0',
  borderBottom: '1px solid #313244',
};

const emptyStateStyle: CSSProperties = {
  color: '#6c7086',
  fontStyle: 'italic',
  padding: '16px',
  textAlign: 'center',
};

const childBadgeStyle: CSSProperties = {
  color: '#f9e2af',
  fontSize: '11px',
  marginLeft: '4px',
};

/* ---------- Component tree renderer ---------- */

function renderComponentNode(component: ComponentSpec, depth: number): ReactNode {
  return (
    <div
      key={component.id}
      style={{ paddingLeft: `${depth * 16}px` }}
      data-flui-debug-component={component.id}
    >
      <details>
        <summary style={summaryStyle}>
          <strong>{component.componentType}</strong> <code>#{component.id}</code>
          {component.children?.length ? (
            <span style={childBadgeStyle}>({component.children.length} children)</span>
          ) : null}
        </summary>
        <pre style={propsStyle}>{JSON.stringify(component.props, null, 2)}</pre>
        {component.children?.map((child) => renderComponentNode(child, depth + 1))}
      </details>
    </div>
  );
}

/* ---------- Section renderers ---------- */

function renderMetadata(spec: UISpecification): ReactNode {
  const { metadata } = spec;

  return (
    <details open style={sectionStyle}>
      <summary style={summaryStyle}>Metadata</summary>
      <div style={metadataRowStyle}>
        <span style={metadataLabelStyle}>version:</span>
        <span style={metadataValueStyle}>{spec.version}</span>
      </div>
      <div style={metadataRowStyle}>
        <span style={metadataLabelStyle}>generatedAt:</span>
        <span style={metadataValueStyle}>{new Date(metadata.generatedAt).toLocaleString()}</span>
      </div>
      {metadata.model && (
        <div style={metadataRowStyle}>
          <span style={metadataLabelStyle}>model:</span>
          <span style={metadataValueStyle}>{metadata.model}</span>
        </div>
      )}
      {metadata.traceId && (
        <div style={metadataRowStyle}>
          <span style={metadataLabelStyle}>traceId:</span>
          <span style={metadataValueStyle}>{metadata.traceId}</span>
        </div>
      )}
    </details>
  );
}

function renderLayout(layout: LayoutSpec): ReactNode {
  return (
    <details style={sectionStyle}>
      <summary style={summaryStyle}>Layout</summary>
      <pre style={propsStyle}>{JSON.stringify(layout, null, 2)}</pre>
    </details>
  );
}

function renderInteractions(interactions: InteractionSpec[]): ReactNode {
  if (interactions.length === 0) return null;
  return (
    <details style={sectionStyle}>
      <summary style={summaryStyle}>Interactions ({interactions.length})</summary>
      {interactions.map((interaction, idx) => (
        <div key={`${interaction.source}-${interaction.target}-${idx}`} style={interactionRowStyle}>
          <code>{interaction.source}</code>
          {' → '}
          <code>{interaction.target}</code>
          <span style={metadataLabelStyle}> [{interaction.event}]</span>
        </div>
      ))}
    </details>
  );
}

/* ---------- SpecTab component ---------- */

/**
 * Spec tab displays the current UISpecification in a structured, readable format.
 * Shows component hierarchy, metadata, layout, and interactions.
 */
export function SpecTab({ spec }: { spec: UISpecification | null }): ReactNode {
  if (!spec) {
    return <div style={emptyStateStyle}>No specification generated yet</div>;
  }

  return (
    <div data-flui-debug-spec>
      {renderMetadata(spec)}
      <details open style={sectionStyle}>
        <summary style={summaryStyle}>Components ({spec.components.length})</summary>
        {spec.components.map((component) => renderComponentNode(component, 0))}
      </details>
      {renderLayout(spec.layout)}
      {renderInteractions(spec.interactions)}
    </div>
  );
}
