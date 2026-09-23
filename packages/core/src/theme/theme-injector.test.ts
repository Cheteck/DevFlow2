/**
 * ThemeInjector — co-located vitest suite for the diff-based, rAF-batched,
 * Shadow-DOM-safe injector (THEME-10, roadmap criterion #3).
 *
 * NO jsdom: roots are structural stubs ({ style: { setProperty, removeProperty } })
 * or shadow-like ({ host: { style } }); requestAnimationFrame is captured via
 * vi.stubGlobal so batching is asserted deterministically (never wall-clock
 * sleeps). Diff semantics and batching threshold come from the 03-CONTEXT
 * ThemeInjector decision.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CompiledTheme } from "@mosaix/contracts";
import { ThemeInjectionError } from "./theme-errors";
import {
  INJECTOR_BATCH_THRESHOLD,
  ThemeInjector,
  diffCompiledTheme,
  type ThemeRoot,
} from "./theme-injector";

const makeRoot = () => ({
  style: { setProperty: vi.fn(), removeProperty: vi.fn() },
});

const makeShadowLikeRoot = () => ({ host: makeRoot() });

let captured: FrameRequestCallback | undefined;

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    captured = cb;
    return 1;
  });
  captured = undefined;
});

afterEach(() => {
  vi.unstubAllGlobals();
  captured = undefined;
});

describe("ThemeInjector (THEME-10)", () => {
  it("diffCompiledTheme returns only changed and removed entries (deterministic)", () => {
    const previous: CompiledTheme = {
      "--mx-color-primary": "#111",
      "--mx-radius-md": "8px",
    };
    const next: CompiledTheme = {
      "--mx-color-primary": "#111",
      "--mx-color-bg": "#000",
    };

    expect(diffCompiledTheme(previous, next)).toEqual({
      changed: [["--mx-color-bg", "#000"]],
      removed: ["--mx-radius-md"],
    });
  });

  it("diffCompiledTheme first run: all next entries changed (sorted), none removed", () => {
    const next: CompiledTheme = {
      "--mx-color-bg": "#000",
      "--mx-color-primary": "#111",
    };

    expect(diffCompiledTheme(undefined, next)).toEqual({
      changed: [
        ["--mx-color-bg", "#000"],
        ["--mx-color-primary", "#111"],
      ],
      removed: [],
    });
  });

  it("diffCompiledTheme identical maps: no changed, no removed", () => {
    const theme: CompiledTheme = { "--mx-color-primary": "#111" };

    expect(diffCompiledTheme(theme, { ...theme })).toEqual({
      changed: [],
      removed: [],
    });
  });

  it("inject below threshold applies synchronously via setProperty/removeProperty, no rAF", () => {
    const rootA = makeRoot();
    const rootB = makeRoot();
    const injector = new ThemeInjector();
    injector.register(rootA);
    injector.register(rootB);

    injector.inject({ "--mx-color-primary": "#111", "--mx-radius-md": "8px" });
    expect(rootA.style.setProperty).toHaveBeenCalledWith(
      "--mx-color-primary",
      "#111",
    );
    expect(rootA.style.setProperty).toHaveBeenCalledWith(
      "--mx-radius-md",
      "8px",
    );
    expect(rootB.style.setProperty).toHaveBeenCalledWith(
      "--mx-color-primary",
      "#111",
    );
    expect(rootB.style.setProperty).toHaveBeenCalledWith(
      "--mx-radius-md",
      "8px",
    );
    expect(captured).toBeUndefined();

    injector.inject({ "--mx-color-primary": "#111" });
    expect(rootA.style.removeProperty).toHaveBeenCalledWith("--mx-radius-md");
    expect(rootB.style.removeProperty).toHaveBeenCalledWith("--mx-radius-md");
    const primaryWrites = rootA.style.setProperty.mock.calls.filter(
      ([name]) => name === "--mx-color-primary",
    );
    expect(primaryWrites).toHaveLength(1);
    expect(captured).toBeUndefined();
  });

  it("batching at threshold: rAF scheduled, writes deferred until flush(); flush idempotent", () => {
    const roots = Array.from({ length: 40 }, makeRoot);
    const injector = new ThemeInjector();
    for (const root of roots) injector.register(root);
    expect(injector.size).toBe(INJECTOR_BATCH_THRESHOLD);

    injector.inject({ "--mx-color-primary": "#111" });
    expect(captured).toBeDefined();
    for (const root of roots) {
      expect(root.style.setProperty).not.toHaveBeenCalled();
    }

    injector.flush();
    for (const root of roots) {
      expect(root.style.setProperty).toHaveBeenCalledTimes(1);
      expect(root.style.setProperty).toHaveBeenCalledWith(
        "--mx-color-primary",
        "#111",
      );
    }

    injector.flush();
    expect(captured).toBeDefined();
    for (const root of roots) {
      expect(root.style.setProperty).toHaveBeenCalledTimes(1);
    }
  });

  it("progressive diff advances previous; unregister scopes subsequent flush", () => {
    const rootA = makeRoot();
    const rootB = makeRoot();
    const injector = new ThemeInjector();
    injector.register(rootA);
    injector.register(rootB);

    injector.inject({ "--mx-color-primary": "#111", "--mx-radius-md": "8px" });
    injector.inject({ "--mx-color-primary": "#111", "--mx-color-bg": "#000" });
    expect(rootA.style.setProperty).toHaveBeenCalledWith(
      "--mx-color-bg",
      "#000",
    );
    expect(rootB.style.setProperty).toHaveBeenCalledWith(
      "--mx-color-bg",
      "#000",
    );
    expect(rootA.style.removeProperty).toHaveBeenCalledWith("--mx-radius-md");
    const primaryWrites = rootA.style.setProperty.mock.calls.filter(
      ([name]) => name === "--mx-color-primary",
    );
    expect(primaryWrites).toHaveLength(1);

    injector.unregister(rootB);
    expect(injector.has(rootB)).toBe(false);

    injector.inject({ "--mx-color-primary": "#ff0000" });
    expect(rootA.style.setProperty).toHaveBeenLastCalledWith(
      "--mx-color-primary",
      "#ff0000",
    );
    expect(rootB.style.setProperty).not.toHaveBeenCalledWith(
      "--mx-color-primary",
      "#ff0000",
    );
  });

  it("shadow-like root: style ops go to root.host.style; has/unregister work", () => {
    const shadowRoot = makeShadowLikeRoot();
    const injector = new ThemeInjector();
    injector.register(shadowRoot);
    expect(injector.has(shadowRoot)).toBe(true);

    injector.inject({ "--mx-color-primary": "#123456" });
    expect(shadowRoot.host.style.setProperty).toHaveBeenCalledWith(
      "--mx-color-primary",
      "#123456",
    );

    injector.unregister(shadowRoot);
    expect(injector.has(shadowRoot)).toBe(false);
  });

  it("fail-closed: failing root raises ThemeInjectionError and previous is NOT advanced", () => {
    const goodRoot = makeRoot();
    const badRoot = makeRoot();
    const injector = new ThemeInjector();
    injector.register(goodRoot);
    injector.register(badRoot);

    injector.inject({ "--mx-color-primary": "#111" });
    expect(goodRoot.style.setProperty).toHaveBeenCalledWith(
      "--mx-color-primary",
      "#111",
    );

    badRoot.style.setProperty.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    let raised: ThemeInjectionError | undefined;
    expect(() => {
      try {
        injector.inject({ "--mx-color-primary": "#222" });
      } catch (error) {
        raised = error as ThemeInjectionError;
        throw error;
      }
    }).toThrowError(ThemeInjectionError);
    expect(raised?.code).toBe("THEME_INJECTION");
    expect(raised?.details.hostKind).toBe("root style application failed");

    injector.inject({ "--mx-color-primary": "#222" });
    expect(badRoot.style.setProperty).toHaveBeenLastCalledWith(
      "--mx-color-primary",
      "#222",
    );
    expect(goodRoot.style.setProperty).toHaveBeenCalledTimes(3);
  });

  it("structural rejection: root without style or host surface fails closed", () => {
    const injector = new ThemeInjector();
    injector.register({} as ThemeRoot);

    let raised: ThemeInjectionError | undefined;
    expect(() => {
      try {
        injector.inject({ "--mx-color-primary": "#111" });
      } catch (error) {
        raised = error as ThemeInjectionError;
        throw error;
      }
    }).toThrowError(ThemeInjectionError);
    expect(raised?.code).toBe("THEME_INJECTION");
    expect(raised?.details.hostKind).toContain("no style surface");
  });
});
