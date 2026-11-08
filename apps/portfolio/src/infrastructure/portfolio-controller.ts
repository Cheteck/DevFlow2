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
import type { ProductWizardService, ProductWizardDraft, WizardStepResult } from "../domain/product-wizard.service.js";
import type { ProposalService } from "../domain/proposal-service.js";
import type { SearchCriteria } from "../domain/portfolio-service.js";

const READ = "portfolio:vendable:read:tenant";
const CREATE = "portfolio:vendable:create:tenant";
const PUBLISH = "portfolio:vendable:publish:tenant";
const SEARCH = "portfolio:vendable:search:tenant";

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
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
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

/**
 * Parse wizard step route: {sessionId}/steps/{step}.
 * Example: matchWizardStep(req, "PATCH", "/portfolio/wizard/sessions/")
 *   → { sessionId: "draft_prod_x", step: "1" } or null
 */
function matchWizardStep(
  req: HttpRequest,
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  prefix: string,
): { sessionId: string; step: string } | null {
  if (req.method.toUpperCase() !== method) return null;
  if (!req.path.startsWith(prefix)) return null;

  const remainder = req.path.substring(prefix.length);
  const segments = remainder.split("/").filter((s) => s.length > 0);
  if (segments.length !== 3) return null;
  if (segments[1] !== "steps") return null;

  let sessionId: string, step: string;
  try {
    sessionId = decodeURIComponent(segments[0]);
    step = decodeURIComponent(segments[2]);
  } catch {
    return null;
  }
  if (!sessionId || sessionId.trim().length === 0) return null;
  if (!step || step.trim().length === 0) return null;

  return { sessionId, step };
}

