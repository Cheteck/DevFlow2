/**
 * @apps/beam — PostgreSQL adapters for the orphan tables of
 * `beam.messaging.v1.001_create_messaging_tables`.
 *
 * - `beam_notifications` : save / markRead / listByUser
 * - `beam_push_subscriptions` : save / remove / listByUser
 *
 * Volontairement découplé de `BeamPushDispatcher` (Map en mémoire) : le
 * pontage dispatcher → persistance est au backlog (BEAM-PUSH-BRIDGE).
 */

import type { DatabasePort } from "@mosaix/ports-database";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toIso(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
}

function toBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}

function parseJsonData(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value as Record<string, unknown>;
  if (typeof value === "string") {
    if (value.length === 0) return null;
    try {
      const parsed: unknown = JSON.parse(value);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function toJsonParam(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export interface BeamNotificationModel {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  data?: Record<string, unknown> | null;
  createdAt: string;
}

export class PostgresBeamNotificationRepository {
  constructor(private readonly db: DatabasePort) {}

  async save(notification: BeamNotificationModel): Promise<void> {
    await this.db.query(
      `INSERT INTO beam_notifications (id, "userId", title, body, type, "isRead", data, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         "userId" = $2, title = $3, body = $4, type = $5, "isRead" = $6, data = $7`,
      [
        notification.id,
        notification.userId,
        notification.title,
        notification.body,
        notification.type,
        notification.isRead,
        toJsonParam(notification.data),
        notification.createdAt ?? new Date().toISOString(),
      ],
    );
  }

  async markRead(id: string): Promise<void> {
    await this.db.query(`UPDATE beam_notifications SET "isRead" = TRUE WHERE id = $1`, [id]);
  }

  async listByUser(userId: string, limit = 50): Promise<BeamNotificationModel[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 500);
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, "userId", title, body, type, "isRead", data, "createdAt"
       FROM beam_notifications WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT $2`,
      [userId, safeLimit],
    );
    return rows.map(
      (r): BeamNotificationModel => ({
        id: asString(r["id"]),
        userId: asString(r["userId"], userId),
        title: asString(r["title"]),
        body: asString(r["body"]),
        type: asString(r["type"]),
        isRead: toBoolean(r["isRead"]),
        data: parseJsonData(r["data"]),
        createdAt: toIso(r["createdAt"]),
      }),
    );
  }
}

export interface BeamPushSubscriptionModel {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
}

export class PostgresBeamPushSubscriptionRepository {
  constructor(private readonly db: DatabasePort) {}

  async save(subscription: BeamPushSubscriptionModel): Promise<void> {
    await this.db.query(
      `INSERT INTO beam_push_subscriptions (id, "userId", endpoint, "p256dh", auth, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         "userId" = $2, endpoint = $3, "p256dh" = $4, auth = $5`,
      [
        subscription.id,
        subscription.userId,
        subscription.endpoint,
        subscription.p256dh,
        subscription.auth,
        subscription.createdAt ?? new Date().toISOString(),
      ],
    );
  }

  async remove(id: string): Promise<void> {
    await this.db.query(`DELETE FROM beam_push_subscriptions WHERE id = $1`, [id]);
  }

  async listByUser(userId: string, limit = 100): Promise<BeamPushSubscriptionModel[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 500);
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, "userId", endpoint, "p256dh", auth, "createdAt"
       FROM beam_push_subscriptions WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT $2`,
      [userId, safeLimit],
    );
    return rows.map(
      (r): BeamPushSubscriptionModel => ({
        id: asString(r["id"]),
        userId: asString(r["userId"], userId),
        endpoint: asString(r["endpoint"]),
        p256dh: asString(r["p256dh"]),
        auth: asString(r["auth"]),
        createdAt: toIso(r["createdAt"]),
      }),
    );
  }
}
