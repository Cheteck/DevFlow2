/**
 * Auction wiring regression tests: importing or instantiating the auction
 * stack must never create volatile storage nor emit the in-memory fallback
 * signal. Production wiring (composition root) injects Postgres before any
 * operation runs.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  AuctionService,
  auctionService,
  type AuctionRepositoryPort,
} from "./domain/auction.service.js";

function makeRepo(): AuctionRepositoryPort & { saved: string[] } {
  const saved: string[] = [];
  return {
    saved,
    async saveAuction(auction) {
      saved.push(auction.id);
    },
    async getAuction() {
      return null;
    },
    async listAuctions() {
      return [];
    },
    async saveBid() {},
  };
}

describe("auction lazy repository default", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("constructing the service (incl. the shared singleton module) logs no fallback", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Import has already happened above; constructing must stay silent too.
    const service = new AuctionService();
    void service;
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining("InMemoryAuctionRepository"),
    );
  });

  it("setRepository before first use keeps the fallback silent forever", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const repo = makeRepo();
    const service = new AuctionService();
    service.setRepository(repo);
    const auction = await service.createAuction({
      vendableId: "vend-1",
      vendableTitle: "T",
      sellerId: "seller-1",
      startPrice: 100,
      durationMinutes: 60,
    });
    expect(repo.saved).toContain(auction.id);
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining("InMemoryAuctionRepository"),
    );
  });

  it("composition root wires the shared singleton to Postgres", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { createCommerceWiredDescriptor } = await import("./composition-root.js");
    const calls: string[] = [];
    const fakeDb = {
      capabilities: { dialect: "postgres" },
      query: async (sql: string) => {
        calls.push(sql);
        return [];
      },
      execute: async () => 0,
    };
    const descriptor = createCommerceWiredDescriptor(fakeDb as never);
    expect(descriptor.id).toBe("@apps/commerce");
    // The singleton now persists through Postgres: a read hits the injected
    // DatabasePort instead of volatile memory.
    await expect(auctionService.getAuction("auc-missing")).resolves.toBeNull();
    expect(calls.some((sql) => sql.includes('"commerce"."auctions"'))).toBe(true);
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining("InMemoryAuctionRepository"),
    );
  });
});
