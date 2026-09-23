/**
 * @mosaix/core — Theme Discovery & Inheritance Resolution
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ThemeManifest } from "@mosaix/contracts";
import { ThemeError } from "./theme-errors";

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
  static discoverThemes(themesRootDir: string): DiscoveredThemeInfo[] {
    if (!fs.existsSync(themesRootDir)) {
      return [];
    }

    const entries = fs.readdirSync(themesRootDir, { withFileTypes: true });
    const discovered = new Map<string, DiscoveredThemeInfo>();

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith("_") || entry.name.startsWith(".")) {
          continue;
        }

        if (!/^[a-zA-Z0-9-]+$/.test(entry.name)) {
          throw new ThemeError(`Invalid characters in theme directory name '${entry.name}'`, { themeId: entry.name });
        }

        const themeDir = path.join(themesRootDir, entry.name);
        const manifestPath = path.join(themeDir, "theme.json");

        if (!fs.existsSync(manifestPath)) {
          throw new ThemeError(`Missing 'theme.json' in theme directory '${entry.name}'`, { themeId: entry.name, path: manifestPath });
        }

        let manifest: ThemeManifest;
        try {
          const raw = fs.readFileSync(manifestPath, "utf-8");
          manifest = JSON.parse(raw) as ThemeManifest;
        } catch (err) {
          throw new ThemeError(`Failed to parse theme.json for '${entry.name}': ${(err as Error).message}`, { themeId: entry.name });
        }

        // Validate id matches folder name
        if (manifest.id !== entry.name) {
          throw new ThemeError(`Theme ID mismatch: folder name is '${entry.name}' but manifest id is '${manifest.id}'`, { themeId: entry.name, manifestId: manifest.id });
        }

        // Validate contractVersion is present and valid semver
        if (!manifest.contractVersion || !/^\d+\.\d+\.\d+(-[0-9a-zA-Z.-]+)?(\+[0-9a-zA-Z.-]+)?$/.test(manifest.contractVersion)) {
          throw new ThemeError(`Invalid or missing contractVersion semver in theme '${entry.name}'`, { themeId: entry.name, contractVersion: manifest.contractVersion });
        }

        // Validate preview.png exists
        const previewPath = path.join(themeDir, "preview.png");
        if (!fs.existsSync(previewPath)) {
          throw new ThemeError(`Missing required 'preview.png' in theme directory '${entry.name}'`, { themeId: entry.name });
        }

        discovered.set(manifest.id, {
          id: manifest.id,
          manifest,
          sourcePath: themeDir,
        });
      }
    }

    // Resolve extends inheritance chains & check cycles
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

    // Cycle detection using visiting/visited sets
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
