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
    body = JSON.parse(await readBody(req)) as Record<string, unknown>;
  } catch {
    json(res, 400, { error: "Malformed JSON body." });
    return true;
  }

  const suggestedReference = typeof body.suggestedReference === "string" ? body.suggestedReference.trim() : "";
  const type = typeof body.type === "string" ? body.type : "";
  if (!suggestedReference) {
    json(res, 400, { error: "Body requires 'suggestedReference' (non-empty string)." });
    return true;
  }
  if (!(ALLOWED_TYPES as readonly string[]).includes(type)) {
    json(res, 400, { error: `Body requires 'type' in ${ALLOWED_TYPES.join(", ")}.` });
    return true;
  }

  const recordOf = (value: unknown): Record<string, unknown> =>
    value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};

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
    json(res, 201, { id: draft.id, spaceId: draft.spaceId, status: draft.status });
    return true;
  } catch (err) {
    json(res, 500, { error: err instanceof Error ? err.message : "Proposal submission failed." });
    return true;
  }
}
