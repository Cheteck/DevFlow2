import { describe, it, expect, beforeAll } from "vitest";
import { renderContext } from "../../server/context/render-context.js";
import { getActiveThemeId, setActiveThemeId } from "./theme-bridge.js";

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
});
