import * as fs from "node:fs";
import * as path from "node:path";

export interface MosaixFolderStructure {
  root: string;
  buildIdFile: string;
  buildDir: {
    root: string;
    client: string;
    server: string;
    shared: string;
    packagesRoot: string;
    appsRoot: string;
    pluginsRoot: string;
  };
  cacheDir: {
    root: string;
    assets: string;
    bundler: string;
    compiler: string;
    resolver: string;
  };
  diagnosticsDir: {
    root: string;
    buildJson: string;
  };
  manifestsDir: {
    root: string;
    applicationsJson: string;
    packagesJson: string;
    capabilitiesJson: string;
    capabilitiesRegistryJson: string;
    eventsJson: string;
    eventsRegistryJson: string;
    permissionsJson: string;
    aggregatedJson: string;
  };
  routesDir: {
    root: string;
    manifestJson: string;
  };
  runtimeDir: {
    root: string;
    manifestJson: string;
  };
  standaloneDir: {
    root: string;
    serverJs: string;
    packageJson: string;
  };
  staticDir: string;
  logsDir: string;
  themesDir: string;
  tracesDir: {
    root: string;
    dependenciesJson: string;
  };
}

export const EXIT_CODES = {
  SUCCESS: 0,
  GENERIC_ERROR: 1,
  INVALID_CONFIGURATION: 2,
  VALIDATION_FAILURE: 3,
  BUILD_FAILURE: 4,
  WORKSPACE_INCONSISTENCY: 5,
  RUNTIME_UNAVAILABLE: 6,
} as const;

