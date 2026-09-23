/**
 * Theme target — the entity a theme is assigned to.
 *
 * Generic by design (INV-THEME-001/002): `type` is a project-declared string
 * ("store", "brand", "workspace", …) and the contract carries ZERO
 * business-entity references — a developer can author a target for a custom
 * entity type without the Theme System knowing it (PRD-0008 §4.1, success
 * criteria #5).
 *
 * Dependency direction: contracts → types (downward only).
 * Consumers: ThemeAssignment, ThemeResolutionContext, ResolvedTheme, theme
 * events.
 */

export interface ThemeTarget {
  readonly type: string;
  readonly id: string;
}
