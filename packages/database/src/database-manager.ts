/**
 * @mosaix/database — DatabaseManager (Laravel-style `config/database.php`).
 *
 * Single source of truth for *which* driver backs `DatabasePort`:
 * - `resolveDatabaseConfig()` maps env (DB_CONNECTION, DB_*, DATABASE_URL)
 *   to a concrete connection config. Precedence: explicit DB_CONNECTION >
 *   URL-scheme inference > `sqlite` default (dev-friendly).
 * - `DatabaseManager` holds named connections and builds them through
 *   injected driver factories — this package never imports a concrete
 *   adapter, so ports stay decoupled from drivers (composition root injects
 *   `SQLiteDatabaseAdapter`, `PostgresDatabaseAdapter`, or fakes in tests).
 *
 * Doctrine: migrations/seeders run from the CLI (`mosaix migrate`,
 * `mosaix db:seed`). The boot path only connects + verifies.
 */

import * as path from "node:path";
import type { DatabasePort } from "@mosaix/ports-database";

export type DatabaseDriver = "sqlite" | "pgsql";

export interface SqliteConnectionConfig {
  readonly connection: "sqlite";
  /** File path, or `:memory:` for tests. Relative paths resolve under rootDir. */
  readonly database: string;
}

export interface PgsqlConnectionConfig {
  readonly connection: "pgsql";
  readonly connectionString: string;
}

export type DatabaseConfig = SqliteConnectionConfig | PgsqlConnectionConfig;

export interface DatabaseConfigInput {
  readonly dbConnection?: string;
  readonly databaseUrl?: string;
  readonly dbDatabase?: string;
  readonly dbHost?: string;
  readonly dbPort?: string | number;
  readonly dbUsername?: string;
  readonly dbPassword?: string;
}

export interface DatabaseDriverFactories {
  /** Build a SQLite port for a resolved file path (or `:memory:`). */
  readonly sqlite: (databasePath: string) => DatabasePort;
  /**
   * Build a PostgreSQL port for a connection string. Optional: without it,
   * `pgsql` connections fail fast with wiring guidance (needs a `pg`
   * client — see `@mosaix/adapter-database-postgres` `PgClient`).
   */
  readonly pgsql?: (connectionString: string) => DatabasePort;
}

export interface DatabaseManagerHooks {
  /** Runs once per connection after build (e.g. SQLite PRAGMAs). Awaited by `ready()`. */
  readonly onConnect?: (
    db: DatabasePort,
    config: DatabaseConfig,
  ) => Promise<void>;
}

const POSTGRES_SCHEME = /^postgres(ql)?:\/\//i;
const SQLITE_URL_SCHEME = /^sqlite:(.*)$/i;

function normalizeDriver(raw: string | undefined): DatabaseDriver | undefined {
  if (raw === undefined || raw === "") return undefined;
  const v = raw.toLowerCase();
  if (v === "sqlite") return "sqlite";
  if (v === "pgsql" || v === "postgres" || v === "postgresql") return "pgsql";
  throw new Error(
    `[database] Unsupported DB_CONNECTION "${raw}" (expected "sqlite" or "pgsql").`,
  );
}

function inferDriver(
  databaseUrl: string | undefined,
): DatabaseDriver | undefined {
  if (!databaseUrl) return undefined;
  if (POSTGRES_SCHEME.test(databaseUrl)) return "pgsql";
  if (
    SQLITE_URL_SCHEME.test(databaseUrl) ||
    databaseUrl === ":memory:" ||
    /\.(sqlite|sqlite3|db)$/i.test(databaseUrl)
  ) {
    return "sqlite";
  }
  return undefined;
}

function buildPgsqlConnectionString(input: DatabaseConfigInput): string {
  if (input.databaseUrl && POSTGRES_SCHEME.test(input.databaseUrl)) {
    return input.databaseUrl;
  }
  const host = input.dbHost ?? "localhost";
  const port = input.dbPort !== undefined ? String(input.dbPort) : "5432";
  const user = input.dbUsername ?? "mosaix";
  const password = input.dbPassword ?? "";
  const database = input.dbDatabase ?? "mosaix";
  const auth = password ? `${user}:${password}` : user;
  return `postgresql://${auth}@${host}:${port}/${database}`;
}

