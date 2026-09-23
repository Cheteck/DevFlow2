import { describe, it, expect } from "vitest";
import { RuntimeKernel } from "../kernel";
import { DatabaseModule, type DatabaseService } from "./database-module";

describe("DatabaseModule", () => {
  it("should register database service onto KernelContext and resolve per-app adapters", () => {
    const mockIdentityDb = { query: () => "identity-db" };
    const mockPortfolioDb = { query: () => "portfolio-db" };
    const mockDefaultDb = { query: () => "default-db" };

    const dbModule = new DatabaseModule({
      adapters: {
        identity: mockIdentityDb,
        portfolio: mockPortfolioDb,
      },
      defaultAdapter: mockDefaultDb,
    });

    const kernel = new RuntimeKernel(
      {},
      {
        modules: [dbModule],
      },
    );

    const dbService =
      kernel.moduleContext.getService<DatabaseService>("database");
    expect(dbService).toBeDefined();

    expect(dbService!.getAdapter("identity")).toBe(mockIdentityDb);
    expect(dbService!.getAdapter("portfolio")).toBe(mockPortfolioDb);
    expect(dbService!.getAdapter("unknownApp")).toBe(mockDefaultDb);
    expect(dbService!.listAppsWithDatabase()).toEqual([
      "identity",
      "portfolio",
    ]);
  });

  it("should prioritize persistent adapters and use in-memory adapter as fallback when unregistered", () => {
    const mockPersistentDb = { query: () => "persistent-sql-db" };
    const mockInMemoryFallback = { memory: true };

    const dbModule = new DatabaseModule({
      adapters: {
        "@apps/citadelle": mockPersistentDb,
      },
    });

    const kernel = new RuntimeKernel({}, { modules: [dbModule] });
    const dbService = kernel.moduleContext.getService<DatabaseService>("database");

    expect(dbService!.hasValidAdapter("@apps/citadelle")).toBe(true);
    expect(dbService!.resolveAdapter("@apps/citadelle", undefined, mockInMemoryFallback)).toBe(mockPersistentDb);

    expect(dbService!.hasValidAdapter("@apps/unconfigured")).toBe(false);
    expect(dbService!.resolveAdapter("@apps/unconfigured", undefined, mockInMemoryFallback)).toBe(mockInMemoryFallback);
  });
});
