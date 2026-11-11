import { describe, it, expect } from "vitest";
import {
  assertTypeScriptNativeMigration,
  type Migration,
} from "./migration.js";
import { loadMigration, MigrationRegistry } from "./registry.js";
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
    const logger: {
      log: (m: string) => void;
      warn: (m: string) => void;
      error: (m: string) => void;
    } = {
      log: (m) => messages.push(`LOG:${m}`),
      warn: (m) => messages.push(`WARN:${m}`),
      error: (m) => messages.push(`ERROR:${m}`),
    };

    logger.log("migration started");
    logger.warn("low entropy");
    logger.error("failed");

    expect(messages).toContain("LOG:migration started");
    expect(messages).toContain("WARN:low entropy");
    expect(messages).toContain("ERROR:failed");
  });
});

// ─── C03: MigrationRuntime documented and typed ───────────────────────

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

// ─── C04: up(context) async supported contractually ───────────────────

describe("Migration.up(context) (C04)", () => {
  it("accepts an async function receiving MigrationContext", async () => {
    let received: MigrationContext | undefined;
    const migration: Migration = {
      id: "framework.core.schema.v1.001_test_async",
      checksum: "a1b2c3d4e5f6a7b8",
      resources: ["table:t"],
      up: async (context) => {
        received = context;
      },
    };

    const ctx = buildContext();
    await migration.up(ctx);
    expect(received).toBe(ctx);
    expect(received!.schema).toBeDefined();
  });

  it("accepts a sync function receiving MigrationContext", async () => {
    let called = false;
    const migration: Migration = {
      id: "framework.core.schema.v1.002_test_sync",
      checksum: "a1b2c3d4e5f6a7b8",
      resources: ["table:t"],
      up: (context) => {
        called = true;
        expect(context.schema).toBeDefined();
      },
    };

    await migration.up(buildContext());
    expect(called).toBe(true);
  });
});

// ─── C05: downMigration optional ─────────────────────────────────────

describe("Migration.downMigration (C05)", () => {
  it("is optional: migration without downMigration is valid", () => {
    const migration: Migration = {
      id: "framework.core.schema.v1.003_irreversible",
      checksum: "a1b2c3d4e5f6a7b8",
      resources: ["table:t"],
      up: async () => {},
    };

    expect(migration.downMigration).toBeUndefined();
  });

  it("can declare a downMigration function", () => {
    const migration: Migration = {
      id: "framework.core.schema.v1.004_reversible",
      checksum: "a1b2c3d4e5f6a7b8",
      resources: ["table:t"],
      up: async () => {},
      downMigration: async () => {},
    };

    expect(migration.downMigration).toBeInstanceOf(Function);
  });
});

// ─── C06: le mode SQL legacy a été retiré ─────────────────────────────

describe("SQL legacy mode removed (C06)", () => {
  it("rejette une migration déclarant 'content'", () => {
    const registry = new MigrationRegistry();

    expect(() =>
      registry.register({
        ownerId: () => "framework.core",
        migrations: () =>
          [
            {
              id: "framework.core.schema.v1.010_legacy",
              content: "CREATE TABLE legacy_table (id TEXT PRIMARY KEY);",
              resources: ["table:legacy_table"],
            },
          ] as never,
      }),
    ).toThrow(/only accepts TypeScript native migrations/);
  });

  it("rejette une migration déclarant 'down'", () => {
    const registry = new MigrationRegistry();

    expect(() =>
      registry.register({
        ownerId: () => "framework.core",
        migrations: () =>
          [
            {
              id: "framework.core.schema.v1.011_legacy_no_down",
              checksum: "a1b2c3d4e5f6a7b8",
              up: async () => {},
              down: "DROP TABLE legacy_table;",
              resources: ["table:legacy_table"],
            },
          ] as never,
      }),
    ).toThrow(/only accepts TypeScript native migrations/);
  });
});

// ─── C07: contrat natif ───────────────────────────────────────────────

describe("Native contract (C07)", () => {
  it("accepte une migration TypeScript native (up, sans content)", () => {
    const migration: Migration = {
      id: "framework.core.schema.v1.020_ts_only",
      checksum: "a1b2c3d4e5f6a7b8",
      resources: ["table:t"],
      up: async () => {},
    };

    expect(migration.up).toBeInstanceOf(Function);
    expect("content" in migration).toBe(false);
  });

  it("rejette une migration qui déclare les deux modes", () => {
    expect(() =>
      assertTypeScriptNativeMigration(
        {
          id: "framework.core.schema.v1.021_mixed",
          content: "CREATE TABLE t (id TEXT);",
          up: async () => {},
        },
        "framework.core.schema.v1.021_mixed",
      ),
    ).toThrow(/only accepts TypeScript native migrations/);
  });
});

// ─── C08: le SQL brut est refusé au chargement ───────────────────────

