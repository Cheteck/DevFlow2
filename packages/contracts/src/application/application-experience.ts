/**
 * Application experience contract — the UI surface an application exposes.
 */

import type { NavigationContract } from "../experience/navigation-contract";
import type { LayoutContract } from "../experience/layout-contract";
import type { ThemePreference } from "../experience/theme-contract";
import type { WidgetContract } from "../experience/widget-contract";

export interface ApplicationExperienceContract {
  navigation?: NavigationContract[];
  layouts?: LayoutContract[];
  widgets?: WidgetContract[];
  theme?: ThemePreference;
  /**
   * Store card shown by the Shell (sidebar, drawers, pickers). The icon is
   * the BAC's visual identity — single emoji grapheme (current design
   * language; a Material-Symbols migration would be a separate
   * product decision). `showInNavigation: false` hides engine BACs
   * (e.g. subscription) from user navigation without hardcoding the shell.
   */
  appCard?: ApplicationAppCardContract;
}

export interface ApplicationAppCardContract {
  title: string;
  /**
   * BAC visual identity. Typed string, resolved by the Shell:
   * - raw emoji grapheme: `"🛒"` (current design language);
   * - Material Symbol: `"material:storefront"` (rendered with the
   *   `material-symbols-outlined` font already loaded by the Shell);
   * - image file: `"./assets/icon.png"`, `"/assets/icon.svg"` or
   *   `"https://…/icon.ico"` (ico, png, jpg, svg, webp, gif).
   * Anything else (including `javascript:`/`data:` URLs) is rejected and
   * falls back to the Shell default. A file → URL migration later is a
   * manifest-only change, no Shell edit.
   */
  icon: string;
  description?: string;
  showInNavigation?: boolean;
}
