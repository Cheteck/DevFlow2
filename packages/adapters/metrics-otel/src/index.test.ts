import { describe, expect, it } from "vitest";
import { OtelMetricsAdapter } from "./index";

describe("OtelMetricsAdapter", () => {
  it("registers meters and logs values", () => {
    const adapter = new OtelMetricsAdapter("test-meter");

    const counter = adapter.createCounter("test_counter", "Desc");
    const upDownCounter = adapter.createUpDownCounter("test_up_down", "Desc");
    const histogram = adapter.createHistogram("test_histogram", "Desc");

    expect(counter).toBeDefined();
    expect(upDownCounter).toBeDefined();
    expect(histogram).toBeDefined();

    // Verify calling them executes without errors
    expect(() => counter.add(10, { tag: "value" })).not.toThrow();
    expect(() => upDownCounter.add(-5, { tag: "value" })).not.toThrow();
    expect(() => histogram.record(4.2, { tag: "value" })).not.toThrow();
  });
});
