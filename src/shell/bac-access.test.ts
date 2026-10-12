/**
 * Global BAC access policy tests (guest boundary).
 *
 * Covers every known BAC × identity kind, view whitelists, ambiguous
 * `?view=`, the identity alias, unknown BACs, server-side `next`
 * validation, and policy-derived navigation.
 */

import { describe, it, expect } from "vitest";
import {
  resolveBacAccess,
  parseBacView,
  normalizeBacId,
  visibleBacIds,
  buildNavProfile,
  resolveSafeNext,
  ANONYMOUS_NAV_PROFILE,
} from "./bac-access";
import type { SsrAuthContext } from "./ssr-auth-context";
import type { UserProfile } from "./profiles";

const ANON: SsrAuthContext = { kind: "anonymous" };
const MEMBER: SsrAuthContext = {
  kind: "authenticated",
  session: { sessionId: "s1", identityId: "u1", expiresAt: new Date(Date.now() + 3600_000).toISOString() },
  profile: { id: "u1", name: "Mon compte", handle: "@u1", role: "member", roleLabel: "Membre", badgeClass: "", avatar: "👤", allowedBacs: [], permissions: [] },
};
const ADMIN: SsrAuthContext = {
  ...MEMBER,
  kind: "authenticated",
  profile: { ...(MEMBER as { profile: UserProfile }).profile, role: "admin", roleLabel: "Administrateur" },
};
const DEMO_MEMBER: SsrAuthContext = {
  kind: "demo",
  profile: { ...(MEMBER as { profile: UserProfile }).profile, id: "user-1", name: "Alex M." },
};
const DEMO_ADMIN: SsrAuthContext = {
  kind: "demo",
  profile: { ...(ADMIN as { profile: UserProfile }).profile, id: "user-3", name: "Admin Imperia" },
};

const KNOWN_BACS = [
  "commerce",
  "solara",
  "portfolio",
  "booking",
  "beam",
  "spaces",
  "solidarity",
  "subscription",
  "citadelle",
  "imperia",
];

describe("normalizeBacId", () => {
  it("strips @apps/ prefix and maps the identity alias", () => {
    expect(normalizeBacId("@apps/solara")).toBe("solara");
    expect(normalizeBacId("identity")).toBe("citadelle");
    expect(normalizeBacId("SOLARA")).toBe("solara");
  });
});

describe("parseBacView", () => {
  it("normalizes missing/empty/cased views and flags repeats", () => {
    expect(parseBacView(new URLSearchParams(""))).toEqual({ view: "", ambiguous: false });
    expect(parseBacView(new URLSearchParams("view=Offers"))).toEqual({ view: "offers", ambiguous: false });
    expect(parseBacView(new URLSearchParams("view="))).toEqual({ view: "", ambiguous: false });
    expect(parseBacView(new URLSearchParams("view=offers&view=orders"))).toEqual({ view: "", ambiguous: true });
  });
});

describe("resolveBacAccess — anonymous", () => {
  it("opens the commerce vitrine (default + offers) and nothing else", () => {
    expect(resolveBacAccess(ANON, "commerce")).toEqual({ kind: "allowed" });
    expect(resolveBacAccess(ANON, "commerce", "offers")).toEqual({ kind: "allowed" });
    expect(resolveBacAccess(ANON, "commerce", "OFFERS")).toEqual({ kind: "allowed" });
  });

  it("sends anonymous cart/orders/unknown commerce views to login", () => {
    for (const view of ["cart", "orders", "checkout", "nope", ""]) {
      if (view === "") continue;
      expect(resolveBacAccess(ANON, "commerce", view)).toEqual({ kind: "login" });
    }
  });

  it("sends anonymous solara (feed default + profile) to login", () => {
    expect(resolveBacAccess(ANON, "solara")).toEqual({ kind: "login" });
    expect(resolveBacAccess(ANON, "solara", "")).toEqual({ kind: "login" });
    expect(resolveBacAccess(ANON, "solara", "feed")).toEqual({ kind: "login" });
    expect(resolveBacAccess(ANON, "solara", "profile")).toEqual({ kind: "login" });
  });

  it("maps a missing ?view= to the BAC default (solara → feed)", () => {
    // No-view and explicit feed MUST decide identically, for every identity.
    expect(resolveBacAccess(MEMBER, "solara")).toEqual(resolveBacAccess(MEMBER, "solara", "feed"));
    expect(resolveBacAccess(MEMBER, "solara")).toEqual({ kind: "allowed" });
    expect(resolveBacAccess(ANON, "commerce")).toEqual(resolveBacAccess(ANON, "commerce", "offers"));
  });

  it("sends anonymous visitors to login for every other known BAC", () => {
    for (const bac of KNOWN_BACS) {
      if (bac === "commerce" || bac === "solara" || bac === "spaces") continue;
      expect(resolveBacAccess(ANON, bac)).toEqual({ kind: "login" });
    }
  });

  it("opens the public spaces directory and profiles to anonymous visitors", () => {
    expect(resolveBacAccess(ANON, "spaces")).toEqual({ kind: "allowed" });
    expect(resolveBacAccess(ANON, "spaces", "list")).toEqual({ kind: "allowed" });
    expect(resolveBacAccess(ANON, "spaces", "profile")).toEqual({ kind: "allowed" });
    expect(resolveBacAccess(ANON, "spaces", "new")).toEqual({ kind: "login" });
    expect(resolveBacAccess(ANON, "spaces", "nope")).toEqual({ kind: "login" });
    expect(resolveBacAccess(MEMBER, "spaces", "new")).toEqual({ kind: "allowed" });
    expect(resolveBacAccess(MEMBER, "spaces", "nope")).toEqual({ kind: "forbidden" });
  });

  it("denies unknown BACs by default (login, never open)", () => {
    expect(resolveBacAccess(ANON, "nope")).toEqual({ kind: "login" });
    expect(resolveBacAccess(ANON, "@apps/nope")).toEqual({ kind: "login" });
  });
});

