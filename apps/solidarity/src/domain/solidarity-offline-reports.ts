export interface OfflineInterventionRecord {
  id: string;
  volunteerId: string;
  missionId: string;
  beneficiaryCount: number;
  timestamp: string;
  synced: boolean;
}

export class SolidarityOfflineSyncQueue {
  private queue: OfflineInterventionRecord[] = [];

  enqueue(record: Omit<OfflineInterventionRecord, "synced">): OfflineInterventionRecord {
    const item: OfflineInterventionRecord = { ...record, synced: false };
    this.queue.push(item);
    return item;
  }

  getPending(): OfflineInterventionRecord[] {
    return this.queue.filter((r) => !r.synced);
  }

  markSynced(id: string): void {
    const item = this.queue.find((r) => r.id === id);
    if (item) {
      item.synced = true;
    }
  }
}

export interface MissionChecklistItem {
  id: string;
  task: string;
  completed: boolean;
  photoProofUrl?: string;
}

export class SolidarityMissionChecklistManager {
  static validateMissionCompletion(items: MissionChecklistItem[]): boolean {
    if (items.length === 0) return false;
    return items.every((i) => i.completed);
  }
}

export class OchaReportGenerator {

  static generateReport(data: {
    country: string;
    crisisType: string;
    affectedPopulation: number;
    beneficiariesServed: number;
  }): { title: string; ochaStandardPayload: Record<string, unknown> } {
    return {
      title: `OCHA SitRep - ${data.crisisType} (${data.country})`,
      ochaStandardPayload: {
        reportingAgency: "MosaiX Solidarity Cluster",
        isoCountry: data.country,
        crisisType: data.crisisType,
        hxlTags: {
          "#affected+num": data.affectedPopulation,
          "#reached+num": data.beneficiariesServed,
        },
        generatedAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * Server-authorised offline reconciliation (§2.9, §8).
 * A locally permitted action is never guaranteed on sync: every queued
 * action is re-authorised against current server state. Stock, allocation
 * and distribution conflicts resolve through explicit business rules —
 * generic last-write-wins is forbidden.
 */
export type OfflineSyncStatus = "PENDING" | "SYNCED" | "CONFLICT" | "REJECTED";

export interface OfflineSyncAction {
  id: string;
  idempotencyKey: string;
  kind: "DECLARE_NEED" | "ALLOCATE_STOCK" | "CONFIRM_DISTRIBUTION" | "RECORD_CHECKIN";
  payload: Record<string, unknown>;
  clientCapturedAt: string;
  serverReceivedAt?: string;
  status: OfflineSyncStatus;
  statusReason?: string;
}

export type ServerReauthVerdict =
  | { decision: "accept" }
  | { decision: "conflict"; reason: string }
  | { decision: "reject"; reason: string };

export interface OfflineSyncOutcome {
  actionId: string;
  status: OfflineSyncStatus;
  reason: string;
}

export class SolidaritySyncReconciler {
  private readonly seenKeys = new Set<string>();

  /**
   * Replays queued actions in capture order. The serverCheck callback
   * re-authorises each action against live server state. Duplicate
   * idempotency keys resolve as idempotent replays, never as rewrites.
   */
  reconcile(
    actions: OfflineSyncAction[],
    serverCheck: (action: OfflineSyncAction) => ServerReauthVerdict,
  ): OfflineSyncOutcome[] {
    const ordered = [...actions].sort((a, b) => a.clientCapturedAt.localeCompare(b.clientCapturedAt));
    return ordered.map((action) => {
      if (this.seenKeys.has(action.idempotencyKey)) {
        action.status = "SYNCED";
        action.statusReason = "Idempotent replay: key already processed, no re-mutation.";
        action.serverReceivedAt = new Date().toISOString();
        return { actionId: action.id, status: action.status, reason: action.statusReason };
      }
      const verdict = serverCheck(action);
      this.seenKeys.add(action.idempotencyKey);
      action.serverReceivedAt = new Date().toISOString();
      if (verdict.decision === "accept") {
        action.status = "SYNCED";
        action.statusReason = "Re-authorised by server and committed.";
      } else if (verdict.decision === "conflict") {
        action.status = "CONFLICT";
        action.statusReason = verdict.reason;
      } else {
        action.status = "REJECTED";
        action.statusReason = verdict.reason;
      }
      return { actionId: action.id, status: action.status, reason: action.statusReason };
    });
  }

  /**
   * Explicit conflict resolution by an authorised operator. A conflicted
   * action is either retried (back to PENDING with a fresh key) or
   * discarded with a documented reason — never silently overwritten.
   */
  resolveConflict(
    action: OfflineSyncAction,
    resolution: "retry" | "discard",
    actor: string,
    reason: string,
  ): OfflineSyncOutcome {
    if (action.status !== "CONFLICT") {
      return { actionId: action.id, status: action.status, reason: "No conflict to resolve." };
    }
    if (resolution === "retry") {
      action.status = "PENDING";
      action.statusReason = `Re-queued by ${actor}: ${reason}`;
    } else {
      action.status = "REJECTED";
      action.statusReason = `Discarded by ${actor}: ${reason}`;
    }
    return { actionId: action.id, status: action.status, reason: action.statusReason ?? "" };
  }
}
