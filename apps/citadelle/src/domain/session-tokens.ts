import * as crypto from "node:crypto";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
  familyId: string;
}

export interface StoredRefreshToken {
  token: string;
  userId: string;
  familyId: string;
  isRevoked: boolean;
  expiresAt: number;
}

export class SessionTokenManager {
  private refreshTokens = new Map<string, StoredRefreshToken>();
  private revokedTokenHashes = new Set<string>();

  constructor(
    private readonly accessTokenTtlSeconds = 3600, // 1 hour
    private readonly refreshTokenTtlSeconds = 30 * 24 * 3600, // 30 days
  ) {}

  generateTokenPair(userId: string, familyId = crypto.randomUUID()): TokenPair {
    const accessToken = crypto.randomBytes(32).toString("base64url");
    const refreshToken = crypto.randomBytes(48).toString("base64url");
    const expiresAt = Date.now() + this.refreshTokenTtlSeconds * 1000;

    this.refreshTokens.set(refreshToken, {
      token: refreshToken,
      userId,
      familyId,
      isRevoked: false,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresInSeconds: this.accessTokenTtlSeconds,
      familyId,
    };
  }

  rotateRefreshToken(oldRefreshToken: string): { success: true; tokens: TokenPair } | { success: false; reason: string } {
    const record = this.refreshTokens.get(oldRefreshToken);
    if (!record) {
      return { success: false, reason: "Token introuvable" };
    }

    // Reuse detection: If an already revoked token is used again, revoke the whole family!
    if (record.isRevoked) {
      this.revokeFamily(record.familyId);
      return { success: false, reason: "Tentative de réutilisation détectée, famille révoquée" };
    }

    if (Date.now() > record.expiresAt) {
      this.refreshTokens.delete(oldRefreshToken);
      return { success: false, reason: "Token expiré" };
    }

    // Mark current token as revoked
    record.isRevoked = true;
    this.refreshTokens.set(oldRefreshToken, record);

    // Issue new pair maintaining the same familyId
    const newTokens = this.generateTokenPair(record.userId, record.familyId);
    return { success: true, tokens: newTokens };
  }

  revokeToken(refreshToken: string): void {
    const record = this.refreshTokens.get(refreshToken);
    if (record) {
      record.isRevoked = true;
      this.refreshTokens.set(refreshToken, record);
    }
    this.revokedTokenHashes.add(refreshToken);
  }

  revokeFamily(familyId: string): void {
    for (const [token, record] of this.refreshTokens.entries()) {
      if (record.familyId === familyId) {
        record.isRevoked = true;
        this.revokedTokenHashes.add(token);
      }
    }
  }

  isRevoked(token: string): boolean {
    if (this.revokedTokenHashes.has(token)) return true;
    const record = this.refreshTokens.get(token);
    return !record || record.isRevoked;
  }
}
