import * as fs from "node:fs";
import type { ApplicationManifest } from "@mosaix/contracts";
import { MosaixFolderManager } from "./folder-manager.js";
import { PackageDiscoverer, type DiscoveredMosaixPackage } from "./package-discovery.js";

export interface ProductionBundleManifest {
  readonly platformVersion: string;
  readonly compiledAt: string;
  readonly buildId: string;
  readonly applications: readonly ApplicationManifest[];
  readonly packages: readonly DiscoveredMosaixPackage[];
}

export class ProductionBuildCompiler {
  private folderManager: MosaixFolderManager;
  private packageDiscoverer: PackageDiscoverer;

  constructor(rootDir: string = process.cwd()) {
    this.folderManager = new MosaixFolderManager(rootDir);
    this.packageDiscoverer = new PackageDiscoverer(rootDir);
  }

  static synthesizeManifest(
    apps: readonly ApplicationManifest[],
    pkgs: readonly DiscoveredMosaixPackage[] = [],
  ): ProductionBundleManifest {
    return {
      platformVersion: "1.0.0",
      compiledAt: new Date().toISOString(),
      buildId: `build_${Date.now()}`,
      applications: apps,
      packages: pkgs,
    };
  }

  compile(apps: readonly ApplicationManifest[] = []): ProductionBundleManifest {
    const discoveredPkgs = this.packageDiscoverer.discover();
    const appRecord: Record<string, unknown> = {};
    const capabilitiesList: unknown[] = [];
    const eventsList: unknown[] = [];
    const permissionsList: unknown[] = [];

    for (const app of apps) {
      appRecord[app.id] = app;
      if (app.capabilities) capabilitiesList.push(...app.capabilities);
      if (typeof app.domain === "object" && app.domain?.events) {
        eventsList.push(...app.domain.events);
      }
      if (app.permissions) permissionsList.push(...app.permissions);
    }

    const pkgRecord: Record<string, unknown> = {};
    for (const pkg of discoveredPkgs) {
      pkgRecord[pkg.name] = pkg;
    }

    const struct = this.folderManager.synthesizeManifests({
      applications: appRecord,
      packages: pkgRecord,
      capabilities: capabilitiesList,
      events: eventsList,
      permissions: permissionsList,
      runtime: {
        status: "active",
        version: "1.0.0",
        appCount: apps.length,
        packageCount: discoveredPkgs.length,
      },
    });

    this.folderManager.generateStandaloneBundle();

    return {
      platformVersion: "1.0.0",
      compiledAt: new Date().toISOString(),
      buildId: fsReadBuildId(struct.buildIdFile),
      applications: apps,
      packages: discoveredPkgs,
    };
  }
}

function fsReadBuildId(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return `build_${Date.now()}`;
  }
}
