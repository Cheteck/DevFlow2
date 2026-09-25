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
  readonly aliases = ["serve"];
  async execute(ctx: CommandContext): Promise<CLIResult> {
    if (ctx.args.includes("--help") || ctx.args.includes("-h")) {
      const help = [
        "Usage: mosaix dev [options]",
        "",
        "Options:",
        "  -p, --port <port>     Port to run dev server on (default: 3000)",
        "  --host <host>         Host to bind (default: localhost, use 0.0.0.0 for network)",
        "  -a, --app <app>       Filter to single app (e.g. --app portfolio)",
        "  --open                Open browser on start",
        "  --strictPort          Exit if port is in use instead of trying next port",
        "  --clearScreen         Clear screen on start (default: true, use --no-clearScreen to disable)",
        "  --help, -h            Show this help",
        "",
        "Examples:",
        "  mosaix dev --port 3000 --host 0.0.0.0 --open",
        "  mosaix dev --app portfolio --port 3001",
      ].join("\n");
      return ctx.respond(help, { port: 3000 });
    }

    let port: number | undefined;
    let host: string | undefined;
    let app: string | undefined;
    let open = false;
    let strictPort = false;
    let clearScreen = true;

    for (let i = 0; i < ctx.args.length; i++) {
      if ((ctx.args[i] === "--port" || ctx.args[i] === "-p") && ctx.args[i + 1]) {
        port = parseInt(ctx.args[i + 1] as string, 10);
      }
      if (ctx.args[i] === "--host" && ctx.args[i + 1]) {
        host = ctx.args[i + 1] as string;
      }
      if ((ctx.args[i] === "--app" || ctx.args[i] === "-a") && ctx.args[i + 1]) {
        app = ctx.args[i + 1] as string;
      }
      if (ctx.args[i] === "--open") open = true;
      if (ctx.args[i] === "--strictPort") strictPort = true;
      if (ctx.args[i] === "--clearScreen") clearScreen = true;
      if (ctx.args[i] === "--no-clearScreen") clearScreen = false;
    }

    const devServer = new MosaixDevServer(ctx.rootDir, {
      port: port ?? 3000,
      host: host ?? "localhost",
      app: app ?? "",
      open,
      strictPort,
      clearScreen,
    });
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
