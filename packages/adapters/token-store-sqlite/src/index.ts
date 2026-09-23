/**
 * @mosaix/adapter-token-store-sqlite — SQLite Token Store Adapter with DatabasePort SQL queries
 */

import type { DatabasePort } from "@mosaix/ports-database";
import type {
  TokenEntry,
  TokenStore,
} from "@mosaix/ports-token-store";

interface TokenRow {
  tokenId: string;
  identityId: string;
  sessionId: string;
  type: string;
  expiresAt: string;
  revokedAt?: string;
  attributes: string | Record<string, unknown>;
}

export class SQLiteTokenStoreAdapter implements TokenStore {
  private readonly db: DatabasePort;

  constructor(db: DatabasePort) {
    this.db = db;
  }

  async save(entry: TokenEntry): Promise<void> {
    await this.db.execute(
      `INSERT INTO tokens (token_id, identity_id, session_id, type, expires_at, attributes)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (token_id) DO UPDATE SET
         identity_id = excluded.identity_id,
         session_id = excluded.session_id,
         type = excluded.type,
         expires_at = excluded.expires_at,
         attributes = excluded.attributes`,
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
    const rows = await this.db.query<TokenRow>(
      `SELECT token_id AS "tokenId", identity_id AS "identityId", session_id AS "sessionId", type, expires_at AS "expiresAt", attributes, revoked_at AS "revokedAt"
       FROM tokens
       WHERE token_id = ?`,
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
      ...(row.revokedAt !== undefined && row.revokedAt !== null ? { revokedAt: row.revokedAt } : {}),
      attributes: typeof row.attributes === "string" ? JSON.parse(row.attributes) : row.attributes,
    };
  }

  async revoke(tokenId: string): Promise<void> {
    await this.db.execute(
      `UPDATE tokens
       SET revoked_at = ?
       WHERE token_id = ?`,
      [new Date().toISOString(), tokenId]
    );
  }

  async revokeAllForSession(sessionId: string): Promise<void> {
    await this.db.execute(
      `UPDATE tokens
       SET revoked_at = ?
       WHERE session_id = ?`,
      [new Date().toISOString(), sessionId]
    );
  }
}
