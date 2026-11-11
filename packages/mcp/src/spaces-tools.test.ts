import { describe, expect, it } from "vitest";
import { MCPToolRegistry } from "./tool-registry.js";
import {
  createSpacesBACClient,
  registerSpacesTools,
  type SpaceFull,
  type SpacesServiceLike,
} from "./providers/spaces.js";

function makeInMemoryService(): SpacesServiceLike {
  const store = new Map<string, SpaceFull>();
  return {
    async createSpaceFromTemplate(name, template, ownerId, tenantId, customDomain, subscriptionPlan, metadata) {
      const slug = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const space: SpaceFull = {
        id: `space-test-${store.size + 1}`,
        name,
        slug,
        category: "business",
        template,
        ownerId,
        tenantId,
        followersCount: 0,
        ...(customDomain ? { customDomain } : {}),
        ...(metadata ? { metadata: metadata as Record<string, unknown> } : {}),
      };
      store.set(space.id, space);
      return space;
    },
    async listSpacesAsync(tenantId) {
      const all = Array.from(store.values());
      return tenantId ? all.filter((s) => s.tenantId === tenantId) : all;
    },
    async getSpaceAsync(id) {
      return store.get(id);
    },
  };
}

describe("Deterministic Spaces tools (Jijel import)", () => {
  it("registers nothing when the BAC client is not wired", () => {
    const tools = new MCPToolRegistry();
    registerSpacesTools(tools);

    expect(tools.getTool("spaces_space_create")).toBeUndefined();
    expect(tools.getTool("spaces_space_search")).toBeUndefined();
    expect(tools.getTool("spaces_space_bulk_import")).toBeUndefined();
  });

  it("creates a phone shop with metadata and aligned permission", async () => {
    const tools = new MCPToolRegistry();
    const client = createSpacesBACClient(makeInMemoryService());
    registerSpacesTools(tools, client);

    const tool = tools.getTool("spaces_space_create");
    expect(tool?.requiredPermission).toBe("spaces:space:create");

    const out = (await tool?.handler({
      name: "Digital Store Jijel",
      template: "store",
      tenantId: "jijel-dz",
      address: "N43, Jijel 18000",
      phone: "+213795949504",
      latitude: 36.814638,
      longitude: 5.771559,
      rating: 4.8,
      businessCategory: "mobile_phone_store",
    })) as { slug: string; metadata?: Record<string, unknown> };
    expect(out.slug).toBe("digital-store-jijel");
    expect(out.metadata?.["phone"]).toBe("+213795949504");
  });

  it("bulk-imports with slug dedup (Jijel scraping)", async () => {
    const tools = new MCPToolRegistry();
    const client = createSpacesBACClient(makeInMemoryService());
    registerSpacesTools(tools, client);

    const bulk = tools.getTool("spaces_space_bulk_import");
    const first = (await bulk?.handler({
      tenantId: "jijel-dz",
      ownerId: "scraper-jijel",
      spaces: [
        { name: "Mobizone", address: "Jijel" },
        { name: "Phone World Jijel", address: "61 Av. Abdelhamid Benbadis" },
      ],
    })) as { createdCount: number; skippedCount: number };
    expect(first.createdCount).toBe(2);

    const second = (await bulk?.handler({
      tenantId: "jijel-dz",
      ownerId: "scraper-jijel",
      spaces: [{ name: "Mobizone", address: "Jijel" }],
    })) as { createdCount: number; skippedCount: number; skipped: string[] };
    expect(second.createdCount).toBe(0);
    expect(second.skipped).toContain("Mobizone");
  });

  it("rejects invalid geo/rating (no invented coordinates)", async () => {
    const tools = new MCPToolRegistry();
    const client = createSpacesBACClient(makeInMemoryService());
    registerSpacesTools(tools, client);

    const tool = tools.getTool("spaces_space_create");
    await expect(tool?.handler({ name: "Shop XX", latitude: 999 })).rejects.toThrow();
    await expect(tool?.handler({ name: "Shop YY", rating: 9 })).rejects.toThrow();
    await expect(tool?.handler({ name: "Shop ZZ" })).resolves.toBeDefined();
  });
});
