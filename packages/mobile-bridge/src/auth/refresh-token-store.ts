import type { DatabasePort } from "@mosaix/ports-database";
import { randomUUID } from "node:crypto";

export interface MobileSessionToken {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
  userId: string;
  deviceId: string;
  scope: string[];
}

export interface StoredSession {
  sessionId: string;
  familyId: string;
  userId: string;
  deviceId: string;
  currentRefreshToken: string;
  previousRefreshTokens: Set<string>;
  scope: string[];
  expiresAt: number;
  isRevoked: boolean;
  createdAt: number;
}

export interface RefreshTokenStorePort {
  createSession(userId: string, deviceId: string, scope: string[]): Promise<MobileSessionToken>;
  rotate(refreshToken: string): Promise<{ success: true; tokens: MobileSessionToken } | { success: false; error: string }>;
  revokeFamily(familyId: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
  findByRefreshToken(refreshToken: string): Promise<StoredSession | null>;
  cleanupExpired(): Promise<number>;
}

export class RefreshTokenStoreAdapter implements RefreshTokenStorePort {
  constructor(private readonly db: DatabasePort) {}

  async createSession(userId: string, deviceId: string, scope: string[] = ["read", "write"]): Promise<MobileSessionToken> {
    const familyId = `fam_${randomUUID()}`;
    const sessionId = `ses_${randomUUID()}`;
    const accessToken = `mosaix_acc_${randomUUID()}`;
    const refreshToken = `mosaix_ref_${randomUUID()}`;
    const now = Date.now();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days

    await this.db.execute(
      `INSERT INTO refresh_token_sessions (session_id, family_id, user_id, device_id, current_refresh_token, previous_refresh_tokens, scope, expires_at, is_revoked, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        familyId,
        userId,
        deviceId,
        refreshToken,
        JSON.stringify([]),
        JSON.stringify(scope),
        expiresAt,
        0,
        now,
      ],
    );

    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresInSeconds: 900, // 15 minutes access token
      userId,
      deviceId,
      scope,
    };
  }

  async rotate(refreshToken: string): Promise<{ success: true; tokens: MobileSessionToken } | { success: false; error: string }> {
    const session = await this.findByRefreshToken(refreshToken);
    if (!session) {
      return { success: false, error: "Invalid or revoked refresh token." };
    }

    if (session.isRevoked) {
      return { success: false, error: "Invalid or revoked refresh token." };
    }

    if (session.expiresAt < Date.now()) {
      await this.deleteBySessionId(session.sessionId);
      return { success: false, error: "Refresh token expired." };
    }

    // Check for token reuse (previous tokens)
    if (session.previousRefreshTokens.has(refreshToken)) {
      // TOKEN REUSE ATTACK DETECTED!
      // Revoke the entire token family
      await this.revokeFamily(session.familyId);
      return {
        success: false,
        error: "Token reuse detected. All sessions in this token family have been revoked for security.",
      };
    }

    // Rotate tokens
    const newRefreshToken = `mosaix_ref_${randomUUID()}`;
    const newAccessToken = `mosaix_acc_${randomUUID()}`;
    const updatedPreviousTokens = new Set(session.previousRefreshTokens);
    updatedPreviousTokens.add(session.currentRefreshToken);

    await this.db.execute(
      `UPDATE refresh_token_sessions SET current_refresh_token = ?, previous_refresh_tokens = ? WHERE session_id = ?`,
      [newRefreshToken, JSON.stringify(Array.from(updatedPreviousTokens)), session.sessionId],
    );

    return {
      success: true,
      tokens: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        tokenType: "Bearer",
        expiresInSeconds: 900,
        userId: session.userId,
        deviceId: session.deviceId,
        scope: session.scope,
      },
    };
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.db.execute(
      `UPDATE refresh_token_sessions SET is_revoked = 1 WHERE family_id = ?`,
      [familyId],
    );
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db.execute(
      `UPDATE refresh_token_sessions SET is_revoked = 1 WHERE user_id = ?`,
      [userId],
    );
  }

  async findByRefreshToken(refreshToken: string): Promise<StoredSession | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT session_id as sessionId, family_id as familyId, user_id as userId, device_id as deviceId, current_refresh_token as currentRefreshToken, previous_refresh_tokens as previousRefreshTokens, scope, expires_at as expiresAt, is_revoked as isRevoked, created_at as createdAt
       FROM refresh_token_sessions WHERE current_refresh_token = ? AND is_revoked = 0`,
      [refreshToken],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      sessionId: String(r.sessionId),
      familyId: String(r.familyId),
      userId: String(r.userId),
      deviceId: String(r.deviceId),
      currentRefreshToken: String(r.currentRefreshToken),
      previousRefreshTokens: new Set(r.previousRefreshTokens ? JSON.parse(String(r.previousRefreshTokens)) : []),
      scope: r.scope ? JSON.parse(String(r.scope)) : ["read", "write"],
      expiresAt: Number(r.expiresAt),
      isRevoked: Boolean(Number(r.isRevoked)),
      createdAt: Number(r.createdAt),
    };
  }

  async cleanupExpired(): Promise<number> {
    const result = await this.db.execute(
      `DELETE FROM refresh_token_sessions WHERE expires_at < ?`,
      [Date.now()],
    );
    return (result ?? 0) as number;
  }

  private async deleteBySessionId(sessionId: string): Promise<void> {
    await this.db.execute(`DELETE FROM refresh_token_sessions WHERE session_id = ?`, [sessionId]);
  }
}