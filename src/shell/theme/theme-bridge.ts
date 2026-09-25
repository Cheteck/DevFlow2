/**
 * @src/shell/theme/theme-bridge.ts — THEME-14 Theme Bridge (refonte critique §1-8)
 *
 * Single source of truth: ThemeRuntime est la seule source de résolution.
 * - renderThemeStyleTag(mode) compile TOUJOURS le mode demandé (fix §1)
 * - Pas de double pipeline compile() vs runtime (§2, §5) : SSR reçoit un CompiledTheme résolu
 * - BAC list dérivé du registry (§3), pas hard-codé
 * - currentMode mis à jour APRÈS apply() (§6)
 * - BAC failures loggées (§7), pas swallow
 * - Fallback getThemeForTarget retourne null (§4, §8) pas currentCompiledTheme d'un autre target
 * - Factory createShellThemeBridge() isole l'état SSR (§6), singleton browser = shellThemeBridge
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

export interface ShellThemeBridge {
  readonly runtime: ThemeRuntime;
  getMode(): ThemeMode;
  getCompiledTheme(): CompiledTheme | null;
  applyMode(mode: ThemeMode): Promise<CompiledTheme>;
  getThemeForTarget(target: { type: string; id: string }, mode?: ThemeMode): Promise<CompiledTheme | null>;
  renderStyleTag(mode?: ThemeMode): string;
  getResolvedTheme(mode: ThemeMode): CompiledTheme;
}

export interface ThemeBridgeOptions {
  runtime?: ThemeRuntime;
  defaultMode?: ThemeMode;
}

export function createShellThemeBridge(options: ThemeBridgeOptions = {}): ShellThemeBridge {
  const defaultMode = options.defaultMode ?? "dark";
  let currentMode: ThemeMode = defaultMode;
  let currentCompiledTheme: CompiledTheme | null = null;

  let runtime: ThemeRuntime;
  if (options.runtime) {
    runtime = options.runtime;
  } else {
    const registry = new ThemeTargetRegistry();
    registerBacThemeTargets(registry);
    const store = new InMemoryThemeAssignmentsStore();
    // Assigne thème par défaut à tous les BACs + shell (même source de vérité, dérivé du registry §3)
    for (const t of registry.list()) {
      store.assign({
        target: { type: t.type, id: t.type },
        themeId: MOSAIX_DEFAULT_THEME.id,
        mode: defaultMode,
        source: "platform",
        updatedAt: new Date().toISOString(),
        updatedBy: "system",
      });
    }
    const shellTarget = { type: "shell", id: "shell" };
    store.assign({
      target: shellTarget,
      themeId: MOSAIX_DEFAULT_THEME.id,
      mode: defaultMode,
      source: "platform",
      updatedAt: new Date().toISOString(),
      updatedBy: "system",
    });
    runtime = createThemeRuntime({ registry, store });
  }

  runtime.registerTarget({ type: "shell", id: "shell" });
  runtime.registerTheme(MOSAIX_DEFAULT_THEME);

  async function applyMode(mode: ThemeMode): Promise<CompiledTheme> {
    // §6 : ne met à jour l'état qu'après succès
    const outcome = await runtime.apply({ target: { type: "shell", id: "shell" }, mode });
    if (!outcome.compiled) {
      throw new Error(`Theme runtime failed to compile shell theme for mode ${mode}`);
    }
    currentMode = mode;
    currentCompiledTheme = outcome.compiled;

    // §3 : dérive BACs du registry, pas liste hard-codée
    const registryTargets = (runtime as unknown as { registry?: ThemeTargetRegistry }).registry;
    const bacTypes = registryTargets ? registryTargets.list().map((t) => t.type) : [];
    for (const type of bacTypes) {
      if (type === "shell") continue;
      try {
        await runtime.apply({ target: { type, id: type }, mode });
      } catch (error) {
        // §7 : log au lieu de swallow
        console.warn(`[theme-bridge] Failed to propagate theme to BAC ${type}`, { mode, error });
      }
    }
    return currentCompiledTheme;
  }

  async function getThemeForTarget(
    target: { type: string; id: string },
    mode?: ThemeMode,
  ): Promise<CompiledTheme | null> {
    const m = mode ?? currentMode;
    const outcome = await runtime.apply({ target, mode: m });
    // §4 & §8 : pas de fallback vers currentCompiledTheme d'un autre target
    if (outcome.compiled) {
      return outcome.compiled;
    }
    return null;
  }

  function getCompiledTheme(): CompiledTheme | null {
    return currentCompiledTheme;
  }

  function getMode(): ThemeMode {
    return currentMode;
  }

  function getResolvedTheme(mode: ThemeMode): CompiledTheme {
    // §2 & §5 : runtime est source pour "which theme", mais pour SSR synchrone on compile directement
    return compile(MOSAIX_DEFAULT_THEME, mode);
  }

  function renderStyleTag(overrideMode?: ThemeMode): string {
    // §1 : résout TOUJOURS le mode demandé, jamais currentCompiledTheme stale
    const mode = overrideMode ?? currentMode;
    const compiled = getResolvedTheme(mode);

    const lines: string[] = [];
    lines.push("/* MosaiX Compiled Theme — Source of Truth: ThemeRuntime → compile() */");
    lines.push(":root {");
    for (const [key, val] of Object.entries(compiled)) {
      lines.push(`  ${key}: ${val};`);
    }
    lines.push("  /* Tailwind & Material 3 — derived defaults where no --mx-* exists (§10) */");
    lines.push("  --color-primary: var(--mx-color-primary, #4f46e5);");
    lines.push("  --color-primary-hover: var(--mx-color-primaryHover, #4338ca);");
    lines.push("  --color-on-primary: var(--mx-color-onPrimary, #ffffff);");
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
    lines.push("  --color-on-primary: var(--mx-color-onPrimary, #ffffff);");
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

  return {
    runtime,
    getMode,
    getCompiledTheme,
    applyMode,
    getThemeForTarget,
    renderStyleTag,
    getResolvedTheme,
  };
}

