/**
 * PermissionRegistry — Multi-tenant isolation (P0 security audit)
 *
 * Guarantees that no application or organization can act on behalf of another
 * tenant, and that space-scoped grants cannot be reused across spaces. These
 * tests encode the security invariants required before the Kernel's
 * `executeCapability` permission gate is trusted at scale.
 *
 * Covered invariants:
 * - INV-PER-01: a grant for tenant A never matches a request for tenant B
 * - INV-PER-02: an explicit deny always beats any allow/wildcard
 * - INV-PER-03: a space-scoped grant cannot be used by a tenant of another space
 * - INV-PER-04: a grant scoped to app X does not authorize app Y (no wildcard leak)
 * - INV-PER-05: wildcard permission segments match, but tenant isolation is preserved
 */

import { describe, it, expect } from "vitest";
import { PermissionRegistry } from "./permission.js";
import type { TenantIdentity } from "@mosaix/types";

const tenantA: TenantIdentity = { organizationId: "org_a" };
const tenantB: TenantIdentity = { organizationId: "org_b" };
const tenantA_space1: TenantIdentity = { organizationId: "org_a", spaceId: "space_1" };
const tenantA_space2: TenantIdentity = { organizationId: "org_a", spaceId: "space_2" };

function registryWith(permission: string): PermissionRegistry {
  const reg = new PermissionRegistry();
  reg.registerPermission({
    key: permission,
    description: "test permission",
    scopes: ["tenant"],
  });
  return reg;
}

describe("PermissionRegistry — multi-tenant isolation (INV-PER)", () => {
  it("INV-PER-01: grant for tenant A is denied for tenant B (org mismatch)", () => {
    const reg = registryWith("identity:user:read:tenant");
    reg.grant("identity:user:read:tenant", tenantA, "identity");

    expect(reg.check("identity:user:read:tenant", tenantA, "identity")).toBe(true);
    expect(reg.check("identity:user:read:tenant", tenantB, "identity")).toBe(false);
  });

  it("INV-PER-02: explicit deny beats an allow for the same tenant/app", () => {
    const reg = registryWith("commerce:order:create:tenant");
    reg.grant("commerce:order:create:tenant", tenantA, "sales");
    reg.deny("commerce:order:create:tenant", tenantA, "sales");

    expect(reg.check("commerce:order:create:tenant", tenantA, "sales")).toBe(false);
  });

  it("INV-PER-03: space-scoped grant is denied for a different space in the same org", () => {
    const reg = registryWith("portfolio:vendable:read:tenant");
    // Grant scoped to space_1 only.
    reg.grant("portfolio:vendable:read:tenant", tenantA_space1, "portfolio");

    // Same org, same space → allowed.
    expect(
      reg.check("portfolio:vendable:read:tenant", tenantA_space1, "portfolio"),
    ).toBe(true);
    // Same org, different space → denied (no cross-space leakage).
    expect(
      reg.check("portfolio:vendable:read:tenant", tenantA_space2, "portfolio"),
    ).toBe(false);
    // Different org → denied.
    expect(
      reg.check("portfolio:vendable:read:tenant", tenantB, "portfolio"),
    ).toBe(false);
  });

  it("INV-PER-04: grant scoped to app X does not authorize app Y", () => {
    const reg = registryWith("identity:user:read:tenant");
    reg.grant("identity:user:read:tenant", tenantA, "identity");

    expect(reg.check("identity:user:read:tenant", tenantA, "identity")).toBe(true);
    // A different caller app is not covered by the grant.
    expect(reg.check("identity:user:read:tenant", tenantA, "sales")).toBe(false);
  });

  it("INV-PER-04b: a wildcard app grant authorizes any app but still enforces tenant isolation", () => {
    const reg = registryWith("identity:user:read:tenant");
    reg.grant("identity:user:read:tenant", tenantA, "*");

    expect(reg.check("identity:user:read:tenant", tenantA, "sales")).toBe(true);
    // Tenant isolation still holds even with a wildcard app.
    expect(reg.check("identity:user:read:tenant", tenantB, "sales")).toBe(false);
  });

  it("INV-PER-05: wildcard resource segment matches, tenant isolation preserved", () => {
    const reg = registryWith("identity:*:read:tenant");
    reg.registerPermission({
      key: "identity:*:read:tenant",
      description: "wildcard resource",
      scopes: ["tenant"],
    });
    reg.grant("identity:*:read:tenant", tenantA, "identity");

    // Wildcard resource matches a concrete resource in the request.
    expect(reg.check("identity:user:read:tenant", tenantA, "identity")).toBe(true);
    // Cross-tenant still denied.
    expect(reg.check("identity:user:read:tenant", tenantB, "identity")).toBe(false);
  });

  it("no grant at all → denied (default deny)", () => {
    const reg = registryWith("identity:user:read:tenant");
    expect(reg.check("identity:user:read:tenant", tenantA, "identity")).toBe(false);
    expect(reg.check("identity:user:read:tenant", tenantB, "identity")).toBe(false);
  });

  it("space-scoped grant is denied for a tenant without any space", () => {
    const reg = registryWith("portfolio:vendable:read:tenant");
    reg.grant("portfolio:vendable:read:tenant", tenantA_space1, "portfolio");

    // A tenant in the same org but with no space cannot use the space-scoped grant.
    expect(reg.check("portfolio:vendable:read:tenant", tenantA, "portfolio")).toBe(false);
  });
});
