import * as fs from "node:fs";
import * as path from "node:path";

console.log("[Validate UI Contracts] Checking UI contracts across all apps...");

const appsDir = path.resolve(process.cwd(), "apps");
const entries = fs.readdirSync(appsDir, { withFileTypes: true });

let validCount = 0;
const errors: string[] = [];

for (const entry of entries) {
  if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
  const appPath = path.join(appsDir, entry.name);
  const manifestPath = path.join(appPath, "mosaix.json");

  if (!fs.existsSync(manifestPath)) {
    errors.push(`[${entry.name}] Missing manifest at ${manifestPath}`);
    continue;
  }

  try {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw) as Record<string, unknown>;

    const requiredTopFields = ["id", "name", "version"];
    for (const field of requiredTopFields) {
      if (manifest[field] === undefined || manifest[field] === null || manifest[field] === "") {
        errors.push(`[${entry.name}] Manifest field '${field}' is required but missing or empty`);
      }
    }

    const exp = manifest["experience"] as Record<string, unknown> | undefined;
    const appCard = exp?.["appCard"] as Record<string, unknown> | undefined;

    if (!appCard) {
      errors.push(`[${entry.name}] Manifest field 'experience.appCard' is required`);
    } else {
      if (!appCard["icon"]) {
        errors.push(`[${entry.name}] Manifest field 'experience.appCard.icon' is required`);
      }
      if (!appCard["title"]) {
        errors.push(`[${entry.name}] Manifest field 'experience.appCard.title' is required`);
      }
    }

    validCount++;
  } catch (err) {
    errors.push(`[${entry.name}] Failed to parse JSON manifest: ${err instanceof Error ? err.message : String(err)}`);
  }
}

if (errors.length > 0) {
  console.error("[Validate UI Contracts] UI contract validation failed with errors:");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log(`[Validate UI Contracts] Successfully verified ${validCount} application UI contracts.`);
process.exit(0);
