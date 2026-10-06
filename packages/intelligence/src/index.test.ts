import { describe, expect, it } from "vitest";
import {
  CapabilityRegistry,
  ConfidenceEngine,
  IntelligenceRuntime,
} from "./index.js";

describe("MosaiX Intelligence Core", () => {
  it("registers and discovers P0 capabilities", () => {
    const registry = CapabilityRegistry.getInstance();
    const caps = registry.list();
    expect(caps.length).toBeGreaterThanOrEqual(6);

    const classifyCap = registry.get("commerce.product.classify");
    expect(classifyCap).toBeDefined();
    expect(classifyCap?.defaultThresholds.automatic).toBe(0.95);
  });

  it("evaluates confidence thresholds (AUTO, SUGGEST, HUMAN)", () => {
    const thresholds = { automatic: 0.95, assisted: 0.75 };
    expect(ConfidenceEngine.evaluateLevel(0.98, thresholds)).toBe("AUTO");
    expect(ConfidenceEngine.evaluateLevel(0.85, thresholds)).toBe("SUGGEST");
    expect(ConfidenceEngine.evaluateLevel(0.60, thresholds)).toBe("HUMAN");
  });

  it("executes decision requests via MockProvider", async () => {
    const runtime = new IntelligenceRuntime();
    const result = await runtime.decide({
      capability: "commerce.product.classify",
      state: { title: "Samsung Galaxy S26 512GB Noir" },
    });

    expect(result.provider).toBe("mock");
    expect(result.confidenceLevel).toBe("AUTO");
    expect((result.value as { category: string }).category).toBe("smartphones");
  });

  it("executes decision bundles", async () => {
    const runtime = new IntelligenceRuntime();
    const bundleResult = await runtime.decideBundle({
      capability: "commerce.product.enrichment",
      state: { title: "Samsung Galaxy S26" },
      decisions: {
        category: { capability: "commerce.product.classify" },
        moderation: { capability: "spaces.content.moderate" },
      },
    });

    expect(bundleResult.results.category).toBeDefined();
    expect(bundleResult.results.moderation).toBeDefined();
    expect(bundleResult.overallConfidence).toBeGreaterThan(0.9);
  });
});
