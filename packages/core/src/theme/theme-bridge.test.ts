import { describe, it, expect, beforeEach } from "vitest";
import { compile } from "./theme-compiler";
import { MOSAIX_DEFAULT_THEME } from "../../../../src/shell/theme/mosaix-default-theme";
import { renderThemeStyleTag, applyThemeMode, initThemeBridge } from "../../../../src/shell/theme/theme-bridge";

describe("Theme Compiler Coercion & Modes", () => {
  it("should not append px to unitless CSS properties (opacity, z-index, line-height)", () => {
    const customTheme = {
      ...MOSAIX_DEFAULT_THEME,
      tokens: {
        ...MOSAIX_DEFAULT_THEME.tokens,
        typography: {
          lineHeight: 1.5,
          fontWeight: 600,
        },
        custom: {
          opacity: 0.85,
          zIndex: 100,
          spacing: 16,
        },
      },
    };

    const compiled = compile(customTheme as unknown as Parameters<typeof compile>[0], "light");

    expect(compiled["--mx-typography-lineHeight"]).toBe("1.5");
    expect(compiled["--mx-typography-fontWeight"]).toBe("600");
    expect(compiled["--mx-custom-opacity"]).toBe("0.85");
    expect(compiled["--mx-custom-zIndex"]).toBe("100");
    expect(compiled["--mx-custom-spacing"]).toBe("16px");
  });

  it("should support high-contrast mode overlay compilation", () => {
    const compiled = compile(MOSAIX_DEFAULT_THEME, "high-contrast");

    expect(compiled["--mx-color-background"]).toBe("#000000");
    expect(compiled["--mx-color-text"]).toBe("#ffffff");
    expect(compiled["--mx-color-primary"]).toBe("#ffff00");
  });
});

describe("Theme Bridge Integration", () => {
  beforeEach(() => {
    initThemeBridge();
  });

  it("should render SSR style tag with --mx-* variables and deprecated fallbacks", async () => {
    await applyThemeMode("dark");
    const styleTag = renderThemeStyleTag("dark");

    expect(styleTag).toContain("<style id=\"mosaix-compiled-theme\">");
    expect(styleTag).toContain("--mx-color-background: #0f172a;");
    expect(styleTag).toContain("--bg-primary: var(--mx-color-background, #f8fafc);");
    expect(styleTag).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
