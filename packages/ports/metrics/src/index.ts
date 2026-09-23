export type MetricAttributes = Record<string, string | number | boolean>;

export interface CounterPort {
  add(value: number, attributes?: MetricAttributes): void;
}

export interface UpDownCounterPort {
  add(value: number, attributes?: MetricAttributes): void;
}

export interface HistogramPort {
  record(value: number, attributes?: MetricAttributes): void;
}

/**
 * MetricsPort — Decouples application metrics collection from telemetry providers.
 */
export interface MetricsPort {
  /** Creates or returns a Counter metric. */
  createCounter(name: string, description?: string): CounterPort;
  /** Creates or returns an UpDownCounter metric. */
  createUpDownCounter(name: string, description?: string): UpDownCounterPort;
  /** Creates or returns a Histogram metric. */
  createHistogram(name: string, description?: string): HistogramPort;
}
