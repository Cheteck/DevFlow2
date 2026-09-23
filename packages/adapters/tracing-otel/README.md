# @mosaix/adapter-tracing-otel

OpenTelemetry tracing adapter implementing [`TracingPort`](../../ports/tracing), built on `@opentelemetry/api`.

## Constructor

```typescript
new OtelTracingAdapter(tracerName?: string, version?: string);
```

Defaults to the tracer name `"mosaix-tracer"`.

## Features

- **startActiveSpan / startActiveSpanAsync** — starts an OpenTelemetry active span, runs the callback with a [`SpanPort`](../../ports/tracing), and **ends the span automatically** on completion. If the callback throws, the exception is recorded on the span before it ends.
- **span** — `setAttributes`, `setAttribute`, `recordException` (accepts `Error` or any value), `end`.

## Usage

```typescript
import { OtelTracingAdapter } from "@mosaix/adapter-tracing-otel";

const tracer = new OtelTracingAdapter("my-service");

tracer.startActiveSpan("my_span", (span) => {
  span.setAttribute("status", "success");
  // span ends automatically
});

await tracer.startActiveSpanAsync("async_span", async (span) => {
  // async work
});
```

## Related

- Port: [`@mosaix/ports-tracing`](../../ports/tracing)