export class PortfolioController extends Controller {
  private readonly guard = new Guard();

  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly vendableRepository: VendableRepository,
    private readonly vendableWorkflow: VendableWorkflow,
    private readonly productWizardService?: ProductWizardService,
    private readonly proposalService?: ProposalService,
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
      const principal = req.principal;
      if (!principal) {
        return this.badRequest("Unauthorized");
      }
      const items = await this.vendableRepository.findAll(principal.tenantId);
      return this.json({ catalog: items, count: items.length });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async getVendable(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), READ);
      const principal = req.principal;
      if (!principal) {
        return this.badRequest("Unauthorized");
      }
      const match = matchPath(req, "GET", "/portfolio/vendables/");
      if (!match) {
        return this.badRequest("Invalid vendable ID path");
      }
      const found = await this.portfolioService.findVendable(match.id, principal.tenantId);
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
      const principal = req.principal;
      if (!principal) {
        return this.badRequest("Unauthorized");
      }
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
      const created = await this.portfolioService.createVendable(vendable, principal.tenantId);
      return this.created(created);
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async updateVendable(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), CREATE);
      const principal = req.principal;
      if (!principal) {
        return this.badRequest("Unauthorized");
      }
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
      }, principal.tenantId);
      return this.json({ vendable: updated });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async deleteVendable(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), CREATE);
      const principal = req.principal;
      if (!principal) {
        return this.badRequest("Unauthorized");
      }
      const match = matchPath(req, "DELETE", "/portfolio/vendables/");
      if (!match) {
        return this.badRequest("Invalid vendable ID path");
      }
      await this.portfolioService.deleteVendable(match.id, principal.tenantId);
      return this.noContent();
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async publishVendable(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), PUBLISH);
      const principal = req.principal;
      if (!principal) {
        return this.badRequest("Unauthorized");
      }
      const body = (req.body ?? {}) as { id?: string };
      if (!body.id) {
        return this.badRequest("Missing vendable id");
      }
      const existing = await this.portfolioService.findVendable(body.id, principal.tenantId);
      if (!existing) {
        return this.notFound(`Vendable [${body.id}] not found.`);
      }

      const validation = this.vendableWorkflow.validatePublishable(existing, this.portfolioService);
      if (!validation.valid) {
        return this.badRequest(`Publication refusée : ${validation.errors.join("; ")}`);
      }

      const result = await this.portfolioService.updateWorkflowStatus(body.id, "Published", principal.tenantId);
      return this.json({ vendable: result, completeness: validation.completeness });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async searchVendables(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), SEARCH);
      const principal = req.principal;
      if (!principal) {
        return this.badRequest("Unauthorized");
      }
      const body = (req.body ?? {}) as Partial<SearchCriteria>;
      const MAX_LIMIT = 100;
      const rawLimit = typeof body.limit === "number" ? body.limit : 50;
      const criteria: SearchCriteria = {
        offset: typeof body.offset === "number" ? Math.max(0, body.offset) : 0,
        limit: Math.max(1, Math.min(MAX_LIMIT, rawLimit)),
      };
      if (body.status) criteria.status = body.status;
      if (body.type) criteria.type = body.type;
      if (body.name) criteria.name = body.name;
      if (body.description) criteria.description = body.description;
      if (body.category) criteria.category = body.category;
      if (body.tag) criteria.tag = body.tag;
      if (body.collection) criteria.collection = body.collection;
      if (body.language) criteria.language = body.language;
      if (body.attribute && typeof body.attribute === "object") {
        criteria.attribute = body.attribute as { key: string; value?: unknown };
      }

      const results = await this.portfolioService.search(criteria, principal.tenantId);
      return this.json({ results, total: results.length });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async getAnalytics(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), READ);
      const principal = req.principal;
      if (!principal) {
        return this.badRequest("Unauthorized");
      }
      // Tenant isolation: filter vendables by tenantId
      const all = await this.vendableRepository.findAll();
      const tenantVendables = all.filter((v) => {
        const vendorId = v.characteristics.attributes?.vendorId as string | undefined;
        const spaceId = v.characteristics.attributes?.spaceId as string | undefined;
        return vendorId === principal.tenantId || spaceId === principal.tenantId;
      });
      const byStatus: Record<string, number> = {};
      const byType: Record<string, number> = {};
      let totalCompleteness = 0;

      for (const v of tenantVendables) {
        byStatus[v.identity.status] = (byStatus[v.identity.status] || 0) + 1;
        byType[v.identity.type] = (byType[v.identity.type] || 0) + 1;
        const q = this.portfolioService.calculateCompleteness(v);
        totalCompleteness += q.completeness;
      }

      const avgCompleteness = tenantVendables.length > 0 ? Math.round(totalCompleteness / tenantVendables.length) : 0;

      return this.json({
        total: tenantVendables.length,
        byStatus,
        byType,
        avgCompleteness,
      });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async exportCsv(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), READ);
      const tenantId = req.principal?.tenantId ?? "tenant_default";
      const csv = await this.portfolioService.exportCsv(tenantId);
      return {
        statusCode: 200,
        headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="vendables.csv"' },
        body: csv,
      };
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async importCsv(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), CREATE);
      const body = (req.body ?? {}) as { csv?: string };
      if (!body.csv || typeof body.csv !== "string") {
        return this.badRequest("Missing csv content");
      }
      const tenantId = req.principal?.tenantId ?? "tenant_default";
      const report = await this.portfolioService.importCsv(body.csv, tenantId);
      return this.json({
        imported: report.imported,
        failed: report.failed,
        total: report.imported + report.failed.length,
      });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async startWizardSession(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), CREATE);
      if (!this.productWizardService) {
        return this.internalError("Wizard service not available");
      }
      const body = (req.body ?? {}) as { vendorId?: string; spaceId?: string };
      const draft = this.productWizardService.startDraft(body.vendorId, body.spaceId);
      return this.created(draft);
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async updateWizardStep(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), CREATE);
      if (!this.productWizardService) {
        return this.internalError("Wizard service not available");
      }
      const match = matchWizardStep(req, "PATCH", "/portfolio/wizard/sessions/");
      if (!match) {
        return this.badRequest("Invalid wizard step path (expected /portfolio/wizard/sessions/{id}/steps/{step})");
      }
      const { sessionId, step } = match;
      const body = (req.body ?? {}) as Record<string, unknown>;

      let result: WizardStepResult;
      if (step === "1" || step === "identity") {
        result = this.productWizardService.saveStep1(sessionId, body as never);
      } else if (step === "2" || step === "variants") {
        result = this.productWizardService.saveStep2(sessionId, body as never);
      } else if (step === "3" || step === "media") {
        result = this.productWizardService.saveStep3(sessionId, body as never);
      } else if (step === "4" || step === "seo") {
        result = this.productWizardService.saveStep4(sessionId, body as never);
      } else {
        return this.badRequest(`Unknown step: ${step}`);
      }

      if (!result.valid) {
        return this.badRequest(`Step validation failed: ${result.errors.join("; ")}`);
      }
      return this.json({ draft: result.draft });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async finalizeWizard(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), PUBLISH);
      if (!this.productWizardService) {
        return this.internalError("Wizard service not available");
      }
      if (!req.path.endsWith("/finalize")) {
        return this.badRequest("Invalid wizard finalize path (expected /portfolio/wizard/sessions/{id}/finalize)");
      }
      const match = matchPath(req, "POST", "/portfolio/wizard/sessions/");
      if (!match) {
        return this.badRequest("Invalid wizard session path");
      }
      const vendable = await this.productWizardService.finalizeAndPublish(match.id, this.portfolioService);
      return this.json({ vendable });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  /**
   * Dispatcher for proposal lifecycle actions under the catch-all prefix
   * `POST /portfolio/proposals/{id}/{submit|approve|reject|withdraw}`.
   */
  async proposalAction(req: HttpRequest): Promise<HttpResponse> {
    const segments = req.path.split("/").filter(Boolean);
    const action = segments.pop();
    const VALID_ACTIONS = ["submit", "approve", "reject", "withdraw"];
    if (!action || !VALID_ACTIONS.includes(action)) {
      return this.badRequest(`Unknown proposal action: ${action ?? ""}`);
    }
    if (action === "submit") return this.submitProposal(req);
    if (action === "approve") return this.approveProposal(req);
    if (action === "reject") return this.rejectProposal(req);
    if (action === "withdraw") return this.withdrawProposal(req);
    return this.badRequest("Unknown action");
  }

  async createProposal(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), CREATE);
      if (!this.proposalService) {
        return this.internalError("Proposal service not available");
      }
      const principal = toUserContext(req);
      if (!principal) {
        return this.badRequest("Unauthorized");
      }
      const body = (req.body ?? {}) as { spaceId?: string; suggestedReference?: string; type?: string };
      if (!body.spaceId || !body.suggestedReference || !body.type) {
        return this.badRequest("Missing spaceId, suggestedReference, or type");
      }
      const proposal = await this.proposalService.createDraft(
        body.spaceId,
        principal.sub,
        {
          suggestedReference: body.suggestedReference,
          type: body.type as any,
          content: body.content,
          classification: body.classification,
          characteristics: body.characteristics,
          features: body.features,
          variants: body.variants,
          media: body.media,
          translations: body.translations,
        }
      );
      return this.created(proposal);
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async getProposal(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), READ);
      if (!this.proposalService) {
        return this.internalError("Proposal service not available");
      }
      const match = matchPath(req, "GET", "/portfolio/proposals/");
      if (!match) {
        return this.badRequest("Invalid proposal path");
      }
      const proposal = await this.proposalService.findById(match.id);
      if (!proposal) {
        return this.notFound(`Proposal [${match.id}] not found`);
      }
      return this.json({ proposal });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async updateProposal(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), CREATE);
      if (!this.proposalService) {
        return this.internalError("Proposal service not available");
      }
      const match = matchPath(req, "PUT", "/portfolio/proposals/");
      if (!match) {
        return this.badRequest("Invalid proposal path");
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const principal = toUserContext(req);
      if (!principal) {
        return this.badRequest("Unauthorized");
      }
      const updated = await this.proposalService.updateDraft(
        match.id,
        body.spaceId as string || "default",
        body as any
      );
      return this.json({ proposal: updated });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async submitProposal(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), CREATE);
      if (!this.proposalService) {
        return this.internalError("Proposal service not available");
      }
      const match = matchPath(req, "POST", "/portfolio/proposals/");
      if (!match) {
        return this.badRequest("Invalid proposal path");
      }
      const body = (req.body ?? {}) as { spaceId?: string };
      const submitted = await this.proposalService.submit(match.id, body.spaceId || "default");
      return this.json({ proposal: submitted });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async approveProposal(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), PUBLISH);
      if (!this.proposalService) {
        return this.internalError("Proposal service not available");
      }
      const match = matchPath(req, "POST", "/portfolio/proposals/");
      if (!match) {
        return this.badRequest("Invalid proposal path");
      }
      const body = (req.body ?? {}) as { reviewerUserId?: string; approvedTerms?: Record<string, unknown>; idempotencyKey?: string };
      const result = await this.proposalService.approve(match.id, body.reviewerUserId || "system", {
        approvedTerms: body.approvedTerms,
        idempotencyKey: body.idempotencyKey,
      });
      return this.json({ proposal: result.proposal, vendableId: result.vendableId, offerId: result.offerId });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async rejectProposal(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), PUBLISH);
      if (!this.proposalService) {
        return this.internalError("Proposal service not available");
      }
      const match = matchPath(req, "POST", "/portfolio/proposals/");
      if (!match) {
        return this.badRequest("Invalid proposal path");
      }
      const body = (req.body ?? {}) as { reviewerUserId?: string; reason?: string };
      const rejected = await this.proposalService.reject(match.id, body.reviewerUserId || "system", body.reason || "No reason provided");
      return this.json({ proposal: rejected });
    } catch (err) {
      return this.denialOrError(err);
    }
  }

  async withdrawProposal(req: HttpRequest): Promise<HttpResponse> {
    try {
      await this.guard.authorize(toUserContext(req), CREATE);
      if (!this.proposalService) {
        return this.internalError("Proposal service not available");
      }
      const match = matchPath(req, "POST", "/portfolio/proposals/");
      if (!match) {
        return this.badRequest("Invalid proposal path");
      }
      const body = (req.body ?? {}) as { spaceId?: string };
      const withdrawn = await this.proposalService.withdraw(match.id, body.spaceId || "default");
      return this.json({ proposal: withdrawn });
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
  // Existing routes
  router.get("/portfolio/catalog", (req) => controller.getCatalog(req));
  router.get("/portfolio/vendables/", (req) => controller.getVendable(req)); // matches /portfolio/vendables/{id}
  router.post("/portfolio/vendables", (req) => controller.createVendable(req));
  router.put("/portfolio/vendables/", (req) => controller.updateVendable(req)); // matches /portfolio/vendables/{id}
  router.delete("/portfolio/vendables/", (req) => controller.deleteVendable(req)); // matches /portfolio/vendables/{id}
  router.post("/portfolio/vendables/publish", (req) => controller.publishVendable(req));

  // P1 Routes — Search
  router.post("/portfolio/vendables/search", (req) => controller.searchVendables(req));

  // P1 Routes — Analytics
  router.get("/portfolio/analytics", (req) => controller.getAnalytics(req));

  // P1 Routes — CSV
  router.get("/portfolio/vendables/export", (req) => controller.exportCsv(req));
  router.post("/portfolio/vendables/import", (req) => controller.importCsv(req));

  // P1 Routes — Product Wizard
  router.post("/portfolio/wizard/sessions", (req) => controller.startWizardSession(req));
  // router doesn't have patch() method yet, we use put for step update or add patch to Router
  router.patch("/portfolio/wizard/sessions/", (req) => controller.updateWizardStep(req)); // for step updates
  router.post("/portfolio/wizard/sessions/", (req) => controller.finalizeWizard(req)); // for finalize

  // P1 Routes — Proposals
  router.post("/portfolio/proposals", (req) => controller.createProposal(req));
  router.get("/portfolio/proposals/", (req) => controller.getProposal(req));
  router.put("/portfolio/proposals/", (req) => controller.updateProposal(req));
  router.post("/portfolio/proposals/", (req) => controller.proposalAction(req));
}

/**
 * Generates the OpenAPI v3 spec from the mounted routes (health criterion).
 */
export function generatePortfolioOpenApi(router: Router): Record<string, unknown> {
  return OpenApiGenerator.generateSpec("Portfolio PIM", "1.0.0", router.getRoutes());
}
