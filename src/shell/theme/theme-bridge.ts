/**
 * @src/shell/theme/theme-bridge.ts — THEME-14 Theme Bridge
 *
 * Connects the Core Theme Engine (ThemeRuntime) to the Shell HTML Renderer.
 * Single source of truth: `themes/*.json` on disk (loaded via
 * ThemeDiscovery). No theme values live in TypeScript — the former
 * `mosaix-default-theme.ts` constant and the hardcoded Tailwind palettes
 * were byte-duplicates of `themes/mosaix-default/theme.json` and have been
 * removed. Compiled `--mx-*` CSS variables remain the runtime truth.
 */

import * as path from "node:path";
import type {
  CompiledTheme,
  ThemeManifest,
  ThemeMode,
} from "@mosaix/contracts";
import {
  compile,
  createThemeRuntime,
  deepMergeTokens,
  InMemoryThemeAssignmentsStore,
  ThemeDiscovery,
  ThemeRuntime,
  ThemeTargetRegistry,
  PostgresThemeAssignmentsStore,
  registerBacThemeTargets,
  container,
} from "@mosaix/core";

let activeRuntime: ThemeRuntime | null = null;
let currentCompiledTheme: CompiledTheme | null = null;
let currentMode: ThemeMode = "light";

// ── Single source of truth: themes/ on disk ─────────────────────────
// The active theme id selects which discovered manifest is compiled.
// Every theme value (tokens, mode overlays, tailwind ramps) comes from
// `themes/<id>/theme.json` — nothing is hardcoded below.
const THEMES_DIR = path.resolve(process.cwd(), "themes");
const DEFAULT_THEME_ID = "mosaix-default";

const themeCatalog = new Map<string, ThemeManifest>();
let activeThemeId = DEFAULT_THEME_ID;
let catalogLoaded = false;
let compiledForThemeId: string | null = null;

function ensureCatalog(): void {
  if (catalogLoaded) return;
  const discovered = ThemeDiscovery.discoverThemes(THEMES_DIR);
  for (const theme of discovered) themeCatalog.set(theme.id, theme.manifest);
  catalogLoaded = true;
}

/** Switch the active theme (must be a discovered id from `themes/`). */
export function setActiveThemeId(id: string): void {
  ensureCatalog();
  if (!themeCatalog.has(id)) {
    throw new Error(
      `[theme] unknown theme "${id}" — available: ${[...themeCatalog.keys()].join(", ") || "(none)"} (dir: ${THEMES_DIR})`,
    );
  }
  if (id !== activeThemeId) {
    activeThemeId = id;
    currentCompiledTheme = null;
  }
}

export function getActiveThemeId(): string {
  return activeThemeId;
}

function getActiveManifest(): ThemeManifest {
  ensureCatalog();
  const manifest = themeCatalog.get(activeThemeId);
  if (!manifest) {
    throw new Error(
      `[theme] active theme "${activeThemeId}" not found in ${THEMES_DIR} — themes/ is the single source of truth, check theme.json manifests.`,
    );
  }
  return manifest;
}

type TailwindMap = Record<string, string>;

function tailwindBase(manifest: ThemeManifest): TailwindMap {
  const tokens = (manifest as unknown as { tokens?: unknown }).tokens;
  if (!isRecord(tokens)) return {};
  const raw = (tokens as Record<string, unknown>).tailwind;
  return isStringMap(raw) ? raw : {};
}

