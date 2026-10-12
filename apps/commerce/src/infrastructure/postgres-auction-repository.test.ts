import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryAuctionRepository,
  PostgresAuctionRepository,
} from "./postgres-auction-repository.js";
import { AuctionService } from "../domain/auction.service.js";
import type { DatabasePort } from "@mosaix/ports-database";

class MockDatabasePort implements DatabasePort {
  public auctions = new Map<string, Record<string, unknown>>();
  public bids: Array<Record<string, unknown>> = [];

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (sql.includes('INSERT INTO "commerce"."auctions"')) {
      const [id, vendableId, sellerId, startingPriceInCents, reservePriceInCents, currentHighBidInCents, status, startTime, endTime, antiSnipingTriggered, createdAt, updatedAt] = params;
      const record = { id, vendableId, sellerId, startingPriceInCents, reservePriceInCents, currentHighBidInCents, status, startTime, endTime, antiSnipingTriggered, createdAt, updatedAt };
      this.auctions.set(String(id), record);
      return [] as T[];
    }

    if (sql.includes('SELECT') && sql.includes('FROM "commerce"."auctions"')) {
      if (sql.includes('WHERE a."id" = $2')) {
        const id = String(params[1]);
        const record = this.auctions.get(id);
        return (record ? [record] : []) as T[];
      }

      return Array.from(this.auctions.values()) as T[];
    }

    if (sql.includes('SELECT "id", "bidderId", "amountInCents"')) {
      const auctionId = String(params[0]);
      const matchedBids = this.bids.filter((b) => b["auctionId"] === auctionId);
      return matchedBids as T[];
    }

    return [] as T[];
  }

  async transaction<T>(callback: (tx: DatabasePort) => Promise<T>): Promise<T> {
    const txMock: DatabasePort = {
      query: async <R = unknown>(sql: string, params: unknown[] = []): Promise<R[]> => {
        if (sql.includes('INSERT INTO "commerce"."auction_bids"')) {
          const [id, auctionId, bidderId, amountInCents, auditHash, previousHash, createdAt] = params;
          this.bids.push({ id, auctionId, bidderId, amountInCents, auditHash, previousHash, createdAt });
          return [] as R[];
        }

        if (sql.includes('UPDATE "commerce"."auctions"')) {
          const [currentHighBidInCents, status, endTime, antiSnipingTriggered, updatedAt, id] = params;
          const record = this.auctions.get(String(id));
          if (record) {
            record["currentHighBidInCents"] = currentHighBidInCents;
            record["status"] = status;
            record["endTime"] = endTime;
            record["antiSnipingTriggered"] = antiSnipingTriggered;
            record["updatedAt"] = updatedAt;
          }
          return [] as R[];
        }

        return [] as R[];
      },
      transaction: async <R>(cb: (t: DatabasePort) => Promise<R>): Promise<R> => cb(txMock),
    };
    return callback(txMock);
  }
}

describe("AUCTION-PERSIST — PostgresAuctionRepository & AuctionService", () => {
  let mockDb: MockDatabasePort;
  let repo: PostgresAuctionRepository;
  let service: AuctionService;

  beforeEach(() => {
    mockDb = new MockDatabasePort();
    repo = new PostgresAuctionRepository(mockDb);
    service = new AuctionService(repo);
  });

  it("persists newly created auctions into database repository", async () => {
    const auction = await service.createAuction({
      vendableId: "vnd_watch_01",
      vendableTitle: "Rolex Submariner",
      sellerId: "usr_seller_01",
      startPrice: 100,
      reservePrice: 150,
      durationMinutes: 60,
    });

    expect(auction.id).toBeDefined();
    expect(mockDb.auctions.has(auction.id)).toBe(true);

    const retrieved = await service.getAuction(auction.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.vendableId).toBe("vnd_watch_01");
    expect(retrieved?.startPrice).toBe(100);
    expect(retrieved?.reservePrice).toBe(150);
  });

  it("persists bids transactionally with chained audit hash", async () => {
    const auction = await service.createAuction({
      vendableId: "vnd_art_01",
      vendableTitle: "Art Piece",
      sellerId: "usr_artist",
      startPrice: 50,
      reservePrice: 100,
      durationMinutes: 60,
    });

    const bid1 = await service.placeBid(auction.id, "usr_bidder_1", "Alice", 60);
    expect(bid1.success).toBe(true);
    expect(mockDb.bids.length).toBe(1);
    expect(mockDb.bids[0]["previousHash"]).toBe("GENESIS");

    const bid2 = await service.placeBid(auction.id, "usr_bidder_2", "Bob", 70);
    expect(bid2.success).toBe(true);
    expect(mockDb.bids.length).toBe(2);
    expect(mockDb.bids[1]["previousHash"]).toBe(mockDb.bids[0]["auditHash"]);

    const retrieved = await service.getAuction(auction.id);
    expect(retrieved?.currentBid).toBe(70);
    expect(retrieved?.highestBidderId).toBe("usr_bidder_2");
    expect(retrieved?.bidHistory.length).toBe(2);
  });

  it("survives service restarts without data loss when backed by repository", async () => {
    const auction = await service.createAuction({
      vendableId: "vnd_car_01",
      vendableTitle: "Vintage Car",
      sellerId: "usr_dealer",
      startPrice: 1000,
      durationMinutes: 120,
    });

    await service.placeBid(auction.id, "usr_collector", "Charlie", 1200);

    // Simulate service restart by initializing a new service instance with the same repo
    const restartedService = new AuctionService(repo);
    const retrieved = await restartedService.getAuction(auction.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.currentBid).toBe(1200);
    expect(retrieved?.highestBidderId).toBe("usr_collector");
  });
});
