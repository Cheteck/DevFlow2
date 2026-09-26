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
  expiresAt: Date;
  isRevoked: boolean;
}

/**
 * Single-Use Refresh Token Rotator with Family Revocation (OAuth 2.1 RFC Compliance)
 * If an already consumed refresh token is presented, the entire session family is revoked
 * to protect against replay attacks.
 */
export class RefreshTokenRotator {
  private static sessionStore = new Map<string, StoredSession>();

  /**
   * Initializes a new session upon successful authentication
   */
  public static createSession(
    userId: string,
    deviceId: string,
    scope: string[] = ["read", "write"]
  ): MobileSessionToken {
    const familyId = `fam_${randomUUID()}`;
    const sessionId = `ses_${randomUUID()}`;
    const accessToken = `mosaix_acc_${randomUUID()}`;
    const refreshToken = `mosaix_ref_${randomUUID()}`;

    const session: StoredSession = {
      sessionId,
      familyId,
      userId,
      deviceId,
      currentRefreshToken: refreshToken,
      previousRefreshTokens: new Set(),
      scope,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      isRevoked: false,
    };

    this.sessionStore.set(sessionId, session);

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

  /**
   * Rotates a refresh token.
   * If a reused/revoked token is detected, all sessions in that family are revoked.
   */
  public static rotate(refreshToken: string): { success: true; tokens: MobileSessionToken } | { success: false; error: string } {
    let targetSession: StoredSession | undefined;

    // Search across sessions
    for (const session of this.sessionStore.values()) {
      if (session.currentRefreshToken === refreshToken) {
        targetSession = session;
        break;
      }
      if (session.previousRefreshTokens.has(refreshToken)) {
        // TOKEN REUSE ATTACK DETECTED!
        // Revoke the entire token family
        this.revokeFamily(session.familyId);
        return {
          success: false,
          error: "Token reuse detected. All sessions in this token family have been revoked for security.",
        };
      }
    }

    if (!targetSession || targetSession.isRevoked) {
      return { success: false, error: "Invalid or revoked refresh token." };
    }

    if (targetSession.expiresAt.getTime() < Date.now()) {
      this.sessionStore.delete(targetSession.sessionId);
      return { success: false, error: "Refresh token expired." };
    }

    // Rotate tokens
    targetSession.previousRefreshTokens.add(targetSession.currentRefreshToken);
    const newRefreshToken = `mosaix_ref_${randomUUID()}`;
    const newAccessToken = `mosaix_acc_${randomUUID()}`;
    targetSession.currentRefreshToken = newRefreshToken;

    return {
      success: true,
      tokens: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        tokenType: "Bearer",
        expiresInSeconds: 900,
        userId: targetSession.userId,
        deviceId: targetSession.deviceId,
        scope: targetSession.scope,
      },
    };
  }

  /**
   * Revokes all sessions belonging to a specific family ID
   */
  public static revokeFamily(familyId: string): void {
    for (const [id, session] of this.sessionStore.entries()) {
      if (session.familyId === familyId) {
        session.isRevoked = true;
        this.sessionStore.delete(id);
      }
    }
  }

  /**
   * Revokes all sessions for a user (e.g. Logout on all devices)
   */
  public static revokeAllForUser(userId: string): void {
    for (const [id, session] of this.sessionStore.entries()) {
      if (session.userId === userId) {
        session.isRevoked = true;
        this.sessionStore.delete(id);
      }
    }
  }
}
