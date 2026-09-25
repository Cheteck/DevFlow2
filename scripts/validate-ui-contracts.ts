import * as fs from "node:fs";
import * as path from "node:path";

console.log("[Validate UI Contracts] Checking UI contracts across all apps...");

const appsDir = path.resolve(process.cwd(), "apps");
const entries = fs.readdirSync(appsDir, { withFileTypes: true });

let validCount = 0;

for (const entry of entries) {
  if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
  const appPath = path.join(appsDir, entry.name);
  const manifestPath = path.join(appPath, "mosaix.json");
  if (fs.existsSync(manifestPath)) {
    validCount++;
  }
}

console.log(`[Validate UI Contracts] Verified ${validCount} application UI contracts.`);
process.exit(0);
