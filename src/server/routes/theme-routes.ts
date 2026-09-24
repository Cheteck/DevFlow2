/**
 * @server/routes — Theme Switching & Presets API Routes (THEME-14 / GAP-IHM-03)
 */

import type * as http from "node:http";
import type { URL } from "node:url";
import type { ThemeMode } from "@mosaix/contracts";
import type { CompositionOverrideManager } from "@mosaix/core";
import { applyThemeMode } from "../../shell/theme/theme-bridge.js";
import { saveCompositionOverridesToFile, type SavedBlockOverride } from "../../shell/editor.js";

export async function handleThemeRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  activeMode: ThemeMode,
  setActiveMode: (mode: ThemeMode) => void,
  currentUserRole?: string,
  compositionOverrideManager?: CompositionOverrideManager
): Promise<boolean> {
  const pathname = parsedUrl.pathname;

  // 1. GET / POST /api/theme
  if (pathname === "/api/theme" && (req.method === "POST" || req.method === "GET")) {
    const requestedMode = parsedUrl.searchParams.get("mode");
    if (requestedMode && ["light", "dark", "high-contrast", "system"].includes(requestedMode)) {
      const mode = requestedMode as ThemeMode;
      setActiveMode(mode);
      await applyThemeMode(mode);
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, mode: requestedMode || activeMode }));
    return true;
  }

  // 2. GAP-IHM-03: Theme Preset Export & Import (/api/theme/preset)
  if (pathname === "/api/theme/preset") {
    if (req.method === "POST") {
      if (currentUserRole !== "admin") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ success: false, error: "Accès refusé. Privilèges d'administration requis." })
        );
        return true;
      }

      let bodyStr = "";
      for await (const chunk of req) {
        bodyStr += chunk;
      }

      try {
        const data = JSON.parse(bodyStr || "{}");
        if (data.mode) {
          setActiveMode(data.mode as ThemeMode);
          await applyThemeMode(data.mode as ThemeMode);
        }
        if (data.compositionStore && compositionOverrideManager) {
          const store = data.compositionStore as {
            slotOverrides?: Record<string, { blocks?: SavedBlockOverride[] }>;
          };
          for (const [slotId, slotOverride] of Object.entries(store.slotOverrides || {})) {
            if (slotOverride && Array.isArray(slotOverride.blocks)) {
              for (const block of slotOverride.blocks) {
                compositionOverrideManager.setBlockOverride(
                  "application-shell",
                  slotId,
                  block as SavedBlockOverride
                );
              }
            }
          }
          saveCompositionOverridesToFile(compositionOverrideManager, "application-shell");
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
        return true;
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Fichier preset JSON invalide" }));
        return true;
      }
    }

    // GET preset JSON export
    const exportData = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      mode: activeMode,
      compositionStore: compositionOverrideManager
        ? compositionOverrideManager.getStore("application-shell")
        : {},
    };
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Content-Disposition": "attachment; filename=mosaix-theme-preset.json",
    });
    res.end(JSON.stringify(exportData, null, 2));
    return true;
  }

  return false;
}
