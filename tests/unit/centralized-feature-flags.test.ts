import { describe, it, expect } from "vitest";
import {
  FEATURE_FLAG_REGISTRY,
  getDefaultValueForEnvironment,
} from "@mosaix/ports-feature-flags";
import { getPlatformFeatureFlags } from "../../src/shell/feature-flags.js";

describe("Centralized Feature Flag Architecture Specification Suite", () => {
  describe("1. Environment Defaults Resolution", () => {
    it("resolves development, staging, and production environment defaults from registry", () => {
      expect(getDefaultValueForEnvironment("platform.live_editor.enabled", "development")).toBe(true);
      expect(getDefaultValueForEnvironment("platform.live_editor.enabled", "production")).toBe(false);

      expect(getDefaultValueForEnvironment("imperia.dlq.auto_replay", "development")).toBe(true);
      expect(getDefaultValueForEnvironment("imperia.dlq.auto_replay", "production")).toBe(false);
    });
  });

  describe("2. Environment Variable Overrides (MOSAIX_FLAG_*)", () => {
    it("respects MOSAIX_FLAG_* environment variable overrides", async () => {
      const prevEnv = process.env.MOSAIX_FLAG_SOLARA_FEED_ALGORITHMIC_RANKING;
      process.env.MOSAIX_FLAG_SOLARA_FEED_ALGORITHMIC_RANKING = "true";

      try {
        const ff = getPlatformFeatureFlags();
        const enabled = await ff.isEnabled("solara.feed.algorithmic_ranking");
        expect(enabled).toBe(true);
      } finally {
        if (prevEnv !== undefined) {
          process.env.MOSAIX_FLAG_SOLARA_FEED_ALGORITHMIC_RANKING = prevEnv;
        } else {
          delete process.env.MOSAIX_FLAG_SOLARA_FEED_ALGORITHMIC_RANKING;
        }
      }
    });
  });

  describe("3. Targeting Rules & Context Evaluation", () => {
    it("evaluates role allowlists correctly", async () => {
      const ff = getPlatformFeatureFlags();

      const adminEnabled = await ff.isEnabled("platform.live_editor.enabled", {
        key: "admin-user",
        roles: ["admin"],
      });
      expect(adminEnabled).toBe(true);

      const guestEnabled = await ff.isEnabled("platform.live_editor.enabled", {
        key: "guest-user",
        roles: ["guest"],
      });
      expect(guestEnabled).toBe(false);
    });

    it("evaluates user allowlists correctly", async () => {
      const ff = getPlatformFeatureFlags();
      await ff.setFlag("platform.experimental_plugins", false, "test flag", {
        usersAllowlist: ["usr_beta_tester"],
      });

      const allowed = await ff.isEnabled("platform.experimental_plugins", {
        key: "usr_beta_tester",
        userId: "usr_beta_tester",
      });
      expect(allowed).toBe(true);

      const denied = await ff.isEnabled("platform.experimental_plugins", {
        key: "usr_regular",
        userId: "usr_regular",
      });
      expect(denied).toBe(false);
    });
  });

  describe("4. Reset to Default & Snapshot Hydration", () => {
    it("resets flag to canonical environment default via resetToDefault", async () => {
      const ff = getPlatformFeatureFlags();

      await ff.setFlag("platform.mcp.gateway_enabled", false);
      expect(await ff.isEnabled("platform.mcp.gateway_enabled")).toBe(false);

      await ff.resetToDefault("platform.mcp.gateway_enabled");
      expect(await ff.isEnabled("platform.mcp.gateway_enabled")).toBe(true);
    });

    it("generates evaluated snapshot for client hydration via getAllFlagsSnapshot", async () => {
      const ff = getPlatformFeatureFlags();
      const snapshot = await ff.getAllFlagsSnapshot({ key: "usr-1", roles: ["admin"] });

      expect(snapshot).toHaveProperty("apps.citadelle.enabled");
      expect(snapshot).toHaveProperty("apps.solara.enabled");
      expect(snapshot["apps.citadelle.enabled"]).toBe(true);
    });
  });
});
