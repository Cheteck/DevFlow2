import { describe, it, expect, beforeAll } from "vitest";
import { renderContext } from "../../server/context/render-context.js";
import {
  getActiveThemeId,
  renderThemeStyleTag,
  setActiveThemeId,
} from "./theme-bridge.js";

describe("ThemeBridge context integration", () => {
  const defaultThemeId = "mosaix-default";

  beforeAll(() => {
    setActiveThemeId(defaultThemeId);
  });

  it("uses the request-scoped render context theme when present", () => {
    const customId = "midnight-ocean";
    renderContext.enterWith({
      space: undefined,
      theme: {
        themeId: customId,
        source: "space",
        manifest: {
          name: "Midnight Ocean",
          version: "1.0.0",
          modes: { light: {} },
        },
      },
    });
    expect(getActiveThemeId()).toBe(customId);
  });

  it("falls back to the module-level active theme id when no context is set", () => {
    expect(getActiveThemeId()).toBe(defaultThemeId);
  });

  it("emits semantic status --color-* aliases backed by --mx-* tokens", () => {
    setActiveThemeId("midnight-ocean");
    const tag = renderThemeStyleTag("dark");
    for (const token of [
      "success",
      "success-hover",
      "success-container",
      "on-success",
      "warning",
      "warning-hover",
      "warning-container",
      "on-warning",
      "error",
      "error-hover",
      "error-container",
      "on-error",
      "info",
      "info-hover",
      "info-container",
      "on-info",
    ]) {
      expect(tag).toContain(`--color-${token}:`);
    }
    // `error` must keep resolving the legacy `danger` alias.
    expect(tag).toContain(
      "--color-error: var(--mx-color-error, var(--mx-color-danger,",
    );
    // Dark mode compiles its own status values.
    expect(tag).toContain("--mx-color-success: #10b981");
  });
});
