/**
 * @mosaix/cli — Artisan-style migration commands (Laravel `migrate`).
 *
 * - `mosaix migrate` — plan the aggregated shell registry against the
 *   persistent `mosaix_migrations` ledger and apply the delta.
 * - `mosaix migrate:status` — desired vs applied state per migration.
 * - `mosaix migrate:rollback [--steps=N]` — undo the last batch (or N steps).
 * - `mosaix migrate:fresh` — drop all tables and re-run all migrations.
 * - `mosaix migrate:install` — create the migration repository table.
 * - `mosaix migrate:reset` — rollback all migrations.
 * - `mosaix migrate:mark <id>` — mark a migration as applied without running it.
 *
 * All commands resolve the driver from `.env` through the shared CLI
 * database wiring (`database-command.ts`): `DB_CONNECTION` selects
 * `sqlite`/`pgsql`, per-driver `DB_*` keys configure it. The boot path
 * never migrates — it only verifies (see `src/start.ts`).
 */
import type { CliCommand, CommandContext, CLIResult } from "../command.js";
import {
  MigrationCLI,
  SqlMigrationStore,
  type DatabasePort,
} from "../../../migrations/src/index.js";
import type { DatabaseManager } from "@mosaix/database";
import {
  connectCliDatabase,
  closeCliDatabase,
  type CliDatabase,
} from "./database-command.js";
// Shell-owned providers (aggregated registry). Relative import follows the
// existing cross-package style of this file; the long-term home is a
// dedicated shell-registry package (backlog).
import { createShellMigrationRegistry } from "../../../../src/shell/migration-registry.js";

async function buildMigrationCli(ctx: CommandContext): Promise<{
  cli: MigrationCLI;
  db: DatabasePort;
  manager: DatabaseManager;
  connection: string;
}> {
  const { db, config, manager } = await connectCliDatabase(ctx);
  const registry = createShellMigrationRegistry(db.capabilities.dialect);
  const store = new SqlMigrationStore(db);
  return {
    cli: new MigrationCLI(registry, store, db),
    db,
    manager,
    connection: describeConnection(config),
  };
}

/** Single human-readable `[driver:target]` label for CLI output. */
function describeConnection(config: CliDatabase["config"]): string {
  return config.connection === "sqlite"
    ? `sqlite:${config.database}`
    : `pgsql:${config.connectionString}`;
}

export class MigrateCommand implements CliCommand {
  readonly name = "migrate";
  readonly description = "Run pending database schema migrations";

  async execute(ctx: CommandContext): Promise<CLIResult> {
    const { cli, db, connection } = await buildMigrationCli(ctx);
    try {
      const seed = ctx.args.includes("--seed");
      const result = await cli.migrate();
      if (seed) {
        const { runDatabaseSeeds } =
          await import("../../../../src/shell/seeders/database-seeder.js");
        const seeded = await runDatabaseSeeds(db);
        return ctx.respond(
          `Database migrations executed on [${connection}].`,
          {
            ...result,
            seeded,
          },
        );
      }
      return ctx.respond(
        `Database migrations executed on [${connection}].`,
        result,
      );
    } finally {
      await closeCliDatabase();
    }
  }
}

export class MigrateStatusCommand implements CliCommand {
  readonly name = "migrate:status";
  readonly description = "Check status of database migrations";

  async execute(ctx: CommandContext): Promise<CLIResult> {
    const { cli, connection } = await buildMigrationCli(ctx);
    try {
      const status = await cli.status();
      return ctx.respond(
        `Migration status retrieved on [${connection}].`,
        status,
      );
    } finally {
      await closeCliDatabase();
    }
  }
}

export class MigrateRollbackCommand implements CliCommand {
  readonly name = "migrate:rollback";
  readonly description = "Rollback database migrations";

  async execute(ctx: CommandContext): Promise<CLIResult> {
    const { cli, connection } = await buildMigrationCli(ctx);
    try {
      const stepsArg = ctx.args
        .find((a) => a.startsWith("--steps="))
        ?.slice("--steps=".length);
      const steps =
        stepsArg !== undefined ? Number.parseInt(stepsArg, 10) : undefined;
      const result = await cli.rollback(
        steps !== undefined && Number.isFinite(steps) ? steps : undefined,
      );
      return ctx.respond(
        `All migrations rolled back on [${connection}].`,
        result,
      );
    } finally {
      await closeCliDatabase();
    }
  }
}

export class MigrateFreshCommand implements CliCommand {
  readonly name = "migrate:fresh";
  readonly description = "Drop all tables and re-run all migrations";

  async execute(ctx: CommandContext): Promise<CLIResult> {
    const { cli, db, connection } = await buildMigrationCli(ctx);
    try {
      await db.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
      const result = await cli.migrate();
      return ctx.respond(
        `Database migrations executed on [${connection}].`,
        result,
      );
    } finally {
      await closeCliDatabase();
    }
  }
}

export class MigrateInstallCommand implements CliCommand {
  readonly name = "migrate:install";
  readonly description = "Create the migration repository table";

  async execute(ctx: CommandContext): Promise<CLIResult> {
    const { db, config } = await connectCliDatabase(ctx);
    const connection = describeConnection(config);
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS mosaix_migrations (
          id TEXT PRIMARY KEY,
          owner TEXT NOT NULL,
          checksum TEXT NOT NULL,
          batch_id TEXT NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      return ctx.respond(
        `Migration table created on [${connection}].`,
        { success: true },
      );
    } finally {
      await closeCliDatabase();
    }
  }
}

export class MigrateResetCommand implements CliCommand {
  readonly name = "migrate:reset";
  readonly description = "Rollback all database migrations";

  async execute(ctx: CommandContext): Promise<CLIResult> {
    const { cli, connection } = await buildMigrationCli(ctx);
    try {
      // No "all" target exists on the planner — a step count beyond any real
      // ledger size rolls everything back in one plan (planner slices to held).
      const result = await cli.rollback(Number.MAX_SAFE_INTEGER);
      return ctx.respond(
        `Database migrated fresh on [${connection}].`,
        result,
      );
    } finally {
      await closeCliDatabase();
    }
  }
}

export class MigrateMarkCommand implements CliCommand {
  readonly name = "migrate:mark";
  readonly description = "Mark a migration as applied without running it (usage: migrate:mark <migration-id>)";

  async execute(ctx: CommandContext): Promise<CLIResult> {
    const { db, config } = await connectCliDatabase(ctx);
    const connection = describeConnection(config);
    try {
      const migrationId = ctx.args.find(a => !a.startsWith("--"));
      if (!migrationId) {
        return ctx.respond("Usage: mosaix migrate:mark <migration-id>", { error: "Missing migration ID" });
      }
      await db.execute(
        `INSERT INTO mosaix_migrations (id, owner, checksum, batch_id, applied_at) VALUES ($1, 'manual', 'manual', 'manual-' || gen_random_uuid(), now()) ON CONFLICT (id) DO NOTHING`,
        [migrationId]
      );
      return ctx.respond(
        `Migration [${migrationId}] marked as applied on [${connection}].`,
        { success: true, migrationId },
      );
    } finally {
      await closeCliDatabase();
    }
  }
}

export const migrationCommands: CliCommand[] = [
  new MigrateCommand(),
  new MigrateStatusCommand(),
  new MigrateRollbackCommand(),
  new MigrateFreshCommand(),
  new MigrateInstallCommand(),
  new MigrateResetCommand(),
  new MigrateMarkCommand(),
];
