/**
 * @mosaix/core — ShellEntryPolicy (Guest vs Authenticated)
 * Centralise la résolution de l'expérience d'entrée — testable, générique (pas de Solara hard-codé).
 */

import type { PlatformSettings } from "@mosaix/contracts";
import type { ShellUserState } from "./shell-user-state.js";

export type GuestDestination =
  | { mode: "landing" }
  | { mode: "login"; route: string }
  | { mode: "public-bac"; bacId: string };

export type ShellEntry =
  | { kind: "guest"; destination: GuestDestination }
  | { kind: "authenticated"; bacId: string; isFallback: boolean }
  | { kind: "admin"; bacId: string; isFallback: boolean };

export interface ShellEntryPolicyContext {
  userState: ShellUserState;
  settings: PlatformSettings;
  isBacAvailable: (bacId: string) => Promise<boolean> | boolean;
  isBacEnabled: (bacId: string) => boolean;
  canLaunch: (bacId: string, userState: ShellUserState) => Promise<boolean> | boolean;
}

export class ShellEntryPolicy {
  async resolve(ctx: ShellEntryPolicyContext): Promise<ShellEntry> {
    if (ctx.userState.kind === "guest") {
      const guestExp = ctx.settings.guestExperience;
      if (guestExp.mode === "public-bac" && guestExp.bacId) {
        const bacId = guestExp.bacId;
        const enabled = ctx.isBacEnabled(bacId);
        const available = enabled ? await ctx.isBacAvailable(bacId) : false;
        const can = available ? await ctx.canLaunch(bacId, ctx.userState) : false;
        if (can) {
          return { kind: "guest", destination: { mode: "public-bac", bacId } };
        }
      }
      if (guestExp.mode === "login") {
        return { kind: "guest", destination: { mode: "login", route: guestExp.route || "/identity/login" } };
      }
      return { kind: "guest", destination: { mode: "landing" } };
    }

    // Authenticated → defaultBacId (Solara ici, autre plateforme → autre BAC sans toucher Shell)
    const targetId = ctx.settings.defaultBacId || "solara";
    const canDefault = ctx.isBacEnabled(targetId) && (await ctx.isBacAvailable(targetId)) && (await ctx.canLaunch(targetId, ctx.userState));
    if (canDefault) {
      return { kind: "authenticated", bacId: targetId, isFallback: false };
    }

    // Fallback
    const fallbackId = ctx.settings.fallbackBacId;
    if (fallbackId) {
      const canFallback = ctx.isBacEnabled(fallbackId) && (await ctx.isBacAvailable(fallbackId)) && (await ctx.canLaunch(fallbackId, ctx.userState));
      if (canFallback) {
        return { kind: "authenticated", bacId: fallbackId, isFallback: true };
      }
    }

    // Dernier recours : premier BAC autorisé (évite 500)
    return { kind: "authenticated", bacId: targetId, isFallback: true };
  }
}

export const shellEntryPolicy = new ShellEntryPolicy();
