import { describe, it, expect } from "vitest";
import { PluginLifecycleManager } from "./plugin-lifecycle";

describe("PluginLifecycleManager (Phase 10)", () => {
  it("transitions cleanly through lifecycle states", async () => {
    const lifecycle = new PluginLifecycleManager();
    expect(lifecycle.currentState).toBe("DISCOVERED");

    lifecycle.validate();
    expect(lifecycle.currentState).toBe("VALIDATED");

    lifecycle.load();
    expect(lifecycle.currentState).toBe("LOADED");

    await lifecycle.initialize();
    expect(lifecycle.currentState).toBe("INITIALIZED");

    await lifecycle.activate();
    expect(lifecycle.currentState).toBe("ACTIVE");

    await lifecycle.deactivate();
    expect(lifecycle.currentState).toBe("STOPPED");
  });
});
