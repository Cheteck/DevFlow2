/**
 * @server/routes — Platform Maintenance API Routes (FEAT-01)
 */

import type * as http from "node:http";
import type { URL } from "node:url";
import { maintenanceService } from "@mosaix/core";
import { sendProblemResponse } from "../../shell/http-errors.js";
import type { UserProfile } from "../../shell/profiles.js";
import { readLimitedJson } from "../utils/safe-body-parser.js";

export async function handleMaintenanceRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  currentUser: UserProfile
): Promise<boolean> {
  const pathname = parsedUrl.pathname;

  if (pathname === "/api/imperia/maintenance") {
    if (req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(maintenanceService.getMaintenanceStatus()));
      return true;
    }

    if (req.method === "POST") {
      // VULN-03: Only verified roles and permissions, no unauthenticated HTTP header spoofing
      const isAllowed =
        maintenanceService.isUserBypassed(currentUser?.role, currentUser?.permissions) ||
        currentUser?.role === "admin";

      if (!isAllowed) {
        sendProblemResponse(
          res,
          403,
          "Forbidden",
          "Seuls les administrateurs de gouvernance peuvent modifier le mode maintenance."
        );
        return true;
      }

      try {
        const body = await readLimitedJson<{
          enabled?: boolean;
          reason?: string;
          estimatedDurationMinutes?: number;
        }>(req);
        const updated = maintenanceService.setMaintenanceMode(
          Boolean(body.enabled),
          body.reason,
          body.estimatedDurationMinutes,
          currentUser?.name ?? "platform-admin"
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, maintenance: updated }));
      } catch (err) {
        sendProblemResponse(res, 400, "Bad Request", String(err));
      }
      return true;
    }
  }

  return false;
}
