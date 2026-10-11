/**
 * @mosaix/auth — SessionResolver tests (fail-closed resolution).
 */

import { describe, it, expect, vi } from "vitest";
import { SessionResolver } from "./session-resolver";

function makeStore(session: Record<string, unknown> | null) {
  return {
    get: vi.fn().mockResolvedValue(session),
    revoke: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue(undefined),
    revokeAllForIdentity: vi.fn().mockResolvedValue(undefined),
    listActiveForIdentity: vi.fn().mockResolvedValue([]),
  };
}

const liveSession = {
  id: "sess_live",
  identityId: "user-1",
  tenantId: "tenant-1",
  createdAt: new Date(Date.now() - 1000).toISOString(),
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
};

describe("SessionResolver", () => {
  it("resolves a live session without an identity store", async () => {
    const resolver = new SessionResolver(makeStore(liveSession) as never);
    const ctx = await resolver.resolve("sess_live");
    expect(ctx?.sessionId).toBe("sess_live");
    expect(ctx?.identityId).toBe("user-1");
  });

  it("returns null when no session id is given", async () => {
    const store = makeStore(liveSession);
    const resolver = new SessionResolver(store as never);
    expect(await resolver.resolve("")).toBeNull();
    expect(store.get).not.toHaveBeenCalled();
  });

  it("returns null and revokes when the session is expired", async () => {
    const expired = {
      ...liveSession,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };
    const store = makeStore(expired);
    const resolver = new SessionResolver(store as never);
    expect(await resolver.resolve("sess_live")).toBeNull();
    expect(store.revoke).toHaveBeenCalledWith("sess_live");
  });

  it("returns null for a revoked session without deleting anything else", async () => {
    const revoked = { ...liveSession, revokedAt: new Date().toISOString() };
    const store = makeStore(revoked);
    const resolver = new SessionResolver(store as never);
    expect(await resolver.resolve("sess_live")).toBeNull();
    expect(store.revoke).not.toHaveBeenCalled();
  });

  it("returns null for an unknown session id", async () => {
    const resolver = new SessionResolver(makeStore(null) as never);
    expect(await resolver.resolve("sess_nope")).toBeNull();
  });

  it("fails closed when the identity store cannot resolve the identity", async () => {
    const identityStore = { findById: vi.fn().mockResolvedValue(null) };
    const resolver = new SessionResolver(
      makeStore(liveSession) as never,
      identityStore as never,
    );
    expect(await resolver.resolve("sess_live")).toBeNull();
  });
});
