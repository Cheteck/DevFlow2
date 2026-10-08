/**
 * @mosaix/auth — Platform Session Resolver & Context (AUTH-04).
 */

import type { SessionStore } from "@mosaix/ports-session-store";
import type { IdentityStore, Identity } from "@mosaix/ports-identity-store";

export interface PlatformSessionContext {
  sessionId: string;
  identityId: string;
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
      await this.sessionStore.delete(sessionId);
      return null;
    }

    let identity: Identity | null = null;
    if (this.identityStore && rawSession.identityId) {
      identity = await this.identityStore.findById(rawSession.identityId);
    }

    const fallbackIdentity: Identity = identity || {
      id: rawSession.identityId || "guest",
      tenantId: "default",
      status: "active",
      createdAt: rawSession.createdAt || new Date().toISOString(),
      updatedAt: rawSession.updatedAt || new Date().toISOString(),
      externalIdentities: [],
      attributes: {},
    };

    return {
      sessionId: rawSession.id,
      identityId: rawSession.identityId,
      identity: fallbackIdentity,
      createdAt: rawSession.createdAt,
      updatedAt: rawSession.updatedAt,
      expiresAt: rawSession.expiresAt,
    };
  }
}
