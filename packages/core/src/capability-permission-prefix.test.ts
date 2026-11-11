/**
 * RuntimeKernel.capabilityPermissionPrefix & Cross-BAC Authorization — P1 Security Audit
 *
 * Tests the permission prefix derivation logic used by `executeCapability` to
 * enforce authorization boundaries. Validates that technical owners like
 * "@apps/portfolio" correctly map to business domains, and that cross-BAC
 * capability invocations require explicit grants — no implicit access.
 *
 * Invariants covered:
 * - INV-CAP-01: simple ownerApp ("identity") → prefix "identity:capId:"
 * - INV-CAP-02: technical ownerApp ("@apps/portfolio") → prefix from capability domain ("portfolio:vendable.search:")
 * - INV-CAP-03: capabilityPermissionPrefix never exposes internal owner format in permissions
 * - INV-CAP-04: executeCapability denies when permission grant is missing (default deny)
 * - INV-CAP-05: executeCapability denies when permission grant targets different app
 * - INV-CAP-06: executeCapability denies when permission grant targets different tenant
 * - INV-CAP-07: executeCapability allows when exact grant exists for app + tenant
 * - INV-CAP-08: wildcard app grant allows any app but enforces tenant
 * - INV-CAP-09: cross-BAC capability cannot be executed without explicit permission
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RuntimeKernel } from "./kernel.js";
import type { TenantIdentity } from "@mosaix/types";

const tenantA: TenantIdentity = { organizationId: "org_a" };
const tenantB: TenantIdentity = { organizationId: "org_b" };
const tenantA_space1: TenantIdentity = { organizationId: "org_a", spaceId: "space_1" };

describe("RuntimeKernel.capabilityPermissionPrefix — prefix derivation (INV-CAP)", () => {
  it("INV-CAP-01: simple ownerApp produces 'ownerApp:capabilityId:' prefix", () => {
    const prefix = RuntimeKernel.capabilityPermissionPrefix("identity", "getUserProfile");
    expect(prefix).toBe("identity:getUserProfile:");
  });

  it("INV-CAP-01b: simple ownerApp with dot in capabilityId preserves full capabilityId", () => {
    const prefix = RuntimeKernel.capabilityPermissionPrefix("sales", "order.create");
    expect(prefix).toBe("sales:order.create:");
  });

  it("INV-CAP-02: technical ownerApp '@apps/portfolio' maps to domain from capabilityId", () => {
    const prefix = RuntimeKernel.capabilityPermissionPrefix(
      "@apps/portfolio",
      "portfolio.vendable.search",
    );
    // Domain = "portfolio" (first segment before dot)
    // Resource = "vendable.search" (rest joined)
    expect(prefix).toBe("portfolio:vendable.search:");
  });

  it("INV-CAP-02b: technical ownerApp with multi-segment capabilityId", () => {
    const prefix = RuntimeKernel.capabilityPermissionPrefix(
      "@apps/beam",
      "beam.project.member.list",
    );
    expect(prefix).toBe("beam:project.member.list:");
  });

  it("INV-CAP-02c: technical ownerApp with no dot in capabilityId falls back to capabilityId as both domain and resource", () => {
    const prefix = RuntimeKernel.capabilityPermissionPrefix(
      "@apps/unknown",
      "someCapability",
    );
    // When capabilityId has no dot, the first segment IS the capabilityId itself
    // domain = "someCapability", resource = "someCapability"
    expect(prefix).toBe("someCapability:someCapability:");
  });

  it("INV-CAP-03: prefix never contains '@' or '/' characters", () => {
    const prefixes = [
      RuntimeKernel.capabilityPermissionPrefix("identity", "getUserProfile"),
      RuntimeKernel.capabilityPermissionPrefix("@apps/portfolio", "portfolio.vendable.search"),
      RuntimeKernel.capabilityPermissionPrefix("@apps/sales", "order.create"),
    ];

    for (const p of prefixes) {
      expect(p).not.toContain("@");
      expect(p).not.toContain("/");
      // Must end with colon for the action:scope concatenation
      expect(p.endsWith(":")).toBe(true);
    }
  });
});

describe("RuntimeKernel.executeCapability — cross-BAC authorization (INV-CAP)", () => {
  let kernel: RuntimeKernel;

  beforeEach(() => {
    kernel = new RuntimeKernel();
  });

  function setupCapability(
    ownerApp: string,
    capabilityId: string,
    permissions: string[],
  ) {
    kernel.registerCapability(ownerApp, {
      id: capabilityId,
      version: "1.0.0",
      entry: "index.js#" + capabilityId,
      permissions,
    });
    kernel.registerCapabilityExecutor(capabilityId, () => ({ ok: true }));
  }

  it("INV-CAP-04: missing permission grant → denied (default deny)", async () => {
    setupCapability("identity", "getUserProfile", ["identity:getUserProfile:execute:tenant"]);

    // No grant provided
    await expect(
      kernel.executeCapability("getUserProfile", "identity", tenantA, {}),
    ).rejects.toThrow(/Permission denied/);
  });

  it("INV-CAP-05: permission grant for different app → denied", async () => {
    setupCapability("identity", "getUserProfile", ["identity:getUserProfile:execute:tenant"]);

    // Grant for "sales" app, but caller is "identity"
    kernel.permissions.grant(
      "identity:getUserProfile:execute:tenant",
      tenantA,
      "sales",
    );

    await expect(
      kernel.executeCapability("getUserProfile", "identity", tenantA, {}),
    ).rejects.toThrow(/Permission denied/);
  });

  it("INV-CAP-06: permission grant for different tenant → denied", async () => {
    setupCapability("identity", "getUserProfile", ["identity:getUserProfile:execute:tenant"]);

    // Grant for tenantA, but caller uses tenantB
    kernel.permissions.grant(
      "identity:getUserProfile:execute:tenant",
      tenantA,
      "identity",
    );

    await expect(
      kernel.executeCapability("getUserProfile", "identity", tenantB, {}),
    ).rejects.toThrow(/Permission denied/);
  });

  it("INV-CAP-07: exact grant for app + tenant → allowed", async () => {
    setupCapability("identity", "getUserProfile", ["identity:getUserProfile:execute:tenant"]);

    kernel.permissions.grant(
      "identity:getUserProfile:execute:tenant",
      tenantA,
      "identity",
    );

    const result = await kernel.executeCapability("getUserProfile", "identity", tenantA, {});
    expect(result).toEqual({ ok: true });
  });

  it("INV-CAP-08: wildcard app grant allows any app but enforces tenant isolation", async () => {
    setupCapability("identity", "getUserProfile", ["identity:getUserProfile:execute:tenant"]);

    // Grant with wildcard app
    kernel.permissions.grant(
      "identity:getUserProfile:execute:tenant",
      tenantA,
      "*",
    );

    // Any app can execute for the same tenant
    const result1 = await kernel.executeCapability("getUserProfile", "identity", tenantA, {});
    expect(result1).toEqual({ ok: true });

    const result2 = await kernel.executeCapability("getUserProfile", "sales", tenantA, {});
    expect(result2).toEqual({ ok: true });

    // But different tenant is denied
    await expect(
      kernel.executeCapability("getUserProfile", "sales", tenantB, {}),
    ).rejects.toThrow(/Permission denied/);
  });

  it("INV-CAP-09: cross-BAC capability (technical owner) requires correct permission prefix", async () => {
    // Capability registered with technical owner "@apps/portfolio"
    setupCapability("@apps/portfolio", "portfolio.vendable.search", [
      "portfolio:vendable.search:execute:tenant",
    ]);

    // Grant must match the derived prefix: "portfolio:vendable.search:execute:tenant"
    kernel.permissions.grant(
      "portfolio:vendable.search:execute:tenant",
      tenantA,
      "portfolio",
    );

    const result = await kernel.executeCapability(
      "portfolio.vendable.search",
      "portfolio",
      tenantA,
      { query: "test" },
    );
    expect(result).toEqual({ ok: true });
  });

  it("INV-CAP-09b: cross-BAC capability denied with wrong permission prefix (using ownerApp instead of derived)", async () => {
    setupCapability("@apps/portfolio", "portfolio.vendable.search", [
      "portfolio:vendable.search:execute:tenant",
    ]);

    // Wrong: granting using technical ownerApp format instead of derived business domain
    kernel.permissions.grant(
      "@apps/portfolio:portfolio.vendable.search:execute:tenant", // Invalid format
      tenantA,
      "portfolio",
    );

    await expect(
      kernel.executeCapability("portfolio.vendable.search", "portfolio", tenantA, {}),
    ).rejects.toThrow(/Permission denied/);
  });

  it("INV-CAP-10: capability with no registered executor → rejected", async () => {
    // Register capability without calling setupCapability (which adds an executor)
    kernel.registerCapability("identity", {
      id: "noExecutorCap",
      version: "1.0.0",
      entry: "index.js#noExecutorCap",
      permissions: ["identity:noExecutorCap:execute:tenant"],
    });
    // Note: NO executor registered

    kernel.permissions.grant(
      "identity:noExecutorCap:execute:tenant",
      tenantA,
      "identity",
    );

    await expect(
      kernel.executeCapability("noExecutorCap", "identity", tenantA, {}),
    ).rejects.toThrow(/has no registered provider executor/);
  });

  it("INV-CAP-11: capability input validator enforced when registered", async () => {
    const { z } = await import("zod");
    const validator = z.object({ userId: z.string() });

    kernel.registerCapability("identity", {
      id: "getUserProfile",
      version: "1.0.0",
      entry: "index.js#getUserProfile",
      permissions: ["identity:getUserProfile:execute:tenant"],
    });
    // Register with input validator via bindContract
    kernel.bindCapabilityContract("getUserProfile", "identity", {
      inputValidator: validator,
      outputValidator: undefined,
    });
    kernel.registerCapabilityExecutor("getUserProfile", (input) => ({ user: input }));

    kernel.permissions.grant(
      "identity:getUserProfile:execute:tenant",
      tenantA,
      "identity",
    );

    // Valid input
    const result = await kernel.executeCapability(
      "getUserProfile",
      "identity",
      tenantA,
      { userId: "u1" },
    );
    expect(result).toEqual({ user: { userId: "u1" } });

    // Invalid input → rejected
    await expect(
      kernel.executeCapability("getUserProfile", "identity", tenantA, { userId: 123 }),
    ).rejects.toThrow(/input contract violated/);
  });
});