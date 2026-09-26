/**
 * @mosaix/cli — Artisan-style migration commands (Laravel `migrate`).
 *
 * - `mosaix migrate` — plan the aggregated shell registry against the
 *   persistent `mosaix_migrations` ledger and apply the delta.
 * - `mosaix migrate:status` — desired vs applied state per migration.
 * - `mosaix migrate:rollback [--steps=N]` — undo the last batch (or N steps).
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
import { connectCliDatabase } from "./database-command.js";
// Shell-owned providers (aggregated registry). Relative import follows the
// existing cross-package style of this file; the long-term home is a
// dedicated shell-registry package (backlog).
import { createShellMigrationRegistry } from "../../../../src/shell/migration-registry.js";

async function buildMigrationCli(ctx: CommandContext): Promise<{
  cli: MigrationCLI;
  db: DatabasePort;
  connection: string;
}> {
  const { db, config } = await connectCliDatabase(ctx);
  const registry = createShellMigrationRegistry();
  const store = new SqlMigrationStore(db);
  return {
    cli: new MigrationCLI(registry, store, db),
    db,
    connection:
      config.connection === "sqlite"
        ? `sqlite:${config.database}`
        : `pgsql:${config.connectionString}`,
  };
}

export class MigrateCommand implements CliCommand {
  readonly name = "migrate";
  readonly description = "Run pending database schema migrations";

  async execute(ctx: CommandContext): Promise<CLIResult> {
    const { cli, db, connection } = await buildMigrationCli(ctx);
    const seed = ctx.args.includes("--seed");
    const result = await cli.migrate();
    if (seed) {
      const { runDatabaseSeeds } = await import(
        "../../../../src/shell/seeders/database-seeder.js"
      );
      const seeded = await runDatabaseSeeds(db);
      return ctx.respond(
        `Database migrations executed on [${connection}].`,
        { ...result, seeded },
      );
    }
    return ctx.respond(`Database migrations executed on [${connection}].`, result);
  }
}

export class MigrateStatusCommand implements CliCommand {
  readonly name = "migrate:status";
  readonly description = "Check status of database migrations";

  async execute(ctx: CommandContext): Promise<CLIResult> {
    const { cli, connection } = await buildMigrationCli(ctx);
    const status = await cli.status();
    return ctx.respond(
      `Migration status retrieved on [${connection}].`,
      status,
    );
  }
}

export class MigrateRollbackCommand implements CliCommand {
  readonly name = "migrate:rollback";
  readonly description = "Rollback database migrations";

  async execute(ctx: CommandContext): Promise<CLIResult> {
    const { cli, connection } = await buildMigrationCli(ctx);
    const stepsArg = ctx.args
      .find((a) => a.startsWith("--steps="))
      ?.slice("--steps=".length);
    const steps = stepsArg !== undefined ? Number.parseInt(stepsArg, 10) : undefined;
    const result = await cli.rollback(
      steps !== undefined && Number.isFinite(steps) ? steps : undefined,
    );
    return ctx.respond(
      `Migration rollback completed on [${connection}].`,
      result,
    );
  }
}

export const migrationCommands: CliCommand[] = [
  new MigrateCommand(),
  new MigrateStatusCommand(),
  new MigrateRollbackCommand(),
];
