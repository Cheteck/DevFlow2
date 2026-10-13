/**
 * @mosaix/mcp — Deterministic Commerce tools (offer vitrine + publishing).
 *
 * Layering rule: `packages/*` never statically imports `@apps/*`.
 * The BAC client is injected (mcp-routes + stdio-server wire it via dynamic
 * import, tests inject fakes). When no client is provided the tools are NOT
 * registered — a missing tool is honest, a stubbed one is not.
 *
 * Writes delegate to `CommerceOfferService.createOffer` so domain invariants
 * (seller ref, vendable ref, non-negative price, Money) stay enforced by the
 * BAC. The transport only validates shape, never business rules.
 */

import type { MCPToolRegistry } from "../tool-registry.js";
import type { MCPResourceRegistry } from "../resource-registry.js";
import type { MCPPromptRegistry } from "../prompt-registry.js";

export interface CommerceOfferSummary {
  id: string;
  title: string;
  description?: string;
  priceInCents: number;
  currency: string;
  status: string;
  stockAllocation?: number;
  sellerType: string;
  sellerId: string;
  sellerName?: string;
  vendableId: string;
}

export interface CommerceOfferListParams {
  sellerType?: string;
  sellerId?: string;
  vendableId?: string;
  limit?: number;
}

export interface CommerceOfferCreateInput {
  sellerType?: string;
  sellerId?: string;
  sellerName?: string;
  vendableId?: string;
  title?: string;
  description?: string;
  priceInCents?: number;
  currency?: string;
  stockAllocation?: number;
  commissionRateBps?: number;
  status?: string;
}

/** Structural seam over the Commerce BAC (no static `@apps/commerce` import). */
export interface CommerceOfferFull {
  id: string;
  title: string;
  description?: string;
  priceInCents: number;
  currency: string;
  status: string;
  stockAllocation?: number;
  commissionRateBps?: number;
  seller: { type: string; id: string; name?: string };
  vendableId: string;
}

/** Minimal structural surface of `CommerceOfferService` required by the MCP BAC client. */
export interface CommerceOfferServiceLike {
  createOffer(input: Record<string, unknown>): Promise<CommerceOfferFull>;
  listAllActive(limit?: number): Promise<CommerceOfferFull[]>;
  listOffersBySeller(sellerType: string, sellerId: string): Promise<CommerceOfferFull[]>;
  listActiveOffersForVendable(vendableId: string): Promise<CommerceOfferFull[]>;
}

/** Shape of the dynamically imported `@apps/commerce` module. */
export interface CommerceModuleLike {
  CommerceOfferService: new (...args: unknown[]) => CommerceOfferServiceLike;
  InMemoryCommerceOfferRepository?: new (...args: unknown[]) => unknown;
  /** Present since the BAC exposes its Postgres adapter; preferred when a PG DatabasePort is available. */
  PostgresCommerceOfferRepository?: new (...args: unknown[]) => unknown;
}

/** Shape of the dynamically imported `@apps/portfolio` module (vendable refs). */
export interface CommercePortfolioModuleLike {
  PortfolioService: new (...args: unknown[]) => {
    findVendable(id: string): Promise<{ identity: { id: string } } | undefined>;
    search(criteria: Record<string, unknown>): Promise<Array<{ identity: { id: string; reference: string } }>>;
  };
  InMemoryVendableRepository?: new (...args: unknown[]) => unknown;
}

export interface CommerceBACClient {
  listOffers(params: CommerceOfferListParams): Promise<CommerceOfferSummary[]>;
  createOffer(input: CommerceOfferCreateInput): Promise<CommerceOfferSummary>;
}

function toSummary(offer: CommerceOfferFull): CommerceOfferSummary {
  return {
    id: offer.id,
    title: offer.title,
    ...(offer.description ? { description: offer.description } : {}),
    priceInCents: offer.priceInCents,
    currency: offer.currency,
    status: offer.status,
    ...(offer.stockAllocation !== undefined ? { stockAllocation: offer.stockAllocation } : {}),
    sellerType: offer.seller.type,
    sellerId: offer.seller.id,
    ...(offer.seller.name ? { sellerName: offer.seller.name } : {}),
    vendableId: offer.vendableId,
  };
}

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

function asNonEmptyString(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    throw new Error(`Invalid '${field}': 1..${max} characters required.`);
  }
  return value.trim();
}

function asOptionalString(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || value.length > max) {
    throw new Error(`Invalid '${field}': string of ${max} characters max.`);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asMoneyCents(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100_000_000_00) {
    throw new Error("Invalid 'priceInCents': positive integer cents required.");
  }
  return value;
}

/**
 * Builds a `CommerceBACClient` over any service with the
 * `CommerceOfferServiceLike` surface. Single construction site shared by the
 * stdio + HTTP transports so the two wirings cannot drift apart.
 */
