/**
 * @mosaix/migrations — MigrationCompiler tests (Phase 04).
 *
 * Tests de compilation des migrations TypeScript natives en SqlStatement[]
 * via la Grammar.
 */

import { describe, it, expect } from "vitest";
import { MigrationCompiler } from "./compiler.js";
import { SQLiteGrammar, PostgresGrammar } from "./grammar.js";
import type { Migration } from "./migration.js";
import type { MigrationRuntime } from "./migration-context.js";

function testRuntime(): MigrationRuntime {
  return {
    dialect: "sqlite",
    capabilities: {
      transactions: true,
      lock: { distributed: false, processSafe: true, runtimeSafe: true },
    },
  };
}

function testRuntimePostgres(): MigrationRuntime {
  return {
    dialect: "postgres",
    capabilities: {
      transactions: true,
      lock: { distributed: false, processSafe: true, runtimeSafe: true },
    },
  };
}

function tsMigration(overrides: Partial<Migration> = {}): Migration {
  return {
    id: "bac.citadelle.identity.v1.001_create_users",
    checksum: "build-hash-1234",
    kind: "typescript",
    resources: ["table:users"],
    up: async () => {},
    ...overrides,
  };
}

function sqlMigration(overrides: Partial<Migration> = {}): Migration {
  return {
    id: "bac.citadelle.identity.v1.001_create_users",
    checksum: "abc",
    kind: "sql",
    resources: ["table:users"],
    content: "CREATE TABLE users (id TEXT PRIMARY KEY);",
    ...overrides,
  };
}

// ─── Compilation SQLite ───

describe("Compiler — SQLite", () => {
  const compiler = new MigrationCompiler(
    new SQLiteGrammar(),
    "sqlite",
    testRuntime(),
  );

  it("compile une migration TypeScript avec createTable", async () => {
    const migration: Migration = {
      ...tsMigration(),
      up: async (context) => {
        context.schema.createTable("users", (table) => {
          table.string("id").primary();
          table.string("email");
        });
      },
    };

    const result = await compiler.compileUpAsync(migration);

    expect(result.migrationId).toBe("bac.citadelle.identity.v1.001_create_users");
    expect(result.dialect).toBe("sqlite");
    expect(result.statements.length).toBeGreaterThan(0);
    expect(result.statements[0]!.sql).toContain('CREATE TABLE "users"');
  });

  it("compile une migration SQL legacy tel quel", () => {
    const migration = sqlMigration();
    const result = compiler.compileSql(migration);

    expect(result.statements).toHaveLength(1);
    expect(result.statements[0]!.sql).toBe("CREATE TABLE users (id TEXT PRIMARY KEY);");
    expect(result.statements[0]!.params).toEqual([]);
  });

  it("rejette une migration SQL legacy avec compileUp", () => {
    const migration = sqlMigration();

    expect(() => compiler.compileUp(migration)).toThrow(
      /TypeScript native/,
    );
  });

  it("rejette une migration TypeScript sans up", () => {
    const migration: Migration = {
      ...tsMigration(),
      up: undefined,
    };

    expect(() => compiler.compileUp(migration)).toThrow(/fonction up\(\)/);
  });
});

// ─── Compilation PostgreSQL ───

describe("Compiler — PostgreSQL", () => {
  const compiler = new MigrationCompiler(
    new PostgresGrammar(),
    "postgres",
    testRuntimePostgres(),
  );

  it("compile une migration TypeScript avec UUID et TIMESTAMP", async () => {
    const migration: Migration = {
      ...tsMigration(),
      up: async (context) => {
        context.schema.createTable("users", (table) => {
          table.uuid("id").primary();
          table.timestamp("created_at");
        });
      },
    };

    const result = await compiler.compileUpAsync(migration);

    expect(result.dialect).toBe("postgres");
    const sql = result.statements[0]!.sql;
    expect(sql).toContain('"id" UUID');
    expect(sql).toContain('"created_at" TIMESTAMP WITH TIME ZONE');
  });
});

// ─── downMigration ───

