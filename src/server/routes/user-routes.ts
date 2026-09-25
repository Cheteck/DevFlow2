/**
 * @server/routes — User & Space Context Switching API Routes
 */

import type * as http from "node:http";
import type { URL } from "node:url";
import { USER_PROFILES, isDemoMode } from "../../shell/profiles.js";

export function handleUserAndSpaceRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
): boolean {
  const pathname = parsedUrl.pathname;

  // Switch User Role
  if (pathname === "/api/user/switch") {
    // VULN-01: arbitrary role switching is a demo convenience — disabled
    // whenever demo mode is off (production by default, or explicit
    // MOSAIX_DEMO_USERS=false).
    if (!isDemoMode()) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: false,
          error:
            "Forbidden: Le basculement de rôle démo est désactivé (mode démo inactif).",
        }),
      );
      return true;
    }

    const requestedRole = parsedUrl.searchParams.get("role");
    if (requestedRole && USER_PROFILES[requestedRole]) {
      res.setHeader(
        "Set-Cookie",
        `mosaix_role=${requestedRole}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, role: requestedRole }));
    } else {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Rôle invalide" }));
    }
    return true;
  }

  // Switch Space Context
  if (pathname === "/api/space/switch") {
    const requestedSpace = parsedUrl.searchParams.get("spaceId") || "";
    if (requestedSpace === "none" || !requestedSpace) {
      res.setHeader(
        "Set-Cookie",
        "mosaix_active_space=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, spaceId: null }));
    } else {
      res.setHeader(
        "Set-Cookie",
        `mosaix_active_space=${requestedSpace}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, spaceId: requestedSpace }));
    }
    return true;
  }

  return false;
}
