import { describe, expect, it, vi } from "vitest";
import type { ThemeManifest } from "@mosaix/contracts";
import type { DatabasePort } from "@mosaix/ports-database";
import {
  compile,
  createThemeRuntime,
  diffCompiledTheme,
  InMemoryThemeAssignmentsStore,
  PostgresThemeAssignmentsStore,
  ThemeCache,
  ThemeDiscovery,
  ThemeInjector,
  ThemeSDK,
  ThemeTargetRegistry,
  ThemeValidationError,
} from "./index.js";

describe("@mosaix/theme Package", () => {
  it("compiles theme tokens deterministically to CSS variables", () => {
    const manifest: ThemeManifest = {
      type: "theme",
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
      modes: {
        dark: {
          colors: {
            surface: "#1e293b",
          },
        },
      },
    };

    const lightCompiled = compile(manifest, "light");
    expect(lightCompiled["--mx-color-primary"]).toBe("#4f46e5");
    expect(lightCompiled["--mx-color-surface"]).toBe("#ffffff");
    expect(lightCompiled["--mx-space-sm"]).toBe("8px");

    const darkCompiled = compile(manifest, "dark");
    expect(darkCompiled["--mx-color-primary"]).toBe("#4f46e5");
    expect(darkCompiled["--mx-color-surface"]).toBe("#1e293b");
  });

  it("rejects malicious tokens in ThemeCompiler", () => {
    const manifest: ThemeManifest = {
      type: "theme",
      id: "malicious-theme",
      name: "Malicious Theme",
      version: "1.0.0",
      contractVersion: "1.0.0",
      tokens: {
        colors: {
          primary: "red; body { display: none; }",
        },
      },
    };

    expect(() => compile(manifest, "light")).toThrow(ThemeValidationError);
  });

  it("discovers all valid theme manifests in themes/ directory", () => {
    const discovered = ThemeDiscovery.discoverThemes("themes");
    expect(discovered.length).toBeGreaterThanOrEqual(18);
    expect(discovered.some((t) => t.id === "mosaix-default")).toBe(true);
  });

  it("manages ThemeCache correctly with LRU eviction and invalidation", () => {
    const cache = new ThemeCache(2);
    const themeA = { "--mx-color-primary": "#000000" };
    const themeB = { "--mx-color-primary": "#111111" };
    const themeC = { "--mx-color-primary": "#222222" };

    cache.set("themeA", "1.0.0", "light", themeA);
    cache.set("themeB", "1.0.0", "dark", themeB);
    expect(cache.size).toBe(2);

    expect(cache.get("themeA", "1.0.0", "light")).toEqual(themeA);
    cache.set("themeC", "1.0.0", "light", themeC);

    expect(cache.has("themeB", "1.0.0", "dark")).toBe(false);
    expect(cache.has("themeA", "1.0.0", "light")).toBe(true);
    expect(cache.has("themeC", "1.0.0", "light")).toBe(true);

    cache.invalidate("themeA");
    expect(cache.has("themeA", "1.0.0", "light")).toBe(false);
    expect(cache.size).toBe(1);

    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("diffs compiled themes and applies updates via ThemeInjector", () => {
    const prev = { "--mx-color-primary": "#ffffff", "--mx-color-old": "#000000" };
    const next = { "--mx-color-primary": "#000000", "--mx-color-new": "#111111" };

    const diff = diffCompiledTheme(prev, next);
    expect(diff.changed).toEqual([["--mx-color-new", "#111111"], ["--mx-color-primary", "#000000"]]);
    expect(diff.removed).toEqual(["--mx-color-old"]);

    const mockStyles = new Map<string, string>();
    const host = {
      style: {
        setProperty(k: string, v: string) { mockStyles.set(k, v); },
        removeProperty(k: string) { mockStyles.delete(k); },
      },
    };

    const injector = new ThemeInjector();
    injector.register(host);
    injector.inject(next);

    expect(mockStyles.get("--mx-color-primary")).toBe("#000000");
    expect(mockStyles.get("--mx-color-new")).toBe("#111111");

    injector.unregister(host);
    expect(injector.has(host)).toBe(false);
  });

  it("handles PostgresThemeAssignmentsStore DB errors without silent drops", async () => {
    const mockDb: DatabasePort = {
      query: vi.fn().mockResolvedValue([]),
      execute: vi.fn().mockRejectedValue(new Error("DB Connection Error")),
      transaction: vi.fn(),
      close: vi.fn(),
    } as unknown as DatabasePort;

    const store = new PostgresThemeAssignmentsStore(mockDb);
    await store.init();

    await expect(
      store.assign({
        target: { type: "space", id: "s1" },
        themeId: "ocean",
        source: "admin",
      }),
    ).rejects.toThrow("DB Connection Error");

    expect(store.get({ type: "space", id: "s1" })).toBeUndefined();
  });

  it("operates 3-level Theme SDK", async () => {
    const registry = new ThemeTargetRegistry();
    registry.register({ type: "store", capabilities: { userSelectable: true, adminConfigurable: true } });

    const store = new InMemoryThemeAssignmentsStore();
    const runtime = createThemeRuntime({ registry, store });

    const manifest: ThemeManifest = {
      type: "theme",
      id: "mosaix-default",
      name: "Default",
      version: "1.0.0",
      contractVersion: "1.0.0",
      tokens: {
        colors: { primary: "#4f46e5" },
      },
    };
    runtime.registerTheme(manifest);

    const sdk = new ThemeSDK(runtime);

    await sdk.assign({
      target: { type: "store", id: "store-1" },
      themeId: "mosaix-default",
      mode: "dark",
      source: "admin",
    });

    const res = await sdk.get({ type: "store", id: "store-1" });
    expect(res.resolution.resolved?.themeId).toBe("mosaix-default");
    expect(res.compiled?.["--mx-color-primary"]).toBe("#4f46e5");

    const catalog = sdk.catalog.list();
    expect(catalog.some((t) => t.id === "mosaix-default")).toBe(true);
  });
});
