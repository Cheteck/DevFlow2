/**
 * @server/middleware — Role Guard Middleware
 * Fail-closed role check for JSON API routes: allows the request when the
 * user's role is listed, otherwise writes a 403 JSON envelope. Callers treat
 * a `false` return as "response already sent".
 */

import type * as http from "node:http";
import type { UserProfile } from "../../shell/profiles.js";

export function requireRole(
  res: http.ServerResponse,
  currentUser: UserProfile,
  allowedRoles: readonly string[],
): boolean {
  if (allowedRoles.includes(currentUser.role)) {
    return true;
  }

  res.writeHead(403, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      success: false,
      error: "Forbidden: insufficient role for this endpoint.",
    }),
  );
  return false;
}
