import * as path from "node:path";
import { AppConformanceValidator } from "../packages/conformance/src/index.js";

console.log("[Validate Conformance] Running conformance checks across all workspace apps...");

const appsDir = path.resolve(process.cwd(), "apps");
const results = AppConformanceValidator.validateAllWorkspaceApps(appsDir);

const failures = Object.entries(results).filter(([_, res]) => !res.valid);

if (failures.length > 0) {
  console.error("[Validate Conformance] Conformance validation failed for the following apps:");
  for (const [name, res] of failures) {
    console.error(` - ${name}: ${res.errors.join(", ")}`);
  }
  process.exit(1);
}

console.log(`[Validate Conformance] All ${Object.keys(results).length} apps conform to PRD-App specification.`);
process.exit(0);