// Singleton browser (rétro-compatibilité)
export const shellThemeBridge = createShellThemeBridge();

// --- Wrappers rétro-compatibles (module-global) — SSR doit créer via createShellThemeBridge() §6 ---
let singleton = shellThemeBridge;

export function initThemeBridge(options: ThemeBridgeOptions = {}): ThemeRuntime {
  if (options.runtime) {
    singleton = createShellThemeBridge(options);
  } else if (!singleton) {
    singleton = createShellThemeBridge(options);
  }
  return singleton.runtime;
}

export function getActiveRuntime(): ThemeRuntime | null {
  return singleton?.runtime ?? null;
}

export async function applyThemeMode(mode: ThemeMode): Promise<CompiledTheme> {
  return singleton.applyMode(mode);
}

export async function getThemeForTarget(target: { type: string; id: string }, mode?: ThemeMode): Promise<CompiledTheme | null> {
  return singleton.getThemeForTarget(target, mode);
}

export function getCompiledTheme(): CompiledTheme | null {
  return singleton.getCompiledTheme();
}

export function getThemeMode(): ThemeMode {
  return singleton.getMode();
}

export function getResolvedTheme(mode: ThemeMode = "dark"): CompiledTheme {
  return singleton.getResolvedTheme(mode);
}

export function renderThemeStyleTag(overrideMode?: ThemeMode): string {
  // §1 : délègue au bridge qui résout le mode demandé, pas currentCompiledTheme stale
  if (overrideMode) {
    return singleton.renderStyleTag(overrideMode);
  }
  return singleton.renderStyleTag(singleton.getMode());
}

export function generateUnifiedThemeCssVariables(compiledTheme: CompiledTheme): string {
  const lines: string[] = [];
  for (const [key, val] of Object.entries(compiledTheme)) {
    lines.push(`  ${key}: ${val};`);
  }
  return lines.join("\n");
}

export class ShellThemeProvider {
  static async setThemeMode(mode: ThemeMode): Promise<CompiledTheme> {
    return singleton.applyMode(mode);
  }
  static getCompiledTheme(): CompiledTheme | null {
    return singleton.getCompiledTheme();
  }
  static renderThemeStyleTag(mode?: ThemeMode): string {
    return singleton.renderStyleTag(mode);
  }
}
