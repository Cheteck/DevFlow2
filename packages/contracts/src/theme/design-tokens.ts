/**
 * Design tokens — semantic values that become CSS variables at runtime.
 */

export interface ColorTokens {
  primary: string;
  onPrimary?: string;
  secondary?: string;
  onSecondary?: string;
  background?: string;
  surface?: string;
  text?: string;
  muted?: string;
  border?: string;
  error?: string;
  warning?: string;
  success?: string;
}

export interface TypographyTokens {
  fontFamily?: string;
  baseSize?: string;
  heading?: string;
}

export interface SpacingTokens {
  xs?: string;
  sm?: string;
  md?: string;
  lg?: string;
  xl?: string;
}

export interface RadiusTokens {
  sm?: string;
  md?: string;
  lg?: string;
  full?: string;
}

export interface ShadowTokens {
  sm?: string;
  md?: string;
  lg?: string;
}

export interface MotionTokens {
  duration?: {
    fast?: string;
    normal?: string;
    slow?: string;
  };
  easing?: {
    standard?: string;
    decelerate?: string;
    accelerate?: string;
  };
}

/** Semantic design tokens; each value is a raw token to compile to CSS. */
export interface DesignTokens {
  colors: ColorTokens;
  typography?: TypographyTokens;
  spacing?: SpacingTokens;
  radius?: RadiusTokens;
  shadows?: ShadowTokens;
  motion?: MotionTokens;
}