describe("Compiler — downMigration (rollback)", () => {
  const compiler = new MigrationCompiler(
    new SQLiteGrammar(),
    "sqlite",
    testRuntime(),
  );

  it("compile downMigration quand présente", async () => {
    const migration: Migration = {
      ...tsMigration(),
      up: async (context) => {
        context.schema.createTable("users", (table) => {
          table.string("id").primary();
        });
      },
      downMigration: async (context) => {
        context.schema.dropTable("users");
      },
    };

    const result = await compiler.compileDownAsync(migration);

    expect(result).toBeDefined();
    expect(result!.statements[0]!.sql).toContain('DROP TABLE "users"');
  });

  it("retourne undefined quand pas de downMigration (migration irréversible)", async () => {
    const migration: Migration = {
      ...tsMigration(),
      up: async (context) => {
        context.schema.createTable("users", (table) => {
          table.string("id").primary();
        });
      },
      downMigration: undefined,
    };

    const result = await compiler.compileDownAsync(migration);

    expect(result).toBeUndefined();
  });
});

// ─── up() async ───

describe("Compiler — async up()", () => {
  const compiler = new MigrationCompiler(
    new SQLiteGrammar(),
    "sqlite",
    testRuntime(),
  );

  it("compileUpAsync attend la promise d'up()", async () => {
    let upExecuted = false;
    const migration: Migration = {
      ...tsMigration(),
      up: async (context) => {
        upExecuted = true;
        context.schema.createTable("users", (table) => {
          table.string("id").primary();
        });
      },
    };

    const result = await compiler.compileUpAsync(migration);

    expect(upExecuted).toBe(true);
    expect(result.statements.length).toBeGreaterThan(0);
  });

  it("compileUp (sync) rejette une up() async", () => {
    const migration: Migration = {
      ...tsMigration(),
      up: async () => {},
    };

    expect(() => compiler.compileUp(migration)).toThrow(/Promise/);
  });
});

// ─── rawSql dans le chemin canonique (compileUpAsync) ───

describe("Compiler — rawSql integration", () => {
  const compiler = new MigrationCompiler(
    new SQLiteGrammar(),
    "sqlite",
    testRuntime(),
  );

  it("compileUpAsync retourne les blueprints et rawSql", async () => {
    const migration: Migration = {
      ...tsMigration(),
      resources: ["table:users", "table:audit_log"],
      up: async (context) => {
        context.schema.createTable("users", (table) => {
          table.string("id").primary();
        });
      },
      rawSql: {
        sql: "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
        params: [],
        dialect: "both",
        resources: ["table:audit_log"],
      },
    };

    const result = await compiler.compileUpAsync(migration);

    expect(result.statements.length).toBeGreaterThan(0);
    // La dernière statement doit être le rawSql
    const lastStmt = result.statements[result.statements.length - 1]!;
    expect(lastStmt.sql).toContain("CREATE EXTENSION");
  });

  it("migration sans rawSql conserve son comportement", async () => {
    const migration: Migration = {
      ...tsMigration(),
      up: async (context) => {
        context.schema.createTable("users", (table) => {
          table.string("id").primary();
        });
      },
    };

    const result = await compiler.compileUpAsync(migration);

    expect(result.statements.length).toBeGreaterThan(0);
    expect(result.dialect).toBe("sqlite");
  });

  it("instructions rawSql après les blueprints (ordre contractuel)", async () => {
    const migration: Migration = {
      ...tsMigration(),
      resources: ["table:users"],
      up: async (context) => {
        context.schema.createTable("users", (table) => {
          table.string("id").primary();
        });
      },
      rawSql: {
        sql: "ALTER TABLE users ADD COLUMN name TEXT;",
        params: [],
        dialect: "both",
        resources: ["table:users"],
      },
    };

    const result = await compiler.compileUpAsync(migration);

    // Le rawSql doit être après les blueprints du SchemaBuilder
    const createTableStmt = result.statements.find((s) =>
      s.sql.toUpperCase().includes("CREATE TABLE"),
    );
    const alterStmt = result.statements.find((s) =>
      s.sql.toUpperCase().includes("ALTER TABLE"),
    );
    expect(createTableStmt).toBeDefined();
    expect(alterStmt).toBeDefined();
    const createIdx = result.statements.indexOf(createTableStmt!);
    const alterIdx = result.statements.indexOf(alterStmt!);
    expect(alterIdx).toBeGreaterThan(createIdx);
  });

  it("chemin synchrone et asynchrone produisent le même résultat", async () => {
    const migration: Migration = {
      ...tsMigration(),
      up: (context) => {
        context.schema.createTable("users", (table) => {
          table.string("id").primary();
        });
      },
      rawSql: {
        sql: "ALTER TABLE users ADD COLUMN name TEXT;",
        params: [],
        dialect: "both",
        resources: ["table:users"],
      },
    };

    const syncResult = compiler.compileUp(migration);
    const asyncResult = await compiler.compileUpAsync(migration);

    expect(syncResult.statements.length).toBe(asyncResult.statements.length);
    for (let i = 0; i < syncResult.statements.length; i++) {
      expect(syncResult.statements[i]!.sql).toBe(
        asyncResult.statements[i]!.sql,
      );
    }
    expect(syncResult.dialect).toBe(asyncResult.dialect);
  });
});

