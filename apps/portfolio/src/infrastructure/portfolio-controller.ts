/**
 * @apps/portfolio — HTTP Controller with authorization.
 * All routes require an authenticated principal (Gateway-forwarded) and the
 * matching `portfolio:vendable:<action>:tenant` permission.
 * Domain errors are mapped to HTTP statuses (400/404/409), never raw throws.
 *
 * Router limitation: @mosaix/http.Router does not support dynamic path params.
 * We parse req.path manually for routes like /portfolio/vendables/:id.
 */

import * as crypto from "node:crypto";
import {
  Controller,
  OpenApiGenerator,
  type HttpRequest,
  type HttpResponse,
  type Router,
} from "@mosaix/http";
import { Guard, type UserContext } from "@mosaix/security";
import type { Vendable, VendableType, WorkflowStatus } from "../domain/vendable.js";
import type { VendableRepository } from "../domain/vendable-repository.js";
import type { PortfolioService } from "../domain/portfolio-service.js";
import type { VendableWorkflow } from "../vendable-workflow.js";
import { VendableNotFoundError, DuplicateVendableReferenceError, OperationalKeyForbiddenError, InvalidWorkflowTransitionError } from "../domain/portfolio-errors.js";

const READ = "portfolio:vendable:read:tenant";
const CREATE = "portfolio:vendable:create:tenant";
const PUBLISH = "portfolio:vendable:publish:tenant";

const TYPE_ALIASES: Record<string, VendableType> = {
  product: "Product",
  service: "Service",
  digital_good: "DigitalProduct",
  digitalproduct: "DigitalProduct",
  experience: "Experience",
  Product: "Product",
  Service: "Service",
  DigitalProduct: "DigitalProduct",
  Experience: "Experience",
};

function toUserContext(req: HttpRequest): UserContext | null {
  const principal = req.principal;
  if (!principal) return null;
  return {
    sub: principal.sub,
    roles: principal.roles ?? [],
    permissions: principal.permissions ?? [],
  };
}

/**
 * Parse dynamic route segments manually (Router does not support :params).
 * Returns null if path does not match the pattern.
 * Example: matchPath(req, "GET", "/portfolio/vendables/") → { id: "..." } or null
 */
function matchPath(
  req: HttpRequest,
  method: "GET" | "POST" | "PUT" | "DELETE",
  prefix: string,
): { id: string } | null {
  if (req.method.toUpperCase() !== method) return null;
  if (!req.path.startsWith(prefix)) return null;

  const remainder = req.path.substring(prefix.length);
  // remainder should be "/{id}" or "/{id}/something"
  const segments = remainder.split("/").filter((s) => s.length > 0);
  if (segments.length === 0) return null;

  let id: string;
  try {
    id = decodeURIComponent(segments[0]);
  } catch {
    return null;
  }
  if (!id || id.trim().length === 0) return null;

  return { id };
}

