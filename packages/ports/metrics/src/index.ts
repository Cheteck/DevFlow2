export interface MetricsCollector {
  recordCount(name: string, value: number, tags?: Record<string, string>): void;
  recordGauge(name: string, value: number, tags?: Record<string, string>): void;
}

/**
 * @mosaix/ports-metrics — MetricsPort (OTel-backed meter contract).
 *
 * Implemented by `@mosaix/adapter-metrics-otel`. Attribute values stay
 * JSON-scalar so they satisfy the OpenTelemetry `Attributes` constraint.
 */
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

export interface MetricsPort {
  createCounter(name: string, description?: string): CounterPort;
  createUpDownCounter(name: string, description?: string): UpDownCounterPort;
  createHistogram(name: string, description?: string): HistogramPort;
}
