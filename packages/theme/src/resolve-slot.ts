/**
 * @mosaix/theme — Slot Resolution Engine
 */

import { ThemeError } from "./theme-errors.js";

export const SHELL_ROUTES: readonly string[] = ["/", "/login", "/register"];

export function isShellRoute(route: string): boolean {
  if (SHELL_ROUTES.includes(route)) return true;
  if (route.startsWith("/errors/") || route === "/errors") return true;
  return false;
}

export interface AppThemeOverrideConfig {
  id: string;
  routes?: string[] | { prefix?: string };
  themeOverrides?: {
    slots?: Record<string, string>;
    routes?: Record<string, string>;
  };
}

export interface SlotResolutionContext {
  slotId: string;
  route: string;
  tenantId?: string;
  locale?: string;
  variant?: "light" | "dark" | "high-contrast";
  activeThemeId: string;
  parentThemeId?: string;
  apps?: AppThemeOverrideConfig[];
  tenantOverrides?: {
    slots?: Record<string, string>;
  };
}

export interface SlotResolutionResult {
  slotId: string;
  template: string;
  provider: string;
  precedenceLevel: number;
  chain: Array<{ provider: string; template: string }>;
}

export function resolveSlot(ctx: SlotResolutionContext): SlotResolutionResult {
  const chain: Array<{ provider: string; template: string }> = [];
  let winningTemplate = `themes/${ctx.activeThemeId}/slots/${ctx.slotId}.html`;
  let winningProvider = "theme";
  let winningLevel = 1;

  if (ctx.parentThemeId) {
    chain.push({ provider: "parent", template: `parent-default/${ctx.slotId}` });
  }

  const themeTemplate = `themes/${ctx.activeThemeId}/slots/${ctx.slotId}.html`;
  chain.push({ provider: "theme", template: themeTemplate });

  const isShell = isShellRoute(ctx.route);

  if (!isShell && ctx.apps) {
    let ownerAppId: string | null = null;
    let longestMatchLen = -1;
    const matchingApps: Array<{ id: string; app: AppThemeOverrideConfig; pattern: string }> = [];

    for (const app of ctx.apps) {
      const appRoutes = Array.isArray(app.routes)
        ? app.routes
        : (app.routes && typeof app.routes === "object" && "prefix" in app.routes ? [app.routes.prefix as string] : [`/${app.id}`]);

      for (const pattern of appRoutes) {
        if (ctx.route.startsWith(pattern) || (pattern.endsWith("/*") && ctx.route.startsWith(pattern.slice(0, -2)))) {
          matchingApps.push({ id: app.id, app, pattern });
          if (pattern.length > longestMatchLen) {
            longestMatchLen = pattern.length;
            ownerAppId = app.id;
          }
        }
      }
    }

    if (ownerAppId && matchingApps.filter(m => m.pattern.length === longestMatchLen).length > 1) {
      const conflicting = matchingApps.filter(m => m.pattern.length === longestMatchLen).map(m => m.id).join(", ");
      throw new ThemeError(`Structural conflict: Ambiguous route ownership for '${ctx.route}' between apps: ${conflicting}`, { route: ctx.route, conflicting });
    }

    for (const item of ctx.apps) {
      const overrides = item.themeOverrides || (item as unknown as { app?: AppThemeOverrideConfig }).app?.themeOverrides;
      const overrideSlot = overrides?.slots?.[ctx.slotId];
      if (overrideSlot) {
        const isOwner = item.id === ownerAppId;
        const level = isOwner ? 3 : 2;
        const provider = isOwner ? "app-owner" : "app-non-owner";

        chain.push({ provider, template: overrideSlot });
        if (level >= winningLevel) {
          winningTemplate = overrideSlot;
          winningProvider = provider;
          winningLevel = level;
        }
      }
    }
  }

  if (ctx.tenantOverrides?.slots?.[ctx.slotId]) {
    const tenantTemplate = ctx.tenantOverrides.slots[ctx.slotId];
    chain.push({ provider: "tenant", template: tenantTemplate });
    winningTemplate = tenantTemplate;
    winningProvider = "tenant";
    winningLevel = 4;
  }

  return {
    slotId: ctx.slotId,
    template: winningTemplate,
    provider: winningProvider,
    precedenceLevel: winningLevel,
    chain,
  };
}
