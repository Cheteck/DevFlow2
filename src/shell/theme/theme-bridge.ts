/**
 * @src/shell/theme/theme-bridge.ts — THEME-14 Theme Bridge (Thread-Safe)
 *
 * Connects the Core Theme Engine (ThemeRuntime) to the Shell HTML Renderer.
 * Single source of truth: `themes/*.json` on disk.
 *
 * THREAD-SAFE DESIGN:
 * - No global mutable state (all state is request-scoped via AsyncLocalStorage)
 * - Catalogue is immutable after boot (safe to share)
 * - ThemeRuntime is stateless; state lives in ALS per request
 */

import * as path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import type {
  CompiledTheme,
  ThemeManifest,
  ThemeMode,
  ThemeTarget,
  ThemeResolutionContext,
} from "@mosaix/contracts";
import { container } from "@mosaix/core";
import {
  compile,
  createThemeRuntime,
  deepMergeTokens,
  InMemoryThemeAssignmentsStore,
  PostgresThemeAssignmentsStore,
  registerBacThemeTargets,
  ThemeDiscovery,
  ThemeRuntime,
  ThemeTargetRegistry,
} from "@mosaix/theme";
import { tryGetRenderContext, type RenderContext } from "../../server/context/render-context.js";
import { InMemoryGuard } from "@mosaix/support";

// ── Single source of truth: themes/ on disk ─────────────────────────
const THEMES_DIR = path.resolve(process.cwd(), "themes");
const DEFAULT_THEME_ID = "mosaix-default";

// ── Request-scoped state (AsyncLocalStorage) ─────────────────────────
interface ThemeRequestState {
  readonly themeId: string;
  readonly mode: ThemeMode;
  readonly compiled: CompiledTheme;
  readonly runtime: ThemeRuntime;
}

const themeStateStorage = new AsyncLocalStorage<ThemeRequestState>();

// ── Singleton immutable catalogue (safe to share) ─────────────────────────
let themeCatalog: ReadonlyMap<string, ThemeManifest> | null = null;
let sharedRuntime: ThemeRuntime | null = null;

function getThemeCatalog(): ReadonlyMap<string, ThemeManifest> {
  if (themeCatalog === null) {
    const discovered = ThemeDiscovery.discoverThemes(THEMES_DIR);
    const map = new Map<string, ThemeManifest>();
    for (const theme of discovered) {
      map.set(theme.id, theme.manifest);
    }
    themeCatalog = Object.freeze(map);
  }
  return themeCatalog;
}

function getRuntime(): ThemeRuntime {
  if (sharedRuntime === null) {
    const registry = new ThemeTargetRegistry();
    registerBacThemeTargets(registry);

    let store;
    const hasContainer =
      typeof container !== "undefined" &&
      container &&
      typeof container.has === "function";
    
    type StoreDb = ConstructorParameters<typeof PostgresThemeAssignmentsStore>[0];
    
    if (hasContainer && container.has("database")) {
      const db = container.resolve<StoreDb>("database");
      store = new PostgresThemeAssignmentsStore(db);
    } else if (hasContainer && container.has("databasePort")) {
      const db = container.resolve<StoreDb>("databasePort");
      store = new PostgresThemeAssignmentsStore(db);
    } else {
      store = new InMemoryThemeAssignmentsStore();
      InMemoryGuard.reportFallback("ThemeBridge:inMemoryStore");
    }

    sharedRuntime = createThemeRuntime({ registry, store });
    
    sharedRuntime.registerTarget({
      type: "shell",
      capabilities: { userSelectable: false, adminConfigurable: true },
    });
    
    const catalog = getThemeCatalog();
    for (const manifest of catalog.values()) {
      sharedRuntime.registerTheme(manifest);
    }
  }
  return sharedRuntime;
}

function getEffectiveThemeId(): string {
  const ctx = tryGetRenderContext();
  return ctx?.theme?.themeId ?? DEFAULT_THEME_ID;
}

function getState(): ThemeRequestState | null {
  return themeStateStorage.getStore() ?? null;
}

// ── Public API ────────────────────────────────────────────────────────────

export function initThemeBridge(): ThemeRuntime {
  getRuntime();
  return getRuntime();
}

export function runWithThemeContext<T>(fn: () => Promise<T> | T): Promise<T> | T {
  return themeStateStorage.run(
    {
      themeId: getEffectiveThemeId(),
      mode: "light",
      compiled: {},
      runtime: getRuntime(),
    },
    fn,
  );
}

