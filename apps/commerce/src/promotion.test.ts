import { describe, it, expect, beforeEach } from "vitest";
import { PromotionEngine } from "./domain/promotion-engine.js";
import { CouponService } from "./domain/coupon-service.js";
import { Money } from "@mosaix/core";

/* AUDIT-RESET a055b8e (2026-10-13) — TRAVAIL DE SESSION ABSENT PUIS RESTAURÉ (V1.4, voir git log).
 * Aucun test de non-cumul n'existait (grep "cumul" vide) ; evaluateStack() + cas refus/combinaison
 * ajoutés. Point d'application restant : le checkout (COMMERCE-CART-01) n'évalue pas encore les stacks. */

describe("PROMO-01 & COUPON-01 — Promotion Engine and Coupon Redemption Suite", () => {
  let promoEngine: PromotionEngine;
  let couponService: CouponService;

  beforeEach(() => {
    promoEngine = new PromotionEngine();
    couponService = new CouponService(promoEngine);
  });

  it("calculates percentage and capped discounts correctly", () => {
    const promo = promoEngine.createPromotion({
      name: "Solde d'été 20%",
      type: "percentage",
      value: 20,
      maxDiscountInCents: 1500, // 15 EUR cap
      currency: "EUR",
      stackable: false,
      startsAt: "2026-06-01T00:00:00.000Z",
      endsAt: "2026-08-31T23:59:59.000Z",
      active: true,
    });

    const now = new Date("2026-07-15T12:00:00.000Z");

    // 100 EUR item -> 20 EUR discount capped at 15 EUR
    const res1 = promoEngine.evaluatePromotion(
      promo.id,
      Money.fromCents(10000, "EUR"),
      now
    );

    expect(res1).not.toBeNull();
    expect(res1?.discountAmount.amountInCents).toBe(1500);
    expect(res1?.finalPrice.amountInCents).toBe(8500);

    // 50 EUR item -> 10 EUR discount (under cap)
    const res2 = promoEngine.evaluatePromotion(
      promo.id,
      Money.fromCents(5000, "EUR"),
      now
    );

    expect(res2?.discountAmount.amountInCents).toBe(1000);
    expect(res2?.finalPrice.amountInCents).toBe(4000);
  });

  it("enforces coupon redemption limits and expiration", () => {
    const promo = promoEngine.createPromotion({
      name: "Remise Bienvenue 10 EUR",
      type: "fixed_amount",
      value: 1000, // 10 EUR
      minOrderAmountInCents: 3000, // Min 30 EUR order
      currency: "EUR",
      stackable: false,
      startsAt: "2026-01-01T00:00:00.000Z",
      endsAt: "2026-12-31T23:59:59.000Z",
      active: true,
    });

    const coupon = couponService.createCoupon({
      code: "WELCOME10",
      promotionId: promo.id,
      maxUses: 2,
    });

    expect(coupon.code).toBe("WELCOME10");

    const now = new Date("2026-05-01T12:00:00.000Z");

    // Attempt on order below minimum -> rejected
    const smallRes = couponService.redeemCoupon(
      "WELCOME10",
      Money.fromCents(2000, "EUR"),
      now
    );
    expect(smallRes.success).toBe(false);

    // First valid redemption
    const res1 = couponService.redeemCoupon(
      "WELCOME10",
      Money.fromCents(5000, "EUR"),
      now
    );
    expect(res1.success).toBe(true);
    expect(res1.discountAmount?.amountInCents).toBe(1000);
    expect(res1.finalPrice?.amountInCents).toBe(4000);

    // Second valid redemption
    const res2 = couponService.redeemCoupon(
      "WELCOME10",
      Money.fromCents(5000, "EUR"),
      now
    );
    expect(res2.success).toBe(true);

    // Third attempt -> max uses reached (deactivated)
    const res3 = couponService.redeemCoupon(
      "WELCOME10",
      Money.fromCents(5000, "EUR"),
      now
    );
    expect(res3.success).toBe(false);
    expect(res3.error).toBe("Coupon invalide ou inactif.");
  });

  it("refuses abusive stacking of a non-stackable promotion (V1.4 restore)", () => {
    const solo = promoEngine.createPromotion({
      name: "Solo 20%",
      type: "percentage",
      value: 20,
      currency: "EUR",
      stackable: false,
      startsAt: "2026-01-01T00:00:00.000Z",
      endsAt: "2026-12-31T23:59:59.000Z",
      active: true,
    });
    const extra = promoEngine.createPromotion({
      name: "Extra 10 EUR",
      type: "fixed_amount",
      value: 1000,
      currency: "EUR",
      stackable: true,
      startsAt: "2026-01-01T00:00:00.000Z",
      endsAt: "2026-12-31T23:59:59.000Z",
      active: true,
    });
    const now = new Date("2026-05-01T12:00:00.000Z");

    // Alone: the non-stackable promotion applies.
    const alone = promoEngine.evaluateStack([solo.id], Money.fromCents(10000, "EUR"), now);
    expect(alone?.totalDiscount.amountInCents).toBe(2000);
    expect(alone?.finalPrice.amountInCents).toBe(8000);

    // Combined: refused, so a coupon bound to it cannot cumulate abusively.
    expect(promoEngine.evaluateStack([solo.id, extra.id], Money.fromCents(10000, "EUR"), now)).toBeNull();
    expect(promoEngine.evaluateStack([extra.id, solo.id], Money.fromCents(10000, "EUR"), now)).toBeNull();
  });

  it("combines stackable promotions sequentially and fails closed", () => {
    const pct = promoEngine.createPromotion({
      name: "Stack 10%",
      type: "percentage",
      value: 10,
      currency: "EUR",
      stackable: true,
      startsAt: "2026-01-01T00:00:00.000Z",
      endsAt: "2026-12-31T23:59:59.000Z",
      active: true,
    });
    const fixed = promoEngine.createPromotion({
      name: "Stack 5 EUR",
      type: "fixed_amount",
      value: 500,
      currency: "EUR",
      stackable: true,
      startsAt: "2026-01-01T00:00:00.000Z",
      endsAt: "2026-12-31T23:59:59.000Z",
      active: true,
    });
    const now = new Date("2026-05-01T12:00:00.000Z");

    // 100 EUR -> -10% (10 EUR) -> -5 EUR = 85 EUR.
    const combined = promoEngine.evaluateStack([pct.id, fixed.id], Money.fromCents(10000, "EUR"), now);
    expect(combined?.totalDiscount.amountInCents).toBe(1500);
    expect(combined?.finalPrice.amountInCents).toBe(8500);
    expect(combined?.appliedPromotionIds).toEqual([pct.id, fixed.id]);

    // Fail-closed: unknown id, empty stack, currency mismatch.
    expect(promoEngine.evaluateStack(["promo_missing"], Money.fromCents(10000, "EUR"), now)).toBeNull();
    expect(promoEngine.evaluateStack([], Money.fromCents(10000, "EUR"), now)).toBeNull();
    expect(promoEngine.evaluateStack([pct.id], Money.fromCents(10000, "USD"), now)).toBeNull();
  });
});
