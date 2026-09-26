import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  MosaixFolderManager,
  PackageDiscoverer,
  ProductionBuildCompiler,
  MosaixCommandRouter,
  EXIT_CODES,
} from "../src/index.js";

describe("MosaiX CLI PRD Specification Suite", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mosaix-cli-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe("MosaixFolderManager (.mosaix workspace structure)", () => {
    it("should generate the full PRD .mosaix folder structure", () => {
      const manager = new MosaixFolderManager(tmpDir);
      const struct = manager.ensureFolderStructure();

      expect(fs.existsSync(struct.root)).toBe(true);
      expect(fs.existsSync(struct.buildDir.root)).toBe(true);
      expect(fs.existsSync(struct.buildDir.client)).toBe(true);
      expect(fs.existsSync(struct.buildDir.server)).toBe(true);
      expect(fs.existsSync(struct.buildDir.shared)).toBe(true);
      expect(fs.existsSync(struct.cacheDir.root)).toBe(true);
      expect(fs.existsSync(struct.diagnosticsDir.root)).toBe(true);
      expect(fs.existsSync(struct.manifestsDir.root)).toBe(true);
      expect(fs.existsSync(struct.routesDir.root)).toBe(true);
      expect(fs.existsSync(struct.runtimeDir.root)).toBe(true);
      expect(fs.existsSync(struct.standaloneDir.root)).toBe(true);
      expect(fs.existsSync(struct.staticDir)).toBe(true);
      expect(fs.existsSync(struct.tracesDir.root)).toBe(true);
    });

    it("should synthesize manifests and build artifacts into .mosaix", () => {
      const manager = new MosaixFolderManager(tmpDir);
      const struct = manager.synthesizeManifests({
        applications: { identity: { id: "identity" } },
        capabilities: [{ name: "auth:login" }],
        events: [{ name: "user:created" }],
      });

      expect(fs.existsSync(struct.buildIdFile)).toBe(true);
      expect(fs.existsSync(struct.manifestsDir.applicationsJson)).toBe(true);
      expect(fs.existsSync(struct.manifestsDir.capabilitiesJson)).toBe(true);
      expect(fs.existsSync(struct.manifestsDir.eventsJson)).toBe(true);
      expect(fs.existsSync(struct.manifestsDir.aggregatedJson)).toBe(true);
      expect(fs.existsSync(struct.diagnosticsDir.buildJson)).toBe(true);
      expect(fs.existsSync(struct.tracesDir.dependenciesJson)).toBe(true);

      const buildId = fs.readFileSync(struct.buildIdFile, "utf8");
      expect(buildId.startsWith("build_")).toBe(true);
    });

    it("should cleanly remove .mosaix folder when clean() is called", () => {
      const manager = new MosaixFolderManager(tmpDir);
      manager.ensureFolderStructure();
      const mosaixPath = path.join(tmpDir, ".mosaix");
      expect(fs.existsSync(mosaixPath)).toBe(true);

      manager.clean();
      expect(fs.existsSync(mosaixPath)).toBe(false);
    });

    it("should return built inspection state after manifest synthesis", () => {
      const manager = new MosaixFolderManager(tmpDir);
      expect(manager.inspect().status).toBe("not_built");

      manager.synthesizeManifests({
        applications: { portfolio: { id: "portfolio" } },
      });
      const info = manager.inspect();
      expect(info.status).toBe("built");
      expect(info.mosaixFolderExists).toBe(true);
      expect(info.buildId).toBeDefined();
    });
  });

  describe("PackageDiscoverer", () => {
    it("should discover packages with mosaix provider declarations in workspace", () => {
      const pkgDir = path.join(tmpDir, "packages", "custom-pkg");
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(
        path.join(pkgDir, "package.json"),
        JSON.stringify({
          name: "@mosaix/custom-pkg",
          version: "1.2.0",
          mosaix: {
            provider: "./dist/provider.js",
            capabilities: ["custom:cap"],
            events: ["custom:event"],
            commands: ["custom:status"],
          },
        }),
        "utf8",
      );

      const discoverer = new PackageDiscoverer(tmpDir);
      const pkgs = discoverer.discover();

      expect(pkgs.length).toBeGreaterThanOrEqual(1);
      const found = pkgs.find((p) => p.name === "@mosaix/custom-pkg");
      expect(found).toBeDefined();
      expect(found?.version).toBe("1.2.0");
      expect(found?.capabilities).toContain("custom:cap");
      expect(found?.cliCommands).toContain("custom:status");
    });
  });

  describe("ProductionBuildCompiler", () => {
    it("should compile production bundle and output standalone files", () => {
      const compiler = new ProductionBuildCompiler(tmpDir);
      const manifest = compiler.compile([
        {
          id: "identity",
          name: "Identity BAC",
          version: "1.0.0",
          entryPoint: "src/index.ts",
        },
      ]);

      expect(manifest.platformVersion).toBe("1.0.0");
      expect(manifest.applications.length).toBe(1);

      const manager = new MosaixFolderManager(tmpDir);
      const struct = manager.getStructure();
      expect(fs.existsSync(struct.standaloneDir.serverJs)).toBe(true);
      expect(fs.existsSync(struct.standaloneDir.packageJson)).toBe(true);
    });
  });

  describe("MosaixCommandRouter (CLI Commands)", () => {
    it("should handle init, dev, build, rebuild, start, clean commands", async () => {
      const router = new MosaixCommandRouter(tmpDir);

      const initRes = await router.execute("init", { json: true });
      expect(initRes.exitCode).toBe(EXIT_CODES.SUCCESS);

      const devRes = await router.execute("dev", { json: true });
      expect(devRes.exitCode).toBe(EXIT_CODES.SUCCESS);

      const buildRes = await router.execute("build", { json: true });
      expect(buildRes.exitCode).toBe(EXIT_CODES.SUCCESS);

      const startRes = await router.execute("start", { json: true });
      expect(startRes.exitCode).toBe(EXIT_CODES.SUCCESS);

      const rebuildRes = await router.execute("rebuild", { json: true });
      expect(rebuildRes.exitCode).toBe(EXIT_CODES.SUCCESS);

      const cleanRes = await router.execute("clean", { json: true });
      expect(cleanRes.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it("should support general and inspection commands in JSON mode", async () => {
      const router = new MosaixCommandRouter(tmpDir);
      await router.execute("build", { json: true });

      const aboutRes = await router.execute("about", { json: true });
      expect(aboutRes.exitCode).toBe(EXIT_CODES.SUCCESS);

      const listRes = await router.execute("list", { json: true });
      expect(listRes.exitCode).toBe(EXIT_CODES.SUCCESS);

      const doctorRes = await router.execute("doctor", { json: true });
      expect(doctorRes.exitCode).toBe(EXIT_CODES.SUCCESS);

      const inspectRes = await router.execute("inspect", { json: true });
      expect(inspectRes.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it("should return EXIT_CODES.GENERIC_ERROR for unknown commands", async () => {
      const router = new MosaixCommandRouter(tmpDir);
      const res = await router.execute("non_existent_cmd", { json: true });
      expect(res.exitCode).toBe(EXIT_CODES.GENERIC_ERROR);
    });
  });

  describe("key:generate / key:check (Laravel-style secrets)", () => {
    it("shows generated keys without writing (--show)", async () => {
      const router = new MosaixCommandRouter(tmpDir);
      const res = await router.execute("key:generate", {
        json: true,
        args: ["--show"],
      });
      expect(res.exitCode).toBe(EXIT_CODES.SUCCESS);
      const data = res.data as Record<string, string>;
      expect(String(data.MOSAIX_APP_KEY)).toMatch(/^base64:/);
      expect(fs.existsSync(path.join(tmpDir, ".env"))).toBe(false);
    });

    it("writes missing keys once, preserves them on re-run", async () => {
      const router = new MosaixCommandRouter(tmpDir);
      const first = await router.execute("key:generate", { json: true });
      expect(first.exitCode).toBe(EXIT_CODES.SUCCESS);
      const written = fs.readFileSync(path.join(tmpDir, ".env"), "utf-8");
      expect(written).toContain("MOSAIX_AUTH_JWT_SECRET=");

      const second = await router.execute("key:generate", { json: true });
      expect(second.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(second.data).toMatchObject({ updated: [] });
      expect(fs.readFileSync(path.join(tmpDir, ".env"), "utf-8")).toBe(written);
    });

    it("key:check passes on a generated env, fails on empty dir", async () => {
      const router = new MosaixCommandRouter(tmpDir);
      const before = await router.execute("key:check", { json: true });
      expect(before.exitCode).not.toBe(EXIT_CODES.SUCCESS);

      await router.execute("key:generate", { json: true });
      const after = await router.execute("key:check", { json: true });
      expect(after.exitCode).toBe(EXIT_CODES.SUCCESS);
    });
  });

  describe("migrate / migrate:status / migrate:rollback / db:seed (Laravel-style database commands)", () => {
    it("reports pending, migrates, then reports applied", async () => {
      const router = new MosaixCommandRouter(tmpDir);

      const before = await router.execute("migrate:status", { json: true });
      expect(before.exitCode).toBe(EXIT_CODES.SUCCESS);
      const rowsBefore = before.data as Array<{ applied: boolean }>;
      expect(rowsBefore.length).toBe(3);
      expect(rowsBefore.every((r) => r.applied === false)).toBe(true);

      const migrated = await router.execute("migrate", { json: true });
      expect(migrated.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(
        (migrated.data as { applied: readonly string[] }).applied,
      ).toHaveLength(3);

      const after = await router.execute("migrate:status", { json: true });
      expect(after.exitCode).toBe(EXIT_CODES.SUCCESS);
      const rowsAfter = after.data as Array<{ applied: boolean }>;
      expect(rowsAfter.every((r) => r.applied === true)).toBe(true);
    });

    it("seeds baseline data once, then skips (idempotent)", async () => {
      const router = new MosaixCommandRouter(tmpDir);
      await router.execute("migrate", { json: true });

      const first = await router.execute("db:seed", { json: true });
      expect(first.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(
        (first.data as { seeded: string[] }).seeded,
      ).toContain("shell_feed");

      const second = await router.execute("db:seed", { json: true });
      expect(second.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect((second.data as { seeded: string[] }).seeded).toEqual([]);
    });

    it("migrate --seed migrates and seeds in one invocation", async () => {
      const router = new MosaixCommandRouter(tmpDir);
      const res = await router.execute("migrate", {
        json: true,
        args: ["--seed"],
      });
      expect(res.exitCode).toBe(EXIT_CODES.SUCCESS);
      const data = res.data as {
        applied: readonly string[];
        seeded: string[];
      };
      expect(data.applied).toHaveLength(3);
      expect(data.seeded).toContain("shell_feed");
    });

    it("migrate:rollback undoes the last batch", async () => {
      const router = new MosaixCommandRouter(tmpDir);
      await router.execute("migrate", { json: true });

      const rolledBack = await router.execute("migrate:rollback", {
        json: true,
      });
      expect(rolledBack.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(
        (rolledBack.data as { rolledBack: readonly string[] }).rolledBack,
      ).toHaveLength(3);

      const status = await router.execute("migrate:status", { json: true });
      const rows = status.data as Array<{ applied: boolean }>;
      expect(rows.every((r) => r.applied === false)).toBe(true);
    });
  });

  describe("install (first-time server setup)", () => {
    it("requires .env.example (repo root guard)", async () => {
      const router = new MosaixCommandRouter(tmpDir);
      const res = await router.execute("install", {
        json: true,
        args: ["--dry-run"],
      });
      expect(res.exitCode).not.toBe(EXIT_CODES.SUCCESS);
    });

    it("plans the full setup with --dry-run without writing", async () => {
      fs.writeFileSync(
        path.join(tmpDir, ".env.example"),
        "MOSAIX_PORT=3000\n",
        "utf-8",
      );
      const router = new MosaixCommandRouter(tmpDir);
      const res = await router.execute("install", {
        json: true,
        args: ["--dry-run", "--skip-deps", "--skip-db", "--skip-admin"],
      });
      expect(res.exitCode).toBe(EXIT_CODES.SUCCESS);
      const data = res.data as {
        dryRun: boolean;
        steps: Array<{ step: string }>;
      };
      expect(data.dryRun).toBe(true);
      expect(data.steps.map((s) => s.step)).toEqual([
        "preflight",
        "env",
        "folders",
        "deps",
        "db",
        "admin",
      ]);
      expect(fs.existsSync(path.join(tmpDir, ".env"))).toBe(false);
    });

    it("is reachable via the setup alias", async () => {
      fs.writeFileSync(
        path.join(tmpDir, ".env.example"),
        "MOSAIX_PORT=3000\n",
        "utf-8",
      );
      const router = new MosaixCommandRouter(tmpDir);
      const res = await router.execute("setup", {
        json: true,
        args: ["--dry-run", "--skip-deps", "--skip-db", "--skip-admin"],
      });
      expect(res.exitCode).toBe(EXIT_CODES.SUCCESS);
    });
  });
});