export async function applyThemeMode(mode: ThemeMode): Promise<CompiledTheme> {
  const runtime = getRuntime();
  const themeId = getEffectiveThemeId();
  const resolvedMode = mode === "system" ? "dark" : mode;
  
  const target: ThemeTarget = { type: "shell", id: "shell" };
  const ctx: ThemeResolutionContext = {
    target,
    applicationPreference: {
      inherit: false,
      preferredMode: resolvedMode,
    },
  };
  
  const outcome = await runtime.apply(ctx);
  
  if (!outcome.compiled) {
    throw new Error(
      `Failed to compile theme "${themeId}" in mode "${resolvedMode}"`
    );
  }

  // Defensive narrowing: store in a const so TS knows it's guaranteed
  const compiledTheme: CompiledTheme = outcome.compiled;

  const state: ThemeRequestState = {
    themeId,
    mode: resolvedMode,
    compiled: compiledTheme,
    runtime,
  };

  return themeStateStorage.run(state, () => compiledTheme);
}

export function getCompiledTheme(): CompiledTheme | null {
  const state = getState();
  return state?.compiled ?? null;
}

export function getThemeMode(): ThemeMode | null {
  const state = getState();
  return state?.mode ?? null;
}

export function getActiveThemeId(): string {
  const state = getState();
  return state?.themeId ?? getEffectiveThemeId();
}

export function getResolvedTheme(mode: ThemeMode = "light"): CompiledTheme {
  const state = getState();
  if (state?.compiled) {
    return state.compiled;
  }
  
  const runtime = getRuntime();
  const themeId = getEffectiveThemeId();
  const manifest = runtime.getTheme(themeId);
  
  if (!manifest) {
    throw new Error(`Theme "${themeId}" not found`);
  }
  
  return compile(manifest, mode);
}

export function generateUnifiedThemeCssVariables(compiledTheme: CompiledTheme): string {
  const lines: string[] = [];
  for (const [key, val] of Object.entries(compiledTheme || {})) {
    lines.push(`  ${key}: ${val};`);
  }
  return lines.join("\n");
}

function renderStatusColorDeclarations(tailwind: Record<string, string>): string[] {
  const declare = (css: string, mx: string, fallback: string): string =>
    `  --color-${css}: var(--mx-color-${mx}, ${tailwind[css] ?? fallback});`;
  return [
    declare("success", "success", "#10b981"),
    declare("success-hover", "successHover", "#059669"),
    declare("success-container", "successContainer", "#d1fae5"),
    declare("on-success", "onSuccess", "#022c22"),
    declare("warning", "warning", "#f59e0b"),
    declare("warning-hover", "warningHover", "#d97706"),
    declare("warning-container", "warningContainer", "#fef3c7"),
    declare("on-warning", "onWarning", "#422006"),
    `  --color-error: var(--mx-color-error, var(--mx-color-danger, ${tailwind["error"] ?? "#ef4444"}));`,
    declare("error-hover", "errorHover", "#dc2626"),
    declare("error-container", "errorContainer", "#fee2e2"),
    declare("on-error", "onError", "#450a0a"),
    declare("info", "info", "#3b82f6"),
    declare("info-hover", "infoHover", "#2563eb"),
    declare("info-container", "infoContainer", "#dbeafe"),
    declare("on-info", "onInfo", "#0c2a5a"),
  ];
}

