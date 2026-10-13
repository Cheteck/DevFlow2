/**
 * @mosaix/cli — Slop Checker CLI Commands (PRD-0012)
 */

import type { CliCommand, CommandContext, CLIResult } from "../command.js";
import { scanSlop, SlopScopeName, SlopExecutionError } from "@mosaix/conformance";

export const SLOP_EXIT_CODES = {
  SUCCESS: 0,
  QUALITY_VIOLATION: 1,
  SYSTEM_ERROR: 2,
};

export class CheckSlopCommand implements CliCommand {
  readonly name = "check:slop";
  readonly aliases = ["slop"];

  execute(ctx: CommandContext): CLIResult {
    let scopes: SlopScopeName[] = ["code"];
    let base = "origin/main";
    let isStrict = false;
    let allowGlobs: string[] = [];

    // Parse CLI arguments
    for (const arg of ctx.args) {
      if (arg.startsWith("--scope=")) {
        const val = arg.replace("--scope=", "").trim();
        scopes = val.split(",").map((s) => s.trim()) as SlopScopeName[];
      } else if (arg.startsWith("--base=")) {
        base = arg.replace("--base=", "").trim();
      } else if (arg === "--strict") {
        isStrict = true;
      } else if (arg.startsWith("--allow=")) {
        allowGlobs.push(arg.replace("--allow=", "").trim());
      }
    }

    try {
      const report = scanSlop({
        rootDir: ctx.rootDir,
        scopes,
        base,
        strict: isStrict,
        allow: allowGlobs,
      });

      const exitCode = report.summary.pass
        ? SLOP_EXIT_CODES.SUCCESS
        : SLOP_EXIT_CODES.QUALITY_VIOLATION;

      if (ctx.isJson) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(`[mosaix slop] Analyzed ${report.summary.totalFilesAnalyzed} files.`);
        if (report.findings.length === 0) {
          console.log("[mosaix slop] OK - No slop findings detected.");
        } else {
          for (const f of report.findings) {
            const prefix = f.severity === "error" ? "ERROR" : "WARN";
            console.log(`  [${prefix}] ${f.path}:${f.line}:${f.column} — ${f.ruleId} (${f.alias}): ${f.message}`);
            if (f.excerpt) {
              console.log(`          > ${f.excerpt}`);
            }
          }
          console.log(`[mosaix slop] Summary: ${report.summary.errorCount} error(s), ${report.summary.warnCount} warning(s).`);
        }
      }

      return {
        exitCode,
        message: report.summary.pass ? "Slop check passed." : "Slop check failed.",
        data: report,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (ctx.isJson) {
        console.error(
          JSON.stringify(
            {
              version: 1,
              status: "system_error",
              exitCode: SLOP_EXIT_CODES.SYSTEM_ERROR,
              error: errorMsg,
            },
            null,
            2
          )
        );
      } else {
        console.error(`[mosaix slop error] System execution failure: ${errorMsg}`);
      }

      return {
        exitCode: SLOP_EXIT_CODES.SYSTEM_ERROR,
        message: errorMsg,
      };
    }
  }
}

export const slopCommands: CliCommand[] = [new CheckSlopCommand()];
