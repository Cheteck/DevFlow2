/**
 * @mosaix/adapter-token-store-postgres – PostgreSQL adapter for TokenStore port.
 */

import type { DatabasePort } from "@mosaix/ports-database";
import type {
  TokenEntry,
  TokenStore,
} from "@mosaix/ports-token-store";

export class PostgresTokenStoreAdapter implements TokenStore {
  private readonly db: DatabasePort;

  constructor(db: DatabasePort) {
    this.db = db;
  }

  async save(entry: TokenEntry): Promise<void> {
    await this.db.query(
      `INSERT INTO tokens (token_id, identity_id, session_id, type, expires_at, attributes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (token_id) DO UPDATE SET
         identity_id = EXCLUDED.identity_id,
         session_id = EXCLUDED.session_id,
         type = EXCLUDED.type,
         expires_at = EXCLUDED.expires_at,
         attributes = EXCLUDED.attributes`,
      [
        entry.tokenId,
        entry.identityId,
        entry.sessionId,
        entry.type,
        entry.expiresAt,
        JSON.stringify(entry.attributes),
      ]
    );
  }

  async findById(tokenId: string): Promise<TokenEntry | null> {
    const rows = await this.db.query<
      TokenEntry & { attributes: unknown }
    >(
      `SELECT token_id AS "tokenId", identity_id AS "identityId", session_id AS "sessionId", type, expires_at AS "expiresAt", attributes
       FROM tokens
       WHERE token_id = $1`,
      [tokenId]
    );

    if (rows.length === 0) return null;
    const row = rows[0]!;
    return {
      tokenId: row.tokenId,
      identityId: row.identityId,
      sessionId: row.sessionId,
      type: row.type,
      expiresAt: row.expiresAt,
      attributes: row.attributes as Record<string, unknown>,
    };
  }

  async revoke(tokenId: string): Promise<void> {
    await this.db.query(
      `UPDATE tokens
       SET revoked_at = $2
       WHERE token_id = $1`,
      [tokenId, new Date().toISOString()]
    );
  }

  async revokeAllForSession(sessionId: string): Promise<void> {
    await this.db.query(
      `UPDATE tokens
       SET revoked_at = $2
       WHERE session_id = $1`,
      [sessionId, new Date().toISOString()]
    );
  }
}