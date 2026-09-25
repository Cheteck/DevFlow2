import * as path from "node:path";
import type { CliCommand, CommandContext, CLIResult } from "../command.js";
import { EXIT_CODES } from "../folder-manager.js";
import {
  generateAppKey,
  generateSecret,
  isValidAppKey,
  readAppKeyEnv,
  ensureEnvFile,
  readEnvFile,
  upsertEnvKeys,
} from "@mosaix/config";

/**
 * Secret keys managed automatically (Laravel `key:generate` semantics:
 * only missing keys are written, never overwrite without `--force`).
 * Externally-owned credentials (PSP webhook, OAuth, explicit admin password)
 * are intentionally excluded — use `--key=NAME` for those.
 */
export const MANAGED_SECRET_KEYS: Record<string, () => string> = {
  MOSAIX_APP_KEY: () => generateAppKey(),
  MOSAIX_AUTH_JWT_SECRET: () => generateSecret({ bytes: 32 }),
  MOSAIX_SESSION_SECRET: () => generateSecret({ bytes: 32 }),
  MOSAIX_CDN_SECRET: () => generateSecret({ bytes: 32 }),
};

function parseFlag(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

function hasFlag(args: string[], ...names: string[]): boolean {
  return names.some((n) => args.includes(`--${n}`));
}

function isProductionEnv(values: Record<string, string>): boolean {
  return values.MOSAIX_ENV === "production" || values.NODE_ENV === "production";
}

function mask(value: string): string {
  return value.length <= 11
    ? "********"
    : `${value.slice(0, 7)}…${value.slice(-4)}`;
}

const KEY_GENERATE_HELP = [
  "Usage: mosaix key:generate [options]",
  "",
  "Generate missing application secrets (Laravel-style) and write them to .env.",
  "Existing keys are kept unless --force is passed.",
  "",
  "Options:",
  "  --env=<path>           Env file to update (default: .env)",
  "  --key=<NAME>           Generate a single key (e.g. --key=PSP_WEBHOOK_SECRET)",
  "  --length=<bytes>       Entropy in bytes for --key (default: 32, min: 16)",
  "  --encoding=<enc>       hex (default) or base64url, for --key only",
  "  --show                 Print generated values instead of writing the file",
  "  --force                Overwrite existing keys (required in production)",
  "  --help, -h             Show this help",
  "",
  "Examples:",
  "  mosaix key:generate",
  "  mosaix key:generate --show",
  "  mosaix key:generate --key=PSP_WEBHOOK_SECRET --force",
].join("\n");

export class KeyGenerateCommand implements CliCommand {
  readonly name = "key:generate";

  execute(ctx: CommandContext): CLIResult {
    const args = ctx.args;
    if (hasFlag(args, "help") || args.includes("-h")) {
      return ctx.respond(KEY_GENERATE_HELP, { help: true });
    }

    const envPath = path.join(ctx.rootDir, parseFlag(args, "env") ?? ".env");
    const show = hasFlag(args, "show");
    const force = hasFlag(args, "force");
    const singleKey = parseFlag(args, "key");
    const encoding = parseFlag(args, "encoding") ?? "hex";
    if (encoding !== "hex" && encoding !== "base64url") {
      return ctx.error(
        "--encoding must be hex or base64url.",
        EXIT_CODES.INVALID_CONFIGURATION,
      );
    }

    let entries: Record<string, () => string>;
    if (singleKey) {
      if (!/^[A-Z][A-Z0-9_]*$/.test(singleKey)) {
        return ctx.error(
          `Invalid key name "${singleKey}" (expected UPPER_SNAKE_CASE).`,
          EXIT_CODES.INVALID_CONFIGURATION,
        );
      }
      const length = parseFlag(args, "length")
        ? Number.parseInt(parseFlag(args, "length")!, 10)
        : 32;
      if (!Number.isInteger(length) || length < 16) {
        return ctx.error(
          "--length must be an integer >= 16.",
          EXIT_CODES.INVALID_CONFIGURATION,
        );
      }
      entries =
        singleKey === "MOSAIX_APP_KEY"
          ? { [singleKey]: () => generateAppKey() }
          : {
              [singleKey]: () =>
                generateSecret({
                  bytes: length,
                  encoding: encoding as "hex" | "base64url",
                }),
            };
    } else {
      entries = MANAGED_SECRET_KEYS;
    }

    const current = { ...readEnvFile(envPath), ...pickDefined(process.env) };
    if (isProductionEnv(current) && !force && !show) {
      const existing = Object.keys(entries).filter(
        (k) => (current[k] ?? "") !== "",
      );
      if (existing.length > 0) {
        return ctx.error(
          `Refusing to overwrite ${existing.join(", ")} in production without --force.`,
          EXIT_CODES.INVALID_CONFIGURATION,
        );
      }
    }

    const generated: Record<string, string> = {};
    for (const [key, gen] of Object.entries(entries)) generated[key] = gen();

    if (show) {
      return ctx.respond(
        "Generated keys (not written — remove --show to write).",
        generated,
      );
    }

    const { created } = ensureEnvFile(
      envPath,
      path.join(ctx.rootDir, ".env.example"),
    );
    const result = upsertEnvKeys(envPath, generated, { force });
    const display: Record<string, string> = {};
    for (const k of result.updated) display[k] = mask(generated[k]);
    return ctx.respond(
      `Keys written to ${path.basename(envPath)}${created ? " (created from .env.example)" : ""}.`,
      {
        file: envPath,
        updated: result.updated,
        skipped: result.skipped,
        values: display,
      },
    );
  }
}

const KEY_CHECK_HELP = [
  "Usage: mosaix key:check [options]",
  "",
  "Verify secret presence and entropy (safe for CI / pre-deploy gates).",
  "Exits non-zero when a required secret is missing or weak.",
  "",
  "Options:",
  "  --env=<path>   Env file to inspect (default: .env, merged with process env)",
  "  --help, -h     Show this help",
].join("\n");

interface KeyFinding {
  key: string;
  status: "ok" | "missing" | "weak" | "invalid";
  detail: string;
}

export class KeyCheckCommand implements CliCommand {
  readonly name = "key:check";

  execute(ctx: CommandContext): CLIResult {
    const args = ctx.args;
    if (hasFlag(args, "help") || args.includes("-h")) {
      return ctx.respond(KEY_CHECK_HELP, { help: true });
    }
    const envPath = path.join(ctx.rootDir, parseFlag(args, "env") ?? ".env");
    const values = { ...readEnvFile(envPath), ...pickDefined(process.env) };
    const production = isProductionEnv(values);
    const findings: KeyFinding[] = [];

    const { key, cipher } = readAppKeyEnv(values);
    if (!key) {
      findings.push({
        key: "MOSAIX_APP_KEY",
        status: "missing",
        detail: "not set — run mosaix key:generate",
      });
    } else if (!isValidAppKey(key, cipher)) {
      findings.push({
        key: "MOSAIX_APP_KEY",
        status: "invalid",
        detail: `must be base64: of ${cipher === "AES-128-CBC" ? 16 : 32} bytes`,
      });
    } else {
      findings.push({
        key: "MOSAIX_APP_KEY",
        status: "ok",
        detail: `valid ${cipher}`,
      });
    }

    for (const name of ["MOSAIX_AUTH_JWT_SECRET", "MOSAIX_SESSION_SECRET"]) {
      const v = values[name] ?? "";
      if (v.length >= 32)
        findings.push({ key: name, status: "ok", detail: `${v.length} chars` });
      else if (v.length === 0)
        findings.push({
          key: name,
          status: production ? "missing" : "weak",
          detail: production
            ? "required in production"
            : "missing (dev fallback active)",
        });
      else
        findings.push({
          key: name,
          status: "weak",
          detail: `${v.length} chars, need >= 32`,
        });
    }

    const cdn = values.MOSAIX_CDN_SECRET ?? "";
    findings.push(
      cdn.length === 0
        ? {
            key: "MOSAIX_CDN_SECRET",
            status: "weak",
            detail: "missing (dev fallback active)",
          }
        : cdn.length >= 8
          ? {
              key: "MOSAIX_CDN_SECRET",
              status: "ok",
              detail: `${cdn.length} chars`,
            }
          : {
              key: "MOSAIX_CDN_SECRET",
              status: "weak",
              detail: "need >= 8 chars",
            },
    );

    const failed = findings.filter(
      (f) =>
        f.status === "missing" ||
        f.status === "invalid" ||
        (production && f.status === "weak"),
    );
    if (failed.length > 0) {
      return ctx.error(
        `key:check failed (${failed.map((f) => f.key).join(", ")}).`,
        EXIT_CODES.VALIDATION_FAILURE,
      );
    }
    return ctx.respond("All required secrets look good.", {
      production,
      findings,
    });
  }
}

/** Defined string entries of process.env as a plain record. */
function pickDefined(
  source: Record<string, string | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(source)) if (v !== undefined) out[k] = v;
  return out;
}

export const keyCommands: CliCommand[] = [
  new KeyGenerateCommand(),
  new KeyCheckCommand(),
];
