/**
 * @server/routes — Feature Flags Management API Routes
 */

import type * as http from "node:http";
import type { URL } from "node:url";
import { platformFeatureFlags } from "../../shell/feature-flags.js";
import { readLimitedJson } from "../utils/safe-body-parser.js";

export async function handleFeatureFlagRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  currentUserRole: string
): Promise<boolean> {
  const pathname = parsedUrl.pathname;

  // Override feature flag (dev helper)
  if (pathname === "/api/feature-flags/override" && req.method === "POST") {
    try {
      const body = await readLimitedJson<{ key?: string; value?: unknown }>(req);
      if (body.key && (typeof body.value === "boolean" || typeof body.value === "string")) {
        await platformFeatureFlags.setFlag(body.key, body.value);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, key: body.key, value: body.value }));
        return true;
      }
    } catch (e) {
      console.error("Failed to override feature flag:", e);
    }
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: "Payload feature flag invalide" }));
    return true;
  }

  // Feature flags list & create
  if (pathname === "/api/feature-flags") {
    if (req.method === "GET") {
      const flags = await platformFeatureFlags.listFlags();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, flags }));
      return true;
    }

    if (req.method === "POST") {
      if (currentUserRole !== "admin") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Accès refusé. Privilèges d'administration requis." }));
        return true;
      }

      try {
        const data = await readLimitedJson<{ key?: string; value?: unknown; description?: string }>(req);
        const { key, value, description } = data;
        if (key && (typeof value === "boolean" || typeof value === "string")) {
          await platformFeatureFlags.setFlag(key, value, description);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, message: `Flag ${key} updated`, key, value }));
          return true;
        }
      } catch {
        // ignore
      }
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Clé ou valeur de feature flag manquante" }));
      return true;
    }
  }

  // Toggle flag
  if (pathname === "/api/feature-flags/toggle" && req.method === "POST") {
    if (currentUserRole !== "admin") {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Accès refusé. Privilèges d'administration requis." }));
      return true;
    }

    try {
      const data = await readLimitedJson<{ key?: string }>(req);
      const { key } = data;
      if (key) {
        const current = await platformFeatureFlags.isEnabled(key, undefined, false);
        const updated = !current;
        await platformFeatureFlags.setFlag(key, updated);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, message: `Flag ${key} basculé à ${updated}`, key, enabled: updated }));
        return true;
      }
    } catch {
      // ignore
    }
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: "Clé de feature flag manquante" }));
    return true;
  }

  return false;
}
