/**
 * @mosaix/mcp — Deterministic Portfolio tools (MCP-01).
 *
 * Layering rule: `packages/*` never statically imports `@apps/*`.
 * The BAC client is injected (stdio-server wires it via dynamic import,
 * tests inject fakes). When no client is provided the tools are NOT
 * registered — a missing tool is honest, a stubbed one is not.
 */

import type { MCPToolRegistry } from "../tool-registry.js";
import type { MCPResourceRegistry } from "../resource-registry.js";
import type { MCPPromptRegistry } from "../prompt-registry.js";
import { randomUUID } from "node:crypto";

export interface PortfolioVendableSummary {
  id: string;
  reference: string;
  type: string;
  status: string;
  name?: string;
}

export interface PortfolioSearchParams {
  query?: string;
  category?: string;
  tag?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

/** Structural seam over the Portfolio BAC (no static `@apps/portfolio` import). */
export interface PortfolioProposeVariantInput {
  name: string;
  sku: string;
  attributes?: Record<string, string> | undefined;
}

export interface PortfolioProposeInput {
  reference: string;
  name: string;
  type?: string | undefined;
  description?: string | undefined;
  category?: string | undefined;
  tags?: string[] | undefined;
  brand?: string | undefined;
  language?: string | undefined;
  attributes?: Record<string, unknown> | undefined;
  specifications?: Record<string, unknown> | undefined;
  mediaUrls?: string[] | undefined;
  variants?: PortfolioProposeVariantInput[] | undefined;
  sourceUrl?: string | undefined;
}

/** Structural Draft passed to the BAC — mirrors `Vendable` without importing it. */
export interface PortfolioProposeDraft {
  identity: { id: string; reference: string; type: string; status: string };
  content: Record<
    string,
    { name: string; shortDescription?: string; description?: string }
  >;
  characteristics: {
    attributes: Record<string, unknown>;
    specifications?: Record<string, unknown> | undefined;
  };
  classification: {
    categories: string[];
    tags: string[];
    collections: string[];
  };
  media: Array<{
    id: string;
    type: string;
    url: string;
    metadata?: Record<string, unknown>;
  }>;
  variants: Array<{
    id: string;
    reference: string;
    content?: Record<string, { name: string }> | undefined;
    characteristics?: { attributes: Record<string, unknown> } | undefined;
  }>;
  relations: [];
  seo?: { slug: string } | undefined;
}

export interface PortfolioBACClient {
  searchVendables(
    params: PortfolioSearchParams,
  ): Promise<PortfolioVendableSummary[]>;
  readVendable(
    idOrReference: string,
  ): Promise<PortfolioVendableSummary | undefined>;
  /**
   * Optional write seam. Read-only clients omit it — the propose tool is then
   * not registered (honest absence, never a stub). When present it must
   * delegate to `PortfolioService.createVendable` so domain invariants
   * (duplicate reference, operational keys, workflow) stay enforced by the BAC.
   */
  proposeVendable?: (
    draft: PortfolioProposeDraft,
  ) => Promise<PortfolioVendableSummary>;
  /**
   * Optional options seam. Same honesty rule: only registered when present,
   * delegating to `PortfolioService.setProductOptions` (validation + workflow
   * guard enforced by the BAC, never by the transport).
   */
  setProductOptions?: (
    vendableId: string,
    groups: unknown,
  ) => Promise<PortfolioVendableSummary>;
}

/** Full structural fiche surface consumed by the MCP wiring (never a static `@apps/*` import). */
export interface PortfolioVendableFull {
  identity: { id: string; reference: string; type: string; status: string };
  content: Record<string, { name?: string }>;
}

/** Minimal structural surface of `PortfolioService` required by the MCP BAC client. */
export interface PortfolioServiceLike {
  search(criteria: Record<string, unknown>): Promise<PortfolioVendableFull[]>;
  findVendable(id: string): Promise<PortfolioVendableFull | undefined>;
  createVendable(
    draft: Record<string, unknown>,
  ): Promise<PortfolioVendableFull>;
  setProductOptions(
    vendableId: string,
    groups: unknown,
  ): Promise<PortfolioVendableFull>;
}

/** Shape of the dynamically imported `@apps/portfolio` module. */
export interface PortfolioModuleLike {
  PortfolioService: new (repository: unknown) => PortfolioServiceLike;
  InMemoryVendableRepository: new () => unknown;
  /** Present since the BAC exposes its Postgres adapter; preferred when a PG DatabasePort is available. */
  PostgresVendableRepository?: new (databasePort: unknown) => unknown;
}

function toSummary(vendable: PortfolioVendableFull): PortfolioVendableSummary {
  return {
    id: vendable.identity.id,
    reference: vendable.identity.reference,
    type: vendable.identity.type,
    status: vendable.identity.status,
    name: Object.values(vendable.content)[0]?.name,
  };
}

/**
 * Builds a `PortfolioBACClient` over any service with the `PortfolioServiceLike`
 * surface. Single construction site shared by the stdio + HTTP transports so
 * the two wirings cannot drift apart.
 */
export function createPortfolioBACClient(
  service: PortfolioServiceLike,
): PortfolioBACClient {
  return {
    searchVendables: async (params) => {
      const hits = await service.search({ ...params });
      return hits.map(toSummary);
    },
    readVendable: async (idOrReference) => {
      const found =
        (await service.findVendable(idOrReference)) ??
        (await service.search({})).find(
          (vendable) => vendable.identity.reference === idOrReference,
        );
      if (!found) return undefined;
      return toSummary(found);
    },
    proposeVendable: async (draft) =>
      toSummary(
        await service.createVendable(
          draft as unknown as Record<string, unknown>,
        ),
      ),
    setProductOptions: async (vendableIdOrReference, groups) => {
      const found =
        (await service.findVendable(vendableIdOrReference)) ??
        (await service.search({})).find(
          (vendable) => vendable.identity.reference === vendableIdOrReference,
        );
      if (!found) {
        throw new Error(`Vendable [${vendableIdOrReference}] not found.`);
      }
      return toSummary(
        await service.setProductOptions(found.identity.id, groups),
      );
    },
  };
}

const READ_PERMISSION = "portfolio:vendable:read:tenant";
const CREATE_PERMISSION = "portfolio:vendable:create:tenant";

const TYPE_ALIASES: Record<string, string> = {
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

const REFERENCE_PATTERN = /^[A-Za-z0-9-_]+$/;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function buildProposeDraft(
  input: PortfolioProposeInput,
): PortfolioProposeDraft {
  const reference = (input.reference ?? "").trim();
  if (!REFERENCE_PATTERN.test(reference)) {
    throw new Error(
      "Invalid 'reference': letters, digits, dashes and underscores only.",
    );
  }
  const name = (input.name ?? "").trim();
  if (name.length < 2) {
    throw new Error("Invalid 'name': at least 2 characters required.");
  }
  const rawType = (input.type ?? "Product").trim();
  const type =
    TYPE_ALIASES[rawType] ?? TYPE_ALIASES[rawType.toLowerCase()] ?? "";
  if (!type) {
    throw new Error(
      "Invalid 'type': expected Product, Service, DigitalProduct or Experience.",
    );
  }
  const language = (input.language ?? "fr").trim().toLowerCase() || "fr";
  if (language.length > 8) {
    throw new Error(
      "Invalid 'language': expected a short locale code (e.g. fr, en, ar).",
    );
  }
  const description = (input.description ?? "").trim();
  if (description.length > 5000) {
    throw new Error(
      "Invalid 'description': 5000 characters max (Draft can stay short).",
    );
  }
  const tags = Array.isArray(input.tags) ? input.tags : [];
  if (tags.length > 20) {
    throw new Error("Invalid 'tags': 20 max.");
  }
  for (const tag of tags) {
    if (
      typeof tag !== "string" ||
      tag.trim().length === 0 ||
      tag.trim().length > 64
    ) {
      throw new Error("Invalid 'tags': each tag must be 1..64 characters.");
    }
  }
  const attributes = asRecord(input.attributes);
  const specifications = asRecord(input.specifications);
  if (
    Object.keys(attributes).length > 50 ||
    Object.keys(specifications).length > 50
  ) {
    throw new Error("Invalid attributes/specifications: 50 keys max each.");
  }
  const mediaUrls = Array.isArray(input.mediaUrls) ? input.mediaUrls : [];
  if (mediaUrls.length > 10) {
    throw new Error("Invalid 'mediaUrls': 10 max.");
  }
  for (const url of mediaUrls) {
    if (
      typeof url !== "string" ||
      url.length > 2048 ||
      !/^https?:\/\//.test(url)
    ) {
      throw new Error(
        "Invalid 'mediaUrls': each entry must be an http(s) URL.",
      );
    }
  }
  const variants = Array.isArray(input.variants) ? input.variants : [];
  if (variants.length > 20) {
    throw new Error("Invalid 'variants': 20 max.");
  }
  const seenSkus = new Set<string>();
  for (const variant of variants) {
    if (
      !variant ||
      typeof variant.name !== "string" ||
      variant.name.trim().length === 0
    ) {
      throw new Error("Invalid variant: each variant needs a name.");
    }
    if (
      typeof variant.sku !== "string" ||
      !REFERENCE_PATTERN.test(variant.sku)
    ) {
      throw new Error(
        `Invalid variant sku [${String(variant.sku)}]: letters, digits, dashes and underscores only.`,
      );
    }
    if (seenSkus.has(variant.sku)) {
      throw new Error(`Duplicate variant sku [${variant.sku}].`);
    }
    seenSkus.add(variant.sku);
  }

  // IDs are server-generated (agent must not choose them). `randomUUID` is
  // available in all supported Node runtimes; fallback stays unique per process.
  const randomSuffix = (): string => {
    try {
      return randomUUID();
    } catch {
      return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
  };

  const id = `vend_${randomSuffix()}`;
  const category = (input.category ?? "").trim();
  const brand = (input.brand ?? "").trim();
  const sourceUrl = (input.sourceUrl ?? "").trim();
  if (
    sourceUrl &&
    (!/^https?:\/\//.test(sourceUrl) || sourceUrl.length > 2048)
  ) {
    throw new Error("Invalid 'sourceUrl': must be an http(s) URL.");
  }

  return {
    identity: { id, reference, type, status: "Draft" },
    content: {
      [language]: {
        name,
        ...(description
          ? { shortDescription: description.slice(0, 160), description }
          : {}),
      },
    },
    characteristics: {
      attributes: {
        ...attributes,
        ...(brand ? { brand } : {}),
        ...(sourceUrl
          ? {
              source_url: sourceUrl,
              source_fetched_at: new Date().toISOString(),
            }
          : {}),
      },
      ...(Object.keys(specifications).length > 0 ? { specifications } : {}),
    },
    classification: {
      categories: category ? [category] : [],
      tags: tags.map((tag) => tag.trim()),
      collections: [],
    },
    media: mediaUrls.map((url, index) => ({
      id: `media_${randomSuffix()}`,
      type: "image",
      url,
      metadata: {
        role: index === 0 ? "primary" : "gallery",
        positionIndex: index,
      },
    })),
    variants: variants.map((variant) => ({
      id: `var_${randomSuffix()}`,
      reference: variant.sku,
      content: { [language]: { name: variant.name.trim() } },
      characteristics: { attributes: { ...(variant.attributes ?? {}) } },
    })),
    relations: [],
    seo: {
      slug: slugify(`${reference} ${name}`.slice(0, 80)) || slugify(reference),
    },
  };
}

export function registerPortfolioTools(
  tools: MCPToolRegistry,
  client?: PortfolioBACClient,
): void {
  if (!client) return;

  tools.registerTool({
    name: "portfolio_vendable_search",
    description: "Search real Portfolio vendables (PIM fiches, no prices).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        category: { type: "string" },
        tag: { type: "string" },
        status: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
    },
    requiredPermission: READ_PERMISSION,
    ownerApp: "@apps/portfolio",
    handler: async (input: unknown) => {
      const params = (input ?? {}) as PortfolioSearchParams;
      const results = await client.searchVendables({
        query: typeof params.query === "string" ? params.query : undefined,
        category:
          typeof params.category === "string" ? params.category : undefined,
        tag: typeof params.tag === "string" ? params.tag : undefined,
        status: typeof params.status === "string" ? params.status : undefined,
        limit: typeof params.limit === "number" ? params.limit : 20,
        offset: typeof params.offset === "number" ? params.offset : 0,
      });
      return { results, count: results.length };
    },
  });

  tools.registerTool({
    name: "portfolio_vendable_read",
    description: "Read a single Portfolio vendable by id or reference.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    requiredPermission: READ_PERMISSION,
    ownerApp: "@apps/portfolio",
    handler: async (input: unknown) => {
      const id = (input as { id?: unknown } | null)?.id;
      if (typeof id !== "string" || id.length === 0) {
        throw new Error("Missing required 'id' (vendable id or reference).");
      }
      const found = await client.readVendable(id);
      if (!found) {
        throw new Error(`Vendable [${id}] not found.`);
      }
      return found;
    },
  });

  // Write seam: only registered when the BAC client exposes `proposeVendable`.
  // Draft-only by construction — publication stays on the workflow capability.
  // Commercial fields (price/stock) are not part of the schema at all, and the
  // BAC re-validates operational keys before persisting.
  if (typeof client.proposeVendable === "function") {
    const propose = client.proposeVendable.bind(client);
    tools.registerTool({
      name: "portfolio_vendable_propose",
      description:
        "Propose a new Portfolio vendable as Draft (PIM fiche, descriptive only, no prices/stock). Requires human review before publication.",
      inputSchema: {
        type: "object",
        properties: {
          reference: { type: "string" },
          name: { type: "string" },
          type: {
            type: "string",
            enum: ["Product", "Service", "DigitalProduct", "Experience"],
          },
          description: { type: "string" },
          category: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          brand: { type: "string" },
          language: { type: "string" },
          attributes: { type: "object" },
          specifications: { type: "object" },
          mediaUrls: { type: "array", items: { type: "string" } },
          variants: { type: "array", items: { type: "object" } },
          sourceUrl: { type: "string" },
        },
        required: ["reference", "name"],
      },
      requiredPermission: CREATE_PERMISSION,
      ownerApp: "@apps/portfolio",
      handler: async (input: unknown) => {
        const draft = buildProposeDraft((input ?? {}) as PortfolioProposeInput);
        return propose(draft);
      },
    });
  }

  // Options seam: same optionality rule. Fiche must exist and be editable
  // (Draft/In Review/Validated enforced by the BAC). No commercial scope
  // exists in the manifest, so creation scope covers fiche enrichment.
  if (typeof client.setProductOptions === "function") {
    const setOptions = client.setProductOptions.bind(client);
    tools.registerTool({
      name: "portfolio_vendable_options_set",
      description:
        "Replace a Portfolio vendable's product options (colors, etc.): validated groups + values + incompatibilities, Draft/In Review/Validated only, descriptive only.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          groups: { type: "array", items: { type: "object" } },
        },
        required: ["id", "groups"],
      },
      requiredPermission: CREATE_PERMISSION,
      ownerApp: "@apps/portfolio",
      handler: async (input: unknown) => {
        const args = (input ?? {}) as { id?: unknown; groups?: unknown };
        if (typeof args.id !== "string" || args.id.length === 0) {
          throw new Error("Missing required 'id' (vendable id or reference).");
        }
        if (!Array.isArray(args.groups)) {
          throw new Error("Missing required 'groups' array.");
        }
        return setOptions(args.id, args.groups);
      },
    });
  }
}

/**
 * Collection resource `portfolio://vendables` (exact-URI registry: per-id
 * reads stay on `portfolio_vendable_read`). Permission aligned on MANIFEST.
 */
export function registerPortfolioResources(
  resources: MCPResourceRegistry,
  client?: PortfolioBACClient,
): void {
  if (!client) return;

  resources.registerResource({
    uri: "portfolio://vendables",
    name: "Portfolio vendables collection",
    description: "Published PIM fiches (descriptive only, no prices).",
    mimeType: "application/json",
    requiredPermission: READ_PERMISSION,
    resolver: async () => {
      const results = await client.searchVendables({ limit: 50 });
      return { results, count: results.length };
    },
  });
}

/**
 * Prompt guiding agents through a PIM completeness brief (no commercial data).
 */
export function registerPortfolioPrompts(prompts: MCPPromptRegistry): void {
  prompts.registerPrompt({
    name: "portfolio_listing_quality_brief",
    description:
      "Brief for assessing a Portfolio listing against PIM completeness rules.",
    arguments: [
      { name: "reference", description: "Vendable reference", required: true },
      { name: "title", description: "Listing title", required: true },
    ],
    handler: async (args) => [
      {
        role: "user",
        content: {
          type: "text",
          text: [
            `Assess Portfolio listing ${args["reference"] ?? "?"} (${args["title"] ?? "?"}):`,
            "1. name/description present in fr (fallback en)?",
            "2. categories, tags, media, attributes complete?",
            "3. variants purely descriptive (no price/stock)?",
            "Never invent or request prices, stock or availability.",
          ].join("\n"),
        },
      },
    ],
  });
}
