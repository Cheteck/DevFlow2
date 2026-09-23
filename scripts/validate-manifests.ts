import * as fs from "node:fs";
import * as path from "node:path";

interface Manifest {
  id: string;
  version: string;
  name?: string;
  requires?: Array<{ id: string; version: string }>;
  capabilities?: Array<{ id: string; version: string }>;
  routes?: { prefix?: string };
}

function discoverManifests(): { filePath: string; manifest: Manifest }[] {
  const results: { filePath: string; manifest: Manifest }[] = [];
  const appsDir = path.resolve(process.cwd(), "apps");
  const pluginsDir = path.resolve(process.cwd(), "plugins");

  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith("_")) continue;
        const fullPath = path.join(dir, entry.name);
        const manifestPath = path.join(fullPath, "mosaix.json");
        const pluginManifestPath = path.join(fullPath, "mosaix.plugin.json");
        
        let targetManifest = "";
        if (fs.existsSync(manifestPath)) {
          targetManifest = manifestPath;
        } else if (fs.existsSync(pluginManifestPath)) {
          targetManifest = pluginManifestPath;
        }

        if (targetManifest) {
          try {
            const content = fs.readFileSync(targetManifest, "utf-8");
            const manifest = JSON.parse(content) as Manifest;
            results.push({ filePath: targetManifest, manifest });
          } catch (err: unknown) {
            console.error(`[Validate Manifests] Error parsing ${targetManifest}:`, err instanceof Error ? err.message : String(err));
            process.exit(1);
          }
        }
      }
    }
  }

  scanDir(appsDir);
  scanDir(pluginsDir);
  return results;
}

function topoSort(manifests: { filePath: string; manifest: Manifest }[]) {
  const idMap = new Map<string, Manifest>();
  for (const item of manifests) {
    idMap.set(item.manifest.id, item.manifest);
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const sorted: Manifest[] = [];

  function visit(manifest: Manifest) {
    if (visiting.has(manifest.id)) {
      console.error(`[Validate Manifests] Circular dependency detected involving ${manifest.id}`);
      process.exit(1);
    }
    if (visited.has(manifest.id)) return;

    visiting.add(manifest.id);
    if (manifest.requires) {
      for (const req of manifest.requires) {
        const dep = idMap.get(req.id);
        if (!dep) {
          console.error(`[Validate Manifests] Error: App ${manifest.id} requires ${req.id}, which is not installed/discovered.`);
          process.exit(1);
        }
        visit(dep);
      }
    }
    visiting.delete(manifest.id);
    visited.add(manifest.id);
    sorted.push(manifest);
  }

  for (const item of manifests) {
    visit(item.manifest);
  }

  return sorted;
}

function main() {
  console.log("[Validate Manifests] Discovering and validating manifests across apps and plugins...");
  const discovered = discoverManifests();
  console.log(`[Validate Manifests] Discovered ${discovered.length} manifests.`);

  const ids = new Set<string>();
  const capabilities = new Set<string>();

  for (const { filePath, manifest } of discovered) {
    if (!manifest.id || !manifest.version) {
      console.error(`[Validate Manifests] Invalid manifest at ${filePath}: missing 'id' or 'version'.`);
      process.exit(1);
    }

    if (ids.has(manifest.id)) {
      console.error(`[Validate Manifests] Duplicate manifest ID detected: ${manifest.id}`);
      process.exit(1);
    }
    ids.add(manifest.id);

    if (manifest.capabilities) {
      for (const cap of manifest.capabilities) {
        if (capabilities.has(cap.id)) {
          console.error(`[Validate Manifests] Duplicate capability provided: ${cap.id} in ${manifest.id}`);
          process.exit(1);
        }
        capabilities.add(cap.id);
      }
    }
  }

  const sorted = topoSort(discovered);
  console.log("[Validate Manifests] Topological sort successful:", sorted.map(m => m.id).join(" -> "));
  console.log("[Validate Manifests] All manifests are valid and fail-fast check passed!");
}

main();
