import { describe, it, expect } from "vitest";
import {
  EffectivePermissionResolver,
  matchPermissionPattern,
  type RolePermissionRule,
} from "./effective-permission-resolver";

describe("EffectivePermissionResolver & UserAuthorizationContext", () => {
  it("correctly matches permission patterns including wildcards", () => {
    expect(matchPermissionPattern("commerce:order:create:space", "commerce:order:create:space")).toBe(true);
    expect(matchPermissionPattern("commerce:order:create:space", "commerce:order:*:space")).toBe(true);
    expect(matchPermissionPattern("commerce:order:create:space", "commerce:*:*:space")).toBe(true);
    expect(matchPermissionPattern("commerce:order:create:space", "*")).toBe(true);
    expect(matchPermissionPattern("commerce:order:create:space", "solara:post:create:space")).toBe(false);
  });

  it("enforces DENY > ALLOW absolute priority regardless of pattern specificity", () => {
    const resolver = new EffectivePermissionResolver();
    const rules: RolePermissionRule[] = [
      { permissionKey: "commerce:order:*:space", effect: "ALLOW", roleKey: "editor" },
      { permissionKey: "commerce:order:refund:space", effect: "DENY", roleKey: "editor" },
    ];

    const ctx = resolver.buildContext(
      { userId: "user-101", spaceId: "space-001" },
      rules
    );

    // Order creation allowed
    expect(ctx.can("commerce:order:create:space")).toBe(true);
    // Order refund explicitly denied
    expect(ctx.can("commerce:order:refund:space")).toBe(false);

    const refundDecision = ctx.resolvePermission("commerce:order:refund:space");
    expect(refundDecision.allowed).toBe(false);
    expect(refundDecision.effect).toBe("DENY");
    expect(refundDecision.matchedPermission).toBe("commerce:order:refund:space");
  });

  it("supports user overrides overriding role defaults", () => {
    const resolver = new EffectivePermissionResolver();
    const rules: RolePermissionRule[] = [
      { permissionKey: "portfolio:vendable:create:space", effect: "ALLOW" },
    ];
    const overrides = [
      { userId: "user-101", spaceId: "space-001", permissionKey: "portfolio:vendable:create:space", effect: "DENY" as const },
    ];

    const ctx = resolver.buildContext(
      { userId: "user-101", spaceId: "space-001" },
      rules,
      overrides
    );

    expect(ctx.can("portfolio:vendable:create:space")).toBe(false);
  });

  it("tracks authorization versions and increments correctly", () => {
    const resolver = new EffectivePermissionResolver();
    const key = "user-101:space-001";

    expect(resolver.getVersion(key)).toBe(1);
    const bumped = resolver.bumpVersion(key);
    expect(bumped).toBe(2);
    expect(resolver.getVersion(key)).toBe(2);
  });
});
