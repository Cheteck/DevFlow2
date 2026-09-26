/**
 * @mosaix/conformance — Integrity Report & Formatter (JSON & SARIF).
 */
import type { IntegritySeverity } from "./rules.js";

export interface IntegrityFinding {
  ruleId: string;
  alias?: string;
  severity: IntegritySeverity;
  file: string;
  line: number;
  col: number;
  excerpt: string;
  message: string;
  remediation?: string;
}

export interface IntegritySummary {
  errors: number;
  warns: number;
  byRule: Record<string, number>;
}

export class IntegrityReport {
  static summarize(findings: IntegrityFinding[]): IntegritySummary {
    const byRule: Record<string, number> = {};
    let errors = 0;
    let warns = 0;
    for (const f of findings) {
      if (f.ruleId) {
        byRule[f.ruleId] = (byRule[f.ruleId] ?? 0) + 1;
      }
      if (f.alias) {
        byRule[f.alias] = (byRule[f.alias] ?? 0) + 1;
      }
      if (f.severity === "error") errors += 1;
      else warns += 1;
    }
    return { errors, warns, byRule };
  }

  static toJSON(findings: IntegrityFinding[], indent: number = 2): string {
    const summary = this.summarize(findings);
    return JSON.stringify({ summary, findings }, null, indent);
  }

  static toSARIF(findings: IntegrityFinding[]): string {
    const rulesMap = new Map<string, { id: string; name?: string; message: string; remediation?: string }>();
    for (const f of findings) {
      if (!rulesMap.has(f.ruleId)) {
        rulesMap.set(f.ruleId, {
          id: f.ruleId,
          name: f.alias,
          message: f.message,
          remediation: f.remediation,
        });
      }
    }

    const rules = Array.from(rulesMap.values()).map((r) => ({
      id: r.id,
      name: r.name ?? r.id,
      shortDescription: { text: r.message },
      help: r.remediation ? { text: r.remediation } : undefined,
    }));

    const results = findings.map((f) => ({
      ruleId: f.ruleId,
      level: f.severity === "error" ? "error" : "warning",
      message: { text: `${f.message} (Excerpt: ${f.excerpt})` },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: f.file },
            region: {
              startLine: f.line,
              startColumn: f.col,
            },
          },
        },
      ],
    }));

    const sarif = {
      $schema: "https://json.schemastore.org/sarif-2.1.0.json",
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "@mosaix/conformance",
              informationUri: "https://github.com/mosaix/mosaix",
              rules,
            },
          },
          results,
        },
      ],
    };

    return JSON.stringify(sarif, null, 2);
  }
}
