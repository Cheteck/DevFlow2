/**
 * @mosaix — CI Theme Validation Script (Phase 5)
 * Validates theme manifests, tokens, security guardrails (grep-guard),
 * asset presets, contract versions, and emits resolution tables when requested.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { ThemeManifestSchema } from "../packages/schemas/src/index.js";

function checkThemes() {
  console.log("[Check Themes] Starting comprehensive system themes validation...");
  const themesDir = path.resolve(process.cwd(), "themes");
  const emitResolutionTable = process.argv.includes("--emit-resolution-table");

  if (!fs.existsSync(themesDir)) {
    console.error(`[Check Themes] Error: Themes directory '${themesDir}' does not exist.`);
    process.exit(1);
  }

  const entries = fs.readdirSync(themesDir, { withFileTypes: true });
  let hasError = false;
  let count = 0;
  const resolutionTable: Record<string, unknown> = {};

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith(".") || entry.name.startsWith("_")) {
        continue;
      }

      // 1. Safe themeId string check
      if (!/^[a-zA-Z0-9-]+$/.test(entry.name)) {
        console.error(`[Check Themes] Error: Invalid characters in theme directory name '${entry.name}'.`);
        hasError = true;
        continue;
      }

      const themeDir = path.join(themesDir, entry.name);
      const manifestPath = path.join(themeDir, "theme.json");
      if (!fs.existsSync(manifestPath)) {
        console.error(`[Check Themes] Error: Missing 'theme.json' in theme directory '${entry.name}'.`);
        hasError = true;
        continue;
      }

      // 2. preview.png mandatory check
      const previewPath = path.join(themeDir, "preview.png");
      if (!fs.existsSync(previewPath)) {
        console.error(`[Check Themes] Error: Missing required 'preview.png' in theme '${entry.name}'.`);
        hasError = true;
      }

      try {
        const rawContent = fs.readFileSync(manifestPath, "utf-8");
        const json = JSON.parse(rawContent);

        // Fail-Fast: validate against Zod schema
        const result = ThemeManifestSchema.safeParse(json);
        if (!result.success) {
          console.error(`[Check Themes] Error: Theme manifest validation failed for '${entry.name}':`);
          console.error(JSON.stringify(result.error.format(), null, 2));
          hasError = true;
          continue;
        }

        if (json.id !== entry.name) {
          console.error(`[Check Themes] Error: Theme ID mismatch for '${entry.name}': manifest has id '${json.id}'.`);
          hasError = true;
        }

        // 3. Grep-guard: check theme files for forbidden references (@apps/, @mosaix-plugin/, /checkout, /cart)
        const checkFileForForbiddenRefs = (dir: string) => {
          const subEntries = fs.readdirSync(dir, { withFileTypes: true });
          for (const sub of subEntries) {
            const fullPath = path.join(dir, sub.name);
            if (sub.isDirectory()) {
              checkFileForForbiddenRefs(fullPath);
            } else if (sub.isFile()) {
              const content = fs.readFileSync(fullPath, "utf-8");
              if (content.includes("@apps/") || content.includes("@mosaix-plugin/") || content.includes("/checkout") || content.includes("/cart")) {
                console.error(`[Check Themes] Error: Forbidden reference found in theme '${entry.name}' file '${fullPath}': themes must not reference business apps, plugins, or commercial routes.`);
                hasError = true;
              }
            }
          }
        };
        checkFileForForbiddenRefs(themeDir);

        // 4. Token unit check
        const tokens = json.tokens || {};
        const checkUnits = (obj: unknown, pathStr: string) => {
          if (typeof obj !== "object" || obj === null) return;
          for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
            const currentPath = `${pathStr}.${k}`;
            if (typeof v === "number" && (pathStr.includes("spacing") || pathStr.includes("radius") || pathStr.includes("fontSize"))) {
              console.error(`[Check Themes] Error: Unitless dimension found at '${currentPath}' = ${v}. Dimensions must have explicit units (e.g., '8px', '1rem').`);
              hasError = true;
            } else if (typeof v === "object") {
              checkUnits(v, currentPath);
            }
          }
        };
        checkUnits(tokens, "tokens");

        resolutionTable[entry.name] = {
          name: json.name,
          version: json.version,
          contractVersion: json.contractVersion,
          defaultLayout: json.defaultLayout,
          slots: json.slots ? Object.keys(json.slots) : []
        };

        console.log(`[Check Themes] Validated theme: ${entry.name} (v${json.version}, contract v${json.contractVersion || "1.0.0"})`);
        count++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Check Themes] Error parsing theme.json for '${entry.name}':`, message);
        hasError = true;
      }
    }
  }

  if (emitResolutionTable) {
    const reportDir = path.resolve(process.cwd(), ".project/reports");
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(reportDir, "theme-resolution-table.json"),
      JSON.stringify(resolutionTable, null, 2),
      "utf-8"
    );
    console.log("[Check Themes] Emitted theme resolution table to .project/reports/theme-resolution-table.json");
  }

  if (hasError) {
    console.error("[Check Themes] Theme check failed with errors.");
    process.exit(1);
  }

  console.log(`[Check Themes] Success! ${count} themes successfully validated.`);
}

checkThemes();
