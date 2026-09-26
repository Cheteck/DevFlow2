/**
 * @server/routes — Runtime Composition & Layout Overrides API Routes
 */

import type * as http from "node:http";
import type { URL } from "node:url";
import { CompositionManager } from "../../shell/composition-loader.js";
import type { CompositionOverrideManager } from "@mosaix/core";
import { saveCompositionOverridesToFile } from "../../shell/editor.js";
import { readLimitedJson } from "../utils/safe-body-parser.js";

export async function handleCompositionRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  currentUserRole: string,
  compositionOverrideManager: CompositionOverrideManager
): Promise<boolean> {
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
      try {
        const data = await readLimitedJson<{ compositionId?: string }>(req);
        const { compositionId } = data;
        if (compositionId && CompositionManager.setActiveComposition(compositionId)) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, activeComposition: compositionId }));
          return true;
        }
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Composition invalide ou introuvable." }));
        return true;
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "JSON invalide ou payload trop volumineux." }));
        return true;
      }
    }
  }

  // Composition overrides editor
  if (pathname === "/api/composition/override") {
    if (req.method === "POST") {
      if (currentUserRole !== "admin") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ success: false, error: "Accès refusé. Privilèges d'administration requis." })
        );
        return true;
      }

      try {
        const data = await readLimitedJson<{
          surfaceId?: string;
          slotId?: string;
          contributionId?: string;
          gridSpan?: number;
          wrapper?: "card" | "plain" | "hero";
          order?: number;
          enabled?: boolean;
        }>(req);
        const {
          surfaceId = "application-shell",
          slotId,
          contributionId,
          gridSpan,
          wrapper,
          order,
          enabled,
        } = data;
        if (slotId && contributionId) {
          const currentStore = compositionOverrideManager.getStore(surfaceId);
          const existingSlot = currentStore.slotOverrides[slotId];
          const existingBlock = existingSlot?.blocks.find((b) => b.contributionId === contributionId);
          // Route-level aliases mapped onto the canonical wrapper contract.
          const wrapperAliases = { card: "card", plain: "borderless", hero: "hero-strip" } as const;

          compositionOverrideManager.setBlockOverride(surfaceId, slotId, {
            contributionId,
            placementId: existingBlock?.placementId || `p-${contributionId}`,
            order: typeof order === "number" ? order : (existingBlock?.order ?? 1),
            gridSpan: typeof gridSpan === "number" ? gridSpan : (existingBlock?.gridSpan ?? 6),
            wrapper: (wrapper && wrapperAliases[wrapper]) || existingBlock?.wrapper || "card",
            enabled: typeof enabled === "boolean" ? enabled : (existingBlock?.enabled ?? true),
          });

          saveCompositionOverridesToFile(compositionOverrideManager, surfaceId);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              success: true,
              store: compositionOverrideManager.getStore(surfaceId),
            })
          );
          return true;
        }
      } catch {
        // ignore
      }
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Données de composition invalides" }));
      return true;
    }

    // GET /api/composition/override?surfaceId=...
    const surfaceId = parsedUrl.searchParams.get("surfaceId") || "application-shell";
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ store: compositionOverrideManager.getStore(surfaceId) }));
    return true;
  }

  return false;
}
