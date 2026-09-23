import { describe, expect, it } from "vitest";
import {
  SchemaBuilder,
  SQLiteGrammar,
  PostgresGrammar,
  DependencyResolver,
  MigrationRegistry,
  MigrationCLI,
  InMemoryMigrationStore,
  MigrationPlanner,
  MigrationRunner,
} from "./index";
import type { Migration } from "./index";
import type {
  DatabasePort,
  DatabaseCapabilities,
  MigrationLock,
  DatabaseConnection,
} from "@mosaix/ports-database";

function mockMigration(
  id: string,
  dependencies: readonly string[] = [],
): Migration {
  return {
    id,
    content: "CREATE TABLE dummy;",
    checksum: "hash",
    resources: [],
    dependencies,
  };
}

class FakeDatabasePort implements DatabasePort {
  readonly capabilities: DatabaseCapabilities = {
    dialect: "sqlite",
    transactions: true,
    lock: { distributed: false, processSafe: true, runtimeSafe: true },
  };
  readonly executed: string[] = [];

  async execute(sql: string): Promise<number> {
    this.executed.push(sql);
    return 1;
  }
  async query<T = Record<string, unknown>>(): Promise<T[]> {
    return [];
  }
  async transaction<T>(fn: (tx: DatabaseConnection) => Promise<T>): Promise<T> {
    return fn(this);
  }
  async acquireMigrationLock(): Promise<MigrationLock> {
    return { release: async () => {} };
  }
}

describe("SchemaBuilder DSL", () => {
  it("builds a table blueprint with various columns", () => {
    const schema = new SchemaBuilder();
    schema.createTable("users", (table) => {
      table.uuid("id").primary();
      table.string("email").nullable();
      table.integer("age").default(18);
      table.boolean("is_active").default(true);
      table.enum("role", ["admin", "user"]).default("user");
      table.json("metadata");
      table.timestamp("created_at");

      table.foreignKey("role_id", "roles", "id");
      table.index("idx_users_email", ["email"]);
      table.unique("uniq_users_id", ["id"]);
    });

    expect(schema.blueprints).toHaveLength(1);
    const bp = schema.blueprints[0];
    expect(bp?.type).toBe("createTable");
    if (bp?.type === "createTable") {
      expect(bp.table).toBe("users");
      expect(bp.columns).toHaveLength(7);
      expect(bp.columns[0]?.name).toBe("id");
      expect(bp.columns[0]?.type).toBe("uuid");
      expect(bp.columns[0]?.primary).toBe(true);

      expect(bp.columns[1]?.name).toBe("email");
      expect(bp.columns[1]?.nullable).toBe(true);

      expect(bp.columns[2]?.default).toBe(18);
      expect(bp.columns[3]?.default).toBe(true);
      expect(bp.columns[4]?.enumValues).toEqual(["admin", "user"]);

      expect(bp.foreignKeys).toHaveLength(1);
      expect(bp.foreignKeys[0]?.referencesTable).toBe("roles");

      expect(bp.indexes).toHaveLength(2);
      expect(bp.indexes[0]?.name).toBe("idx_users_email");
      expect(bp.indexes[1]?.unique).toBe(true);
    }
  });

  it("adds other alteration blueprints", () => {
    const schema = new SchemaBuilder();
    schema.dropTable("orders");
    schema.addColumn("users", "phone", "string", (col) => col.nullable());
    schema.dropColumn("users", "age");
    schema.renameColumn("users", "is_active", "active");
    schema.renameTable("users", "accounts");
    schema.createIndex("accounts", "idx_accounts_phone", ["phone"], true);

    expect(schema.blueprints).toHaveLength(6);
    expect(schema.blueprints[0]?.type).toBe("dropTable");
    expect(schema.blueprints[1]?.type).toBe("addColumn");
    expect(schema.blueprints[2]?.type).toBe("dropColumn");
    expect(schema.blueprints[3]?.type).toBe("renameColumn");
    expect(schema.blueprints[4]?.type).toBe("renameTable");
    expect(schema.blueprints[5]?.type).toBe("createIndex");
  });
});

