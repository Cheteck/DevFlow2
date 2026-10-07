import { describe, expect, it } from "vitest";
import {
  HumanReviewQueue,
  IntelligenceKillSwitch,
  IntelligenceMetricsCollector,
  IntelligenceRuntime,
} from "@mosaix/intelligence";
import { createImperiaDescriptor } from "../apps/imperia/src/presentation/imperia-view.js";

describe("IJIDeals Intelligence Core — Advanced Runtime & Human Review", () => {
  it("enqueues low-confidence decisions into HumanReviewQueue and resolves them", async () => {
    const runtime = new IntelligenceRuntime();
    const queue = HumanReviewQueue.getInstance();

    const decision = await runtime.decide({
      capability: "commerce.seller.risk.score",
      state: { cancellationRate: 0.18 },
      policy: {
        capability: "commerce.seller.risk.score",
        thresholds: { automatic: 0.999, assisted: 0.995 },
      },
    });

    expect(decision.confidenceLevel).toBe("HUMAN");
    expect(decision.decisionId).toContain("dec-mock-");

    const pending = queue.listPending();
    expect(pending.length).toBeGreaterThan(0);

    const pendingItem = pending.find((i) => i.decisionId === decision.decisionId);
    expect(pendingItem).toBeDefined();

    if (pendingItem) {
      const initialSnapshot = IntelligenceMetricsCollector.getInstance().getSnapshot();
      const resolvedApproved = queue.resolve(pendingItem.id, {
        status: "APPROVED",
        actorId: "admin_user_1",
      });
      expect(resolvedApproved?.status).toBe("APPROVED");
      const postApprovedSnapshot = IntelligenceMetricsCollector.getInstance().getSnapshot();
      expect(postApprovedSnapshot.humanOverrides).toBe(initialSnapshot.humanOverrides);

      const item2 = queue.enqueue(decision);
      queue.resolve(item2.id, {
        status: "CORRECTED",
        actorId: "admin_user_1",
      });
      const postCorrectedSnapshot = IntelligenceMetricsCollector.getInstance().getSnapshot();
      expect(postCorrectedSnapshot.humanOverrides).toBe(initialSnapshot.humanOverrides + 1);
    }
  });

  it("handles parallel bundle execution and partial failure resilience", async () => {
    const runtime = new IntelligenceRuntime();
    const bundleResult = await runtime.decideBundle({
      capability: "commerce.product.enrichment",
      state: { title: "Samsung Galaxy S26" },
      decisions: {
        category: { capability: "commerce.product.classify" },
        extract: { capability: "commerce.product.extract" },
      },
    });

    expect(bundleResult.bundleId).toContain("bundle-");
    expect(bundleResult.results.category).toBeDefined();
    expect(bundleResult.results.extract).toBeDefined();
    expect(bundleResult.overallConfidence).toBeGreaterThan(0.9);
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

  it("renders Imperia Governance UI tabs correctly", async () => {
    const descriptor = createImperiaDescriptor();
    const ctxAdmin = {
      user: { id: "admin", roles: ["admin"] },
      request: { query: { tab: "ai" } },
    } as unknown as import("@mosaix/contracts").BacExecutionContext;

    const resAi = await descriptor.render(ctxAdmin);
    expect(resAi.html).toContain("IJIDeals Intelligence");
    expect(resAi.html).toContain("Policies Rego");
    expect(resAi.html).toContain("Audit");
    expect(resAi.html).toContain("Plateforme");

    const ctxAudit = {
      user: { id: "admin", roles: ["admin"] },
      request: { query: { tab: "audit" } },
    } as unknown as import("@mosaix/contracts").BacExecutionContext;
    const resAudit = await descriptor.render(ctxAudit);
    expect(resAudit.html).toContain("Journal d'Audit");
  });
});
