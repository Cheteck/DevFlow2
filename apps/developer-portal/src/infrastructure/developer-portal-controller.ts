/**
 * @ijideals/developer-portal — HTTP controller.
 *
 * Toutes les routes exigent un principal authentifié (Gateway) et la
 * permission correspondante. Les erreurs domaine sont mappées en statuts
 * HTTP, jamais propagées brutes.
 *
 * Limitation @mosaix/http.Router : pas de paramètres dynamiques ; on parse
 * `req.path` manuellement pour `/developer-portal/catalog/{id}`.
 */

import {
  Controller,
  type HttpRequest,
  type HttpResponse,
  type Router,
} from "@mosaix/http";
import { Guard, type UserContext } from "@mosaix/security";
import type { CatalogEntryType } from "../domain/catalog-entry.js";
import type {
  DeveloperPortalService,
  CatalogProjectionUpdate,
} from "../domain/developer-portal-service.js";
import {
  CatalogEntryNotFoundError,
  InvalidCatalogEntryError,
} from "../domain/developer-portal-errors.js";

const READ = "developer-portal:resource:read:tenant";
const SUBMIT = "developer-portal:publishing:submit:tenant";

function toUserContext(req: HttpRequest): UserContext | null {
  const principal = req.principal;
  if (!principal) return null;
  return {
    sub: principal.sub,
    roles: principal.roles ?? [],
    permissions: principal.permissions ?? [],
  };
}

function catalogIdFromPath(req: HttpRequest): string | null {
  const prefix = "/developer-portal/catalog/";
  if (!req.path.startsWith(prefix)) return null;
  const id = req.path.slice(prefix.length);
  return id && !id.includes("/") ? id : null;
}

export class DeveloperPortalController extends Controller {
  constructor(
    private readonly service: DeveloperPortalService,
    private readonly guard: Guard = new Guard(),
  ) {
    super();
  }

  async health(): Promise<HttpResponse> {
    return this.json({ status: "ok", bac: "@ijideals/developer-portal" });
  }

  async listCatalog(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), READ);
      const type = req.query?.type;
      const text = req.query?.text;
      const entries = await this.service.listCatalog({
        ...(type ? { type: type as CatalogEntryType } : {}),
        ...(text ? { text } : {}),
      });
      return this.json({ entries });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async getEntry(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), READ);
      const id = catalogIdFromPath(req);
      if (!id) return this.badRequest("Invalid catalog path");
      return this.json({ entry: await this.service.getEntry(id) });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async projectResource(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), SUBMIT);
      const body = (req.body ?? {}) as Partial<CatalogProjectionUpdate>;
      if (!body.sourceId || !body.name || !body.type || !body.version) {
        return this.badRequest("sourceId, name, type and version are required");
      }
      const entry = await this.service.projectResource(
        body as CatalogProjectionUpdate,
      );
      return this.json({ entry }, 200);
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  private denialOrError(err: unknown): HttpResponse {
    if (err instanceof CatalogEntryNotFoundError)
      return this.notFound(err.message);
    if (err instanceof InvalidCatalogEntryError)
      return this.badRequest(err.message);
    if (err instanceof Error && err.message.startsWith("Unauthorized")) {
      return this.json({ error: err.message }, 401);
    }
    if (err instanceof Error && err.message.startsWith("Forbidden")) {
      return this.json({ error: err.message }, 403);
    }
    return this.internalError(
      err instanceof Error ? err.message : "Internal error",
    );
  }
}

/** Source unique des routes HTTP du portail. */
export function mountDeveloperPortalRoutes(
  router: Router,
  controller: DeveloperPortalController,
): void {
  router.get("/developer-portal/health", () => controller.health());
  router.get("/developer-portal/catalog", (req) => controller.listCatalog(req));
  router.get("/developer-portal/catalog/", (req) => controller.getEntry(req));
  router.post("/developer-portal/catalog", (req) =>
    controller.projectResource(req),
  );
}
