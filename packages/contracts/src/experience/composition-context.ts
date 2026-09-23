/**
 * @mosaix/contracts — Composition Context
 * Explicit, immutable context required for composition resolution.
 */

import type { ThemeTarget } from "../theme/theme-target";
import type { ThemePreference } from "../theme/theme-preference";

export interface CompositionContext {
  tenant: { id: string };
  user?: {
    id: string;
    roles?: string[];
    identityType?: "personal" | "space" | "platform";
    preference?: ThemePreference;
  };
  application?: {
    id: string;
    activeAppId?: string;
  };
  route?: {
    pathname: string;
    params?: Record<string, string>;
  };
  target?: ThemeTarget;
  device?: {
    type: "mobile" | "tablet" | "desktop";
  };
  capabilities?: string[];
  permissions?: string[];
  featureFlags?: Record<string, unknown>;
  locale?: string;
}
