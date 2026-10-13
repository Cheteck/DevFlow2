import { describe, it, expect, beforeEach } from "vitest";
import { PromotionEngine } from "./domain/promotion-engine.js";
import { CouponService } from "./domain/coupon-service.js";
import { Money } from "@mosaix/core";

/* AUDIT-RESET a055b8e (2026-10-13) — TRAVAIL DE SESSION ABSENT.
 * La session annonçait "l'intégration et la validation des tests de non-cumul abusif des promotions
 * et coupons", mais ce fichier (suite PROMO-01/COUPON-01 du commit 7b452f4) ne contient aucun test
 * de non-cumul (grep "cumul" vide) et est absent du commit a055b8e.
 * Restauration : ajouter les cas promotion+coupon non cumulables (abusif refusé, légitime accepté)
 * contre PromotionEngine/CouponService, sans modifier les cas existants. */

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
});
