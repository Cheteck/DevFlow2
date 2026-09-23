# @mosaix/ports-metrics

Metrics port for the MosaiX platform. Decouples application metrics collection from telemetry providers (OpenTelemetry, Prometheus, etc.).

## Exports

```typescript
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
```

## Notes

- Counter = monotonically increasing.
- UpDownCounter = can go up and down (e.g. in-flight requests).
- Histogram = records distributions of values (e.g. latencies).

## Usage

```typescript
import type { MetricsPort } from "@mosaix/ports-metrics";

class MyService {
  private readonly reqCounter;

  constructor(private readonly metrics: MetricsPort) {
    this.reqCounter = this.metrics.createCounter(
      "http_requests",
      "Total requests count",
    );
  }

  handle() {
    this.reqCounter.add(1, { path: "/users" });
  }
}
```

## Adapters

- [`@mosaix/adapter-metrics-otel`](../../adapters/metrics-otel) — OpenTelemetry Metrics API.
