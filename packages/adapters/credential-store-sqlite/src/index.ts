/**
 * @mosaix/adapter-credential-store-sqlite — SQLite Credential Store Adapter with DatabasePort SQL queries
 */

import type { DatabasePort } from "@mosaix/ports-database";
import type {
  Credential,
  CredentialType,
  SaveCredentialInput,
  CredentialStore,
} from "@mosaix/ports-credential-store";

interface CredentialRow {
  id: string;
  identityId: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  data: string | Record<string, unknown>;
}

export class SQLiteCredentialStoreAdapter implements CredentialStore {
  private readonly db: DatabasePort;

  constructor(db: DatabasePort) {
    this.db = db;
  }

  async get(identityId: string, type: string): Promise<Credential | null> {
    const rows = await this.db.query<CredentialRow>(
      `SELECT id, identity_id AS "identityId", type, created_at AS "createdAt", updated_at AS "updatedAt", expires_at AS "expiresAt", revoked_at AS "revokedAt", data
       FROM credentials
       WHERE identity_id = ? AND type = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [identityId, type]
    );

    if (rows.length === 0) return null;
    const row = rows[0]!;
    return {
      id: row.id,
      identityId: row.identityId,
      type: row.type as CredentialType,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ...(row.expiresAt !== undefined && row.expiresAt !== null ? { expiresAt: row.expiresAt } : {}),
      ...(row.revokedAt !== undefined && row.revokedAt !== null ? { revokedAt: row.revokedAt } : {}),
      data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
    };
  }

  async save(input: SaveCredentialInput): Promise<Credential> {
    const credentialId = `${input.identityId}-${input.type}-${Date.now()}`;
    const now = new Date().toISOString();

    await this.db.execute(
      `INSERT INTO credentials (id, identity_id, type, created_at, updated_at, expires_at, data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        credentialId,
        input.identityId,
        input.type,
        now,
        now,
        input.expiresAt ?? null,
        JSON.stringify(input.data),
      ]
    );

    return {
      id: credentialId,
      identityId: input.identityId,
      type: input.type,
      createdAt: now,
      updatedAt: now,
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
      data: input.data,
    };
  }

  async revoke(credentialId: string): Promise<void> {
    await this.db.execute(
      `UPDATE credentials
       SET revoked_at = ?
       WHERE id = ?`,
      [new Date().toISOString(), credentialId]
    );
  }

  async revokeAllForIdentity(identityId: string): Promise<void> {
    await this.db.execute(
      `UPDATE credentials
       SET revoked_at = ?
       WHERE identity_id = ?`,
      [new Date().toISOString(), identityId]
    );
  }
}
