/**
 * @mosaix/migrations — MigrationContext contract tests (Phase 03).
 *
 * Validates the new native TypeScript migration contracts:
 * - MigrationContext, MigrationLogger, MigrationRuntime
 * - Migration.up(context) / down(context)? / rawSql
 * - Backward compatibility with SQL legacy migrations
 * - Mutual exclusivity of SQL and TypeScript modes
 */

import { describe, it, expect } from "vitest";
import { computeChecksum } from "./checksum.js";
import {
  loadMigration,
  MigrationRegistry,
} from "./registry.js";
import type { Migration } from "./migration.js";
import type { MigrationContext } from "./migration-context.js";
import { SchemaBuilder } from "./schema-builder.js";

// ─── Helpers ──────────────────────────────────────────────────────────

function buildContext(): MigrationContext {
  return {
    schema: new SchemaBuilder(),
    database: {
      execute: async () => 0,
      query: async () => [],
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
    runtime: {
      dialect: "sqlite",
      capabilities: {
        transactions: true,
        lock: { distributed: false, processSafe: true, runtimeSafe: true },
      },
    },
  };
}

// ─── C01: MigrationContext entirely typed ─────────────────────────────

describe("MigrationContext (C01)", () => {
  it("exposes schema, database, logger, runtime as typed properties", () => {
    const ctx = buildContext();

    expect(ctx.schema).toBeDefined();
    expect(ctx.schema.createTable).toBeInstanceOf(Function);
    expect(ctx.database).toBeDefined();
    expect(ctx.database.execute).toBeInstanceOf(Function);
    expect(ctx.database.query).toBeInstanceOf(Function);
    expect(ctx.logger).toBeDefined();
    expect(ctx.logger.log).toBeInstanceOf(Function);
    expect(ctx.logger.warn).toBeInstanceOf(Function);
    expect(ctx.logger.error).toBeInstanceOf(Function);
    expect(ctx.runtime).toBeDefined();
    expect(ctx.runtime.dialect).toBe("sqlite");
    expect(ctx.runtime.capabilities.transactions).toBe(true);
  });
});

// ─── C02: MigrationLogger independent of implementation ───────────────

describe("MigrationLogger (C02)", () => {
  it("can be implemented with any logging backend", () => {
    const messages: string[] = [];
    const logger: { log: (m: string) => void; warn: (m: string) => void; error: (m: string) => void } = {
      log: (m) => messages.push("LOG:" + m),
      warn: (m) => messages.push("WARN:" + m),
      error: (m) => messages.push("ERR:" + m),
    };

    logger.log("migration started");
    logger.warn("low entropy");
    logger.error("failed");

    expect(messages).toContain("LOG:migration started");
    expect(messages).toContain("WARN:low entropy");
    expect(messages).toContain("ERR:failed");
  });
});

// ─── C03: MigrationRuntime documented and typed ──────────────────────

describe("MigrationRuntime (C03)", () => {
  it("declares dialect and capabilities", () => {
    const ctx = buildContext();
    expect(typeof ctx.runtime.dialect).toBe("string");
    expect(typeof ctx.runtime.capabilities.transactions).toBe("boolean");
    expect(typeof ctx.runtime.capabilities.lock.distributed).toBe("boolean");
    expect(typeof ctx.runtime.capabilities.lock.processSafe).toBe("boolean");
    expect(typeof ctx.runtime.capabilities.lock.runtimeSafe).toBe("boolean");
  });
});

// ─── C04: up(context) async supported contractually ──────────────────

describe("Migration.up(context) (C04)", () => {
  it("accepts an async function receiving MigrationContext", async () => {
    let received: MigrationContext | undefined;
    const migration: Migration = {
      id: "framework.core.schema.v1.001_test_async",
      checksum: "abc",
      resources: [],
      kind: "typescript",
      up: async (context) => {
        received = context;
      },
    };

    const ctx = buildContext();
    await migration.up!(ctx);
    expect(received).toBe(ctx);
    expect(received!.schema).toBeDefined();
  });

  it("accepts a sync function receiving MigrationContext", async () => {
    let called = false;
    const migration: Migration = {
      id: "framework.core.schema.v1.002_test_sync",
      checksum: "def",
      resources: [],
      kind: "typescript",
      up: (context) => {
        called = true;
        expect(context.schema).toBeDefined();
      },
    };

    await migration.up!(buildContext());
    expect(called).toBe(true);
  });
});

// ─── C05: down(context) optional ─────────────────────────────────────

describe("Migration.downMigration (C05)", () => {
  it("is optional: migration without downMigration is valid", () => {
    const migration: Migration = {
      id: "framework.core.schema.v1.003_irreversible",
      checksum: "ghi",
      resources: [],
      kind: "typescript",
      up: async () => {},
    };

    expect(migration.downMigration).toBeUndefined();
  });

  it("can declare a downMigration function", () => {
    const migration: Migration = {
      id: "framework.core.schema.v1.004_reversible",
      checksum: "jkl",
      resources: [],
      kind: "typescript",
      up: async () => {},
      downMigration: async () => {},
    };

    expect(migration.downMigration).toBeInstanceOf(Function);
  });
});

// ─── C06: Legacy SQL migrations always valid ─────────────────────────

describe("Legacy SQL migration (C06)", () => {
  it("content string migration loads without up/down functions", () => {
    const registry = new MigrationRegistry();
    registry.register({
      ownerId: () => "framework.core",
      migrations: () => [
        {
          id: "framework.core.schema.v1.010_legacy",
          content: "CREATE TABLE legacy_table (id TEXT PRIMARY KEY);",
          down: "DROP TABLE legacy_table;",
          resources: ["table:legacy_table"],
        },
      ],
    });

    const migration = registry.get("framework.core.schema.v1.010_legacy");
    expect(migration).toBeDefined();
    expect(migration!.kind).toBe("sql");
    expect(migration!.content).toBe("CREATE TABLE legacy_table (id TEXT PRIMARY KEY);");
    expect(migration!.down).toBe("DROP TABLE legacy_table;");
    expect(migration!.up).toBeUndefined();
  });

  it("legacy migration with no down is valid", () => {
    const registry = new MigrationRegistry();
    registry.register({
      ownerId: () => "framework.core",
      migrations: () => [
        {
          id: "framework.core.schema.v1.011_legacy_no_down",
          content: "CREATE TABLE t (id TEXT);",
          resources: ["table:t"],
        },
      ],
    });

    const migration = registry.get("framework.core.schema.v1.011_legacy_no_down");
    expect(migration!.down).toBeUndefined();
  });
});

// ─── C07: TypeScript and SQL modes mutually exclusive ────────────────

describe("Mutual exclusivity (C07)", () => {
  it("TypeScript migration declares up but no content", () => {
    const migration: Migration = {
      id: "framework.core.schema.v1.020_ts_only",
      checksum: "mno",
      resources: [],
      kind: "typescript",
      up: async () => {},
    };

    expect(migration.kind).toBe("typescript");
    expect(migration.up).toBeInstanceOf(Function);
    expect(migration.content).toBeUndefined();
  });

  it("SQL migration declares content but no up", () => {
    const migration: Migration = {
      id: "framework.core.schema.v1.021_sql_only",
      checksum: "pqr",
      resources: [],
      kind: "sql",
      content: "CREATE TABLE t (id TEXT);",
    };

    expect(migration.kind).toBe("sql");
    expect(migration.content).toBe("CREATE TABLE t (id TEXT);");
    expect(migration.up).toBeUndefined();
  });
});

// ─── C08: rawSql explicitly declared ─────────────────────────────────

describe("rawSql declaration (C08)", () => {
  it("rawSql is optional and explicitly declared", () => {
    const registry = new MigrationRegistry();
    registry.register({
      ownerId: () => "bac.citadelle",
      migrations: () => [
        {
          id: "bac.citadelle.identity.v1.005_raw_sql",
          kind: "typescript",
          checksum: "a1b2c3d4e5f6a7b8",
          up: async () => {},
          rawSql: {
            sql: "ALTER TABLE identities ADD COLUMN mfa_enabled INTEGER DEFAULT 0;",
            params: [],
            dialect: "sqlite",
          },
          resources: ["table:identities"],
        },
      ],
    });

    const migration = registry.get("bac.citadelle.identity.v1.005_raw_sql");
    expect(migration!.rawSql).toBeDefined();
    expect(migration!.rawSql!.dialect).toBe("sqlite");
    expect(migration!.rawSql!.sql).toContain("ALTER TABLE");
  });
});

// ─── C09: No historical ID modification ──────────────────────────────

describe("Checksum explicit at build time (reserve P1)", () => {
  it("uses the explicit checksum provided at build time", () => {
    const migration = loadMigration({
      id: "bac.citadelle.identity.v1.010_checksum_explicit",
      kind: "typescript",
      checksum: "explicit-build-hash-1234",
      resources: ["table:identities"],
      up: async () => {},
    });

    expect(migration.checksum).toBe("explicit-build-hash-1234");
  });

  it("two migrations with same structure but different explicit checksums are distinct", () => {
    const migrationA = loadMigration({
      id: "bac.citadelle.identity.v1.011_checksum_a",
      kind: "typescript",
      checksum: "hash-a",
      resources: ["table:identities"],
      up: async () => {},
    });

    const migrationB = loadMigration({
      id: "bac.citadelle.identity.v1.011_checksum_b",
      kind: "typescript",
      checksum: "hash-b",
      resources: ["table:identities"],
      up: async () => {},
    });

    expect(migrationA.checksum).not.toBe(migrationB.checksum);
  });

  it("legacy SQL migration without explicit checksum computes from content", () => {
    const migration = loadMigration({
      id: "bac.citadelle.identity.v1.012_legacy_checksum",
      content: "CREATE TABLE t (id TEXT);",
      resources: ["table:t"],
    });

    expect(migration.checksum).toBe(computeChecksum("CREATE TABLE t (id TEXT);"));
  });
});

// ─── C09: No historical ID modification ──────────────────────────────

describe("Historical IDs preserved (C09)", () => {
  it("canonical BAC IDs are unchanged", () => {
    const registry = new MigrationRegistry();
    registry.register({
      ownerId: () => "bac.citadelle",
      migrations: () => [
        {
          id: "bac.citadelle.identity.v1.001_create_auth_tables",
          content: "CREATE TABLE citadelle_audit_logs (id TEXT PRIMARY KEY);",
          resources: ["table:citadelle_audit_logs"],
        },
      ],
    });

    const migration = registry.get("bac.citadelle.identity.v1.001_create_auth_tables");
    expect(migration!.id).toBe("bac.citadelle.identity.v1.001_create_auth_tables");
  });
});

// ─── C10: Compilation and compatibility tests ────────────────────────

describe("loadMigration compatibility (C10)", () => {
  it("loads a legacy SQL raw migration", () => {
    const loaded = loadMigration({
      id: "bac.solara.social.v1.001_legacy",
      content: "CREATE TABLE solara_posts (id TEXT PRIMARY KEY);",
      down: "DROP TABLE solara_posts;",
      resources: ["table:solara_posts"],
    });

    expect(loaded.kind).toBe("sql");
    expect(loaded.content).toBe("CREATE TABLE solara_posts (id TEXT PRIMARY KEY);");
    expect(loaded.down).toBe("DROP TABLE solara_posts;");
    expect(loaded.up).toBeUndefined();
    expect(loaded.checksum).toBeDefined();
  });

  it("loads a TypeScript native raw migration", () => {
    let upCalled = false;
    const loaded = loadMigration({
      id: "bac.solara.social.v1.002_native",
      kind: "typescript",
      checksum: "a1b2c3d4e5f6a7b8",
      up: async () => {
        upCalled = true;
      },
      resources: ["table:solara_posts"],
    });

    expect(loaded.kind).toBe("typescript");
    expect(loaded.up).toBeInstanceOf(Function);
    expect(loaded.content).toBeUndefined();
    expect(loaded.checksum).toBeDefined();

    // Execute the function to confirm it works
    const ctx = buildContext();
    loaded.up!(ctx);
    expect(upCalled).toBe(true);
  });

  it("detects ID collision between two providers", () => {
    const registry = new MigrationRegistry();
    registry.register({
      ownerId: () => "bac.citadelle",
      migrations: () => [
        {
          id: "bac.citadelle.identity.v1.001_create_auth_tables",
          content: "CREATE TABLE t (id TEXT);",
          resources: ["table:t"],
        },
      ],
    });

    expect(() => registry.register({
      ownerId: () => "bac.commerce",
      migrations: () => [
        {
          id: "bac.citadelle.identity.v1.001_create_auth_tables",
          content: "CREATE TABLE t2 (id TEXT);",
          resources: ["table:t2"],
        },
      ],
    })).toThrow(/Migration conflict/);
  });
});