/**
 * @mosaix/cli — Shared database wiring for artisan-style commands.
 *
 * Delegates to the shared composition root (`bootstrap/createCliApplication`,
 * Laravel-style: every `mosaix <db-command>` resolves the driver from `.env`
 * exactly like the HTTP serve path). CLI preserves its historical behavior:
 * no production security gate, no composition overrides loading (stdout must
 * stay clean for `--json`), and no migrations fail-fast (the CLI is what
 * APPLIES migrations).
 */
import type { CommandContext } from "../command.js";
import type {
  DatabaseConfig,
  DatabaseManager,
} from "@mosaix/database";
import type { DatabasePort } from "@mosaix/ports-database";
import { createCliApplication } from "../../../../bootstrap/index.js";

export interface CliDatabase {
  readonly manager: DatabaseManager;
  readonly db: DatabasePort;
  readonly config: DatabaseConfig;
  readonly close: () => Promise<void>;
}

export async function connectCliDatabase(
  ctx: CommandContext,
): Promise<CliDatabase> {
  const app = await createCliApplication({
    rootDir: ctx.rootDir,
    skipSecurity: true,
    skipComposition: true,
  });
  return { manager: app.manager, db: app.dbAdapter, config: app.config, close: app.close };
}
