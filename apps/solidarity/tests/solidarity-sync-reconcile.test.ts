import { describe, it, expect } from "vitest";
import {
  SolidaritySyncReconciler,
  type OfflineSyncAction,
} from "../src/domain/solidarity-offline-reports.js";

function action(overrides: Partial<OfflineSyncAction> = {}): OfflineSyncAction {
  return {
    id: "act-1",
    idempotencyKey: "key-1",
    kind: "ALLOCATE_STOCK",
    payload: { resourceId: "res-1", quantity: 100 },
    clientCapturedAt: "2026-10-09T08:00:00Z",
    status: "PENDING",
    ...overrides,
  };
}

describe("SolidaritySyncReconciler (§2.9, §8)", () => {
  it("accepts locally permitted actions only after server re-authorisation", () => {
    const reconciler = new SolidaritySyncReconciler();
    const [outcome] = reconciler.reconcile([action()], () => ({ decision: "accept" }));
    expect(outcome.status).toBe("SYNCED");
  });

  it("flags stock conflicts instead of last-write-wins", () => {
    const reconciler = new SolidaritySyncReconciler();
    const [outcome] = reconciler.reconcile([action()], () => ({
      decision: "conflict",
      reason: "Stock reserved by a concurrent confirmed allocation.",
    }));
    expect(outcome.status).toBe("CONFLICT");
    expect(outcome.reason).toMatch(/concurrent confirmed allocation/);
  });

  it("rejects actions no longer authorised at sync time", () => {
    const reconciler = new SolidaritySyncReconciler();
    const [outcome] = reconciler.reconcile([action({ id: "act-2", idempotencyKey: "key-2" })], () => ({
      decision: "reject",
      reason: "Need closed before sync; allocation no longer valid.",
    }));
    expect(outcome.status).toBe("REJECTED");
  });

  it("treats duplicate idempotency keys as replays, never rewrites", () => {
    const reconciler = new SolidaritySyncReconciler();
    const outcomes = reconciler.reconcile(
      [action(), action({ id: "act-1-retry" })],
      () => ({ decision: "accept" }),
    );
    expect(outcomes[0].status).toBe("SYNCED");
    expect(outcomes[1].status).toBe("SYNCED");
    expect(outcomes[1].reason).toMatch(/Idempotent replay/);
  });

  it("resolves conflicts explicitly: retry re-queues, discard documents", () => {
    const reconciler = new SolidaritySyncReconciler();
    const conflicted = action({ id: "act-3", idempotencyKey: "key-3" });
    reconciler.reconcile([conflicted], () => ({ decision: "conflict", reason: "Concurrent reservation." }));
    expect(conflicted.status).toBe("CONFLICT");

    const retried = reconciler.resolveConflict(conflicted, "retry", "op-7", "Stock replenished since.");
    expect(retried.status).toBe("PENDING");
    expect(conflicted.statusReason).toMatch(/op-7/);

    const conflicted2 = action({ id: "act-4", idempotencyKey: "key-4" });
    reconciler.reconcile([conflicted2], () => ({ decision: "conflict", reason: "Need cancelled." }));
    const discarded = reconciler.resolveConflict(conflicted2, "discard", "op-7", "Need cancelled by coordinator.");
    expect(discarded.status).toBe("REJECTED");
    expect(conflicted2.statusReason).toMatch(/cancelled by coordinator/);
  });

  it("preserves client capture time and stamps server reception", () => {
    const reconciler = new SolidaritySyncReconciler();
    const a = action();
    reconciler.reconcile([a], () => ({ decision: "accept" }));
    expect(a.clientCapturedAt).toBe("2026-10-09T08:00:00Z");
    expect(a.serverReceivedAt).toBeDefined();
  });
});
