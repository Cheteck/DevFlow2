import { describe, expect, it } from "vitest";
import { MCPToolRegistry } from "./tool-registry.js";
import {
  createCommerceBACClient,
  registerCommerceTools,
  type CommerceOfferFull,
  type CommerceOfferServiceLike,
} from "./providers/commerce.js";

function makeService(): CommerceOfferServiceLike & { store: Map<string, CommerceOfferFull> } {
  const store = new Map<string, CommerceOfferFull>();
  return {
    store,
    async createOffer(input) {
      const record = input as Record<string, unknown>;
      const seller = record["seller"] as { type: string; id: string; name?: string };
      const offer: CommerceOfferFull = {
        id: `off-test-${store.size + 1}`,
        title: String(record["title"]),
        description: typeof record["description"] === "string" ? record["description"] : undefined,
        priceInCents: Number(record["priceInCents"]),
        currency: String(record["currency"] ?? "DZD"),
        status: String(record["initialStatus"] ?? "ACTIVE"),
        stockAllocation: typeof record["stockAllocation"] === "number" ? record["stockAllocation"] : undefined,
        seller: { type: seller.type, id: seller.id, ...(seller.name ? { name: seller.name } : {}) },
        vendableId: String(record["vendableId"]),
      };
      store.set(offer.id, offer);
      return offer;
    },
    async listAllActive(limit = 48) {
      return Array.from(store.values()).filter((o) => o.status === "ACTIVE").slice(0, limit);
    },
    async listOffersBySeller(sellerType, sellerId) {
      return Array.from(store.values()).filter(
        (o) => o.seller.type === sellerType && o.seller.id === sellerId,
      );
    },
    async listActiveOffersForVendable(vendableId) {
      return Array.from(store.values()).filter(
        (o) => o.vendableId === vendableId && o.status === "ACTIVE",
      );
    },
  };
}

describe("Deterministic Commerce tools (marketplace vitrine)", () => {
  it("registers nothing when the BAC client is not wired", () => {
    const tools = new MCPToolRegistry();
    registerCommerceTools(tools);

    expect(tools.getTool("commerce_offer_create")).toBeUndefined();
    expect(tools.getTool("commerce_offer_list")).toBeUndefined();
  });

  it("creates a space offer with aligned permissions", async () => {
    const tools = new MCPToolRegistry();
    const client = createCommerceBACClient(makeService());
    registerCommerceTools(tools, client);

    const create = tools.getTool("commerce_offer_create");
    expect(create?.requiredPermission).toBe("commerce:offer:publish:tenant");
    const list = tools.getTool("commerce_offer_list");
    expect(list?.requiredPermission).toBe("commerce:offer:read:tenant");

    const out = (await create?.handler({
      sellerType: "space",
      sellerId: "space-1",
      sellerName: "TechStore Jijel",
      vendableId: "vend-1",
      title: "Xiaomi 18 Pro Max 5G",
      description: "Snapdragon 8 Elite, 8500mAh",
      priceInCents: 124900,
      currency: "DZD",
      stockAllocation: 12,
    })) as { id: string; status: string; priceInCents: number };
    expect(out.id).toBeDefined();
    expect(out.status).toBe("ACTIVE");
    expect(out.priceInCents).toBe(124900);

    const listed = (await list?.handler({ sellerId: "space-1" })) as {
      results: Array<{ title: string }>;
      count: number;
    };
    expect(listed.count).toBe(1);
    expect(listed.results[0].title).toBe("Xiaomi 18 Pro Max 5G");
  });

  it("rejects negative prices, bad currency and unknown sellers fields", async () => {
    const tools = new MCPToolRegistry();
    registerCommerceTools(tools, createCommerceBACClient(makeService()));
    const create = tools.getTool("commerce_offer_create");

    await expect(create?.handler({ sellerId: "s", vendableId: "v", title: "T", priceInCents: -5 })).rejects.toThrow(
      "priceInCents",
    );
    await expect(
      create?.handler({ sellerId: "s", vendableId: "v", title: "T", priceInCents: 100, currency: "EUROS" }),
    ).rejects.toThrow("currency");
    await expect(create?.handler({ vendableId: "v", title: "T", priceInCents: 100 })).rejects.toThrow("sellerId");
    await expect(create?.handler({ sellerId: "s", title: "T", priceInCents: 100 })).rejects.toThrow("vendableId");
  });
});