function tailwindOverlay(
  manifest: ThemeManifest,
  mode: "light" | "dark" | "high-contrast",
): TailwindMap {
  const holder = manifest as unknown as {
    modes?: Record<string, Record<string, unknown>>;
  };
  const tw = holder.modes?.[mode]?.tailwind;
  return isStringMap(tw) ? tw : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringMap(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((v) => typeof v === "string");
}

export interface ThemeBridgeOptions {
  runtime?: ThemeRuntime;
  defaultMode?: ThemeMode;
}

export function initThemeBridge(
  options: ThemeBridgeOptions = {},
): ThemeRuntime {
  if (options.runtime) {
    activeRuntime = options.runtime;
  } else {
    const registry = new ThemeTargetRegistry();
    registerBacThemeTargets(registry);

    let store;
    const hasContainer =
      typeof container !== "undefined" &&
      container &&
      typeof container.isBound === "function";
    // Exact store DB type, no `any`, no extra imports.
    type StoreDb = ConstructorParameters<
      typeof PostgresThemeAssignmentsStore
    >[0];
    if (hasContainer && container.isBound("database")) {
      const db = container.resolve<StoreDb>("database");
      store = new PostgresThemeAssignmentsStore(db);
    } else if (hasContainer && container.isBound("databasePort")) {
      const db = container.resolve<StoreDb>("databasePort");
      store = new PostgresThemeAssignmentsStore(db);
    } else {
      store = new InMemoryThemeAssignmentsStore();
    }

    activeRuntime = createThemeRuntime({ registry, store });
  }

  activeRuntime.registerTarget({ type: "shell", id: "shell" });
  // Register every discovered theme from themes/ (default + alternates
  // like midnight-ocean) — the catalog is file-driven, never hardcoded.
  ensureCatalog();
  for (const manifest of themeCatalog.values()) {
    activeRuntime.registerTheme(manifest);
  }

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
  if (
    currentCompiledTheme &&
    currentMode === mode &&
    compiledForThemeId === activeThemeId
  ) {
    return currentCompiledTheme;
  }
  currentCompiledTheme = compile(getActiveManifest(), mode);
  currentMode = mode;
  compiledForThemeId = activeThemeId;
  return currentCompiledTheme;
}

export function generateUnifiedThemeCssVariables(
  compiledTheme: CompiledTheme,
): string {
  const lines: string[] = [];
  for (const [key, val] of Object.entries(compiledTheme || {})) {
    lines.push(`  ${key}: ${val};`);
  }
  return lines.join("\n");
}

export function renderThemeStyleTag(overrideMode?: ThemeMode): string {
  const mode = overrideMode ?? currentMode;
  const manifest = getActiveManifest();

  // Ensure compiled theme exists synchronously if possible
  if (!currentCompiledTheme || compiledForThemeId !== activeThemeId) {
    // Compile fallback for sync SSR if apply() hasn't completed
    currentCompiledTheme = compile(manifest, mode);
    compiledForThemeId = activeThemeId;
  }

  const vars = currentCompiledTheme || {};

  // Fallback values are derived from the manifest itself (compiled
  // light/dark) — they only apply if an --mx-* var is missing, and they
  // always track themes/*.json. Trailing literals are dead defaults.
  const lightVars = compile(manifest, "light");
  const darkVars = compile(manifest, "dark");
  const lightTw = tailwindForMode(manifest, "light");
  const darkTw = tailwindForMode(manifest, "dark");
  const fb = (v: Record<string, string>, key: string, dead: string): string =>
    v[key] ?? dead;

  const lines: string[] = [];
  lines.push("/* MosaiX Compiled Theme — Source of Truth: --mx-* */");
  lines.push(":root {");

  // Output primary --mx-* variables
  for (const [key, val] of Object.entries(vars)) {
    lines.push(`  ${key}: ${val};`);
  }

  // Unified Tailwind CSS & Material 3 Surface Tokens mapping.
  // Every value below comes from themes/*.json (compiled vars + tailwind
  // ramps) — see tailwindForMode. No hardcoded palette.
  lines.push("  /* Tailwind CSS & Material Design 3 Surface Tokens Mapping */");
  lines.push(
    `  --color-primary: var(--mx-color-primary, ${fb(lightVars, "--mx-color-primary", "#4f46e5")});`,
  );
  lines.push(
    `  --color-primary-hover: var(--mx-color-primaryHover, ${fb(lightVars, "--mx-color-primaryHover", "#4338ca")});`,
  );
  // NOTE: --color-on-primary stays a static #ffffff in both blocks (current
  // rendered reality). The tailwind-config side uses on-primary from
  // themes/*.json — reconciling both is backlog (a11y contrast).
  lines.push("  --color-on-primary: #ffffff;");
  lines.push(
    `  --color-secondary: var(--mx-color-secondary, ${fb(lightVars, "--mx-color-secondary", "#06b6d4")});`,
  );
  lines.push(
    `  --color-surface: var(--mx-color-surface, ${fb(lightVars, "--mx-color-surface", "#ffffff")});`,
  );
  lines.push(
    `  --color-on-surface: var(--mx-color-text, ${fb(lightVars, "--mx-color-text", "#0f172a")});`,
  );
  lines.push(
    `  --color-on-surface-variant: var(--mx-color-textMuted, ${fb(lightVars, "--mx-color-textMuted", "#64748b")});`,
  );
  lines.push(`  --color-surface-variant: ${lightTw["surface-variant"]};`);
  lines.push(
    `  --color-surface-container-lowest: ${lightTw["surface-container-lowest"]};`,
  );
  lines.push(
    `  --color-surface-container-low: ${lightTw["surface-container-low"]};`,
  );
  lines.push(`  --color-surface-container: ${lightTw["surface-container"]};`);
  lines.push(
    `  --color-surface-container-high: ${lightTw["surface-container-high"]};`,
  );
  lines.push(
    `  --color-surface-container-highest: ${lightTw["surface-container-highest"]};`,
  );
  lines.push(
    `  --color-outline-variant: var(--mx-color-border, ${fb(lightVars, "--mx-color-border", "#e2e8f0")});`,
  );
  lines.push("}");

  lines.push('[data-theme-mode="dark"], .dark, html.dark {');
  lines.push(
    `  --color-primary: var(--mx-color-primary, ${fb(darkVars, "--mx-color-primary", "#6366f1")});`,
  );
  lines.push(
    `  --color-primary-hover: var(--mx-color-primaryHover, ${fb(darkVars, "--mx-color-primaryHover", "#818cf8")});`,
  );
  lines.push("  --color-on-primary: #ffffff;");
  lines.push(
    `  --color-secondary: var(--mx-color-secondary, ${fb(darkVars, "--mx-color-secondary", "#06b6d4")});`,
  );
  lines.push(
    `  --color-surface: var(--mx-color-surface, ${fb(darkVars, "--mx-color-surface", "#1e293b")});`,
  );
  lines.push(
    `  --color-on-surface: var(--mx-color-text, ${fb(darkVars, "--mx-color-text", "#f8fafc")});`,
  );
  lines.push(
    `  --color-on-surface-variant: var(--mx-color-textMuted, ${fb(darkVars, "--mx-color-textMuted", "#94a3b8")});`,
  );
  lines.push(`  --color-surface-variant: ${darkTw["surface-variant"]};`);
  lines.push(
    `  --color-surface-container-lowest: ${darkTw["surface-container-lowest"]};`,
  );
  lines.push(
    `  --color-surface-container-low: ${darkTw["surface-container-low"]};`,
  );
  lines.push(`  --color-surface-container: ${darkTw["surface-container"]};`);
  lines.push(
    `  --color-surface-container-high: ${darkTw["surface-container-high"]};`,
  );
  lines.push(
    `  --color-surface-container-highest: ${darkTw["surface-container-highest"]};`,
  );
  lines.push(
    `  --color-outline-variant: var(--mx-color-border, ${fb(darkVars, "--mx-color-border", "#334155")});`,
  );
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

/**
 * Tailwind-config palette for a mode, read from the active manifest's
 * `tokens.tailwind` group (base) + `modes[mode].tailwind` overlay.
 * `"system"` behaves like `"dark"` (historical shell default).
 */
function tailwindForMode(
  manifest: ThemeManifest,
  mode: ThemeMode,
): TailwindMap {
  const normalized =
    mode === "light"
      ? "light"
      : mode === "high-contrast"
        ? "high-contrast"
        : "dark";
  const merged = deepMergeTokens(
    tailwindBase(manifest),
    tailwindOverlay(manifest, normalized),
  );
  const out: TailwindMap = {};
  for (const [key, value] of Object.entries(merged)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export function getTailwindThemeColors(
  mode: ThemeMode = "dark",
): Record<string, string> {
  return tailwindForMode(getActiveManifest(), mode);
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

  static setActiveThemeId(id: string): void {
    setActiveThemeId(id);
  }

  static getActiveThemeId(): string {
    return getActiveThemeId();
  }
}
