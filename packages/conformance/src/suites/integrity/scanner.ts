/**
 * @mosaix/conformance — Integrity Scanner.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { type IntegrityRule, INTEGRITY_RULES, TS_SOURCES } from "./rules.js";
import { isAllowed, isAlwaysSkipped, globMatch, toPosix } from "./allowlist.js";
import type { IntegrityFinding } from "./report.js";

export interface IntegrityScanOptions {
  rootDir?: string;
  rules?: IntegrityRule[];
  /** Extra allowlist entries appended to every rule. */
  globalAllow?: string[];
}

export function collectFiles(rootDir: string, include: string[]): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist") continue;
        walk(full);
        continue;
      }
      if (!entry.isFile() || !full.endsWith(".ts")) continue;
      const rel = toPosix(path.relative(rootDir, full));
      if (isAlwaysSkipped(rel)) continue;
      if (include.some((p) => globMatch(p, rel))) out.push(full);
    }
  };
  walk(rootDir);
  return out.sort();
}

export function scanIntegrity(options: IntegrityScanOptions = {}): IntegrityFinding[] {
  const rootDir = options.rootDir ?? process.cwd();
  const rules = options.rules ?? INTEGRITY_RULES.map((r) => ({ ...r }));
  const findings: IntegrityFinding[] = [];

  const include = Array.from(new Set(rules.flatMap((r) => r.include ?? TS_SOURCES)));
  const files = collectFiles(rootDir, include);

  for (const file of files) {
    const rel = toPosix(path.relative(rootDir, file));
    let content: string;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    const lines = content.split("\n");
    for (const rule of rules) {
      if (isAllowed(rel, rule, options.globalAllow)) continue;
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
          alias: rule.alias,
          severity: rule.severity,
          file: rel,
          line: idx + 1,
          col: match.index + 1,
          excerpt: line.trim().slice(0, 160),
          message: rule.message,
          remediation: rule.remediation,
        });
      });
    }
  }

  return findings.sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line
  );
}
