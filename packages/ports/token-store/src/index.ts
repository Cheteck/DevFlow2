/**
 * @mosaix/ports-token-store — TokenStore port (auth token persistence).
 *
 * Canonical contract implemented by the SQLite/Postgres adapters and the
 * Citadelle in-memory fallback. Entries carry ISO-8601 date strings so all
 * adapters share one serialization.
 */

export interface TokenEntry {
  tokenId: string;
  identityId: string;
  sessionId: string;
  type: string;
  /** ISO-8601 expiry timestamp. */
  expiresAt: string;
  /** ISO-8601 revocation timestamp (absent = active). */
  revokedAt?: string;
  attributes: Record<string, unknown>;
}

export interface TokenStore {
  save(entry: TokenEntry): Promise<void>;
  findById(tokenId: string): Promise<TokenEntry | null>;
  revoke(tokenId: string): Promise<void>;
  revokeAllForSession(sessionId: string): Promise<void>;
}