/**
 * Resolve the effective connection config from env-like input.
 * Pure function — no I/O, safe to unit-test.
 */
export function resolveDatabaseConfig(
  input: DatabaseConfigInput = {},
  rootDir: string = process.cwd(),
): DatabaseConfig {
  const driver =
    normalizeDriver(input.dbConnection) ??
    inferDriver(input.databaseUrl) ??
    "sqlite";

  if (driver === "pgsql") {
    return {
      connection: "pgsql",
      connectionString: buildPgsqlConnectionString(input),
    };
  }

  let database = input.dbDatabase;
  if (!database && input.databaseUrl) {
    const m = SQLITE_URL_SCHEME.exec(input.databaseUrl);
    if (m) database = m[1] === "" ? ":memory:" : m[1];
    else if (input.databaseUrl === ":memory:") database = ":memory:";
  }
  if (!database) {
    return { connection: "sqlite", database: path.join(rootDir, "data", "mosaix.sqlite") };
  }
  if (database !== ":memory:" && !path.isAbsolute(database)) {
    database = path.join(rootDir, database);
  }
  return { connection: "sqlite", database };
}

/**
 * Holds named `DatabasePort` connections built from a resolved config.
 * `connection()` is sync (adapter constructors open lazily / synchronously);
 * `ready()` awaits the one-time `onConnect` hook — the boot path awaits it
 * before serving traffic, the CLI awaits it before migrating/seeding.
 */
export class DatabaseManager {
  private readonly connections = new Map<string, DatabasePort>();
  private readyPromise: Promise<DatabasePort> | null = null;

  constructor(
    private readonly config: DatabaseConfig,
    private readonly factories: DatabaseDriverFactories,
    private readonly hooks: DatabaseManagerHooks = {},
    private readonly name: string = "default",
  ) {}

  getConfig(): DatabaseConfig {
    return this.config;
  }

  connection(name?: string): DatabasePort {
    const key = name ?? this.name;
    const existing = this.connections.get(key);
    if (existing) return existing;
    const built = this.build(this.config);
    this.connections.set(key, built);
    return built;
  }

  ready(): Promise<DatabasePort> {
    if (!this.readyPromise) {
      this.readyPromise = (async () => {
        const db = this.connection();
        await this.hooks.onConnect?.(db, this.config);
        return db;
      })();
    }
    return this.readyPromise;
  }

  async close(): Promise<void> {
    for (const db of this.connections.values()) {
      const closeable = db as Partial<{
        close: () => void | Promise<void>;
      }>;
      if (typeof closeable.close === "function") {
        await closeable.close();
      }
    }
    this.connections.clear();
    this.readyPromise = null;
  }

  private build(config: DatabaseConfig): DatabasePort {
    if (config.connection === "sqlite") {
      return this.factories.sqlite(config.database);
    }
    const factory = this.factories.pgsql;
    if (!factory) {
      throw new Error(
        `[database] DB_CONNECTION=pgsql requires a PostgreSQL driver factory ` +
          `(inject a \`PgClient\`-backed \`PostgresDatabaseAdapter\` — see ` +
          `@mosaix/adapter-database-postgres). No driver is bundled by default.`,
      );
    }
    return factory(config.connectionString);
  }
}

/**
 * SQLite integrity/concurrency PRAGMAs, applied **awaited** at connect time
 * (boot and CLI share this helper). Fail-fast: without these, foreign-key
 * enforcement and WAL concurrency silently vanish.
 */
export const SQLITE_PRAGMAS: readonly string[] = [
  `PRAGMA journal_mode = WAL;`,
  `PRAGMA synchronous = NORMAL;`,
  `PRAGMA busy_timeout = 5000;`,
  `PRAGMA foreign_keys = ON;`,
];

export async function applySqlitePragmas(db: DatabasePort): Promise<void> {
  for (const sql of SQLITE_PRAGMAS) {
    try {
      await db.execute(sql);
    } catch (err: unknown) {
      throw new Error(
        `[database] PRAGMA failed (${sql}): ${err instanceof Error ? err.message : err}`,
        { cause: err },
      );
    }
  }
}
