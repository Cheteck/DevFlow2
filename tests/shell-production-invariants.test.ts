import { describe, it, expect } from "vitest";
import { resolveBacAccess } from "../src/shell/bac-access.js";
import { validateUserPermissions, CANONICAL_BAC_IDS } from "../src/shell/profiles.js";

describe("SHELL-INV-01 — Shell Production Invariants & Security Boundaries", () => {
  it("Invariant 1: Anonymous users are restricted from protected BAC views", () => {
    const anonymousAuth = { kind: "anonymous" as const };

    // Public commerce marketplace view allowed
    expect(resolveBacAccess(anonymousAuth, "commerce", "offers")).toEqual({ kind: "allowed" });

    // Protected views require login
    expect(resolveBacAccess(anonymousAuth, "solara", "feed")).toEqual({ kind: "login" });
    expect(resolveBacAccess(anonymousAuth, "imperia", "dashboard")).toEqual({ kind: "login" });
    expect(resolveBacAccess(anonymousAuth, "citadelle", "profile")).toEqual({ kind: "login" });
  });

  it("Invariant 2: Authenticated non-admin users cannot access admin-only BACs", () => {
    const memberAuth = {
      kind: "authenticated" as const,
      profile: {
        id: "usr_member",
        name: "Member User",
        handle: "@member",
        role: "member" as const,
        roleLabel: "Membre",
        badgeClass: "badge",
        avatar: "👤",
        allowedBacs: ["solara"],
        permissions: ["solara:read:feed"],
      },
    };

    expect(resolveBacAccess(memberAuth, "solara", "feed")).toEqual({ kind: "allowed" });
    expect(resolveBacAccess(memberAuth, "imperia", "dashboard")).toEqual({ kind: "forbidden" });
  });

  it("Invariant 3: Canonical permissions catalog validates known BAC prefixes and rejects invalid ones", () => {
    const permissionsToTest = [
      "solara:read:feed",
      "commerce:checkout",
      "portfolio:view:catalog",
      "invalid_prefix:do_something",
      "malformed_string_without_colon",
    ];

    const result = validateUserPermissions(permissionsToTest);

    expect(result.valid).toEqual([
      "solara:read:feed",
      "commerce:checkout",
      "portfolio:view:catalog",
    ]);
    expect(result.invalid).toEqual([
      "invalid_prefix:do_something",
      "malformed_string_without_colon",
    ]);
  });

  /* AUDIT-RESET a055b8e (2026-10-13) — MISE À JOUR DE SESSION ABSENTE, TESTS COHÉRENTS.
   * Dernier commit de ce fichier : df95068 (antérieur à la session). L'invariant ci-dessous attend
   * toContain("identity"), en cohérence avec profiles.ts actuel : si la décision identity→citadelle est
   * reprise, mettre à jour ensemble ce test, security-shell-boundaries.test.ts et CANONICAL_BAC_IDS. */
  it("Invariant 4: All 11 MosaiX BACs are present in the canonical BAC catalog", () => {
    expect(CANONICAL_BAC_IDS.length).toBe(11);
    expect(CANONICAL_BAC_IDS).toContain("inventory");
    expect(CANONICAL_BAC_IDS).toContain("imperia");
    expect(CANONICAL_BAC_IDS).toContain("identity");
  });
});
