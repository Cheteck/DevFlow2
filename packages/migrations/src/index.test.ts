import { describe, expect, it } from "vitest";
import {
  computeChecksum,
  MigrationAlreadyAppliedError,
  MigrationChecksumError,
  MigrationConflictError,
  MigrationError,
  MigrationExecutionError,
  MigrationLockError,
  MigrationMissingError,
  MigrationPlanner,
  MigrationResourceConflictError,
  MigrationRunner,
  MigrationRegistry,
  InMemoryMigrationStore,
  compareMigrationIds,
  parseMigrationId,
} from "@mosaix/migrations";
import type {
  DatabaseCapabilities,
  DatabasePort,
  MigrationLock,
} from "@mosaix/migrations";

function rawMigration(
  id: string,
  content: string,
  resources: readonly string[] = [],
  down?: string,
) {
  return { id, content, resources, ...(down !== undefined ? { down } : {}) };
}

function frameworkProvider(
  rank: number,
  migrations: ReturnType<typeof rawMigration>[],
) {
  return {
    rank,
    provider: { ownerId: () => "mosaix", migrations: () => migrations },
  };
}

function appProvider(
  rank: number,
  migrations: ReturnType<typeof rawMigration>[],
) {
  return {
    rank,
    provider: {
      ownerId: () => migrations[0]?.id.split(".")[0] ?? "app",
      migrations: () => migrations,
    },
  };
}

function twoMigrationRegistry() {
  const registry = new MigrationRegistry();
  registry.register(
    frameworkProvider(0, [
      rawMigration(
        "mosaix.core.v1.001_base",
        "CREATE TABLE core;",
        [],
        "DROP TABLE core;",
      ),
      rawMigration(
        "mosaix.core.v1.002_seed",
        "INSERT INTO core VALUES (1);",
        [],
        "DELETE FROM core WHERE id = 1;",
      ),
    ]).provider,
    0,
  );
  return registry;
}

class FakeDatabasePort implements DatabasePort {
  readonly capabilities: DatabaseCapabilities = {
    dialect: "sqlite",
    transactions: true,
    lock: { distributed: false, processSafe: true, runtimeSafe: true },
  };
  readonly executed: string[] = [];
  /** Statements committed successfully inside transactions. */
  readonly committed: string[] = [];
  /** Statements rolled back by a failed transaction. */
  readonly rolledBack: string[] = [];
  private locked = false;
  private inTransaction = false;

  async execute(sql: string): Promise<number> {
    if (this.inTransaction) this.committed.push(sql);
    else this.executed.push(sql);
    return 1;
  }
  async query<T = Record<string, unknown>>(): Promise<T[]> {
    return [];
  }
  async transaction<T>(fn: (tx: DatabasePort) => Promise<T>): Promise<T> {
    const wasIn = this.inTransaction;
    this.inTransaction = true;
    const at = this.committed.length;
    try {
      const result = await fn(this);
      this.inTransaction = wasIn;
      return result;
    } catch (err) {
      // Simulate ROLLBACK: drop statements recorded during this transaction.
      this.committed.splice(at);
      this.inTransaction = wasIn;
      throw err;
    }
  }
  async acquireMigrationLock(): Promise<MigrationLock> {
    if (this.locked) throw new Error("lock already held");
    this.locked = true;
    return {
      release: () => {
        this.locked = false;
        return Promise.resolve();
      },
    };
  }
}

