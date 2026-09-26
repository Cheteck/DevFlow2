/**
 * @mosaix/conformance — Integrity (bypass-analysis) suite.
 *
 * Static source scan that detects implementations bypassing the MosaiX
 * database/session/framework systems. Rules come from the 2026-09-26
 * bypass audit (`.project/reports/db-bypass-audit-2026-09-26.md`):
 * each rule encodes one proven bypass class with a scoped allowlist, so
 * adding a rule here is how a new bypass class becomes CI-enforced.
 *
 * Pure + dependency-free (node:fs/path only): usable in CI, scripts and
 * tests. Findings carry severity — `error` blocks `--strict` runs, `warn`
 * is report-only until the backlog items land.
 */
import * as fs from "node:fs";
import * as path from "node:path";

export type IntegritySeverity = "error" | "warn";

export interface IntegrityFinding {
  ruleId: string;
  severity: IntegritySeverity;
  file: string;
  line: number;
  excerpt: string;
  message: string;
}

export interface IntegrityRule {
  id: string;
  severity: IntegritySeverity;
  message: string;
  /** Case-insensitive regex tested per line (must NOT use the /g/ flag). */
  pattern: RegExp;
  /**
   * Optional precision filter applied to the first captured group.
   * Used when a pure regex would be too noisy (e.g. brand names that
   * need no translation key).
   */
  refine?: (captured: string) => boolean;
  /** File allowlist (relative POSIX path). Matched files are skipped. */
  allow?: string[];
  /** Only scan files matching at least one of these (default: TS sources). */
  include?: string[];
}

export interface IntegrityScanOptions {
  rootDir?: string;
  rules?: IntegrityRule[];
  /** Extra allowlist entries appended to every rule. */
  globalAllow?: string[];
}

const TS_SOURCES = [
  "src/**/*.ts",
  "apps/**/*.ts",
  "packages/**/*.ts",
  "scripts/**/*.ts",
];

const ALWAYS_SKIP = [
  "**/node_modules/**",
  "**/dist/**",
  "**/*.test.ts",
  "**/*.spec.ts",
  // Self-hosting guard: the rule definitions below contain the very keywords
  // they detect (e.g. "CREATE TABLE" in messages/patterns).
  "packages/conformance/src/suites/integrity.ts",
];

/** Minimal glob matcher (`**`, `*`, `?`) over `/`-separated paths. */
function globMatch(pattern: string, relPath: string): boolean {
  const escape = (s: string): string => s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  let regex = "";
  const parts = pattern.split("**");
  parts.forEach((part, i) => {
    if (i > 0) regex += ".*";
    regex += escape(part).replace(/\\\*/g, "[^/]*").replace(/\\\?/g, "[^/]");
  });
  return new RegExp(`^${regex}$`).test(relPath);
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

function collectFiles(rootDir: string, include: string[]): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist") continue;
        walk(full);
        continue;
      }
      if (!entry.isFile() || !full.endsWith(".ts")) continue;
      const rel = toPosix(path.relative(rootDir, full));
      if (ALWAYS_SKIP.some((p) => globMatch(p, rel))) continue;
      if (include.some((p) => globMatch(p, rel))) out.push(full);
    }
  };
  walk(rootDir);
  return out.sort();
}

/**
 * Canonical bypass rules. `allow` entries are load-bearing: each one names
 * the legitimate owner of the pattern (engine, grammar, adapter, provider).
 */
