import * as fs from "node:fs";
import * as path from "node:path";
import { ThemeManifestSchema } from "@mosaix/schemas";
import type { ThemeRuntime } from "@mosaix/core";

export interface ThemeSummary {
  id: string;
  name: string;
  version: string;
  primaryColor: string;
  backgroundColor: string;
}

export class PlatformThemeService {
  constructor(private readonly themeRuntime?: ThemeRuntime) {}

  async listThemes(): Promise<ThemeSummary[]> {
    const themesDir = path.resolve(process.cwd(), "themes");
    const summaries: ThemeSummary[] = [];

    if (!fs.existsSync(themesDir)) return summaries;

    const entries = fs.readdirSync(themesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || entry.name.startsWith("_")) {
          continue;
        }

        // Security Defense: prevent directory traversal and special character attacks
        if (!/^[a-zA-Z0-9-]+$/.test(entry.name)) {
          continue;
        }

        const manifestPath = path.join(themesDir, entry.name, "theme.json");
        if (!fs.existsSync(manifestPath)) {
          continue;
        }

        try {
          const content = fs.readFileSync(manifestPath, "utf-8");
          const json = JSON.parse(content);
          
          const result = ThemeManifestSchema.safeParse(json);
          if (!result.success) {
            continue; // Skip invalid manifests
          }

          const primary = (json.tokens?.colors?.primary as string) || "#4f46e5";
          const background = (json.tokens?.colors?.background as string) || "#f8fafc";

          summaries.push({
            id: json.id,
            name: json.name,
            version: json.version,
            primaryColor: primary,
            backgroundColor: background,
          });
        } catch (_e) {
          // ignore unparseable
        }
      }
    }
    return summaries;
  }

  async getActiveThemeId(): Promise<string> {
    if (this.themeRuntime) {
      const active = await this.themeRuntime.getActiveAssignment({ type: "shell", id: "shell" });
      return active?.themeId || "mosaix-default";
    }
    return "mosaix-default";
  }

  async applyTheme(themeId: string, mode: "light" | "dark" | "high-contrast" | "system"): Promise<void> {
    // Security Defense: strict input format check
    if (!themeId || !/^[a-zA-Z0-9-]+$/.test(themeId)) {
      throw new Error(`Invalid theme ID: '${themeId}'`);
    }

    if (this.themeRuntime) {
      await this.themeRuntime.apply({
        target: { type: "shell", id: "shell" },
        themeId,
        mode,
      });
    }
  }
}
export default PlatformThemeService;
