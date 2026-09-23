/**
 * @apps/imperia — PostgreSQL adapter for Imperia governance and audit.
 * Implements persistence for audit logs, governance policies, DLQ items,
 * circuit breakers, and platform settings.
 */

import type { DatabasePort } from "@mosaix/ports-database";

export interface ImperiaAuditLog {
  id: string;
  actorId: string;
  action: string;
  resource: string;
  status: "success" | "failure";
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ImperiaPolicy {
  id: string;
  name: string;
  description: string;
  rules: unknown[];
  createdAt: string;
  updatedAt: string;
}

export interface ImperiaDLQItem {
  id: string;
  topic: string;
  payload?: unknown;
  errorMessage: string;
  failedAt: string;
}

export interface ImperiaCircuitBreaker {
  name: string;
  state: "open" | "half_open" | "closed";
  failures: number;
  lastFailureAt: string;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

export class PostgresImperiaRepository {
  constructor(private readonly db: DatabasePort) {}

  async saveAuditLog(entry: {
    id?: string;
    actorId: string;
    action: string;
    resource: string;
    status: "success" | "failure";
    metadata?: Record<string, unknown>;
    createdAt?: Date;
  }): Promise<void> {
    const id = entry.id ?? `audit_${Date.now()}`;
    const now = entry.createdAt ?? new Date();
    await this.db.query(
      `INSERT INTO imperia_audit_logs (id, "actorId", action, resource, status, metadata, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        entry.actorId,
        entry.action,
        entry.resource,
        entry.status,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        now.toISOString(),
      ],
    );
  }

  async getAuditLogs(limit = 100): Promise<ImperiaAuditLog[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 1000);
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, "actorId", action, resource, status, metadata, "createdAt"
       FROM imperia_audit_logs ORDER BY "createdAt" DESC LIMIT $1`,
      [safeLimit],
    );
    return rows.map((r): ImperiaAuditLog => ({
      id: asString(r["id"]),
      actorId: asString(r["actorId"]),
      action: asString(r["action"]),
      resource: asString(r["resource"]),
      status: r["status"] === "failure" ? "failure" : "success",
      ...(r["metadata"] !== null && r["metadata"] !== undefined
        ? { metadata: parseJson<Record<string, unknown>>(r["metadata"], {}) }
        : {}),
      createdAt: asString(r["createdAt"]),
    }));
  }

  async savePolicy(policy: ImperiaPolicy): Promise<void> {
    await this.db.query(
      `INSERT INTO imperia_policies (id, name, description, rules, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         name = $2, description = $3, rules = $4, "updatedAt" = $6`,
      [
        policy.id,
        policy.name,
        policy.description,
        JSON.stringify(policy.rules),
        policy.createdAt,
        policy.updatedAt,
      ],
    );
  }

  async listPolicies(): Promise<ImperiaPolicy[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, name, description, rules, "createdAt", "updatedAt" FROM imperia_policies ORDER BY "createdAt" DESC`,
    );
    return rows.map((r): ImperiaPolicy => ({
      id: asString(r["id"]),
      name: asString(r["name"]),
      description: asString(r["description"]),
      rules: parseJson<unknown[]>(r["rules"], []),
      createdAt: asString(r["createdAt"]),
      updatedAt: asString(r["updatedAt"]),
    }));
  }

  async saveDLQItem(item: Omit<ImperiaDLQItem, "payload"> & { payload: unknown }): Promise<void> {
    await this.db.query(
      `INSERT INTO imperia_dlq (id, topic, payload, "errorMessage", "failedAt")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         topic = $2, payload = $3, "errorMessage" = $4`,
      [item.id, item.topic, JSON.stringify(item.payload), item.errorMessage, item.failedAt],
    );
  }

  async listDLQItems(): Promise<ImperiaDLQItem[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, topic, payload, "errorMessage", "failedAt" FROM imperia_dlq ORDER BY "failedAt" DESC`,
    );
    return rows.map((r): ImperiaDLQItem => ({
      id: asString(r["id"]),
      topic: asString(r["topic"]),
      ...(r["payload"] !== null && r["payload"] !== undefined
        ? { payload: parseJson<unknown>(r["payload"], undefined) }
        : {}),
      errorMessage: asString(r["errorMessage"]),
      failedAt: asString(r["failedAt"]),
    }));
  }

  async replayDLQItem(id: string): Promise<ImperiaDLQItem | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, topic, payload, "errorMessage", "failedAt" FROM imperia_dlq WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    if (!r) return null;
    return {
      id: asString(r["id"], id),
      topic: asString(r["topic"]),
      ...(r["payload"] !== null && r["payload"] !== undefined
        ? { payload: parseJson<unknown>(r["payload"], undefined) }
        : {}),
      errorMessage: asString(r["errorMessage"]),
      failedAt: asString(r["failedAt"]),
    };
  }

  async deleteDLQItem(id: string): Promise<void> {
    await this.db.execute(`DELETE FROM imperia_dlq WHERE id = $1`, [id]);
  }

  async setCircuitBreaker(status: ImperiaCircuitBreaker): Promise<void> {
    await this.db.query(
      `INSERT INTO imperia_circuit_breakers (name, state, failures, "lastFailureAt")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO UPDATE SET
         state = $2, failures = $3, "lastFailureAt" = $4`,
      [status.name, status.state, status.failures, status.lastFailureAt],
    );
  }

  async getCircuitBreakers(): Promise<ImperiaCircuitBreaker[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT name, state, failures, "lastFailureAt" FROM imperia_circuit_breakers`,
    );
    return rows.map((r): ImperiaCircuitBreaker => {
      const state = asString(r["state"], "closed");
      return {
        name: asString(r["name"]),
        state: state === "open" || state === "half_open" ? state : "closed",
        failures: asNumber(r["failures"]),
        lastFailureAt: asString(r["lastFailureAt"]),
      };
    });
  }

  async resetCircuitBreaker(name: string): Promise<void> {
    await this.db.query(
      `UPDATE imperia_circuit_breakers SET state = 'closed', failures = 0 WHERE name = $1`,
      [name],
    );
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db.query(
      `INSERT INTO imperia_settings (key, value, "updatedAt")
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET value = $2, "updatedAt" = $3`,
      [key, value, new Date().toISOString()],
    );
  }

  async getSettings(): Promise<Record<string, string>> {
    const rows = await this.db.query<Record<string, unknown>>(`SELECT key, value FROM imperia_settings`);
    const result: Record<string, string> = {};
    for (const row of rows) {
      const key = row["key"];
      if (typeof key === "string") {
        result[key] = asString(row["value"]);
      }
    }
    return result;
  }
}
