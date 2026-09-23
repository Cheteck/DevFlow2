/**
 * @mosaix/adapter-credential-store-postgres – PostgreSQL adapter for CredentialStore port.
 */

import type { DatabasePort } from "@mosaix/ports-database";
import type {
  Credential,
  CredentialType,
  SaveCredentialInput,
  CredentialStore,
} from "@mosaix/ports-credential-store";

export class PostgresCredentialStoreAdapter implements CredentialStore {
  private readonly db: DatabasePort;

  constructor(db: DatabasePort) {
    this.db = db;
  }

  async get(identityId: string, type: string): Promise<Credential | null> {
    const rows = await this.db.query<
      Credential & { data: unknown }
    >(
      `SELECT id, identity_id AS "identityId", type, created_at AS "createdAt", updated_at AS "updatedAt", expires_at AS "expiresAt", revoked_at AS "revokedAt", data
       FROM credentials
       WHERE identity_id = $1 AND type = $2
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
      ...(row.expiresAt !== undefined ? { expiresAt: row.expiresAt } : {}),
      ...(row.revokedAt !== undefined ? { revokedAt: row.revokedAt } : {}),
      data: row.data as Record<string, unknown>,
    };
  }

  async save(input: SaveCredentialInput): Promise<Credential> {
    const credentialId = `${input.identityId}-${input.type}-${Date.now()}`;
    const now = new Date().toISOString();

    await this.db.query(
      `INSERT INTO credentials (id, identity_id, type, created_at, updated_at, expires_at, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
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
    await this.db.query(
      `UPDATE credentials
       SET revoked_at = $2
       WHERE id = $1`,
      [credentialId, new Date().toISOString()]
    );
  }

  async revokeAllForIdentity(identityId: string): Promise<void> {
    await this.db.query(
      `UPDATE credentials
       SET revoked_at = $2
       WHERE identity_id = $1`,
      [identityId, new Date().toISOString()]
    );
  }
}