describe("SQLiteGrammar", () => {
  const grammar = new SQLiteGrammar();

  it("compiles createTable blueprint", () => {
    const schema = new SchemaBuilder();
    schema.createTable("users", (table) => {
      table.uuid("id").primary();
      table.string("email").nullable();
      table.integer("age").default(18);
      table.boolean("is_active").default(true);
      table.enum("role", ["admin", "user"]).default("user");
      table.foreignKey("role_id", "roles", "id");
    });

    const stmts = grammar.compile(schema.blueprints[0]!);
    expect(stmts).toHaveLength(1);
    expect(stmts[0]?.sql).toContain('CREATE TABLE "users" (');
    expect(stmts[0]?.sql).toContain('"id" TEXT PRIMARY KEY NOT NULL');
    expect(stmts[0]?.sql).toContain('"email" TEXT');
    expect(stmts[0]?.sql).toContain('"age" INTEGER NOT NULL DEFAULT 18');
    expect(stmts[0]?.sql).toContain('"is_active" INTEGER NOT NULL DEFAULT 1');
    expect(stmts[0]?.sql).toContain(
      "\"role\" TEXT NOT NULL DEFAULT 'user' CHECK (\"role\" IN ('admin', 'user'))",
    );
    expect(stmts[0]?.sql).toContain(
      'FOREIGN KEY ("role_id") REFERENCES "roles" ("id")',
    );
  });

  it("compiles createIndex and table alterations", () => {
    const schema = new SchemaBuilder();
    schema.createIndex("users", "idx_users_email", ["email"], true);
    schema.dropTable("users");
    schema.addColumn("users", "phone", "string");
    schema.dropColumn("users", "phone");
    schema.renameColumn("users", "name", "full_name");
    schema.renameTable("users", "people");

    const indexStmts = grammar.compile(schema.blueprints[0]!);
    expect(indexStmts).toHaveLength(1);
    expect(indexStmts[0]?.sql).toBe(
      'CREATE UNIQUE INDEX "idx_users_email" ON "users" ("email");',
    );

    const dropTableStmts = grammar.compile(schema.blueprints[1]!);
    expect(dropTableStmts[0]?.sql).toBe('DROP TABLE "users";');

    const addColStmts = grammar.compile(schema.blueprints[2]!);
    expect(addColStmts[0]?.sql).toBe(
      'ALTER TABLE "users" ADD COLUMN "phone" TEXT NOT NULL;',
    );

    const dropColStmts = grammar.compile(schema.blueprints[3]!);
    expect(dropColStmts[0]?.sql).toBe(
      'ALTER TABLE "users" DROP COLUMN "phone";',
    );

    const renameColStmts = grammar.compile(schema.blueprints[4]!);
    expect(renameColStmts[0]?.sql).toBe(
      'ALTER TABLE "users" RENAME COLUMN "name" TO "full_name";',
    );

    const renameTableStmts = grammar.compile(schema.blueprints[5]!);
    expect(renameTableStmts[0]?.sql).toBe(
      'ALTER TABLE "users" RENAME TO "people";',
    );
  });
});

describe("PostgresGrammar", () => {
  const grammar = new PostgresGrammar();

  it("compiles createTable blueprint", () => {
    const schema = new SchemaBuilder();
    schema.createTable("users", (table) => {
      table.uuid("id").primary();
      table.string("email").nullable();
      table.integer("age").default(18);
      table.boolean("is_active").default(true);
      table.enum("role", ["admin", "user"]).default("user");
      table.foreignKey("role_id", "roles", "id");
    });

    const stmts = grammar.compile(schema.blueprints[0]!);
    expect(stmts).toHaveLength(1);
    expect(stmts[0]?.sql).toContain('CREATE TABLE "users" (');
    expect(stmts[0]?.sql).toContain('"id" UUID PRIMARY KEY NOT NULL');
    expect(stmts[0]?.sql).toContain('"email" VARCHAR(255)');
    expect(stmts[0]?.sql).toContain('"age" INTEGER NOT NULL DEFAULT 18');
    expect(stmts[0]?.sql).toContain(
      '"is_active" BOOLEAN NOT NULL DEFAULT TRUE',
    );
    expect(stmts[0]?.sql).toContain(
      "\"role\" VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (\"role\" IN ('admin', 'user'))",
    );
    expect(stmts[0]?.sql).toContain(
      'CONSTRAINT "fk_users_role_id" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE',
    );
  });

  it("compiles createIndex and table alterations", () => {
    const schema = new SchemaBuilder();
    schema.createIndex("users", "idx_users_email", ["email"], true);
    schema.dropTable("users");
    schema.addColumn("users", "phone", "string");
    schema.dropColumn("users", "phone");
    schema.renameColumn("users", "name", "full_name");
    schema.renameTable("users", "people");

    const indexStmts = grammar.compile(schema.blueprints[0]!);
    expect(indexStmts).toHaveLength(1);
    expect(indexStmts[0]?.sql).toBe(
      'CREATE UNIQUE INDEX "idx_users_email" ON "users" ("email");',
    );

    const dropTableStmts = grammar.compile(schema.blueprints[1]!);
    expect(dropTableStmts[0]?.sql).toBe('DROP TABLE "users" CASCADE;');

    const addColStmts = grammar.compile(schema.blueprints[2]!);
    expect(addColStmts[0]?.sql).toBe(
      'ALTER TABLE "users" ADD COLUMN "phone" VARCHAR(255) NOT NULL;',
    );

    const dropColStmts = grammar.compile(schema.blueprints[3]!);
    expect(dropColStmts[0]?.sql).toBe(
      'ALTER TABLE "users" DROP COLUMN "phone";',
    );

    const renameColStmts = grammar.compile(schema.blueprints[4]!);
    expect(renameColStmts[0]?.sql).toBe(
      'ALTER TABLE "users" RENAME COLUMN "name" TO "full_name";',
    );

    const renameTableStmts = grammar.compile(schema.blueprints[5]!);
    expect(renameTableStmts[0]?.sql).toBe(
      'ALTER TABLE "users" RENAME TO "people";',
    );
  });
});

