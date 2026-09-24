/**
 * @server/middleware — Maintenance Gate Middleware
 * Blocks non-administrative traffic when platform maintenance mode is enabled (FEAT-01).
 */

import type * as http from "node:http";
import { maintenanceService } from "@mosaix/core";
import { renderMaintenancePage } from "../../shell/renderer.js";
import { renderHeadBlock } from "../../shell/ssr-engine.js";
import { renderThemeStyleTag } from "../../shell/theme/theme-bridge.js";
import type { ThemeMode } from "@mosaix/contracts";

export function handleMaintenanceGate(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  userRole: string,
  activeMode: ThemeMode,
  sharedStyles: string
): boolean {
  if (!maintenanceService.isMaintenanceActive()) {
    return false; // Not in maintenance, continue normal request processing
  }

  // Exempt internal identity and role switching endpoints to prevent lockout
  const isAuthOrSwitchRoute =
    pathname.startsWith("/identity") ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/user/switch" ||
    pathname === "/api/theme";

  if (maintenanceService.isUserBypassed(userRole) || isAuthOrSwitchRoute) {
    return false; // Bypassed role, allow access
  }

  const status = maintenanceService.getMaintenanceStatus();

  // API requests return JSON 503
  if (pathname.startsWith("/api/")) {
    res.writeHead(503, {
      "Content-Type": "application/json",
      "Retry-After": "1800",
    });
    res.end(
      JSON.stringify({
        error: "Service Unavailable",
        message: status.reason || "Plateforme en maintenance programmée.",
        estimatedDurationMinutes: status.estimatedDurationMinutes,
      })
    );
    return true; // Handled
  }

  // HTML page requests return full SSR maintenance layout
  const headHtml = renderHeadBlock(
    "Mode Maintenance — MosaiX Platform",
    activeMode,
    sharedStyles,
    renderThemeStyleTag(activeMode)
  );

  const html = `<!DOCTYPE html>
<html lang="fr" class="${activeMode === "dark" ? "dark" : ""}" data-theme-mode="${activeMode}">
<head>
  ${headHtml}
</head>
<body class="bg-surface-container-lowest text-on-surface antialiased overflow-x-hidden">
  ${renderMaintenancePage(status.reason, status.estimatedDurationMinutes)}
</body>
</html>`;

  res.writeHead(503, {
    "Content-Type": "text/html; charset=utf-8",
    "Retry-After": "1800",
  });
  res.end(html);
  return true; // Handled
}
