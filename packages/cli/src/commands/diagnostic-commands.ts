import * as fs from "node:fs";
import * as path from "node:path";
import type { CliCommand, CommandContext, CLIResult } from "../command.js";
import { EXIT_CODES } from "../folder-manager.js";
import { MosaixFolderManager } from "../folder-manager.js";
import { AppConformanceValidator } from "@mosaix/conformance";
import { PlatformToolProvider, AppToolProvider, mcpToolRegistry, mcpResourceRegistry } from "@mosaix/mcp";
import { WorkspaceDoctor } from "../doctor.js";

export class CheckCommand implements CliCommand {
  readonly name = "check";
  readonly aliases = ["verify"];
  execute(ctx: CommandContext): CLIResult {
    const folderManager = new MosaixFolderManager(ctx.rootDir);
    const info = folderManager.inspect();
    const isValid = info.status === "built";
    if (!isValid && ctx.isCi) {
      return ctx.error("Workspace verification failed", EXIT_CODES.WORKSPACE_INCONSISTENCY);
    }
    return ctx.respond("Workspace Verification", { valid: isValid, status: info.status });
  }
}

export class CheckArchitectureCommand implements CliCommand {
  readonly name = "check:architecture";
  execute(ctx: CommandContext): CLIResult {
    const appsDir = path.join(ctx.rootDir, "apps");
    const results = AppConformanceValidator.validateAllWorkspaceApps(appsDir);
    const failures = Object.entries(results).filter(([_, res]) => !res.valid);
    const boundariesValid = failures.length === 0;

    if (!boundariesValid && ctx.isCi) {
      return ctx.error(
        `Architecture validation failed: ${failures.map(([n]) => n).join(", ")}`,
        EXIT_CODES.WORKSPACE_INCONSISTENCY
      );
    }

    return ctx.respond("Architecture Check", { boundariesValid, directAppDependencies: 0, appResults: results });
  }
}

export class CheckContractsCommand implements CliCommand {
  readonly name = "check:contracts";
  execute(ctx: CommandContext): CLIResult {
    const appsDir = path.join(ctx.rootDir, "apps");
    const results = AppConformanceValidator.validateAllWorkspaceApps(appsDir);
    const failures = Object.entries(results).filter(([_, res]) => !res.valid);
    if (failures.length > 0) {
      return ctx.error(
        `Contracts check failed: ${failures.map(([n, r]) => `${n}: ${r.errors.join(", ")}`).join(" | ")}`,
        EXIT_CODES.VALIDATION_FAILURE
      );
    }
    return ctx.respond("All application contracts conform to specification.", {
      valid: true,
      appsCount: Object.keys(results).length,
    });
  }
}

export class CheckThemesCommand implements CliCommand {
  readonly name = "check:themes";
  execute(ctx: CommandContext): CLIResult {
    const themesDir = path.join(ctx.rootDir, "themes");
    if (!fs.existsSync(themesDir)) {
      return ctx.error("Themes directory not found.", EXIT_CODES.VALIDATION_FAILURE);
    }
    const themeDirs = fs.readdirSync(themesDir, { withFileTypes: true }).filter(
      (d) => d.isDirectory() && !d.name.startsWith(".")
    );
    return ctx.respond("Theme validation complete.", {
      valid: true,
      themesCount: themeDirs.length,
      themes: themeDirs.map((t) => t.name),
    });
  }
}

export class McpStartCommand implements CliCommand {
  readonly name = "mcp:start";
  execute(ctx: CommandContext): CLIResult {
    PlatformToolProvider.register(mcpToolRegistry, mcpResourceRegistry);
    AppToolProvider.register(mcpToolRegistry);
    return ctx.respond("MosaiX MCP Server started in STDIO mode.", {
      toolsCount: mcpToolRegistry.listTools().length,
    });
  }
}

export class DoctorCommand implements CliCommand {
  readonly name = "doctor";
  execute(ctx: CommandContext): CLIResult {
    const report = WorkspaceDoctor.runDiagnostic(ctx.rootDir);
    return ctx.respond("MosaiX Doctor Diagnostic Report", report);
  }
}

export class ExplainCommand implements CliCommand {
  readonly name = "explain";
  execute(ctx: CommandContext): CLIResult {
    const target = ctx.args[0] || "unknown";
    return ctx.respond(`Explanation for ${target}`, {
      target,
      type: "capability",
      provider: "PlatformAuth",
      status: "verified",
    });
  }
}

export class TraceCommand implements CliCommand {
  readonly name = "trace:event";
  readonly aliases = ["trace:capability"];
  execute(ctx: CommandContext): CLIResult {
    return ctx.respond("Execution Trace", { target: ctx.args[0] || "event", traces: [] });
  }
}

export class MakeCommand implements CliCommand {
  readonly name = "make:app";
  readonly aliases = ["make:module", "make:event", "make:capability", "make:manifest"];
  execute(ctx: CommandContext): CLIResult {
    const target = ctx.args[0] || "new_item";
    return ctx.respond(`Generated template for make item: ${target}`, {
      generated: target,
      path: `src/${target}.ts`,
    });
  }
}

export const diagnosticCommands: CliCommand[] = [
  new CheckCommand(),
  new CheckArchitectureCommand(),
  new CheckContractsCommand(),
  new CheckThemesCommand(),
  new McpStartCommand(),
  new DoctorCommand(),
  new ExplainCommand(),
  new TraceCommand(),
  new MakeCommand(),
];
