/**
 * @mosaix/core — BAC theme target registrations (THEME-04-BAC)
 *
 * Each BAC that renders UI is a themeable target type.
 * Registered at bootstrap via ThemeTargetRegistry — enables
 * ThemeResolver to resolve a theme for that BAC's space/store.
 */

import type { ThemeTargetRegistration } from "./theme-target-registry";

export const BAC_THEME_TARGETS: readonly ThemeTargetRegistration[] = [
  { type: "space", capabilities: { userSelectable: false, adminConfigurable: true } },
  { type: "store", capabilities: { userSelectable: true, adminConfigurable: true } },
  { type: "brand", capabilities: { userSelectable: true, adminConfigurable: false } },
  { type: "workspace", capabilities: { userSelectable: false, adminConfigurable: true } },
  // BAC-specific targets — map domain to themeable surface
  { type: "commerce", capabilities: { userSelectable: false, adminConfigurable: true } },
  { type: "portfolio", capabilities: { userSelectable: false, adminConfigurable: true } },
  { type: "booking", capabilities: { userSelectable: false, adminConfigurable: true } },
  { type: "beam", capabilities: { userSelectable: false, adminConfigurable: true } },
  { type: "solara", capabilities: { userSelectable: false, adminConfigurable: true } },
  { type: "solidarity", capabilities: { userSelectable: false, adminConfigurable: true } },
  { type: "citadelle", capabilities: { userSelectable: false, adminConfigurable: true } },
  { type: "imperia", capabilities: { userSelectable: false, adminConfigurable: true } },
  { type: "subscription", capabilities: { userSelectable: false, adminConfigurable: true } },
] as const;

export function registerBacThemeTargets(
  registry: { register(r: ThemeTargetRegistration): void },
): void {
  for (const target of BAC_THEME_TARGETS) registry.register(target);
}
