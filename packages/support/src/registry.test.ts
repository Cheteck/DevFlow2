import { describe, it, expect } from "vitest";
import { createTypedRegistry } from "./registry.js";

describe("createTypedRegistry", () => {
  it("registers and retrieves items", () => {
    const registry = createTypedRegistry<string, number>([["a", 1]]);

    expect(registry.get("a")).toBe(1);
    expect(registry.has("a")).toBe(true);
    expect(registry.has("b")).toBe(false);

    registry.register("b", 2);
    expect(registry.get("b")).toBe(2);
    expect(registry.size()).toBe(2);
  });

  it("prevents accidental silent overwrites by default and requires override() for explicit replacements", () => {
    const registry = createTypedRegistry<string, string>([["key1", "val1"]], {
      name: "TestRegistry",
    });

    expect(() => registry.register("key1", "new_val")).toThrow(
      '[TestRegistry] Cannot register key "key1": key is already registered. Use override() to explicitly replace an existing entry.',
    );

    // Explicit replacement via override()
    registry.override("key1", "new_val");
    expect(registry.get("key1")).toBe("new_val");
  });

  it("resets to defaults", () => {
    const registry = createTypedRegistry<string, number>([["defaultKey", 100]]);

    registry.register("tempKey", 200);
    expect(registry.size()).toBe(2);

    registry.resetToDefaults();
    expect(registry.size()).toBe(1);
    expect(registry.get("defaultKey")).toBe(100);
    expect(registry.has("tempKey")).toBe(false);
  });
});
