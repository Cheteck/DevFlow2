import * as fs from "node:fs";
import * as path from "node:path";
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
  private rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
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

    // Rewrite @mosaix/* imports to relative paths for standalone deployment
    this.rewriteImportsToRelativePaths();

    this.folderManager.generateStandaloneBundle();

    return {
      platformVersion: "1.0.0",
      compiledAt: new Date().toISOString(),
      buildId: fsReadBuildId(struct.buildIdFile),
      applications: apps,
      packages: discoveredPkgs,
    };
  }

  /**
   * Rewrites @mosaix/* import specifiers to relative paths in compiled JS files.
   * This enables standalone deployment: the compiled bundle no longer depends on
   * node_modules symlinks for workspace packages.
   *
   * For every `from "@mosaix/<pkg>"` (and dynamic `import("@mosaix/<pkg>")`)
   * occurrence, the specifier is replaced with the relative path from the
   * importing file to the package's compiled entry point under .mosaix/build.
   * External npm deps (zod, pg, pino…) are left as-is and must be declared in
   * the standalone package.json.
   */
  private rewriteImportsToRelativePaths(): void {
    const struct = this.folderManager.getStructure();
    const buildDir = struct.buildDir.root;
    if (!fs.existsSync(buildDir)) return;

    // alias → absolute path of the compiled entry file
    const entries: Record<string, string> = {};
    const resolveEntry = (
      pkg: { name?: string; main?: string; exports?: unknown },
      mirrorDir: string,
    ): string | null => {
      // Candidate entry specifiers, in priority order:
      // 1. exports["."] import/default field (source path, e.g. ./src/index.ts)
      // 2. exports["."] as a plain string
      // 3. main (often "./dist/index.js" — useless for the flat build mirror)
      // 4. fallback: src/index.js under the build mirror
      const candidates: string[] = [];
      const rootExports =
        typeof pkg.exports === "string"
          ? pkg.exports
          : pkg.exports && typeof pkg.exports === "object"
            ? (pkg.exports as Record<string, unknown>)["."]
            : undefined;
      if (typeof rootExports === "string") {
        candidates.push(rootExports);
      } else if (rootExports && typeof rootExports === "object") {
        const exp = rootExports as Record<string, unknown>;
        candidates.push(
          ...(typeof exp.import === "string" ? [exp.import] : []),
          ...(typeof exp.default === "string" ? [exp.default] : []),
          ...(typeof exp.require === "string" ? [exp.require] : []),
        );
      }
      if (typeof pkg.main === "string") candidates.push(pkg.main);
      candidates.push("src/index.js");

      for (const candidate of candidates) {
        // Source path in the workspace (e.g. ./src/index.ts) maps to the
        // same relative path with .js extension under the build mirror.
        const rel = candidate.replace(/\.ts$/i, ".js").replace(/^\.\//, "");
        const abs = path.join(mirrorDir, rel);
        if (fs.existsSync(abs)) return abs;
      }
      return null;
    };
    const registerDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const pkgJsonPath = path.join(dir, entry.name, "package.json");
        if (!fs.existsSync(pkgJsonPath)) continue;
        let pkg: { name?: string; main?: string; exports?: unknown };
        try {
          pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
        } catch {
          continue;
        }
        if (!pkg.name || !pkg.name.startsWith("@mosaix/")) continue;
        const mirrorDir = path.join(
          buildDir,
          path.relative(this.rootDir, path.join(dir, entry.name)),
        );
        const entryAbs = resolveEntry(pkg, mirrorDir);
        if (entryAbs) entries[pkg.name] = entryAbs;
      }
    };
    registerDir(path.join(this.rootDir, "packages"));
    registerDir(path.join(this.rootDir, "packages", "adapters"));
    registerDir(path.join(this.rootDir, "packages", "ports"));
    registerDir(path.join(this.rootDir, "apps"));

    const specAliases = Object.keys(entries).sort((a, b) => b.length - a.length);
    const importRe = new RegExp(
      `["'](${specAliases
        .map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|")})["']`,
      "g",
    );

    let filesRewritten = 0;
    const rewriteFile = (filePath: string) => {
      const original = fs.readFileSync(filePath, "utf8");
      const replaced = original.replace(importRe, (match, alias: string) => {
        const entry = entries[alias];
        if (!entry) return match;
        const rel = path
          .relative(path.dirname(filePath), entry)
          .split(path.sep)
          .join("/");
        return match.replace(alias, rel);
      });
      if (replaced !== original) {
        fs.writeFileSync(filePath, replaced, "utf8");
        filesRewritten += 1;
      }
    };
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(fullPath);
        else if (entry.isFile() && entry.name.endsWith(".js")) rewriteFile(fullPath);
      }
    };
    walk(buildDir);

    console.log(
      `[standalone] Rewrote workspace imports in ${filesRewritten} file(s) across ${specAliases.length} workspace package(s).`,
    );
  }
}

function fsReadBuildId(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return `build_${Date.now()}`;
  }
}
