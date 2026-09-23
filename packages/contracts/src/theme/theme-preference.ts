/**
 * Theme preference — the canonical generic preference contract (D-01).
 *
 * PRD-0008 §4.3 V2.3 (C5/G6): a preference determines ONLY `mode` — it can
 * never replace an assigned themeId. Precedence between entity/user/
 * application/platform is the resolver's responsibility (Phase 2), never this
 * contract's.
 *
 * Dependency direction: contracts → types (downward only).
 * Consumers: ThemeResolutionContext, ThemePreferenceSchema.
 */

import type { ThemeMode } from "./theme-mode";

export interface ThemePreference {
  readonly inherit: boolean;
  readonly allowedModes?: readonly ThemeMode[];
  readonly preferredMode?: ThemeMode;
}
