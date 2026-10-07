/**
 * @server/middleware — Centralized RBAC Role & Permission Authorization Guards
 * Reusable HTTP authorization guards for administrative and privileged endpoints.
 */

import type { ServerResponse } from "node:http";
import type { UserProfile } from "../../shell/profiles.js";

export function hasRole(user: UserProfile, allowedRoles: string[]): boolean {
  if (!user || !user.role) return false;
  if (user.role === "admin" || user.role === "superadmin") return true;
  return allowedRoles.includes(user.role);
}

export function hasPermission(user: UserProfile, requiredPermission: string): boolean {
  if (!user) return false;
  if (user.role === "admin" || user.role === "superadmin") return true;
  if (user.permissions?.includes("*")) return true;
  return Boolean(user.permissions?.includes(requiredPermission));
}

export function requireRole(
  res: ServerResponse,
  user: UserProfile,
  allowedRoles: string[],
): boolean {
  if (!hasRole(user, allowedRoles)) {
    res.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        status: "error",
        code: "E_FORBIDDEN",
        message: `Accès interdit : Rôle requis parmi [${allowedRoles.join(", ")}]. Rôle actuel : [${user?.role || "guest"}].`,
      }),
    );
    return false;
  }
  return true;
}

export function requirePermission(
  res: ServerResponse,
  user: UserProfile,
  requiredPermission: string,
): boolean {
  if (!hasPermission(user, requiredPermission)) {
    res.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        status: "error",
        code: "E_FORBIDDEN",
        message: `Accès interdit : Permission [${requiredPermission}] requise.`,
      }),
    );
    return false;
  }
  return true;
}
