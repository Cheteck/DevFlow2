/**
 * @mosaix/auth — Platform Session Resolver
 * Authoritative session verification and context resolution against persistent stores.
 */

import type { SessionStore } from "@mosaix/ports-session-store";
import type { IdentityStore } from "@mosaix/ports-identity-store";

export interface PlatformSessionContext {
  userId: string;
  sessionId: string;
  tenantId: string;
  authenticatedAt: Date;
  expiresAt: Date;
  authMethod: string;
}

export interface SessionResolver {
  resolve(sessionId: string): Promise<PlatformSessionContext | null>;
}

export class PlatformSessionResolver implements SessionResolver {
  constructor(
    private readonly sessionStore: SessionStore,
    private readonly identityStore: IdentityStore,
  ) {}

  async resolve(sessionId: string): Promise<PlatformSessionContext | null> {
    if (!sessionId || typeof sessionId !== "string") {
      return null;
    }

    const session = await this.sessionStore.get(sessionId);
    if (!session) {
      return null;
    }

    // Verify session revocation
    if (session.revokedAt) {
      return null;
    }

    // Verify session expiration
    const now = new Date();
    if (new Date(session.expiresAt) < now) {
      return null;
    }

    // Verify identity status
    const identity = await this.identityStore.findById(session.identityId);
    if (!identity || identity.status === "disabled") {
      return null;
    }

    return {
      userId: identity.id,
      sessionId: session.id,
      tenantId: session.tenantId,
      authenticatedAt: new Date(session.createdAt),
      expiresAt: new Date(session.expiresAt),
      authMethod: (session.attributes?.authMethod as string) || "session_cookie",
    };
  }
}
