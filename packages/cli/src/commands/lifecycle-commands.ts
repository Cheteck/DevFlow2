import * as path from "node:path";
import type { CliCommand, CommandContext, CLIResult } from "../command.js";
import { EXIT_CODES } from "../folder-manager.js";
import { MosaixFolderManager } from "../folder-manager.js";
import { ProductionBuildCompiler } from "../build-compiler.js";
import { MosaixDevServer } from "../dev-server/dev-server.js";

export class InitCommand implements CliCommand {
  readonly name = "init";
  execute(ctx: CommandContext): CLIResult {
    const folderManager = new MosaixFolderManager(ctx.rootDir);
    folderManager.ensureFolderStructure();
    const data = { status: "initialized", path: path.join(ctx.rootDir, ".mosaix") };
    return ctx.respond("MosaiX project initialized.", data);
  }
}

export class DevCommand implements CliCommand {
  readonly name = "dev";
  async execute(ctx: CommandContext): Promise<CLIResult> {
    let port: number | undefined;
    let app: string | undefined;

    for (let i = 0; i < ctx.args.length; i++) {
      if ((ctx.args[i] === "--port" || ctx.args[i] === "-p") && ctx.args[i + 1]) {
        port = parseInt(ctx.args[i + 1] as string, 10);
      }
      if ((ctx.args[i] === "--app" || ctx.args[i] === "-a") && ctx.args[i + 1]) {
        app = ctx.args[i + 1] as string;
      }
    }

    const devServer = new MosaixDevServer(ctx.rootDir, { port: port ?? 3000, app: app ?? "" });
    return devServer.start({ json: ctx.isJson, ci: ctx.isCi });
  }
}

export class BuildCommand implements CliCommand {
  readonly name = "build";
  execute(ctx: CommandContext): CLIResult {
    const buildCompiler = new ProductionBuildCompiler(ctx.rootDir);
    const manifest = buildCompiler.compile();
    return ctx.respond("Build completed successfully.", manifest);
  }
}

export class RebuildCommand implements CliCommand {
  readonly name = "rebuild";
  execute(ctx: CommandContext): CLIResult {
    const folderManager = new MosaixFolderManager(ctx.rootDir);
    const buildCompiler = new ProductionBuildCompiler(ctx.rootDir);
    folderManager.clean();
    const manifest = buildCompiler.compile();
    return ctx.respond("Rebuild completed cleanly.", manifest);
  }
}

export class StartCommand implements CliCommand {
  readonly name = "start";
  execute(ctx: CommandContext): CLIResult {
    const folderManager = new MosaixFolderManager(ctx.rootDir);
    const info = folderManager.inspect();
    if (info.status !== "built") {
      return ctx.error("Workspace not built. Run 'mosaix build' first.", EXIT_CODES.BUILD_FAILURE);
    }
    return ctx.respond("MosaiX standalone runtime started.", { status: "active", info });
  }
}

export class CleanCommand implements CliCommand {
  readonly name = "clean";
  execute(ctx: CommandContext): CLIResult {
    const folderManager = new MosaixFolderManager(ctx.rootDir);
    folderManager.clean();
    return ctx.respond(".mosaix directory cleaned.", { status: "cleaned" });
  }
}

export const lifecycleCommands: CliCommand[] = [
  new InitCommand(),
  new DevCommand(),
  new BuildCommand(),
  new RebuildCommand(),
  new StartCommand(),
  new CleanCommand(),
];
