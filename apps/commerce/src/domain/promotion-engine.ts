import { createTypedRegistry } from "@mosaix/support";
/**
 * @apps/commerce/domain — Promotion Engine (PROMO-01)
 * Supporting percentage or fixed discounts, time windows, caps, stackability, and seller guardrails.
 */

import * as crypto from "node:crypto";
import { Money } from "@mosaix/core";

export type DiscountType = "percentage" | "fixed_amount" | string;

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

export interface StackEvaluationResult {
  appliedPromotionIds: string[];
  totalDiscount: Money;
  finalPrice: Money;
}

export type PromotionStrategy = (
  promo: PromotionRule,
  itemPrice: Money,
) => { discountAmount: Money; finalPrice: Money };

const promotionStrategyRegistry = createTypedRegistry<string, PromotionStrategy>([], { name: "PromotionStrategyRegistry", allowOverwrite: true });

export function registerPromotionStrategy(type: string, strategy: PromotionStrategy): void {
  promotionStrategyRegistry.register(type, strategy, true);
}

// Built-in strategies
registerPromotionStrategy("percentage", (promo, itemPrice) => {
  let discountCents = Math.round((itemPrice.amountInCents * promo.value) / 100);
  if (promo.maxDiscountInCents && discountCents > promo.maxDiscountInCents) {
    discountCents = promo.maxDiscountInCents;
  }
  const discountAmount = Money.fromCents(discountCents, itemPrice.currency);
  const finalPrice = Money.fromCents(itemPrice.amountInCents - discountCents, itemPrice.currency);
  return { discountAmount, finalPrice };
});

registerPromotionStrategy("fixed_amount", (promo, itemPrice) => {
  const discountCents = Math.min(itemPrice.amountInCents, promo.value);
  const discountAmount = Money.fromCents(discountCents, itemPrice.currency);
  const finalPrice = Money.fromCents(itemPrice.amountInCents - discountCents, itemPrice.currency);
  return { discountAmount, finalPrice };
});

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

    const strategy = promotionStrategyRegistry.get(promo.type);
    if (!strategy) return null;

    const { discountAmount, finalPrice } = strategy(promo, itemPrice);

    return {
      promotionId: promo.id,
      promotionName: promo.name,
      originalPrice: itemPrice,
      discountAmount,
      finalPrice,
    };
  }

  /**
   * Anti-abuse stacking (V1.4): evaluates a combination of promotions against
   * one price.
   */
  evaluateStack(
    promoIds: string[],
    itemPrice: Money,
    now: Date = new Date(),
  ): StackEvaluationResult | null {
    const uniqueIds = [...new Set(promoIds)];
    if (uniqueIds.length === 0) return null;

    const promos: PromotionRule[] = [];
    for (const id of uniqueIds) {
      const promo = this.promotions.get(id);
      if (!promo || !promo.active) return null;
      promos.push(promo);
    }

    for (const promo of promos) {
      if (now < new Date(promo.startsAt) || now > new Date(promo.endsAt)) return null;
      if (promo.currency !== itemPrice.currency) return null;
      if (promo.minOrderAmountInCents && itemPrice.amountInCents < promo.minOrderAmountInCents) {
        return null;
      }
    }

    if (promos.some((p) => !p.stackable) && promos.length > 1) return null;

    let remainingCents = itemPrice.amountInCents;
    let totalDiscountCents = 0;
    for (const promo of promos) {
      const step = this.evaluatePromotion(
        promo.id,
        Money.fromCents(remainingCents, itemPrice.currency),
        now,
      );
      if (!step) return null;
      totalDiscountCents += step.discountAmount.amountInCents;
      remainingCents = step.finalPrice.amountInCents;
    }

    return {
      appliedPromotionIds: promos.map((p) => p.id),
      totalDiscount: Money.fromCents(totalDiscountCents, itemPrice.currency),
      finalPrice: Money.fromCents(remainingCents, itemPrice.currency),
    };
  }
}
