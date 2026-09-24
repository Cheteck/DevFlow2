/**
 * @server/routes — Theme Switching API Routes
 */

import type * as http from "node:http";
import type { URL } from "node:url";
import type { ThemeMode } from "@mosaix/contracts";
import { applyThemeMode } from "../shell/theme/theme-bridge.js";

export async function handleThemeRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  activeMode: ThemeMode,
  setActiveMode: (mode: ThemeMode) => void
): Promise<boolean> {
  const pathname = parsedUrl.pathname;

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

  return false;
}
