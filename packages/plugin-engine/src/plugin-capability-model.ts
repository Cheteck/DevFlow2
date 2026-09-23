/**
 * @mosaix/plugin-engine — 3-Tier Plugin Capability Model (Phase 4)
 */

export type PluginCapabilityTier = "ui" | "application" | "privileged";

export interface PluginCapabilityGrant {
  tier: PluginCapabilityTier;
  capabilityId: string;
  scope?: string;
}

export class PluginCapabilityEnforcer {
  static evaluateGrant(grants: PluginCapabilityGrant[], targetTier: PluginCapabilityTier, capabilityId: string): boolean {
    return grants.some((g) => {
      if (g.capabilityId === "*" || g.capabilityId === capabilityId) {
        if (g.tier === "privileged") return true;
        if (g.tier === "application" && (targetTier === "application" || targetTier === "ui")) return true;
        if (g.tier === "ui" && targetTier === "ui") return true;
      }
      return false;
    });
  }
}