describe("DependencyResolver (Phase 6 DAG & Global Ordonnancement R10)", () => {
  it("sorts independent migrations numerically and prioritizes framework (R10)", () => {
    const m1 = mockMigration("app.sales.v1.001_base");
    const m2 = mockMigration("framework.core.v1.002_base");
    const m3 = mockMigration("framework.core.v1.001_bootstrap");

    const sorted = DependencyResolver.resolve([m1, m2, m3]);
    expect(sorted.map((m) => m.id)).toEqual([
      "framework.core.v1.001_bootstrap",
      "framework.core.v1.002_base",
      "app.sales.v1.001_base",
    ]);
  });

  it("resolves basic linear dependency path", () => {
    const m1 = mockMigration("app.sales.v1.001_base", [
      "framework.core.v1.001_bootstrap",
    ]);
    const m2 = mockMigration("framework.core.v1.001_bootstrap");

    const sorted = DependencyResolver.resolve([m1, m2]);
    expect(sorted.map((m) => m.id)).toEqual([
      "framework.core.v1.001_bootstrap",
      "app.sales.v1.001_base",
    ]);
  });

  it("throws on circular dependencies", () => {
    const m1 = mockMigration("app.A.v1.001_a", ["app.B.v1.001_b"]);
    const m2 = mockMigration("app.B.v1.001_b", ["app.A.v1.001_a"]);

    expect(() => DependencyResolver.resolve([m1, m2])).toThrow(
      "Circular dependency detected",
    );
  });
});

describe("MigrationCLI (Phase 5 CLI command handlers)", () => {
  it("generates SQL template via static create() method", () => {
    const created = MigrationCLI.create(
      "framework",
      "database",
      "v1",
      101,
      "create_users",
    );
    expect(created.id).toBe("framework.database.v1.101_create_users");
    expect(created.content).toContain(
      "-- Migration: framework.database.v1.101_create_users",
    );
  });

  it("handles migrate, status, and rollback flows", async () => {
    const registry = new MigrationRegistry();
    registry.register({
      ownerId: () => "mosaix",
      migrations: () => [
        {
          id: "mosaix.core.v1.001_base",
          content: "CREATE TABLE mosaix_core;",
          resources: [],
        },
      ],
    });

    const store = new InMemoryMigrationStore();
    const db = new FakeDatabasePort();
    const cli = new MigrationCLI(registry, store, db);

    // Initial status
    let status = await cli.status();
    expect(status).toHaveLength(1);
    expect(status[0]?.applied).toBe(false);

    // Migrate
    const migrationRes = await cli.migrate();
    expect(migrationRes.applied).toEqual(["mosaix.core.v1.001_base"]);
    expect(db.executed).toEqual(["CREATE TABLE mosaix_core;"]);

    // Post-migrate status
    status = await cli.status();
    expect(status[0]?.applied).toBe(true);

    // Rollback
    const rollbackRes = await cli.rollback();
    expect(rollbackRes.rolledBack).toEqual([]);
  });
});

describe("MigrationRunner (Phase 7 Production Hardening - dry-run & preview)", () => {
  it("generates SQL previews of a plan without executing (previewSQL)", async () => {
    const registry = new MigrationRegistry();
    registry.register({
      ownerId: () => "mosaix",
      migrations: () => [
        {
          id: "mosaix.core.v1.001_base",
          content: "CREATE TABLE t1;",
          down: "DROP TABLE t1;",
          resources: [],
        },
      ],
    });
    const store = new InMemoryMigrationStore();
    const planner = new MigrationPlanner(registry, store);
    const db = new FakeDatabasePort();
    const runner = new MigrationRunner(db, store);

    const plan = await planner.plan();
    const preview = await runner.previewSQL(plan);
    expect(preview).toHaveLength(1);
    expect(preview[0]?.id).toBe("mosaix.core.v1.001_base");
    expect(preview[0]?.sql).toBe("CREATE TABLE t1;");
  });

  it("executes the plan in dry-run mode without mutating state or acquiring locks", async () => {
    const registry = new MigrationRegistry();
    registry.register({
      ownerId: () => "mosaix",
      migrations: () => [
        {
          id: "mosaix.core.v1.001_base",
          content: "CREATE TABLE t1;",
          down: "DROP TABLE t1;",
          resources: [],
        },
      ],
    });
    const store = new InMemoryMigrationStore();
    const planner = new MigrationPlanner(registry, store);
    const db = new FakeDatabasePort();
    const runner = new MigrationRunner(db, store);

    const plan = await planner.plan();
    const result = await runner.run(plan, { dryRun: true });

    expect(result.applied).toEqual(["mosaix.core.v1.001_base"]);
    expect(db.executed).toEqual([]);
    expect(await store.list()).toEqual([]);

    expect(result.logs).toBeDefined();
    expect(result.logs![0]).toContain("Starting dry-run");
    expect(result.logs![1]).toContain("CREATE TABLE t1;");
    expect(result.logs![2]).toContain("Dry-run completed successfully");
  });
});
