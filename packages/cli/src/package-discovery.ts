import * as fs from "node:fs";
import * as path from "node:path";

export interface DiscoveredMosaixPackage {
  name: string;
  version: string;
  providerPath?: string;
  capabilities: readonly string[];
  events: readonly string[];
  permissions: readonly string[];
  cliCommands: readonly string[];
  cliGenerators: readonly string[];
  status: "discovered" | "valid" | "incompatible";
}

export class PackageDiscoverer {
  private rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
  }

  discover(): DiscoveredMosaixPackage[] {
    const results: DiscoveredMosaixPackage[] = [];
    const searchDirs = [
      path.join(this.rootDir, "packages"),
      path.join(this.rootDir, "plugins"),
      path.join(this.rootDir, "node_modules"),
      path.join(this.rootDir, "node_modules", "@mosaix"),
    ];

    for (const searchDir of searchDirs) {
      if (!fs.existsSync(searchDir)) continue;

      try {
        const entries = fs.readdirSync(searchDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;

          const pkgJsonPath = path.join(searchDir, entry.name, "package.json");
          if (!fs.existsSync(pkgJsonPath)) continue;

          try {
            const raw = fs.readFileSync(pkgJsonPath, "utf8");
            const pkg = JSON.parse(raw) as {
              name?: string;
              version?: string;
              mosaix?: {
                provider?: string;
                capabilities?: string[];
                events?: string[];
                permissions?: string[];
                commands?: string[];
                generators?: string[];
              };
            };

            if (pkg.mosaix || pkg.name?.startsWith("@mosaix/")) {
              const pkgResult: DiscoveredMosaixPackage = {
                name: pkg.name ?? entry.name,
                version: pkg.version ?? "0.0.1",
                capabilities: pkg.mosaix?.capabilities ?? [],
                events: pkg.mosaix?.events ?? [],
                permissions: pkg.mosaix?.permissions ?? [],
                cliCommands: pkg.mosaix?.commands ?? [],
                cliGenerators: pkg.mosaix?.generators ?? [],
                status: pkg.mosaix?.provider ? "valid" : "discovered",
              };
              if (pkg.mosaix?.provider) {
                pkgResult.providerPath = pkg.mosaix.provider;
              }
              results.push(pkgResult);
            }
          } catch (err) {
            console.warn(`[PackageDiscoverer] Unreadable or malformed package.json at [${pkgJsonPath}]: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      } catch (err) {
        console.warn(`[PackageDiscoverer] Unreadable search directory at [${searchDir}]: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // De-duplicate by name
    const uniqueMap = new Map<string, DiscoveredMosaixPackage>();
    for (const res of results) {
      if (!uniqueMap.has(res.name)) {
        uniqueMap.set(res.name, res);
      }
    }

    return Array.from(uniqueMap.values());
  }
}
