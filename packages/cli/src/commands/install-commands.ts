import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import type { CliCommand, CommandContext, CLIResult } from "../command.js";
import { EXIT_CODES, MosaixFolderManager } from "../folder-manager.js";
import { ensureEnvFile, readEnvFile, upsertEnvKeys } from "@mosaix/config";
import { MANAGED_SECRET_KEYS } from "./key-commands.js";

/**
 * `mosaix install` — first-time setup for a fresh checkout / server.
 * Fully non-interactive (safe over SSH / cloud-init), idempotent:
 * re-running only fills what is missing.
 *
 * Steps: preflight → .env bootstrap (+ secrets) → folders → deps →
 * database → admin → summary. Each heavy step is skippable.
 */

const INSTALL_HELP = [
  "Usage: mosaix install [options]",
  "",
  "First-time project setup (fresh clone / new server). Non-interactive and",
  "idempotent — safe to re-run; existing .env keys and admin are preserved.",
  "",
  "Steps: preflight → .env (+ secrets) → folders → deps → database → admin.",
  "",
  "Options:",
  "  --env=<path>          Env file to create/update (default: .env)",
  "  --admin-email=<mail>  Admin account email (default: admin@mosaix.local)",
  "  --admin-password=<pw> Admin password (generated + printed once if omitted)",
  "  --skip-deps           Skip pnpm install",
  "  --skip-db             Skip database setup (pnpm db:setup)",
  "  --skip-admin          Skip admin account creation",
  "  --force               Overwrite existing secrets / bypass Node version gate",
  "  --dry-run             Print the plan without changing anything",
  "  --help, -h            Show this help",
  "",
  "Examples:",
  "  mosaix install --dry-run",
  "  mosaix install --admin-email=ops@example.com",
  "  mosaix install --skip-deps --skip-db",
].join("\n");

function parseFlag(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(`--${name}`);
}

function run(
  cmd: string,
  cmdArgs: string[],
  cwd: string,
  extraEnv?: Record<string, string>,
): { ok: boolean; code: number } {
  const res = spawnSync(cmd, cmdArgs, {
    cwd,
    stdio: "inherit",
    shell: true,
    env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
  });
  const code = res.status ?? 1;
  return { ok: code === 0, code };
}

export class InstallCommand implements CliCommand {
  readonly name = "install";
  readonly aliases = ["setup"];

