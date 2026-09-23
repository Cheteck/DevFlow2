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
}