describe("refus du SQL brut (C08)", () => {
  it("refuse une migration déclarant un `rawSql`", () => {
    const registry = new MigrationRegistry();

    expect(() =>
      registry.register({
        ownerId: () => "bac.citadelle",
        migrations: () =>
          [
            {
              id: "bac.citadelle.identity.v1.005_raw_sql",
              checksum: "a1b2c3d4e5f6a7b8",
              up: async () => {},
              rawSql: [
                {
                  sql: "ALTER TABLE identities ADD COLUMN mfa_enabled INTEGER DEFAULT 0;",
                  params: [],
                  dialect: "sqlite",
                },
              ],
              resources: ["table:identities"],
            },
          ] as unknown as Migration[],
      }),
    ).toThrow(/TypeScript native migrations/);
  });

  it("refuse une migration déclarant un `downRawSql`", () => {
    const registry = new MigrationRegistry();

    expect(() =>
      registry.register({
        ownerId: () => "bac.citadelle",
        migrations: () =>
          [
            {
              id: "bac.citadelle.identity.v1.006_down_raw_sql",
              checksum: "a1b2c3d4e5f6a7b8",
              up: async () => {},
              downRawSql: [
                {
                  sql: "ALTER TABLE identities DROP COLUMN mfa_enabled;",
                  params: [],
                  dialect: "sqlite",
                },
              ],
              resources: ["table:identities"],
            },
          ] as unknown as Migration[],
      }),
    ).toThrow(/TypeScript native migrations/);
  });

  it("accepte une migration TypeScript native (up + downMigration)", () => {
    const registry = new MigrationRegistry();
    registry.register({
      ownerId: () => "bac.citadelle",
      migrations: () => [
        {
          id: "bac.citadelle.identity.v1.007_native",
          checksum: "a1b2c3d4e5f6a7b8",
          up: async () => {},
          downMigration: async () => {},
          resources: ["table:identities"],
        },
      ],
    });

    const migration = registry.get("bac.citadelle.identity.v1.007_native");
    expect(migration).toBeDefined();
    expect(migration!.downMigration).toBeDefined();
  });
});

// ─── C09: checksum explicite au build ────────────────────────────────

describe("Checksum explicit at build time (reserve P1)", () => {
  it("uses the explicit checksum provided at build time", () => {
    const migration = loadMigration({
      id: "bac.citadelle.identity.v1.010_checksum_explicit",
      checksum: "explicitbuildhash1234",
      resources: ["table:identities"],
      up: async () => {},
    });

    expect(migration.checksum).toBe("explicitbuildhash1234");
  });

  it("two migrations with same structure but different explicit checksums are distinct", () => {
    const migrationA = loadMigration({
      id: "bac.citadelle.identity.v1.011_checksum_a",
      checksum: "aaaaaaaaaaaaaaaa",
      resources: ["table:identities"],
      up: async () => {},
    });

    const migrationB = loadMigration({
      id: "bac.citadelle.identity.v1.011_checksum_b",
      checksum: "bbbbbbbbbbbbbbbb",
      resources: ["table:identities"],
      up: async () => {},
    });

    expect(migrationA.checksum).not.toBe(migrationB.checksum);
  });

  it("rejects a TypeScript migration without explicit checksum", () => {
    expect(() =>
      loadMigration({
        id: "bac.citadelle.identity.v1.012_no_checksum",
        resources: ["table:identities"],
        up: async () => {},
      }),
    ).toThrow(/explicit build-time checksum/);
  });
});

// ─── C10: compatibilité ascendante et collisions ──────────────────────

describe("loadMigration compatibility (C10)", () => {
  it("loads a TypeScript native raw migration", () => {
    let upCalled = false;
    const loaded = loadMigration({
      id: "bac.solara.social.v1.002_native",
      checksum: "a1b2c3d4e5f6a7b8",
      up: async () => {
        upCalled = true;
      },
      resources: ["table:solara_posts"],
    });

    expect(loaded.up).toBeInstanceOf(Function);
    expect("content" in loaded).toBe(false);
    expect(loaded.checksum).toBeDefined();

    const ctx = buildContext();
    loaded.up(ctx);
    expect(upCalled).toBe(true);
  });

  it("detects ID collision between two providers", () => {
    const registry = new MigrationRegistry();
    registry.register({
      ownerId: () => "bac.citadelle",
      migrations: () => [
        {
          id: "bac.citadelle.identity.v1.001_create_auth_tables",
          checksum: "a1b2c3d4e5f6a7b8",
          up: async () => {},
          resources: ["table:citadelle_audit_logs"],
        },
      ],
    });

    expect(() =>
      registry.register({
        ownerId: () => "bac.commerce",
        migrations: () => [
          {
            id: "bac.citadelle.identity.v1.001_create_auth_tables",
            checksum: "a1b2c3d4e5f6a7b8",
            up: async () => {},
            resources: ["table:citadelle_audit_logs"],
          },
        ],
      }),
    ).toThrow(/Migration conflict/);
  });
});
