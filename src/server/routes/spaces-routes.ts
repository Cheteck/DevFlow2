/**
 * @server/routes — Space seller proposal submission API (SELL-FLOW-02).
 *
 * Restores the session work lost before a055b8e (V1.3):
 * `POST /api/spaces/:spaceId/proposals` creates a vendor proposal Draft via
 * `ProposalService.createDraft` (review/approval stays in Portfolio).
 *
 * Auth: an authenticated shell user is required (guest → 401). The path
 * `spaceId` is the owning space; the caller must submit for a space context
 * they operate in — full membership checks belong to Spaces (see backlog).
 */

import type * as http from "node:http";
import type { URL } from "node:url";
import type { ProposalService } from "../../../apps/portfolio/src/domain/proposal-service.js";

export interface SpacesProposalRouteDeps {
  /** Authenticated shell user id (`guest`/empty → 401). */
  currentUserId?: string;
  proposalService?: Pick<ProposalService, "createDraft">;
}

const PATH_RE = /^\/api\/spaces\/([^/]+)\/proposals$/;
const ALLOWED_TYPES = ["Product", "Service", "DigitalProduct", "Experience"] as const;

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString();
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

/**
 * Browser forms post urlencoded; API clients post JSON. Both map onto the
 * same proposal input. Form fields: name, reference, type, price (major
 * units), currency, stock (optional integer → characteristics.stockAllocation).
 */
function parseBody(raw: string, contentType: string): Record<string, unknown> {
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(raw);
    const out: Record<string, unknown> = {};
    for (const key of ["name", "reference", "type", "price", "currency", "stock"]) {
      const value = params.get(key);
      if (value !== null) out[key] = value;
    }
    return out;
  }
  return JSON.parse(raw) as Record<string, unknown>;
}

function wantsHtml(req: http.IncomingMessage): boolean {
  return (req.headers.accept ?? "").includes("text/html");
}

function redirect(res: http.ServerResponse, location: string): void {
  res.writeHead(303, { Location: location });
  res.end();
}

function json(res: http.ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

export async function handleSpacesProposalRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  deps: SpacesProposalRouteDeps = {},
): Promise<boolean> {
  const match = PATH_RE.exec(parsedUrl.pathname);
  if (!match) {
    return false;
  }
  const spaceId = (match[1] ?? "").trim();
  if (!spaceId) {
    return false;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed, use POST with a JSON proposal body." });
    return true;
  }

  const userId = (deps.currentUserId ?? "").trim();
  if (!userId || userId === "guest") {
    json(res, 401, { error: "Authentication required to submit a vendor proposal." });
    return true;
  }
  if (!deps.proposalService) {
    json(res, 503, { error: "Proposal service unavailable." });
    return true;
  }

  let body: Record<string, unknown>;
  try {
    body = parseBody(await readBody(req), req.headers["content-type"] ?? "");
  } catch {
    json(res, 400, { error: "Malformed body (JSON or urlencoded expected)." });
    return true;
  }

  // JSON shape: { suggestedReference, type, content, ... }.
  // Form shape: { reference, name, type, price, currency, stock }.
  const suggestedReference = (
    typeof body.suggestedReference === "string"
      ? body.suggestedReference
      : typeof body.reference === "string"
        ? body.reference
        : ""
  ).trim();
  const type = typeof body.type === "string" ? body.type : "";
  const fail = (statusCode: number, code: string, error: string): true => {
    if (wantsHtml(req)) {
      redirect(res, `/spaces?view=sell&space=${encodeURIComponent(spaceId)}&error=${code}`);
      return true;
    }
    json(res, statusCode, { error });
    return true;
  };
  if (!suggestedReference) {
    return fail(400, "missing_reference", "Body requires 'suggestedReference' (non-empty string).");
  }
  if (!(ALLOWED_TYPES as readonly string[]).includes(type)) {
    return fail(400, "bad_type", `Body requires 'type' in ${ALLOWED_TYPES.join(", ")}.`);
  }

  const recordOf = (value: unknown): Record<string, unknown> =>
    value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};

  // Form price: decimal major units → cents. JSON callers pass commercialTerms directly.
  let commercialTerms = recordOf(body.commercialTerms);
  const characteristics = recordOf(body.characteristics);
  if (body.price !== undefined || body.name !== undefined || body.stock !== undefined) {
    const price = typeof body.price === "string" && body.price.trim() !== "" ? Number(body.price) : NaN;
    if (body.price !== undefined && !(Number.isFinite(price) && price > 0)) {
      return fail(400, "bad_price", "Field 'price' must be a positive number.");
    }
    const currency =
      typeof body.currency === "string" && body.currency.trim() !== "" ? body.currency.trim() : "EUR";
    const contentName = typeof body.name === "string" ? body.name.trim() : "";
    // Commercial terms live inside content (ProposalService convention:
    // content.commercialTerms), not as a sibling field.
    commercialTerms = {
      ...(Number.isFinite(price) ? { priceInCents: Math.round(price * 100), currency } : {}),
      ...commercialTerms,
    };
    const content = {
      ...(contentName ? { fr: { name: contentName } } : {}),
      ...recordOf(body.content),
      ...(Object.keys(commercialTerms).length > 0 ? { commercialTerms } : {}),
    };
    if (body.stock !== undefined && String(body.stock).trim() !== "") {
      const stock = Number(body.stock);
      if (!Number.isInteger(stock) || stock < 0) {
        return fail(400, "bad_stock", "Field 'stock' must be a non-negative integer.");
      }
      characteristics.stockAllocation = stock;
    }
    body = { ...body, content, characteristics };
  }

  try {
    const draft = await deps.proposalService.createDraft(spaceId, userId, {
      suggestedReference,
      type: type as (typeof ALLOWED_TYPES)[number],
      content: recordOf(body.content),
      classification: recordOf(body.classification),
      characteristics: recordOf(body.characteristics),
      features: recordOf(body.features),
      variants: recordOf(body.variants),
      media: recordOf(body.media),
      translations: recordOf(body.translations),
    });
    if (wantsHtml(req)) {
      redirect(res, `/spaces?view=sell&space=${encodeURIComponent(spaceId)}&submitted=${encodeURIComponent(draft.id)}`);
      return true;
    }
    json(res, 201, { id: draft.id, spaceId: draft.spaceId, status: draft.status });
    return true;
  } catch (err) {
    json(res, 500, { error: err instanceof Error ? err.message : "Proposal submission failed." });
    return true;
  }
}
