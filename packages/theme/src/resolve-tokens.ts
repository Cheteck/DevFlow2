/**
 * @mosaix/theme — Unified Token Resolution & Deep Merge Engine
 */

import type { DesignTokens } from "@mosaix/contracts";

export function deepMergeTokens(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...target };
  if (!source || typeof source !== "object") return output;

  for (const key of Object.keys(source)) {
    const targetVal = output[key];
    const sourceVal = source[key];
    if (
      sourceVal !== null &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      output[key] = deepMergeTokens(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      );
    } else if (sourceVal !== undefined) {
      output[key] = sourceVal;
    }
  }

  return output;
}

/**
 * Pure function to resolve and merge design tokens with mode overlays and tenant overrides.
 * Preserves deterministic precedence: Base Tokens -> Mode Overlay -> Tenant Overrides.
 */
export function resolveTokens(
  baseTokens: DesignTokens,
  modeOverlay?: Partial<DesignTokens>,
  tenantOverrides?: Partial<DesignTokens>,
): DesignTokens {
  let merged = deepMergeTokens(
    baseTokens as unknown as Record<string, unknown>,
    (modeOverlay ?? {}) as unknown as Record<string, unknown>,
  );

  if (tenantOverrides) {
    merged = deepMergeTokens(
      merged,
      tenantOverrides as unknown as Record<string, unknown>,
    );
  }

  return merged as unknown as DesignTokens;
}
