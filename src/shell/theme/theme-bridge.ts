/**
 * @src/shell/theme/theme-bridge.ts — THEME-14 Theme Bridge
 *
 * Connects the Core Theme Engine (ThemeRuntime) to the Shell HTML Renderer.
 * Single source of truth: compiled `--mx-*` CSS variables.
 */

import type { CompiledTheme, ThemeMode } from "@mosaix/contracts";
import {
  compile,
  createThemeRuntime,
  InMemoryThemeAssignmentsStore,
  ThemeRuntime,
  ThemeTargetRegistry,
  PostgresThemeAssignmentsStore,
  registerBacThemeTargets,
  container,
} from "@mosaix/core";
import { MOSAIX_DEFAULT_THEME } from "./mosaix-default-theme.js";

let activeRuntime: ThemeRuntime | null = null;
let currentCompiledTheme: CompiledTheme | null = null;
let currentMode: ThemeMode = "light";

export interface ThemeBridgeOptions {
  runtime?: ThemeRuntime;
  defaultMode?: ThemeMode;
}

export function initThemeBridge(options: ThemeBridgeOptions = {}): ThemeRuntime {
  if (options.runtime) {
    activeRuntime = options.runtime;
  } else {
    const registry = new ThemeTargetRegistry();
    registerBacThemeTargets(registry);

    let store;
    const hasContainer = typeof container !== "undefined" && container && typeof container.isBound === "function";
    if (hasContainer && container.isBound("database")) {
      const db = container.resolve<any>("database");
      store = new PostgresThemeAssignmentsStore(db);
    } else if (hasContainer && container.isBound("databasePort")) {
      const db = container.resolve<any>("databasePort");
      store = new PostgresThemeAssignmentsStore(db);
    } else {
      store = new InMemoryThemeAssignmentsStore();
    }

    activeRuntime = createThemeRuntime({ registry, store });
  }

  activeRuntime.registerTarget({ type: "shell", id: "shell" });
  activeRuntime.registerTheme(MOSAIX_DEFAULT_THEME);

  currentMode = options.defaultMode ?? "light";

  return activeRuntime;
}

export async function applyThemeMode(mode: ThemeMode): Promise<CompiledTheme> {
  if (!activeRuntime) {
    initThemeBridge();
  }

  currentMode = mode;
  const outcome = await activeRuntime!.apply({
    target: { type: "shell", id: "shell" },
    mode,
  });

  if (outcome.compiled) {
    currentCompiledTheme = outcome.compiled;
  }

  return currentCompiledTheme!;
}

export function getCompiledTheme(): CompiledTheme | null {
  return currentCompiledTheme;
}

export function getThemeMode(): ThemeMode {
  return currentMode;
}

/**
 * Renders the SSR <style> tag containing compiled --mx-* CSS variables,
 * backward-compatibility fallbacks, and accessibility media queries.
 */
export function getResolvedTheme(mode: ThemeMode = "light"): CompiledTheme {
  if (currentCompiledTheme && currentMode === mode) {
    return currentCompiledTheme;
  }
  currentCompiledTheme = compile(MOSAIX_DEFAULT_THEME, mode);
  currentMode = mode;
  return currentCompiledTheme;
}

export function generateUnifiedThemeCssVariables(compiledTheme: CompiledTheme): string {
  const lines: string[] = [];
  for (const [key, val] of Object.entries(compiledTheme || {})) {
    lines.push(`  ${key}: ${val};`);
  }
  return lines.join("\n");
}