// ─── Cohérence des dialectes ───

describe("Compiler — dialect consistency", () => {
  function makeCompiler(
    dialect: "sqlite" | "postgres",
  ): MigrationCompiler {
    return new MigrationCompiler(
      dialect === "sqlite" ? new SQLiteGrammar() : new PostgresGrammar(),
      dialect,
      dialect === "sqlite" ? testRuntime() : testRuntimePostgres(),
    );
  }

  it("Compiler PostgreSQL + rawSql PostgreSQL : accepté", async () => {
    const compiler = makeCompiler("postgres");
    const migration: Migration = {
      ...tsMigration(),
      kind: "typescript",
      resources: ["table:users"],
      up: async () => {},
      rawSql: {
        sql: "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
        params: [],
        dialect: "postgres",
        resources: ["table:users"],
      },
    };

    const result = await compiler.compileUpAsync(migration);
    expect(result.dialect).toBe("postgres");
  });

  it("Compiler SQLite + rawSql SQLite : accepté", async () => {
    const compiler = makeCompiler("sqlite");
    const migration: Migration = {
      ...tsMigration(),
      kind: "typescript",
      resources: ["table:users"],
      up: async () => {},
      rawSql: {
        sql: "ALTER TABLE users ADD COLUMN name TEXT;",
        params: [],
        dialect: "sqlite",
        resources: ["table:users"],
      },
    };

    const result = await compiler.compileUpAsync(migration);
    expect(result.dialect).toBe("sqlite");
  });

  it("Compiler PostgreSQL + rawSql SQLite : rejeté", async () => {
    const compiler = makeCompiler("postgres");
    const migration: Migration = {
      ...tsMigration(),
      kind: "typescript",
      resources: ["table:users"],
      up: async () => {},
      rawSql: {
        sql: "ALTER TABLE users ADD COLUMN name TEXT;",
        params: [],
        dialect: "sqlite",
        resources: ["table:users"],
      },
    };

    await expect(compiler.compileUpAsync(migration)).rejects.toThrow(/dialect/);
  });

  it("Compiler SQLite + rawSql PostgreSQL : rejeté", async () => {
    const compiler = makeCompiler("sqlite");
    const migration: Migration = {
      ...tsMigration(),
      kind: "typescript",
      resources: ["table:users"],
      up: async () => {},
      rawSql: {
        sql: "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
        params: [],
        dialect: "postgres",
        resources: ["table:users"],
      },
    };

    await expect(compiler.compileUpAsync(migration)).rejects.toThrow(/dialect/);
  });

  it("rawSql dialect 'both' accepté par les deux compilateurs", async () => {
    const migration: Migration = {
      ...tsMigration(),
      kind: "typescript",
      resources: ["table:users"],
      up: async () => {},
      rawSql: {
        sql: "ALTER TABLE users ADD COLUMN name TEXT;",
        params: [],
        dialect: "both",
        resources: ["table:users"],
      },
    };

    const sqliteCompiler = makeCompiler("sqlite");
    const sqliteResult = await sqliteCompiler.compileUpAsync(migration);
    expect(sqliteResult.dialect).toBe("sqlite");

    const postgresCompiler = makeCompiler("postgres");
    const postgresResult = await postgresCompiler.compileUpAsync(migration);
    expect(postgresResult.dialect).toBe("postgres");
  });

  it("Compiler rejette un dialecte de Grammar incohérent", () => {
    expect(() => {
      new MigrationCompiler(
        new SQLiteGrammar(),
        "postgres", // dialect incompatible avec SQLiteGrammar
        testRuntimePostgres(),
      );
    }).toThrow(/incohérence de dialecte/);
  });

  it("Compiler rejette un dialecte de Runtime incohérent", () => {
    expect(() => {
      new MigrationCompiler(
        new SQLiteGrammar(),
        "sqlite",
        testRuntimePostgres(), // runtime postgres incompatible avec dialect sqlite
      );
    }).toThrow(/incohérence de dialecte/);
  });
});