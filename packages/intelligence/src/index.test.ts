import { describe, expect, it } from "vitest";
import {
  CapabilityRegistry,
  ConfidenceEngine,
  HumanReviewQueue,
  IntelligenceRuntime,
  MockDecisionProvider,
  type ReviewItem,
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

  it("supports per-capability confidence calibration (INT-MCP-01)", async () => {
    const runtime = new IntelligenceRuntime();
    MockDecisionProvider.setConfidenceFor("commerce.product.quality.score", 0.5);
    try {
      const result = await runtime.decide({
        capability: "commerce.product.quality.score",
        state: { title: "Incomplete listing" },
      });
      expect(result.confidence).toBe(0.5);
      expect(result.confidenceLevel).toBe("HUMAN");
    } finally {
      MockDecisionProvider.resetCalibration();
    }

    const recalibrated = await runtime.decide({
      capability: "commerce.product.quality.score",
      state: { title: "Incomplete listing" },
    });
    expect(recalibrated.confidence).toBe(0.98);
  });

  it("persists review items through a configured store (INT-MCP-01 seam)", async () => {
    const saved: ReviewItem[][] = [];
    HumanReviewQueue.configureStore({
      load: async () => saved.flat(),
      save: async (items) => {
        saved.push(items);
      },
    });
    try {
      const runtime = new IntelligenceRuntime();
      const decision = await runtime.decide({
        capability: "commerce.seller.risk.score",
        state: { cancellationRate: 0.9 },
        policy: {
          capability: "commerce.seller.risk.score",
          thresholds: { automatic: 0.999, assisted: 0.999 },
        },
      });
      expect(decision.confidenceLevel).toBe("HUMAN");
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(saved.length).toBeGreaterThan(0);
      expect(saved[saved.length - 1]?.some((i) => i.decisionId === decision.decisionId)).toBe(true);
    } finally {
      HumanReviewQueue.configureStore(undefined);
    }
  });
});
