/**
 * @apps/commerce/domain — Promotion Engine (PROMO-01)
 * Supporting percentage or fixed discounts, time windows, caps, stackability, and seller guardrails.
 */

import * as crypto from "node:crypto";
import { Money } from "@mosaix/core";

export type DiscountType = "percentage" | "fixed_amount";

export interface PromotionRule {
  id: string;
  name: string;
  sellerId?: string; // Optional: empty means platform-wide
  type: DiscountType;
  value: number; // e.g., 15 for 15% or 500 for 5.00 EUR fixed discount in cents
  maxDiscountInCents?: number; // Cap for percentage discounts
  minOrderAmountInCents?: number;
  currency: string;
  stackable: boolean;
  startsAt: string;
  endsAt: string;
  active: boolean;
  createdAt: string;
}

export interface DiscountCalculationResult {
  promotionId: string;
  promotionName: string;
  originalPrice: Money;
  discountAmount: Money;
  finalPrice: Money;
}

export class PromotionEngine {
  private promotions = new Map<string, PromotionRule>();

  createPromotion(input: Omit<PromotionRule, "id" | "createdAt">): PromotionRule {
    if (input.value <= 0) {
      throw new Error("Discount value must be greater than zero.");
    }
    if (input.type === "percentage" && input.value > 100) {
      throw new Error("Percentage discount cannot exceed 100%.");
    }

    const id = `promo_${crypto.randomUUID()}`;
    const promo: PromotionRule = {
      ...input,
      id,
      createdAt: new Date().toISOString(),
    };

    this.promotions.set(id, promo);
    return promo;
  }

  getPromotion(id: string): PromotionRule | null {
    return this.promotions.get(id) ?? null;
  }

  evaluatePromotion(
    promoId: string,
    itemPrice: Money,
    now: Date = new Date()
  ): DiscountCalculationResult | null {
    const promo = this.promotions.get(promoId);
    if (!promo || !promo.active) return null;

    const starts = new Date(promo.startsAt);
    const ends = new Date(promo.endsAt);
    if (now < starts || now > ends) return null;

    if (promo.currency !== itemPrice.currency) return null;

    if (promo.minOrderAmountInCents && itemPrice.amountInCents < promo.minOrderAmountInCents) {
      return null;
    }

    let discountCents = 0;
    if (promo.type === "percentage") {
      discountCents = Math.round((itemPrice.amountInCents * promo.value) / 100);
      if (promo.maxDiscountInCents && discountCents > promo.maxDiscountInCents) {
        discountCents = promo.maxDiscountInCents;
      }
    } else {
      discountCents = Math.min(itemPrice.amountInCents, promo.value);
    }

    const discountAmount = Money.fromCents(discountCents, itemPrice.currency);
    const finalPrice = Money.fromCents(itemPrice.amountInCents - discountCents, itemPrice.currency);

    return {
      promotionId: promo.id,
      promotionName: promo.name,
      originalPrice: itemPrice,
      discountAmount,
      finalPrice,
    };
  }
}