describe("resolveBacAccess — authenticated", () => {
  it("opens every known BAC except imperia for members", () => {
    for (const bac of KNOWN_BACS) {
      if (bac === "imperia") continue;
      expect(resolveBacAccess(MEMBER, bac)).toEqual({ kind: "allowed" });
    }
  });

  it("opens commerce cart/orders for members", () => {
    expect(resolveBacAccess(MEMBER, "commerce", "cart")).toEqual({ kind: "allowed" });
    expect(resolveBacAccess(MEMBER, "commerce", "orders")).toEqual({ kind: "allowed" });
  });

  it("refuses unknown views on strict BACs even when authenticated", () => {
    expect(resolveBacAccess(MEMBER, "commerce", "nope")).toEqual({ kind: "forbidden" });
    expect(resolveBacAccess(MEMBER, "solara", "nope")).toEqual({ kind: "forbidden" });
  });

  it("forbids imperia for members, allows it for admins", () => {
    expect(resolveBacAccess(MEMBER, "imperia")).toEqual({ kind: "forbidden" });
    expect(resolveBacAccess(ADMIN, "imperia")).toEqual({ kind: "allowed" });
  });

  it("forbids unknown BACs (deny by default)", () => {
    expect(resolveBacAccess(MEMBER, "nope")).toEqual({ kind: "forbidden" });
  });
});

describe("resolveBacAccess — demo personas", () => {
  it("behaves like sessions, with role-based imperia", () => {
    expect(resolveBacAccess(DEMO_MEMBER, "solara")).toEqual({ kind: "allowed" });
    expect(resolveBacAccess(DEMO_MEMBER, "imperia")).toEqual({ kind: "forbidden" });
    expect(resolveBacAccess(DEMO_ADMIN, "imperia")).toEqual({ kind: "allowed" });
  });

  it("resolves the identity alias like citadelle", () => {
    expect(resolveBacAccess(ANON, "identity")).toEqual({ kind: "login" });
    expect(resolveBacAccess(MEMBER, "identity")).toEqual({ kind: "allowed" });
  });
});

describe("visibleBacIds + buildNavProfile (navigation derived from policy)", () => {
  const catalog = [...KNOWN_BACS, "@apps/commerce"];

  it("shows only commerce and spaces to anonymous visitors", () => {
    const visible = visibleBacIds(ANON, catalog);
    expect(visible).toContain("commerce");
    expect(visible).toContain("spaces");
    expect(visible).not.toContain("solara");
    expect(visible).not.toContain("imperia");
    expect(visible).not.toContain("beam");
  });

  it("hides engine BACs from navigation even when the policy allows them", () => {
    const catalog = [
      "commerce",
      { id: "subscription", navigable: false },
      { id: "inventory", navigable: false },
      { id: "solara", navigable: true },
    ];
    const member = visibleBacIds(MEMBER, catalog);
    expect(member).toContain("commerce");
    expect(member).toContain("solara");
    expect(member).not.toContain("subscription");
    expect(member).not.toContain("inventory");
  });

  it("shows everything except imperia to members, all to admins", () => {
    const member = visibleBacIds(MEMBER, KNOWN_BACS);
    expect(member).toContain("solara");
    expect(member).not.toContain("imperia");
    expect(visibleBacIds(ADMIN, KNOWN_BACS)).toContain("imperia");
  });

  it("builds a permissionless anonymous profile with policy lists", () => {
    const nav = buildNavProfile(ANON, KNOWN_BACS);
    expect(nav.permissions).toEqual([]);
    expect(nav.allowedBacs).toContain("commerce");
    expect(nav.allowedBacs).toContain("spaces");
    expect(nav.allowedBacs).not.toContain("solara");
    // The literal default is only a safe fallback, never an authority.
    expect(ANONYMOUS_NAV_PROFILE.permissions).toEqual([]);
  });

  it("keeps session-derived presentation for authenticated nav", () => {
    const nav = buildNavProfile(MEMBER, KNOWN_BACS);
    expect(nav.id).toBe("u1");
    expect(nav.name).toBe("Mon compte");
  });
});

describe("resolveSafeNext (server-side)", () => {
  it("accepts internal relative paths", () => {
    expect(resolveSafeNext("/commerce")).toBe("/commerce");
    expect(resolveSafeNext("/commerce?view=offers")).toBe("/commerce?view=offers");
    expect(resolveSafeNext("/solara?view=feed&mode=trending")).toBe("/solara?view=feed&mode=trending");
  });

  it("rejects externals, protocol-relative, backslashes and loops", () => {
    expect(resolveSafeNext("https://evil.example/x")).toBe("/");
    expect(resolveSafeNext("//evil.example/x")).toBe("/");
    expect(resolveSafeNext("/\\evil.example")).toBe("/");
    expect(resolveSafeNext("/login")).toBe("/");
    expect(resolveSafeNext("/login?next=/commerce")).toBe("/");
    expect(resolveSafeNext("/register")).toBe("/");
    expect(resolveSafeNext("")).toBe("/");
    expect(resolveSafeNext(null)).toBe("/");
    expect(resolveSafeNext("javascript:alert(1)")).toBe("/");
  });
});
