/**
 * @server/routes — Platform theme administration API (V2.3 doctrine).
 *
 * Admin-only JSON endpoints for the platform theme identity:
 * - GET  /api/admin/platform-theme — active id + discoverable themes
 * - PUT  /api/admin/platform-theme — persist + apply live (admin choice)
 * - GET  /api/admin/platform-settings — effective platform config snapshot
 *   (read-only; secrets never exposed)
 *
 * Persistence: sqlite via the migration-engine ledger path
 * (`theme-persistence.ts`), never ad-hoc DDL. Theme identity stays an
 * admin/entity concern — end users only switch mode (`/api/theme`).
 */
import type * as http from "node:http";
import type { URL } from "node:url";
import { ThemeDiscovery } from "@mosaix/core";
import * as path from "node:path";
import {
  getPlatformThemeId,
  setPlatformThemeId,
} from "../../shell/theme/theme-persistence.js";
import { getActiveThemeId } from "../../shell/theme/theme-bridge.js";
import { readLimitedJson } from "../utils/safe-body-parser.js";

function isAdminRole(role: string | undefined): boolean {
  return role === "admin";
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: Record<string, unknown>,
): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export interface AdminThemeSummary {
  id: string;
  name: string;
  version: string;
  primaryColor: string;
  backgroundColor: string;
}

export function listDiscoverableThemes(): AdminThemeSummary[] {
  const themesDir = path.resolve(process.cwd(), "themes");
  let discovered: { id: string; manifest: { name?: string; version?: string; tokens?: { colors?: Record<string, string> } } }[];
  try {
    discovered = ThemeDiscovery.discoverThemes(themesDir) as unknown as typeof discovered;
  } catch {
    return [];
  }
  return discovered
    .map((t) => ({
      id: t.id,
      name: t.manifest.name ?? t.id,
      version: t.manifest.version ?? "0.0.0",
      primaryColor: t.manifest.tokens?.colors?.primary ?? "#4f46e5",
      backgroundColor: t.manifest.tokens?.colors?.background ?? "#f8fafc",
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Effective (non-secret) platform configuration snapshot, read-only. */
export function getEffectivePlatformSettings(activeThemeId: string): {
  key: string;
  label: string;
  value: string;
  source: string;
}[] {
  const env = process.env;
  const settings = [
    {
      key: "MOSAIX_ENV",
      label: "Environnement d'exécution",
      value: env.MOSAIX_ENV ?? env.NODE_ENV ?? "development",
      source: "environment",
    },
    {
      key: "MOSAIX_PORT",
      label: "Port d'écoute",
      value: String(env.MOSAIX_PORT ?? env.PORT ?? "3000"),
      source: "environment",
    },
    {
      key: "MOSAIX_COMPOSITION",
      label: "Composition active",
      value: env.MOSAIX_COMPOSITION ?? "community-platform",
      source: "environment",
    },
    {
      key: "MOSAIX_DEFAULT_BAC",
      label: "Application par défaut",
      value: env.MOSAIX_DEFAULT_BAC ?? "solara",
      source: "environment",
    },
    {
      key: "MOSAIX_MAINTENANCE_MODE",
      label: "Mode maintenance",
      value: String(env.MOSAIX_MAINTENANCE_MODE ?? "false"),
      source: "environment",
    },
    {
      key: "platform_theme_id",
      label: "Thème de la plateforme",
      value: activeThemeId,
      source: "database",
    },
  ];
  return settings;
}

export async function handlePlatformThemeRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  currentUserRole?: string,
): Promise<boolean> {
  const pathname = parsedUrl.pathname;

  if (
    pathname !== "/api/admin/platform-theme" &&
    pathname !== "/api/admin/platform-settings"
  ) {
    return false;
  }

  if (!isAdminRole(currentUserRole)) {
    sendJson(res, 403, {
      success: false,
      error: "Accès refusé. Privilèges d'administration requis.",
    });
    return true;
  }

  // GET effective settings snapshot (read-only).
  if (pathname === "/api/admin/platform-settings" && req.method === "GET") {
    const themeId = await getPlatformThemeId();
    sendJson(res, 200, {
      success: true,
      settings: getEffectivePlatformSettings(themeId),
    });
    return true;
  }

  // GET active theme + discoverable gallery.
  if (pathname === "/api/admin/platform-theme" && req.method === "GET") {
    const themeId = await getPlatformThemeId();
    sendJson(res, 200, {
      success: true,
      themeId,
      runtimeThemeId: getActiveThemeId(),
      themes: listDiscoverableThemes(),
    });
    return true;
  }

  // PUT persist + apply live.
  if (pathname === "/api/admin/platform-theme" && req.method === "PUT") {
    try {
      const data = await readLimitedJson<{ themeId?: unknown }>(req);
      const themeId = typeof data.themeId === "string" ? data.themeId : "";
      const persisted = await setPlatformThemeId(themeId);
      sendJson(res, 200, { success: true, themeId: persisted });
    } catch (err) {
      sendJson(res, 400, {
        success: false,
        error: err instanceof Error ? err.message : "Thème invalide",
      });
    }
    return true;
  }

  sendJson(res, 405, { success: false, error: "Méthode non supportée" });
  return true;
}
