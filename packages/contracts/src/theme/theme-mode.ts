/**
 * Theme mode — THE shared definition of the mode union (drift prevention).
 *
 * Exported once from here and reused by every theme contract that carries a
 * mode (`ThemeAssignment`, `ThemePreference`, `ThemeResolution`,
 * `ResolvedTheme`, `ThemeManifest.modes`), so no consumer can drift to its own
 * copy.
 *
 * PRD-0008 §4.5 / D-09: `"system"` is a resolution-time preference between
 * light and dark — it is NEVER a token overlay key (`ThemeManifest.modes`
 * accepts only light/dark).
 *
 * Dependency direction: contracts → types (downward only).
 * Consumers: theme/* contracts, ThemeModeSchema.
 */

export type ThemeMode = "light" | "dark" | "high-contrast" | "system";
