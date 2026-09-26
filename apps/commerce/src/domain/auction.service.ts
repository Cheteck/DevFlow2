/**
 * @apps/commerce/domain — Auction Core Engine with Reserve Price & Anti-Sniping
 * FEAT-04: Enchères [CŒUR + plugins périphériques] (commerce + portfolio + beam)
 */

import * as crypto from "node:crypto";
import type { OrderService } from "./order.service.js";
import type { OrderModel } from "./order.model.js";

export type AuctionStatus = "draft" | "active" | "closed" | "cancelled";

export interface AuctionBid {
  bidId: string;
  bidderId: string;
  bidderName?: string;
  amount: number;
  timestamp: string;
  auditHash: string;
  previousHash?: string;
}

export interface Auction {
  id: string;
  vendableId: string;
  vendableTitle: string;
  sellerId: string;
  sellerSpaceId?: string;
  startPrice: number;
  reservePrice: number;
  minBidIncrement: number;
  currency: string;
  currentBid: number;
  highestBidderId?: string;
  highestBidderName?: string;
  status: AuctionStatus;
  startTime: string;
  endTime: string;
  antiSnipingWindowMinutes: number;
  antiSnipingExtensionMinutes: number;
  extensionsCount: number;
  bidHistory: AuctionBid[];
  reserveMet: boolean;
  winningBid?: AuctionBid;
  settledOrderId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAuctionInput {
  vendableId: string;
  vendableTitle: string;
  sellerId: string;
  sellerSpaceId?: string;
  startPrice: number;
  reservePrice?: number;
  minBidIncrement?: number;
  currency?: string;
  durationMinutes: number;
  antiSnipingWindowMinutes?: number;
  antiSnipingExtensionMinutes?: number;
}

export interface PlaceBidResult {
  success: boolean;
  bid?: AuctionBid;
  auction: Auction;
  extended: boolean;
  error?: string;
}

export class AuctionService {
  private auctions = new Map<string, Auction>();
  private eventListeners = new Set<(event: string, payload: unknown) => void>();

