/**
 * Commerce descriptor tests: real service data in, honest states out.
 * No static products — the vitrine shows service offers or an empty state.
 */

import { describe, it, expect } from "vitest";
import { createCommerceDescriptor, resolveView, formatMoneyStrict } from "./commerce-view";
import { CommerceOfferService } from "../domain/commerce-offer.model.js";
import { OrderService } from "../domain/order.service.js";
import { DemoPaymentPort, DemoInventoryPort } from "../workflows/checkout-order.workflow.js";
import { InMemoryOrderRepository } from "../infrastructure/postgres-order-repository.js";

function ctx(query: Record<string, string | string[]>, roles: string[] = ["member"], userId = "user-1", isAuthenticated = true) {
  return {
    tenantId: "default",
    spaceId: null,
    user: { id: userId, roles, permissions: [], isAuthenticated },
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
    expect(result.contentHtml).toContain("99,99");
    expect(result.contentHtml).toContain("€");
    expect(result.contentHtml).not.toContain("Xiaomi");
    expect(result.contentHtml).not.toContain("Ali Express");
    // Marketplace toolbar (client-side filter/sort over loaded offers)…
    expect(result.contentHtml).toContain('id="offer-search"');
    expect(result.contentHtml).toContain('id="offer-sort"');
    expect(result.contentHtml).toContain("offer-card");
    // Template-adapted enriched card: vendor pill, price box, honest stock.
    expect(result.contentHtml).toContain("Atelier");
    expect(result.contentHtml).toContain("Plus que 3 unités");
    // Real footer count, no fake pagination or vendor claims.
    expect(result.contentHtml).toContain("offre(s) publiée(s)");
    expect(result.contentHtml).not.toContain("1 482");
    expect(result.contentHtml).not.toContain("Chez <strong");
    expect(result.contentHtml).not.toContain("Certifié");
    // …and no duplicated shell header nor fake category filter.
    expect(result.contentHtml).not.toContain("Marché Décentralisé");
    expect(result.contentHtml).not.toContain("Toutes les Catégories");
  });

  it("renders a configuration error without services (never a false empty state)", async () => {
    const descriptor = createCommerceDescriptor();
    const offers = await descriptor.render!(ctx({}));
    // Note: the apostrophe is HTML-escaped by serviceUnavailable (n&#39;est).
    expect(offers.contentHtml).toContain("pas configuré");
    expect(offers.pageTitle).toBe("Commerce — Service indisponible");
    expect(offers.contentHtml).not.toContain("Aucune offre publiée");
    const orders = await descriptor.render!(ctx({ view: "orders" }));
    expect(orders.contentHtml).toContain("pas configuré");
  });

  it("renders an honest empty state when the wired store is empty", async () => {
    const descriptor = createCommerceDescriptor({
      offerService: new CommerceOfferService(),
      orderService: new OrderService(new InMemoryOrderRepository()),
    });
    const result = await descriptor.render!(ctx({}));
    expect(result.contentHtml).toContain("Aucune offre publiée");
    expect(result.contentHtml).not.toContain("Xiaomi 18 Pro Max");
  });

  it("hides cart/orders tabs for guests and prompts login on cart", async () => {
    const descriptor = createCommerceDescriptor();
    const guest = ctx({}, [], "guest", false);
    const offers = await descriptor.render!(guest);
    expect(offers.contentHtml).not.toContain("view=cart");
    expect(offers.contentHtml).not.toContain("view=orders");
    const cart = await descriptor.render!(ctx({ view: "cart" }, [], "guest", false));
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

  it("grants session views from the auth flag, never from roles", async () => {
    const descriptor = createCommerceDescriptor({
      orderService: new OrderService(new InMemoryOrderRepository()),
    });
    // Authenticated without any role: orders branch (empty state), not login.
    const noRole = await descriptor.render!(ctx({ view: "orders" }, [], "user-9", true));
    expect(noRole.contentHtml).toContain("Aucune commande pour le moment");
    expect(noRole.contentHtml).not.toContain("Connectez-vous");
    // Role without authentication: login prompt, roles ignored.
    const roleNoAuth = await descriptor.render!(ctx({ view: "orders" }, ["admin"], "user-9", false));
    expect(roleNoAuth.contentHtml).toContain("Connectez-vous");
  });

  it("propagates service failures instead of rendering false emptiness", async () => {
    const broken = {
      listAllActive: async () => { throw new Error("db down"); },
      listOffersBySeller: async () => [],
      listActiveOffersForVendable: async () => [],
    };
    const descriptor = createCommerceDescriptor({ offerService: broken as never });
    await expect(descriptor.render!(ctx({}))).rejects.toThrow("db down");
  });

  it("normalizes unknown views to the public vitrine", () => {
    expect(resolveView("nope")).toBe("offers");
    expect(resolveView(["cart", "orders"])).toBe("cart");
    expect(resolveView(undefined)).toBe("offers");
    expect(resolveView("orders")).toBe("orders");
  });

  it("formats money strictly and rejects hostile input", () => {
    expect(formatMoneyStrict(9999, "EUR")).toContain("99,99");
    expect(() => formatMoneyStrict(12.5, "EUR")).toThrow();
    expect(() => formatMoneyStrict(Number.NaN, "EUR")).toThrow();
    expect(() => formatMoneyStrict(100, "EUROS")).toThrow();
    expect(() => formatMoneyStrict(100, "<img src=x>")).toThrow();
  });

  it("renders hostile titles as inert text and hostile prices as unavailable", async () => {
    const offers = new CommerceOfferService();
    await offers.createOffer({
      seller: { type: "space", id: "space-1", name: "<img src=x onerror=alert(1)>" },
      vendableId: "vend-1",
      title: "<script>alert(1)</script>",
      priceInCents: 100,
      currency: "EUR",
    });
    const descriptor = createCommerceDescriptor({ offerService: offers });
    const result = await descriptor.render!(ctx({}));
    expect(result.contentHtml).not.toContain("<script>alert(1)</script>");
    expect(result.contentHtml).toContain("&lt;script&gt;");
    expect(result.contentHtml).not.toContain("<img src=x onerror");
  });

  it("never renders corrupt amounts as 0.00", async () => {
    const offers = new CommerceOfferService();
    // The service only rejects negatives — fractional amounts and hostile
    // currencies reach the view, which must refuse them explicitly.
    await offers.createOffer({
      seller: { type: "space", id: "space-1" },
      vendableId: "vend-2",
      title: "Offre corrompue",
      priceInCents: 12.5,
      currency: "<img src=y>",
    });
    const descriptor = createCommerceDescriptor({ offerService: offers });
    const result = await descriptor.render!(ctx({}));
    expect(result.contentHtml).toContain("Prix indisponible");
    expect(result.contentHtml).not.toContain("0.00");
    expect(result.contentHtml).not.toContain("<img src=y>");
  });
});
