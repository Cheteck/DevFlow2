import * as crypto from "node:crypto";

export type SellerEntityType = "space" | "tenant" | "user" | "organization" | "collective" | string;

export interface SellerEntityRef {
  type: SellerEntityType;
  id: string;
  name?: string;
}

export type CommerceOfferStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";

export interface CommerceOffer {
  id: string;
  seller: SellerEntityRef;
  vendableId: string;
  title: string;
  description?: string;
  priceInCents: number;
  currency: string;
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
}

export interface CommerceOfferRepositoryPort {
  saveOffer(offer: CommerceOffer): Promise<void>;
  getOfferById(id: string): Promise<CommerceOffer | null>;
  listOffersBySeller(sellerType: SellerEntityType, sellerId: string): Promise<CommerceOffer[]>;
  listOffersByVendable(vendableId: string): Promise<CommerceOffer[]>;
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
    const offer: CommerceOffer = {
      id: `off-${crypto.randomUUID()}`,
      seller: input.seller,
      vendableId: input.vendableId,
      title: input.title,
      description: input.description,
      priceInCents: input.priceInCents,
      currency: input.currency ?? "EUR",
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
}