export function renderThemeStyleTag(overrideMode?: ThemeMode): string {
  const mode = overrideMode ?? currentMode;

  // Ensure compiled theme exists synchronously if possible
  if (!currentCompiledTheme) {
    // Compile fallback for sync SSR if apply() hasn't completed
    currentCompiledTheme = compile(MOSAIX_DEFAULT_THEME, mode);
  }

  const vars = currentCompiledTheme || {};

  const lines: string[] = [];
  lines.push("/* MosaiX Compiled Theme — Source of Truth: --mx-* */");
  lines.push(":root {");

  // Output primary --mx-* variables
  for (const [key, val] of Object.entries(vars)) {
    lines.push(`  ${key}: ${val};`);
  }

  // Unified Tailwind CSS & Material 3 Surface Tokens mapping
  lines.push("  /* Tailwind CSS & Material Design 3 Surface Tokens Mapping */");
  lines.push("  --color-primary: var(--mx-color-primary, #4f46e5);");
  lines.push("  --color-primary-hover: var(--mx-color-primaryHover, #4338ca);");
  lines.push("  --color-on-primary: #ffffff;");
  lines.push("  --color-secondary: var(--mx-color-secondary, #06b6d4);");
  lines.push("  --color-surface: var(--mx-color-surface, #ffffff);");
  lines.push("  --color-on-surface: var(--mx-color-text, #0f172a);");
  lines.push("  --color-on-surface-variant: var(--mx-color-textMuted, #64748b);");
  lines.push("  --color-surface-variant: #f1f5f9;");
  lines.push("  --color-surface-container-lowest: #ffffff;");
  lines.push("  --color-surface-container-low: #f8fafc;");
  lines.push("  --color-surface-container: #f1f5f9;");
  lines.push("  --color-surface-container-high: #e2e8f0;");
  lines.push("  --color-surface-container-highest: #cbd5e1;");
  lines.push("  --color-outline-variant: var(--mx-color-border, #e2e8f0);");
  lines.push("}");

  lines.push("[data-theme-mode=\"dark\"], .dark, html.dark {");
  lines.push("  --color-primary: var(--mx-color-primary, #6366f1);");
  lines.push("  --color-primary-hover: var(--mx-color-primaryHover, #818cf8);");
  lines.push("  --color-on-primary: #ffffff;");
  lines.push("  --color-secondary: var(--mx-color-secondary, #22d3ee);");
  lines.push("  --color-surface: var(--mx-color-surface, #0f172a);");
  lines.push("  --color-on-surface: var(--mx-color-text, #f8fafc);");
  lines.push("  --color-on-surface-variant: var(--mx-color-textMuted, #94a3b8);");
  lines.push("  --color-surface-variant: #1e293b;");
  lines.push("  --color-surface-container-lowest: #020617;");
  lines.push("  --color-surface-container-low: #0f172a;");
  lines.push("  --color-surface-container: #1e293b;");
  lines.push("  --color-surface-container-high: #334155;");
  lines.push("  --color-surface-container-highest: #475569;");
  lines.push("  --color-outline-variant: var(--mx-color-border, #334155);");
  lines.push("}");

  // Accessibility media queries (Item 4)
  lines.push("@media (prefers-reduced-motion: reduce) {");
  lines.push("  :root {");
  lines.push("    --mx-motion-duration-fast: 0ms;");
  lines.push("    --mx-motion-duration-normal: 0ms;");
  lines.push("  }");
  lines.push("}");

  lines.push("@media (forced-colors: active) {");
  lines.push("  :root {");
  lines.push("    --mx-color-border: CanvasText;");
  lines.push("  }");
  lines.push("}");

  return `<style id="mosaix-compiled-theme">\n${lines.join("\n")}\n</style>`;
}

export function getTailwindThemeColors(
  mode: ThemeMode = "dark",
): Record<string, string> {
  if (mode === "light") {
    return {
      surface: "#ffffff",
      "surface-container-lowest": "#ffffff",
      "surface-container-low": "#f8fafc",
      "surface-container": "#f1f5f9",
      "surface-container-high": "#e2e8f0",
      "surface-container-highest": "#cbd5e1",
      "surface-variant": "#f1f5f9",
      "on-surface": "#0f172a",
      "on-surface-variant": "#64748b",
      primary: "#4f46e5",
      "on-primary": "#ffffff",
      "primary-container": "#e0e7ff",
      secondary: "#06b6d4",
      tertiary: "#8b5cf6",
      outline: "#cbd5e1",
      "outline-variant": "#e2e8f0",
      background: "#f8fafc",
    };
  }

  if (mode === "high-contrast") {
    return {
      surface: "#000000",
      "surface-container-lowest": "#000000",
      "surface-container-low": "#000000",
      "surface-container": "#000000",
      "surface-container-high": "#1a1a1a",
      "surface-container-highest": "#2a2a2a",
      "surface-variant": "#1a1a1a",
      "on-surface": "#ffffff",
      "on-surface-variant": "#ffff80",
      primary: "#ffff00",
      "on-primary": "#000000",
      "primary-container": "#ffff00",
      secondary: "#00ffff",
      tertiary: "#ff00ff",
      outline: "#ffffff",
      "outline-variant": "#ffffff",
      background: "#000000",
    };
  }

  // Dark mode (default)
  return {
    surface: "#0b1326",
    "surface-container-lowest": "#060e20",
    "surface-container-low": "#131b2e",
    "surface-container": "#171f33",
    "surface-container-high": "#222a3d",
    "surface-container-highest": "#2d3449",
    "surface-variant": "#2d3449",
    "on-surface": "#dae2fd",
    "on-surface-variant": "#cbc3d7",
    primary: "#d0bcff",
    "on-primary": "#3c0091",
    "primary-container": "#a078ff",
    secondary: "#cebdff",
    tertiary: "#c4c1fb",
    outline: "#958ea0",
    "outline-variant": "#494454",
    background: "#0b1326",
  };
}

export class ShellThemeProvider {
  static async setThemeMode(mode: ThemeMode): Promise<CompiledTheme> {
    return applyThemeMode(mode);
  }

  static getCompiledTheme(): CompiledTheme | null {
    return getCompiledTheme();
  }

  static renderThemeStyleTag(mode?: ThemeMode): string {
    return renderThemeStyleTag(mode);
  }

  static getTailwindThemeColors(mode?: ThemeMode): Record<string, string> {
    return getTailwindThemeColors(mode);
  }
}

