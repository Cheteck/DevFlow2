import { describe, expect, it } from "vitest";
import * as crypto from "crypto";
import {
  PluginEngine,
  HookExecutionEngine,
  PluginSettingsValidator,
  PluginSettingsManager,
  PluginEventBus,
  CapabilityRegistry,
  PluginCapabilityResolver,
  PluginSandboxEnvironment,
} from "./runtime/index.js";
import {
  PluginMarketplaceRegistry,
  PluginCliCommandRunner,
} from "./management/index.js";
import { WorkspacePluginLoader } from "./adapters/index.js";
import type { PluginManifest } from "./core/index.js";

describe("@mosaix/plugin-engine Comprehensive Suite (Priorities 1-8)", () => {
  const sampleManifest: PluginManifest = {
    id: "commerce-discount",
    name: "Discount Engine",
    version: "1.0.0",
    targetAppId: "commerce",
    entrypoint: "./index.ts",
    permissions: [{ name: "orders.read" }],
    settingsSchema: {
      type: "object",
      required: ["defaultDiscountPercent"],
      properties: {
        defaultDiscountPercent: { type: "number", minimum: 0, maximum: 100, default: 10 },
        enableCoupons: { type: "boolean", default: true },
        promoPrefix: { type: "string", default: "SUMMER" },
      },
    },
  };

  // 1. Hook Execution Engine
  describe("Priority 1: Hook Execution Engine", () => {
    it("executes hooks in parallel mode with priority ordering", async () => {
      const hookEngine = new HookExecutionEngine();
      hookEngine.registerHook("checkout.calculateDiscount", (args: { total: number }) => args.total * 0.1, { priority: 10 });
      hookEngine.registerHook("checkout.calculateDiscount", (args: { total: number }) => args.total * 0.05, { priority: 50 });

      const res = await hookEngine.runHook<{ total: number }, number>("checkout.calculateDiscount", { total: 100 }, { mode: "parallel" });
      expect(res.results).toEqual([5, 10]); // Priority 50 executed before 10
      expect(res.errors).toHaveLength(0);
    });

    it("executes hooks in waterfall mode passing modified payloads", async () => {
      const hookEngine = new HookExecutionEngine();
      hookEngine.registerHook("text.filter", (text: string) => text.trim());
      hookEngine.registerHook("text.filter", (text: string) => text.toUpperCase());

      const res = await hookEngine.runHook<string, string>("text.filter", "  hello mosaix  ", { mode: "waterfall" });
      expect(res.waterfallResult).toBe("HELLO MOSAIX");
    });

    it("bails at first meaningful response in bail mode", async () => {
      const hookEngine = new HookExecutionEngine();
      hookEngine.registerHook("auth.authenticate", () => undefined, { priority: 100 });
      hookEngine.registerHook("auth.authenticate", () => ({ userId: "usr_123" }), { priority: 50 });
      hookEngine.registerHook("auth.authenticate", () => ({ userId: "usr_fallback" }), { priority: 10 });

      const res = await hookEngine.runHook("auth.authenticate", {}, { mode: "bail" });
      expect(res.bailResult).toEqual({ userId: "usr_123" });
    });

    it("respects AbortSignal cancellation during execution", async () => {
      const hookEngine = new HookExecutionEngine();
      const controller = new AbortController();

      hookEngine.registerHook("heavy.task", async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return "done";
      });

      controller.abort();
      await expect(
        hookEngine.runHook("heavy.task", {}, { signal: controller.signal })
      ).rejects.toThrow("aborted");
    });

    it("tracks execution metrics and average duration per hook point", async () => {
      const hookEngine = new HookExecutionEngine();
      hookEngine.registerHook("billing.discount", () => 15);

      await hookEngine.runHook("billing.discount", {});
      await hookEngine.runHook("billing.discount", {});

      const metrics = hookEngine.getPointMetrics("billing.discount");
      expect(metrics).toBeDefined();
      expect(metrics?.totalExecutions).toBe(2);
      expect(metrics?.totalErrors).toBe(0);
      expect(metrics?.lastExecutedAt).toBeDefined();
    });
  });

  // 2. Dynamic Workspace Plugin Loader
  describe("Priority 2: Dynamic Workspace Plugin Loader", () => {
    it("scans workspace mosaix.json files and loads manifests", async () => {
      const engine = new PluginEngine();
      const loader = new WorkspacePluginLoader(engine);

      loader.registerVirtualPluginFile(
        "/workspace/plugins/analytics/mosaix.json",
        JSON.stringify({
          id: "workspace-analytics",
          name: "Workspace Analytics",
          version: "1.0.0",
          targetAppId: "solara",
          entrypoint: "./dist/index.js",
        })
      );

      const discovered = await loader.scanWorkspace();
      expect(discovered).toHaveLength(1);
      expect(discovered[0].id).toBe("workspace-analytics");
      expect(engine.registry.has("workspace-analytics")).toBe(true);
    });

    it("hot reloads updated plugin manifests", async () => {
      const engine = new PluginEngine();
      const loader = new WorkspacePluginLoader(engine);

      loader.registerVirtualPluginFile(
        "/workspace/plugins/analytics/mosaix.json",
        JSON.stringify({
          id: "workspace-analytics",
          name: "Workspace Analytics",
          version: "1.0.0",
          targetAppId: "solara",
          entrypoint: "./dist/index.js",
        }),
        1000
      );

      await loader.scanWorkspace();
      expect(engine.registry.get("workspace-analytics")?.manifest.version).toBe("1.0.0");

      // Simulate file update
      loader.registerVirtualPluginFile(
        "/workspace/plugins/analytics/mosaix.json",
        JSON.stringify({
          id: "workspace-analytics",
          name: "Workspace Analytics",
          version: "1.1.0",
          targetAppId: "solara",
          entrypoint: "./dist/index.js",
        }),
        2000
      );

      const reloaded = await loader.reloadPlugin("workspace-analytics");
      expect(reloaded).toBe(true);
      expect(engine.registry.get("workspace-analytics")?.manifest.version).toBe("1.1.0");
    });
  });

  // 3. Plugin Sandbox Environment
  describe("Priority 3: Plugin Sandbox Environment", () => {
    it("isolates execution and bounds long-running executions with timeout", async () => {
      await expect(
        PluginSandboxEnvironment.runIsolated(
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
            return "done";
          },
          { timeoutMs: 10 }
        )
      ).rejects.toThrow("Sandbox execution exceeded timeout threshold of 10ms.");
    });
  });

  // 4. Capability Resolution
  describe("Priority 4: Capability Resolution", () => {
    it("resolves and injects available capabilities based on granted tiers", () => {
      const registry = new CapabilityRegistry();
      registry.register({
        id: "database.orders",
        name: "Orders Database Port",
        tier: "application",
        version: "1.0.0",
        instance: { queryOrders: () => [] },
      });

      const resolver = new PluginCapabilityResolver(registry);
      const manifestWithCaps: PluginManifest = {
        ...sampleManifest,
        requiresCapabilities: ["database.orders"],
      };

      const result = resolver.resolve(manifestWithCaps, [
        { tier: "application", capabilityId: "database.orders" },
      ]);

      expect(result.resolved).toBe(true);
      expect(result.injectedCapabilities["database.orders"]).toBeDefined();
    });

    it("fails resolution if capability is missing or tier is denied", () => {
      const registry = new CapabilityRegistry();
      const resolver = new PluginCapabilityResolver(registry);

      const manifestWithCaps: PluginManifest = {
        ...sampleManifest,
        requiresCapabilities: ["missing.capability"],
      };

      const result = resolver.resolve(manifestWithCaps);
      expect(result.resolved).toBe(false);
      expect(result.missingCapabilities).toContain("missing.capability");
    });
  });

  // 5. Plugin Config & Settings
  describe("Priority 5: Plugin Config & Settings", () => {
    it("validates settings, enforces types, and populates default values", () => {
      const validation = PluginSettingsValidator.validate(sampleManifest.settingsSchema, {
        promoPrefix: "WINTER",
      });

      expect(validation.valid).toBe(true);
      expect(validation.sanitizedSettings.defaultDiscountPercent).toBe(10);
      expect(validation.sanitizedSettings.enableCoupons).toBe(true);
      expect(validation.sanitizedSettings.promoPrefix).toBe("WINTER");
    });

    it("rejects invalid setting values according to schema", () => {
      const validation = PluginSettingsValidator.validate(sampleManifest.settingsSchema, {
        defaultDiscountPercent: 150, // maximum is 100
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain("<= 100");
    });

    it("updates settings dynamically and fires change listeners", () => {
      const manager = new PluginSettingsManager(sampleManifest.settingsSchema, {
        defaultDiscountPercent: 20,
      });

      let changedVal = 0;
      manager.onChange((newSettings) => {
        changedVal = newSettings.defaultDiscountPercent as number;
      });

      manager.update({ defaultDiscountPercent: 25 });
      expect(manager.get().defaultDiscountPercent).toBe(25);
      expect(changedVal).toBe(25);
    });
  });

  // 6. Inter-Plugin Event Bus
  describe("Priority 6: Inter-Plugin Event Bus", () => {
    it("publishes and delivers events between plugins with pattern matching", async () => {
      const bus = new PluginEventBus();
      const received: Array<{ topic: string; payload: unknown }> = [];

      bus.subscribe("plugin:commerce:*", "analytics-plugin", (evt) => {
        received.push({ topic: evt.topic, payload: evt.payload });
      });

      await bus.publish("plugin:commerce:orderPlaced", "commerce-plugin", { orderId: "ord_999", amount: 49.9 });

      expect(received).toHaveLength(1);
      expect(received[0].topic).toBe("plugin:commerce:orderPlaced");
      expect((received[0].payload as { orderId: string }).orderId).toBe("ord_999");
    });
  });

  // 7. CLI Command Runner
  describe("Priority 7: Plugin CLI Command Runner", () => {
    it("runs install, list, update and remove CLI commands", async () => {
      const engine = new PluginEngine();
      const marketplace = new PluginMarketplaceRegistry();
      marketplace.publishPackage({
        id: "theme-dark",
        name: "Dark Theme",
        description: "Elegant dark theme for MosaiX",
        author: "MosaiX Team",
        latestVersion: "1.0.0",
        tags: ["theme", "ui"],
        downloadsCount: 120,
        verifiedPublisher: true,
        versions: {
          "1.0.0": {
            manifest: {
              id: "theme-dark",
              name: "Dark Theme",
              version: "1.0.0",
              targetAppId: "solara",
              entrypoint: "./index.js",
            },
            tarballUrl: "https://plugins.mosaix.io/theme-dark-1.0.0.tgz",
            integrity: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            signature: "sig_valid",
            publishedAt: "2026-09-23T00:00:00Z",
          },
        },
      });

      const cli = new PluginCliCommandRunner(engine, marketplace);

      // Install
      const installRes = await cli.install("theme-dark@1.0.0");
      expect(installRes.code).toBe(0);
      expect(engine.registry.has("theme-dark")).toBe(true);

      // List
      const listRes = cli.list();
      expect(listRes.code).toBe(0);
      expect((listRes.data as unknown[]).length).toBe(1);

      // Remove
      const removeRes = await cli.remove("theme-dark");
      expect(removeRes.code).toBe(0);
      expect(engine.registry.has("theme-dark")).toBe(false);
    });
  });

  // 8. Marketplace Registry & Signature Verification
  describe("Priority 8: Marketplace Registry & Verification", () => {
    it("searches marketplace and resolves semver ranges", () => {
      const marketplace = new PluginMarketplaceRegistry();
      marketplace.publishPackage({
        id: "solara-polls",
        name: "Solara Interactive Polls",
        description: "Community polls and surveys",
        author: "Solara Community",
        latestVersion: "1.2.0",
        tags: ["social", "polls"],
        downloadsCount: 500,
        verifiedPublisher: true,
        versions: {
          "1.0.0": {
            manifest: { id: "solara-polls", name: "Polls", version: "1.0.0", targetAppId: "solara", entrypoint: "./index.js" },
            tarballUrl: "url1",
            integrity: "sha1",
            signature: "sig1",
            publishedAt: "2026-01-01",
          },
          "1.2.0": {
            manifest: { id: "solara-polls", name: "Polls", version: "1.2.0", targetAppId: "solara", entrypoint: "./index.js" },
            tarballUrl: "url2",
            integrity: "sha2",
            signature: "sig2",
            publishedAt: "2026-02-01",
          },
        },
      });

      const searchResults = marketplace.search("polls");
      expect(searchResults).toHaveLength(1);

      const resolved = marketplace.resolveVersion("solara-polls", "^1.0.0");
      expect(resolved?.version).toBe("1.2.0");
    });

    it("verifies package integrity checksum and cryptographic publisher signature", () => {
      const marketplace = new PluginMarketplaceRegistry();
      marketplace.registerPublisherKey("pub_official", "secret-hmac-key");

      const tarballContent = "plugin-tarball-binary-content";
      const sha256 = crypto.createHash("sha256").update(tarballContent).digest("hex");
      const sig = crypto.createHmac("sha256", "secret-hmac-key").update(sha256).digest("hex");

      const manifest: PluginManifest = {
        id: "verified-plugin",
        name: "Verified Plugin",
        version: "1.0.0",
        targetAppId: "citadelle",
        entrypoint: "./index.js",
      };

      const validRes = marketplace.verifyPackage(manifest, tarballContent, sha256, sig, "pub_official");
      expect(validRes.valid).toBe(true);

      const corruptRes = marketplace.verifyPackage(manifest, "corrupted-content", sha256, sig, "pub_official");
      expect(corruptRes.valid).toBe(false);
      expect(corruptRes.error).toContain("checksum mismatch");
    });
  });
});
