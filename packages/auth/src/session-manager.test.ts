/**
 * @mosaix/auth — SessionManager tests.
 */

import { describe, it, expect, vi } from "vitest";
import type { SessionStore } from "@mosaix/contracts";
import type { IdGeneratorPort } from "@mosaix/ports-id";
import { SessionManager } from "./session-manager";

function makeSessionStore(overrides: Partial<SessionStore> = {}): SessionStore {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    revoke: vi.fn(),
    revokeAllForIdentity: vi.fn(),
    listActiveForIdentity: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as SessionStore;
}

function makeIdGenerator(): IdGeneratorPort {
  return {
    generate: () => `test-id-${Math.random().toString(36).slice(2, 9)}`,
    randomBytes: (length: number) => {
      const bytes = new Uint8Array(length);
      crypto.getRandomValues(bytes);
      return Buffer.from(bytes);
    },
  };
}

describe("SessionManager", () => {
  it("creates a session with default TTL", async () => {
    const store = makeSessionStore();
    const manager = new SessionManager(store, makeIdGenerator());

    const session = await manager.create("identity-1", "tenant-1");

    expect(session.id).toBeTruthy();
    expect(session.identityId).toBe("identity-1");
    expect(session.tenantId).toBe("tenant-1");
    expect(session.expiresAt).toBeTruthy();
    expect(store.create).toHaveBeenCalled();
  });

  it("creates a session with custom TTL", async () => {
    const store = makeSessionStore();
    const manager = new SessionManager(store, makeIdGenerator(), { defaultTtlSeconds: 7200 });

    const session = await manager.create("identity-1", "tenant-1", "app-1", {
      key: "value",
    });

    expect(session.applicationId).toBe("app-1");
    expect(session.attributes).toEqual({ key: "value" });
    const expiresAt = new Date(session.expiresAt).getTime();
    const now = Date.now();
    expect(expiresAt - now).toBeGreaterThanOrEqual(7100 * 1000);
    expect(expiresAt - now).toBeLessThanOrEqual(7300 * 1000);
  });

  it("gets a session by id", async () => {
    const store = makeSessionStore({
      get: vi.fn().mockResolvedValue({ id: "s-1" } as never),
    });
    const manager = new SessionManager(store);

    const session = await manager.get("s-1");
    expect(session?.id).toBe("s-1");
  });

  it("revokes a session", async () => {
    const store = makeSessionStore();
    const manager = new SessionManager(store);

    await manager.revoke("s-1");
    expect(store.revoke).toHaveBeenCalledWith("s-1");
  });

  it("revokes all sessions for an identity", async () => {
    const store = makeSessionStore();
    const manager = new SessionManager(store);

    await manager.revokeAllForIdentity("identity-1");
    expect(store.revokeAllForIdentity).toHaveBeenCalledWith("identity-1");
  });

  it("lists active sessions for an identity", async () => {
    const store = makeSessionStore({
      listActiveForIdentity: vi
        .fn()
        .mockResolvedValue([{ id: "s-1" }] as never),
    });
    const manager = new SessionManager(store);

    const sessions = await manager.listActiveForIdentity("identity-1");
    expect(sessions).toHaveLength(1);
  });

  it("detects expired session", () => {
    const store = makeSessionStore();
    const manager = new SessionManager(store);

    const expired = {
      id: "s-1",
      identityId: "identity-1",
      tenantId: "tenant-1",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      attributes: {},
    };

    expect(manager.isExpired(expired)).toBe(true);
  });

  it("detects revoked session", () => {
    const store = makeSessionStore();
    const manager = new SessionManager(store);

    const revoked = {
      id: "s-1",
      identityId: "identity-1",
      tenantId: "tenant-1",
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      revokedAt: new Date().toISOString(),
      attributes: {},
    };

    expect(manager.isRevoked(revoked)).toBe(true);
  });
});
