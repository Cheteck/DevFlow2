import { describe, it, expect } from "vitest";
import { getPlatformFeatureFlags } from "../../src/shell/feature-flags.js";

describe("PersistentFeatureFlagsManager Specification Suite", () => {
  it("evaluates app toggles and role targeting rules", async () => {
    const ff = getPlatformFeatureFlags();

    const enabledCitadelle = await ff.isEnabled("apps.citadelle.enabled");
    expect(enabledCitadelle).toBe(true);

    const adminCtx = { key: "apps.imperia.enabled", roles: ["admin"] };
    const memberCtx = { key: "apps.imperia.enabled", roles: ["member"] };

    expect(await ff.isEnabled("apps.imperia.enabled", adminCtx)).toBe(true);
    expect(await ff.isEnabled("apps.imperia.enabled", memberCtx)).toBe(false);
  });

  it("returns full evaluated snapshot for a user context via getAllFlagsSnapshot", async () => {
    const ff = getPlatformFeatureFlags();
    const snapshot = await ff.getAllFlagsSnapshot({ key: "user-1", roles: ["admin"] });

    expect(snapshot["platform.dark_mode_default"]).toBe(true);
    expect(snapshot["apps.citadelle.enabled"]).toBe(true);
    expect(snapshot["apps.imperia.enabled"]).toBe(true);
  });
});
