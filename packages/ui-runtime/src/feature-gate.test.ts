import { describe, it, expect } from "vitest";
import { FeatureGate, renderFeatureGate } from "./feature-gate.js";
import { setFeatureFlagOverride } from "@mosaix/sdk";

describe("UI Runtime FeatureGate Specification Suite", () => {
  it("renders active HTML when flag is enabled", async () => {
    setFeatureFlagOverride("test.feature.gate_enabled", true);

    const html = await renderFeatureGate(
      "test.feature.gate_enabled",
      '<div class="enabled">Feature Active</div>',
      '<div class="disabled">Feature Disabled</div>',
    );

    expect(html).toContain("Feature Active");
  });

  it("renders fallback HTML when flag is disabled", async () => {
    setFeatureFlagOverride("test.feature.gate_disabled", false);

    const html = await renderFeatureGate(
      "test.feature.gate_disabled",
      '<div class="enabled">Feature Active</div>',
      '<div class="disabled">Feature Disabled</div>',
    );

    expect(html).toContain("Feature Disabled");
  });

  it("renders multivariate variations correctly via renderVariation", async () => {
    setFeatureFlagOverride("test.feature.theme_variant", "dark");

    const html = await FeatureGate.renderVariation(
      "test.feature.theme_variant",
      {
        light: '<div class="theme-light">Light</div>',
        dark: '<div class="theme-dark">Dark</div>',
        default: '<div class="theme-default">Default</div>',
      },
    );

    expect(html).toContain("Dark");
  });
});
