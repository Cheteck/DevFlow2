import type { CliCommand, CommandContext, CLIResult } from "../command.js";
import { MigrationRegistry, InMemoryMigrationStore, MigrationCLI } from "../../../migrations/src/index.js";
import { SQLiteDatabaseAdapter } from "../../../adapters/database-sqlite/src/index.js";
import * as path from "node:path";
import * as fs from "node:fs";

export class MigrateCommand implements CliCommand {
  readonly name = "migrate";
  readonly description = "Run pending database schema migrations";

  async execute(ctx: CommandContext): Promise<CLIResult> {
    const dataDir = path.join(ctx.rootDir, "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, "mosaix.sqlite");
    const db = new SQLiteDatabaseAdapter(dbPath);
    const store = new InMemoryMigrationStore();
    const registry = new MigrationRegistry();

    const cli = new MigrationCLI(registry, store, db);
    const result = await cli.migrate();

    return ctx.respond("Database migrations executed.", result);
  }
}

export class MigrateStatusCommand implements CliCommand {
  readonly name = "migrate:status";
  readonly description = "Check status of database migrations";

  async execute(ctx: CommandContext): Promise<CLIResult> {
    const dataDir = path.join(ctx.rootDir, "data");
    const dbPath = path.join(dataDir, "mosaix.sqlite");
    const db = new SQLiteDatabaseAdapter(dbPath);
    const store = new InMemoryMigrationStore();
    const registry = new MigrationRegistry();

    const cli = new MigrationCLI(registry, store, db);
    const status = await cli.status();

    return ctx.respond("Migration status retrieved.", status);
  }
}

export class MigrateRollbackCommand implements CliCommand {
  readonly name = "migrate:rollback";
  readonly description = "Rollback database migrations";

  async execute(ctx: CommandContext): Promise<CLIResult> {
    const dataDir = path.join(ctx.rootDir, "data");
    const dbPath = path.join(dataDir, "mosaix.sqlite");
    const db = new SQLiteDatabaseAdapter(dbPath);
    const store = new InMemoryMigrationStore();
    const registry = new MigrationRegistry();

    const cli = new MigrationCLI(registry, store, db);
    const result = await cli.rollback();

    return ctx.respond("Migration rollback completed.", result);
  }
}

export const migrationCommands: CliCommand[] = [
  new MigrateCommand(),
  new MigrateStatusCommand(),
  new MigrateRollbackCommand(),
];
