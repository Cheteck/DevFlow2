/**
 * Theme manifest — a theme is itself a Mosaix artifact.
 */

import type { MosaixArtifactManifest } from "../mosaix-artifact";
import type { DesignTokens } from "./design-tokens";
import type { AccessibilityProfile } from "./accessibility";
import type { ThemeAssets } from "./branding";

export interface ThemeManifest extends MosaixArtifactManifest {
  type: "theme";
  tokens: DesignTokens;
  /** Optional parent theme id to inherit from. */
  extends?: string;
  /**
   * Theme contract semver validated at discovery time
   * (`ThemeDiscovery` requires a valid `major.minor.patch` value).
   */
  contractVersion?: string;
  assets?: ThemeAssets;
  accessibility?: AccessibilityProfile;
  /**
   * Partial DesignTokens overlays merged deterministically over base `tokens`
   * at compile time. Only light/dark keys are allowed (D-08/D-09) — a
   * "system" overlay key is a schema error, enforced by ThemeManifestSchema.
   */
  modes?: {
    readonly light?: DesignTokens;
    readonly dark?: DesignTokens;
    readonly "high-contrast"?: DesignTokens;
  };
}
