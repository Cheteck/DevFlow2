import { describe, it, expect } from "vitest";
import { SecurityGuard } from "../src/shell/security-guard.js";
import { resolveBacAccess } from "../src/shell/bac-access.js";
import { CANONICAL_BAC_IDS, validateUserPermissions, USER_PROFILES } from "../src/shell/profiles.js";
import type { SsrAuthContext } from "../src/shell/ssr-auth-context.js";

function mockAuthCtx(role: "member" | "admin" = "member", isAuthenticated = true): SsrAuthContext {
  if (!isAuthenticated) {
    return {
      kind: "anonymous",
      user: { id: "guest", roles: [], permissions: [] },
      profile: USER_PROFILES.member,
      tenantId: "tenant-default",
      spaceId: null,
      isAuthenticated: false,
      session: null,
    };
  }

  return {
    kind: "session",
    user: {
      id: "user-123",
      roles: [role],
      permissions: USER_PROFILES[role]?.permissions || [],
    },
    profile: USER_PROFILES[role] || USER_PROFILES.member,
    tenantId: "tenant-default",
    spaceId: null,
    isAuthenticated: true,
    session: { id: "sess-123" } as never,
  };
}

describe("SHELL-SEC-01 — Shell Production Security Boundaries", () => {
  describe("SecurityGuard Environment Validation", () => {
    it("rejects short or default dev secrets in production environment", () => {
      const origEnv = process.env.NODE_ENV;
      const origJwt = process.env.MOSAIX_AUTH_JWT_SECRET;

      try {
        process.env.NODE_ENV = "production";
        process.env.MOSAIX_AUTH_JWT_SECRET = "short-secret123";

        const val = SecurityGuard.validateEnvironment();
        expect(val.valid).toBe(false);
        expect(val.errors.some(e => e.includes("Production JWT secret"))).toBe(true);
      } finally {
        process.env.NODE_ENV = origEnv;
        process.env.MOSAIX_AUTH_JWT_SECRET = origJwt;
      }
    });

    it("accepts valid high-entropy JWT secrets in production environment", () => {
      const origEnv = process.env.NODE_ENV;
      const origJwt = process.env.MOSAIX_AUTH_JWT_SECRET;

      try {
        process.env.NODE_ENV = "production";
        process.env.MOSAIX_AUTH_JWT_SECRET = "super-secure-production-jwt-secret-with-high-entropy-256bits-or-more";

        const val = SecurityGuard.validateEnvironment();
        expect(val.errors).toHaveLength(0);
      } finally {
        process.env.NODE_ENV = origEnv;
        process.env.MOSAIX_AUTH_JWT_SECRET = origJwt;
      }
    });
  });

  describe("BAC Access Control Boundaries (resolveBacAccess)", () => {
    it("blocks anonymous guest users from accessing restricted BACs like Imperia or Citadelle admin views", () => {
      const guestCtx = mockAuthCtx("member", false);

      const imperiaDecision = resolveBacAccess(guestCtx, "imperia");
      expect(imperiaDecision.kind).toBe("login");

      const citadelleDecision = resolveBacAccess(guestCtx, "identity", "admin");
      expect(citadelleDecision.kind).toBe("login");
    });

    it("allows member sessions on public/member views while blocking admin-only views", () => {
      const memberCtx = mockAuthCtx("member", true);

      const solaraDecision = resolveBacAccess(memberCtx, "solara", "feed");
      expect(solaraDecision.kind).toBe("allowed");

      const imperiaDecision = resolveBacAccess(memberCtx, "imperia", "governance");
      expect(imperiaDecision.kind).toBe("forbidden");
    });

    it("allows admin sessions full access to governance surfaces", () => {
      const adminCtx = mockAuthCtx("admin", true);

      const imperiaDecision = resolveBacAccess(adminCtx, "imperia", "governance");
      expect(imperiaDecision.kind).toBe("allowed");
    });
  });

  describe("Permission & Catalog Invariants", () => {
    it("validates well-formed user permissions", () => {
      const result = validateUserPermissions(["solara:feed:read", "invalid-no-colon", "imperia:governance:manage"]);
      expect(result.valid).toEqual(["solara:feed:read", "imperia:governance:manage"]);
      expect(result.invalid).toEqual(["invalid-no-colon"]);
    });

    /* AUDIT-RESET a055b8e (2026-10-13) — SUITE PRÉSENTE (commit a2ab3e3), ÉTAT COHÉRENT.
     * Les assertions ci-dessous attendent toContain("identity"), en cohérence avec profiles.ts actuel :
     * si la décision identity→citadelle est reprise, mettre à jour ensemble ce fichier,
     * shell-production-invariants.test.ts et CANONICAL_BAC_IDS. */
    it("contains all 11 canonical BAC IDs in the platform registry catalog", () => {
      expect(CANONICAL_BAC_IDS).toHaveLength(11);
      expect(CANONICAL_BAC_IDS).toContain("identity");
      expect(CANONICAL_BAC_IDS).toContain("commerce");
      expect(CANONICAL_BAC_IDS).toContain("imperia");
    });
  });
});
