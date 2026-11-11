import { themeCatalogueCache } from "../../themes/theme-catalogue-cache.js";
import type { ThemeManifest } from "@mosaix/contracts";

export interface ResolvedTheme {
  themeId: string;
  source: "space" | "platform" | "fallback";
  manifest: ThemeManifest;
}

const DEFAULT_THEME_ID = "mosaix-default";

export async function resolveTheme(spaceThemeId?: string): Promise<ResolvedTheme> {
  const allThemes = await themeCatalogueCache.getAll();
  const defaultTheme = allThemes.find((t) => t.id === DEFAULT_THEME_ID) || allThemes[0];

  if (!defaultTheme) {
    throw new Error("No platform default theme found in theme catalogue");
  }

  if (spaceThemeId) {
    const custom = allThemes.find((t) => t.id === spaceThemeId);
    if (custom) {
      return {
        themeId: custom.id,
        source: "space",
        manifest: custom.manifest,
      };
    }
  }

  return {
    themeId: defaultTheme.id,
    source: "platform",
    manifest: defaultTheme.manifest,
  };
}