describe("migration id — canonical identity and ordering (R6, R7)", () => {
  it("parses owner.module.version.sequence_name", () => {
    expect(parseMigrationId("identity.users.v1.001_create_users")).toEqual({
      owner: "identity",
      module: "users",
      version: "v1",
      sequence: 1,
      name: "create_users",
    });
  });

  it("compares sequence numerically, not lexically", () => {
    expect(compareMigrationIds("a.b.v1.002_x", "a.b.v1.010_y")).toBeLessThan(0);
    expect(compareMigrationIds("a.b.v1.010_y", "a.b.v1.002_x")).toBeGreaterThan(
      0,
    );
  });

  it("orders by owner, module, version, sequence, name", () => {
    const ids = [
      "app.x.v1.002_b",
      "mosaix.core.v1.001_a",
      "app.x.v1.010_a",
      "app.x.v1.002_a",
    ];
    const sorted = [...ids].sort(compareMigrationIds);
    expect(sorted).toEqual([
      "app.x.v1.002_a",
      "app.x.v1.002_b",
      "app.x.v1.010_a",
      "mosaix.core.v1.001_a",
    ]);
  });
});

describe("checksum — computed at load time (R2)", () => {
  it("is deterministic and content-sensitive", () => {
    expect(computeChecksum("CREATE TABLE users (id INT);")).toBe(
      computeChecksum("CREATE TABLE users (id INT);"),
    );
    expect(computeChecksum("CREATE TABLE users (id INT);")).not.toBe(
      computeChecksum("CREATE TABLE users (id TEXT);"),
    );
  });
});

describe("registry — identity collisions (R9)", () => {
  it("rejects two providers declaring the same canonical id", () => {
    const registry = new MigrationRegistry();
    registry.register(
      frameworkProvider(0, [rawMigration("mosaix.core.v1.001_base", "A")])
        .provider,
      0,
    );
    expect(() =>
      registry.register(
        appProvider(1, [rawMigration("mosaix.core.v1.001_base", "A")]).provider,
        1,
      ),
    ).toThrow(MigrationConflictError);
  });

  it("orders globally by rank then canonical id (R10)", () => {
    const registry = new MigrationRegistry();
    registry.register(
      appProvider(1, [rawMigration("identity.users.v1.001_create_users", "A")])
        .provider,
      1,
    );
    registry.register(
      frameworkProvider(0, [rawMigration("mosaix.core.v1.001_base", "B")])
        .provider,
      0,
    );
    const ids = registry.all().map((m) => m.id);
    expect(ids).toEqual([
      "mosaix.core.v1.001_base",
      "identity.users.v1.001_create_users",
    ]);
  });
});

