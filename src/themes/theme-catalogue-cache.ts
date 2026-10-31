/**
 * @src/themes/theme-catalogue-cache.ts — Theme Catalogue Cache
 *
 * Singleton cache for theme manifests discovered from the themes/ directory.
 * Prevents repeated filesystem scans and provides a single source of truth
 * for theme validation across SSR rendering and API routes.
 */

import { ThemeDiscovery, type DiscoveredThemeInfo } from "@mosaix/theme";
import * as path from "node:path";

const THEMES_DIR = path.resolve(process.cwd(), "themes");

export interface ThemeCatalogEntry {
  id: string;
  name: string;
  version: string;
  description?: string;
  primaryColor?: string;
  backgroundColor?: string;
  modes: string[];
}

class ThemeCatalogueCache {
  private cache: DiscoveredThemeInfo[] | null = null;

  async getAll(): Promise<DiscoveredThemeInfo[]> {
    if (this.cache) {
      return this.cache;
    }

    this.cache = ThemeDiscovery.discoverThemes(THEMES_DIR);
    return this.cache;
  }

  async getById(id: string): Promise<DiscoveredThemeInfo | undefined> {
    const themes = await this.getAll();
    return themes.find((theme) => theme.id === id);
  }

  async exists(id: string): Promise<boolean> {
    const theme = await this.getById(id);
    return theme !== undefined;
  }

  async getCatalogEntries(): Promise<ThemeCatalogEntry[]> {
    const themes = await this.getAll();
    return themes.map((t) => ({
      id: t.id,
      name: t.manifest.name,
      version: t.manifest.version,
      description: t.manifest.metadata?.description,
      primaryColor: t.manifest.tokens?.colors?.primary,
      backgroundColor: t.manifest.tokens?.colors?.background,
      modes: Object.keys(t.manifest.modes || {}),
    }));
  }

  clear(): void {
    this.cache = null;
  }
}

export const themeCatalogueCache = new ThemeCatalogueCache();
