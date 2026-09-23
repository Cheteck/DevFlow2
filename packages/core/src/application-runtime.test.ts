import { describe, it, expect, beforeEach } from "vitest";
import { Container } from "@mosaix/container";
import type { ServiceProvider } from "@mosaix/container";
import type { ApplicationDefinition, ContextManifest } from "@mosaix/contracts";
import { ContextRegistry } from "./context-registry";
import { ApplicationCompositionResolver } from "./composition-resolver";
import { PlatformApplicationRuntime } from "./application-runtime";
import { capabilityRegistry } from "./capability";
import { runtimeLifecycleEngine } from "./component-lifecycle";

describe("MosaiX Application Runtime v1.0", () => {
  let registry: ContextRegistry;
  let resolver: ApplicationCompositionResolver;
  let runtime: PlatformApplicationRuntime;
  let container: Container;

  const mockCitadelleManifest: ContextManifest = {
    id: "@apps/citadelle",
    version: "1.0.0",
    name: "Citadelle BAC",
    provides: ["citadelle.manage"],
  };

  const mockCommerceManifest: ContextManifest = {
    id: "@apps/commerce",
    version: "1.0.0",
    name: "Commerce BAC",
    requires: [{ id: "@apps/citadelle", version: "1.0.0" }],
    provides: ["commerce.orders"],
  };

  class MockServiceProvider implements ServiceProvider {
    register(_container: Container): void {}
  }

  beforeEach(() => {
    registry = new ContextRegistry();
    resolver = new ApplicationCompositionResolver(registry);
    runtime = new PlatformApplicationRuntime(registry);
    container = new Container();
    capabilityRegistry.clear();
    runtimeLifecycleEngine.clear();
  });

  it("registers contexts in ContextRegistry", () => {
    registry.register(mockCitadelleManifest, () => new MockServiceProvider());
    expect(registry.has("@apps/citadelle")).toBe(true);
    expect(registry.list().length).toBe(1);
  });

  it("resolves application composition dependencies topologically", () => {
    registry.register(mockCitadelleManifest, () => new MockServiceProvider());
    registry.register(mockCommerceManifest, () => new MockServiceProvider());

    const appDef: ApplicationDefinition = {
      id: "test-app",
      name: "Test Platform",
      version: "1.0.0",
      contexts: [
        { id: "@apps/commerce", version: "^1.0.0" },
        { id: "@apps/citadelle", version: "^1.0.0" },
      ],
      capabilities: [{ id: "citadelle.manage" }, { id: "commerce.orders" }],
    };

    const res = resolver.resolve(appDef);
    expect(res.valid).toBe(true);
    // Citadelle must come before Commerce because Commerce requires Citadelle
    expect(res.executionOrder.map((m) => m.id)).toEqual(["@apps/citadelle", "@apps/commerce"]);
  });

  it("boots application and transitions lifecycle states", async () => {
    registry.register(mockCitadelleManifest, () => new MockServiceProvider());
    registry.register(mockCommerceManifest, () => new MockServiceProvider());

    const appDef: ApplicationDefinition = {
      id: "marketplace-platform",
      name: "Marketplace Platform",
      version: "1.0.0",
      contexts: [
        { id: "@apps/citadelle", version: "^1.0.0" },
        { id: "@apps/commerce", version: "^1.0.0" },
      ],
      capabilities: [{ id: "citadelle.manage" }, { id: "commerce.orders" }],
    };

    const result = await runtime.bootApplication(appDef, container);
    expect(result.success).toBe(true);
    expect(result.bootedContexts).toEqual(["@apps/citadelle", "@apps/commerce"]);

    // Verify Capabilities registered
    expect(capabilityRegistry.has("citadelle.manage")).toBe(true);
    expect(capabilityRegistry.has("commerce.orders")).toBe(true);

    // Verify Lifecycle states
    const citadelleComp = runtimeLifecycleEngine.getComponent("@apps/citadelle");
    expect(citadelleComp?.state).toBe("ACTIVE");
  });

  it("fails resolution when required capability is missing", () => {
    registry.register(mockCitadelleManifest, () => new MockServiceProvider());

    const appDef: ApplicationDefinition = {
      id: "broken-app",
      name: "Broken App",
      version: "1.0.0",
      contexts: [{ id: "@apps/citadelle", version: "^1.0.0" }],
      capabilities: [{ id: "missing.capability" }],
    };

    const res = resolver.resolve(appDef);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain("Application requires capability [missing.capability]");
  });
});
