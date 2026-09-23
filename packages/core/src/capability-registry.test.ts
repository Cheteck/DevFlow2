/**
 * Tests for the CapabilityRegistry capability system.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CapabilityRegistry } from "./capability-registry";
import type { CapabilityEntry } from "./capability-registry";

function entry(overrides: Partial<CapabilityEntry> = {}): CapabilityEntry {
  return {
    id: "cap-a",
    ownerApp: "app-a",
    version: "1.0.0",
    entry: "/cap-a.js",
    permissions: ["invoke"],
    ...overrides,
  };
}

function validator(shape: Record<string, string>) {
  return {
    safeParse(input: unknown) {
      const ok =
        typeof input === "object" &&
        input !== null &&
        Object.entries(shape).every(([k, type]) => {
          const value = (input as Record<string, unknown>)[k];
          return value !== undefined && typeof value === type;
        });
      return ok ? { success: true } : { success: false, error: "invalid" };
    },
  };
}

describe("CapabilityRegistry", () => {
  let registry: CapabilityRegistry;

  beforeEach(() => {
    registry = new CapabilityRegistry();
  });

  it("registers and resolves a capability (backward compat)", () => {
    registry.register(entry());
    expect(registry.resolve("cap-a")?.ownerApp).toBe("app-a");
    expect(registry.resolve("missing")).toBeUndefined();
  });

  it("resolves versioned capabilities", () => {
    registry.register(entry({ ownerApp: "app-a", version: "1.0.0" }));
    registry.register(entry({ ownerApp: "app-b", version: "2.0.0" }));

    expect(registry.resolve("cap-a", "2.0.0")?.ownerApp).toBe("app-b");
    expect(registry.resolve("cap-a", "1.0.0")?.ownerApp).toBe("app-a");
    expect(registry.resolve("cap-a", "9.9.9")).toBeUndefined();
    expect(registry.resolve("cap-a")?.version).toBe("1.0.0");
  });

  it("get supports optional ownerApp and version", () => {
    const a1 = entry({ version: "1.0.0" });
    const a2 = entry({ ownerApp: "app-b", version: "2.0.0" });
    registry.register(a1);
    registry.register(a2);

    expect(registry.get("cap-a")?.version).toBe("1.0.0");
    expect(registry.get("cap-a", "app-b")?.version).toBe("2.0.0");
    expect(registry.get("cap-a", "nope")).toBeUndefined();
  });

  it("drives the availability lifecycle", () => {
    registry.register(entry());
    expect(registry.resolve("cap-a")?.availability).toBeUndefined();
    expect(registry.resolve("cap-a")?.availability ?? "available").toBe(
      "available",
    );

    registry.deprecate("cap-a");
    expect(registry.resolve("cap-a")?.availability).toBe("deprecated");

    registry.remove("cap-a");
    expect(registry.resolve("cap-a")?.availability).toBe("removed");
  });

  it("excludes removed entries from availableList", () => {
    registry.register(entry({ id: "live" }));
    registry.register(entry({ id: "old", availability: "deprecated" }));
    registry.register(entry({ id: "gone", availability: "removed" }));

    const available = registry.availableList().map((c) => c.id);
    expect(available).toContain("live");
    expect(available).toContain("old");
    expect(available).not.toContain("gone");
  });

  it("listAvailable filters by id", () => {
    registry.register(entry({ id: "a" }));
    registry.register(entry({ id: "b" }));
    registry.register(entry({ id: "removed", availability: "removed" }));

    expect(registry.listAvailable("a").map((c) => c.id)).toEqual(["a"]);
    expect(registry.listAvailable().map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("find performs dynamic discovery", () => {
    registry.register(entry({ id: "a", ownerApp: "app-a", version: "1.0.0" }));
    registry.register(entry({ id: "b", ownerApp: "app-a", version: "2.0.0" }));
    registry.register(entry({ id: "c", ownerApp: "app-b", version: "1.0.0" }));

    const versionTwo = registry.find((c) => c.version === "2.0.0");
    expect(versionTwo.map((c) => c.id)).toEqual(["b"]);

    const ownerApp = registry.find((c) => c.ownerApp === "app-a");
    expect(ownerApp.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("has reports presence", () => {
    registry.register(entry());
    expect(registry.has("cap-a")).toBe(true);
    expect(registry.has("missing")).toBe(false);
  });

  it("stores optional input/output schemas", () => {
    registry.register(
      entry({ inputSchema: { a: "string" }, outputSchema: { b: "number" } }),
    );
    const resolved = registry.resolve("cap-a");
    expect(resolved?.inputSchema).toEqual({ a: "string" });
    expect(resolved?.outputSchema).toEqual({ b: "number" });
  });

  it("validateCapability is dependency-free", () => {
    registry.register(entry({ inputSchema: { a: "string" } }));
    expect(registry.validateCapability("cap-a", { a: "x" })).toBe(true);
  });

  it("validateCapability enforces a registered inputValidator", () => {
    registry.register(entry({ inputValidator: validator({ id: "string" }) }));
    expect(registry.validateCapability("cap-a", { id: "u-1" })).toBe(true);
    expect(registry.validateCapability("cap-a", { id: 1 })).toBe(false);
    expect(registry.validateCapability("cap-a", undefined)).toBe(false);
  });

  it("validateCapability accepts input when no validator is registered", () => {
    registry.register(entry());
    expect(registry.validateCapability("cap-a", undefined)).toBe(true);
    expect(registry.validateCapability("cap-a", { anything: 1 })).toBe(true);
  });

  it("validateOutput enforces a registered outputValidator", () => {
    registry.register(
      entry({ outputValidator: validator({ found: "boolean" }) }),
    );
    expect(registry.validateOutput("cap-a", { found: true })).toBe(true);
    expect(registry.validateOutput("cap-a", { found: "yes" })).toBe(false);
  });

  it("validateOutput accepts output when no validator is registered", () => {
    registry.register(entry());
    expect(registry.validateOutput("cap-a", null)).toBe(true);
  });

  it("bindContract merges validators without clobbering other fields", () => {
    registry.register(entry({ version: "1.0.0", entry: "/cap-a.js" }));

    const bound = registry.bindContract("cap-a", "app-a", {
      inputValidator: validator({ id: "string" }),
    });

    expect(bound?.version).toBe("1.0.0");
    expect(bound?.entry).toBe("/cap-a.js");
    expect(bound?.inputValidator).toBeDefined();
    expect(bound?.outputValidator).toBeUndefined();
    expect(registry.validateCapability("cap-a", { id: "u" })).toBe(true);
  });

  it("bindContract is owner-scoped and updates only that app's entry", () => {
    registry.register(entry({ id: "cap-a", ownerApp: "app-a" }));
    registry.register(entry({ id: "cap-a", ownerApp: "app-b" }));

    expect(
      registry.bindContract("cap-a", "missing", {
        inputValidator: validator({ b: "number" }),
      }),
    ).toBeUndefined();

    registry.bindContract("cap-a", "app-b", {
      inputValidator: validator({ b: "number" }),
    });

    expect(registry.get("cap-a", "app-b")?.inputValidator).toBeDefined();
    expect(registry.get("cap-a", "app-a")?.inputValidator).toBeUndefined();
    expect(registry.get("cap-a", "missing")).toBeUndefined();
  });

  it("list, listByOwner, clear still work (backward compat)", () => {
    registry.register(entry({ id: "a", ownerApp: "app-a" }));
    registry.register(entry({ id: "b", ownerApp: "app-b" }));

    expect(registry.list().length).toBe(2);
    expect(registry.listByOwner("app-a").map((c) => c.id)).toEqual(["a"]);
    expect(registry.listByOwner("app-b").map((c) => c.id)).toEqual(["b"]);

    registry.clear();
    expect(registry.list().length).toBe(0);
    expect(registry.listByOwner("app-a").length).toBe(0);
  });

  it("probes get with ownerApp when ids collide", () => {
    registry.register(entry({ ownerApp: "other", id: "cap-a" }));
    expect(registry.resolve("cap-a")?.ownerApp).toBe("other");
    const direct = registry.get("cap-a", "other");
    expect(direct?.entry).toBe("/cap-a.js");
  });
});
