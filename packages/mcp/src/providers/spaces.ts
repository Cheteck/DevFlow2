/**
 * @mosaix/mcp — Deterministic Spaces tools (persisted, no stubs).
 *
 * Layering rule: `packages/*` never statically imports `@apps/*`.
 * The BAC client is injected (mcp-routes + stdio-server wire it via dynamic
 * import, tests inject fakes). When no client is provided the tools are NOT
 * registered — a missing tool is honest, a stubbed one is not.
 *
 * Used by the Jijel scraping import: `spaces_space_create` (unit) +
 * `spaces_space_bulk_import` (batch, dedup by slug) delegate to
 * `SpaceService.createSpaceFromTemplate` so domain invariants
 * (template registry, slug, team owner, capabilities) stay enforced by the BAC.
 */

import type { MCPToolRegistry } from "../tool-registry.js";
import type { MCPResourceRegistry } from "../resource-registry.js";
import type { MCPPromptRegistry } from "../prompt-registry.js";

export interface SpaceSummary {
  id: string;
  name: string;
  slug: string;
  category: string;
  template: string;
  tenantId: string;
  followersCount: number;
  metadata?: Record<string, unknown>;
}

export interface SpacesSearchParams {
  query?: string;
  tenantId?: string;
  template?: string;
  limit?: number;
  offset?: number;
}

export interface SpacesCreateInput {
  name: string;
  template?: string;
  ownerId?: string;
  tenantId?: string;
  customDomain?: string;
  subscriptionPlan?: "free" | "pro" | "enterprise";
  address?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  ratingsCount?: number;
  sourceUrl?: string;
  wilaya?: string;
  businessCategory?: string;
}

export interface SpacesBulkImportInput {
  tenantId?: string;
  ownerId?: string;
  spaces: SpacesCreateInput[];
}

/** Structural seam over the Spaces BAC (no static `@apps/spaces` import). */
export interface SpacesServiceLike {
  createSpaceFromTemplate(
    name: string,
    template: string,
    ownerId: string,
    tenantId: string,
    customDomain?: string,
    subscriptionPlan?: "free" | "pro" | "enterprise",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: any,
  ): Promise<SpaceFull>;
  listSpacesAsync(tenantId?: string): Promise<SpaceFull[]>;
  getSpaceAsync(id: string): Promise<SpaceFull | undefined>;
}

/** Shape of the dynamically imported `@apps/spaces` module. */
export interface SpacesModuleLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SpaceService: new (...args: any[]) => SpacesServiceLike;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PostgresSpaceRepository?: new (...args: any[]) => unknown;
}

