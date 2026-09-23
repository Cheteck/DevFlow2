# @mosaix/adapter-metrics-otel

OpenTelemetry metrics adapter implementing [`MetricsPort`](../../ports/metrics), built on `@opentelemetry/api`.

## Constructor

```typescript
new OtelMetricsAdapter(meterName?: string, version?: string);
```

Defaults to the meter name `"mosaix-meter"`.

## Features

- `createCounter` — monotonically increasing counter.
- `createUpDownCounter` — counter that can increase and decrease.
- `createHistogram` — value distribution recorder.
- The returned instruments forward `add`/`record` calls (with optional attributes) to the OpenTelemetry meter.

## Usage

```typescript
import { OtelMetricsAdapter } from "@mosaix/adapter-metrics-otel";

const metrics = new OtelMetricsAdapter("my-service");
const counter = metrics.createCounter("http_requests", "Total requests");
counter.add(1, { route: "/index" });

const histogram = metrics.createHistogram("request_duration_ms");
histogram.record(42);
```

## Related

- Port: [`@mosaix/ports-metrics`](../../ports/metrics)
