import { describe, it, expect } from "vitest";
import { PermissionRegistry } from "./permission";

describe("PermissionRegistry (ROLE-P1-01)", () => {
  it("registers valid atomic permission definitions and checks registration", () => {
    const registry = new PermissionRegistry();
    registry.registerPermission({
      key: "commerce:order:create:space",
      description: "Create new order in space",
      scopes: ["space"],
      assignableBy: ["owner", "admin"],
    });

    expect(registry.isRegistered("commerce:order:create:space")).toBe(true);
    const def = registry.getRegistered("commerce:order:create:space");
    expect(def?.description).toBe("Create new order in space");
  });

  it("throws error when registering permission with invalid format or scope wildcard", () => {
    const registry = new PermissionRegistry();
    expect(() =>
      registry.registerPermission({
        key: "commerce:order:create:*" as unknown as `${string}:${string}:${string}:${string}`,
        description: "Invalid scope wildcard",
        scopes: ["space"],
      })
    ).toThrow();
  });
});
