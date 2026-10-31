import { describe, it, expect, beforeEach, vi } from "vitest";
import { themeCatalogueCache } from "./theme-catalogue-cache.js";
import { ThemeDiscovery } from "@mosaix/theme";
import type { DiscoveredThemeInfo } from "@mosaix/theme";
import type { ThemeManifest } from "@mosaix/contracts";

vi.mock("@mosaix/theme", () => ({
  ThemeDiscovery: {
    discoverThemes: vi.fn(),
  },
}));

const mockTheme = (id: string, name: string): DiscoveredThemeInfo => ({
  id,
  manifest: {
    name,
    version: "1.0.0",
    modes: { light: { cssVariables: {} } },
    tokens: { colors: { primary: "#000000" } },
    metadata: { description: "Test theme" },
  } as unknown as ThemeManifest,
  sourcePath: `/themes/${id}`,
});

describe("ThemeCatalogueCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    themeCatalogueCache.clear();
  });

  it("caches themes on first getAll call", async () => {
    const themes = [mockTheme("arctic", "Arctic"), mockTheme("sunset", "Sunset")];
    vi.mocked(ThemeDiscovery.discoverThemes).mockReturnValue(themes);

    const first = await themeCatalogueCache.getAll();
    const second = await themeCatalogueCache.getAll();

    expect(ThemeDiscovery.discoverThemes).toHaveBeenCalledTimes(1);
    expect(first).toHaveLength(2);
    expect(second).toBe(first);
  });

  it("gets theme by id", async () => {
    vi.mocked(ThemeDiscovery.discoverThemes).mockReturnValue([
      mockTheme("arctic", "Arctic"),
      mockTheme("sunset", "Sunset"),
    ]);

    const found = await themeCatalogueCache.getById("sunset");
    expect(found?.id).toBe("sunset");
    expect(found?.manifest.name).toBe("Sunset");
  });

  it("returns undefined for unknown theme id", async () => {
    vi.mocked(ThemeDiscovery.discoverThemes).mockReturnValue([
      mockTheme("arctic", "Arctic"),
    ]);

    const found = await themeCatalogueCache.getById("unknown");
    expect(found).toBeUndefined();
  });

  it("checks existence", async () => {
    vi.mocked(ThemeDiscovery.discoverThemes).mockReturnValue([
      mockTheme("arctic", "Arctic"),
    ]);

    await expect(themeCatalogueCache.exists("arctic")).resolves.toBe(true);
    await expect(themeCatalogueCache.exists("unknown")).resolves.toBe(false);
  });

  it("returns catalog entries with metadata", async () => {
    vi.mocked(ThemeDiscovery.discoverThemes).mockReturnValue([
      mockTheme("arctic", "Arctic"),
    ]);

    const entries = await themeCatalogueCache.getCatalogEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: "arctic",
      name: "Arctic",
      version: "1.0.0",
      description: "Test theme",
    });
  });

  it("clears cache", async () => {
    vi.mocked(ThemeDiscovery.discoverThemes)
      .mockReturnValueOnce([mockTheme("arctic", "Arctic")])
      .mockReturnValueOnce([mockTheme("sunset", "Sunset")]);

    await themeCatalogueCache.getAll();
    themeCatalogueCache.clear();
    await themeCatalogueCache.getAll();

    expect(ThemeDiscovery.discoverThemes).toHaveBeenCalledTimes(2);
  });
});
