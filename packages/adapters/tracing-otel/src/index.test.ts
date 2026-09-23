import { describe, expect, it } from "vitest";
import { OtelTracingAdapter } from "./index";

describe("OtelTracingAdapter", () => {
  it("can execute synchronous spans", () => {
    const adapter = new OtelTracingAdapter("test-tracer");

    const result = adapter.startActiveSpan("sync_span", (span) => {
      span.setAttribute("tag", "val");
      return "done";
    });

    expect(result).toBe("done");
  });

  it("can execute asynchronous spans", async () => {
    const adapter = new OtelTracingAdapter("test-tracer");

    const result = await adapter.startActiveSpanAsync(
      "async_span",
      async (span) => {
        span.setAttribute("tag", "val_async");
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "async_done";
      },
    );

    expect(result).toBe("async_done");
  });
});
