/**
 * Accessibility profile — what an application/theme supports.
 */

export interface AccessibilityProfile {
  /** Supported contrast levels. */
  contrast?: ("normal" | "aa" | "aaa")[];
  /** Supports reduced motion. */
  reducedMotion?: boolean;
  /** Supports large text scaling. */
  largeText?: boolean;
  /** High contrast variant. */
  highContrast?: boolean;
}