export interface SpaceFull {
  id: string;
  name: string;
  slug: string;
  category: string;
  template: string;
  ownerId: string;
  tenantId: string;
  subscriptionPlan?: string;
  followersCount: number;
  customDomain?: string;
  team?: unknown[];
  enabledCapabilities?: string[];
  publicNavigation?: string[];
  metadata?: Record<string, unknown>;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SpacesBACClient {
  createSpace(input: SpacesCreateInput): Promise<SpaceSummary>;
  readSpace(idOrSlug: string): Promise<SpaceSummary | undefined>;
  searchSpaces(params: SpacesSearchParams): Promise<SpaceSummary[]>;
  bulkImport(input: SpacesBulkImportInput): Promise<{ created: SpaceSummary[]; skipped: string[] }>;
}

function toSummary(space: SpaceFull): SpaceSummary {
  return {
    id: space.id,
    name: space.name,
    slug: space.slug,
    category: space.category,
    template: space.template,
    tenantId: space.tenantId,
    followersCount: space.followersCount ?? 0,
    ...(space.metadata ? { metadata: space.metadata } : {}),
  };
}

const VALID_TEMPLATES = new Set([
  "business",
  "store",
  "creator",
  "education",
  "organization",
  "project",
  "community",
  "custom",
]);

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildMetadata(input: SpacesCreateInput): Record<string, unknown> | undefined {
  const metadata: Record<string, unknown> = {};
  if (input.address?.trim()) metadata["address"] = input.address.trim();
  if (input.phone?.trim()) metadata["phone"] = input.phone.trim();
  if (typeof input.latitude === "number" && Number.isFinite(input.latitude)) metadata["latitude"] = input.latitude;
  if (typeof input.longitude === "number" && Number.isFinite(input.longitude)) metadata["longitude"] = input.longitude;
  if (typeof input.rating === "number" && Number.isFinite(input.rating)) metadata["rating"] = input.rating;
  if (typeof input.ratingsCount === "number" && Number.isFinite(input.ratingsCount)) metadata["ratingsCount"] = input.ratingsCount;
  if (input.sourceUrl?.trim()) metadata["sourceUrl"] = input.sourceUrl.trim().slice(0, 2048);
  if (input.wilaya?.trim()) metadata["wilaya"] = input.wilaya.trim();
  else metadata["wilaya"] = "Jijel";
  if (input.businessCategory?.trim()) metadata["businessCategory"] = input.businessCategory.trim();
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function validateCreateInput(input: SpacesCreateInput): {
  name: string;
  template: string;
  ownerId: string;
  tenantId: string;
} {
  const name = (input.name ?? "").trim();
  if (name.length < 2 || name.length > 120) {
    throw new Error("Invalid 'name': 2..120 characters required.");
  }
  const template = (input.template ?? "store").trim();
  if (!VALID_TEMPLATES.has(template)) {
    throw new Error(`Invalid 'template': expected one of ${Array.from(VALID_TEMPLATES).join(", ")}.`);
  }
  const ownerId = (input.ownerId ?? "scraper-jijel").trim() || "scraper-jijel";
  const tenantId = (input.tenantId ?? "jijel-dz").trim() || "jijel-dz";
  if (input.customDomain !== undefined && (typeof input.customDomain !== "string" || input.customDomain.length > 253)) {
    throw new Error("Invalid 'customDomain': 253 characters max.");
  }
  if (
    input.subscriptionPlan !== undefined &&
    input.subscriptionPlan !== "free" &&
    input.subscriptionPlan !== "pro" &&
    input.subscriptionPlan !== "enterprise"
  ) {
    throw new Error("Invalid 'subscriptionPlan': expected free, pro or enterprise.");
  }
  if (input.latitude !== undefined && (typeof input.latitude !== "number" || input.latitude < -90 || input.latitude > 90)) {
    throw new Error("Invalid 'latitude': expected -90..90.");
  }
  if (input.longitude !== undefined && (typeof input.longitude !== "number" || input.longitude < -180 || input.longitude > 180)) {
    throw new Error("Invalid 'longitude': expected -180..180.");
  }
  if (input.rating !== undefined && (typeof input.rating !== "number" || input.rating < 0 || input.rating > 5)) {
    throw new Error("Invalid 'rating': expected 0..5.");
  }
  return { name, template, ownerId, tenantId };
}

/**
 * Builds a `SpacesBACClient` over any service with the `SpacesServiceLike`
 * surface. Single construction site shared by the stdio + HTTP transports so
 * the two wirings cannot drift apart.
 */
export function createSpacesBACClient(service: SpacesServiceLike): SpacesBACClient {
  const createSpace = async (input: SpacesCreateInput): Promise<SpaceSummary> => {
    const { name, template, ownerId, tenantId } = validateCreateInput(input);
    const metadata = buildMetadata(input);
    const created = await service.createSpaceFromTemplate(
      name,
      template,
      ownerId,
      tenantId,
      input.customDomain?.trim() || undefined,
      input.subscriptionPlan ?? "free",
      metadata,
    );
    return toSummary(created);
  };

  return {
    createSpace,
    readSpace: async (idOrSlug) => {
      if (typeof idOrSlug !== "string" || idOrSlug.length === 0) return undefined;
      const direct = await service.getSpaceAsync(idOrSlug);
      if (direct) return toSummary(direct);
      const list = await service.listSpacesAsync();
      const found = list.find((s) => s.slug === idOrSlug || s.name === idOrSlug);
      return found ? toSummary(found) : undefined;
    },
    searchSpaces: async (params) => {
      const list = await service.listSpacesAsync(params.tenantId);
      const query = (params.query ?? "").trim().toLowerCase();
      let filtered = list;
      if (query) {
        filtered = filtered.filter(
          (s) =>
            s.name.toLowerCase().includes(query) ||
            s.slug.includes(slugify(query)) ||
            JSON.stringify(s.metadata ?? {}).toLowerCase().includes(query),
        );
      }
      if (params.template) {
        filtered = filtered.filter((s) => s.template === params.template);
      }
      const offset = Math.max(params.offset ?? 0, 0);
      const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
      return filtered.slice(offset, offset + limit).map(toSummary);
    },
    bulkImport: async (input) => {
      const items = Array.isArray(input.spaces) ? input.spaces : [];
      if (items.length === 0) throw new Error("Invalid 'spaces': at least 1 entry required.");
      if (items.length > 50) throw new Error("Invalid 'spaces': 50 max per batch.");
      const existing = await service.listSpacesAsync(input.tenantId ?? "jijel-dz");
      const existingSlugs = new Set(existing.map((s) => s.slug));
      const created: SpaceSummary[] = [];
      const skipped: string[] = [];
      for (const raw of items) {
        const merged: SpacesCreateInput = {
          ...raw,
          tenantId: raw.tenantId ?? input.tenantId ?? "jijel-dz",
          ownerId: raw.ownerId ?? input.ownerId ?? "scraper-jijel",
          template: raw.template ?? "store",
        };
        try {
          const { name } = validateCreateInput(merged);
          const slug = slugify(name);
          if (existingSlugs.has(slug)) {
            skipped.push(name);
            continue;
          }
          const summary = await createSpace(merged);
          existingSlugs.add(summary.slug);
          created.push(summary);
        } catch {
          skipped.push((raw.name ?? "?").trim() || "?");
        }
      }
      return { created, skipped };
    },
  };
}

const CREATE_PERMISSION = "spaces:space:create";
const READ_PERMISSION = "spaces:space:read";

export function registerSpacesTools(tools: MCPToolRegistry, client?: SpacesBACClient): void {
  if (!client) return;

  tools.registerTool({
    name: "spaces_space_create",
    description: "Create a real Spaces business/store Space (persisted via SpaceService + Postgres). Use for directory imports (e.g. Jijel phone shops).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        template: { type: "string" },
        ownerId: { type: "string" },
        tenantId: { type: "string" },
        customDomain: { type: "string" },
        subscriptionPlan: { type: "string", enum: ["free", "pro", "enterprise"] },
        address: { type: "string" },
        phone: { type: "string" },
        latitude: { type: "number" },
        longitude: { type: "number" },
        rating: { type: "number" },
        ratingsCount: { type: "number" },
        sourceUrl: { type: "string" },
        wilaya: { type: "string" },
        businessCategory: { type: "string" },
      },
      required: ["name"],
    },
    requiredPermission: CREATE_PERMISSION,
    ownerApp: "@apps/spaces",
    handler: async (input: unknown) => client.createSpace((input ?? {}) as SpacesCreateInput),
  });

