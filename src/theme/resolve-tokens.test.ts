import { describe, it, expect } from "vitest";
import { resolveTokens } from "./resolve-tokens";
import type { DesignTokens } from "@mosaix/contracts";

const baseTokens: DesignTokens = {
  colors: {
    primary: "#4f46e5",
    primaryHover: "#4338ca",
    secondary: "#06b6d4",
    background: "#f8fafc",
    surface: "#ffffff",
    text: "#0f172a",
    textMuted: "#64748b",
    border: "#e2e8f0",
    accent: "#8b5cf6",
    danger: "#ef4444",
    success: "#10b981",
    warning: "#f59e0b",
  },
  typography: {
    fontFamily: "sans-serif",
    fontSizeBase: "16px",
    fontSizeSm: "14px",
    fontSizeLg: "18px",
    fontWeightNormal: "400",
    fontWeightMedium: "500",
    fontWeightBold: "700",
    lineHeight: "1.5",
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
  },
  radius: {
    sm: "6px",
    md: "12px",
    lg: "16px",
    full: "9999px",
  },
  shadows: {
    sm: "shadow-sm",
    md: "shadow-md",
    lg: "shadow-lg",
  },
  motion: {
    durationFast: "150ms",
    durationNormal: "300ms",
    easing: "ease",
  },
};

describe("resolveTokens (TH-003)", () => {
  it("returns base tokens when no overlays are provided", () => {
    const resolved = resolveTokens(baseTokens);
    expect(resolved).toEqual(baseTokens);
  });

  it("applies mode overlays correctly", () => {
    const resolved = resolveTokens(baseTokens, {
      colors: { background: "#000000", text: "#ffffff" },
    });
    expect(resolved.colors.background).toBe("#000000");
    expect(resolved.colors.text).toBe("#ffffff");
    expect(resolved.colors.primary).toBe("#4f46e5"); // Unchanged
  });

  it("applies tenant overrides over mode overlays", () => {
    const resolved = resolveTokens(
      baseTokens,
      { colors: { background: "#111111" } },
      { colors: { background: "#222222", primary: "#ff0000" } }
    );
    expect(resolved.colors.background).toBe("#222222");
    expect(resolved.colors.primary).toBe("#ff0000");
  });
});
