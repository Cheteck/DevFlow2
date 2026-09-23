/**
 * @mosaix/contracts — Block Wrapper Contract
 * Defines container wrapper templates and theme envelopes for UI contributions (CS-Cart UniTheme style).
 */

export type BlockWrapperType =
  | "card"
  | "hero-strip"
  | "collapsible"
  | "panel"
  | "borderless"
  | "glass"
  | "pill";

export interface BlockWrapperConfig {
  type: BlockWrapperType;
  title?: string;
  showHeader?: boolean;
  headerBadge?: string;
  padding?: "none" | "sm" | "md" | "lg";
  shadow?: "none" | "sm" | "md" | "lg" | "glow";
  accentBorder?: boolean;
  customStyleProps?: Record<string, string>;
}
