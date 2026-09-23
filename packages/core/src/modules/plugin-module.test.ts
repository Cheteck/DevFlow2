/**
 * @mosaix/core — PluginModule (T-EXT-04)
 *
 * The plugin module installs the `PluginRegistry` as the OPEN `plugins`
 * extension service (T-EXT-01 escape hatch — a 7th service domain, NOT one of
 * the 6 canonical services). It installs through `KernelOptions.modules`; the
 * 6 canonical typed getters stay intact.
 */

import { describe, expect, it } from "vitest";

import {
  RuntimeKernel,
  defaultModules,
  type KernelContext,
  type KernelModule,
} from "@mosaix/core";
import type { PluginManifest } from "@mosaix/contracts";
import { PluginModule, PLUGIN_SERVICE } from "./plugin-module";
import type { PluginRegistry } from "../plugin/plugin-registry";

function plugin(id: string): PluginManifest {
  return {
    type: "plugin",
    id,
    name: id,
    version: "1.0.0",
    metadata: { name: id },
    extension: { target: "crm", point: "dashboard" },
  };
}

describe("core: PluginModule (T-EXT-04)", () => {
  it("installs the plugin registry as an extension service via kernel options", () => {
    const module = new PluginModule();
    const kernel = new RuntimeKernel(
      {},
      { modules: [...defaultModules(), module] },
    );

    const ctx: KernelContext = kernel.moduleContext;
    const registry = ctx.getService<PluginRegistry>(PLUGIN_SERVICE);
    expect(registry).toBeDefined();
    expect(registry).toBe(module.registry);
  });

  it("registers and activates a plugin through the context-provided registry", () => {
    const kernel = new RuntimeKernel(
      {},
      { modules: [...defaultModules(), new PluginModule()] },
    );

    const registry =
      kernel.moduleContext.getService<PluginRegistry>(PLUGIN_SERVICE);
    expect(registry).toBeDefined();
    const key = registry?.register(plugin("reports"));
    expect(key).toBe("crm:reports");

    if (registry) registry.activate("crm:reports");
    expect(registry?.get("crm:reports")?.active).toBe(true);
  });

  it("kernel.install() accepts the plugin module (ADR-0002 path)", () => {
    const kernel = new RuntimeKernel({}, { modules: defaultModules() });
    kernel.install(new PluginModule());

    expect(
      kernel.moduleContext.getService<PluginRegistry>(PLUGIN_SERVICE),
    ).toBeDefined();
  });

  it("keeps the 6 canonical typed getters intact (backward-compat)", () => {
    const kernel = new RuntimeKernel(
      {},
      { modules: [...defaultModules(), new PluginModule()] },
    );

    expect(kernel.store).toBeDefined();
    expect(kernel.bus).toBeDefined();
    expect(kernel.permissions).toBeDefined();
    expect(kernel.authz).toBeDefined();
    expect(kernel.capabilities).toBeDefined();
    expect(kernel.eventSchemas).toBeDefined();
    expect(kernel.listModules().sort()).toEqual([
      "capabilities",
      "events",
      "permissions",
      "plugin",
    ]);
  });

  it("returns undefined for the plugins service when PluginModule is not installed", () => {
    const kernel = new RuntimeKernel();

    // `plugins` is an extension service (not canonical): absent → undefined,
    // while a missing canonical service still throws (T-EXT-01 semantics).
    expect(kernel.moduleContext.getService(PLUGIN_SERVICE)).toBeUndefined();
  });

  it("a shared registry instance is observable across consumers (T-EXT-01)", () => {
    const shared = new PluginModule();
    let seen: PluginRegistry | undefined;
    const probe: KernelModule = {
      name: "plugin-probe",
      version: "1.0.0",
      register(ctx: KernelContext) {
        seen = ctx.getService<PluginRegistry>(PLUGIN_SERVICE);
      },
    };

    const kernel = new RuntimeKernel(
      {},
      { modules: [...defaultModules(), shared, probe] },
    );
    expect(seen).toBe(shared.registry);
    expect(
      kernel.moduleContext.getService<PluginRegistry>(PLUGIN_SERVICE),
    ).toBe(shared.registry);
  });
});
