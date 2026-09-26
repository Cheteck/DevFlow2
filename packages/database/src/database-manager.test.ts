import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { DatabaseManager, resolveDatabaseConfig } from "./database-manager";
import type { DatabasePort } from "@mosaix/ports-database";

function fakePort(): DatabasePort {
  return {
    capabilities: {
      dialect: "sqlite",
      transactions: true,
      lock: { distributed: false, processSafe: true, runtimeSafe: true },
    },
    execute: async () => 0,
    query: async <T>() => [] as T[],
    transaction: async (fn) =>
      fn({ execute: async () => 0, query: async <T>() => [] as T[] }),
    acquireMigrationLock: async () => ({ release: async () => {} }),
  };
}

describe("resolveDatabaseConfig (Laravel-style driver resolution)", () => {
  const root = path.join("C:", "proj");

  it("defaults to sqlite file under <root>/data", () => {
    const cfg = resolveDatabaseConfig({}, root);
    expect(cfg).toEqual({
      connection: "sqlite",
      database: path.join(root, "data", "mosaix.sqlite"),
    });
  });

  it("explicit DB_CONNECTION wins over URL inference", () => {
    const cfg = resolveDatabaseConfig(
      {
        dbConnection: "pgsql",
        databaseUrl: "sqlite:data/other.sqlite",
      },
      root,
    );
    expect(cfg.connection).toBe("pgsql");
  });

  it("normalizes postgres alias to pgsql", () => {
    const cfg = resolveDatabaseConfig({ dbConnection: "postgres" }, root);
    expect(cfg.connection).toBe("pgsql");
  });

  it("infers pgsql from postgres URL", () => {
    const cfg = resolveDatabaseConfig(
      { databaseUrl: "postgresql://u:p@localhost:5432/db" },
      root,
    );
    expect(cfg).toEqual({
      connection: "pgsql",
      connectionString: "postgresql://u:p@localhost:5432/db",
    });
  });

  it("builds pgsql DSN from DB_* parts when no URL", () => {
    const cfg = resolveDatabaseConfig(
      {
        dbConnection: "pgsql",
        dbHost: "db.internal",
        dbPort: 5433,
        dbUsername: "app",
        dbPassword: "s3cret",
        dbDatabase: "appdb",
      },
      root,
    );
    expect(cfg).toEqual({
      connection: "pgsql",
      connectionString: "postgresql://app:s3cret@db.internal:5433/appdb",
    });
  });

  it("resolves sqlite path (relative under root, absolute kept, memory kept)", () => {
    expect(
      resolveDatabaseConfig({ dbDatabase: "custom/app.sqlite" }, root),
    ).toEqual({
      connection: "sqlite",
      database: path.join(root, "custom/app.sqlite"),
    });
    expect(
      resolveDatabaseConfig({ databaseUrl: "sqlite::memory:" }, root),
    ).toEqual({ connection: "sqlite", database: ":memory:" });
    expect(resolveDatabaseConfig({ dbDatabase: ":memory:" }, root)).toEqual({
      connection: "sqlite",
      database: ":memory:",
    });
  });

  it("rejects unknown drivers fail-fast", () => {
    expect(() => resolveDatabaseConfig({ dbConnection: "mysql" }, root)).toThrow(
      /Unsupported DB_CONNECTION/,
    );
  });
});

describe("DatabaseManager", () => {
  it("builds sqlite connections and runs onConnect once via ready()", async () => {
    let hooks = 0;
    const manager = new DatabaseManager(
      { connection: "sqlite", database: ":memory:" },
      { sqlite: () => fakePort() },
      { onConnect: async () => void hooks++ },
    );
    const a = manager.connection();
    const b = await manager.ready();
    const c = await manager.ready();
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(hooks).toBe(1);
  });

  it("fails fast with guidance when pgsql has no driver factory", () => {
    const manager = new DatabaseManager(
      { connection: "pgsql", connectionString: "postgresql://x" },
      { sqlite: () => fakePort() },
    );
    expect(() => manager.connection()).toThrow(/requires a PostgreSQL driver/);
  });
});