export class PortfolioController extends Controller {
  private readonly guard = new Guard();

  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly vendableRepository: VendableRepository,
    private readonly vendableWorkflow: VendableWorkflow,
  ) {
    super();
  }

  private denialOrError(err: unknown): HttpResponse<{ error: string }> {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith("Unauthorized")) {
      return this.json({ error: message }, 401);
    }
    if (message.startsWith("Forbidden")) {
      return this.json({ error: message }, 403);
    }
    if (err instanceof VendableNotFoundError) {
      return this.notFound(message);
    }
    if (err instanceof DuplicateVendableReferenceError) {
      return this.json({ error: message }, 409);
    }
    if (err instanceof OperationalKeyForbiddenError) {
      return this.badRequest(message);
    }
    if (err instanceof InvalidWorkflowTransitionError) {
      return this.badRequest(message);
    }
    return this.internalError(message);
  }

  async getCatalog(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), READ);
      const items = await this.vendableRepository.findAll();
      return this.json({ catalog: items, count: items.length });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async getVendable(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), READ);
      const match = matchPath(req, "GET", "/portfolio/vendables/");
      if (!match) {
        return this.badRequest("Invalid vendable ID path");
      }
      const found = await this.portfolioService.findVendable(match.id);
      if (!found) {
        return this.notFound(`Vendable [${match.id}] not found.`);
      }
      return this.json({ vendable: found });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async createVendable(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), CREATE);
      const body = (req.body ?? {}) as { name?: string; type?: string };
      const normalizedType = TYPE_ALIASES[(body.type ?? "").toLowerCase()] ?? TYPE_ALIASES[body.type ?? ""];
      if (!body.name || !normalizedType) {
        return this.badRequest("Missing name or valid type");
      }
      const id = `vend_${crypto.randomUUID()}`;
      const vendable: Vendable = {
        identity: {
          id,
          reference: `REF-${id}`,
          type: normalizedType,
          status: "Draft",
        },
        content: {
          fr: { name: body.name },
        },
        characteristics: {
          attributes: {},
        },
        classification: {
          categories: [],
          tags: [],
          collections: [],
        },
        media: [],
        variants: [],
        relations: [],
      };
      const created = await this.portfolioService.createVendable(vendable);
      return this.created(created);
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async updateVendable(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), CREATE); // same permission as create
      const match = matchPath(req, "PUT", "/portfolio/vendables/");
      if (!match) {
        return this.badRequest("Invalid vendable ID path");
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const updated = await this.portfolioService.updateVendable(match.id, {
        content: body.content as Vendable["content"] | undefined,
        characteristics: body.characteristics as Vendable["characteristics"] | undefined,
        classification: body.classification as Vendable["classification"] | undefined,
        media: body.media as Vendable["media"] | undefined,
        variants: body.variants as Vendable["variants"] | undefined,
        relations: body.relations as Vendable["relations"] | undefined,
        identity: body.identity as { status?: WorkflowStatus; reference?: string } | undefined,
      });
      return this.json({ vendable: updated });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async deleteVendable(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), CREATE);
      const match = matchPath(req, "DELETE", "/portfolio/vendables/");
      if (!match) {
        return this.badRequest("Invalid vendable ID path");
      }
      await this.portfolioService.deleteVendable(match.id);
      return this.noContent();
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async publishVendable(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), PUBLISH);
      const body = (req.body ?? {}) as { id?: string };
      if (!body.id) {
        return this.badRequest("Missing vendable id");
      }
      const existing = await this.portfolioService.findVendable(body.id);
      if (!existing) {
        return this.notFound(`Vendable [${body.id}] not found.`);
      }

      // Validate completeness server-side (no hard-coded qualityPassed)
      const validation = this.vendableWorkflow.validatePublishable(existing, this.portfolioService);
      if (!validation.valid) {
        return this.badRequest(`Publication refusée : ${validation.errors.join("; ")}`);
      }

      // Use PortfolioService to update status (single source of truth for transitions)
      const result = await this.portfolioService.updateWorkflowStatus(body.id, "Published");
      return this.json({ vendable: result, completeness: validation.completeness });
    } catch (err) {
      return this.denialOrError(err);
    }
  }
}

/**
 * Single source of truth for Portfolio HTTP routes (uniform `/portfolio` prefix).
 * Router limitation: no PATCH method, no dynamic params — we handle ID extraction in handlers.
 */
export function mountPortfolioControllerRoutes(
  router: Router,
  controller: PortfolioController,
): void {
  router.get("/portfolio/catalog", (req) => controller.getCatalog(req));
  router.get("/portfolio/vendables/", (req) => controller.getVendable(req)); // matches /portfolio/vendables/{id}
  router.post("/portfolio/vendables", (req) => controller.createVendable(req));
  router.put("/portfolio/vendables/", (req) => controller.updateVendable(req)); // matches /portfolio/vendables/{id}
  router.delete("/portfolio/vendables/", (req) => controller.deleteVendable(req)); // matches /portfolio/vendables/{id}
  router.post("/portfolio/vendables/publish", (req) => controller.publishVendable(req));
}

/**
 * Generates the OpenAPI v3 spec from the mounted routes (health criterion).
 */
export function generatePortfolioOpenApi(router: Router): Record<string, unknown> {
  return OpenApiGenerator.generateSpec("Portfolio PIM", "1.0.0", router.getRoutes());
}