export class MosaixFolderManager {
  private rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
  }

  getStructure(): MosaixFolderStructure {
    const mosaixDir = path.join(this.rootDir, ".mosaix");
    return {
      root: mosaixDir,
      buildIdFile: path.join(mosaixDir, "BUILD_ID"),
      buildDir: {
        root: path.join(mosaixDir, "build"),
        client: path.join(mosaixDir, "build", "client"),
        server: path.join(mosaixDir, "build", "server"),
        shared: path.join(mosaixDir, "build", "shared"),
        packagesRoot: path.join(mosaixDir, "build", "packages"),
        appsRoot: path.join(mosaixDir, "build", "apps"),
        pluginsRoot: path.join(mosaixDir, "build", "plugins"),
      },
      cacheDir: {
        root: path.join(mosaixDir, "cache"),
        assets: path.join(mosaixDir, "cache", "assets"),
        bundler: path.join(mosaixDir, "cache", "bundler"),
        compiler: path.join(mosaixDir, "cache", "compiler"),
        resolver: path.join(mosaixDir, "cache", "resolver"),
      },
      diagnosticsDir: {
        root: path.join(mosaixDir, "diagnostics"),
        buildJson: path.join(mosaixDir, "diagnostics", "build.json"),
      },
      manifestsDir: {
        root: path.join(mosaixDir, "manifests"),
        applicationsJson: path.join(mosaixDir, "manifests", "applications.json"),
        packagesJson: path.join(mosaixDir, "manifests", "packages.json"),
        capabilitiesJson: path.join(mosaixDir, "manifests", "capabilities.json"),
        capabilitiesRegistryJson: path.join(mosaixDir, "manifests", "capabilities-registry.json"),
        eventsJson: path.join(mosaixDir, "manifests", "events.json"),
        eventsRegistryJson: path.join(mosaixDir, "manifests", "events-registry.json"),
        permissionsJson: path.join(mosaixDir, "manifests", "permissions.json"),
        aggregatedJson: path.join(mosaixDir, "manifests", "aggregated-manifest.json"),
      },
      routesDir: {
        root: path.join(mosaixDir, "routes"),
        manifestJson: path.join(mosaixDir, "routes", "manifest.json"),
      },
      runtimeDir: {
        root: path.join(mosaixDir, "runtime"),
        manifestJson: path.join(mosaixDir, "runtime", "manifest.json"),
      },
      standaloneDir: {
        root: path.join(mosaixDir, "standalone"),
        serverJs: path.join(mosaixDir, "standalone", "server.js"),
        packageJson: path.join(mosaixDir, "standalone", "package.json"),
      },
      staticDir: path.join(mosaixDir, "static"),
      logsDir: path.join(mosaixDir, "logs"),
      themesDir: path.join(mosaixDir, "themes"),
      tracesDir: {
        root: path.join(mosaixDir, "traces"),
        dependenciesJson: path.join(mosaixDir, "traces", "dependencies.json"),
      },
    };
  }

  ensureFolderStructure(): MosaixFolderStructure {
    const struct = this.getStructure();
    const dirs = [
      struct.root,
      struct.buildDir.root,
      struct.buildDir.client,
      struct.buildDir.server,
      struct.buildDir.shared,
      struct.cacheDir.root,
      struct.cacheDir.assets,
      struct.cacheDir.bundler,
      struct.cacheDir.compiler,
      struct.cacheDir.resolver,
      struct.diagnosticsDir.root,
      struct.manifestsDir.root,
      struct.routesDir.root,
      struct.runtimeDir.root,
      struct.standaloneDir.root,
      struct.staticDir,
      struct.logsDir,
      struct.themesDir,
      struct.tracesDir.root,
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    return struct;
  }

  clean(): void {
    const mosaixDir = path.join(this.rootDir, ".mosaix");
    if (fs.existsSync(mosaixDir)) {
      fs.rmSync(mosaixDir, { recursive: true, force: true });
    }
  }

  synthesizeManifests(data: {
    applications?: Record<string, unknown>;
    packages?: Record<string, unknown>;
    capabilities?: readonly unknown[];
    events?: readonly unknown[];
    permissions?: readonly unknown[];
    routes?: readonly unknown[];
    runtime?: Record<string, unknown>;
  } = {}): MosaixFolderStructure {
    const struct = this.ensureFolderStructure();
    const buildId = `build_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    fs.writeFileSync(struct.buildIdFile, buildId, "utf8");

    const apps = data.applications ?? {};
    const pkgs = data.packages ?? {};
    const caps = data.capabilities ?? [];
    const evts = data.events ?? [];
    const perms = data.permissions ?? [];
    const routes = data.routes ?? [];
    const runtime = data.runtime ?? { status: "active", version: "1.0.0" };

    fs.writeFileSync(struct.manifestsDir.applicationsJson, JSON.stringify(apps, null, 2), "utf8");
    fs.writeFileSync(struct.manifestsDir.packagesJson, JSON.stringify(pkgs, null, 2), "utf8");
    fs.writeFileSync(struct.manifestsDir.capabilitiesJson, JSON.stringify({ capabilities: caps }, null, 2), "utf8");
    fs.writeFileSync(struct.manifestsDir.capabilitiesRegistryJson, JSON.stringify({ capabilities: caps }, null, 2), "utf8");
    fs.writeFileSync(struct.manifestsDir.eventsJson, JSON.stringify({ events: evts }, null, 2), "utf8");
    fs.writeFileSync(struct.manifestsDir.eventsRegistryJson, JSON.stringify({ events: evts }, null, 2), "utf8");
    fs.writeFileSync(struct.manifestsDir.permissionsJson, JSON.stringify({ permissions: perms }, null, 2), "utf8");

    const aggregated = {
      buildId,
      timestamp: new Date().toISOString(),
      applications: apps,
      packages: pkgs,
      capabilities: caps,
      events: evts,
      permissions: perms,
    };
    fs.writeFileSync(struct.manifestsDir.aggregatedJson, JSON.stringify(aggregated, null, 2), "utf8");

    fs.writeFileSync(struct.routesDir.manifestJson, JSON.stringify({ routes }, null, 2), "utf8");
    fs.writeFileSync(struct.runtimeDir.manifestJson, JSON.stringify(runtime, null, 2), "utf8");

    const diagnostics = {
      buildId,
      status: "success",
      compiledAt: new Date().toISOString(),
      appCount: Object.keys(apps).length,
      packageCount: Object.keys(pkgs).length,
      capabilityCount: caps.length,
      eventCount: evts.length,
      permissionCount: perms.length,
    };
    fs.writeFileSync(struct.diagnosticsDir.buildJson, JSON.stringify(diagnostics, null, 2), "utf8");

    const traces = {
      buildId,
      generatedAt: new Date().toISOString(),
      dependencies: {
        apps: Object.keys(apps),
        packages: Object.keys(pkgs),
      },
    };
    fs.writeFileSync(struct.tracesDir.dependenciesJson, JSON.stringify(traces, null, 2), "utf8");

    return struct;
  }

  generateStandaloneBundle(): void {
    const struct = this.ensureFolderStructure();

    const serverScript = `/**
 * MosaiX Production Standalone Bundle
 * Autogenerated by MosaiX CLI
 */
import { RuntimeKernel } from "@mosaix/core";

console.log("Starting MosaiX Standalone Production Runtime...");
const kernel = new RuntimeKernel();
await kernel.start();
console.log("MosaiX Standalone Kernel is active.");
`;

    const packageJsonContent = {
      name: "mosaix-standalone",
      version: "1.0.0",
      private: true,
      type: "module",
      main: "server.js",
      dependencies: {
        "@mosaix/core": "workspace:*",
        "@mosaix/contracts": "workspace:*",
      },
    };

    fs.writeFileSync(struct.standaloneDir.serverJs, serverScript, "utf8");
    fs.writeFileSync(
      struct.standaloneDir.packageJson,
      JSON.stringify(packageJsonContent, null, 2),
      "utf8",
    );
  }

  inspect(): Record<string, unknown> {
    const struct = this.getStructure();
    if (!fs.existsSync(struct.buildIdFile) || !fs.existsSync(struct.manifestsDir.aggregatedJson)) {
      return {
        status: "not_built",
        mosaixFolderExists: fs.existsSync(struct.root),
      };
    }

    try {
      const buildId = fs.readFileSync(struct.buildIdFile, "utf8").trim();
      const aggregatedContent = fs.readFileSync(struct.manifestsDir.aggregatedJson, "utf8");
      const diagnosticsContent = fs.existsSync(struct.diagnosticsDir.buildJson)
        ? fs.readFileSync(struct.diagnosticsDir.buildJson, "utf8")
        : "{}";

      return {
        status: "built",
        buildId,
        mosaixFolderExists: true,
        manifest: JSON.parse(aggregatedContent) as unknown,
        diagnostics: JSON.parse(diagnosticsContent) as unknown,
      };
    } catch (error) {
      throw new Error(
        `Failed to inspect .mosaix folder: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }
}
