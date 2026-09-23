/**
 * @mosaix/adapter-auth-local — LocalPasswordProvider tests.
 */

import { describe, it, expect, vi } from "vitest";
import type {
  CredentialStore,
  IdentityStore,
  SecretsPort,
} from "@mosaix/contracts";
import type { SessionCreationPort } from "@mosaix/ports-session-creation";
import { LocalPasswordProvider } from "./index";

function makeIdentityStore(
  overrides: Partial<IdentityStore> = {},
): IdentityStore {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByExternalIdentity: vi.fn(),
    findByEmail: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    linkExternalIdentity: vi.fn(),
    unlinkExternalIdentity: vi.fn(),
    ...overrides,
  } as unknown as IdentityStore;
}

function makeCredentialStore(
  overrides: Partial<CredentialStore> = {},
): CredentialStore {
  return {
    get: vi.fn().mockResolvedValue(null),
    save: vi.fn(),
    revoke: vi.fn(),
    revokeAllForIdentity: vi.fn(),
    ...overrides,
  } as unknown as CredentialStore;
}

function makeSecretsPort(overrides: Partial<SecretsPort> = {}): SecretsPort {
  return {
    getSecret: vi.fn().mockResolvedValue(undefined),
    getRequiredSecret: vi.fn().mockResolvedValue("pepper"),
    ...overrides,
  } as unknown as SecretsPort;
}

function makeSessionCreation(
  overrides: Partial<SessionCreationPort> = {},
): SessionCreationPort {
  return {
    createSession: vi.fn().mockResolvedValue({
      id: "session-1",
      identityId: "identity-1",
      tenantId: "tenant-1",
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      attributes: {},
    }),
    ...overrides,
  } as unknown as SessionCreationPort;
}

describe("LocalPasswordProvider", () => {
  it("returns failed when email is missing", async () => {
    const provider = new LocalPasswordProvider({
      credentialStore: makeCredentialStore(),
      identityStore: makeIdentityStore(),
      secrets: makeSecretsPort(),
      sessionCreation: makeSessionCreation(),
    });

    const result = await provider.authenticate({
      provider: "local",
      credentials: { password: "password" },
      tenantId: "tenant-1",
    });

    expect(result.status).toBe("failed");
    expect(
      (result as { status: string; error: { code: string } }).error.code,
    ).toBe("invalid_request");
  });

  it("returns failed when password is missing", async () => {
    const provider = new LocalPasswordProvider({
      credentialStore: makeCredentialStore(),
      identityStore: makeIdentityStore(),
      secrets: makeSecretsPort(),
      sessionCreation: makeSessionCreation(),
    });

    const result = await provider.authenticate({
      provider: "local",
      credentials: { email: "ada@example.com" },
      tenantId: "tenant-1",
    });

    expect(result.status).toBe("failed");
    expect(
      (result as { status: string; error: { code: string } }).error.code,
    ).toBe("invalid_request");
  });

  it("returns failed when identity is not found", async () => {
    const provider = new LocalPasswordProvider({
      credentialStore: makeCredentialStore(),
      identityStore: makeIdentityStore(),
      secrets: makeSecretsPort(),
      sessionCreation: makeSessionCreation(),
    });

    const result = await provider.authenticate({
      provider: "local",
      credentials: { email: "ada@example.com", password: "password" },
      tenantId: "tenant-1",
    });

    expect(result.status).toBe("failed");
    expect(
      (result as { status: string; error: { code: string } }).error.code,
    ).toBe("invalid_credentials");
  });

  it("returns failed when account is disabled", async () => {
    const provider = new LocalPasswordProvider({
      credentialStore: makeCredentialStore(),
      identityStore: makeIdentityStore({
        findByEmail: vi.fn().mockResolvedValue({
          id: "identity-1",
          tenantId: "tenant-1",
          status: "disabled",
          externalIdentities: [],
          attributes: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      }),
      secrets: makeSecretsPort(),
      sessionCreation: makeSessionCreation(),
    });

    const result = await provider.authenticate({
      provider: "local",
      credentials: { email: "ada@example.com", password: "password" },
      tenantId: "tenant-1",
    });

    expect(result.status).toBe("failed");
    expect(
      (result as { status: string; error: { code: string } }).error.code,
    ).toBe("account_disabled");
  });

  it("returns failed when no password credential exists", async () => {
    const provider = new LocalPasswordProvider({
      credentialStore: makeCredentialStore(),
      identityStore: makeIdentityStore({
        findByEmail: vi.fn().mockResolvedValue({
          id: "identity-1",
          tenantId: "tenant-1",
          status: "active",
          externalIdentities: [],
          attributes: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      }),
      secrets: makeSecretsPort(),
      sessionCreation: makeSessionCreation(),
    });

    const result = await provider.authenticate({
      provider: "local",
      credentials: { email: "ada@example.com", password: "password" },
      tenantId: "tenant-1",
    });

    expect(result.status).toBe("failed");
    expect(
      (result as { status: string; error: { code: string } }).error.code,
    ).toBe("no_password");
  });

  it("returns failed for wrong password", async () => {
    const provider = new LocalPasswordProvider({
      credentialStore: makeCredentialStore({
        get: vi.fn().mockResolvedValue({
          id: "cred-1",
          identityId: "identity-1",
          type: "password",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          data: { salt: "salt", hash: "wrong_hash" },
        }),
      }),
      identityStore: makeIdentityStore({
        findById: vi.fn().mockResolvedValue({
          id: "identity-1",
          tenantId: "tenant-1",
          status: "active",
          externalIdentities: [],
          attributes: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      }),
      secrets: makeSecretsPort(),
      sessionCreation: makeSessionCreation(),
    });

    const result = await provider.authenticate({
      provider: "local",
      credentials: { email: "ada@example.com", password: "password" },
      tenantId: "tenant-1",
    });

    expect(result.status).toBe("failed");
    expect(
      (result as { status: string; error: { code: string } }).error.code,
    ).toBe("invalid_credentials");
  });
});
