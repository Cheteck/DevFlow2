/**
 * @mosaix/shell — Global BAC access policy (guest boundary).
 *
 * Single source of truth for "who may open which BAC, and which view".
 * The SSR route guard (`src/start.ts`) AND navigation filtering both derive
 * from `resolveBacAccess()` — never from `allowedBacs` as a competing
 * authority. Hiding a nav item is a projection of this policy, not an
 * authorization guarantee: every protected view is re-checked server-side.
 *
 * Decision kinds:
 * - allowed → render.
 * - login → anonymous visitor on a protected view → 302 `/login?next=`.
 * - forbidden → authenticated/demo session without rights (e.g. imperia
 *   non-admin, unknown view on a strict BAC) → 403.
 *
 * No `not-found` kind on purpose: the guard only ever sees BACs matched
 * from discovery, so an unknown path never reaches the resolver (it falls
 * through to default-BAC/home handling). Unknown BAC ids passed directly
 * are denied by default (login/forbidden), never opened.
 *
 * Strictness is progressive: commerce + solara carry an explicit view
 * whitelist (`strictViews`) because their views are inventoried. Other BACs
 * deny everything to anonymous visitors; authenticated sessions keep current
 * behavior per view until their views are inventoried (BACKLOG: extend
 * `strictViews` BAC by BAC — never loosen silently).
 */

import { createTypedRegistry } from "@mosaix/support";
import type { SsrAuthContext } from "./ssr-auth-context.js";
import type { UserProfile } from "./profiles.js";

export type BacAccessDecision =
  | { kind: "allowed" }
  | { kind: "login" }
  | { kind: "forbidden" };

export interface BacAccessRule {
  /** Clean BAC id, without `@apps/` prefix. */
  bacId: string;
  /** Views open to anonymous visitors. `""` = default view (no `?view=`). */
  anonymousViews: string[];
  /**
   * View rendered when `?view=` is absent — MUST match the BAC view's own
   * default (e.g. solara renders `feed`). The guard and the renderer must
   * interpret a missing param identically.
   */
  defaultView?: string;
  /**
   * Inventoried view whitelist. When present, ANY view outside it is
   * refused — including for authenticated sessions. Absent = authenticated
   * sessions keep per-view behavior pending inventory (anonymous still
   * limited to `anonymousViews`).
   */
  strictViews?: readonly string[];
  /** Even authenticated non-admin sessions get a 403. */
  adminOnly?: boolean;
}

const DEFAULT_BAC_ACCESS_RULES: readonly BacAccessRule[] = [
  // Public marketplace vitrine (read-only listing). Cart, orders and any
  // other or unknown view require a session.
  { bacId: "commerce", anonymousViews: ["", "offers"], defaultView: "offers", strictViews: ["", "offers", "cart", "orders"] },
  // Social feed + profile require a session (no anonymous feed). Opening a
  // public view later (e.g. `trending`) = one table line.
  { bacId: "solara", anonymousViews: [], defaultView: "feed", strictViews: ["feed", "profile"] },
  // Everything below requires a session until a product decision opens it.
  // No strictViews yet = views pending inventory (anonymous: nothing open).
  { bacId: "portfolio", anonymousViews: [] },
  { bacId: "booking", anonymousViews: [] },
  { bacId: "beam", anonymousViews: [] },
  // Public space discovery (presentation fields only — the profile view
  // hides the member directory and management actions from guests).
  // Creation (`new`) requires a session.
  { bacId: "spaces", anonymousViews: ["", "list", "profile"], defaultView: "list", strictViews: ["", "list", "profile", "new"] },
  { bacId: "solidarity", anonymousViews: [] },
  { bacId: "subscription", anonymousViews: [] },
  { bacId: "citadelle", anonymousViews: [] },
  // Platform governance: authenticated admins only (cf. VIEW-IMPERIA 403).
  { bacId: "imperia", anonymousViews: [], adminOnly: true },
];

const bacAccessRegistry = createTypedRegistry<string, BacAccessRule>(
  DEFAULT_BAC_ACCESS_RULES.map((rule) => [rule.bacId, rule]),
  { name: "BacAccessRegistry" },
);

export function registerBacAccessRule(rule: BacAccessRule): void {
  bacAccessRegistry.register(rule.bacId.toLowerCase(), rule);
}

export function overrideBacAccessRule(rule: BacAccessRule): void {
  bacAccessRegistry.override(rule.bacId.toLowerCase(), rule);
}

export function resetBacAccessRegistry(): void {
  bacAccessRegistry.resetToDefaults();
}