  tools.registerTool({
    name: "spaces_space_read",
    description: "Read a single Spaces Space by id or slug (persisted).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    requiredPermission: READ_PERMISSION,
    ownerApp: "@apps/spaces",
    handler: async (input: unknown) => {
      const id = (input as { id?: unknown } | null)?.id;
      if (typeof id !== "string" || id.length === 0) {
        throw new Error("Missing required 'id' (space id or slug).");
      }
      const found = await client.readSpace(id);
      if (!found) throw new Error(`Space [${id}] not found.`);
      return found;
    },
  });

  tools.registerTool({
    name: "spaces_space_search",
    description: "Search real Spaces Spaces (persisted directory, e.g. tenant jijel-dz).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        tenantId: { type: "string" },
        template: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
    },
    requiredPermission: READ_PERMISSION,
    ownerApp: "@apps/spaces",
    handler: async (input: unknown) => {
      const params = (input ?? {}) as SpacesSearchParams;
      const results = await client.searchSpaces({
        query: typeof params.query === "string" ? params.query : undefined,
        tenantId: typeof params.tenantId === "string" ? params.tenantId : undefined,
        template: typeof params.template === "string" ? params.template : undefined,
        limit: typeof params.limit === "number" ? params.limit : 20,
        offset: typeof params.offset === "number" ? params.offset : 0,
      });
      return { results, count: results.length };
    },
  });

  tools.registerTool({
    name: "spaces_space_bulk_import",
    description: "Bulk-import up to 50 Spaces (directory scraping). Deduplicates by slug, returns created + skipped.",
    inputSchema: {
      type: "object",
      properties: {
        tenantId: { type: "string" },
        ownerId: { type: "string" },
        spaces: { type: "array", items: { type: "object" } },
      },
      required: ["spaces"],
    },
    requiredPermission: CREATE_PERMISSION,
    ownerApp: "@apps/spaces",
    handler: async (input: unknown) => {
      const payload = (input ?? {}) as SpacesBulkImportInput;
      const result = await client.bulkImport(payload);
      return { ...result, createdCount: result.created.length, skippedCount: result.skipped.length };
    },
  });
}

/** Collection resource `spaces://directory` (exact-URI registry). */
export function registerSpacesResources(resources: MCPResourceRegistry, client?: SpacesBACClient): void {
  if (!client) return;
  resources.registerResource({
    uri: "spaces://directory",
    name: "Spaces directory collection",
    description: "Business/store Spaces directory (persisted).",
    mimeType: "application/json",
    requiredPermission: READ_PERMISSION,
    resolver: async () => {
      const results = await client.searchSpaces({ limit: 50 });
      return { results, count: results.length };
    },
  });
}

/** Prompt guiding agents through a shop import brief. */
export function registerSpacesPrompts(prompts: MCPPromptRegistry): void {
  prompts.registerPrompt({
    name: "spaces_shop_import_brief",
    description: "Brief for importing a real local shop (e.g. Jijel phone store) as a Spaces store Space.",
    arguments: [
      { name: "shopName", description: "Shop display name", required: true },
      { name: "address", description: "Street address", required: false },
    ],
    handler: async (args) => [
      {
        role: "user",
        content: {
          type: "text",
          text: [
            `Import shop ${args["shopName"] ?? "?"} (${args["address"] ?? "address unknown"}) as a Spaces store Space:`,
            "1. template=store, tenantId=jijel-dz, ownerId=scraper-jijel.",
            "2. Preserve address/phone/geo/rating/sourceUrl in metadata.",
            "3. Never invent phones or coordinates — omit when unknown.",
            "4. Bulk path stays under 50 entries per call, dedup by slug.",
          ].join("\n"),
        },
      },
    ],
  });
}
