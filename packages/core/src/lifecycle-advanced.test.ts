import { describe, it, expect, vi } from "vitest";
import { AppLifecycle, LifecycleError } from "@mosaix/core";

describe("core: AppLifecycle — advanced states (ADR-0002)", () => {
  it("supports discovered → registered → ready → active", async () => {
    const lifecycle = new AppLifecycle();
    expect(lifecycle.status).toBe("discovered");
    lifecycle.markRegistered();
    expect(lifecycle.status).toBe("registered");
    await lifecycle.markReady();
    expect(lifecycle.status).toBe("ready");
    await lifecycle.initialize();
    expect(lifecycle.status).toBe("active");
  });

  it("drains active → draining → disabled", async () => {
    const lifecycle = new AppLifecycle();
    await lifecycle.initialize();
    const draining = vi.fn();
    const disabled = vi.fn();
    const lc = new AppLifecycle({
      onDraining: draining,
      onDisabled: disabled,
    });
    await lc.initialize();
    await lc.drain();
    expect(lc.status).toBe("disabled");
    expect(draining).toHaveBeenCalled();
    expect(disabled).toHaveBeenCalled();
  });

  it("exposes isHealthy and isReady", async () => {
    const lifecycle = new AppLifecycle();
    expect(lifecycle.isHealthy).toBe(true);
    expect(lifecycle.isReady).toBe(false);
    await lifecycle.initialize();
    expect(lifecycle.isReady).toBe(true);
    await lifecycle.degrade(new Error("x"));
    expect(lifecycle.isHealthy).toBe(false);
    expect(lifecycle.isReady).toBe(false);
  });

  it("allows a fresh lifecycle to pass through registered/ready states", async () => {
    const retried = new AppLifecycle();
    retried.markRegistered();
    await retried.markReady();
    await retried.initialize();
    expect(retried.status).toBe("active");
  });

  it("retry() from degraded reaches active", async () => {
    let attempts = 0;
    const lifecycle = new AppLifecycle({
      onInitializing: () => {
        attempts++;
        if (attempts === 1) throw new Error("transient");
      },
    });
    await expect(lifecycle.initialize()).rejects.toThrow("transient");
    expect(lifecycle.status).toBe("degraded");
    await lifecycle.retry();
    expect(lifecycle.status).toBe("active");
    expect(attempts).toBe(2);
  });

  it("retry() from active throws LifecycleError", async () => {
    const lifecycle = new AppLifecycle();
    await lifecycle.initialize();
    expect(lifecycle.status).toBe("active");
    await expect(lifecycle.retry()).rejects.toThrow(LifecycleError);
    await expect(lifecycle.retry()).rejects.toThrow(
      /Invalid lifecycle transition/,
    );
  });

  it("failed is reachable from discovered and is unhealthy", () => {
    const lifecycle = new AppLifecycle();
    lifecycle.markRegistered();
    expect(lifecycle.isHealthy).toBe(true);
  });

  it("invalid transitions throw LifecycleError with details", async () => {
    const lifecycle = new AppLifecycle();
    await expect(lifecycle.markReady()).rejects.toBeInstanceOf(LifecycleError);
    await expect(lifecycle.markReady()).rejects.toThrow(
      /Invalid lifecycle transition/,
    );
  });

  it("records every transition in history for auditing", async () => {
    const lifecycle = new AppLifecycle();
    lifecycle.markRegistered();
    await lifecycle.markReady();
    await lifecycle.initialize();
    expect(lifecycle.events().map((e) => e.to)).toEqual([
      "registered",
      "ready",
      "initializing",
      "active",
    ]);
  });
});
