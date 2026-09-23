import { describe, it, expect } from "vitest";
import { resolveSlot } from "./resolve-slot";

describe("resolveSlot (TH-003 / TH-004)", () => {
  it("resolves from parent up to theme", () => {
    const val = resolveSlot({
      route: "/dashboard",
      isShellRoute: false,
      parentValue: "parent-layout",
      themeValue: "theme-layout",
    });
    expect(val).toBe("theme-layout");
  });

  it("excludes app overrides on shell routes", () => {
    const val = resolveSlot({
      route: "/login",
      isShellRoute: true,
      parentValue: "parent",
      themeValue: "theme",
      ownerAppValue: "app-override",
    });
    // Should be theme because app overrides are ignored on shell routes
    expect(val).toBe("theme");
  });

  it("allows app and tenant overrides on non-shell routes", () => {
    const val = resolveSlot({
      route: "/space/123",
      isShellRoute: false,
      parentValue: "parent",
      themeValue: "theme",
      nonOwnerAppValue: "non-owner",
      ownerAppValue: "owner-app",
      tenantValue: "tenant-override",
    });
    // Tenant override takes highest precedence
    expect(val).toBe("tenant-override");
  });

  it("respects ownerAppValue over nonOwnerAppValue", () => {
    const val = resolveSlot({
      route: "/space/123",
      isShellRoute: false,
      themeValue: "theme",
      nonOwnerAppValue: "non-owner",
      ownerAppValue: "owner-app",
    });
    expect(val).toBe("owner-app");
  });
});
