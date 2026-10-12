/**
 * Commerce descriptor tests: real service data in, honest states out.
 * No static products — the vitrine shows service offers or an empty state.
 */

import { describe, it, expect } from "vitest";
import { createCommerceDescriptor } from "./commerce-view";
import { CommerceOfferService } from "../domain/commerce-offer.model.js";
import { OrderService } from "../domain/order.service.js";
import { DemoPaymentPort, DemoInventoryPort } from "../workflows/checkout-order.workflow.js";
import { InMemoryOrderRepository } from "../infrastructure/postgres-order-repository.js";

function ctx(query: Record<string, string | string[]>, roles: string[] = ["member"], userId = "user-1") {
  return {
    tenantId: "default",
    spaceId: null,
    user: { id: userId, roles, permissions: [] },
    theme: { mode: "dark" },
    request: { path: "/commerce", query, headers: {} },
  } as never;
}

describe("createCommerceDescriptor", () => {
  it("renders service offers with real titles and prices", async () => {
    const offers = new CommerceOfferService();
    await offers.createOffer({
      seller: { type: "space", id: "space-1", name: "Atelier" },
      vendableId: "vend-1",
      title: "Vrai Produit",
      description: "Vraie description",
      priceInCents: 9999,
      currency: "EUR",
      stockAllocation: 3,
    });
    const descriptor = createCommerceDescriptor({ offerService: offers });
    const result = await descriptor.render!(ctx({}));
    expect(result.contentHtml).toContain("Vrai Produit");
    expect(result.contentHtml).toContain("99.99 EUR");
    expect(result.contentHtml).not.toContain("Xiaomi");
    expect(result.contentHtml).not.toContain("Ali Express");
    // Marketplace toolbar (client-side filter/sort over loaded offers)…
    expect(result.contentHtml).toContain('id="offer-search"');
    expect(result.contentHtml).toContain('id="offer-sort"');
    expect(result.contentHtml).toContain("offer-card");
    // …and no duplicated shell header nor fake category filter.
    expect(result.contentHtml).not.toContain("Marché Décentralisé");
    expect(result.contentHtml).not.toContain("Toutes les Catégories");
  });

  it("renders an honest empty state without a service", async () => {
    const descriptor = createCommerceDescriptor();
    const result = await descriptor.render!(ctx({}));
    expect(result.contentHtml).toContain("Aucune offre publiée");
    expect(result.contentHtml).not.toContain("Xiaomi 18 Pro Max");
  });

  it("hides cart/orders tabs for guests and prompts login on cart", async () => {
    const descriptor = createCommerceDescriptor();
    const guest = ctx({}, [], "guest");
    const offers = await descriptor.render!(guest);
    expect(offers.contentHtml).not.toContain("view=cart");
    expect(offers.contentHtml).not.toContain("view=orders");
    const cart = await descriptor.render!(ctx({ view: "cart" }, [], "guest"));
    expect(cart.contentHtml).toContain("Connectez-vous");
    expect(cart.pageTitle).toBe("Commerce — Connexion requise");
  });

  it("lists only the viewer's own orders", async () => {
    const orders = new OrderService(
      new InMemoryOrderRepository(),
      new DemoPaymentPort(),
      new DemoInventoryPort(),
    );
    const mine = await orders.createOrder({ userId: "user-1", vendableId: "v1", amount: 100 });
    await orders.createOrder({ userId: "user-2", vendableId: "v2", amount: 200 });
    const descriptor = createCommerceDescriptor({ orderService: orders });
    const result = await descriptor.render!(ctx({ view: "orders" }));
    expect(result.contentHtml).toContain(mine.order.id);
    expect(result.contentHtml).not.toContain("ORD-8103-24");
  });
});
