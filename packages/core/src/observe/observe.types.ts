import type { GenerationTrace } from '../types';

/**
 * Interface for trace transport destinations.
 * Transports receive completed traces asynchronously.
 */
export interface TraceTransport {
  name: string;
  send(trace: GenerationTrace): Promise<void>;
}

/**
 * Declarative configuration for PII field redaction.
 * Field paths use dot-notation to traverse trace step metadata.
 */
export interface RedactionConfig {
  fieldPaths: string[];
}

/**
 * Configuration for the observability collector.
 */
export interface ObservabilityCollectorConfig {
  transports?: TraceTransport[] | undefined;
  redaction?: RedactionConfig | undefined;
  bufferSize?: number | undefined;
}

/**
 * Collector that receives completed GenerationTrace instances
 * and fans them out to configured transports with optional PII redaction.
 */
export interface ObservabilityCollector {
  collect(trace: GenerationTrace): void;
  getBufferedTraces(): readonly GenerationTrace[];
  clearBuffer(): void;
  addTransport(transport: TraceTransport): void;
  removeTransport(name: string): void;
}
