/**
 * pnpm check:integrity [--strict] — bypass-analysis report over the repo.
 *
 * Uses @mosaix/conformance IntegrityConformanceSuite (rules sourced from
 * the 2026-09-26 bypass audit). Default mode is report-only (exit 0) so the
 * existing backlog can land first; `--strict` exits 1 on any `error`
 * finding and is the target CI gate (see DB-BYPASS-06).
 */
import { IntegrityConformanceSuite } from "../packages/conformance/src/suites/integrity.js";

async function main(): Promise<void> {
  const strict = process.argv.includes("--strict");
  const rootDir = process.cwd();
  const findings = IntegrityConformanceSuite.scan({ rootDir });
  const summary = IntegrityConformanceSuite.summarize(findings);

  console.log(
    `[check:integrity] ${findings.length} finding(s): ${summary.errors} error(s), ${summary.warns} warn(s)`,
  );
  for (const [ruleId, count] of Object.entries(summary.byRule).sort()) {
    console.log(`[check:integrity] - ${ruleId}: ${count}`);
  }
  for (const f of findings) {
    const level = f.severity === "error" ? "ERROR" : "WARN";
    console.log(
      `[check:integrity] [${level}] ${f.ruleId} ${f.file}:${f.line} — ${f.excerpt}`,
    );
  }

  if (strict && summary.errors > 0) {
    console.error(
      `[check:integrity] FAIL — ${summary.errors} error finding(s) (strict mode)`,
    );
    process.exit(1);
  }
  console.log(
    `[check:integrity] OK (report mode${strict ? ", strict clean" : "; pass --strict to enforce"})`,
  );
}

main().catch((err) => {
  console.error("[check:integrity]", err);
  process.exit(1);
});
