import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { AppConformanceValidator } from "./index";

describe("MOSAIX-APP Conformance Validator Suite", () => {
  it("validates a single valid application manifest", () => {
    const validManifest = {
      type: "application",
      id: "identity",
      name: "Identity Bounded Context",
      version: "1.0.0",
      domain: { name: "identity" },
      runtime: { entrypoint: "./src/start.ts" },
      capabilities: [{ id: "identity.user.create", version: "1.0.0" }],
      permissions: ["identity:user:create:tenant"],
      events: ["identity.user.created"],
    };

    const result = AppConformanceValidator.validate(validManifest);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("rejects an invalid application manifest missing required properties", () => {
    const invalidManifest = {
      type: "invalid-type",
      id: 123,
    };

    const result = AppConformanceValidator.validate(invalidManifest);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes("Property 'type' must be 'application'"))).toBe(true);
  });

  it("validates all 10 workspace Bounded Applications in apps/", () => {
    const results = AppConformanceValidator.validateAllWorkspaceApps("apps");

    expect(Object.keys(results).length).toBe(10);
    expect(results["citadelle"]?.valid).toBe(true);
    expect(results["portfolio"]?.valid).toBe(true);
    expect(results["commerce"]?.valid).toBe(true);
    expect(results["imperia"]?.valid).toBe(true);
    expect(results["spaces"]?.valid).toBe(true);
    expect(results["solara"]?.valid).toBe(true);
    expect(results["beam"]?.valid).toBe(true);
    expect(results["solidarity"]?.valid).toBe(true);
    expect(results["booking"]?.valid).toBe(true);
    expect(results["subscription"]?.valid).toBe(true);
  });

  it("validates apps from a fixture directory in a cwd-independent manner", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mosaix-conformance-apps-"));
    const dummyAppDir = path.join(tmpDir, "dummyapp");
    fs.mkdirSync(path.join(dummyAppDir, "src"), { recursive: true });

    const manifest = {
      type: "application",
      id: "dummyapp",
      name: "Dummy App",
      version: "1.0.0",
      domain: { name: "dummy" },
      runtime: { entrypoint: "./src/index.ts" },
      capabilities: [],
      permissions: [],
      events: [],
    };
    fs.writeFileSync(path.join(dummyAppDir, "mosaix.json"), JSON.stringify(manifest), "utf-8");
    fs.writeFileSync(path.join(dummyAppDir, "src", "index.ts"), "export const a = 1;\n", "utf-8");

    const results = AppConformanceValidator.validateAllWorkspaceApps(tmpDir);
    expect(Object.keys(results)).toContain("dummyapp");
    expect(results["dummyapp"]?.valid).toBe(true);
  });
});
