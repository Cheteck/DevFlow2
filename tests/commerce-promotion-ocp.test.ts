import { describe, it, expect } from "vitest";
import { Money } from "@mosaix/core";
import {
  PromotionEngine,
  registerPromotionStrategy,
  type PromotionRule,
  type DiscountType,
} from "../apps/commerce/src/domain/promotion-engine.js";

describe("Commerce Promotion Engine OCP Strategy Extension", () => {
  it("allows registering custom discount strategies without modifying PromotionEngine core", () => {
    // Register custom 'tiered_volume' discount strategy: 50% off if order >= 100 EUR
    registerPromotionStrategy("tiered_volume", (_promo: PromotionRule, itemPrice: Money) => {
      if (itemPrice.amountInCents >= 10000) {
        const discountCents = Math.round(itemPrice.amountInCents * 0.5);
        return {
          discountAmount: Money.fromCents(discountCents, itemPrice.currency),
          finalPrice: Money.fromCents(itemPrice.amountInCents - discountCents, itemPrice.currency),
        };
      }
      return {
        discountAmount: Money.fromCents(0, itemPrice.currency),
        finalPrice: itemPrice,
      };
    });

    const engine = new PromotionEngine();
    const now = new Date();
    const promo = engine.createPromotion({
      name: "Volume VIP 50%",
      type: "tiered_volume" as DiscountType,
      value: 50,
      currency: "EUR",
      stackable: false,
      startsAt: new Date(now.getTime() - 1000).toISOString(),
      endsAt: new Date(now.getTime() + 100000).toISOString(),
      active: true,
    });

    const result = engine.evaluatePromotion(promo.id, Money.fromCents(12000, "EUR"), now);

    expect(result).not.toBeNull();
    expect(result?.promotionName).toBe("Volume VIP 50%");
    expect(result?.discountAmount.amountInCents).toBe(6000);
    expect(result?.finalPrice.amountInCents).toBe(6000);
  });
});
