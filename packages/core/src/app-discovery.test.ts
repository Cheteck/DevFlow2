import { describe, it, expect } from "vitest";
import { ApplicationDiscovery } from "./app-discovery";

describe("ApplicationDiscovery (Phase 2.3)", () => {
  const validManifest = {
    type: "application",
    id: "portfolio",
    name: "Portfolio BAC",
    version: "1.0.0",
    metadata: { name: "Portfolio" },
    domain: { events: ["portfolio.vendable.created"] },
    runtime: { entrypoint: "/main.js", isolation: "sandbox" },
    routes: [{ path: "/vendables", method: "GET" }],
    ui: { slots: ["platform.sidebar"] },
    database: { connection: "primary", schema: "portfolio" },
  };

  it("registers valid manifests and discovers them", () => {
    const discovery = new ApplicationDiscovery();
    const entry = discovery.registerDiscovered("apps/portfolio", validManifest);

    expect(entry.manifest.id).toBe("portfolio");
    expect(discovery.listDiscovered()).toHaveLength(1);
    expect(discovery.getDiscovered("portfolio")).toBeDefined();
  });

  it("rejects duplicate application IDs", () => {
    const discovery = new ApplicationDiscovery();
    discovery.registerDiscovered("apps/portfolio", validManifest);

    expect(() =>
      discovery.registerDiscovered("apps/portfolio-dup", validManifest),
    ).toThrow(/Duplicate application ID/);
  });

  it("rejects invalid manifests lacking required fields", () => {
    const discovery = new ApplicationDiscovery();
    expect(() =>
      discovery.registerDiscovered("apps/invalid", { id: "bad" }),
    ).toThrow(/Invalid manifest/);
  });
});
