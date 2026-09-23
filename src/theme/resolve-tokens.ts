/**
 * Pure function to resolve and merge design tokens with mode overlays.
 * Zero node:fs, zero shell/BAC imports.
 */
import type { DesignTokens } from "@mosaix/contracts";

export function resolveTokens(
  baseTokens: DesignTokens,
  modeOverlay?: Partial<DesignTokens>,
  tenantOverrides?: Partial<DesignTokens>
): DesignTokens {
  const mergedColors = {
    ...baseTokens.colors,
    ...(modeOverlay?.colors ?? {}),
    ...(tenantOverrides?.colors ?? {}),
  };

  const mergedTypography = {
    ...baseTokens.typography,
    ...(modeOverlay?.typography ?? {}),
    ...(tenantOverrides?.typography ?? {}),
  };

  const mergedSpacing = {
    ...baseTokens.spacing,
    ...(modeOverlay?.spacing ?? {}),
    ...(tenantOverrides?.spacing ?? {}),
  };

  const mergedRadius = {
    ...baseTokens.radius,
    ...(modeOverlay?.radius ?? {}),
    ...(tenantOverrides?.radius ?? {}),
  };

  const mergedShadows = {
    ...baseTokens.shadows,
    ...(modeOverlay?.shadows ?? {}),
    ...(tenantOverrides?.shadows ?? {}),
  };

  const mergedMotion = {
    ...baseTokens.motion,
    ...(modeOverlay?.motion ?? {}),
    ...(tenantOverrides?.motion ?? {}),
  };

  return {
    colors: mergedColors,
    typography: mergedTypography,
    spacing: mergedSpacing,
    radius: mergedRadius,
    shadows: mergedShadows,
    motion: mergedMotion,
  };
}
