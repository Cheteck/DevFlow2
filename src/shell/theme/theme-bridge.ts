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
    const store = new InMemoryThemeAssignmentsStore();
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

  // DEPRECATED ABI fallback for 1 release: map old --bg-* / --mosaix-* variables to --mx-*
  lines.push("  /* DEPRECATED ALIASES — Fallback for legacy BACs */");
  lines.push("  --bg-primary: var(--mx-color-background, #f8fafc);");
  lines.push("  --bg-surface: var(--mx-color-surface, #ffffff);");
  lines.push("  --mosaix-primary: var(--mx-color-primary, #4f46e5);");
  lines.push("  --mosaix-text: var(--mx-color-text, #0f172a);");
  lines.push("  --mosaix-text-muted: var(--mx-color-text-muted, #64748b);");
  lines.push("  --mosaix-border: var(--mx-color-border, #e2e8f0);");
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
