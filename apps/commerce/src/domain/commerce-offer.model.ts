import * as crypto from "node:crypto";
import { Money } from "@mosaix/core";

export type SellerEntityType = "space" | "tenant" | "user" | "organization" | "collective" | string;

export interface SellerEntityRef {
  type: SellerEntityType;
  id: string;
  name?: string;
}

export type CommerceOfferStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";

export interface PriceHistoryEntry {
  priceInCents: number;
  currency: string;
  actorId: string;
  reason: string;
  updatedAt: string;
}

export interface CommerceOffer {
  id: string;
  seller: SellerEntityRef;
  vendableId: string;
  title: string;
  description?: string;
  priceInCents: number;
  currency: string;
  priceHistory?: PriceHistoryEntry[];
  status: CommerceOfferStatus;
  stockAllocation?: number; // undefined = unlimited / catalog controlled
  commissionRateBps: number; // e.g. 500 for 5.00%
  payoutDestination?: {
    provider: string; // e.g. "stripe_connect"
    accountId: string;
  };
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutBreakdown {
  grossAmountInCents: number;
  platformCommissionInCents: number;
  netSellerPayoutInCents: number;
  currency: string;
}

export interface CreateOfferInput {
  seller: SellerEntityRef;
  vendableId: string;
  title: string;
  description?: string;
  priceInCents: number;
  currency?: string;
  stockAllocation?: number;
  commissionRateBps?: number;
  payoutDestination?: {
    provider: string;
    accountId: string;
  };
  metadata?: Record<string, unknown>;
  initialStatus?: CommerceOfferStatus;
  actorId?: string;
  initialReason?: string;
}

export interface CommerceOfferRepositoryPort {
  saveOffer(offer: CommerceOffer): Promise<void>;
  getOfferById(id: string): Promise<CommerceOffer | null>;
  listOffersBySeller(sellerType: SellerEntityType, sellerId: string): Promise<CommerceOffer[]>;
  listOffersByVendable(vendableId: string): Promise<CommerceOffer[]>;
  /** Public vitrine: ACTIVE offers newest-first. */
  listActiveOffers(limit?: number): Promise<CommerceOffer[]>;
}

export function resolveEffectivePrice(
  offer: CommerceOffer,
  _context?: Record<string, unknown>
): Money {
  return Money.fromCents(offer.priceInCents, offer.currency);
}

/**
 * Agnostic Vendable Offer Service
 * Enables spaces, tenants, collectives, and users to list and sell vendables independently.
 */
export class CommerceOfferService {
  private offers = new Map<string, CommerceOffer>();

  constructor(private readonly repository?: CommerceOfferRepositoryPort) {}

  async createOffer(input: CreateOfferInput): Promise<CommerceOffer> {
    if (!input.seller || !input.seller.type || !input.seller.id) {
      throw new Error("Seller entity reference (type and id) is required.");
    }
    if (!input.vendableId) {
      throw new Error("Vendable ID is required to create a commerce offer.");
    }
    if (input.priceInCents < 0) {
      throw new Error("Offer price cannot be negative.");
    }

    const now = new Date().toISOString();
    const currency = input.currency ?? "EUR";
    const actorId = input.actorId ?? input.seller.id;
    const reason = input.initialReason ?? "Initial offer creation";

    const initialPriceEntry: PriceHistoryEntry = {
      priceInCents: input.priceInCents,
      currency,
      actorId,
      reason,
      updatedAt: now,
    };

    const offer: CommerceOffer = {
      id: `off-${crypto.randomUUID()}`,
      seller: input.seller,
      vendableId: input.vendableId,
      title: input.title,
      description: input.description,
      priceInCents: input.priceInCents,
      currency,
      priceHistory: [initialPriceEntry],
      status: input.initialStatus ?? "ACTIVE",
      stockAllocation: input.stockAllocation,
      commissionRateBps: input.commissionRateBps ?? 500, // 5% default platform fee
      payoutDestination: input.payoutDestination,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    };

    this.offers.set(offer.id, offer);
    if (this.repository) {
      await this.repository.saveOffer(offer);
    }

    return offer;
  }

