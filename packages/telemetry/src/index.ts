/**
 * @mosaix/telemetry — Metrics & OTLP Trace Exporter
 */

export interface OtlpTraceExporterConfig {
  endpoint?: string;
  headers?: Record<string, string>;
  batchSize?: number;
}

export interface SpanData {
  traceId: string;
  spanId: string;
  name: string;
  startTime: number;
  durationMs: number;
  attributes: Record<string, string>;
}

export class OtlpTraceExporter {
  private config: OtlpTraceExporterConfig = {};
  private spans: SpanData[] = [];

  configure(config: OtlpTraceExporterConfig): void {
    this.config = { ...this.config, ...config };
  }

  async exportSpan(span: SpanData): Promise<void> {
    this.spans.push(span);
    if (this.spans.length >= (this.config.batchSize ?? 100)) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.spans.length === 0) return;
    const batch = [...this.spans];
    this.spans = [];
    if (!this.config.endpoint) return;
    try {
      if (typeof fetch !== "undefined") {
        await fetch(this.config.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.config.headers ?? {}),
          },
          body: JSON.stringify({ spans: batch }),
        });
      }
    } catch {
      // silently ignore telemetry failures in sandbox
    }
  }
}

export const otlpTraceExporter = new OtlpTraceExporter();

export interface MetricsState {
  requestsTotal: number;
  requestsByStatus: Record<number, number>;
  compositionMetrics: Record<string, unknown>;
}

export const metricsState: MetricsState = {
  requestsTotal: 0,
  requestsByStatus: {},
  compositionMetrics: {},
};

export function incrementRequestCounter(statusCode: number = 200): void {
  metricsState.requestsTotal += 1;
  metricsState.requestsByStatus[statusCode] = (metricsState.requestsByStatus[statusCode] ?? 0) + 1;
}

export function setCompositionMetrics(metrics: Record<string, unknown>): void {
  metricsState.compositionMetrics = { ...metrics };
}
