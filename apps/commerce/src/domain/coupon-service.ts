/**
 * @apps/commerce/domain — Coupon Service (COUPON-01)
 * Coupon codes attached to promotions, minimums, usage limits, and atomic consumption.
 */

import * as crypto from "node:crypto";
import type { PromotionEngine } from "./promotion-engine.js";
import { Money } from "@mosaix/core";

export interface CouponCode {
  id: string;
  code: string;
  promotionId: string;
  maxUses?: number;
  usedCount: number;
  expiresAt?: string;
  active: boolean;
  createdAt: string;
}

export interface CouponRedemptionResult {
  success: boolean;
  coupon?: CouponCode;
  discountAmount?: Money;
  finalPrice?: Money;
  error?: string;
}

export class CouponService {
  private coupons = new Map<string, CouponCode>();

  constructor(private readonly promotionEngine: PromotionEngine) {}

  createCoupon(input: {
    code: string;
    promotionId: string;
    maxUses?: number;
    expiresAt?: string;
  }): CouponCode {
    const cleanCode = input.code.toUpperCase().trim();
    if (!cleanCode) {
      throw new Error("Coupon code cannot be empty.");
    }
    if (this.coupons.has(cleanCode)) {
      throw new Error(`Coupon code [${cleanCode}] already exists.`);
    }

    const promo = this.promotionEngine.getPromotion(input.promotionId);
    if (!promo) {
      throw new Error(`Promotion [${input.promotionId}] not found.`);
    }

    const coupon: CouponCode = {
      id: `coup_${crypto.randomUUID()}`,
      code: cleanCode,
      promotionId: input.promotionId,
      maxUses: input.maxUses,
      usedCount: 0,
      expiresAt: input.expiresAt,
      active: true,
      createdAt: new Date().toISOString(),
    };

    this.coupons.set(cleanCode, coupon);
    return coupon;
  }

  getCoupon(code: string): CouponCode | null {
    return this.coupons.get(code.toUpperCase().trim()) ?? null;
  }

  redeemCoupon(
    code: string,
    orderPrice: Money,
    now: Date = new Date()
  ): CouponRedemptionResult {
    const cleanCode = code.toUpperCase().trim();
    const coupon = this.coupons.get(cleanCode);

    if (!coupon || !coupon.active) {
      return { success: false, error: "Coupon invalide ou inactif." };
    }

    if (coupon.expiresAt && now > new Date(coupon.expiresAt)) {
      return { success: false, error: "Coupon expiré." };
    }

    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
      return { success: false, error: "Limite d'utilisation du coupon atteinte." };
    }

    const promoResult = this.promotionEngine.evaluatePromotion(
      coupon.promotionId,
      orderPrice,
      now
    );

    if (!promoResult) {
      return { success: false, error: "Les conditions de la promotion ne sont pas remplies." };
    }

    // Atomic consumption increment
    coupon.usedCount += 1;
    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
      coupon.active = false;
    }

    return {
      success: true,
      coupon,
      discountAmount: promoResult.discountAmount,
      finalPrice: promoResult.finalPrice,
    };
  }
}
