import { describe, it, expect } from "vitest";
import { PermissionRegistry } from "./permission";
import { PolicyEngine } from "./policy-engine";
import type { TenantIdentity } from "@mosaix/types";

const TENANT_A: TenantIdentity = { organizationId: "acme" };
const TENANT_B: TenantIdentity = { organizationId: "beta" };

describe("PolicyEngine (Phase 7)", () => {
  it("evaluates role-based policies per tenant", () => {
    const registry = new PermissionRegistry();
    const engine = new PolicyEngine(registry);

    engine.registerRole({
      name: "admin",
      permissions: ["portfolio:vendable.create:execute:tenant"],
    });

    engine.registerPolicy({
      id: "policy-1",
      role: "admin",
      tenant: TENANT_A,
      effect: "allow",
    });

    expect(engine.evaluate("portfolio:vendable.create:execute:tenant", TENANT_A, "admin")).toBe(true);
    expect(engine.evaluate("portfolio:vendable.create:execute:tenant", TENANT_B, "admin")).toBe(false);
  });
});
