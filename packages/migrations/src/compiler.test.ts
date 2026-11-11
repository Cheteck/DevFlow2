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
    checksum: "a1b2c3d4e5f6a7b8",
    resources: ["table:users"],
    up: async () => {},
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

    expect(result.migrationId).toBe(
      "bac.citadelle.identity.v1.001_create_users",
    );
    expect(result.dialect).toBe("sqlite");
    expect(result.statements.length).toBeGreaterThan(0);
    expect(result.statements[0]!.sql).toContain('CREATE TABLE "users"');
  });

  it("rejette une migration sans up()", () => {
    const migration = {
      ...tsMigration(),
      up: undefined,
    } as unknown as Migration;

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

// ─── Le SQL brut est refusé (règle inscrite dans le code) ───

describe("Compiler — refus du SQL brut", () => {
  const compiler = new MigrationCompiler(
    new SQLiteGrammar(),
    "sqlite",
    testRuntime(),
  );

  it("refuse une migration déclarant un `rawSql`", async () => {
    const migration = {
      ...tsMigration(),
      up: async () => {},
      rawSql: [
        {
          sql: "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
          params: [],
          dialect: "both",
        },
      ],
    } as unknown as Migration;

    await expect(compiler.compileUpAsync(migration)).rejects.toThrow(
      /TypeScript native migrations/,
    );
  });

  it("refuse une migration déclarant un `downRawSql`", async () => {
    const migration = {
      ...tsMigration(),
      up: async () => {},
      downMigration: async () => {},
      downRawSql: [{ sql: "DROP TABLE users;", params: [], dialect: "both" }],
    } as unknown as Migration;

    await expect(compiler.compileDownAsync(migration)).rejects.toThrow(
      /TypeScript native migrations/,
    );
  });

  it("refuse une migration déclarant l'ancien champ `content`", async () => {
    const migration = {
      ...tsMigration(),
      content: "CREATE TABLE users (id TEXT);",
      up: async () => {},
    } as unknown as Migration;

    await expect(compiler.compileUpAsync(migration)).rejects.toThrow(
      /TypeScript native migrations/,
    );
  });
});

// ─── Le DSL produit les instructions (chemin canonique) ───

describe("Compiler — DSL et data API", () => {
  const compiler = new MigrationCompiler(
    new SQLiteGrammar(),
    "sqlite",
    testRuntime(),
  );

  it("compileUpAsync compile les blueprints du SchemaBuilder", async () => {
    const migration: Migration = {
      ...tsMigration(),
      resources: ["table:users", "table:audit_log"],
      up: async (context) => {
        context.schema.createTable("users", (table) => {
          table.string("id").primary();
        });
      },
    };

    const result = await compiler.compileUpAsync(migration);

    expect(result.statements.length).toBeGreaterThan(0);
    expect(result.statements[0]!.sql).toContain("CREATE TABLE");
  });

  it("compileUpAsync compile les instructions de données (context.data)", async () => {
    const migration: Migration = {
      ...tsMigration(),
      resources: ["table:audit_log"],
      up: async (context) => {
        context.data.insert("audit_log", { id: "1", action: "login" });
      },
    };

    const result = await compiler.compileUpAsync(migration);

    expect(result.statements.length).toBe(1);
    expect(result.statements[0]!.sql).toContain("INSERT INTO");
    expect(result.statements[0]!.params).toEqual(["1", "login"]);
  });

  it("les instructions de données suivent les blueprints (ordre contractuel)", async () => {
    const migration: Migration = {
      ...tsMigration(),
      resources: ["table:users"],
      up: async (context) => {
        context.schema.createTable("users", (table) => {
          table.string("id").primary();
        });
        context.schema.addColumn("users", "name", "string");
      },
    };

    const result = await compiler.compileUpAsync(migration);

    const createTableStmt = result.statements.find((s) =>
      s.sql.toUpperCase().includes("CREATE TABLE"),
    );
    const alterStmt = result.statements.find((s) =>
      s.sql.toUpperCase().includes("ALTER TABLE"),
    );
    expect(createTableStmt).toBeDefined();
    expect(alterStmt).toBeDefined();
    expect(result.statements.indexOf(alterStmt!)).toBeGreaterThan(
      result.statements.indexOf(createTableStmt!),
    );
  });

  it("chemin synchrone et asynchrone produisent le même résultat", async () => {
    const migration: Migration = {
      ...tsMigration(),
      up: (context) => {
        context.schema.createTable("users", (table) => {
          table.string("id").primary();
        });
        context.schema.addColumn("users", "name", "string");
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
  function makeCompiler(dialect: "sqlite" | "postgres"): MigrationCompiler {
    return new MigrationCompiler(
      dialect === "sqlite" ? new SQLiteGrammar() : new PostgresGrammar(),
      dialect,
      dialect === "sqlite" ? testRuntime() : testRuntimePostgres(),
    );
  }

  it("Compiler PostgreSQL + DSL PostgreSQL : accepté", async () => {
    const compiler = makeCompiler("postgres");
    const migration: Migration = {
      ...tsMigration(),
      resources: ["table:users"],
      up: async (context) => {
        context.schema.createTable("users", (table) => {
          table.string("id").primary();
        });
      },
    };

    const result = await compiler.compileUpAsync(migration);
    expect(result.dialect).toBe("postgres");
    expect(result.statements[0]!.sql).toContain("VARCHAR(255)");
  });

  it("Compiler SQLite + DSL SQLite : accepté", async () => {
    const compiler = makeCompiler("sqlite");
    const migration: Migration = {
      ...tsMigration(),
      resources: ["table:users"],
      up: async (context) => {
        context.schema.createTable("users", (table) => {
          table.string("id").primary();
        });
      },
    };

    const result = await compiler.compileUpAsync(migration);
    expect(result.dialect).toBe("sqlite");
    expect(result.statements[0]!.sql).toContain("TEXT");
  });

  it("un blueprint PostgreSQL-only est refusé sur SQLite", async () => {
    const compiler = makeCompiler("sqlite");
    const migration: Migration = {
      ...tsMigration(),
      resources: ["table:users"],
      up: async (context) => {
        context.schema.createTable("users", (table) => {
          table.string("id").primary();
        });
        context.schema.createSchema("commerce");
      },
    };

    await expect(compiler.compileUpAsync(migration)).rejects.toThrow(
      /Unsupported blueprint type on sqlite/,
    );
  });

  it("un blueprint PostgreSQL-only est accepté sur PostgreSQL", async () => {
    const compiler = makeCompiler("postgres");
    const migration: Migration = {
      ...tsMigration(),
      resources: ["table:users"],
      up: async (context) => {
        context.schema.createSchema("commerce");
      },
    };

    const result = await compiler.compileUpAsync(migration);
    expect(result.dialect).toBe("postgres");
    expect(result.statements[0]!.sql).toContain("CREATE SCHEMA");
  });

  it("une migration à dialecte non-SQL est refusée par les deux compilateurs", async () => {
    const migration = {
      ...tsMigration(),
      resources: ["table:users"],
      up: async () => {},
      rawSql: [
        {
          sql: "ALTER TABLE users ADD COLUMN name TEXT;",
          params: [],
          dialect: "sqlite",
        },
      ],
    } as unknown as Migration;

    const sqliteCompiler = makeCompiler("sqlite");
    await expect(sqliteCompiler.compileUpAsync(migration)).rejects.toThrow(
      /TypeScript native migrations/,
    );

    const postgresCompiler = makeCompiler("postgres");
    await expect(postgresCompiler.compileUpAsync(migration)).rejects.toThrow(
      /TypeScript native migrations/,
    );
  });

  it("le DSL est accepté par les deux compilateurs", async () => {
    const migration: Migration = {
      ...tsMigration(),
      resources: ["table:users"],
      up: async (context) => {
        context.schema.createTable("users", (table) => {
          table.string("id").primary();
        });
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