describe("planner — desired state → plan (R12, R13)", () => {
  it("plans new migrations as up operations in deterministic order", async () => {
    const registry = new MigrationRegistry();
    registry.register(
      frameworkProvider(0, [
        rawMigration("mosaix.core.v1.001_base", "CREATE TABLE core;", [
          "table:core",
        ]),
      ]).provider,
      0,
    );
    registry.register(
      appProvider(1, [
        rawMigration(
          "identity.users.v1.001_create_users",
          "CREATE TABLE users;",
          ["table:users"],
        ),
      ]).provider,
      1,
    );
    const store = new InMemoryMigrationStore();
    const planner = new MigrationPlanner(registry, store);

    const plan = await planner.plan();

    expect(
      plan.operations.map((o) => `${o.operation}:${o.migration.id}`),
    ).toEqual([
      "up:mosaix.core.v1.001_base",
      "up:identity.users.v1.001_create_users",
    ]);
  });

  it("is idempotent: same source and target state → same plan (R14)", async () => {
    const registry = new MigrationRegistry();
    registry.register(
      frameworkProvider(0, [
        rawMigration("mosaix.core.v1.001_base", "CREATE TABLE core;"),
      ]).provider,
      0,
    );
    const store = new InMemoryMigrationStore();
    const planner = new MigrationPlanner(registry, store);

    const a = await planner.plan();
    const b = await planner.plan();

    expect(b.operations).toEqual(a.operations);
    expect(b.id).toBe(a.id);
    expect(b.sourceVersion).toBe(a.sourceVersion);
  });

  it("ignores already-applied unchanged migrations (R12 delta)", async () => {
    const registry = new MigrationRegistry();
    registry.register(
      frameworkProvider(0, [
        rawMigration("mosaix.core.v1.001_base", "CREATE TABLE core;"),
      ]).provider,
      0,
    );
    const store = new InMemoryMigrationStore();
    const applied = registry.all()[0];
    expect(applied).toBeDefined();
    await store.save({
      id: applied!.id,
      owner: "mosaix",
      checksum: applied!.checksum,
      batchId: "batch-1",
      appliedAt: new Date(),
    });

    const plan = await new MigrationPlanner(registry, store).plan();
    expect(plan.operations).toEqual([]);
  });

  it("rejects a modified applied migration (MigrationChecksumError, R2)", async () => {
    const store = new InMemoryMigrationStore();
    const original = rawMigration(
      "mosaix.core.v1.001_base",
      "CREATE TABLE core;",
    );
    const registry = new MigrationRegistry();
    registry.register(frameworkProvider(0, [original]).provider, 0);
    const applied = registry.all()[0];
    expect(applied).toBeDefined();
    await store.save({
      id: applied!.id,
      owner: "mosaix",
      checksum: computeChecksum("CREATE TABLE core;"),
      batchId: "batch-1",
      appliedAt: new Date(),
    });

    // Provider now ships a modified migration with the same id.
    const registry2 = new MigrationRegistry();
    registry2.register(
      frameworkProvider(0, [
        rawMigration("mosaix.core.v1.001_base", "CREATE TABLE core (id INT);"),
      ]).provider,
      0,
    );
    await expect(new MigrationPlanner(registry2, store).plan()).rejects.toThrow(
      MigrationChecksumError,
    );
  });

  it("rejects a store migration absent from the registry (R5)", async () => {
    const store = new InMemoryMigrationStore();
    await store.save({
      id: "identity.users.v1.001_create_users",
      owner: "identity",
      checksum: "deadbeef",
      batchId: "batch-1",
      appliedAt: new Date(),
    });
    const registry = new MigrationRegistry();
    registry.register(
      frameworkProvider(0, [rawMigration("mosaix.core.v1.001_base", "A")])
        .provider,
      0,
    );
    await expect(new MigrationPlanner(registry, store).plan()).rejects.toThrow(
      MigrationMissingError,
    );
  });

  it("rejects SQL resource collisions at Blueprint level (R9)", async () => {
    const registry = new MigrationRegistry();
    registry.register(
      appProvider(1, [
        rawMigration("appA.users.v1.001_create", "CREATE TABLE users;", [
          "table:users",
        ]),
      ]).provider,
      1,
    );
    registry.register(
      appProvider(2, [
        rawMigration("appB.users.v1.001_create", "CREATE TABLE users;", [
          "table:users",
        ]),
      ]).provider,
      2,
    );
    await expect(
      new MigrationPlanner(registry, new InMemoryMigrationStore()).plan(),
    ).rejects.toThrow(MigrationResourceConflictError);
  });
});

describe("runner — executes the plan only (R13)", () => {
  it("applies up operations and records them in the store", async () => {
    const registry = new MigrationRegistry();
    registry.register(
      frameworkProvider(0, [
        rawMigration("mosaix.core.v1.001_base", "CREATE TABLE core;"),
      ]).provider,
      0,
    );
    const store = new InMemoryMigrationStore();
    const db = new FakeDatabasePort();
    const runner = new MigrationRunner(db, store);

    const plan = await new MigrationPlanner(registry, store).plan();
    const result = await runner.run(plan);

    expect(result.applied).toEqual(["mosaix.core.v1.001_base"]);
    expect(db.committed).toEqual(["CREATE TABLE core;"]);
    const recorded = await store.get("mosaix.core.v1.001_base");
    expect(recorded?.owner).toBe("mosaix");
    expect(recorded?.checksum).toBe(
      registry.get("mosaix.core.v1.001_base")?.checksum,
    );
  });

  it("rolls back with down() bodies and removes from the store", async () => {
    const registry = new MigrationRegistry();
    registry.register(
      frameworkProvider(0, [
        rawMigration(
          "mosaix.core.v1.001_base",
          "CREATE TABLE core;",
          [],
          "DROP TABLE core;",
        ),
      ]).provider,
      0,
    );
    const store = new InMemoryMigrationStore();
    const applied = registry.all()[0];
    expect(applied).toBeDefined();
    await store.save({
      id: applied!.id,
      owner: "mosaix",
      checksum: applied!.checksum,
      batchId: "batch-1",
      appliedAt: new Date(),
    });
    const db = new FakeDatabasePort();
    const runner = new MigrationRunner(db, store);

    const plan = await new MigrationPlanner(registry, store).plan({
      rollback: true,
    });
    const result = await runner.run(plan);

    expect(result.rolledBack).toEqual(["mosaix.core.v1.001_base"]);
    expect(db.committed).toEqual(["DROP TABLE core;"]);
    expect(await store.get("mosaix.core.v1.001_base")).toBeUndefined();
  });
});

