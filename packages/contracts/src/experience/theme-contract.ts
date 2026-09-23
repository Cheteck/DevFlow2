/**
 * Theme preference — the theme surface an application opts into.
 *
 * Pre-ADR-0007 model (D-03): legacy experience contracts are NOT extended for
 * theme. Renamed to `ExperienceThemePreference` (D-02); the deprecated alias
 * `ThemePreference` keeps `ExperienceContract` / `ApplicationExperienceContract`
 * compiling unchanged.
 */

export interface ExperienceThemePreference {
  /** Inherit the platform theme (default true). */
  inherit: boolean;
  /** Supported color schemes, e.g. ["light", "dark"]. */
  supports: string[];
  /** Preferred theme id. */
  preferred?: string;
}

/** @deprecated Renamed to ExperienceThemePreference. Pre-ADR-0007 model; do not use for new code. */
export type ThemePreference = ExperienceThemePreference;
