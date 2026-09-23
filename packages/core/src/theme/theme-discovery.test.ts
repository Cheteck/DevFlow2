import { describe, it, expect } from "vitest";
import { ThemeDiscovery } from "./theme-discovery";
import * as path from "node:path";

describe("ThemeDiscovery", () => {
  it("should discover valid themes in themes/ directory", () => {
    const themesDir = path.resolve(process.cwd(), "themes");
    const themes = ThemeDiscovery.discoverThemes(themesDir);
    expect(themes.length).toBeGreaterThanOrEqual(2);
    const defaultTheme = themes.find(t => t.id === "mosaix-default");
    expect(defaultTheme).toBeDefined();
    expect(defaultTheme?.manifest.contractVersion).toBeDefined();
  });

  it("should ignore _-prefixed directories like _template during discovery", () => {
    const themesDir = path.resolve(process.cwd(), "themes");
    const themes = ThemeDiscovery.discoverThemes(themesDir);
    const templateTheme = themes.find(t => t.id === "_template");
    expect(templateTheme).toBeUndefined();
  });
});
