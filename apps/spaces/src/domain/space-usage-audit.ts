import * as crypto from "node:crypto";
export interface SpaceUsageMetrics {
  spaceId: string;
  memberCount: number;
  maxMembersLimit: number;
  storageUsedBytes: number;
  storageQuotaBytes: number;
  apiCallsCount: number;
  periodStart: string;
  periodEnd: string;
}

export type SpaceAuditAction =
  | "SPACE_CREATED"
  | "SPACE_DELETED"
  | "SETTINGS_UPDATED"
  | "MEMBER_ROLE_CHANGED"
  | "MEMBER_REMOVED"
  | "CUSTOM_DOMAIN_VERIFIED"
  | "SECURITY_POLICY_CHANGED";

export interface SpaceAuditEntry {
  id: string;
  spaceId: string;
  actorId: string;
  action: SpaceAuditAction;
  details: Record<string, unknown>;
  ipAddress?: string;
  timestamp: string;
}

export class SpaceUsageTracker {
  private metrics = new Map<string, SpaceUsageMetrics>();

  getUsage(spaceId: string): SpaceUsageMetrics {
    let m = this.metrics.get(spaceId);
    if (!m) {
      m = {
        spaceId,
        memberCount: 1,
        maxMembersLimit: 100,
        storageUsedBytes: 0,
        storageQuotaBytes: 10 * 1024 * 1024 * 1024, // 10 GB
        apiCallsCount: 0,
        periodStart: new Date().toISOString(),
        periodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      };
      this.metrics.set(spaceId, m);
    }
    return m;
  }

  recordApiCall(spaceId: string, count: number = 1): void {
    const usage = this.getUsage(spaceId);
    usage.apiCallsCount += count;
  }

  recordStorageChange(spaceId: string, deltaBytes: number): void {
    const usage = this.getUsage(spaceId);
    usage.storageUsedBytes = Math.max(0, usage.storageUsedBytes + deltaBytes);
  }
}

export class SpaceAuditLogger {
  private logs: SpaceAuditEntry[] = [];

  log(entry: Omit<SpaceAuditEntry, "id" | "timestamp">): SpaceAuditEntry {
    const fullEntry: SpaceAuditEntry = {
      ...entry,
      id: `audit-${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
    };
    this.logs.push(fullEntry);
    return fullEntry;
  }

  getLogsForSpace(spaceId: string, limit: number = 50): SpaceAuditEntry[] {
    return this.logs
      .filter((l) => l.spaceId === spaceId)
      .slice(-limit);
  }
}
