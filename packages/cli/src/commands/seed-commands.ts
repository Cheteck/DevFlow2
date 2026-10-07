/**
 * @mosaix/cli — Artisan-style seeder command (Laravel `db:seed`).
 *
 * - `mosaix db:seed` — run the baseline `DatabaseSeeder`. Idempotent-if-empty:
 *   tables that already hold rows are skipped, so re-running is safe.
 *
 * Seeds never run at boot. Fresh environments: `mosaix migrate --seed`
 * (or `pnpm db:setup`).
 */
import type { CliCommand, CommandContext, CLIResult } from "../command.js";
import { connectCliDatabase } from "./database-command.js";
// Shell-owned seeder. Relative import follows the existing cross-package
// style; long-term home is a dedicated shell-registry package (backlog).
import { runDatabaseSeeds } from "../../../../src/shell/seeders/database-seeder.js";

export class DbSeedCommand implements CliCommand {
  readonly name = "db:seed";
  readonly description = "Run baseline database seeders (idempotent-if-empty)";

  async execute(ctx: CommandContext): Promise<CLIResult> {
    const { db, manager, config } = await connectCliDatabase(ctx);
    try {
      const seeded = await runDatabaseSeeds(db);
      const connection =
        config.connection === "sqlite"
          ? `sqlite:${config.database}`
          : `pgsql:${config.connectionString}`;
      return ctx.respond(`Database seeding completed on [${connection}].`, {
        seeded,
      });
    } finally {
      await manager.close();
    }
  }
}

export const seedCommands: CliCommand[] = [new DbSeedCommand()];
