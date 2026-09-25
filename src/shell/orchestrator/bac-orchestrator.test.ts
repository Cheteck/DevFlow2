import { describe, it, expect } from "vitest";
import { BacOrchestrator } from "./bac-orchestrator.js";
import type { BacDescriptor, PlatformSettings } from "@mosaix/contracts";

describe("BacOrchestrator", () => {
  it("resolves the default BAC configured in platform settings", async () => {
    const orchestrator = new BacOrchestrator();

    const mockSolara: BacDescriptor = {
      id: "solara",
      name: "Solara Social",
      version: "1.0.0",
      routePrefix: "/solara",
      icon: "☀️",
      isEnabled: true,
      async isAvailable() {
        return true;
      },
      async render() {
        return { contentHtml: "<div>Solara Feed</div>", pageTitle: "Solara" };
      },
    };
    orchestrator.register(mockSolara);

    const settings: PlatformSettings = {
      defaultBacId: "solara",
      fallbackBacId: "citadelle",
      platformName: "MosaiX",
      maintenanceMode: false,
      allowedRolesInMaintenance: ["admin"],
      unauthenticatedStrategy: "redirect_login",
      authBacId: "citadelle",
    };

    const resolved = await orchestrator.resolveDefaultBac(settings, ["solara", "commerce"]);
    expect(resolved).not.toBeNull();
    expect(resolved?.descriptor.id).toBe("solara");
    expect(resolved?.isFallback).toBe(false);
  });

  it("dynamically resolves an alternative default BAC without changing shell code", async () => {
    const orchestrator = new BacOrchestrator();

    const mockPortfolio: BacDescriptor = {
      id: "portfolio",
      name: "Portfolio PIM",
      version: "1.0.0",
      routePrefix: "/portfolio",
      icon: "🎨",
      isEnabled: true,
      async isAvailable() {
        return true;
      },
      async render() {
        return { contentHtml: "<div>Catalog</div>", pageTitle: "Portfolio" };
      },
    };
    orchestrator.register(mockPortfolio);

    // Platform configured to use Portfolio as default BAC instead of Solara
    const settings: PlatformSettings = {
      defaultBacId: "portfolio",
      fallbackBacId: "citadelle",
      platformName: "Catalog Platform",
      maintenanceMode: false,
      allowedRolesInMaintenance: ["admin"],
      unauthenticatedStrategy: "redirect_login",
      authBacId: "citadelle",
    };

    const resolved = await orchestrator.resolveDefaultBac(settings, ["portfolio", "solara"]);
    expect(resolved).not.toBeNull();
    expect(resolved?.descriptor.id).toBe("portfolio");
    expect(resolved?.isFallback).toBe(false);
  });

  it("falls back gracefully when the user lacks authorization for the default BAC", async () => {
    const orchestrator = new BacOrchestrator();

    const mockSolara: BacDescriptor = {
      id: "solara",
      name: "Solara Social",
      version: "1.0.0",
      routePrefix: "/solara",
      icon: "☀️",
      isEnabled: true,
      async isAvailable() {
        return true;
      },
      async render() {
        return { contentHtml: "<div>Solara Feed</div>" };
      },
    };
    const mockCommerce: BacDescriptor = {
      id: "commerce",
      name: "Commerce",
      version: "1.0.0",
      routePrefix: "/commerce",
      icon: "🛒",
      isEnabled: true,
      async isAvailable() {
        return true;
      },
      async render() {
        return { contentHtml: "<div>Store</div>" };
      },
    };

    orchestrator.register(mockSolara);
    orchestrator.register(mockCommerce);

    const settings: PlatformSettings = {
      defaultBacId: "solara",
      fallbackBacId: "commerce",
      platformName: "MosaiX",
      maintenanceMode: false,
      allowedRolesInMaintenance: ["admin"],
      unauthenticatedStrategy: "redirect_login",
      authBacId: "citadelle",
    };

    // User only has permission to 'commerce', not 'solara'
    const resolved = await orchestrator.resolveDefaultBac(settings, ["commerce"]);
    expect(resolved).not.toBeNull();
    expect(resolved?.descriptor.id).toBe("commerce");
    expect(resolved?.isFallback).toBe(true);
  });

  it("handles render errors with the built-in Error Boundary", async () => {
    const orchestrator = new BacOrchestrator();

    const crashingBac: BacDescriptor = {
      id: "crashing-bac",
      name: "Crashing BAC",
      version: "1.0.0",
      routePrefix: "/crash",
      icon: "💥",
      isEnabled: true,
      async isAvailable() {
        return true;
      },
      async render() {
        throw new Error("Internal crash in BAC rendering pipeline");
      },
    };
    orchestrator.register(crashingBac);

    const result = await orchestrator.renderBac("crashing-bac", {
      tenantId: "default",
      spaceId: null,
      user: { id: "u-1", roles: ["member"], permissions: [] },
      theme: { mode: "dark" },
      request: { path: "/crash", query: {}, headers: {} },
    });

    expect(result.contentHtml).toContain("Erreur d'Exécution du Module Crashing BAC");
    expect(result.contentHtml).toContain("Internal crash in BAC rendering pipeline");
    expect(result.pageTitle).toContain("Erreur");
  });
});