/** `identity` is an alias of the citadelle BAC route. */
export function normalizeBacId(bacId: string): string {
  const clean = bacId.replace(/^@apps\//, "").toLowerCase();
  return clean === "identity" ? "citadelle" : clean;
}

export interface ParsedBacView {
  /** Normalized single view key (`""` = default view). */
  view: string;
  /** True when `?view=` is repeated — must be refused (ambiguous). */
  ambiguous: boolean;
}

/**
 * Single normalization for `?view=`, shared by the guard and any renderer
 * that needs the same interpretation. `URLSearchParams.get()` returns the
 * FIRST value silently — callers must check `ambiguous` first so a request
 * can never be authorized under one interpretation and rendered under
 * another (`?view=offers&view=orders`).
 */
export function parseBacView(params: URLSearchParams): ParsedBacView {
  const all = params.getAll("view");
  if (all.length > 1) return { view: "", ambiguous: true };
  return { view: (all[0] ?? "").toLowerCase(), ambiguous: false };
}

export function resolveBacAccess(
  auth: SsrAuthContext,
  bacId: string,
  view?: string | null,
): BacAccessDecision {
  const clean = normalizeBacId(bacId);
  const rule = bacAccessRegistry.get(clean);
  // A missing `?view=` means the BAC's own default view — resolved here so
  // guard and renderer share one interpretation (see `defaultView`).
  const rawKey = (view ?? "").toLowerCase();
  const viewKey = rawKey === "" ? (rule?.defaultView ?? "") : rawKey;

  if (auth.kind === "anonymous") {
    if (!rule) return { kind: "login" };
    return rule.anonymousViews.includes(viewKey)
      ? { kind: "allowed" }
      : { kind: "login" };
  }

  // authenticated + demo: sessions (or explicit demo personas) open anything
  // except admin-only BACs without the admin role, and unknown views on
  // strict BACs. NOTE: `profile.role` is only trustworthy because the profile
  // is built server-side from a resolved session (authenticated) or an
  // explicitly enabled demo persona — never from cookie/URL in real mode
  // (guaranteed by `buildSsrAuthContext`).
  const profile = auth.profile;
  if (!rule) return { kind: "forbidden" };
  if (rule.adminOnly && profile.role !== "admin") {
    return { kind: "forbidden" };
  }
  if (rule.strictViews && !rule.strictViews.includes(viewKey)) {
    return { kind: "forbidden" };
  }
  return { kind: "allowed" };
}

/**
 * Navigation BAC ids derived from the SAME policy (default view per BAC)
 * plus the manifest visibility flag. Sidebars/drawers filter on this list —
 * it is a projection for display, the guard above remains the enforcement
 * point. Engine BACs (`showInNavigation: false`) never appear, even though
 * their routes stay reachable (e.g. subscription via Imperia).
 */
export interface NavigableBac {
  id: string;
  /** False for engine BACs (manifest `showInNavigation: false`). */
  navigable?: boolean;
}

export function visibleBacIds(
  auth: SsrAuthContext,
  catalog: readonly (string | NavigableBac)[],
): string[] {
  return catalog
    .filter((entry) =>
      typeof entry === "string" ? true : entry.navigable !== false,
    )
    .map((entry) => (typeof entry === "string" ? entry : entry.id))
    .filter((id) => resolveBacAccess(auth, id).kind === "allowed");
}

/**
 * Display-only navigation profile. Presentation fields come from the auth
 * context (anonymous neutral / session-derived / demo persona); the BAC
 * list is ALWAYS policy-derived via `visibleBacIds()`. Never use the
 * result as proof of identity or authorization.
 */
export function buildNavProfile(
  auth: SsrAuthContext,
  catalog: readonly (string | NavigableBac)[],
): UserProfile {
  const allowedBacs = visibleBacIds(auth, catalog);
  if (auth.kind === "anonymous") {
    return { ...ANONYMOUS_NAV_PROFILE, allowedBacs };
  }
  return { ...auth.profile, allowedBacs };
}

/**
 * Presentation shell for anonymous navigation. `allowedBacs` is replaced
 * by the caller via `buildNavProfile()` — the literal here is only a
 * safe default, never an authority.
 */
export const ANONYMOUS_NAV_PROFILE: UserProfile = {
  id: "guest",
  name: "Invité",
  handle: "@invite",
  role: "member",
  roleLabel: "Invité",
  badgeClass: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  avatar: "👤",
  allowedBacs: [],
  permissions: [],
};

/**
 * Server-side `next` validation for login redirects. Only internal relative
 * paths; rejects protocol-relative, absolute, backslash-ambiguous and
 * auth-loop targets. Used by BOTH `GET /login` and every guard redirect —
 * never trust client-side validation alone (direct API calls bypass JS).
 */
export function resolveSafeNext(raw: unknown): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) {
    return "/";
  }
  let path: string;
  try {
    path = decodeURIComponent(raw);
  } catch {
    return "/";
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return "/";
  }
  if (/^\/login(\?|$)/.test(path) || /^\/register(\?|$)/.test(path)) {
    return "/";
  }
  return path;
}
