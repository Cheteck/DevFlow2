import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { MosaixFolderManager } from "./index.js";

describe("@mosaix/cli (MosaixFolderManager)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mosaix-cli-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should create complete .mosaix folder structure", () => {
    const manager = new MosaixFolderManager(tempDir);
    const struct = manager.ensureFolderStructure();

    expect(fs.existsSync(struct.root)).toBe(true);
    expect(fs.existsSync(struct.cacheDir.root)).toBe(true);
    expect(fs.existsSync(struct.buildDir.root)).toBe(true);
    expect(fs.existsSync(struct.manifestsDir.root)).toBe(true);
    expect(fs.existsSync(struct.themesDir)).toBe(true);
    expect(fs.existsSync(struct.standaloneDir.root)).toBe(true);
    expect(fs.existsSync(struct.logsDir)).toBe(true);
  });

  it("should synthesize manifests into .mosaix/manifests", () => {
    const manager = new MosaixFolderManager(tempDir);
    manager.synthesizeManifests({
      applications: {
        identity: { id: "identity", version: "1.0.0" },
        portfolio: { id: "portfolio", version: "0.1.0" },
      },
    });

    const info = manager.inspect();
    expect(info.status).toBe("built");
    expect(info.mosaixFolderExists).toBe(true);

    const struct = manager.getStructure();
    expect(
      fs.existsSync(path.join(struct.manifestsDir.root, "aggregated-manifest.json")),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(struct.manifestsDir.root, "capabilities-registry.json"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(struct.manifestsDir.root, "events-registry.json")),
    ).toBe(true);
  });

  it("should generate standalone production bundle", () => {
    const manager = new MosaixFolderManager(tempDir);
    manager.generateStandaloneBundle();

    const struct = manager.getStructure();
    expect(fs.existsSync(path.join(struct.standaloneDir.root, "server.js"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(struct.standaloneDir.root, "package.json"))).toBe(
      true,
    );
  });

  it("should clean .mosaix directory", () => {
    const manager = new MosaixFolderManager(tempDir);
    manager.ensureFolderStructure();
    const struct = manager.getStructure();
    expect(fs.existsSync(struct.root)).toBe(true);

    manager.clean();
    expect(fs.existsSync(struct.root)).toBe(false);
  });
});
