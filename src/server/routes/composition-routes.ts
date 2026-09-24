/**
 * @server/routes — Runtime Composition & Layout Overrides API Routes
 */

import type * as http from "node:http";
import type { URL } from "node:url";
import { CompositionManager } from "../shell/composition-loader.js";
import type { CompositionOverrideManager } from "@mosaix/core";
import { saveCompositionOverridesToFile } from "../shell/editor.js";

export function handleCompositionRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  currentUserRole: string,
  compositionOverrideManager: CompositionOverrideManager
): boolean {
  const pathname = parsedUrl.pathname;

  // List or switch active composition
  if (pathname === "/api/compositions") {
    if (req.method === "GET") {
      const compositions = CompositionManager.listCompositions();
      const active = CompositionManager.getActiveComposition();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, active: active?.id, compositions }));
      return true;
    }

    if (req.method === "POST") {
      let bodyStr = "";
      req.on("data", (chunk) => { bodyStr += chunk; });
      req.on("end", () => {
        try {
          const data = JSON.parse(bodyStr || "{}");
          const { compositionId } = data;
          if (compositionId && CompositionManager.setActiveComposition(compositionId)) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, activeComposition: compositionId }));
            return;
          }
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "Composition invalide ou introuvable." }));
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "JSON invalide." }));
        }
      });
      return true;
    }
  }

  // Composition overrides editor
  if (pathname === "/api/composition/override") {
    if (req.method === "POST") {
      if (currentUserRole !== "admin") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Accès refusé. Privilèges d'administration requis." }));
        return true;
      }

      let bodyStr = "";
      req.on("data", (chunk) => { bodyStr += chunk; });
      req.on("end", () => {
        try {
          const data = JSON.parse(bodyStr || "{}");
          const { surfaceId = "application-shell", slotId, contributionId, gridSpan, wrapper, order, enabled } = data;
          if (slotId && contributionId) {
            const currentStore = compositionOverrideManager.getStore(surfaceId);
            const existingSlot = currentStore.slotOverrides[slotId];
            const existingBlock = existingSlot?.blocks.find((b) => b.contributionId === contributionId);

            compositionOverrideManager.setBlockOverride(surfaceId, slotId, {
              contributionId,
              placementId: existingBlock?.placementId || `p-${contributionId}`,
              order: typeof order === "number" ? order : (existingBlock?.order ?? 1),
              gridSpan: typeof gridSpan === "number" ? gridSpan : (existingBlock?.gridSpan ?? 6),
              wrapper: wrapper || existingBlock?.wrapper || "card",
              enabled: typeof enabled === "boolean" ? enabled : (existingBlock?.enabled ?? true),
            });

            saveCompositionOverridesToFile(compositionOverrideManager, surfaceId);

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, message: "Block override updated and persisted to disk" }));
            return;
          }
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "slotId and contributionId required" }));
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "Invalid JSON body" }));
        }
      });
      return true;
    }
  }

  return false;
}
