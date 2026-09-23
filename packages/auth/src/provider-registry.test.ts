/**
 * @mosaix/auth — ProviderRegistry tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { AuthenticationProvider } from "@mosaix/contracts";
import { ProviderRegistry } from "./provider-registry";

function provider(id: string): AuthenticationProvider {
  return {
    id,
    capabilities: [],
    authenticate: async () => ({
      status: "authenticated",
      principal: {
        subject: id,
        tenantId: "tenant-1",
        identityId: id,
        authentication: {
          provider: id,
          method: "password",
          authenticatedAt: new Date().toISOString(),
        },
        attributes: {},
      },
      session: {
        id: "session-1",
        identityId: id,
        tenantId: "tenant-1",
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        attributes: {},
      },
    }),
  };
}

describe("ProviderRegistry", () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  it("registers and retrieves a provider", () => {
    registry.register(provider("local"));
    expect(registry.get("local")).toBeDefined();
    expect(registry.get("local")!.id).toBe("local");
  });

  it("returns undefined for unknown provider", () => {
    expect(registry.get("missing")).toBeUndefined();
  });

  it("lists all registered providers", () => {
    registry.register(provider("local"));
    registry.register(provider("oidc"));
    expect(registry.list()).toHaveLength(2);
  });

  it("checks provider existence", () => {
    registry.register(provider("local"));
    expect(registry.has("local")).toBe(true);
    expect(registry.has("missing")).toBe(false);
  });

  it("clears all providers", () => {
    registry.register(provider("local"));
    registry.clear();
    expect(registry.list()).toHaveLength(0);
  });

  it("initializes with preset providers", () => {
    const preset = new ProviderRegistry({ providers: [provider("local")] });
    expect(preset.get("local")).toBeDefined();
  });

  it("getProviders returns the underlying map", () => {
    registry.register(provider("local"));
    const map = registry.getProviders();
    expect(map.get("local")).toBeDefined();
  });
});
