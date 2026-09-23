import { EXIT_CODES } from "./folder-manager.js";

export interface CLIResult {
  exitCode: number;
  message?: string;
  data?: unknown;
}

export interface CommandOptions {
  rootDir?: string;
  json?: boolean;
  ci?: boolean;
  args?: string[];
}

export interface CommandContext {
  rootDir: string;
  isJson: boolean;
  isCi: boolean;
  args: string[];
  respond: (msg: string, data: unknown) => CLIResult;
  error: (msg: string, exitCode?: number) => CLIResult;
}

export interface CliCommand {
  readonly name: string;
  readonly aliases?: string[];
  readonly description?: string;
  execute(ctx: CommandContext): Promise<CLIResult> | CLIResult;
}

export { EXIT_CODES };
