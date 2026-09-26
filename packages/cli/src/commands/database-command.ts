/**
 * @mosaix/cli — Shared database wiring for artisan-style commands.
 *
 * Single composition point for CLI database access (Laravel-style: every
 * `mosaix <db-command>` resolves the driver from `.env` the same way):
 * loads dotenv files (shell/docker/CI env always wins), resolves
 * `DB_CONNECTION` / `DB_*` / `DATABASE_URL` through `@mosaix/database`,
 * connects through `DatabaseManager`, and awaits the SQLite connect hook
 * (WAL, foreign keys, busy timeout) before any migrate/seed/status work.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import type { CommandContext } from "../command.js";
import { loadEnvFile } from "@mosaix/core";
import {
  applySqlitePragmas,
  DatabaseManager,
  resolveDatabaseConfig,
  type DatabaseConfig,
} from "@mosaix/database";
import type { DatabasePort } from "@mosaix/ports-database";
import { SQLiteDatabaseAdapter } from "@mosaix/adapter-database-sqlite";

export interface CliDatabase {
  readonly manager: DatabaseManager;
  readonly db: DatabasePort;
  readonly config: DatabaseConfig;
}

function sqliteFactory(databasePath: string): DatabasePort {
  if (databasePath !== ":memory:") {
    const dir = path.dirname(databasePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  return new SQLiteDatabaseAdapter(databasePath);
}

export async function connectCliDatabase(
  ctx: CommandContext,
): Promise<CliDatabase> {
  loadEnvFile([".env", ".env.local"], ctx.rootDir);
  const env = process.env as Record<string, string | undefined>;
  const config = resolveDatabaseConfig(
    {
      dbConnection: env.DB_CONNECTION,
      databaseUrl: env.MOSAIX_DATABASE_URL ?? env.DATABASE_URL,
      dbDatabase: env.DB_DATABASE,
      dbHost: env.DB_HOST,
      dbPort: env.DB_PORT,
      dbUsername: env.DB_USERNAME,
      dbPassword: env.DB_PASSWORD,
    },
    ctx.rootDir,
  );
  const manager = new DatabaseManager(
    config,
    { sqlite: sqliteFactory },
    {
      onConnect: async (db, cfg) => {
        if (cfg.connection === "sqlite") await applySqlitePragmas(db);
      },
    },
  );
  const db = await manager.ready();
  return { manager, db, config };
}
