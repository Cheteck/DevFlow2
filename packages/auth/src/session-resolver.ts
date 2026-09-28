/**
 * @mosaix/auth — Platform Session Resolver & Context (ADR-0017 AUTH-04)
 */

import type { SessionStore, Session } from "@mosaix/ports-session-store";
import type { IdentityStore, Identity } from "@mosaix/ports-identity-store";

export interface PlatformSessionContext {
  session: Session;
  identity: Identity;
  isDemoGuest?: boolean;
}

export class SessionResolver {
  constructor(
    private readonly sessionStore: SessionStore,
    private readonly identityStore: IdentityStore
  ) {}

  async resolveSession(sessionId: string): Promise<PlatformSessionContext | null> {
    if (!sessionId) return null;

    const session = await this.sessionStore.get(sessionId);
    if (!session || session.revokedAt) return null;

    if (new Date(session.expiresAt) < new Date()) {
      return null;
    }

    const identity = await this.identityStore.findById(session.identityId);
    if (!identity || identity.status === "disabled") return null;

    return {
      session,
      identity,
      isDemoGuest: false,
    };
  }
}
