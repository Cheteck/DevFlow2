/**
 * @apps/commerce — PostgreSQL adapter for Auction & Bid persistence (AUCTION-PERSIST).
 * Reads/writes `commerce.auctions` and `commerce.auction_bids` (schema-qualified, camelCase, $n placeholders).
 */

import type { DatabasePort } from "@mosaix/ports-database";
import { InMemoryGuard } from "@mosaix/support";
import type { Auction, AuctionBid, AuctionStatus } from "../domain/auction.service.js";

export interface AuctionRepositoryPort {
  saveAuction(auction: Auction): Promise<void>;
  getAuction(id: string): Promise<Auction | null>;
  listAuctions(filter?: { status?: AuctionStatus; sellerId?: string; spaceId?: string }): Promise<Auction[]>;
  saveBid(auctionId: string, bid: AuctionBid, updatedAuction: Auction): Promise<void>;
}

export class PostgresAuctionRepository implements AuctionRepositoryPort {
  constructor(private readonly db: DatabasePort) {}

  async saveAuction(auction: Auction): Promise<void> {
    await this.db.query(
      `INSERT INTO "commerce"."auctions" (
        "id", "vendableId", "sellerId", "startingPriceInCents", "reservePriceInCents",
        "currentHighBidInCents", "status", "startTime", "endTime", "antiSnipingTriggered",
        "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT ("id") DO UPDATE SET
        "vendableId" = $2,
        "sellerId" = $3,
        "startingPriceInCents" = $4,
        "reservePriceInCents" = $5,
        "currentHighBidInCents" = $6,
        "status" = $7,
        "startTime" = $8,
        "endTime" = $9,
        "antiSnipingTriggered" = $10,
        "updatedAt" = $12`,
      [
        auction.id,
        auction.vendableId,
        auction.sellerId,
        Math.round(auction.startPrice * 100),
        Math.round(auction.reservePrice * 100),
        Math.round(auction.currentBid * 100),
        auction.status,
        auction.startTime,
        auction.endTime,
        auction.extensionsCount > 0,
        auction.createdAt,
        auction.updatedAt,
      ]
    );
  }

  async getAuction(id: string): Promise<Auction | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT
        a."id", a."vendableId", a."sellerId", a."startingPriceInCents", a."reservePriceInCents",
        a."currentHighBidInCents", a."status", a."startTime", a."endTime", a."antiSnipingTriggered",
        a."createdAt", a."updatedAt",
        t."name" AS "translationName"
       FROM "commerce"."auctions" a
       LEFT JOIN "portfolio"."translations" t ON t."vendableId" = a."vendableId" AND t."lang" = $1
       WHERE a."id" = $2 LIMIT 1`,
      ["fr", id]
    );

    if (rows.length === 0) return null;
    const row = rows[0] as Record<string, unknown>;

    const bids = await this.getBidsForAuction(id);

    return this.mapToAuction(row, bids);
  }

  async listAuctions(filter?: { status?: AuctionStatus; sellerId?: string; spaceId?: string }): Promise<Auction[]> {
    let query = `SELECT
      a."id", a."vendableId", a."sellerId", a."startingPriceInCents", a."reservePriceInCents",
      a."currentHighBidInCents", a."status", a."startTime", a."endTime", a."antiSnipingTriggered",
      a."createdAt", a."updatedAt",
      t."name" AS "translationName"
     FROM "commerce"."auctions" a
     LEFT JOIN "portfolio"."translations" t ON t."vendableId" = a."vendableId" AND t."lang" = $1`;

    const conditions: string[] = [];
    const params: unknown[] = ["fr"];

    if (filter?.status) {
      params.push(filter.status);
      conditions.push(`a."status" = $${params.length}`);
    }

    if (filter?.sellerId) {
      params.push(filter.sellerId);
      conditions.push(`a."sellerId" = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += ' ORDER BY a."createdAt" DESC';

    const rows = await this.db.query<Record<string, unknown>>(query, params);

    const result: Auction[] = [];
    for (const row of rows) {
      const aucId = String(row["id"]);
      const bids = await this.getBidsForAuction(aucId);
      result.push(this.mapToAuction(row, bids));
    }

