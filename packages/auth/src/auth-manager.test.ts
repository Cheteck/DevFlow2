/**
 * @mosaix/auth — AuthManager tests.
 */

import type { IdGeneratorPort } from "@mosaix/ports-id";

import { describe, it, expect, vi } from "vitest";
import { AuthManager } from "./auth-manager";

function makeIdentityStore(
  overrides: {
    findById?: ReturnType<typeof vi.fn>;
  } = {},
): {
  findById: ReturnType<typeof vi.fn>;
} {
  return {
    findById:
      overrides.findById ??
      vi.fn().mockResolvedValue({
        id: "identity-1",
        tenantId: "tenant-1",
        status: "active",
        externalIdentities: [],
        attributes: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
  };
}

function makeSessionStore(): {
  create: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  revoke: ReturnType<typeof vi.fn>;
  revokeAllForIdentity: ReturnType<typeof vi.fn>;
  listActiveForIdentity: ReturnType<typeof vi.fn>;
} {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    revoke: vi.fn(),
    revokeAllForIdentity: vi.fn(),
    listActiveForIdentity: vi.fn().mockResolvedValue([]),
  };
}

function makeCredentialStore(): {
  get: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  revoke: ReturnType<typeof vi.fn>;
  revokeAllForIdentity: ReturnType<typeof vi.fn>;
} {
  return {
    get: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue({} as never),
    revoke: vi.fn(),
    revokeAllForIdentity: vi.fn(),
  };
}

function makeTokenStore(): {
  save: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  revoke: ReturnType<typeof vi.fn>;
  revokeAllForSession: ReturnType<typeof vi.fn>;
} {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    revoke: vi.fn(),
    revokeAllForSession: vi.fn(),
  };
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

describe("AuthManager", () => {
  it("returns failed when provider is not found", async () => {
    const manager = new AuthManager(
      new Map(),
      makeIdentityStore(),
      makeSessionStore(),
      makeCredentialStore(),
      makeTokenStore(),
      makeIdGenerator(),
    );

    const result = await manager.authenticate({
      provider: "missing",
      credentials: {},
      tenantId: "tenant-1",
    });

    expect(result.status).toBe("failed");
    expect(
      (result as { status: string; error: { code: string } }).error.code,
    ).toBe("provider_not_found");
  });

  it("returns failed when tenantId is missing and no default", async () => {
    const provider = {
      id: "local",
      capabilities: ["password"],
      authenticate: vi.fn().mockResolvedValue({
        status: "authenticated",
        principal: {
          subject: "subject-1",
          tenantId: "tenant-1",
          identityId: "identity-1",
          authentication: {
            provider: "local",
            method: "password",
            authenticatedAt: new Date().toISOString(),
          },
          attributes: {},
        },
        session: {
          id: "session-1",
          identityId: "identity-1",
          tenantId: "tenant-1",
          createdAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
          attributes: {},
        },
      }),
    };

    const manager = new AuthManager(
      new Map([["local", provider]]),
      makeIdentityStore(),
      makeSessionStore(),
      makeCredentialStore(),
      makeTokenStore(),
      makeIdGenerator(),
    );

    const result = await manager.authenticate({
      provider: "local",
      credentials: {},
      tenantId: "",
    });

    expect(result.status).toBe("failed");
    expect(
      (result as { status: string; error: { code: string } }).error.code,
    ).toBe("tenant_required");
  });

  it("returns failed when identity is disabled", async () => {
    const provider = {
      id: "local",
      capabilities: ["password"],
      authenticate: vi.fn().mockResolvedValue({
        status: "authenticated",
        principal: {
          subject: "subject-1",
          tenantId: "tenant-1",
          identityId: "identity-1",
          authentication: {
            provider: "local",
            method: "password",
            authenticatedAt: new Date().toISOString(),
          },
          attributes: {},
        },
        session: {
          id: "session-1",
          identityId: "identity-1",
          tenantId: "tenant-1",
          createdAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
          attributes: {},
        },
      }),
    };

    const manager = new AuthManager(
      new Map([["local", provider]]),
      makeIdentityStore({
        findById: vi.fn().mockResolvedValue({
          id: "identity-1",
          tenantId: "tenant-1",
          status: "disabled",
          externalIdentities: [],
          attributes: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      }),
      makeSessionStore(),
      makeCredentialStore(),
      makeTokenStore(),
      makeIdGenerator(),
    );

    const result = await manager.authenticate({
      provider: "local",
      credentials: {},
      tenantId: "tenant-1",
    });

    expect(result.status).toBe("failed");
    expect(
      (result as { status: string; error: { code: string } }).error.code,
    ).toBe("account_disabled");
  });

  it("returns failed when identity is not found", async () => {
    const provider = {
      id: "local",
      capabilities: ["password"],
      authenticate: vi.fn().mockResolvedValue({
        status: "authenticated",
        principal: {
          subject: "subject-1",
          tenantId: "tenant-1",
          identityId: "identity-1",
          authentication: {
            provider: "local",
            method: "password",
            authenticatedAt: new Date().toISOString(),
          },
          attributes: {},
        },
        session: {
          id: "session-1",
          identityId: "identity-1",
          tenantId: "tenant-1",
          createdAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
          attributes: {},
        },
      }),
    };

    const manager = new AuthManager(
      new Map([["local", provider]]),
      makeIdentityStore({
        findById: vi.fn().mockResolvedValue(null),
      }),
      makeSessionStore(),
      makeCredentialStore(),
      makeTokenStore(),
      makeIdGenerator(),
    );

    const result = await manager.authenticate({
      provider: "local",
      credentials: {},
      tenantId: "tenant-1",
    });

    expect(result.status).toBe("failed");
    expect(
      (result as { status: string; error: { code: string } }).error.code,
    ).toBe("identity_not_found");
  });

  it("returns provider result when not authenticated", async () => {
    const provider = {
      id: "local",
      capabilities: ["password"],
      authenticate: vi.fn().mockResolvedValue({
        status: "challenge",
        challenge: {
          type: "password",
          message: "Password required",
        },
      }),
    };

    const manager = new AuthManager(
      new Map([["local", provider]]),
      makeIdentityStore(),
      makeSessionStore(),
      makeCredentialStore(),
      makeTokenStore(),
      makeIdGenerator(),
    );

    const result = await manager.authenticate({
      provider: "local",
      credentials: {},
      tenantId: "tenant-1",
    });

    expect(result.status).toBe("challenge");
  });

  it("creates session on successful authentication", async () => {
    const provider = {
      id: "local",
      capabilities: ["password"],
      authenticate: vi.fn().mockResolvedValue({
        status: "authenticated",
        principal: {
          subject: "subject-1",
          tenantId: "tenant-1",
          identityId: "identity-1",
          authentication: {
            provider: "local",
            method: "password",
            authenticatedAt: new Date().toISOString(),
          },
          attributes: {},
        },
        session: {
          id: "session-1",
          identityId: "identity-1",
          tenantId: "tenant-1",
          createdAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
          attributes: {},
        },
      }),
    };

    const sessionStore = makeSessionStore();
    const manager = new AuthManager(
      new Map([["local", provider]]),
      makeIdentityStore(),
      sessionStore,
      makeCredentialStore(),
      makeTokenStore(),
      makeIdGenerator(),
    );

    const result = await manager.authenticate({
      provider: "local",
      credentials: {},
      tenantId: "tenant-1",
    });

    expect(result.status).toBe("authenticated");
    expect(sessionStore.create).toHaveBeenCalled();
  });
});
