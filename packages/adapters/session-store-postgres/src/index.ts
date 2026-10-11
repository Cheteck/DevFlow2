/**
 * @mosaix/adapter-session-store-postgres — PostgreSQL Session Store Adapter.
 *
 * Implements `SessionStore` over the canonical `sessions` table
 * (`tenant_id`, `attributes`, `revoked_at` — see shell core migration) with
 * Postgres `$n` placeholders. Revocation is soft (`revoked_at`), never a
 * hard delete, so audit and fail-closed SSR checks keep working.
 */

import type {
  Session,
  SessionStore,
} from "@mosaix/ports-session-store";
import type { DatabasePort } from "@mosaix/ports-database";

interface SessionRow {
  id: string;
  identityId: string;
  tenantId: string;
  applicationId?: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  attributes: string | Record<string, unknown>;
}

const SELECT_COLUMNS = `id, identity_id AS "identityId", tenant_id AS "tenantId", application_id AS "applicationId", created_at AS "createdAt", expires_at AS "expiresAt", revoked_at AS "revokedAt", attributes`;

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    identityId: row.identityId,
    tenantId: row.tenantId,
    ...(row.applicationId !== undefined && row.applicationId !== null
      ? { applicationId: row.applicationId }
      : {}),
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    ...(row.revokedAt !== undefined && row.revokedAt !== null
      ? { revokedAt: row.revokedAt }
      : {}),
    attributes:
      typeof row.attributes === "string"
        ? (JSON.parse(row.attributes) as Record<string, unknown>)
        : row.attributes,
  };
}

export class PostgresSessionStoreAdapter implements SessionStore {
  constructor(private readonly db: DatabasePort) {}

  async create(session: Session): Promise<void> {
    await this.db.execute(
      `INSERT INTO sessions (id, identity_id, tenant_id, application_id, created_at, expires_at, attributes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         expires_at = EXCLUDED.expires_at,
         revoked_at = NULL,
         attributes = EXCLUDED.attributes`,
      [
        session.id,
        session.identityId,
        session.tenantId,
        session.applicationId ?? null,
        session.createdAt,
        session.expiresAt,
        JSON.stringify(session.attributes ?? {}),
      ],
    );
  }

  async get(id: string): Promise<Session | null> {
    const rows = await this.db.query<SessionRow>(
      `SELECT ${SELECT_COLUMNS} FROM sessions WHERE id = $1`,
      [id],
    );

    if (rows.length === 0) return null;
    return toSession(rows[0]!);
  }

  async revoke(id: string): Promise<void> {
    await this.db.execute(
      `UPDATE sessions SET revoked_at = $1 WHERE id = $2`,
      [new Date().toISOString(), id],
    );
  }

  async revokeAllForIdentity(identityId: string): Promise<void> {
    await this.db.execute(
      `UPDATE sessions SET revoked_at = $1 WHERE identity_id = $2`,
      [new Date().toISOString(), identityId],
    );
  }

  async listActiveForIdentity(identityId: string): Promise<Session[]> {
    const now = new Date().toISOString();
    const rows = await this.db.query<SessionRow>(
      `SELECT ${SELECT_COLUMNS} FROM sessions
       WHERE identity_id = $1 AND expires_at > $2 AND revoked_at IS NULL`,
      [identityId, now],
    );

    return rows.map(toSession);
  }
}
