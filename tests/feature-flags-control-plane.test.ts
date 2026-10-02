import { describe, it, expect, beforeEach } from "vitest";
import { RuntimeKernel, registerFeatureFlagsProvider, featureAsync } from "@mosaix/sdk";
import { MemoryFeatureFlagsAdapter } from "@mosaix/adapter-featureflags-memory";
import { FEATURE_FLAG_CATALOG } from "@mosaix/ports-feature-flags";
import { handleFeatureFlagRoutes } from "../src/server/routes/feature-flag-routes.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

describe("Feature Flags Central Control Plane Specification Suite", () => {
  let kernel: RuntimeKernel;
  let adapter: MemoryFeatureFlagsAdapter;

  beforeEach(() => {
    adapter = new MemoryFeatureFlagsAdapter();
    registerFeatureFlagsProvider(adapter);

    kernel = new RuntimeKernel();
    kernel.context.setService("featureFlags", adapter);
  });

  it("a. enabled features function normally through kernel capability execution", async () => {
    const manifest = {
      type: "application" as const,
      id: "solara",
      name: "Solara App",
      version: "1.0.0",
      domain: { name: "social" },
      runtime: { entrypoint: "./src/index.ts" },
      capabilities: [{ id: "solara.post.create", version: "1.0.0" }],
      permissions: [{ category: "capability", permission: "solara:solara.post.create:execute:tenant" }],
    };

    kernel.register(manifest as unknown as import("@mosaix/contracts").ApplicationManifest);
    kernel.registerCapabilityExecutor("solara.post.create", (input: unknown) => {
      return { success: true, post: input };
    });

    adapter.setFlag("apps.solara.enabled", true);
    adapter.setFlag("solara.post.create", true);

    const tenant = { organizationId: "org-1" };
    kernel.context.permissions.grant("solara:solara.post.create:execute:tenant", tenant, "caller-app");

    const result = await kernel.executeCapability("solara.post.create", "caller-app", tenant, { text: "Hello" });
    expect(result).toEqual({ success: true, post: { text: "Hello" } });
  });

  it("b. disabled features are blocked server-side in kernel capability execution", async () => {
    const manifest = {
      type: "application" as const,
      id: "commerce",
      name: "Commerce App",
      version: "1.0.0",
      domain: { name: "commerce" },
      runtime: { entrypoint: "./src/index.ts" },
      capabilities: [{ id: "commerce.checkout.v2", version: "1.0.0" }],
      permissions: [{ category: "capability", permission: "commerce:commerce.checkout.v2:execute:tenant" }],
    };

    kernel.register(manifest as unknown as import("@mosaix/contracts").ApplicationManifest);
    kernel.registerCapabilityExecutor("commerce.checkout.v2", () => ({ success: true }));

    const tenant = { organizationId: "org-1" };
    kernel.context.permissions.grant("commerce:commerce.checkout.v2:execute:tenant", tenant, "caller-app");

    // Case B1: App flag disabled
    adapter.setFlag("apps.commerce.enabled", false);
    adapter.setFlag("commerce.checkout.v2", true);

    await expect(
      kernel.executeCapability("commerce.checkout.v2", "caller-app", tenant, {})
    ).rejects.toThrow("disabled by feature flag");

    // Case B2: Capability flag disabled
    adapter.setFlag("apps.commerce.enabled", true);
    adapter.setFlag("commerce.checkout.v2", false);

    await expect(
      kernel.executeCapability("commerce.checkout.v2", "caller-app", tenant, {})
    ).rejects.toThrow("disabled by feature flag");
  });

  it("c. fallback behavior is safe when querying non-existent or uninitialized flags", async () => {
    const isEnabledDefaultTrue = await featureAsync("unknown.feature.flag", true);
    expect(isEnabledDefaultTrue).toBe(true);

    const isEnabledDefaultFalse = await featureAsync("unknown.feature.flag", false);
    expect(isEnabledDefaultFalse).toBe(false);
  });

  it("d. non-admin users cannot toggle feature flags via administrative endpoints", async () => {
    let statusCode = 0;
    let responseBody = "";

    const req = {
      method: "POST",
      headers: { "content-type": "application/json" },
      on: (event: string, cb: (chunk?: Buffer) => void) => {
        if (event === "data") cb(Buffer.from(JSON.stringify({ key: "apps.solara.enabled" })));
        if (event === "end") cb();
      },
    } as unknown as IncomingMessage;

    const res = {
      writeHead: (code: number) => {
        statusCode = code;
      },
      end: (data: string) => {
        responseBody = data;
      },
    } as unknown as ServerResponse;

    const url = new URL("http://localhost/api/feature-flags/toggle");
    const handled = await handleFeatureFlagRoutes(req, res, url, "member");

    expect(handled).toBe(true);
    expect(statusCode).toBe(403);
    expect(responseBody).toContain("Privilèges d'administration requis");
  });

  it("e. new feature flags in catalog are correctly recognized and loaded", () => {
    const catalogKeys = Object.keys(FEATURE_FLAG_CATALOG);
    expect(catalogKeys).toContain("apps.citadelle.enabled");
    expect(catalogKeys).toContain("apps.solara.enabled");
    expect(catalogKeys).toContain("apps.booking.enabled");
    expect(catalogKeys).toContain("platform.mcp.gateway_enabled");
    expect(catalogKeys).toContain("commerce.checkout.v2");
  });
});