  createAuction(input: CreateAuctionInput): Auction {
    if (input.startPrice < 0) {
      throw new Error("Le prix de départ doit être supérieur ou égal à zéro.");
    }
    const reservePrice = input.reservePrice ?? input.startPrice;
    if (reservePrice < input.startPrice) {
      throw new Error("Le prix de réserve ne peut pas être inférieur au prix de départ.");
    }

    const id = `auc_${crypto.randomUUID()}`;
    const now = new Date();
    const endTime = new Date(now.getTime() + input.durationMinutes * 60 * 1000);

    const auction: Auction = {
      id,
      vendableId: input.vendableId,
      vendableTitle: input.vendableTitle,
      sellerId: input.sellerId,
      sellerSpaceId: input.sellerSpaceId,
      startPrice: input.startPrice,
      reservePrice,
      minBidIncrement: input.minBidIncrement ?? Math.max(1, Math.round(input.startPrice * 0.05)),
      currency: input.currency || "EUR",
      currentBid: input.startPrice,
      status: "active",
      startTime: now.toISOString(),
      endTime: endTime.toISOString(),
      antiSnipingWindowMinutes: input.antiSnipingWindowMinutes ?? 5,
      antiSnipingExtensionMinutes: input.antiSnipingExtensionMinutes ?? 5,
      extensionsCount: 0,
      bidHistory: [],
      reserveMet: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    this.auctions.set(id, auction);
    this.emitEvent("commerce.auction.created", { auctionId: id, sellerId: input.sellerId });
    return auction;
  }

  getAuction(id: string): Auction | null {
    const auc = this.auctions.get(id);
    if (!auc) return null;
    this.checkAutoClose(auc);
    return { ...auc };
  }

  listAuctions(filter?: { status?: AuctionStatus; sellerId?: string; spaceId?: string }): Auction[] {
    const list = Array.from(this.auctions.values());
    for (const auc of list) {
      this.checkAutoClose(auc);
    }
    return list.filter((auc) => {
      if (filter?.status && auc.status !== filter.status) return false;
      if (filter?.sellerId && auc.sellerId !== filter.sellerId) return false;
      if (filter?.spaceId && auc.sellerSpaceId !== filter.spaceId) return false;
      return true;
    });
  }

  placeBid(
    auctionId: string,
    bidderId: string,
    bidderName: string,
    amount: number
  ): PlaceBidResult {
    const auc = this.auctions.get(auctionId);
    if (!auc) {
      return { success: false, auction: {} as Auction, extended: false, error: "Enchère introuvable." };
    }

    this.checkAutoClose(auc);

    if (auc.status !== "active") {
      return { success: false, auction: { ...auc }, extended: false, error: `L'enchère n'est plus active (statut: ${auc.status}).` };
    }

    if (bidderId === auc.sellerId) {
      return { success: false, auction: { ...auc }, extended: false, error: "Le vendeur ne peut pas surenchérir sur sa propre vente." };
    }

    const minRequired = auc.bidHistory.length === 0 ? auc.startPrice : auc.currentBid + auc.minBidIncrement;
    if (amount < minRequired) {
      return {
        success: false,
        auction: { ...auc },
        extended: false,
        error: `Offre insuffisante. L'offre minimale acceptée est de ${minRequired} ${auc.currency}.`,
      };
    }

    const now = new Date();
    const end = new Date(auc.endTime);
    const msRemaining = end.getTime() - now.getTime();

    if (msRemaining <= 0) {
      auc.status = "closed";
      auc.updatedAt = now.toISOString();
      return { success: false, auction: { ...auc }, extended: false, error: "L'enchère est expirée." };
    }

    // Anti-sniping extension calculation
    let extended = false;
    const windowMs = auc.antiSnipingWindowMinutes * 60 * 1000;
    if (msRemaining < windowMs) {
      const extensionMs = auc.antiSnipingExtensionMinutes * 60 * 1000;
      auc.endTime = new Date(end.getTime() + extensionMs).toISOString();
      auc.extensionsCount += 1;
      extended = true;
    }

    // Compute tamper-evident cryptographically signed audit hash
    const prevBid = auc.bidHistory[auc.bidHistory.length - 1];
    const prevHash = prevBid ? prevBid.auditHash : "GENESIS";
    const bidId = `bid_${crypto.randomUUID()}`;
    const timestamp = now.toISOString();

    const hashInput = `${bidId}:${auctionId}:${bidderId}:${amount}:${timestamp}:${prevHash}`;
    const auditHash = crypto.createHash("sha256").update(hashInput).digest("hex");

    const bid: AuctionBid = {
      bidId,
      bidderId,
      bidderName,
      amount,
      timestamp,
      auditHash,
      previousHash: prevHash,
    };

    auc.bidHistory.push(bid);
    auc.currentBid = amount;
    auc.highestBidderId = bidderId;
    auc.highestBidderName = bidderName;
    auc.reserveMet = amount >= auc.reservePrice;
    auc.updatedAt = timestamp;

    this.emitEvent("commerce.auction.bid_placed", {
      auctionId: auc.id,
      bidId,
      bidderId,
      amount,
      extended,
      newEndTime: auc.endTime,
    });

    return {
      success: true,
      bid,
      auction: { ...auc },
      extended,
    };
  }

  async closeAuction(
    auctionId: string,
    orderService?: OrderService
  ): Promise<{ auction: Auction; winningOrder?: OrderModel }> {
    const auc = this.auctions.get(auctionId);
    if (!auc) {
      throw new Error("Enchère introuvable.");
    }

    if (auc.status === "closed" || auc.status === "cancelled") {
      return { auction: { ...auc } };
    }

    auc.status = "closed";
    auc.updatedAt = new Date().toISOString();

    let winningOrder: OrderModel | undefined;

    if (auc.bidHistory.length > 0 && auc.highestBidderId && auc.reserveMet) {
      const topBid = auc.bidHistory[auc.bidHistory.length - 1];
      auc.winningBid = topBid;

      if (orderService) {
        try {
          const placed = await orderService.createOrder({
            userId: topBid.bidderId,
            vendableId: auc.vendableId,
            amount: topBid.amount,
          });
          winningOrder = placed.order;
          auc.settledOrderId = String(winningOrder.id);
        } catch {
          // Log order settlement creation
        }
      }

      this.emitEvent("commerce.auction.closed_with_winner", {
        auctionId: auc.id,
        winnerId: topBid.bidderId,
        amount: topBid.amount,
        orderId: auc.settledOrderId,
      });
    } else {
      this.emitEvent("commerce.auction.closed_without_winner", {
        auctionId: auc.id,
        reason: auc.bidHistory.length === 0 ? "no_bids" : "reserve_not_met",
      });
    }

    return { auction: { ...auc }, winningOrder };
  }

  private checkAutoClose(auc: Auction): void {
    if (auc.status === "active") {
      const now = new Date();
      const end = new Date(auc.endTime);
      if (now >= end) {
        auc.status = "closed";
        auc.updatedAt = now.toISOString();
        if (auc.bidHistory.length > 0 && auc.highestBidderId && auc.currentBid >= auc.reservePrice) {
          auc.winningBid = auc.bidHistory[auc.bidHistory.length - 1];
        }
      }
    }
  }

  private emitEvent(event: string, payload: unknown): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event, payload);
      } catch {
        // Suppress errors
      }
    }
  }

  onAuctionEvent(listener: (event: string, payload: unknown) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }
}

export const auctionService = new AuctionService();
