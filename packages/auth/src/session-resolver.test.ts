import { describe, it, expect, beforeEach } from "vitest";
import { PlatformSessionResolver } from "./session-resolver.js";
import type { Session, SessionStore } from "@mosaix/contracts";
import type { Identity, IdentityStore } from "@mosaix/ports-identity-store";

class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, Session>();

  async create(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async get(id: string): Promise<Session | null> {
    return this.sessions.get(id) ?? null;
  }

  async revoke(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      session.revokedAt = new Date().toISOString();
    }
  }

  async revokeAllForIdentity(identityId: string): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.identityId === identityId) {
        session.revokedAt = new Date().toISOString();
      }
    }
  }

  async listActiveForIdentity(identityId: string): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter(
      (s) => s.identityId === identityId && !s.revokedAt,
    );
  }
}

class InMemoryIdentityStore implements IdentityStore {
  private identities = new Map<string, Identity>();

  async create(identity: Identity): Promise<void> {
    this.identities.set(identity.id, identity);
  }

  async findById(id: string): Promise<Identity | null> {
    return this.identities.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<Identity | null> {
    return Array.from(this.identities.values()).find((i) => i.email === email) ?? null;
  }

  async findByExternalIdentity(): Promise<Identity | null> {
    return null;
  }

  async update(id: string, partial: Partial<Identity>): Promise<Identity> {
    const existing = this.identities.get(id);
    if (!existing) throw new Error("Not found");
    const updated = { ...existing, ...partial };
    this.identities.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.identities.delete(id);
  }
}

describe("PlatformSessionResolver", () => {
  let sessionStore: InMemorySessionStore;
  let identityStore: InMemoryIdentityStore;
  let resolver: PlatformSessionResolver;

  beforeEach(() => {
    sessionStore = new InMemorySessionStore();
    identityStore = new InMemoryIdentityStore();
    resolver = new PlatformSessionResolver(sessionStore, identityStore);
  });

  it("returns null for invalid or missing sessionId", async () => {
    expect(await resolver.resolve("")).toBeNull();
    expect(await resolver.resolve("non_existent")).toBeNull();
  });

  it("resolves active valid session and identity", async () => {
    const identity: Identity = {
      id: "usr_123",
      tenantId: "default",
      email: "test@mosaix.network",
      displayName: "Test User",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      externalIdentities: [],
    };
    await identityStore.create(identity);

    const session: Session = {
      id: "sess_456",
      identityId: "usr_123",
      tenantId: "default",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    };
    await sessionStore.create(session);

    const resolved = await resolver.resolve("sess_456");
    expect(resolved).not.toBeNull();
    expect(resolved?.userId).toBe("usr_123");
    expect(resolved?.sessionId).toBe("sess_456");
  });

  it("returns null for expired session", async () => {
    const identity: Identity = {
      id: "usr_123",
      tenantId: "default",
      email: "test@mosaix.network",
      displayName: "Test User",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      externalIdentities: [],
    };
    await identityStore.create(identity);

    const session: Session = {
      id: "sess_expired",
      identityId: "usr_123",
      tenantId: "default",
      createdAt: new Date(Date.now() - 7200 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    };
    await sessionStore.create(session);

    expect(await resolver.resolve("sess_expired")).toBeNull();
  });

  it("returns null for revoked session or disabled identity", async () => {
    const identity: Identity = {
      id: "usr_disabled",
      tenantId: "default",
      email: "disabled@mosaix.network",
      displayName: "Disabled User",
      status: "disabled",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      externalIdentities: [],
    };
    await identityStore.create(identity);

    const session: Session = {
      id: "sess_789",
      identityId: "usr_disabled",
      tenantId: "default",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    };
    await sessionStore.create(session);

    expect(await resolver.resolve("sess_789")).toBeNull();
  });
});
