import type { DatabasePort } from "@mosaix/ports-database";

/**
 * Auth Code for OAuth 2.1 PKCE flow
 */
export interface AuthCodeRecord {
  id: string;
  userId: string;
  codeChallenge: string;
  codeChallengeMethod: "S256" | "plain";
  expiresAt: number;
  createdAt: number;
}

/**
 * Port for auth code persistence
 */
export interface AuthCodeStorePort {
  save(code: AuthCodeRecord): Promise<void>;
  findById(id: string): Promise<AuthCodeRecord | null>;
  deleteById(id: string): Promise<void>;
  deleteExpired(): Promise<number>;
}

/**
 * SQLite/Postgres implementation of AuthCodeStorePort
 */
export class AuthCodeStoreAdapter implements AuthCodeStorePort {
  constructor(private readonly db: DatabasePort) {}

  async save(code: AuthCodeRecord): Promise<void> {
    await this.db.execute(
      `INSERT INTO oauth_auth_codes (id, user_id, code_challenge, code_challenge_method, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [code.id, code.userId, code.codeChallenge, code.codeChallengeMethod, code.expiresAt, code.createdAt],
    );
  }

  async findById(id: string): Promise<AuthCodeRecord | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, user_id as userId, code_challenge as codeChallenge, code_challenge_method as codeChallengeMethod, expires_at as expiresAt, created_at as createdAt
       FROM oauth_auth_codes WHERE id = ?`,
      [id],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: String(r.id),
      userId: String(r.userId),
      codeChallenge: String(r.codeChallenge),
      codeChallengeMethod: String(r.codeChallengeMethod) as "S256" | "plain",
      expiresAt: Number(r.expiresAt),
      createdAt: Number(r.createdAt),
    };
  }

  async deleteById(id: string): Promise<void> {
    await this.db.execute(`DELETE FROM oauth_auth_codes WHERE id = ?`, [id]);
  }

  async deleteExpired(): Promise<number> {
    const result = await this.db.execute(
      `DELETE FROM oauth_auth_codes WHERE expires_at < ?`,
      [Date.now()],
    );
    return (result ?? 0) as number;
  }
}