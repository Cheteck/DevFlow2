/**
 * Commerce offer repository tests (mapping + vitrine query).
 * Uses a fake DatabasePort — no database required.
 */

import { describe, it, expect, vi } from "vitest";
import {
  PostgresCommerceOfferRepository,
  InMemoryCommerceOfferRepository,
} from "./postgres-offer-repository";

function makeDb(rows: Record<string, unknown>[]) {
  return {
    query: vi.fn().mockResolvedValue(rows),
    execute: vi.fn().mockResolvedValue(0),
  };
}

const ROW = {
  id: "off-1",
  vendableId: "vend-1",
  sellerId: "space-1",
  sellerType: "space",
  priceInCents: 4500,
  currency: "EUR",
  commissionRateBps: 500,
  stockQuantity: 15,
  status: "ACTIVE",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  translationName: "Poterie Kabyle",
  translationDescription: "Faite main",
};

describe("PostgresCommerceOfferRepository", () => {
  it("maps rows to offers with translated titles", async () => {
    const db = makeDb([ROW]);
    const repo = new PostgresCommerceOfferRepository(db as never);
    const offers = await repo.listActiveOffers();
    expect(offers).toHaveLength(1);
    expect(offers[0].title).toBe("Poterie Kabyle");
    expect(offers[0].priceInCents).toBe(4500);
    expect(offers[0].seller).toEqual({ type: "space", id: "space-1" });
    expect(db.query.mock.calls[0][0]).toContain('"commerce"."offers"');
    expect(db.query.mock.calls[0][0]).toContain("ACTIVE");
  });

  it("falls back to the vendable reference without translation", async () => {
    const db = makeDb([{ ...ROW, translationName: null, translationDescription: null }]);
    const repo = new PostgresCommerceOfferRepository(db as never);
    const offers = await repo.listActiveOffers();
    expect(offers[0].title).toBe("vend-1");
  });

  it("returns empty when the vitrine is empty (never fabricated)", async () => {
    const db = makeDb([]);
    const repo = new PostgresCommerceOfferRepository(db as never);
    expect(await repo.listActiveOffers()).toEqual([]);
  });
});

describe("InMemoryCommerceOfferRepository", () => {
  it("filters ACTIVE offers with a bounded limit", async () => {
    const repo = new InMemoryCommerceOfferRepository();
    await repo.saveOffer({
      id: "a", seller: { type: "space", id: "s" }, vendableId: "v",
      title: "A", priceInCents: 100, currency: "EUR", status: "ACTIVE",
      commissionRateBps: 500, createdAt: "", updatedAt: "",
    });
    await repo.saveOffer({
      id: "b", seller: { type: "space", id: "s" }, vendableId: "v",
      title: "B", priceInCents: 200, currency: "EUR", status: "DRAFT",
      commissionRateBps: 500, createdAt: "", updatedAt: "",
    });
    const active = await repo.listActiveOffers();
    expect(active.map((o) => o.id)).toEqual(["a"]);
  });
});
