import { describe, it, expect } from "vitest";
import { ProductionBuildCompiler } from "./build-compiler";
import type { ApplicationManifest } from "@mosaix/contracts";

describe("ProductionBuildCompiler (Phase 9)", () => {
  it("synthesizes production bundle manifest", () => {
    const app: ApplicationManifest = {
      type: "application",
      id: "portfolio",
      name: "Portfolio BAC",
      version: "1.0.0",
      metadata: { name: "Portfolio" },
      domain: { events: [] },
      runtime: { entrypoint: "/main.js", isolation: "sandbox" },
    };

    const bundle = ProductionBuildCompiler.synthesizeManifest([app]);

    expect(bundle.platformVersion).toBe("1.0.0");
    expect(bundle.applications).toHaveLength(1);
    expect(bundle.applications[0]?.id).toBe("portfolio");
  });
});