export function createCommerceBACClient(service: CommerceOfferServiceLike): CommerceBACClient {
  return {
    listOffers: async (params) => {
      const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
      if (params.sellerId) {
        const offers = await service.listOffersBySeller(params.sellerType ?? "space", params.sellerId);
        return offers.slice(0, limit).map(toSummary);
      }
      if (params.vendableId) {
        const offers = await service.listActiveOffersForVendable(params.vendableId);
        return offers.slice(0, limit).map(toSummary);
      }
      const offers = await service.listAllActive(limit);
      return offers.map(toSummary);
    },
    createOffer: async (input) => {
      const sellerId = asNonEmptyString(input.sellerId, "sellerId", 128);
      const vendableId = asNonEmptyString(input.vendableId, "vendableId", 128);
      const title = asNonEmptyString(input.title, "title", 200);
      const priceInCents = asMoneyCents(input.priceInCents);
      const currency = (input.currency ?? "DZD").trim().toUpperCase();
      if (!CURRENCY_PATTERN.test(currency)) {
        throw new Error("Invalid 'currency': ISO 4217 code required (e.g. DZD, EUR).");
      }
      const description = asOptionalString(input.description, "description", 2000);
      const sellerName = asOptionalString(input.sellerName, "sellerName", 200);
      const sellerType = asOptionalString(input.sellerType, "sellerType", 32) ?? "space";
      let stockAllocation: number | undefined;
      if (input.stockAllocation !== undefined) {
        if (!Number.isInteger(input.stockAllocation) || (input.stockAllocation as number) < 0) {
          throw new Error("Invalid 'stockAllocation': positive integer or omitted (unlimited).");
        }
        stockAllocation = input.stockAllocation;
      }
      let commissionRateBps = 500;
      if (input.commissionRateBps !== undefined) {
        if (!Number.isInteger(input.commissionRateBps) || (input.commissionRateBps as number) < 0 || (input.commissionRateBps as number) > 10000) {
          throw new Error("Invalid 'commissionRateBps': 0..10000.");
        }
        commissionRateBps = input.commissionRateBps;
      }
      const status = (input.status ?? "ACTIVE").trim().toUpperCase();
      if (status !== "ACTIVE" && status !== "DRAFT") {
        throw new Error("Invalid 'status': ACTIVE or DRAFT (PAUSED/ARCHIVED via lifecycle, never at creation).");
      }
      const created = await service.createOffer({
        seller: { type: sellerType, id: sellerId, ...(sellerName ? { name: sellerName } : {}) },
        vendableId,
        title,
        ...(description ? { description } : {}),
        priceInCents,
        currency,
        ...(stockAllocation !== undefined ? { stockAllocation } : {}),
        commissionRateBps,
        initialStatus: status as "ACTIVE" | "DRAFT",
      });
      return toSummary(created);
    },
  };
}

const READ_PERMISSION = "commerce:offer:read:tenant";
const PUBLISH_PERMISSION = "commerce:offer:publish:tenant";

export function registerCommerceTools(tools: MCPToolRegistry, client?: CommerceBACClient): void {
  if (!client) return;

  tools.registerTool({
    name: "commerce_offer_list",
    description: "List real Commerce offers (public vitrine or per-seller / per-vendable).",
    inputSchema: {
      type: "object",
      properties: {
        sellerType: { type: "string" },
        sellerId: { type: "string" },
        vendableId: { type: "string" },
        limit: { type: "number" },
      },
    },
    requiredPermission: READ_PERMISSION,
    ownerApp: "@apps/commerce",
    handler: async (input: unknown) => {
      const params = (input ?? {}) as CommerceOfferListParams;
      const results = await client.listOffers({
        sellerType: typeof params.sellerType === "string" ? params.sellerType : undefined,
        sellerId: typeof params.sellerId === "string" ? params.sellerId : undefined,
        vendableId: typeof params.vendableId === "string" ? params.vendableId : undefined,
        limit: typeof params.limit === "number" ? params.limit : 20,
      });
      return { results, count: results.length };
    },
  });

  tools.registerTool({
    name: "commerce_offer_create",
    description:
      "Publish a real Commerce offer for a Space seller (persisted via CommerceOfferService + Postgres). Prices in integer cents + ISO currency (DZD default).",
    inputSchema: {
      type: "object",
      properties: {
        sellerType: { type: "string" },
        sellerId: { type: "string" },
        sellerName: { type: "string" },
        vendableId: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        priceInCents: { type: "number" },
        currency: { type: "string" },
        stockAllocation: { type: "number" },
        commissionRateBps: { type: "number" },
        status: { type: "string", enum: ["ACTIVE", "DRAFT"] },
      },
      required: ["sellerId", "vendableId", "title", "priceInCents"],
    },
    requiredPermission: PUBLISH_PERMISSION,
    ownerApp: "@apps/commerce",
    handler: async (input: unknown) => client.createOffer((input ?? {}) as CommerceOfferCreateInput),
  });
}

/** Collection resource `commerce://offers` (exact-URI registry). */
export function registerCommerceResources(resources: MCPResourceRegistry, client?: CommerceBACClient): void {
  if (!client) return;
  resources.registerResource({
    uri: "commerce://offers",
    name: "Commerce offers collection",
    description: "Published marketplace offers (ACTIVE first).",
    mimeType: "application/json",
    requiredPermission: READ_PERMISSION,
    resolver: async () => {
      const results = await client.listOffers({ limit: 50 });
      return { results, count: results.length };
    },
  });
}

/** Prompt guiding agents through a marketplace offer brief. */
export function registerCommercePrompts(prompts: MCPPromptRegistry): void {
  prompts.registerPrompt({
    name: "commerce_offer_publish_brief",
    description: "Brief for publishing a Space offer on the marketplace vitrine.",
    arguments: [
      { name: "sellerName", description: "Space seller display name", required: true },
      { name: "title", description: "Offer title", required: true },
    ],
    handler: async (args) => [
      {
        role: "user",
        content: {
          type: "text",
          text: [
            `Publish offer ${args["title"] ?? "?"} for ${args["sellerName"] ?? "?"}:`,
            "1. sellerType=space + real sellerId (Space must exist — create it first via spaces tools).",
            "2. vendableId must reference a real Portfolio vendable.",
            "3. priceInCents integer + ISO currency (DZD default for Algeria).",
            "4. ACTIVE only when the Space confirmed; DRAFT otherwise.",
            "Never invent sellers, vendables or prices.",
          ].join("\n"),
        },
      },
    ],
  });
}
