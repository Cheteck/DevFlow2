import { describe, it, expect } from "vitest";
import { getOfferAvailability } from "./commerce-offer.model.js";

describe("getOfferAvailability (centralized stock semantics)", () => {
  it("treats undefined as unlimited catalog stock", () => {
    expect(getOfferAvailability(undefined)).toEqual({ label: "En stock", tone: "ok", purchasable: true });
  });

  it("reports out-of-stock for zero tracked allocation", () => {
    expect(getOfferAvailability(0)).toEqual({ label: "Rupture de stock", tone: "out", purchasable: false });
  });

  it("rejects negative and non-integer allocations as invalid data", () => {
    expect(getOfferAvailability(-1)).toEqual({ label: "Disponibilité indisponible", tone: "unknown", purchasable: false });
    expect(getOfferAvailability(2.5)).toEqual({ label: "Disponibilité indisponible", tone: "unknown", purchasable: false });
    expect(getOfferAvailability(NaN)).toEqual({ label: "Disponibilité indisponible", tone: "unknown", purchasable: false });
  });

  it("uses singular French for a single unit", () => {
    expect(getOfferAvailability(1)).toEqual({ label: "Plus qu'une unité", tone: "warn", purchasable: true });
    expect(getOfferAvailability(5)).toEqual({ label: "Plus que 5 unités", tone: "warn", purchasable: true });
    expect(getOfferAvailability(6)).toEqual({ label: "En stock (6)", tone: "ok", purchasable: true });
  });
});
