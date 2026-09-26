/**
 * @mosaix/ports-tracing — TracingPort (OTel-backed tracer contract).
 *
 * Implemented by `@mosaix/adapter-tracing-otel`. Attribute values stay
 * JSON-scalar so they satisfy the OpenTelemetry `Attributes` constraint.
 */
export type SpanAttributes = Record<string, string | number | boolean>;

export interface SpanPort {
  setAttributes(attributes: SpanAttributes): void;
  setAttribute(key: string, value: string | number | boolean): void;
  recordException(error: Error | unknown): void;
  end(): void;
}

export interface TracingPort {
  startActiveSpan<T>(
    name: string,
    callback: (span: SpanPort) => T,
    options?: { attributes?: SpanAttributes },
  ): T;
  startActiveSpanAsync<T>(
    name: string,
    callback: (span: SpanPort) => Promise<T>,
    options?: { attributes?: SpanAttributes },
  ): Promise<T>;
}