    return result;
  }

  async saveBid(auctionId: string, bid: AuctionBid, updatedAuction: Auction): Promise<void> {
    await this.db.transaction(async (tx) => {
      // 1. Lock auction record for update
      await tx.query(
        `SELECT "id" FROM "commerce"."auctions" WHERE "id" = $1 FOR UPDATE`,
        [auctionId]
      );

      // 2. Insert bid record
      await tx.query(
        `INSERT INTO "commerce"."auction_bids" (
          "id", "auctionId", "bidderId", "amountInCents", "auditHash", "previousHash", "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          bid.bidId,
          auctionId,
          bid.bidderId,
          Math.round(bid.amount * 100),
          bid.auditHash,
          bid.previousHash ?? null,
          bid.timestamp,
        ]
      );

      // 3. Update auction record
      await tx.query(
        `UPDATE "commerce"."auctions" SET
          "currentHighBidInCents" = $1,
          "status" = $2,
          "endTime" = $3,
          "antiSnipingTriggered" = $4,
          "updatedAt" = $5
         WHERE "id" = $6`,
        [
          Math.round(updatedAuction.currentBid * 100),
          updatedAuction.status,
          updatedAuction.endTime,
          updatedAuction.extensionsCount > 0,
          updatedAuction.updatedAt,
          auctionId,
        ]
      );
    });
  }

  private async getBidsForAuction(auctionId: string): Promise<AuctionBid[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT "id", "bidderId", "amountInCents", "auditHash", "previousHash", "createdAt"
       FROM "commerce"."auction_bids"
       WHERE "auctionId" = $1
       ORDER BY "createdAt" ASC`,
      [auctionId]
    );

    return rows.map((r) => ({
      bidId: String(r["id"]),
      bidderId: String(r["bidderId"]),
      amount: Number(r["amountInCents"] ?? 0) / 100,
      timestamp: String(r["createdAt"]),
      auditHash: String(r["auditHash"]),
      previousHash: r["previousHash"] ? String(r["previousHash"]) : undefined,
    }));
  }

  private mapToAuction(row: Record<string, unknown>, bids: AuctionBid[]): Auction {
    const startPrice = Number(row["startingPriceInCents"] ?? 0) / 100;
    const reservePrice = row["reservePriceInCents"] != null
      ? Number(row["reservePriceInCents"]) / 100
      : startPrice;
    const currentBid = Number(row["currentHighBidInCents"] ?? 0) / 100 || startPrice;

    const highestBid = bids.length > 0 ? bids[bids.length - 1] : undefined;

    return {
      id: String(row["id"]),
      vendableId: String(row["vendableId"]),
      vendableTitle: String(row["translationName"] ?? row["vendableId"]),
      sellerId: String(row["sellerId"]),
      startPrice,
      reservePrice,
      minBidIncrement: Math.max(1, Math.round(startPrice * 0.05)),
      currency: "EUR",
      currentBid: highestBid ? highestBid.amount : startPrice,
      highestBidderId: highestBid?.bidderId,
      status: row["status"] as AuctionStatus,
      startTime: String(row["startTime"]),
      endTime: String(row["endTime"]),
      antiSnipingWindowMinutes: 5,
      antiSnipingExtensionMinutes: 5,
      extensionsCount: Boolean(row["antiSnipingTriggered"]) ? 1 : 0,
      bidHistory: bids,
      reserveMet: (highestBid ? highestBid.amount : startPrice) >= reservePrice,
      winningBid: (row["status"] === "closed" && highestBid && highestBid.amount >= reservePrice) ? highestBid : undefined,
      createdAt: String(row["createdAt"]),
      updatedAt: String(row["updatedAt"]),
    };
  }
}

export class InMemoryAuctionRepository implements AuctionRepositoryPort {
  private readonly auctions = new Map<string, Auction>();

  constructor() {
    InMemoryGuard.reportFallback(
      "InMemoryAuctionRepository",
      "no DatabasePort — auction data will be volatile in-memory",
    );
  }

  async saveAuction(auction: Auction): Promise<void> {
    this.auctions.set(auction.id, { ...auction, bidHistory: [...auction.bidHistory] });
  }

  async getAuction(id: string): Promise<Auction | null> {
    const auc = this.auctions.get(id);
    return auc ? { ...auc, bidHistory: [...auc.bidHistory] } : null;
  }

  async listAuctions(filter?: { status?: AuctionStatus; sellerId?: string; spaceId?: string }): Promise<Auction[]> {
    return Array.from(this.auctions.values())
      .filter((auc) => {
        if (filter?.status && auc.status !== filter.status) return false;
        if (filter?.sellerId && auc.sellerId !== filter.sellerId) return false;
        if (filter?.spaceId && auc.sellerSpaceId !== filter.spaceId) return false;
        return true;
      })
      .map((auc) => ({ ...auc, bidHistory: [...auc.bidHistory] }));
  }

  async saveBid(auctionId: string, bid: AuctionBid, updatedAuction: Auction): Promise<void> {
    this.auctions.set(auctionId, { ...updatedAuction, bidHistory: [...updatedAuction.bidHistory] });
  }
}
