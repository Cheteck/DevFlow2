import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  compile,
  createThemeRuntime,
  InMemoryThemeAssignmentsStore,
  ThemeInjector,
  ThemeTargetRegistry,
} from "@mosaix/theme";
import type { ThemeManifest } from "@mosaix/contracts";
import { renderThemeStyleTag } from "../src/shell/theme/theme-bridge.js";

describe("Hot Theme Switching & Runtime Integration", () => {
  let mockHtml: {
    attributes: Map<string, string>;
    classList: Set<string>;
    style: Map<string, string>;
    setAttribute(k: string, v: string): void;
    getAttribute(k: string): string | undefined;
    removeAttribute(k: string): void;
  };

  let mockLocalStorage: Map<string, string>;
  let listeners: Map<string, Array<(e: unknown) => void>>;
  let mediaQueryListeners: Array<(e: { matches: boolean }) => void>;
  let osDarkPreferred = false;

  beforeEach(() => {
    mockLocalStorage = new Map();
    listeners = new Map();
    mediaQueryListeners = [];
    osDarkPreferred = false;

    mockHtml = {
      attributes: new Map(),
      classList: new Set(),
      style: new Map(),
      setAttribute(k: string, v: string) {
        this.attributes.set(k, v);
      },
      getAttribute(k: string) {
        return this.attributes.get(k);
      },
      removeAttribute(k: string) {
        this.attributes.delete(k);
      },
    };

    const globalObj = globalThis as unknown as Record<string, unknown>;

    globalObj.document = {
      documentElement: {
        setAttribute: (k: string, v: string) => mockHtml.setAttribute(k, v),
        getAttribute: (k: string) => mockHtml.getAttribute(k),
        removeAttribute: (k: string) => mockHtml.removeAttribute(k),
        classList: {
          add: (c: string) => mockHtml.classList.add(c),
          remove: (c: string) => mockHtml.classList.delete(c),
          contains: (c: string) => mockHtml.classList.has(c),
        },
        style: {
          setProperty: (k: string, v: string) => mockHtml.style.set(k, v),
          removeProperty: (k: string) => mockHtml.style.delete(k),
        },
      },
    };

    globalObj.localStorage = {
      getItem: (k: string) => mockLocalStorage.get(k) ?? null,
      setItem: (k: string, v: string) => mockLocalStorage.set(k, String(v)),
      removeItem: (k: string) => mockLocalStorage.delete(k),
      clear: () => mockLocalStorage.clear(),
    };

    globalObj.window = {
      matchMedia: (query: string) => ({
        matches: query.includes("prefers-color-scheme: dark") ? osDarkPreferred : false,
        addEventListener: (event: string, fn: (e: { matches: boolean }) => void) => {
          if (event === "change") mediaQueryListeners.push(fn);
        },
        removeEventListener: () => {},
      }),
      addEventListener: (event: string, fn: (e: unknown) => void) => {
        let arr = listeners.get(event);
        if (!arr) {
          arr = [];
          listeners.set(event, arr);
        }
        arr.push(fn);
      },
      dispatchEvent: (e: unknown) => {
        const type = (e as { type: string }).type;
        const arr = listeners.get(type);
        if (arr) {
          for (const fn of arr) fn(e);
        }
        return true;
      },
      showToast: vi.fn(),
    };

    (globalObj.window as Record<string, unknown>).setTheme = (mode: string) => {
      const validMode = mode === "light" || mode === "dark" || mode === "system" ? mode : "system";
      const html = (globalObj.document as Record<string, Record<string, (k: string, v: string) => void>>).documentElement;

      let effectiveMode = validMode;
      if (validMode === "system") {
        effectiveMode = osDarkPreferred ? "dark" : "light";
      }

      html.setAttribute("data-theme-mode", validMode);
      html.setAttribute("data-resolved-mode", effectiveMode);

      const classList = (html as unknown as { classList: { add(c: string): void; remove(c: string): void } }).classList;
      if (effectiveMode === "dark") {
        classList.add("dark");
        classList.remove("light");
      } else {
        classList.remove("dark");
        classList.add("light");
      }

      try {
        mockLocalStorage.set("mosaix_theme_mode", validMode);
      } catch {}

      (globalObj.window as { dispatchEvent(e: unknown): void }).dispatchEvent({
        type: "mosaix:theme-changed",
        detail: { mode: validMode, effectiveMode },
      });
    };
  });

  it("switches from light to dark instantly without page reload", () => {
    const setTheme = (globalThis as unknown as { window: { setTheme: (m: string) => void } }).window.setTheme;

    setTheme("light");
    expect(mockHtml.getAttribute("data-theme-mode")).toBe("light");
    expect(mockHtml.getAttribute("data-resolved-mode")).toBe("light");
    expect(mockHtml.classList.has("dark")).toBe(false);

    setTheme("dark");
    expect(mockHtml.getAttribute("data-theme-mode")).toBe("dark");
    expect(mockHtml.getAttribute("data-resolved-mode")).toBe("dark");
    expect(mockHtml.classList.has("dark")).toBe(true);
    expect(mockLocalStorage.get("mosaix_theme_mode")).toBe("dark");
  });

  it("switches from dark to light instantly without page reload", () => {
    const setTheme = (globalThis as unknown as { window: { setTheme: (m: string) => void } }).window.setTheme;

    setTheme("dark");
    expect(mockHtml.classList.has("dark")).toBe(true);

    setTheme("light");
    expect(mockHtml.getAttribute("data-theme-mode")).toBe("light");
    expect(mockHtml.getAttribute("data-resolved-mode")).toBe("light");
    expect(mockHtml.classList.has("dark")).toBe(false);
    expect(mockLocalStorage.get("mosaix_theme_mode")).toBe("light");
  });

  it("resolves system mode based on OS preference (light and dark)", () => {
    const setTheme = (globalThis as unknown as { window: { setTheme: (m: string) => void } }).window.setTheme;

    osDarkPreferred = false;
    setTheme("system");
    expect(mockHtml.getAttribute("data-theme-mode")).toBe("system");
    expect(mockHtml.getAttribute("data-resolved-mode")).toBe("light");
    expect(mockHtml.classList.has("dark")).toBe(false);

    osDarkPreferred = true;
    setTheme("system");
    expect(mockHtml.getAttribute("data-theme-mode")).toBe("system");
    expect(mockHtml.getAttribute("data-resolved-mode")).toBe("dark");
    expect(mockHtml.classList.has("dark")).toBe(true);
  });

  it("updates ThemeInjector across registered HTMLElement and ShadowRoot targets", () => {
    const manifest: ThemeManifest = {
      type: "theme",
      id: "dynamic-theme",
      name: "Dynamic Theme",
      version: "1.0.0",
      contractVersion: "1.0.0",
      tokens: {
        colors: { primary: "#ffffff" },
      },
      modes: {
        dark: { colors: { primary: "#000000" } },
      },
    };

    const lightCompiled = compile(manifest, "light");
    const darkCompiled = compile(manifest, "dark");

    const shadowStyles = new Map<string, string>();
    const shadowRoot = {
      style: {
        setProperty: (k: string, v: string) => shadowStyles.set(k, v),
        removeProperty: (k: string) => shadowStyles.delete(k),
      },
    };

    const injector = new ThemeInjector();
    injector.register(shadowRoot);

    injector.inject(lightCompiled);
    expect(shadowStyles.get("--mx-color-primary")).toBe("#ffffff");

    injector.inject(darkCompiled);
    expect(shadowStyles.get("--mx-color-primary")).toBe("#000000");
  });

  it("generates SSR theme style tag with complete light, dark, and system rules", () => {
    const tag = renderThemeStyleTag();
    expect(tag).toContain("/* MosaiX Compiled Theme — Source of Truth: --mx-* (hot-switching enabled) */");
    expect(tag).toContain(":root, [data-theme-mode=\"light\"], [data-resolved-mode=\"light\"]");
    expect(tag).toContain("[data-theme-mode=\"dark\"], [data-resolved-mode=\"dark\"], .dark, html.dark");
    expect(tag).toContain("@media (prefers-color-scheme: dark)");
    expect(tag).not.toContain("high-contrast");
  });
});
