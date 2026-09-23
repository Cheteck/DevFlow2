import { trace, type Tracer, type Span } from "@opentelemetry/api";
import type {
  TracingPort,
  SpanPort,
  SpanAttributes,
} from "@mosaix/ports-tracing";

class OtelSpan implements SpanPort {
  constructor(private readonly otelSpan: Span) {}

  setAttributes(attributes: SpanAttributes): void {
    this.otelSpan.setAttributes(attributes);
  }

  setAttribute(key: string, value: string | number | boolean): void {
    this.otelSpan.setAttribute(key, value);
  }

  recordException(error: Error | unknown): void {
    if (error instanceof Error) {
      this.otelSpan.recordException(error);
    } else {
      this.otelSpan.recordException(new Error(String(error)));
    }
  }

  end(): void {
    this.otelSpan.end();
  }
}

export class OtelTracingAdapter implements TracingPort {
  private readonly tracer: Tracer;

  constructor(tracerName: string = "mosaix-tracer", version?: string) {
    this.tracer = trace.getTracer(tracerName, version);
  }

  startActiveSpan<T>(
    name: string,
    callback: (span: SpanPort) => T,
    options?: { attributes?: SpanAttributes },
  ): T {
    const spanOpts =
      options?.attributes !== undefined
        ? { attributes: options.attributes }
        : {};
    return this.tracer.startActiveSpan(name, spanOpts, (span: Span) => {
      const adapterSpan = new OtelSpan(span);
      try {
        const result = callback(adapterSpan);
        return result;
      } catch (error) {
        adapterSpan.recordException(error);
        throw error;
      } finally {
        adapterSpan.end();
      }
    });
  }

  async startActiveSpanAsync<T>(
    name: string,
    callback: (span: SpanPort) => Promise<T>,
    options?: { attributes?: SpanAttributes },
  ): Promise<T> {
    const spanOpts =
      options?.attributes !== undefined
        ? { attributes: options.attributes }
        : {};
    return this.tracer.startActiveSpan(name, spanOpts, async (span: Span) => {
      const adapterSpan = new OtelSpan(span);
      try {
        const result = await callback(adapterSpan);
        return result;
      } catch (error) {
        adapterSpan.recordException(error);
        throw error;
      } finally {
        adapterSpan.end();
      }
    });
  }
}
