import {
  metrics,
  type Meter,
  type Counter,
  type UpDownCounter,
  type Histogram,
} from "@opentelemetry/api";
import type {
  MetricsPort,
  CounterPort,
  UpDownCounterPort,
  HistogramPort,
  MetricAttributes,
} from "@mosaix/ports-metrics";

class OtelCounter implements CounterPort {
  constructor(private readonly otelCounter: Counter<MetricAttributes>) {}
  add(value: number, attributes?: MetricAttributes): void {
    this.otelCounter.add(value, attributes);
  }
}

class OtelUpDownCounter implements UpDownCounterPort {
  constructor(private readonly otelCounter: UpDownCounter<MetricAttributes>) {}
  add(value: number, attributes?: MetricAttributes): void {
    this.otelCounter.add(value, attributes);
  }
}

class OtelHistogram implements HistogramPort {
  constructor(private readonly otelHistogram: Histogram<MetricAttributes>) {}
  record(value: number, attributes?: MetricAttributes): void {
    this.otelHistogram.record(value, attributes);
  }
}

export class OtelMetricsAdapter implements MetricsPort {
  private readonly meter: Meter;

  constructor(meterName: string = "mosaix-meter", version?: string) {
    this.meter = metrics.getMeter(meterName, version);
  }

  createCounter(name: string, description?: string): CounterPort {
    const opts = description !== undefined ? { description } : {};
    const counter = this.meter.createCounter(name, opts);
    return new OtelCounter(counter);
  }

  createUpDownCounter(name: string, description?: string): UpDownCounterPort {
    const opts = description !== undefined ? { description } : {};
    const counter = this.meter.createUpDownCounter(name, opts);
    return new OtelUpDownCounter(counter);
  }

  createHistogram(name: string, description?: string): HistogramPort {
    const opts = description !== undefined ? { description } : {};
    const histogram = this.meter.createHistogram(name, opts);
    return new OtelHistogram(histogram);
  }
}
