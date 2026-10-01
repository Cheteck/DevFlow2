import type { FeatureFlagDefinition, FeatureFlagUserContext } from "./index.js";

/**
 * FeatureFlagEvaluator — Pure-function targeting rule evaluator.
 * Decouples rule matching, user/tenant/role allowlisting, and percentage rollouts
 * from underlying persistence stores (Memory, Postgres, LaunchDarkly, etc.).
 */
export class FeatureFlagEvaluator {
  /**
   * Evaluates whether a flag is active for a given user context based on
   * targeting rules defined on the FeatureFlagDefinition.
   */
  public static evaluateTargeting(
    definition: FeatureFlagDefinition,
    context?: FeatureFlagUserContext,
  ): boolean {
    if (definition.enabled === false) {
      return false;
    }

    if (!context) {
      return Boolean(definition.defaultValue);
    }

    // 1. Users Allowlist (highest precedence)
    if (definition.usersAllowlist && definition.usersAllowlist.length > 0) {
      if (context.userId && definition.usersAllowlist.includes(context.userId)) {
        return true;
      }
      return false;
    }

    // 2. Roles Allowlist
    if (definition.rolesAllowlist && definition.rolesAllowlist.length > 0) {
      if (
        context.roles &&
        context.roles.some((role) => definition.rolesAllowlist!.includes(role))
      ) {
        return true;
      }
      return false;
    }

    // 3. Tenants Allowlist
    if (definition.tenantsAllowlist && definition.tenantsAllowlist.length > 0) {
      if (context.tenantId && definition.tenantsAllowlist.includes(context.tenantId)) {
        return true;
      }
      return false;
    }

    // 4. Subscription Plans Allowlist
    if (definition.plansAllowlist && definition.plansAllowlist.length > 0) {
      const planFromCustom = context.custom?.subscriptionPlan;
      const userPlan =
        context.subscriptionPlan ??
        (typeof planFromCustom === "string" ? planFromCustom : undefined);
      if (userPlan && definition.plansAllowlist.includes(userPlan)) {
        return true;
      }
      return false;
    }

    // 5. Deterministic Percentage Rollout
    if (
      typeof definition.percentageRollout === "number" &&
      definition.percentageRollout >= 0 &&
      definition.percentageRollout < 100
    ) {
      if (context.userId) {
        const hashPercent = this.hashUserToPercent(context.userId, definition.key);
        return hashPercent < definition.percentageRollout;
      }
      return false;
    }

    return Boolean(definition.defaultValue);
  }

  /**
   * Computes a deterministic percentage (0..99) for a user ID and flag key
   * using bitwise Murmur-inspired string hashing.
   */
  public static hashUserToPercent(userId: string, flagKey = ""): number {
    const combined = `${flagKey}:${userId}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      hash = (hash << 5) - hash + combined.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 100;
  }
}
