import { describe, expect, it } from "vitest";
import {
  compile,
  createThemeRuntime,
  InMemoryThemeAssignmentsStore,
  ThemeDiscovery,
  ThemeSDK,
  ThemeTargetRegistry,
} from "./index.js";

describe("@mosaix/theme Package", () => {
  it("compiles theme tokens deterministically to CSS variables", () => {
    const manifest = {
      type: "theme" as const,
      id: "test-theme",
      name: "Test Theme",
      version: "1.0.0",
      contractVersion: "1.0.0",
      tokens: {
        colors: {
          primary: "#4f46e5",
          surface: "#ffffff",
        },
        spacing: {
          sm: "8px",
          md: "16px",
        },
      },
    };

    const compiled = compile(manifest as any, "light");
    expect(compiled["--mx-color-primary"]).toBe("#4f46e5");
    expect(compiled["--mx-space-sm"]).toBe("8px");
  });

  it("discovers all valid theme manifests in themes/ directory", () => {
    const discovered = ThemeDiscovery.discoverThemes("themes");
    expect(discovered.length).toBeGreaterThanOrEqual(18);
    expect(discovered.some((t) => t.id === "mosaix-default")).toBe(true);
  });

  it("operates 3-level Theme SDK", async () => {
    const registry = new ThemeTargetRegistry();
    registry.register({ type: "store", capabilities: { userSelectable: true, adminConfigurable: true } });

    const store = new InMemoryThemeAssignmentsStore();
    const runtime = createThemeRuntime({ registry, store });

    const manifest = {
      type: "theme" as const,
      id: "mosaix-default",
      name: "Default",
      version: "1.0.0",
      contractVersion: "1.0.0",
      tokens: {
        colors: { primary: "#4f46e5" },
      },
    };
    runtime.registerTheme(manifest as any);

    const sdk = new ThemeSDK(runtime);

    // Level 3: assign
    await sdk.assign({
      target: { type: "store", id: "store-1" },
      themeId: "mosaix-default",
      mode: "dark",
      source: "entity",
    });

    // Level 1: get
    const res = await sdk.get({ type: "store", id: "store-1" });
    expect(res.resolution.resolved?.themeId).toBe("mosaix-default");
    expect(res.compiled?.["--mx-color-primary"]).toBe("#4f46e5");

    // Level 3: catalog list
    const catalog = sdk.catalog.list();
    expect(catalog.some((t) => t.id === "mosaix-default")).toBe(true);
  });
});
