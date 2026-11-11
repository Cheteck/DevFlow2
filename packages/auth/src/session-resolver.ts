/**
 * @mosaix/auth — Platform Session Resolver & Context (AUTH-04).
 */

import type { SessionStore } from "@mosaix/ports-session-store";
import type { IdentityStore, Identity } from "@mosaix/ports-identity-store";

export interface PlatformSessionContext {
  sessionId: string;
  identityId: string;
  tenantId: string;
  identity: Identity;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export class SessionResolver {
  constructor(
    private readonly sessionStore: SessionStore,
    private readonly identityStore?: IdentityStore,
  ) {}

  async resolve(sessionId: string): Promise<PlatformSessionContext | null> {
    if (!sessionId) return null;

    const rawSession = await this.sessionStore.get(sessionId);
    if (!rawSession) return null;

    if (rawSession.expiresAt && new Date(rawSession.expiresAt).getTime() < Date.now()) {
      // Best effort: expired sessions must never resolve. Revocation is the
      // port-level primitive (`revoke`), not `delete` (which does not exist
      // on `SessionStore`). A failing cleanup must not resurrect the session.
      try {
        await this.sessionStore.revoke(sessionId);
      } catch {
        // ignore cleanup failure — the session is still rejected below
      }
      return null;
    }

    if (rawSession.revokedAt !== undefined) return null;

    let identity: Identity;
    if (this.identityStore && rawSession.identityId) {
      const found = await this.identityStore.findById(rawSession.identityId);
      // Fail closed: a valid session without a resolvable identity is NOT
      // an anonymous guest — it is an incomplete account. Never fabricate
      // a guest identity here; callers map `null` to the anonymous state.
      if (!found) return null;
      identity = found;
    } else {
      // No identity store wired: derive the identity reference from the
      // server-side session record only (never from client input). This is
      // a session-bound reference, not an applicative profile — the
      // `UserProfile` projection stays outside `@mosaix/auth` (ADR-0017).
      identity = {
        id: rawSession.identityId,
        tenantId: rawSession.tenantId,
        status: "active",
        createdAt: rawSession.createdAt,
        updatedAt: rawSession.createdAt,
        externalIdentities: [],
        attributes: {},
      };
    }

    return {
      sessionId: rawSession.id,
      identityId: rawSession.identityId,
      tenantId: rawSession.tenantId,
      identity,
      createdAt: rawSession.createdAt,
      updatedAt: rawSession.createdAt,
      expiresAt: rawSession.expiresAt,
    };
  }
}
