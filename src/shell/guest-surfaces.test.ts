/**
 * Guest surface tests: no hardcoded BAC link may leak to anonymous visitors.
 * Verified in code (renderer string branches on the "guest" navigation
 * profile) and asserted here without booting HTTP.
 */

import { describe, it, expect } from "vitest";
import {
  renderMobileCreateSheet,
  renderMobileNotificationsSheet,
  renderMobileBottomNav,
  renderPrimarySidebar,
  renderSecondarySidebar,
  PRIMARY_RAIL_SHARED_CSS,
} from "./renderer.js";
import { getShellClientScripts } from "./client/shell-client-scripts.js";
import { ANONYMOUS_NAV_PROFILE } from "./bac-access.js";
import { buildNavProfile } from "./bac-access.js";
import { USER_PROFILES } from "./profiles.js";

const GUEST = ANONYMOUS_NAV_PROFILE;
const MEMBER = USER_PROFILES.member;
const PROTECTED_HREFS = [
  'href="/beam',
  'href="/imperia',
  'href="/booking',
  'href="/portfolio?admin',
  'href="/spaces?action=create',
];

describe("mobile create sheet", () => {
  it("shows a login prompt to guests, member shortcuts otherwise", () => {
    const guest = renderMobileCreateSheet(GUEST);
    for (const href of PROTECTED_HREFS) expect(guest).not.toContain(href);
    expect(guest).toContain('href="/login?next=/"');

    const member = renderMobileCreateSheet(MEMBER);
    expect(member).toContain('href="/beam?view=channels"');
    expect(member).toContain('href="/imperia?action=new"');
  });

  it("defaults to the full sheet without a profile (backward compat)", () => {
    expect(renderMobileCreateSheet()).toContain('href="/beam?view=channels"');
  });
});

describe("mobile notifications sheet", () => {
  it("renders no fabricated personal notifications to guests", () => {
    const guest = renderMobileNotificationsSheet(GUEST);
    expect(guest).not.toContain('href="/beam"');
    expect(guest).not.toContain('href="/imperia"');
    expect(guest).not.toContain('href="/booking"');
    expect(guest).not.toContain("Il y a 5 min");
    expect(guest).toContain("notifications_off");
  });
});

describe("mobile bottom nav", () => {
  it("replaces dead toggles and fake badges with login for guests", () => {
    const guest = renderMobileBottomNav("/commerce", GUEST, null);
    expect(guest).not.toContain("toggleUserDropdown");
    expect(guest).toContain('href="/login?next=%2Fcommerce"');
    expect(guest).not.toContain("bg-rose-500");

    const member = renderMobileBottomNav("/commerce", MEMBER, null);
    expect(member).toContain("toggleUserDropdown");
  });
});

describe("primary sidebar", () => {
  it("sends the guest avatar to login, members to identity", () => {
    const guest = renderPrimarySidebar(GUEST, "/commerce", null);
    expect(guest).not.toContain('href="/identity"');
    expect(guest).toContain("/login?next=");

    const member = renderPrimarySidebar(MEMBER, "/commerce", null);
    expect(member).toContain('href="/identity"');
  });

  it("shows only policy-derived BAC icons to guests", () => {
    // The raw literal is never an authority: navigation always goes
    // through the policy-derived profile (as start.ts does).
    const guestNav = buildNavProfile({ kind: "anonymous" }, ["commerce", "spaces", "solara", "beam", "imperia", "subscription", "portfolio"]);
    const guest = renderPrimarySidebar(guestNav, "/commerce", null);
    expect(guest).toContain('href="/commerce"');
    expect(guest).toContain('href="/spaces"');
    expect(guest).not.toContain('href="/solara"');
    expect(guest).not.toContain('href="/beam"');
    expect(guest).not.toContain('href="/imperia"');
    expect(guest).not.toContain('href="/subscription"');
    expect(guest).not.toContain('href="/portfolio"');
  });
});

describe("primary rail minimized state (pre-existing overflow fix)", () => {
  it("locks the X axis on the icon list (no horizontal scroll)", () => {
    const html = renderPrimarySidebar(MEMBER, "/commerce", null);
    expect(html).toContain("mosaix-slot-shell-sidebar-primary");
    expect(html).toContain("overflow-x-hidden");
    // Vertical scroll stays available for long BAC lists.
    expect(html).toContain("overflow-y-auto");
  });

  it("renders no in-flow absolute tooltips (former overflow source)", () => {
    const member = renderPrimarySidebar(MEMBER, "/commerce", null);
    expect(member).not.toContain("left-[84px]");
    const guest = renderPrimarySidebar(GUEST, "/commerce", null);
    expect(guest).not.toContain("left-[84px]");
  });

  it("exposes floating-tooltip data and labels on every rail entry", () => {
    const html = renderPrimarySidebar(MEMBER, "/commerce", null);
    expect(html).toContain('data-rail-tip="Accueil Fil Social"');
    expect(html).toContain('aria-label="Accueil Fil Social');
    expect(html).toContain("data-rail-sub=");
    // Single floating container, hidden by default.
    expect(html).toContain('id="rail-tooltip"');
    expect(html).toContain('role="tooltip"');
    expect(html).toContain('aria-hidden="true"');
  });

  it("ships shared rail CSS (no-scrollbar + rail-tip) for every page", () => {
    expect(PRIMARY_RAIL_SHARED_CSS).toContain(".no-scrollbar");
    expect(PRIMARY_RAIL_SHARED_CSS).toContain(".rail-tip");
    expect(PRIMARY_RAIL_SHARED_CSS).toContain("position: fixed");
    expect(PRIMARY_RAIL_SHARED_CSS).toContain("prefers-reduced-motion");
  });

  it("wires the floating tooltip controller in shell client scripts", () => {
    const scripts = getShellClientScripts();
    expect(scripts).toContain("rail-tooltip");
    expect(scripts).toContain("data-rail-tip");
    expect(scripts).toContain("hideRailTip");
  });
});

describe("secondary sidebar", () => {
  it("replaces the contextual CTA with login for guests", () => {
    const guest = renderSecondarySidebar(GUEST, "commerce", "/commerce", null);
    expect(guest).toContain("Se connecter");
    expect(guest).not.toContain("Voir mon Panier");
    expect(guest).not.toContain("/commerce?view=cart");

    const member = renderSecondarySidebar(MEMBER, "commerce", "/commerce", null);
    expect(member).toContain("Voir mon Panier");
  });
});
