/**
 * Resolved theme — the final extends-resolved theme ready to compile.
 *
 * PRD-0008 §4.6, D-07. The `manifest` here is the resolution RESULT (a fully
 * resolved `ThemeManifest`), distinct from the lightweight `ThemeResolution`
 * decision record.
 *
 * `CompiledTheme` (correction C2) maps token names to CSS values — never
 * `unknown`.
 *
 * Dependency direction: contracts → types (downward only).
 * Consumers: theme compiler (Phase 3), ResolvedThemeSchema.
 */

import type { ThemeManifest } from "./theme-manifest";
import type { ThemeMode } from "./theme-mode";
import type { ThemeTarget } from "./theme-target";

export interface ResolvedTheme {
  readonly target?: ThemeTarget;
  readonly themeId: string;
  readonly version: string;
  readonly mode: ThemeMode;
  readonly manifest: ThemeManifest;
}

/** { "--mx-color-primary": "#1e73e8" } */
export type CompiledTheme = Record<string, string>;
