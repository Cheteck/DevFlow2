/**
 * @mosaix/adapter-session-store-sqlite — SQLite Session Store Adapter with DatabasePort SQL queries
 */

import type { DatabasePort } from "@mosaix/ports-database";
import type {
  Session,
  SessionStore,
} from "@mosaix/ports-session-store";

interface SessionRow {
  id: string;
  identityId: string;
  tenantId: string;
  applicationId?: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  attributes: string | Record<string, unknown>;
}

export class SQLiteSessionStoreAdapter implements SessionStore {
  private readonly db: DatabasePort;

  constructor(db: DatabasePort) {
    this.db = db;
  }

  async create(session: Session): Promise<void> {
    await this.db.execute(
      `INSERT INTO sessions (id, identity_id, tenant_id, application_id, created_at, expires_at, attributes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.identityId,
        session.tenantId,
        session.applicationId ?? null,
        session.createdAt,
        session.expiresAt,
        JSON.stringify(session.attributes),
      ]
    );
  }

  async get(id: string): Promise<Session | null> {
    const rows = await this.db.query<SessionRow>(
      `SELECT id, identity_id AS "identityId", tenant_id AS "tenantId", application_id AS "applicationId", created_at AS "createdAt", expires_at AS "expiresAt", revoked_at AS "revokedAt", attributes
       FROM sessions
       WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) return null;
    const row = rows[0]!;
    return {
      id: row.id,
      identityId: row.identityId,
      tenantId: row.tenantId,
      ...(row.applicationId !== undefined && row.applicationId !== null ? { applicationId: row.applicationId } : {}),
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      ...(row.revokedAt !== undefined && row.revokedAt !== null ? { revokedAt: row.revokedAt } : {}),
      attributes: typeof row.attributes === "string" ? JSON.parse(row.attributes) : row.attributes,
    };
  }

  async revoke(id: string): Promise<void> {
    await this.db.execute(
      `UPDATE sessions
       SET revoked_at = ?
       WHERE id = ?`,
      [new Date().toISOString(), id]
    );
  }

  async revokeAllForIdentity(identityId: string): Promise<void> {
    await this.db.execute(
      `UPDATE sessions
       SET revoked_at = ?
       WHERE identity_id = ?`,
      [new Date().toISOString(), identityId]
    );
  }

  async listActiveForIdentity(identityId: string): Promise<Session[]> {
    const now = new Date().toISOString();
    const rows = await this.db.query<SessionRow>(
      `SELECT id, identity_id AS "identityId", tenant_id AS "tenantId", application_id AS "applicationId", created_at AS "createdAt", expires_at AS "expiresAt", revoked_at AS "revokedAt", attributes
       FROM sessions
       WHERE identity_id = ? AND expires_at > ? AND revoked_at IS NULL`,
      [identityId, now]
    );

    return rows.map((row: SessionRow) => ({
      id: row.id,
      identityId: row.identityId,
      tenantId: row.tenantId,
      ...(row.applicationId !== undefined && row.applicationId !== null ? { applicationId: row.applicationId } : {}),
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      ...(row.revokedAt !== undefined && row.revokedAt !== null ? { revokedAt: row.revokedAt } : {}),
      attributes: typeof row.attributes === "string" ? JSON.parse(row.attributes) : row.attributes,
    }));
  }
}
