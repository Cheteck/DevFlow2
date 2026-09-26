/**
 * @mosaix/theme — BAC Theme Targets Registry Declarations
 */

import type { ThemeTargetRegistration, ThemeTargetRegistry } from "./theme-target-registry.js";

export const BAC_THEME_TARGETS: ThemeTargetRegistration[] = [
  { type: "space", capabilities: { userSelectable: true, adminConfigurable: true } },
  { type: "store", capabilities: { userSelectable: true, adminConfigurable: true } },
  { type: "organization", capabilities: { userSelectable: false, adminConfigurable: true } },
  { type: "user", capabilities: { userSelectable: true, adminConfigurable: false } },
  { type: "application", capabilities: { userSelectable: false, adminConfigurable: true } },
  { type: "platform", capabilities: { userSelectable: false, adminConfigurable: true } },
];

export function registerBacThemeTargets(registry: ThemeTargetRegistry): void {
  for (const target of BAC_THEME_TARGETS) {
    registry.register(target);
  }
}