export const INTEGRITY_RULES: IntegrityRule[] = [
  {
    id: "no-ddl-outside-migrations",
    severity: "error",
    message:
      "DDL outside the migration engine — schema must come from a MigrationProvider (Registry → Planner → Runner), never from ad-hoc CREATE TABLE.",
    pattern: /CREATE\s+(TABLE|INDEX|UNIQUE\s+INDEX)/i,
    include: TS_SOURCES,
    allow: [
      "packages/migrations/**",
      "**/migrations.ts",
      "**/migration-*.ts",
      "src/shell/database/core-migration.ts",
      "src/shell/theme/theme-migrations.ts",
      // Governance preview SQL (never executed — review display only).
      "apps/imperia/src/domain/migration-governance.service.ts",
    ],
  },
  {
    id: "no-direct-sqlite-driver",
    severity: "error",
    message:
      "Direct SQLite driver import — storage must go through DatabasePort/adapters, never node:sqlite directly.",
    pattern: /node:sqlite|DatabaseSync|better-sqlite3/i,
    include: TS_SOURCES,
    allow: ["packages/adapters/database-sqlite/**"],
  },
  {
    id: "no-swallowed-db-errors",
    severity: "warn",
    message:
      "Swallowed persistence error (.catch(() => null/[])) — DB failures become silent divergence between memory and storage.",
    pattern: /\.catch\(\s*\(\s*\)\s*=>\s*(null|\[\])\s*\)/,
    include: ["src/**/*.ts", "apps/**/*.ts"],
  },
  {
    id: "no-memory-session-stores",
    severity: "error",
    message:
      "Process-memory session/auth store — sessions, codes and device bindings must live in the database (restart-safe, multi-instance).",
    pattern:
      /(authCodes|drafts|storedCodes)\s*=\s*new\s+Map|private\s+static\s+(sessions|devices)\s*=\s*new\s+Map/i,
    include: ["src/**/*.ts", "apps/**/*.ts", "packages/**/*.ts"],
  },
  {
    id: "no-plaintext-password-defaults",
    severity: "error",
    message:
      "Password held in cleartext process state — hash at collection or collect only at finalize; never persist cleartext.",
    pattern: /password\s*:\s*""/,
    include: ["src/**/*.ts", "apps/**/*.ts"],
  },
  {
    id: "no-direct-identities-sql",
    severity: "error",
    message:
      "Raw SQL on the identities table outside the identity adapter — all identity reads/writes go through the IdentityStore port.",
    pattern: /(FROM|INTO|UPDATE)\s+identities/i,
    include: TS_SOURCES,
    allow: [
      "packages/adapters/identity-store-sqlite/**",
      "packages/adapters/identity-store-postgres/**",
      "src/shell/anonymization-orchestrator.ts",
      // Install/seed provisioning scripts (DML only — DDL stays banned there).
      "scripts/**",
    ],
  },
  {
    id: "no-math-random-ids",
    severity: "warn",
    message:
      "Math.random() entity IDs — use the id-uuid/id-ulid ports (collision-safe, non-predictable).",
    pattern: /Math\.random\(\)/,
    include: ["src/**/*.ts", "apps/**/*.ts"],
  },
  {
    id: "no-mock-in-prod-path",
    severity: "warn",
    message:
      "Mock default in a production path (mock tokens, isMockMode: true) — fail fast in production instead.",
    pattern: /isMockMode\s*[:=]\s*true|mock_token/i,
    include: ["src/**/*.ts", "apps/**/*.ts", "packages/**/*.ts"],
  },
  {
    id: "no-hardcoded-ui-text",
    severity: "warn",
    message:
      "Hardcoded user-facing text — extract to translation keys once the i18n catalog exists (see themes/_template/locales). No i18n infra in src/apps yet, so this stays warn by design.",
    pattern:
      />([^<>]{4,})<|(?:title|placeholder|aria-label|aria-description|alt)=["']([^"'<>]{3,})["']|(?:showToast|promiseConfirm)\(\s*['"]([^'"]{3,})['"]/,
    include: [
      "**/pages/**/*.ts",
      "**/presentation/**/*.ts",
      "**/views/**/*.ts",
      "**/renderer.ts",
      "**/*client-scripts.ts",
      "**/components/**/*.ts",
    ],
    refine: (captured: string): boolean => {
      // Interpolation-only content (${...}) carries no hardcoded text.
      const literal = captured
        .replace(/\$\{[^}]*\}/g, "")
        .replace(/\{[^}]*\}/g, "")
        .trim();
      // Brand / product names need no translation key.
      if (/^(mosaix)(\s+platform)?$/i.test(literal)) return false;
      if (!/[a-zàâäéèêëîïôöùûüÿæœç]/i.test(literal)) return false;
      // Single short tokens without spaces or diacritics are accepted as-is
      // (cheap to key later, too noisy to gate): catch sentences instead.
      return (
        /[\sàâäéèêëîïôöùûüÿæœç]/.test(literal) || literal.length >= 10
      );
    },
  },
];

export class IntegrityConformanceSuite {
  static defaultRules(): IntegrityRule[] {
    return INTEGRITY_RULES.map((r) => ({ ...r }));
  }

  static scan(options: IntegrityScanOptions = {}): IntegrityFinding[] {
    const rootDir = options.rootDir ?? process.cwd();
    const rules = options.rules ?? this.defaultRules();
    const findings: IntegrityFinding[] = [];

    const include = Array.from(
      new Set(rules.flatMap((r) => r.include ?? TS_SOURCES)),
    );
    for (const file of collectFiles(rootDir, include)) {
      const rel = toPosix(path.relative(rootDir, file));
      let content: string;
      try {
        content = fs.readFileSync(file, "utf-8");
      } catch {
        continue;
      }
      const lines = content.split("\n");
      for (const rule of rules) {
        if ((rule.allow ?? []).some((p) => globMatch(p, rel))) continue;
        if ((options.globalAllow ?? []).some((p) => globMatch(p, rel)))
          continue;
        const scope = rule.include ?? TS_SOURCES;
        if (!scope.some((p) => globMatch(p, rel))) continue;
        lines.forEach((line, idx) => {
          const match = rule.pattern.exec(line);
          if (!match) return;
          if (rule.refine) {
            const captured = match.slice(1).find((g) => g !== undefined) ?? "";
            if (!rule.refine(captured)) return;
          }
          findings.push({
            ruleId: rule.id,
            severity: rule.severity,
            file: rel,
            line: idx + 1,
            excerpt: line.trim().slice(0, 160),
            message: rule.message,
          });
        });
      }
    }
    return findings.sort(
      (a, b) => a.file.localeCompare(b.file) || a.line - b.line,
    );
  }

  static summarize(findings: IntegrityFinding[]): {
    errors: number;
    warns: number;
    byRule: Record<string, number>;
  } {
    const byRule: Record<string, number> = {};
    let errors = 0;
    let warns = 0;
    for (const f of findings) {
      byRule[f.ruleId] = (byRule[f.ruleId] ?? 0) + 1;
      if (f.severity === "error") errors += 1;
      else warns += 1;
    }
    return { errors, warns, byRule };
  }
}
