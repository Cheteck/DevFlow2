import { describe, it, expect } from "vitest";
import { FeatureFlagEvaluator } from "./evaluator.js";
import type { FeatureFlagDefinition, FeatureFlagUserContext } from "./index.js";

describe("FeatureFlagEvaluator Unit Tests", () => {
  it("evaluates default boolean value when no context or targeting rules exist", () => {
    const flag: FeatureFlagDefinition = {
      key: "test.flag",
      defaultValue: true,
    };

    expect(FeatureFlagEvaluator.evaluateTargeting(flag)).toBe(true);

    const disabledFlag: FeatureFlagDefinition = {
      key: "test.flag",
      defaultValue: false,
      enabled: false,
    };

    expect(FeatureFlagEvaluator.evaluateTargeting(disabledFlag)).toBe(false);
  });

  it("evaluates user allowlist rules", () => {
    const flag: FeatureFlagDefinition = {
      key: "user.specific.flag",
      defaultValue: false,
      usersAllowlist: ["user-123", "user-456"],
    };

    const ctxAllowed: FeatureFlagUserContext = { key: "user.specific.flag", userId: "user-123" };
    const ctxDenied: FeatureFlagUserContext = { key: "user.specific.flag", userId: "user-999" };

    expect(FeatureFlagEvaluator.evaluateTargeting(flag, ctxAllowed)).toBe(true);
    expect(FeatureFlagEvaluator.evaluateTargeting(flag, ctxDenied)).toBe(false);
  });

  it("evaluates role allowlist rules", () => {
    const flag: FeatureFlagDefinition = {
      key: "admin.only.flag",
      defaultValue: false,
      rolesAllowlist: ["admin", "super-admin"],
    };

    const adminCtx: FeatureFlagUserContext = { key: "admin.only.flag", roles: ["admin"] };
    const memberCtx: FeatureFlagUserContext = { key: "admin.only.flag", roles: ["member"] };

    expect(FeatureFlagEvaluator.evaluateTargeting(flag, adminCtx)).toBe(true);
    expect(FeatureFlagEvaluator.evaluateTargeting(flag, memberCtx)).toBe(false);
  });

  it("evaluates deterministic percentage rollout", () => {
    const flag: FeatureFlagDefinition = {
      key: "rollout.flag",
      defaultValue: false,
      percentageRollout: 50,
    };

    const hash1 = FeatureFlagEvaluator.hashUserToPercent("user-alice", "rollout.flag");
    const hash2 = FeatureFlagEvaluator.hashUserToPercent("user-bob", "rollout.flag");

    expect(hash1).toBeGreaterThanOrEqual(0);
    expect(hash1).toBeLessThan(100);

    // Same input produces exact same hash percentage
    expect(FeatureFlagEvaluator.hashUserToPercent("user-alice", "rollout.flag")).toBe(hash1);
  });
});
