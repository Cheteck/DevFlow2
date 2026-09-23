import { describe, expect, it } from "vitest";
import {
  MigrationPlanner,
  MigrationRegistry,
  MigrationRunner,
  InMemoryMigrationStore,
} from "@mosaix/migrations";
import { SQLiteDatabaseAdapter } from "./index";

function rawMigration(
  id: string,
  content: string,
  resources: readonly string[] = [],
) {
  return { id, content, resources };
}

describe("SQLite adapter — Phase 0 validation (create table via full pipeline)", () => {
  it("creates a table only through the complete pipeline", async () => {
    const registry = new MigrationRegistry();
    registry.register(
      {
        ownerId: () => "identity",
        migrations: () => [
          rawMigration(
            "identity.users.v1.001_create_users",
            "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL);",
            ["table:users"],
          ),
        ],
      },
      0,
    );

    const store = new InMemoryMigrationStore();
    const db = new SQLiteDatabaseAdapter();
    const runner = new MigrationRunner(db, store);

    const plan = await new MigrationPlanner(registry, store).plan();
    const result = await runner.run(plan);

    expect(result.applied).toEqual(["identity.users.v1.001_create_users"]);

    // The table must be reachable through the same adapter.
    const rows = await db.query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'",
    );
    expect(rows).toEqual([{ name: "users" }]);

    const columns = await db.query("PRAGMA table_info(users)");
    expect(columns.map((c) => (c as { name: string }).name)).toEqual([
      "id",
      "email",
    ]);

    db.close();
  });

  it("re-runs after a partial failure without corrupting the store (idempotence at Runner level)", async () => {
    const registry = new MigrationRegistry();
    registry.register(
      {
        ownerId: () => "mosaix",
        migrations: () => [
          rawMigration(
            "mosaix.core.v1.001_base",
            "CREATE TABLE core (id INTEGER PRIMARY KEY);",
            ["table:core"],
          ),
          rawMigration(
            "mosaix.core.v1.002_seed",
            "INSERT INTO core (id) VALUES (1);",
            [],
          ),
        ],
      },
      0,
    );

    const store = new InMemoryMigrationStore();
    const db = new SQLiteDatabaseAdapter();
    const runner = new MigrationRunner(db, store);

    // First run: applies both.
    const plan1 = await new MigrationPlanner(registry, store).plan();
    const result1 = await runner.run(plan1);
    expect(result1.applied).toHaveLength(2);

    // Second run: the planner must compute an empty plan (both applied).
    const plan2 = await new MigrationPlanner(registry, store).plan();
    expect(plan2.operations).toEqual([]);

    db.close();
  });

  it("holds the exclusive lock across the whole plan (process-safe, R3)", async () => {
    const db = new SQLiteDatabaseAdapter();
    const lock = await db.acquireMigrationLock();
    expect(db.capabilities.lock).toEqual({
      distributed: false,
      processSafe: true,
      runtimeSafe: true,
    });
    await lock.release();
    db.close();
  });

  it("commits a successful transaction() and rolls back a failed one (PRD §26)", async () => {
    const db = new SQLiteDatabaseAdapter();

    await db.transaction(async (tx) => {
      await tx.execute("CREATE TABLE committed_t (id INTEGER PRIMARY KEY);");
    });

    await expect(
      db.transaction(async (tx) => {
        await tx.execute("CREATE TABLE doomed (id INTEGER PRIMARY KEY);");
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const tables = await db.query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('committed_t', 'doomed')",
    );
    expect(tables).toEqual([{ name: "committed_t" }]);
    db.close();
  });

  it("nests transaction() inside the migration lock via SAVEPOINT (T-MIG-1)", async () => {
    const db = new SQLiteDatabaseAdapter();
    const lock = await db.acquireMigrationLock();

    await db.transaction(async (tx) => {
      await tx.execute(
        "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT);",
      );
    });
    // First savepoint committed; a second one rolls back independently.
    await expect(
      db.transaction(async (tx) => {
        await tx.execute("CREATE TABLE ghost (id INTEGER PRIMARY KEY);");
        throw new Error("nested boom");
      }),
    ).rejects.toThrow("nested boom");

    await lock.release();

    const rows = await db.query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users', 'ghost')",
    );
    expect(rows).toEqual([{ name: "users" }]);
    db.close();
  });

  it("rolls back a failed pipeline run leaving the store and schema consistent (PRD §32)", async () => {
    const registry = new MigrationRegistry();
    registry.register(
      {
        ownerId: () => "identity",
        migrations: () => [
          rawMigration(
            "identity.users.v1.001_create_users",
            "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL);",
            ["table:users"],
          ),
          rawMigration(
            "identity.users.v1.002_bad",
            "INSERT INTO missing_table (id) VALUES (1);",
            [],
          ),
        ],
      },
      0,
    );

    const store = new InMemoryMigrationStore();
    const db = new SQLiteDatabaseAdapter();
    const runner = new MigrationRunner(db, store);

    const plan = await new MigrationPlanner(registry, store).plan();
    await expect(runner.run(plan)).rejects.toThrow();

    // First migration committed, second rolled back: store reflects only 001.
    expect((await store.list()).map((e) => e.id)).toEqual([
      "identity.users.v1.001_create_users",
    ]);
    // Schema: users exists, the failed migration created nothing.
    const tables = await db.query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'",
    );
    expect(tables).toEqual([{ name: "users" }]);
    db.close();
  });

  it("supports mock SQLiteDriver injection (T-MIG-3)", async () => {
    const executed: string[] = [];
    const mockDriver = {
      execute: async (sql: string) => {
        executed.push(sql);
        return 0;
      },
      query: async <T>() => [] as T[],
      begin: async () => {
        executed.push("BEGIN");
      },
      commit: async () => {
        executed.push("COMMIT");
      },
      rollback: async () => {
        executed.push("ROLLBACK");
      },
    };

    const db = new SQLiteDatabaseAdapter(mockDriver);
    await db.execute("CREATE TABLE mock_t;");
    await db.transaction(async (tx) => {
      await tx.execute("INSERT;");
    });

    expect(executed).toEqual([
      "CREATE TABLE mock_t;",
      "BEGIN",
      "INSERT;",
      "COMMIT",
    ]);
  });
});