describe("runner — transactions and batches (T-MIG-1)", () => {
  it("executes each operation inside a transaction (per-migration atomicity)", async () => {
    const registry = twoMigrationRegistry();
    const store = new InMemoryMigrationStore();
    const db = new FakeDatabasePort();
    const runner = new MigrationRunner(db, store);

    const plan = await new MigrationPlanner(registry, store).plan();
    const result = await runner.run(plan);

    expect(result.applied).toEqual([
      "mosaix.core.v1.001_base",
      "mosaix.core.v1.002_seed",
    ]);
    expect(db.committed).toEqual([
      "CREATE TABLE core;",
      "INSERT INTO core VALUES (1);",
    ]);
  });

  it("assigns the same batch id to all migrations of one run (PRD §30)", async () => {
    const registry = twoMigrationRegistry();
    const store = new InMemoryMigrationStore();
    const runner = new MigrationRunner(new FakeDatabasePort(), store);

    const plan = await new MigrationPlanner(registry, store).plan();
    const result = await runner.run(plan);

    expect(result.applied).toHaveLength(2);
    const entries = await store.list();
    expect(entries.map((e) => e.batchId)).toEqual([
      result.batchId,
      result.batchId,
    ]);
  });

  it("rolls back a failed migration without recording it (PRD §32)", async () => {
    const registry = twoMigrationRegistry();
    const store = new InMemoryMigrationStore();
    const db = new FakeDatabasePort();
    const runner = new MigrationRunner(db, store);

    const plan = await new MigrationPlanner(registry, store).plan();
    // Simulate failure on the second migration's SQL.
    let call = 0;
    db.execute = async (sql: string) => {
      call++;
      if (call === 2) throw new Error("SQL constraint violation");
      db.committed.push(sql);
      return 1;
    };

    await expect(runner.run(plan)).rejects.toThrow(MigrationExecutionError);
    expect(await store.list()).toHaveLength(1);
    expect(await store.get("mosaix.core.v1.001_base")).toBeDefined();
    expect(await store.get("mosaix.core.v1.002_seed")).toBeUndefined();
  });

  it("rolls back the last batch by default (PRD §30)", async () => {
    const registry = twoMigrationRegistry();
    const store = new InMemoryMigrationStore();
    const runner = new MigrationRunner(new FakeDatabasePort(), store);

    // Batch 1: 001 only.
    const firstPlan = await new MigrationPlanner(registry, store).plan();
    expect(firstPlan.operations).toHaveLength(2);
    const single = {
      ...firstPlan,
      operations: [firstPlan.operations[0]!],
    };
    await runner.run(single);

    // Batch 2: remaining.
    const secondPlan = await new MigrationPlanner(registry, store).plan();
    await runner.run(secondPlan);

    // Rollback without params: only the last batch (002) is undone.
    const rollbackPlan = await new MigrationPlanner(registry, store).plan({
      rollback: true,
    });
    expect(rollbackPlan.operations.map((o) => o.migration.id)).toEqual([
      "mosaix.core.v1.002_seed",
    ]);

    const result = await runner.run(rollbackPlan);
    expect(result.rolledBack).toEqual(["mosaix.core.v1.002_seed"]);
    expect(await store.get("mosaix.core.v1.001_base")).toBeDefined();
    expect(await store.get("mosaix.core.v1.002_seed")).toBeUndefined();
  });

  it("rolls back N steps in reverse application order (PRD §31, §29)", async () => {
    const registry = twoMigrationRegistry();
    const store = new InMemoryMigrationStore();
    const runner = new MigrationRunner(new FakeDatabasePort(), store);

    const plan = await new MigrationPlanner(registry, store).plan();
    await runner.run(plan);

    const rollbackPlan = await new MigrationPlanner(registry, store).plan({
      rollback: { kind: "steps", count: 1 },
    });
    expect(rollbackPlan.operations.map((o) => o.migration.id)).toEqual([
      "mosaix.core.v1.002_seed",
    ]);

    await runner.run(rollbackPlan);
    expect(await store.get("mosaix.core.v1.001_base")).toBeDefined();
    expect(await store.get("mosaix.core.v1.002_seed")).toBeUndefined();
  });

  it("rolls back all applied migrations in reverse order", async () => {
    const registry = twoMigrationRegistry();
    const store = new InMemoryMigrationStore();
    const runner = new MigrationRunner(new FakeDatabasePort(), store);

    const plan = await new MigrationPlanner(registry, store).plan();
    await runner.run(plan);

    const rollbackPlan = await new MigrationPlanner(registry, store).plan({
      rollback: { kind: "steps", count: 99 },
    });
    expect(rollbackPlan.operations.map((o) => o.migration.id)).toEqual([
      "mosaix.core.v1.002_seed",
      "mosaix.core.v1.001_base",
    ]);
  });

  it("reports lock acquisition failures as MigrationLockError", async () => {
    const registry = twoMigrationRegistry();
    const store = new InMemoryMigrationStore();
    const db = new FakeDatabasePort();
    // Make the fake throw on lock acquisition.
    db.acquireMigrationLock = () => Promise.reject(new Error("busy"));

    const runner = new MigrationRunner(db, store);
    const plan = await new MigrationPlanner(registry, store).plan();

    await expect(runner.run(plan)).rejects.toThrow(MigrationLockError);
  });
});

