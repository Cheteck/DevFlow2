/**
 * @mosaix/theme — Theme Discovery Engine (auto-scans themes/ directory)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ThemeManifest } from "@mosaix/contracts";
import { ThemeError, ThemeValidationError } from "./theme-errors.js";
import { ThemeManifestSchema } from "@mosaix/schemas";


function findWorkspaceRoot(startDir: string = process.cwd()): string {
  let curr = path.resolve(startDir);
  while (curr !== path.parse(curr).root) {
    if (
      fs.existsSync(path.join(curr, "pnpm-workspace.yaml")) ||
      fs.existsSync(path.join(curr, "lerna.json")) ||
      (fs.existsSync(path.join(curr, "package.json")) && fs.existsSync(path.join(curr, "themes")))
    ) {
      return curr;
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return process.cwd();
}

export interface DiscoveredThemeInfo {
  id: string;
  manifest: ThemeManifest;
  sourcePath: string;
}

export class ThemeDiscovery {
  /**
   * Scans themes directory, discovers valid themes, ignores _-prefixed directories,
   * validates manifests, and resolves theme inheritance (extends).
   */
  static discoverThemes(themesRootDir: string = "themes"): DiscoveredThemeInfo[] {
    let targetDir = path.isAbsolute(themesRootDir)
      ? themesRootDir
      : path.resolve(process.cwd(), themesRootDir);

    if (!fs.existsSync(targetDir)) {
      targetDir = path.resolve(findWorkspaceRoot(), themesRootDir);
    }

    if (!fs.existsSync(targetDir)) {
      return [];
    }

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const discovered = new Map<string, DiscoveredThemeInfo>();

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith("_") || entry.name.startsWith(".")) {
          continue;
        }

        if (!/^[a-zA-Z0-9-]+$/.test(entry.name)) {
          throw new ThemeError(`Invalid characters in theme directory name '${entry.name}'`, { themeId: entry.name });
        }

        const themeDir = path.join(targetDir, entry.name);
        const manifestPath = path.join(themeDir, "theme.json");

        if (!fs.existsSync(manifestPath)) {
          throw new ThemeError(`Missing 'theme.json' in theme directory '${entry.name}'`, { themeId: entry.name, path: manifestPath });
        }

        let manifest: ThemeManifest;
        try {
          const raw = fs.readFileSync(manifestPath, "utf-8");
          const parsed = JSON.parse(raw) as unknown;
          // Single validation entry point — no inline regex, no duplicate checks.
          const result = ThemeManifestSchema.safeParse(parsed);
          if (!result.success) {
            throw new ThemeValidationError(result.error.issues);
          }
          manifest = result.data as unknown as ThemeManifest;
          // Enforce folder name === manifest id invariant
          if (manifest.id !== entry.name) {
            throw new ThemeError(
              `Theme ID mismatch: folder name is '${entry.name}' but manifest id is '${manifest.id}'`,
              { themeId: entry.name, manifestId: manifest.id },
            );
          }
        } catch (err) {
          if (err instanceof ThemeError) throw err;
          if (err instanceof ThemeValidationError) {
            throw new ThemeError(
              `Invalid manifest in '${entry.name}': ${err.message}`,
              {
                themeId: entry.name,
                path: manifestPath,
                issues: err.details.issues,
              },
            );
          }
          throw new ThemeError(
            `Failed to parse theme.json for '${entry.name}': ${(err as Error).message}`,
            { themeId: entry.name, path: manifestPath },
          );
        }

        discovered.set(manifest.id, {
          id: manifest.id,
          manifest,
          sourcePath: themeDir,
        });
      }
    }

    const themesList = Array.from(discovered.values());
    for (const theme of themesList) {
      if (theme.manifest.extends) {
        const parentId = theme.manifest.extends;
        const parent = discovered.get(parentId);
        if (!parent) {
          throw new ThemeError(`Theme '${theme.id}' extends non-existent parent theme '${parentId}'`, { themeId: theme.id, parentId });
        }
      }
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();

    function checkCycle(themeId: string, chain: string[] = []) {
      if (visiting.has(themeId)) {
        throw new ThemeError(`Circular inheritance dependency detected in themes: ${chain.join(" -> ")} -> ${themeId}`, { chain, themeId });
      }
      if (visited.has(themeId)) return;

      visiting.add(themeId);
      chain.push(themeId);

      const t = discovered.get(themeId);
      if (t && t.manifest.extends) {
        checkCycle(t.manifest.extends, [...chain]);
      }

      visiting.delete(themeId);
      chain.pop();
      visited.add(themeId);
    }

    for (const theme of themesList) {
      checkCycle(theme.id);
    }

    return themesList;
  }
}
