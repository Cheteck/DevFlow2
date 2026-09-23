/**
 * Theme resolution — the lightweight decision record (which / which-mode / why).
 *
 * PRD-0008 §4.5, D-04/D-05/D-06. `ThemeResolutionSource` is EXACTLY
 * "entity" | "user" | "application" | "platform"; the tenant and default
 * sources are deferred to Phase 2 (tenant inheritance requires a separate ADR;
 * the robustness fallback is a resolver concern, not a Phase-1 contract).
 *
 * `ThemeResolutionContext` is standalone (D-06): it deliberately does NOT
 * import the ADR-0007 composition-context type — theme resolution takes
 * narrow, theme-scoped input only.
 *
 * Dependency direction: contracts → types (downward only).
 * Consumers: theme resolver (Phase 2), ThemeResolutionSchema.
 */

import type { ThemeMode } from "./theme-mode";
import type { ThemePreference } from "./theme-preference";
import type { ThemeTarget } from "./theme-target";

export type ThemeResolutionSource =
  "entity" | "user" | "application" | "platform";

export interface ThemeResolution {
  readonly themeId: string;
  readonly mode: ThemeMode;
  readonly source: ThemeResolutionSource;
}

export interface ThemeResolutionContext {
  readonly target: ThemeTarget;
  readonly userPreference?: ThemePreference;
  readonly applicationPreference?: ThemePreference;
  readonly precedence?: readonly ThemeResolutionSource[];
}