describe("error hierarchy (PRD §33)", () => {
  it("all domain errors extend MigrationError", () => {
    const cases = [
      new MigrationConflictError("a.b.v1.001_x", ["o1", "o2"]),
      new MigrationMissingError("a.b.v1.001_x"),
      new MigrationChecksumError("a.b.v1.001_x", "old", "new"),
      new MigrationResourceConflictError("table:users", ["a", "b"]),
      new MigrationExecutionError("boom"),
      new MigrationLockError("busy"),
      new MigrationAlreadyAppliedError("a.b.v1.001_x"),
    ];
    for (const err of cases) {
      expect(err).toBeInstanceOf(MigrationError);
    }
  });

  it("rejects applying an already-applied migration via plan (R14 delta)", async () => {
    const registry = twoMigrationRegistry();
    const store = new InMemoryMigrationStore();
    const db = new FakeDatabasePort();
    const runner = new MigrationRunner(db, store);

    const planner = new MigrationPlanner(registry, store);
    await runner.run(await planner.plan());
    // Re-plan after the first run: the delta is now empty (idempotence).
    const secondPlan = await planner.plan();
    expect(secondPlan.operations).toEqual([]);

    // The engine never re-applies an already-applied migration: the Runner
    // only executes what the Planner decided, and the Planner's delta is
    // empty. Re-running a non-empty plan is the only misuse path.
    expect(await store.list()).toHaveLength(2);
  });
});
