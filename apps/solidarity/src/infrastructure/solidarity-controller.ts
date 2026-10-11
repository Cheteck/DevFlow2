/**
 * @apps/solidarity — HTTP Controller with authorization.
 * All routes require an authenticated principal (Gateway-forwarded) and the
 * matching `solidarity:<action>:tenant` permission. Router matches exact
 * paths only, so lookups use query parameters (`?needId=`, `?crisis=`).
 * Domain errors map to HTTP statuses (400/404/409), never raw throws.
 */

import {
  Controller,
  OpenApiGenerator,
  type HttpRequest,
  type HttpResponse,
  type Router,
} from "@mosaix/http";
import { Guard, type UserContext } from "@mosaix/security";
import { SolidarityService } from "./solidarity-service.js";

const NEED_READ = "solidarity:need:declare:tenant";
const MATCHING_PROPOSE = "solidarity:matching:propose:tenant";
const ALLOCATION_CONFIRM = "solidarity:allocation:confirm:tenant";

function toUserContext(req: HttpRequest): UserContext | null {
  const principal = req.principal;
  if (!principal) return null;
  return {
    sub: principal.sub,
    roles: principal.roles ?? [],
    permissions: principal.permissions ?? [],
  };
}

export class SolidarityController extends Controller {
  private readonly guard = new Guard();

  constructor(private readonly solidarityService: SolidarityService) {
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
    return this.internalError(message);
  }

  async getNeedCoverage(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), NEED_READ);
      const needId = req.query?.needId;
      if (!needId) {
        return this.badRequest("Missing query parameter: needId");
      }
      const coverage = this.solidarityService.getNeedCoverage(needId);
      if (!coverage) {
        return this.notFound(`Unknown need '${needId}'.`);
      }
      return this.json({ needId, ...coverage });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async getMatches(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), MATCHING_PROPOSE);
      const needId = req.query?.needId;
      if (!needId) {
        return this.badRequest("Missing query parameter: needId");
      }
      const proposals = this.solidarityService.proposeMatchesForNeed(needId);
      return this.json({ needId, proposals, count: proposals.length });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async getHxlReport(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), NEED_READ);
      const crisis = req.query?.crisis ?? "Solidarity operations";
      const rows = this.solidarityService.buildHxlReport(crisis);
      return this.json({ crisis, rows, count: rows.length });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async confirmAllocation(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), ALLOCATION_CONFIRM);
      const body = (req.body ?? {}) as {
        resourceId?: string;
        needId?: string;
        quantity?: number;
        idempotencyKey?: string;
      };
      if (!body.resourceId || !body.needId || !body.idempotencyKey) {
        return this.badRequest("Missing resourceId, needId or idempotencyKey");
      }
      if (typeof body.quantity !== "number" || body.quantity <= 0) {
        return this.badRequest("Quantity must be a number greater than 0");
      }
      const result = await this.solidarityService.allocateResource(
        body.resourceId,
        body.needId,
        body.quantity,
        body.idempotencyKey,
      );
      if (!result.success) {
        const status = result.error?.startsWith("Unknown resource") ? 404 : 409;
        return this.json({ error: result.error }, status);
      }
      return this.created({ allocation: result.allocation, alreadyProcessed: result.alreadyProcessed ?? false });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  registerRoutes(router: Router): void {
    mountSolidarityControllerRoutes(router, this);
  }
}

/**
 * Single source of truth for Solidarity HTTP routes (uniform `/solidarity` prefix).
 */
export function mountSolidarityControllerRoutes(router: Router, controller: SolidarityController): void {
  router.get("/solidarity/need-coverage", (req) => controller.getNeedCoverage(req));
  router.get("/solidarity/matches", (req) => controller.getMatches(req));
  router.get("/solidarity/hxl", (req) => controller.getHxlReport(req));
  router.post("/solidarity/allocations", (req) => controller.confirmAllocation(req));
}

/**
 * Generates the OpenAPI v3 spec from the mounted routes (health criterion).
 */
export function generateSolidarityOpenApi(router: Router): Record<string, unknown> {
  return OpenApiGenerator.generateSpec("Solidarity Operations", "1.0.0", router.getRoutes());
}
