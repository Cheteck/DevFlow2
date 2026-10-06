import { describe, expect, it } from "vitest";
import {
  HumanReviewQueue,
  IntelligenceKillSwitch,
  IntelligenceMetricsCollector,
  IntelligenceRuntime,
} from "../packages/intelligence/src/index.js";

describe("IJIDeals Intelligence Core — Advanced Runtime & Human Review", () => {
  it("enqueues low-confidence decisions into HumanReviewQueue and resolves them", async () => {
    const runtime = new IntelligenceRuntime();
    const queue = HumanReviewQueue.getInstance();

    // Trigger decision with high thresholds so confidence level becomes HUMAN
    const decision = await runtime.decide({
      capability: "commerce.seller.risk.score",
      state: { cancellationRate: 0.18 },
      policy: {
        capability: "commerce.seller.risk.score",
        thresholds: { automatic: 0.999, assisted: 0.995 },
      },
    });

    expect(decision.confidenceLevel).toBe("HUMAN");

    const pending = queue.listPending();
    expect(pending.length).toBeGreaterThan(0);

    const pendingItem = pending.find((i) => i.decisionId === decision.decisionId);
    expect(pendingItem).toBeDefined();

    if (pendingItem) {
      const resolved = queue.resolve(pendingItem.id, {
        status: "APPROVED",
        actorId: "admin_user_1",
      });
      expect(resolved?.status).toBe("APPROVED");
    }
  });

  it("enforces IntelligenceKillSwitch to block disabled capabilities and providers", async () => {
    const killSwitch = IntelligenceKillSwitch.getInstance();
    const runtime = new IntelligenceRuntime();

    killSwitch.disableCapability("spaces.content.moderate");

    await expect(
      runtime.decide({
        capability: "spaces.content.moderate",
        state: { text: "Hello world" },
      }),
    ).rejects.toThrow("disabled by Kill Switch");

    killSwitch.enableCapability("spaces.content.moderate");

    const result = await runtime.decide({
      capability: "spaces.content.moderate",
      state: { text: "Hello world" },
    });
    expect(result.capability).toBe("spaces.content.moderate");
  });

  it("tracks AI metrics and override rates in IntelligenceMetricsCollector", () => {
    const collector = IntelligenceMetricsCollector.getInstance();
    const snapshot = collector.getSnapshot();

    expect(snapshot.totalDecisions).toBeGreaterThan(0);
    expect(snapshot.overrideRate).toBeGreaterThanOrEqual(0);
  });
});
