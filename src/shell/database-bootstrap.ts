/**
 * @shell — Database connection bootstrap (Laravel-style `config/database.php`).
 *
 * Doctrine (mirrors Laravel + artisan):
 * - This module only **connects**: it resolves the driver from env
 *   (`DB_CONNECTION`, `DB_*`, `DATABASE_URL`) through `@mosaix/database`
 *   `resolveDatabaseConfig()` and builds the `DatabasePort` through the
 *   injected driver factory. Ports stay decoupled from drivers.
 * - **No DDL, no seeds at boot.** Schema comes from versioned migrations
 *   (`mosaix migrate`, see `src/shell/migration-registry.ts`), demo data
 *   from seeders (`mosaix db:seed`, see `src/shell/seeders/`).
 * - SQLite PRAGMAs (WAL, foreign keys, busy timeout) are **awaited** in the
 *   connect hook: `databaseReady()` resolves only once they are applied.
 *   Without this ordering, integrity/concurrency guarantees silently vanish.
 */
import { SQLiteDatabaseAdapter } from "@mosaix/adapter-database-sqlite";
import { SQLiteIdentityStoreAdapter } from "@mosaix/adapter-identity-store-sqlite";
import {
  applySqlitePragmas,
  DatabaseManager,
  resolveDatabaseConfig,
  type DatabaseConfig,
} from "@mosaix/database";
import type { DatabasePort } from "@mosaix/ports-database";
import * as fs from "node:fs";
import * as path from "node:path";

export interface DatabaseBootstrapOptions {
  /** Defaults to `process.cwd()`. Relative SQLite paths resolve under it. */
  rootDir?: string;
  /** Defaults to `process.env`. */
  env?: Record<string, string | undefined>;
}

export interface DatabaseBootstrapResult {
  dbAdapter: DatabasePort;
  identityStore: SQLiteIdentityStoreAdapter;
  manager: DatabaseManager;
  config: DatabaseConfig;
}

let cachedBootstrap: DatabaseBootstrapResult | null = null;
let readyPromise: Promise<DatabaseBootstrapResult> | null = null;

function sqliteFactory(databasePath: string): DatabasePort {
  if (databasePath !== ":memory:") {
    const dir = path.dirname(databasePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  return new SQLiteDatabaseAdapter(databasePath);
}

/** Awaited connect hook: fail fast if integrity PRAGMAs cannot apply. */
async function onConnect(
  db: DatabasePort,
  config: DatabaseConfig,
): Promise<void> {
  if (config.connection !== "sqlite") return;
  await applySqlitePragmas(db);
}

function readConfig(
  rootDir: string,
  env: Record<string, string | undefined>,
): DatabaseConfig {
  return resolveDatabaseConfig(
    {
      dbConnection: env.DB_CONNECTION,
      databaseUrl: env.MOSAIX_DATABASE_URL ?? env.DATABASE_URL,
      dbDatabase: env.DB_DATABASE,
      dbHost: env.DB_HOST,
      dbPort: env.DB_PORT,
      dbUsername: env.DB_USERNAME,
      dbPassword: env.DB_PASSWORD,
    },
    rootDir,
  );
}

/**
 * Resolve the driver and build the (sync) connection. Cheap and side-effect
 * free besides creating the SQLite directory. Await `databaseReady()` before
 * issuing queries so PRAGMAs are guaranteed applied.
 */
export function initDatabase(
  options: DatabaseBootstrapOptions = {},
): DatabaseBootstrapResult {
  if (cachedBootstrap) {
    return cachedBootstrap;
  }

  const rootDir = options.rootDir ?? process.cwd();
  const env =
    options.env ?? (process.env as Record<string, string | undefined>);
  const config = readConfig(rootDir, env);
  const manager = new DatabaseManager(
    config,
    { sqlite: sqliteFactory },
    { onConnect },
  );
  const dbAdapter = manager.connection();
  const identityStore = new SQLiteIdentityStoreAdapter(dbAdapter);

  cachedBootstrap = { dbAdapter, identityStore, manager, config };
  return cachedBootstrap;
}

/** Await the connect hook (PRAGMAs). Boot and CLI must await this. */
export function databaseReady(): Promise<DatabaseBootstrapResult> {
  const current = initDatabase();
  if (!readyPromise) {
    readyPromise = current.manager.ready().then(() => current);
  }
  return readyPromise;
}

/** Close connections and reset the cache (tests / shutdown). */
export async function closeDatabase(): Promise<void> {
  if (cachedBootstrap) {
    await cachedBootstrap.manager.close();
  }
  cachedBootstrap = null;
  readyPromise = null;
}
