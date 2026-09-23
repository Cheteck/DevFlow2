/**
 * Pure function to resolve slot/layout values across the 5 precedence levels
 * with shell route exclusion.
 * Zero node:fs, zero shell/BAC imports.
 */

export interface SlotResolutionContext {
  readonly route: string;
  readonly isShellRoute: boolean;
  readonly parentValue?: unknown;
  readonly themeValue?: unknown;
  readonly nonOwnerAppValue?: unknown;
  readonly ownerAppValue?: unknown;
  readonly tenantValue?: unknown;
}

export function resolveSlot(ctx: SlotResolutionContext): unknown {
  // Start with parent value (Level 0)
  let resolved = ctx.parentValue;

  // Level 1: Theme value
  if (ctx.themeValue !== undefined) {
    resolved = ctx.themeValue;
  }

  // If NOT a shell route, consider application overrides (Level 2 & Level 3)
  if (!ctx.isShellRoute) {
    // Level 2: Non-owner app override
    if (ctx.nonOwnerAppValue !== undefined) {
      resolved = ctx.nonOwnerAppValue;
    }
    // Level 3: Route-owner app override (takes precedence over non-owner)
    if (ctx.ownerAppValue !== undefined) {
      resolved = ctx.ownerAppValue;
    }
  }

  // Level 4: Tenant override (highest precedence)
  if (ctx.tenantValue !== undefined) {
    resolved = ctx.tenantValue;
  }

  return resolved;
}
