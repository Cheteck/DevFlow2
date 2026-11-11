import { describe, expect, it } from "vitest";
import { MCPToolRegistry } from "./tool-registry.js";
import {
  IntelligenceToolProvider,
  registerIntelligenceTool,
} from "./providers/intelligence.js";
import { HumanReviewQueue } from "@mosaix/intelligence";

describe("MCP ↔ Intelligence bridge (INT-MCP-01)", () => {
  it("registers the pilot portfolio tool with an aligned permission", () => {
    const tools = new MCPToolRegistry();
    IntelligenceToolProvider.register(tools);

    const tool = tools.getTool("portfolio_listing_quality_score");
    expect(tool).toBeDefined();
    expect(tool?.requiredPermission).toBe("portfolio:vendable:read:tenant");
    expect(tool?.ownerApp).toBe("@apps/portfolio");
  });

  it("AUTO confidence executes deterministically with a traced decisionId", async () => {
    const tools = new MCPToolRegistry();
    IntelligenceToolProvider.register(tools);

    const tool = tools.getTool("portfolio_listing_quality_score");
    const outcome = (await tool?.handler({
      reference: "REF-TEST-01",
      title: "Xiaomi 18 Pro Max 5G",
    })) as { status: string; decisionId: string; result: { reference: string; score: number } };

    expect(outcome.status).toBe("completed");
    expect(outcome.decisionId).toContain("dec-");
    expect(outcome.result.reference).toBe("REF-TEST-01");
    expect(outcome.result.score).toBeGreaterThan(0);
  });

  it("HUMAN confidence never executes and returns a review instead", async () => {
    const tools = new MCPToolRegistry();
    let executed = false;
    registerIntelligenceTool(
      tools,
      {
        name: "pilot_strict_review",
        description: "Pilot tool with strict thresholds forcing HUMAN.",
        inputSchema: { type: "object", properties: {} },
        requiredPermission: "portfolio:vendable:read:tenant",
        ownerApp: "@apps/portfolio",
        capability: "commerce.product.quality.score",
        policy: {
          capability: "commerce.product.quality.score",
          thresholds: { automatic: 0.999, assisted: 0.999 },
        },
      },
      async () => {
        executed = true;
        return {};
      },
    );

    const tool = tools.getTool("pilot_strict_review");
    const outcome = (await tool?.handler({})) as {
      status: string;
      reviewId: string;
      decisionId: string;
    };

    expect(executed).toBe(false);
    expect(outcome.status).toBe("review_required");
    expect(outcome.reviewId).toBeDefined();
    expect(HumanReviewQueue.getInstance().get(outcome.reviewId)?.decisionId).toBe(
      outcome.decisionId,
    );
  });

  it("routes spaces moderation and product classification through judgment tools", async () => {
    const tools = new MCPToolRegistry();
    IntelligenceToolProvider.register(tools);

    const moderate = tools.getTool("spaces_content_moderate");
    expect(moderate?.requiredPermission).toBe("spaces:space:manage");
    const moderation = (await moderate?.handler({ text: "Hello world" })) as {
      status: string;
      decisionId: string;
    };
    expect(moderation.status).toBe("completed");
    expect(moderation.decisionId).toContain("dec-");

    const classify = tools.getTool("commerce_product_classify");
    expect(classify?.requiredPermission).toBe("commerce:order:read");
    const classification = (await classify?.handler({ title: "Samsung Galaxy S26" })) as {
      status: string;
      result: { classification: { category: string } };
    };
    expect(classification.status).toBe("completed");
    expect(classification.result.classification.category).toBe("smartphones");
  });

  it("kill-switched capabilities refuse execution", async () => {    const tools = new MCPToolRegistry();
    registerIntelligenceTool(
      tools,
      {
        name: "pilot_killed",
        description: "Pilot tool on a disabled capability.",
        inputSchema: { type: "object", properties: {} },
        requiredPermission: "portfolio:vendable:read:tenant",
        ownerApp: "@apps/portfolio",
        capability: "commerce.product.extract",
      },
      async () => ({}),
    );

    const { IntelligenceKillSwitch } = await import("@mosaix/intelligence");
    IntelligenceKillSwitch.getInstance().disableCapability("commerce.product.extract");
    try {
      await expect(
        tools.getTool("pilot_killed")?.handler({}),
      ).rejects.toThrow("disabled by Kill Switch");
    } finally {
      IntelligenceKillSwitch.getInstance().enableCapability("commerce.product.extract");
    }
  });
});
