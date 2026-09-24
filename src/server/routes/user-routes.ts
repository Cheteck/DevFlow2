/**
 * @server/routes — User & Space Context Switching API Routes
 */

import type * as http from "node:http";
import type { URL } from "node:url";
import { USER_PROFILES } from "../../shell/profiles.js";

export function handleUserAndSpaceRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL
): boolean {
  const pathname = parsedUrl.pathname;

  // Switch User Role
  if (pathname === "/api/user/switch") {
    const requestedRole = parsedUrl.searchParams.get("role");
    if (requestedRole && USER_PROFILES[requestedRole]) {
      res.setHeader(
        "Set-Cookie",
        `mosaix_role=${requestedRole}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`
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
        "mosaix_active_space=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, spaceId: null }));
    } else {
      res.setHeader(
        "Set-Cookie",
        `mosaix_active_space=${requestedSpace}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, spaceId: requestedSpace }));
    }
    return true;
  }

  return false;
}
