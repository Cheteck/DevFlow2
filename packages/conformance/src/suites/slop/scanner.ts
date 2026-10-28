/**
 * @mosaix/conformance — Slop Checker Hybrid Scanner (PRD-0012)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { SlopRule } from "./rules.js";
import { loadSlopConfig } from "./config.ts";
import { resolveScopeFiles, SlopScopeName } from "./scope.ts";
import { globMatch, isAllowed } from "../integrity/allowlist.js";

export interface SlopFinding {
  ruleId: string;
  alias: string;
  severity: "error" | "warn";
  path: string;
  line: number;
  column: number;
  message: string;
  remediation: string;
  excerpt?: string;
  fingerprint: string;
}

export interface SlopReportSummary {
  totalFilesAnalyzed: number;
  errorCount: number;
  warnCount: number;
  pass: boolean;
}

export interface SlopReportJson {
  version: number;
  summary: SlopReportSummary;
  findings: SlopFinding[];
}

export interface SlopScanOptions {
  rootDir?: string;
  scopes?: SlopScopeName[];
  base?: string;
  strict?: boolean;
  allow?: string[];
  rules?: SlopRule[];
}

export function scanSlop(options: SlopScanOptions = {}): SlopReportJson {
  const rootDir = options.rootDir ?? process.cwd();
  const config = loadSlopConfig(rootDir);

  const scopes = options.scopes ?? config.scopes;
  const base = options.base ?? config.base;
  const isStrict = options.strict ?? config.strict;
  const rules = options.rules ?? config.rules;

  const targetFiles = resolveScopeFiles({ rootDir, scopes, base });
  const findings: SlopFinding[] = [];

  const globalAllowPatterns = [
    ...config.globalAllow.map((a) => a.path),
    ...(options.allow ?? []),
  ];

  for (const fileRel of targetFiles) {
    const fullPath = path.join(rootDir, fileRel);
    let content: string;
    try {
      content = fs.readFileSync(fullPath, "utf-8");
    } catch {
      continue;
    }

    const lines = content.split("\n");

    for (const rule of rules) {
      // Check global & rule allowlists
      if (isAllowed(fileRel, rule, globalAllowPatterns)) continue;

      // Check specific SlopAllowEntry with ruleId match
      const isExplicitlyAllowed = config.globalAllow.some(
        (entry) => entry.ruleId === rule.id && globMatch(entry.path, fileRel),
      );
      if (isExplicitlyAllowed) continue;

      lines.forEach((line, idx) => {
        const match = rule.pattern.exec(line);
        if (!match) return;

        if (rule.refine && !rule.refine(line, match)) return;

        const lineNum = idx + 1;
        const colNum = match.index + 1;
        const fingerprintSrc = `${rule.id}:${fileRel}:${lineNum}:${colNum}`;
        const fingerprint = crypto
          .createHash("sha256")
          .update(fingerprintSrc)
          .digest("hex")
          .slice(0, 16);

        findings.push({
          ruleId: rule.id,
          alias: rule.alias,
          severity: rule.severity,
          path: fileRel,
          line: lineNum,
          column: colNum,
          message: rule.message,
          remediation: rule.remediation,
          excerpt: line.trim().slice(0, 160),
          fingerprint,
        });
      });
    }
  }

  // Deterministic sorting: path -> line -> ruleId
  findings.sort(
    (a, b) =>
      a.path.localeCompare(b.path) ||
      a.line - b.line ||
      a.ruleId.localeCompare(b.ruleId),
  );

  const errorCount = findings.filter((f) => f.severity === "error").length;
  const warnCount = findings.filter((f) => f.severity === "warn").length;

  const pass = isStrict
    ? errorCount === 0 && warnCount === 0
    : errorCount === 0;

  return {
    version: 1,
    summary: {
      totalFilesAnalyzed: targetFiles.length,
      errorCount,
      warnCount,
      pass,
    },
    findings,
  };
}