  async updatePrice(
    offerId: string,
    newPriceInCents: number,
    actorId: string,
    reason: string
  ): Promise<CommerceOffer> {
    if (newPriceInCents < 0) {
      throw new Error("Price cannot be negative.");
    }

    const offer = await this.getOffer(offerId);
    if (!offer) {
      throw new Error(`CommerceOffer [${offerId}] not found.`);
    }

    const now = new Date().toISOString();
    const entry: PriceHistoryEntry = {
      priceInCents: newPriceInCents,
      currency: offer.currency,
      actorId,
      reason,
      updatedAt: now,
    };

    offer.priceInCents = newPriceInCents;
    if (!offer.priceHistory) {
      offer.priceHistory = [];
    }
    offer.priceHistory.push(entry);
    offer.updatedAt = now;

    this.offers.set(offer.id, offer);
    if (this.repository) {
      await this.repository.saveOffer(offer);
    }

    return offer;
  }

  async getOffer(id: string): Promise<CommerceOffer | null> {
    if (this.repository) {
      const persisted = await this.repository.getOfferById(id);
      if (persisted) return persisted;
    }
    return this.offers.get(id) ?? null;
  }

  async setOfferStatus(id: string, status: CommerceOfferStatus): Promise<CommerceOffer> {
    const offer = await this.getOffer(id);
    if (!offer) {
      throw new Error(`CommerceOffer [${id}] not found.`);
    }

    offer.status = status;
    offer.updatedAt = new Date().toISOString();
    this.offers.set(offer.id, offer);

    if (this.repository) {
      await this.repository.saveOffer(offer);
    }

    return offer;
  }

  async listOffersBySeller(sellerType: SellerEntityType, sellerId: string): Promise<CommerceOffer[]> {
    if (this.repository) {
      return this.repository.listOffersBySeller(sellerType, sellerId);
    }
    return Array.from(this.offers.values()).filter(
      (o) => o.seller.type === sellerType && o.seller.id === sellerId
    );
  }

  async listActiveOffersForVendable(vendableId: string): Promise<CommerceOffer[]> {
    if (this.repository) {
      const all = await this.repository.listOffersByVendable(vendableId);
      return all.filter((o) => o.status === "ACTIVE");
    }
    return Array.from(this.offers.values()).filter(
      (o) => o.vendableId === vendableId && o.status === "ACTIVE"
    );
  }

  /** Public vitrine feed: all ACTIVE offers, newest first. */
  async listAllActive(limit = 48): Promise<CommerceOffer[]> {
    if (this.repository) {
      return this.repository.listActiveOffers(limit);
    }
    return Array.from(this.offers.values())
      .filter((o) => o.status === "ACTIVE")
      .slice(0, Math.min(Math.max(limit, 1), 200));
  }

  calculatePayout(offer: CommerceOffer, totalQuantity: number = 1): PayoutBreakdown {
    const gross = offer.priceInCents * totalQuantity;
    const platformCommission = Math.round((gross * offer.commissionRateBps) / 10000);
    const netPayout = Math.max(0, gross - platformCommission);

    return {
      grossAmountInCents: gross,
      platformCommissionInCents: platformCommission,
      netSellerPayoutInCents: netPayout,
      currency: offer.currency,
    };
  }

  getMoney(offer: CommerceOffer): Money {
    return Money.fromCents(offer.priceInCents, offer.currency);
  }

  calculatePayoutMoney(offer: CommerceOffer, totalQuantity: number = 1): { gross: Money; commission: Money; net: Money } {
    const breakdown = this.calculatePayout(offer, totalQuantity);
    return {
      gross: Money.fromCents(breakdown.grossAmountInCents, breakdown.currency),
      commission: Money.fromCents(breakdown.platformCommissionInCents, breakdown.currency),
      net: Money.fromCents(breakdown.netSellerPayoutInCents, breakdown.currency),
    };
  }
}
