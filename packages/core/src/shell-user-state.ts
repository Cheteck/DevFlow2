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
