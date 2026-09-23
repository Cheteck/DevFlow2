/**
 * @mosaix/core — PluginRegistry (T-EXT-04)
 *
 * Behaviors locked here:
 *   1. register() validates against PluginManifestSchema and keys by
 *      `owner:id` (owner = extension point target);
 *   2. duplicate registration and invalid manifests → PluginRegistrationError;
 *   3. activate()/deactivate() flip `active`; unknown key →
 *      PluginLifecycleError;
 *   4. extension points are OPEN: contributing to an arbitrary string point
 *      works, targeting an unknown point returns `undefined` — never an error
 *      (D-17 analogy);
 *   5. errors extend PluginError → KernelError with stable codes.
 */

import { describe, expect, it } from "vitest";

import type { PluginManifest } from "@mosaix/contracts";
import { KernelError } from "../kernel-errors";
import {
  PluginError,
  PluginLifecycleError,
  PluginRegistrationError,
} from "./plugin-errors";
import { PluginRegistry, extensionPointKey } from "./plugin-registry";

function plugin(
  id: string,
  point: string | string[] = "dashboard",
): PluginManifest {
  return {
    type: "plugin",
    id,
    name: id,
    version: "1.0.0",
    metadata: { name: id },
    extension: { target: "crm", point },
  };
}

describe("core: PluginRegistry (T-EXT-04)", () => {
  it("registers a valid manifest keyed as owner:id (owner = extension target)", () => {
    const registry = new PluginRegistry();
    const key = registry.register(plugin("reports"));

    expect(key).toBe(`crm:reports`);
    expect(registry.has(key)).toBe(true);
    expect(registry.get(key)).toMatchObject({
      key,
      owner: "crm",
      active: false,
    });
    expect(registry.size).toBe(1);
  });

  it("registers distinct plugins across owners and ids", () => {
    const registry = new PluginRegistry();
    registry.register(plugin("reports"));
    registry.register({
      ...plugin("reports"),
      extension: { target: "sales", point: "dashboard" },
    });

    expect(registry.size).toBe(2);
    expect(registry.has("crm:reports")).toBe(true);
    expect(registry.has("sales:reports")).toBe(true);
  });

  it("throws PluginRegistrationError for a duplicate owner:id key", () => {
    const registry = new PluginRegistry();
    registry.register(plugin("reports"));

    expect(() => registry.register(plugin("reports"))).toThrow(
      PluginRegistrationError,
    );
    expect(() => registry.register(plugin("reports"))).toThrow(
      /Plugin already registered/,
    );
  });

  it("throws PluginRegistrationError for an invalid manifest", () => {
    const registry = new PluginRegistry();
    const invalid = { ...plugin("nope"), version: "1.0" } as PluginManifest;

    expect(() => registry.register(invalid)).toThrow(PluginRegistrationError);
    expect(() => registry.register(invalid)).toThrow(/Invalid plugin manifest/);
  });

  it("throws PluginRegistrationError when the extension contract is missing", () => {
    const registry = new PluginRegistry();
    const { extension, ...rest } = plugin("bare");
    void extension;

    expect(() => registry.register(rest as PluginManifest)).toThrow(
      PluginRegistrationError,
    );
  });

  it("activates and deactivates a plugin", () => {
    const registry = new PluginRegistry();
    const key = registry.register(plugin("reports"));

    registry.activate(key);
    expect(registry.get(key)?.active).toBe(true);
    registry.deactivate(key);
    expect(registry.get(key)?.active).toBe(false);
  });

  it("throws PluginLifecycleError when activating an unknown plugin", () => {
    const registry = new PluginRegistry();

    expect(() => registry.activate("crm:ghost")).toThrow(PluginLifecycleError);
    expect(() => registry.deactivate("crm:ghost")).toThrow(/Unknown plugin/);
  });

  it("list() returns a snapshot of all entries", () => {
    const registry = new PluginRegistry();
    registry.register(plugin("a", "dashboard"));
    registry.register(plugin("b", "toolbar"));

    expect(
      registry
        .list()
        .map((e) => e.key)
        .sort(),
    ).toEqual(["crm:a", "crm:b"]);
  });

  it("accepts arbitrary (open) extension point identifiers", () => {
    const registry = new PluginRegistry();
    const key = registry.register(plugin("reports", "crm.reports.export"));

    expect(
      registry.extensionsAt("crm", "crm.reports.export")?.map((e) => e.key),
    ).toEqual([key]);
  });

  it("lists plugins contributing to a declared point", () => {
    const registry = new PluginRegistry();
    registry.register(plugin("charts", ["dashboard", "toolbar"]));
    registry.register(plugin("export", "toolbar"));

    expect(
      registry
        .extensionsAt("crm", "toolbar")
        ?.map((e) => e.key)
        .sort(),
    ).toEqual(["crm:charts", "crm:export"]);
    expect(
      registry.extensionsAt("crm", "dashboard")?.map((e) => e.key),
    ).toEqual(["crm:charts"]);
  });

  it("returns undefined for an unknown extension point — never an error (D-17)", () => {
    const registry = new PluginRegistry();
    registry.register(plugin("charts"));

    expect(registry.extensionsAt("crm", "dashboard")).toBeDefined();
    expect(registry.extensionsAt("crm", "unknown.point")).toBeUndefined();
    expect(
      registry.extensionsAt("unknown-target", "dashboard"),
    ).toBeUndefined();
  });

  it("exposes declared extension point keys and composes extensionPointKey()", () => {
    const registry = new PluginRegistry();
    registry.register(plugin("charts", ["dashboard", "toolbar"]));

    expect(registry.extensionPointsKeys().sort()).toEqual([
      "crm:dashboard",
      "crm:toolbar",
    ]);
    expect(extensionPointKey("crm", "dashboard")).toBe("crm:dashboard");
  });

  it("errors extend PluginError and KernelError with stable codes", () => {
    const registry = new PluginRegistry();
    let registrationCode = "";
    let lifecycleCode = "";
    try {
      registry.register({
        ...plugin("bad"),
        version: "nope",
      } as PluginManifest);
    } catch (error) {
      expect(error).toBeInstanceOf(PluginError);
      expect(error).toBeInstanceOf(KernelError);
      registrationCode = (error as PluginRegistrationError).code;
    }
    try {
      registry.activate("crm:ghost");
    } catch (error) {
      expect(error).toBeInstanceOf(PluginError);
      expect(error).toBeInstanceOf(KernelError);
      lifecycleCode = (error as PluginLifecycleError).code;
    }

    expect(registrationCode).toBe("PLUGIN_REGISTRATION_ERROR");
    expect(lifecycleCode).toBe("PLUGIN_LIFECYCLE_ERROR");
  });
});
