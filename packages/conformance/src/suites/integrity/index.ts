/**
 * @mosaix/conformance — Integrity suite entrypoint.
 */
import { INTEGRITY_RULES, type IntegrityRule, type IntegritySeverity } from "./rules.js";
import { scanIntegrity, type IntegrityScanOptions } from "./scanner.js";
import { IntegrityReport, type IntegrityFinding, type IntegritySummary } from "./report.js";

export { INTEGRITY_RULES } from "./rules.js";
export type { IntegrityRule, IntegritySeverity } from "./rules.js";
export { scanIntegrity } from "./scanner.js";
export type { IntegrityScanOptions } from "./scanner.js";
export { IntegrityReport } from "./report.js";
export type { IntegrityFinding, IntegritySummary } from "./report.js";

export class IntegrityConformanceSuite {
  static defaultRules(): IntegrityRule[] {
    return INTEGRITY_RULES.map((r) => ({ ...r }));
  }

  static scan(options: IntegrityScanOptions = {}): IntegrityFinding[] {
    return scanIntegrity(options);
  }

  static summarize(findings: IntegrityFinding[]): IntegritySummary {
    return IntegrityReport.summarize(findings);
  }

  static toJSON(findings: IntegrityFinding[], indent?: number): string {
    return IntegrityReport.toJSON(findings, indent);
  }

  static toSARIF(findings: IntegrityFinding[]): string {
    return IntegrityReport.toSARIF(findings);
  }
}