export function renderThemeStyleTag(_overrideMode?: ThemeMode): string {
  const state = getState();
  const runtime = state?.runtime ?? getRuntime();
  const themeId = state?.themeId ?? getEffectiveThemeId();
  const mode = state?.mode ?? "dark";
  
  const manifest = runtime.getTheme(themeId);
  if (!manifest) {
    return "<!-- No theme available -->";
  }
  
  const lightVars = compile(manifest, "light");
  const darkVars = compile(manifest, "dark");
  const lightTw = tailwindForMode(manifest, "light");
  const darkTw = tailwindForMode(manifest, "dark");
  const fb = (v: Record<string, string>, key: string, dead: string): string =>
    v[key] ?? dead;

  const lines: string[] = [];
  lines.push("/* MosaiX Compiled Theme — Source of Truth: --mx-* (hot-switching enabled) */");

  lines.push(':root, [data-theme-mode="light"], [data-resolved-mode="light"] {');
  for (const [key, val] of Object.entries(lightVars)) {
    lines.push(`  ${key}: ${val};`);
  }
  lines.push("  /* Tailwind CSS & Material Design 3 Surface Tokens Mapping */");
  lines.push(`  --color-primary: var(--mx-color-primary, ${fb(lightVars, "--mx-color-primary", "#4f46e5")});`);
  lines.push(`  --color-primary-hover: var(--mx-color-primaryHover, ${fb(lightVars, "--mx-color-primaryHover", "#4338ca")});`);
  lines.push("  --color-on-primary: #ffffff;");
  lines.push(`  --color-secondary: var(--mx-color-secondary, ${fb(lightVars, "--mx-color-secondary", "#06b6d4")});`);
  lines.push(`  --color-surface: var(--mx-color-surface, ${fb(lightVars, "--mx-color-surface", "#ffffff")});`);
  lines.push(`  --color-on-surface: var(--mx-color-text, ${fb(lightVars, "--mx-color-text", "#0f172a")});`);
  lines.push(`  --color-on-surface-variant: var(--mx-color-textMuted, ${fb(lightVars, "--mx-color-textMuted", "#64748b")});`);
  lines.push(`  --color-surface-variant: ${lightTw["surface-variant"]};`);
  lines.push(`  --color-surface-container-lowest: ${lightTw["surface-container-lowest"]};`);
  lines.push(`  --color-surface-container-low: ${lightTw["surface-container-low"]};`);
  lines.push(`  --color-surface-container: ${lightTw["surface-container"]};`);
  lines.push(`  --color-surface-container-high: ${lightTw["surface-container-high"]};`);
  lines.push(`  --color-surface-container-highest: ${lightTw["surface-container-highest"]};`);
  lines.push(`  --color-outline-variant: var(--mx-color-border, ${fb(lightVars, "--mx-color-border", "#e2e8f0")});`);
  lines.push("  /* Semantic status tokens (Material 3) */");
  lines.push(...renderStatusColorDeclarations(lightTw));
  lines.push("}");

  lines.push('[data-theme-mode="dark"], [data-resolved-mode="dark"], .dark, html.dark {');
  for (const [key, val] of Object.entries(darkVars)) {
    lines.push(`  ${key}: ${val};`);
  }
  lines.push("  /* Tailwind CSS & Material Design 3 Surface Tokens Mapping */");
  lines.push(`  --color-primary: var(--mx-color-primary, ${fb(darkVars, "--mx-color-primary", "#6366f1")});`);
  lines.push(`  --color-primary-hover: var(--mx-color-primaryHover, ${fb(darkVars, "--mx-color-primaryHover", "#818cf8")});`);
  lines.push("  --color-on-primary: #ffffff;");
  lines.push(`  --color-secondary: var(--mx-color-secondary, ${fb(darkVars, "--mx-color-secondary", "#06b6d4")});`);
  lines.push(`  --color-surface: var(--mx-color-surface, ${fb(darkVars, "--mx-color-surface", "#1e293b")});`);
  lines.push(`  --color-on-surface: var(--mx-color-text, ${fb(darkVars, "--mx-color-text", "#f8fafc")});`);
  lines.push(`  --color-on-surface-variant: var(--mx-color-textMuted, ${fb(darkVars, "--mx-color-textMuted", "#94a3b8")});`);
  lines.push(`  --color-surface-variant: ${darkTw["surface-variant"]};`);
  lines.push(`  --color-surface-container-lowest: ${darkTw["surface-container-lowest"]};`);
  lines.push(`  --color-surface-container-low: ${darkTw["surface-container-low"]};`);
  lines.push(`  --color-surface-container: ${darkTw["surface-container"]};`);
  lines.push(`  --color-surface-container-high: ${darkTw["surface-container-high"]};`);
  lines.push(`  --color-surface-container-highest: ${darkTw["surface-container-highest"]};`);
  lines.push(`  --color-outline-variant: var(--mx-color-border, ${fb(darkVars, "--mx-color-border", "#334155")});`);
  lines.push("  /* Semantic status tokens (Material 3) */");
  lines.push(...renderStatusColorDeclarations(darkTw));
  lines.push("}");

  lines.push("@media (prefers-color-scheme: dark) {");
  lines.push('  html[data-theme-mode="system"]:not([data-resolved-mode="light"]),');
  lines.push('  :root:not([data-theme-mode]):not([data-resolved-mode="light"]) {');
  for (const [key, val] of Object.entries(darkVars)) {
    lines.push(`    ${key}: ${val};`);
  }
  lines.push("  }");
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

function tailwindForMode(manifest: ThemeManifest, mode: ThemeMode): Record<string, string> {
  const normalized = mode === "light" ? "light" : "dark";
  const tokens = (manifest as unknown as { tokens?: unknown }).tokens;
  const base = (tokens as Record<string, unknown>)?.tailwind ?? {};
  const holder = manifest as unknown as { modes?: Record<string, Record<string, unknown>> };
  const overlay = holder.modes?.[normalized]?.tailwind ?? {};
  const merged = deepMergeTokens(
    isStringMap(base) ? base : {},
    isStringMap(overlay) ? overlay : {},
  );
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(merged)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function isStringMap(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((v) => typeof v === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getTailwindThemeColors(mode: ThemeMode = "dark"): Record<string, string> {
  const state = getState();
  const runtime = state?.runtime ?? getRuntime();
  const themeId = state?.themeId ?? getEffectiveThemeId();
  const manifest = runtime.getTheme(themeId);
  if (!manifest) {
    return {};
  }
  return tailwindForMode(manifest, mode);
}

export function setActiveThemeId(id: string): void {
  const catalog = getThemeCatalog();
  if (!catalog.has(id)) {
    throw new Error(
      `[theme] unknown theme "${id}" — available: ${[...catalog.keys()].join(", ") || "(none)"}`
    );
  }
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