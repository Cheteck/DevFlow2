import { describe, it, expect } from "vitest";
import type {
  DatabaseCapabilities,
  DatabasePort,
  MigrationLock,
} from "@mosaix/ports-database";
import { migration as allocationsMigration } from "../src/infrastructure/migrations/20261010090000_add_solidarity_allocations.js";
import { PostgresSolidarityRepository } from "../src/infrastructure/postgres-solidarity-repository.js";
import { SolidarityService, type SolidarityRepositoryPort } from "../src/infrastructure/solidarity-service.js";
import type { NeedAllocation } from "../src/domain/solidarity-operational-rules.js";

function makeCapabilities(): DatabaseCapabilities {
  return {
    dialect: "sqlite",
    transactions: true,
    lock: { distributed: false, processSafe: true, runtimeSafe: true },
  };
}

/** In-memory DatabasePort emulating ON CONFLICT DO NOTHING on idempotencyKey. */
class FakeAllocDb implements DatabasePort {
  readonly capabilities = makeCapabilities();
  readonly byKey = new Map<string, Record<string, unknown>>();

  async execute(): Promise<number> {
    return 0;
  }

  async query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]> {
    if (sql.includes('INSERT INTO "solidarity"."allocations"')) {
      const key = String(params?.[1]);
      if (!this.byKey.has(key)) {
        this.byKey.set(key, { data: params?.[8] });
      }
      return [] as unknown as T[];
    }
    if (sql.includes('FROM "solidarity"."allocations"')) {
      const row = this.byKey.get(String(params?.[0]));
      return (row ? [row] : []) as unknown as T[];
    }
    return [] as unknown as T[];
  }

  async transaction<T>(fn: (tx: DatabasePort) => Promise<T>): Promise<T> {
    return fn(this);
  }

  async acquireMigrationLock(): Promise<MigrationLock> {
    return { release: async () => {} };
  }
}

function allocation(key: string): NeedAllocation {
  return {
    id: `alloc-${key}`,
    needId: "need-1",
    stockId: "stock-1",
    hubId: "hub-1",
    quantity: 100,
    unit: "L",
    status: "CONFIRMED",
    createdAt: new Date().toISOString(),
    idempotencyKey: key,
  };
}

describe("solidarity allocations persistence (§8)", () => {
  it("ships a migration creating a unique-keyed allocations ledger", () => {
    expect(allocationsMigration.id).toBe("20261010090000_add_solidarity_allocations");
    expect(allocationsMigration.checksum).toBeTruthy();
    expect(allocationsMigration.content).toContain('CREATE TABLE IF NOT EXISTS "solidarity"."allocations"');
    expect(allocationsMigration.content).toContain("UNIQUE");
    expect(allocationsMigration.content).toContain("idempotencyKey");
    expect(allocationsMigration.down).toContain('DROP TABLE IF EXISTS "solidarity"."allocations"');
    expect(allocationsMigration.resources).toContain("table:solidarity.allocations");
  });

  it("round-trips allocations and converges replays on the stored row", async () => {
    const repo = new PostgresSolidarityRepository(new FakeAllocDb());
    await repo.saveAllocation(allocation("persist-key-1"));
    const found = await repo.getAllocationByKey("persist-key-1");
    expect(found?.id).toBe("alloc-persist-key-1");

    await repo.saveAllocation({ ...allocation("persist-key-1"), id: "alloc-other" });
    const converged = await repo.getAllocationByKey("persist-key-1");
    expect(converged?.id).toBe("alloc-persist-key-1");

    expect(await repo.getAllocationByKey("missing-key")).toBeNull();
  });

  it("persists confirmations and replays across service restarts", async () => {
    const db = new FakeAllocDb();
    const repo = new PostgresSolidarityRepository(db);
    const port = repo as unknown as SolidarityRepositoryPort;

    const first = new SolidarityService(port);
    const incident = await first.createIncident({
      code: "INC-PERSIST-1",
      title: "Persist",
      description: "Persistence test",
      type: "FLOOD",
      severityLevel: "HIGH",
      geoZone: "Jijel",
      startDate: new Date().toISOString(),
      coordinatingOrgId: "ORG-001",
    });
    const need = await first.declareNeed({
      incidentId: incident.id,
      requesterId: "USER-001",
      type: "WATER",
      quantityRequired: 1000,
      urgency: "HIGH",
      affectedPeopleCount: 10,
      geoZone: "Jijel",
    });
    const donation = await first.submitDonation({
      donorId: "DONOR-001",
      donorType: "CITIZEN",
      itemType: "WATER",
      quantity: 500,
      geoZone: "Algiers",
    });
    const resource = first.getResources().find((r) => r.donationId === donation.id)!;

    const confirmed = await first.allocateResource(resource.id, need.id, 200, "persist-alloc-key");
    expect(confirmed.success).toBe(true);
    expect(db.byKey.has("persist-alloc-key")).toBe(true);

    // Fresh instance (empty memory) with the same repository: replay from ledger.
    const restarted = new SolidarityService(port);
    const replay = await restarted.allocateResource(resource.id, need.id, 200, "persist-alloc-key");
    expect(replay.success).toBe(true);
    expect(replay.alreadyProcessed).toBe(true);
    expect(replay.allocation?.id).toBe(confirmed.allocation?.id);
  });
});
