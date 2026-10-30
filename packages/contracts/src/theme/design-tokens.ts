/**
 * Design tokens — semantic values that become CSS variables at runtime.
 */

export interface ColorTokens {
  primary: string;
  primaryHover?: string;
  onPrimary?: string;
  secondary?: string;
  onSecondary?: string;
  background?: string;
  surface?: string;
  text?: string;
  textMuted?: string;
  muted?: string;
  border?: string;
  accent?: string;
  danger?: string;
  error?: string;
  warning?: string;
  success?: string;
  [key: string]: unknown;
}

export interface TypographyTokens {
  fontFamily?: string;
  fontSizeBase?: string;
  fontSizeSm?: string;
  fontSizeLg?: string;
  fontWeightNormal?: string | number;
  fontWeightMedium?: string | number;
  fontWeightBold?: string | number;
  lineHeight?: string | number;
  baseSize?: string;
  heading?: string;
  [key: string]: unknown;
}

export interface SpacingTokens {
  xs?: string;
  sm?: string;
  md?: string;
  lg?: string;
  xl?: string;
  [key: string]: unknown;
}

export interface RadiusTokens {
  sm?: string;
  md?: string;
  lg?: string;
  full?: string;
  [key: string]: unknown;
}

export interface ShadowTokens {
  sm?: string;
  md?: string;
  lg?: string;
  [key: string]: unknown;
}

export interface MotionTokens {
  durationFast?: string;
  durationNormal?: string;
  durationSlow?: string;
  easing?: string | Record<string, string>;
  duration?: Record<string, string>;
  [key: string]: unknown;
}

/** Semantic design tokens; each value is a raw token to compile to CSS. */
export interface DesignTokens {
  colors: ColorTokens;
  typography?: TypographyTokens;
  spacing?: SpacingTokens;
  radius?: RadiusTokens;
  shadows?: ShadowTokens;
  motion?: MotionTokens;
  tailwind?: Record<string, string>;
  [key: string]: unknown;
}
