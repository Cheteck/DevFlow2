/**
 * @tests/production/migrations-concurrency.e2e.test.ts — P0-3 / R02
 * Verifies concurrent migration lock protection and applied migration checksum immutability.
 */
import { describe, expect, it } from "vitest";
import {
  computeChecksum,
  InMemoryMigrationStore,
  MigrationChecksumError,
  MigrationLockError,
  MigrationPlanner,
  MigrationRegistry,
  MigrationRunner,
} from "@mosaix/migrations";
import type {
  DatabaseCapabilities,
  DatabasePort,
  MigrationContext,
  MigrationLock,
} from "@mosaix/migrations";

class ConcurrentMockDatabasePort implements DatabasePort {
  readonly capabilities: DatabaseCapabilities = {
    dialect: "sqlite",
    transactions: true,
    lock: { distributed: true, processSafe: true, runtimeSafe: true },
  };
  private static globalLock = false;

  async execute(): Promise<number> {
    return 1;
  }
  async query<T = Record<string, unknown>>(): Promise<T[]> {
    return [];
  }
  async transaction<T>(fn: (tx: DatabasePort) => Promise<T>): Promise<T> {
    return fn(this);
  }
  async acquireMigrationLock(): Promise<MigrationLock> {
    if (ConcurrentMockDatabasePort.globalLock) {
      throw new MigrationLockError(
        "Migration lock is held by another process/instance",
      );
    }
    ConcurrentMockDatabasePort.globalLock = true;
    return {
      release: async () => {
        ConcurrentMockDatabasePort.globalLock = false;
      },
    };
  }

  static resetLock(): void {
    ConcurrentMockDatabasePort.globalLock = false;
  }
}

describe("Migration Engine Safeguards (P0-3 / R02)", () => {
  /** TypeScript native migration: the DDL is declared with the DSL. */
  function nativeMigration(
    id: string,
    sql: string,
    resources: readonly string[],
  ) {
    const table = resources[0]?.replace(/^table:/, "") ?? "test_lock";
    return {
      id,
      checksum: computeChecksum(sql),
      resources,
      up: (context: MigrationContext) => {
        context.schema.createTable(table, (t) => {
          t.string("id").primary();
        });
      },
    };
  }

  it("prevents concurrent migration execution (double instance lock collision)", async () => {
    ConcurrentMockDatabasePort.resetLock();
    const store = new InMemoryMigrationStore();

    const registry = new MigrationRegistry();
    registry.register(
      {
        ownerId: () => "mosaix",
        migrations: () => [
          nativeMigration(
            "mosaix.core.v1.001_test",
            "CREATE TABLE test_lock (id INT);",
            ["table:test_lock"],
          ),
        ],
      },
      0,
    );

    const instance1Db = new ConcurrentMockDatabasePort();
    const instance2Db = new ConcurrentMockDatabasePort();

    const runner1 = new MigrationRunner(instance1Db, store);
    const runner2 = new MigrationRunner(instance2Db, store);

    const plan = await new MigrationPlanner(registry, store).plan();

    // Acquire lock with Instance 1
    const lock1 = await instance1Db.acquireMigrationLock();

    // Instance 2 attempts to run and should fail fast with MigrationLockError
    await expect(runner2.run(plan)).rejects.toThrow(MigrationLockError);

    // Release lock from Instance 1
    await lock1.release();

    // Now Instance 2 can acquire and run
    const result = await runner2.run(plan);
    expect(result.applied).toEqual(["mosaix.core.v1.001_test"]);
  });

  it("detects migration file tampering (checksum mismatch guard MIG-IMMUT-01)", async () => {
    ConcurrentMockDatabasePort.resetLock();
    const store = new InMemoryMigrationStore();

    const originalMigration = nativeMigration(
      "mosaix.core.v1.001_schema",
      "CREATE TABLE schema_v1 (id INT);",
      ["table:schema_v1"],
    );

    const registry1 = new MigrationRegistry();
    registry1.register(
      { ownerId: () => "mosaix", migrations: () => [originalMigration] },
      0,
    );

    const db = new ConcurrentMockDatabasePort();
    const runner = new MigrationRunner(db, store);
    const plan1 = await new MigrationPlanner(registry1, store).plan();
    await runner.run(plan1);

    // Verify migration is stored with expected checksum
    const recorded = await store.get("mosaix.core.v1.001_schema");
    expect(recorded?.checksum).toBe(originalMigration.checksum);

    // Tamper with migration content (simulating file modification after deploy)
    const tamperedMigration = nativeMigration(
      "mosaix.core.v1.001_schema",
      "CREATE TABLE schema_v1 (id INT, tampered_column TEXT);",
      ["table:schema_v1"],
    );

    const registry2 = new MigrationRegistry();
    registry2.register(
      { ownerId: () => "mosaix", migrations: () => [tamperedMigration] },
      0,
    );

    // Planning should fail fast due to checksum mismatch
    await expect(new MigrationPlanner(registry2, store).plan()).rejects.toThrow(
      MigrationChecksumError,
    );
  });
});
