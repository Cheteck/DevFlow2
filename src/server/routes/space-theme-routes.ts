/**
 * @server/routes — Space-Level Theming API Routes
 * Manages fetching available themes, and setting/getting/resetting a Space's custom theme.
 */

import type * as http from "node:http";
import type { URL } from "node:url";
import type { DatabasePort } from "@mosaix/ports-database";
import type { UserProfile } from "../../shell/profiles.js";
import { readLimitedJson } from "../utils/safe-body-parser.js";
import { SpaceService, PostgresSpaceRepository } from "../../../apps/spaces/src/index.js";
import { themeCatalogueCache } from "../../themes/theme-catalogue-cache.js";

export async function handleSpaceThemeRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  currentUser: UserProfile,
  db: DatabasePort,
): Promise<boolean> {
  const pathname = parsedUrl.pathname;
  const spaceThemeMatch = pathname.match(/^\/api\/spaces\/([^/]+)\/theme$/);

  // 1. GET /api/themes — Returns catalog of available themes
  if (pathname === "/api/themes" && req.method === "GET") {
    try {
        const discovered = await themeCatalogueCache.getAll();
      const themes = discovered.map((t) => ({
        id: t.id,
        name: t.manifest.name,
        description: t.manifest.metadata?.description ?? "",
        version: t.manifest.version,
        primaryColor: t.manifest.tokens?.colors?.primary ?? "#4f46e5",
        backgroundColor: t.manifest.tokens?.colors?.background ?? "#f8fafc",
        modes: Object.keys(t.manifest.modes || {}),
      }));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, themes }));
      return true;
    } catch (err: unknown) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: (err as Error).message }));
      return true;
    }
  }

  // 2. Space specific theme routes
  if (spaceThemeMatch) {
    const spaceId = spaceThemeMatch[1];
    const spaceRepo = new PostgresSpaceRepository(db);
    const spaceService = new SpaceService(spaceRepo);
    const space = await spaceService.getSpaceAsync(spaceId);

    if (!space) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Space non trouvé" }));
      return true;
    }

    // GET /api/spaces/:spaceId/theme
    if (req.method === "GET") {
      const themeAssignment = space.themeId;
      const isInherited = !themeAssignment;
      const activeThemeId = themeAssignment || "mosaix-default";

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: true,
          spaceId,
          themeId: activeThemeId,
          isInherited,
        }),
      );
      return true;
    }

    // PUT /api/spaces/:spaceId/theme — Set theme (Admin/Owner only)
    if (req.method === "PUT") {
      const isAdmin = spaceService.isUserAdmin(spaceId, currentUser.id) || currentUser.role === "admin";
      if (!isAdmin) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Accès refusé. Privilèges d'administration du Space requis." }));
        return true;
      }

      try {
        const body = await readLimitedJson<{ themeId?: string }>(req);
        const themeId = body.themeId;

        if (!themeId) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "themeId est requis" }));
          return true;
        }

        // Validate against theme catalog
const discovered = await themeCatalogueCache.getAll();
        const validTheme = discovered.find((t) => t.id === themeId);
        if (!validTheme) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: `Thème '${themeId}' invalide ou introuvable dans le catalogue` }));
          return true;
        }

        // Persist themeId on Space
        await spaceService.setSpaceTheme(spaceId, themeId);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, spaceId, themeId, isInherited: false }));
        return true;
      } catch (err: unknown) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: (err as Error).message }));
        return true;
      }
    }

    // DELETE /api/spaces/:spaceId/theme — Reset theme to inherit global
    if (req.method === "DELETE") {
      const isAdmin = spaceService.isUserAdmin(spaceId, currentUser.id) || currentUser.role === "admin";
      if (!isAdmin) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Accès refusé. Privilèges d'administration du Space requis." }));
        return true;
      }

      try {
        await spaceService.resetSpaceTheme(spaceId);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, spaceId, isInherited: true, themeId: "mosaix-default" }));
        return true;
      } catch (err: unknown) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: (err as Error).message }));
        return true;
      }
    }
  }

  return false;
}
