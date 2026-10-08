/**
 * @mosaix/auth — Postgres/Database Session Store Adapter (AUTH-02).
 */

import type { SessionStore } from "@mosaix/ports-session-store";
import type { DatabasePort } from "@mosaix/ports-database";

export class PostgresSessionStoreAdapter implements SessionStore {
  constructor(private readonly db: DatabasePort) {}

  async get(id: string) {
    const rows = await this.db.query<{
      id: string;
      identity_id: string;
      created_at: string;
      updated_at: string;
      expires_at: string;
      data: string;
    }>(
      `SELECT id, identity_id, created_at, updated_at, expires_at, data FROM sessions WHERE id = $1`,
      [id]
    );

    if (rows.length === 0) return null;
    const r = rows[0];

    return {
      id: r.id,
      identityId: r.identity_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      expiresAt: r.expires_at,
      data: JSON.parse(r.data || "{}"),
    };
  }

  async save(session: {
    id: string;
    identityId: string;
    createdAt?: string;
    updatedAt?: string;
    expiresAt?: string;
    data?: Record<string, unknown>;
  }) {
    const now = new Date().toISOString();
    const createdAt = session.createdAt || now;
    const updatedAt = session.updatedAt || now;
    const expiresAt = session.expiresAt || new Date(Date.now() + 86400000).toISOString();
    const dataStr = JSON.stringify(session.data || {});

    await this.db.query(
      `INSERT INTO sessions (id, identity_id, created_at, updated_at, expires_at, data)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE
       SET updated_at = EXCLUDED.updated_at, expires_at = EXCLUDED.expires_at, data = EXCLUDED.data`,
      [session.id, session.identityId, createdAt, updatedAt, expiresAt, dataStr]
    );
  }

  async delete(id: string) {
    await this.db.query(`DELETE FROM sessions WHERE id = $1`, [id]);
  }

  async touch(id: string) {
    const now = new Date().toISOString();
    await this.db.query(`UPDATE sessions SET updated_at = $1 WHERE id = $2`, [now, id]);
  }
}
