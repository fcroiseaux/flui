/**
 * Layout type for spatial arrangement of components.
 */
export type LayoutType = 'stack' | 'grid' | 'flex' | 'absolute';

/**
 * Layout direction.
 */
export type LayoutDirection = 'horizontal' | 'vertical';

/**
 * Layout alignment.
 */
export type LayoutAlignment = 'start' | 'center' | 'end' | 'stretch';

/**
 * Component reference with typed props.
 * Represents a single component in a UISpecification.
 */
export interface ComponentSpec {
  /** Unique component identifier used for interactions and reconciliation */
  id: string;
  /** Registered component type name */
  componentType: string;
  /** Component props as key-value pairs */
  props: Record<string, unknown>;
  /** Optional key for component reconciliation */
  key?: string | undefined;
  /** Optional nested child components */
  children?: ComponentSpec[] | undefined;
}

/**
 * Spatial arrangement of components.
 */
export interface LayoutSpec {
  /** Layout strategy */
  type: LayoutType;
  /** Layout direction */
  direction?: LayoutDirection | undefined;
  /** Spacing between items in pixels */
  spacing?: number | undefined;
  /** Alignment of items */
  alignment?: LayoutAlignment | undefined;
  /** Nested layout containers */
  children?: LayoutSpec[] | undefined;
}

/**
 * Data flow wiring between components.
 */
export interface InteractionSpec {
  /** Source component ID */
  source: string;
  /** Target component ID */
  target: string;
  /** Event type that triggers the interaction */
  event: string;
  /** Optional mapping of data fields from source to target */
  dataMapping?: Record<string, string> | undefined;
}

/**
 * Metadata about the generation of a UISpecification.
 */
export interface UISpecificationMetadata {
  /** Timestamp of generation (Unix ms) */
  generatedAt: number;
  /** LLM model used for generation */
  model?: string | undefined;
  /** Hash of the intent that triggered generation */
  intentHash?: string | undefined;
  /** Trace ID for observability */
  traceId?: string | undefined;
  /** Custom metadata key-value pairs */
  custom?: Record<string, unknown> | undefined;
}

/**
 * Root specification type for LLM-generated UIs.
 * Describes UI composition declaratively without executable code.
 */
export interface UISpecification {
  /** Specification format version */
  version: string;
  /** Components to render */
  components: ComponentSpec[];
  /** Spatial layout of components */
  layout: LayoutSpec;
  /** Data flow interactions between components */
  interactions: InteractionSpec[];
  /** Generation metadata */
  metadata: UISpecificationMetadata;
}
