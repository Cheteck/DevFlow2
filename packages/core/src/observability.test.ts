import { describe, it, expect, vi } from "vitest";
import {
  ConsoleLogger,
  InMemoryMetrics,
  InMemoryTracer,
  createExecutionContext,
  describeTenant,
  KernelError,
} from "@mosaix/core";
import type { TenantIdentity } from "@mosaix/contracts";

const TENANT: TenantIdentity = {
  organizationId: "acme-corp",
  spaceId: "retail-chain",
};

describe("core: identity — ExecutionContext", () => {
  it("builds a traceable execution context", () => {
    const ctx = createExecutionContext(
      { appId: "sales", version: "1.0.0" },
      TENANT,
      { capability: { id: "user.lookup" } },
    );
    expect(ctx.actor).toEqual({ appId: "sales", version: "1.0.0" });
    expect(ctx.tenant).toEqual(TENANT);
    expect(ctx.capability).toEqual({ id: "user.lookup" });
    expect(ctx.correlationId).toContain("sales");
    expect(typeof ctx.timestamp).toBe("number");
  });

  it("optional fields are omitted when absent", () => {
    const ctx = createExecutionContext(
      { appId: "sales", version: "1.0.0" },
      TENANT,
    );
    expect(ctx.capability).toBeUndefined();
  });

  it("describeTenant renders space-qualified and org-only forms", () => {
    expect(describeTenant(TENANT)).toBe("acme-corp:retail-chain");
    expect(describeTenant({ organizationId: "acme-corp" })).toBe("acme-corp");
  });
});

describe("core: observability — ConsoleLogger", () => {
  it("writes JSON records to the console", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = new ConsoleLogger("info");
    logger.info("hello", { app: "identity" });
    const record = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(record.level).toBe("info");
    expect(record.message).toBe("hello");
    expect(record.fields).toEqual({ app: "identity" });
    spy.mockRestore();
  });

  it("child logger carries bound fields", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = new ConsoleLogger("info");
    logger.child({ tenant: "acme" }).warn("x");
    const record = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(record.fields.tenant).toBe("acme");
    spy.mockRestore();
  });
});

describe("core: observability — InMemoryMetrics", () => {
  it("counts increments and snapshots", () => {
    const metrics = new InMemoryMetrics();
    metrics.increment("event.publish", 1, { type: "a" });
    metrics.increment("event.publish", 2, { type: "a" });
    expect(metrics.snapshot()["event.publish"]).toBe(3);
    metrics.gauge("uptime", 42);
    expect(metrics.snapshot()["uptime"]).toBe(42);
  });
});

describe("core: observability — InMemoryTracer", () => {
  it("records ok traces with duration and actor", () => {
    const tracer = new InMemoryTracer();
    const span = tracer.begin("capability.execute", { actor: "sales" });
    const trace = span.end("ok");
    expect(trace.action).toBe("capability.execute");
    expect(trace.actor).toBe("sales");
    expect(trace.status).toBe("ok");
    expect(trace.durationMs).toBeGreaterThanOrEqual(0);
    expect(tracer.list()).toHaveLength(1);
  });

  it("records error traces with the error message", () => {
    const tracer = new InMemoryTracer();
    const span = tracer.begin("capability.execute");
    span.end("error", new Error("denied"));
    expect(tracer.list()[0]!.status).toBe("error");
    expect(tracer.list()[0]!.error).toBe("denied");
  });
});

describe("core: KernelError — serialization", () => {
  it("toJSON exposes stable code, message and details", () => {
    const error = new KernelError("EVENT_ERROR", "boom", { type: "x" });
    const json = error.toJSON();
    expect(json.code).toBe("EVENT_ERROR");
    expect(json.message).toBe("boom");
    expect(json.details).toEqual({ type: "x" });
    expect(error).toBeInstanceOf(Error);
  });
});
