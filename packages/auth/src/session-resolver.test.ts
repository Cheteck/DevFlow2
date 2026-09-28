import { describe, it, expect } from "vitest";
import { SessionResolver } from "./session-resolver.js";
import type { SessionStore, Session } from "@mosaix/ports-session-store";
import type { IdentityStore, Identity } from "@mosaix/ports-identity-store";

describe("SessionResolver", () => {
  it("resolves active session and identity correctly", async () => {
    const mockSession: Session = {
      id: "sess-1",
      identityId: "user-1",
      tenantId: "tenant-1",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };

    const mockIdentity: Identity = {
      id: "user-1",
      tenantId: "tenant-1",
      email: "user@example.com",
      displayName: "Alice",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      externalIdentities: [],
      attributes: {},
    };

    const mockSessionStore: SessionStore = {
      create: async () => {},
      get: async (id) => (id === "sess-1" ? mockSession : null),
      revoke: async () => {},
      revokeAllForIdentity: async () => {},
      listActiveForIdentity: async () => [mockSession],
    };

    const mockIdentityStore: IdentityStore = {
      findById: async (id) => (id === "user-1" ? mockIdentity : null),
      findByExternalIdentity: async () => null,
      findByEmail: async () => null,
      create: async () => {},
      update: async () => {},
      linkExternalIdentity: async () => ({ provider: "local", externalId: "1", linkedAt: "" }),
      unlinkExternalIdentity: async () => {},
    };

    const resolver = new SessionResolver(mockSessionStore, mockIdentityStore);
    const ctx = await resolver.resolveSession("sess-1");

    expect(ctx).not.toBeNull();
    expect(ctx?.identity.displayName).toBe("Alice");
    expect(ctx?.session.id).toBe("sess-1");
  });
});
