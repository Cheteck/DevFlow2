/**
 * @mosaix/auth — TokenManager tests.
 */

import { describe, it, expect, vi } from "vitest";
import type { TokenStore } from "@mosaix/contracts";
import type { IdGeneratorPort } from "@mosaix/ports-id";
import { TokenManager } from "./token-manager";

function makeTokenStore(overrides: Partial<TokenStore> = {}): TokenStore {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    revoke: vi.fn(),
    revokeAllForSession: vi.fn(),
    ...overrides,
  } as unknown as TokenStore;
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

describe("TokenManager", () => {
  it("generates an access token", async () => {
    const store = makeTokenStore();
    const manager = new TokenManager(store, makeIdGenerator());

    const result = await manager.generate("identity-1", "session-1", "access");

    expect(result.accessToken).toBeTruthy();
    expect(result.tokenType).toBe("access");
    expect(result.expiresIn).toBeGreaterThan(0);
    expect(store.save).toHaveBeenCalled();
  });

  it("generates a refresh token for access type", async () => {
    const store = makeTokenStore();
    const manager = new TokenManager(store, makeIdGenerator());

    const result = await manager.generate("identity-1", "session-1", "access");

    expect(result.refreshToken).toBeTruthy();
    expect(result.refreshToken).not.toBe(result.accessToken);
  });

  it("does not generate refresh token for non-access type", async () => {
    const store = makeTokenStore();
    const manager = new TokenManager(store, makeIdGenerator());

    const result = await manager.generate("identity-1", "session-1", "opaque");

    expect(result.refreshToken).toBeUndefined();
  });

  it("validates a token", async () => {
    const store = makeTokenStore({
      findById: vi.fn().mockResolvedValue({
        tokenId: "token-1",
        identityId: "identity-1",
        sessionId: "session-1",
        type: "access",
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        attributes: {},
      }),
    });
    const manager = new TokenManager(store, makeIdGenerator());

    const entry = await manager.validate("token-1");
    expect(entry?.tokenId).toBe("token-1");
  });

  it("rejects a revoked token", async () => {
    const store = makeTokenStore({
      findById: vi.fn().mockResolvedValue({
        tokenId: "token-1",
        identityId: "identity-1",
        sessionId: "session-1",
        type: "access",
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        revokedAt: new Date().toISOString(),
        attributes: {},
      }),
    });
    const manager = new TokenManager(store, makeIdGenerator());

    const entry = await manager.validate("token-1");
    expect(entry).toBeNull();
  });

  it("rejects an expired token", async () => {
    const store = makeTokenStore({
      findById: vi.fn().mockResolvedValue({
        tokenId: "token-1",
        identityId: "identity-1",
        sessionId: "session-1",
        type: "access",
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        attributes: {},
      }),
    });
    const manager = new TokenManager(store, makeIdGenerator());

    const entry = await manager.validate("token-1");
    expect(entry).toBeNull();
  });

  it("revokes a token", async () => {
    const store = makeTokenStore();
    const manager = new TokenManager(store, makeIdGenerator());

    await manager.revoke("token-1");
    expect(store.revoke).toHaveBeenCalledWith("token-1");
  });

  it("revokes all tokens for a session", async () => {
    const store = makeTokenStore();
    const manager = new TokenManager(store, makeIdGenerator());

    await manager.revokeAllForSession("session-1");
    expect(store.revokeAllForSession).toHaveBeenCalledWith("session-1");
  });
});
