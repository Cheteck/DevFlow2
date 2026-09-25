/**
 * @scripts/install — thin wrapper over the `mosaix install` command.
 * First-time setup for a fresh checkout / server. Non-interactive, idempotent.
 * Usage: pnpm setup [--dry-run] [--admin-email=..] [--skip-deps] [--skip-db] [--skip-admin]
 */
import { InstallCommand } from "../packages/cli/src/commands/install-commands.js";
import type { CLIResult } from "../packages/cli/src/command.js";

async function main(): Promise<void> {
  const cmd = new InstallCommand();
  const result: CLIResult = await cmd.execute({
    rootDir: process.cwd(),
    isJson: false,
    isCi: Boolean(process.env.CI),
    args: process.argv.slice(2),
    respond: (msg, data) => {
      console.log(`[mosaix] ${msg}`);
      if (data !== undefined) console.log(JSON.stringify(data, null, 2));
      return { exitCode: 0, message: msg, data };
    },
    error: (msg, exitCode = 1) => {
      console.error(`[mosaix error] ${msg}`);
      return { exitCode, message: msg };
    },
  });
  process.exit(result.exitCode);
}

main().catch((err) => {
  console.error("[install]", err);
  process.exit(1);
});
