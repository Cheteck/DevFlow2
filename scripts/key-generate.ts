/**
 * @scripts/key-generate — thin wrapper over the `mosaix key:generate` command.
 * Usage: pnpm key:generate [--show] [--force] [--key=NAME] [--env=.env]
 */
import { KeyGenerateCommand } from "../packages/cli/src/commands/key-commands.js";
import type { CLIResult } from "../packages/cli/src/command.js";

async function main(): Promise<void> {
  const cmd = new KeyGenerateCommand();
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
  console.error("[key:generate]", err);
  process.exit(1);
});
