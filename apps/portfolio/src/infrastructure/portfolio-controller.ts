/**
 * @apps/portfolio — HTTP Controller with authorization.
 * All routes require an authenticated principal (Gateway-forwarded) and the
 * matching `portfolio:vendable:<action>:tenant` permission.
 * Domain errors are mapped to HTTP statuses (400/404/409), never raw throws.
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
import type { Vendable, VendableType } from "../domain/vendable.js";
import type { VendableRepository } from "../domain/vendable-repository.js";
import type { PortfolioService } from "../domain/portfolio-service.js";
import type { VendableWorkflow } from "../vendable-workflow.js";

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
    if (err instanceof Error && err.name === "VendableNotFoundError") {
      return this.notFound(message);
    }
    if (err instanceof Error && err.name === "DuplicateVendableReferenceError") {
      return this.json({ error: message }, 409);
    }
    if (err instanceof Error && err.name === "OperationalKeyForbiddenError") {
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

  async publishVendable(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), PUBLISH);
      const body = (req.body ?? {}) as { id?: string };
      if (!body.id) {
        return this.badRequest("Missing vendable id");
      }
      const existing = await this.vendableRepository.findById(body.id);
      if (!existing) {
        return this.notFound(`Vendable [${body.id}] not found.`);
      }
      const result = await this.vendableWorkflow.publish({
        vendableId: body.id,
        status: "In Review",
        qualityPassed: true,
      });
      return this.json(result);
    } catch (err) {
      return this.denialOrError(err);
    }
  }
}

/**
 * Single source of truth for Portfolio HTTP routes (uniform `/portfolio` prefix).
 */
export function mountPortfolioControllerRoutes(
  router: Router,
  controller: PortfolioController,
): void {
  router.get("/portfolio/catalog", (req) => controller.getCatalog(req));
  router.post("/portfolio/vendables", (req) => controller.createVendable(req));
  router.post("/portfolio/vendables/publish", (req) => controller.publishVendable(req));
}

/**
 * Generates the OpenAPI v3 spec from the mounted routes (health criterion).
 */
export function generatePortfolioOpenApi(router: Router): Record<string, unknown> {
  return OpenApiGenerator.generateSpec("Portfolio PIM", "1.0.0", router.getRoutes());
}
