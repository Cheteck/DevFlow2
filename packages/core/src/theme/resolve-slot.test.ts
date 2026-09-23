import { describe, it, expect } from "vitest";
import { resolveSlot, isShellRoute } from "./resolve-slot";

describe("SlotResolution Engine", () => {
  it("should correctly identify shell routes", () => {
    expect(isShellRoute("/")).toBe(true);
    expect(isShellRoute("/login")).toBe(true);
    expect(isShellRoute("/errors/404")).toBe(true);
    expect(isShellRoute("/booking")).toBe(false);
  });

  it("should resolve active theme template when no overrides exist", () => {
    const result = resolveSlot({
      slotId: "header",
      route: "/booking",
      activeThemeId: "mosaix-default",
    });
    expect(result.template).toBe("themes/mosaix-default/slots/header.html");
    expect(result.provider).toBe("theme");
    expect(result.precedenceLevel).toBe(1);
  });

  it("should respect app owner overrides on non-shell routes", () => {
    const result = resolveSlot({
      slotId: "header",
      route: "/booking/schedule",
      activeThemeId: "mosaix-default",
      apps: [
        {
          id: "booking",
          routes: ["/booking"],
          themeOverrides: {
            slots: {
              header: "apps/booking/slots/custom-header.html",
            },
          },
        },
      ],
    });
    expect(result.template).toBe("apps/booking/slots/custom-header.html");
    expect(result.provider).toBe("app-owner");
    expect(result.precedenceLevel).toBe(3);
  });

  it("should ignore app overrides on shell routes", () => {
    const result = resolveSlot({
      slotId: "header",
      route: "/",
      activeThemeId: "mosaix-default",
      apps: [
        {
          id: "booking",
          routes: ["/booking"],
          themeOverrides: {
            slots: {
              header: "apps/booking/slots/custom-header.html",
            },
          },
        },
      ],
    });
    expect(result.template).toBe("themes/mosaix-default/slots/header.html");
    expect(result.provider).toBe("theme");
  });
});
