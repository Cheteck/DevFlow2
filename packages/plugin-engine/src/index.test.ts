import { describe, expect, it } from "vitest";
import { PluginEngine } from "./runtime";
import { PluginManagementService } from "./management";
import { StaticPluginLoader } from "./adapters";
import type { PluginManifest } from "./core";

describe("@mosaix/plugin-engine Suite", () => {
  const sampleManifest: PluginManifest = {
    id: "commerce-discount",
    name: "Discount Engine",
    version: "1.0.0",
    targetAppId: "commerce",
    entrypoint: "./index.ts",
    permissions: [{ name: "orders.read" }],
  };

  it("registers, validates, and activates a plugin through its lifecycle", async () => {
    const engine = new PluginEngine();
    let disposed = false;

    const mockInstance = {
      dispose: () => {
        disposed = true;
      },
    };

    await engine.registerAndActivate(sampleManifest, mockInstance);

    const plugin = engine.registry.get("commerce-discount");
    expect(plugin).toBeDefined();
    expect(plugin?.state).toBe("ACTIVE");
    expect(plugin?.context.permissions).toContain("orders.read");

    // Hot Disable
    await engine.lifecycle.disable("commerce-discount");
    expect(engine.registry.get("commerce-discount")?.state).toBe("DISABLED");

    // Hot Unload & Resource Cleanup
    await engine.lifecycle.unload("commerce-discount");
    expect(disposed).toBe(true);
    expect(engine.registry.has("commerce-discount")).toBe(false);
  });

  it("filters active plugins by targetAppId in PluginRegistry", async () => {
    const engine = new PluginEngine();
    await engine.registerAndActivate(sampleManifest);
    await engine.registerAndActivate({
      ...sampleManifest,
      id: "identity-mfa",
      targetAppId: "identity",
    });

    const commercePlugins = engine.registry.getPluginsForApp("commerce");
    expect(commercePlugins).toHaveLength(1);
    expect(commercePlugins[0].manifest.id).toBe("commerce-discount");
  });

  it("manages plugins via PluginManagementService", async () => {
    const engine = new PluginEngine();
    const management = new PluginManagementService(engine);

    await engine.registerAndActivate(sampleManifest);

    const diagnostics = management.getDiagnostics("commerce-discount");
    expect(diagnostics.pluginId).toBe("commerce-discount");
    expect(diagnostics.state).toBe("ACTIVE");
    expect(diagnostics.hasInstance).toBe(false);
  });

  it("discovers plugins via StaticPluginLoader", () => {
    const loader = new StaticPluginLoader();
    loader.registerManifest(sampleManifest);

    const discovered = loader.discover();
    expect(discovered).toHaveLength(1);
    expect(discovered[0].id).toBe("commerce-discount");
  });
});
