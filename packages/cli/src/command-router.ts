import type { CommandContext, CLIResult, CliCommand } from "./command.js";
import { EXIT_CODES } from "./command.js";
import { lifecycleCommands } from "./commands/lifecycle-commands.js";
import { discoveryCommands } from "./commands/discovery-commands.js";
import { diagnosticCommands } from "./commands/diagnostic-commands.js";
import { migrationCommands } from "./commands/migration-commands.js";
import { keyCommands } from "./commands/key-commands.js";
import { installCommands } from "./commands/install-commands.js";

export interface CommandOptions {
  rootDir?: string;
  json?: boolean;
  ci?: boolean;
  args?: string[];
}

export class MosaixCommandRouter {
  private rootDir: string;
  private commandsMap = new Map<string, CliCommand>();

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
    this.registerCommands([
      ...lifecycleCommands,
      ...discoveryCommands,
      ...diagnosticCommands,
      ...migrationCommands,
      ...keyCommands,
      ...installCommands,
    ]);
  }

  private registerCommands(cmds: CliCommand[]): void {
    for (const cmd of cmds) {
      this.commandsMap.set(cmd.name, cmd);
      if (cmd.aliases) {
        for (const alias of cmd.aliases) {
          this.commandsMap.set(alias, cmd);
        }
      }
    }
  }

  async execute(
    command: string,
    options: CommandOptions = {},
  ): Promise<CLIResult> {
    const isJson = options.json ?? false;
    const isCi = options.ci ?? false;
    const args = options.args ?? [];

    const respond = (msg: string, data: unknown): CLIResult => {
      if (isJson) {
        console.log(
          JSON.stringify({ status: "success", message: msg, data }, null, 2),
        );
      } else {
        console.log(`[mosaix] ${msg}`);
        if (typeof data === "object" && data !== null) {
          console.log(JSON.stringify(data, null, 2));
        }
      }
      return { exitCode: EXIT_CODES.SUCCESS, message: msg, data };
    };

    const error = (
      msg: string,
      exitCode: number = EXIT_CODES.GENERIC_ERROR,
    ): CLIResult => {
      if (isJson) {
        console.error(
          JSON.stringify({ status: "error", exitCode, error: msg }, null, 2),
        );
      } else {
        console.error(`[mosaix error] ${msg}`);
      }
      return { exitCode, message: msg };
    };

    try {
      const cmd = this.commandsMap.get(command);
      if (!cmd) {
        return error(
          `Unknown command: ${command}. Run 'mosaix list' or 'mosaix help'.`,
          EXIT_CODES.GENERIC_ERROR,
        );
      }

      const ctx: CommandContext = {
        rootDir: this.rootDir,
        isJson,
        isCi,
        args,
        respond,
        error,
      };

      return await cmd.execute(ctx);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return error(
        `Command execution failed: ${msg}`,
        EXIT_CODES.GENERIC_ERROR,
      );
    }
  }
}
export { EXIT_CODES };
