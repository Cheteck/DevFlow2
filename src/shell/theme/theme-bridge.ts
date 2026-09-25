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
  registerBacThemeTargets,
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
    const store = new InMemoryThemeAssignmentsStore();
    // Assigne le thème par défaut au shell ET à tous les BACs pour propagation par défaut (même source de vérité)
    const allTargets = [...registry.list().map((t) => ({ type: t.type, id: t.type })), { type: "shell", id: "shell" }];
    for (const target of allTargets) {
      store.assign({
        target,
        themeId: MOSAIX_DEFAULT_THEME.id,
        mode: (options.defaultMode ?? "light") as ThemeMode,
        source: "platform",
        updatedAt: new Date().toISOString(),
        updatedBy: "system",
      });
    }
    activeRuntime = createThemeRuntime({ registry, store });
  }

  activeRuntime.registerTarget({ type: "shell", id: "shell" });
  activeRuntime.registerTheme(MOSAIX_DEFAULT_THEME);

  currentMode = options.defaultMode ?? "light";

  return activeRuntime;
}

export function getActiveRuntime(): ThemeRuntime | null {
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

  // Propage le même mode aux BACs (même source de vérité, même compiled via :root)
  if (activeRuntime) {
    for (const t of ["commerce", "portfolio", "booking", "beam", "solara", "solidarity", "citadelle", "imperia", "subscription", "space", "store"] as const) {
      try {
        await activeRuntime.apply({ target: { type: t, id: t }, mode });
      } catch {
        // fail-open : un BAC sans assignment reste sur fallback
      }
    }
  }

  return currentCompiledTheme!;
}

export async function getThemeForTarget(target: { type: string; id: string }, mode?: ThemeMode): Promise<CompiledTheme | null> {
  if (!activeRuntime) initThemeBridge();
  const m = mode ?? currentMode;
  const outcome = await activeRuntime!.apply({ target, mode: m });
  return outcome.compiled ?? currentCompiledTheme;
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
}
