/**
 * @mosaix/shell — SSR authentication context (AUTH-07 step 1).
 *
 * Discriminated request identity for server-side rendering. The anonymous
 * state is explicit — never a default `UserProfile` standing in for a
 * session. Real sessions resolve via `SessionResolver` (@mosaix/auth
 * primitive); demo personas only exist when demo mode is explicitly on.
 *
 * This module resolves identity. It never renders HTML and never touches
 * authorization (permissions are evaluated at protected operations, not
 * for navbar display).
 */

import type * as http from "node:http";
import type { URL } from "node:url";
import { isDemoMode } from "@mosaix/support";
import { getSharedAuthComposition } from "../../bootstrap/auth-composition.js";
import {
  USER_PROFILES,
  type UserProfile,
} from "./profiles.js";

export type SsrAuthContext =
  | { kind: "anonymous" }
  | {
      kind: "authenticated";
      session: { sessionId: string; identityId: string; expiresAt: string };
      profile: UserProfile;
    }
  | { kind: "demo"; profile: UserProfile };

export function readOpaqueSessionId(req: http.IncomingMessage): string | null {
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/__Host-mosaix_session=([^;]+)/);
  const raw = match?.[1]?.trim();
  return raw ? raw : null;
}

function resolveDemoPersona(parsedUrl: URL, req: http.IncomingMessage): UserProfile {
  const roleQuery =
    parsedUrl.searchParams.get("role") || parsedUrl.searchParams.get("user");
  if (roleQuery && USER_PROFILES[roleQuery]) return USER_PROFILES[roleQuery];
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/mosaix_role=([a-z_]+)/);
  if (match && USER_PROFILES[match[1]]) return USER_PROFILES[match[1]];
  return USER_PROFILES.member;
}

/**
 * Transitional authenticated display profile, derived from the server-side
 * session record only. Neutral on purpose (no fabricated personal name):
 * the applicative `UserProfile` projection moves behind `IdentityProfilePort`
 * (AUTH-05). Sidebar BAC lists stay identical to the member baseline so this
 * change only affects the navbar boundary.
 */
export function toAuthenticatedDisplayProfile(identityId: string): UserProfile {
  const short = identityId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 12) || "compte";
  return {
    id: identityId,
    name: "Mon compte",
    handle: `@${short}`,
    role: "member",
    roleLabel: "Membre",
    badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    avatar: "👤",
    allowedBacs: [
      "identity",
      "solara",
      "spaces",
      "portfolio",
      "booking",
      "beam",
      "subscription",
    ],
    permissions: [
      "identity:view:profile",
      "solara:read:feed",
      "solara:create:post",
      "spaces:view:dashboard",
      "portfolio:view:catalog",
      "booking:reservation:create:tenant",
      "booking:slot:read:tenant",
      "beam:send:message",
    ],
  };
}

export interface SsrAuthResolverDeps {
  resolveSession?: (sessionId: string) => Promise<{
    sessionId: string;
    identityId: string;
    expiresAt: string;
  } | null>;
  demoMode?: () => boolean;
}

/**
 * Single per-request identity resolution for SSR pages. Precedence:
 * valid real session > demo persona (demo mode only) > anonymous.
 */
export async function buildSsrAuthContext(
  req: http.IncomingMessage,
  parsedUrl: URL,
  deps: SsrAuthResolverDeps = {},
): Promise<SsrAuthContext> {
  const resolveSession =
    deps.resolveSession ??
    (async (sessionId: string) => {
      // NOTE: resolved through the shared composition's SessionManager
      // (already loaded by this process via auth routes) with explicit
      // expiry/revocation checks — not via a direct SessionResolver import,
      // to keep the SSR hot path on proven-working module graph.
      const { sessionManager } = getSharedAuthComposition();
      // A store failure must never resolve to an authenticated context.
      // Fail closed to anonymous; the outage stays visible in server logs.
      const session = await sessionManager.get(sessionId).catch((err: unknown) => {
        console.error("[ssr-auth] session store failure, failing closed:", err);
        return null;
      });
      if (!session) return null;
      if (sessionManager.isExpired(session)) return null;
      if (sessionManager.isRevoked(session)) return null;
      return {
        sessionId: session.id,
        identityId: session.identityId,
        expiresAt: session.expiresAt,
      };
    });
  const demoMode = deps.demoMode ?? isDemoMode;

  const sessionId = readOpaqueSessionId(req);
  if (sessionId) {
    // Any resolver failure (store down, malformed record, forged id) maps
    // to anonymous. A resolution error must never become an authenticated
    // context, nor crash a public page into a 500.
    try {
      const session = await resolveSession(sessionId);
      if (session) {
        return {
          kind: "authenticated",
          session,
          profile: toAuthenticatedDisplayProfile(session.identityId),
        };
      }
    } catch (err) {
      console.error("[ssr-auth] session resolution failure, failing closed:", err);
    }
    // Invalid/expired/revoked/forged session → fall through to demo or
    // anonymous. Never upgrade to an authenticated state here.
  }

  if (demoMode()) {
    return { kind: "demo", profile: resolveDemoPersona(parsedUrl, req) };
  }
  return { kind: "anonymous" };
}