  execute(ctx: CommandContext): CLIResult {
    const args = ctx.args;
    if (hasFlag(args, "help") || args.includes("-h")) {
      return ctx.respond(INSTALL_HELP, { help: true });
    }

    const dryRun = hasFlag(args, "dry-run");
    const force = hasFlag(args, "force");
    const envName = parseFlag(args, "env") ?? ".env";
    const envPath = path.join(ctx.rootDir, envName);
    const adminEmail = parseFlag(args, "admin-email") ?? "admin@mosaix.local";
    const adminPassword = parseFlag(args, "admin-password");
    const skipDeps = hasFlag(args, "skip-deps");
    const skipDb = hasFlag(args, "skip-db");
    const skipAdmin = hasFlag(args, "skip-admin");
    const steps: Array<{ step: string; status: string; detail?: string }> = [];

    // ── 1. Preflight ──
    const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
    if (Number.isNaN(nodeMajor) || nodeMajor < 22) {
      if (!force) {
        return ctx.error(
          `Node.js 22+ required (found ${process.versions.node}). Upgrade, or re-run with --force to bypass.`,
          EXIT_CODES.INVALID_CONFIGURATION,
        );
      }
      steps.push({
        step: "preflight",
        status: "bypassed",
        detail: `node ${process.versions.node} (--force)`,
      });
    } else {
      steps.push({
        step: "preflight",
        status: "ok",
        detail: `node ${process.versions.node}`,
      });
    }
    if (!fs.existsSync(path.join(ctx.rootDir, ".env.example"))) {
      return ctx.error(
        ".env.example not found — run from the repository root.",
        EXIT_CODES.INVALID_CONFIGURATION,
      );
    }

    // ── 2. Env bootstrap ──
    const before = readEnvFile(envPath);
    const missingSecrets = Object.keys(MANAGED_SECRET_KEYS).filter(
      (k) => (before[k] ?? "") === "",
    );
    if (dryRun) {
      steps.push({
        step: "env",
        status: "plan",
        detail: `${fs.existsSync(envPath) ? "update" : "create"} ${envName}, generate: ${missingSecrets.join(", ") || "none"}`,
      });
    } else {
      const { created } = ensureEnvFile(
        envPath,
        path.join(ctx.rootDir, ".env.example"),
      );
      const generated: Record<string, string> = {};
      for (const k of missingSecrets) generated[k] = MANAGED_SECRET_KEYS[k]();
      // Keep an explicit admin password in the env file so servers are reproducible.
      if (adminPassword && (before.ADMIN_PASSWORD ?? "") === "")
        generated.ADMIN_PASSWORD = adminPassword;
      const res = upsertEnvKeys(envPath, generated, { force });
      steps.push({
        step: "env",
        status: "ok",
        detail: `${created ? "created" : "updated"} ${envName} (+${res.updated.length} keys: ${res.updated.join(", ") || "none"})`,
      });
    }

    // ── 3. Folders ──
    if (dryRun) {
      steps.push({
        step: "folders",
        status: "plan",
        detail: ".mosaix/* + data/",
      });
    } else {
      new MosaixFolderManager(ctx.rootDir).ensureFolderStructure();
      fs.mkdirSync(path.join(ctx.rootDir, "data"), { recursive: true });
      steps.push({
        step: "folders",
        status: "ok",
        detail: ".mosaix/* + data/",
      });
    }

    // ── 4. Dependencies ──
    if (skipDeps) {
      steps.push({ step: "deps", status: "skipped" });
    } else if (dryRun) {
      steps.push({
        step: "deps",
        status: "plan",
        detail: "pnpm install --frozen-lockfile",
      });
    } else {
      const r = run("pnpm", ["install", "--frozen-lockfile"], ctx.rootDir);
      if (!r.ok)
        return ctx.error(
          "Dependency install failed (pnpm install --frozen-lockfile).",
          EXIT_CODES.BUILD_FAILURE,
        );
      steps.push({
        step: "deps",
        status: "ok",
        detail: "pnpm install --frozen-lockfile",
      });
    }

    // ── 5. Database ──
    if (skipDb) {
      steps.push({ step: "db", status: "skipped" });
    } else if (dryRun) {
      steps.push({ step: "db", status: "plan", detail: "pnpm db:setup" });
    } else {
      const r = run("pnpm", ["db:setup"], ctx.rootDir);
      if (!r.ok)
        return ctx.error(
          "Database setup failed (pnpm db:setup).",
          EXIT_CODES.BUILD_FAILURE,
        );
      steps.push({ step: "db", status: "ok", detail: "pnpm db:setup" });
    }

    // ── 6. Admin ──
    if (skipAdmin) {
      steps.push({ step: "admin", status: "skipped" });
    } else if (dryRun) {
      steps.push({
        step: "admin",
        status: "plan",
        detail: `create ${adminEmail}${adminPassword ? " (explicit password)" : " (generated, printed once)"}`,
      });
    } else {
      const extraEnv: Record<string, string> = { ADMIN_EMAIL: adminEmail };
      if (adminPassword) extraEnv.ADMIN_PASSWORD = adminPassword;
      const r = run(
        "pnpm",
        ["exec", "tsx", "scripts/init-dev-admin.ts"],
        ctx.rootDir,
        extraEnv,
      );
      if (!r.ok)
        return ctx.error(
          "Admin creation failed (scripts/init-dev-admin.ts).",
          EXIT_CODES.BUILD_FAILURE,
        );
      steps.push({ step: "admin", status: "ok", detail: adminEmail });
    }

    const after = dryRun ? before : readEnvFile(envPath);
    const port = after.MOSAIX_PORT || after.APP_PORT || after.PORT || "3000";
    return ctx.respond(
      dryRun
        ? "Install plan (nothing changed — remove --dry-run to apply)."
        : "Install complete.",
      {
        dryRun,
        steps,
        next: [
          `pnpm dev  →  http://localhost:${port}/`,
          `pnpm start (prod)`,
          `pnpm docker:up (stack)`,
        ],
      },
    );
  }
}

export const installCommands: CliCommand[] = [new InstallCommand()];
