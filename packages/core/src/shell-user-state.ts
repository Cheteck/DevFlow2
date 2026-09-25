/**
 * @mosaix/core — ShellUserState & GuestSession (Guest vs Authenticated)
 * Centralise la résolution de l'état d'authentification — évite les if(!user) dispersés.
 */

import { uuidV7 } from "@mosaix/types";

export type ShellUserState =
  | { kind: "guest"; guestSessionId: string; locale?: string; timezone?: string }
  | { kind: "authenticated"; userId: string; roles: string[]; permissions: string[]; email?: string };

export interface GuestSession {
  sessionId: string;
  locale?: string;
  timezone?: string;
  createdAt: string;
}

export function createGuestSession(locale?: string, timezone?: string): GuestSession {
  return {
    sessionId: `guest_${uuidV7()}`,
    ...(locale ? { locale } : {}),
    ...(timezone ? { timezone } : {}),
    createdAt: new Date().toISOString(),
  };
}

export function isGuest(state: ShellUserState): state is Extract<ShellUserState, { kind: "guest" }> {
  return state.kind === "guest";
}

export function isAuthenticated(state: ShellUserState): state is Extract<ShellUserState, { kind: "authenticated" }> {
  return state.kind === "authenticated";
}

export const PLATFORM_ADMIN_ROLES = ["admin", "superadmin", "platform-admin", "platform_admin"] as const;

export function isPlatformAdmin(state: ShellUserState): boolean {
  if (state.kind !== "authenticated") return false;
  return state.roles.some((r) => (PLATFORM_ADMIN_ROLES as readonly string[]).includes(r));
}

/** Transfère le contexte Guest vers la session authentifiée : ne garde que locale/timezone. */
export function transferGuestContextToAuth(
  guest: Extract<ShellUserState, { kind: "guest" }>,
  auth: Extract<ShellUserState, { kind: "authenticated" }>
): Extract<ShellUserState, { kind: "authenticated" }> & { transferredFromGuest?: string; locale?: string; timezone?: string } {
  return {
    ...auth,
    transferredFromGuest: guest.guestSessionId,
    ...(guest.locale ? { locale: guest.locale } : {}),
    ...(guest.timezone ? { timezone: guest.timezone } : {}),
  };
}
