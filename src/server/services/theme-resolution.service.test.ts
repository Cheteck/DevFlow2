import { describe, it, expect, beforeEach, vi } from "vitest";
import { resolveTheme } from "./theme-resolution.service.js";
import { themeCatalogueCache } from "../../themes/theme-catalogue-cache.js";
import type { DiscoveredThemeInfo } from "@mosaix/theme";
import type { ThemeManifest } from "@mosaix/contracts";

vi.mock("../../themes/theme-catalogue-cache.js", () => ({
  themeCatalogueCache: {
    getAll: vi.fn(),
    getById: vi.fn(),
    exists: vi.fn(),
    getCatalogEntries: vi.fn(),
    clear: vi.fn(),
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

describe("ThemeResolutionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves space theme when valid", async () => {
    vi.mocked(themeCatalogueCache.getAll).mockResolvedValue([
      mockTheme("arctic", "Arctic"),
      mockTheme("sunset", "Sunset"),
    ]);

    const result = await resolveTheme("sunset");

    expect(result.themeId).toBe("sunset");
    expect(result.source).toBe("space");
    expect(result.manifest.name).toBe("Sunset");
  });

  it("falls back to platform default when space theme invalid", async () => {
    vi.mocked(themeCatalogueCache.getAll).mockResolvedValue([
      mockTheme("arctic", "Arctic"),
      mockTheme("mosaix-default", "Default"),
    ]);

    const result = await resolveTheme("nonexistent");

    expect(result.themeId).toBe("mosaix-default");
    expect(result.source).toBe("platform");
  });

  it("uses first theme as fallback when no default exists", async () => {
    vi.mocked(themeCatalogueCache.getAll).mockResolvedValue([
      mockTheme("arctic", "Arctic"),
    ]);

    const result = await resolveTheme(undefined);

    expect(result.themeId).toBe("arctic");
    expect(result.source).toBe("platform");
  });

  it("throws when catalogue is empty", async () => {
    vi.mocked(themeCatalogueCache.getAll).mockResolvedValue([]);

    await expect(resolveTheme(undefined)).rejects.toThrow(
      "No platform default theme found in theme catalogue",
    );
  });
});
