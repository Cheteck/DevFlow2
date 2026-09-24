/**
 * @mosaix/plugin-engine/adapters — Dynamic Workspace Plugin Loader
 */

import type { PluginManifest } from "../core/index.js";
import type { PluginEngine } from "../runtime/index.js";

export interface WorkspacePluginEntry {
  dirPath: string;
  manifestFile: string;
  manifest: PluginManifest;
  lastModified: number;
}

export interface WorkspaceLoaderOptions {
  pluginsDir?: string;
  watchIntervalMs?: number;
  autoActivate?: boolean;
}

export class WorkspacePluginLoader {
  private discoveredEntries = new Map<string, WorkspacePluginEntry>(); // pluginId -> entry
  private mockFileStore = new Map<string, { manifestContent: string; mtime: number }>();
  private watchTimer?: NodeJS.Timeout;

  constructor(
    private readonly engine: PluginEngine,
    private readonly options: WorkspaceLoaderOptions = {}
  ) {}

  /**
   * Register a simulated or in-memory file for tests & virtual workspaces
   */
  registerVirtualPluginFile(path: string, manifestContent: string, mtime: number = Date.now()): void {
    this.mockFileStore.set(path, { manifestContent, mtime });
  }

  /**
   * Scan workspace for mosaix.json / plugin.json manifests
   */
  async scanWorkspace(): Promise<PluginManifest[]> {
    const discovered: PluginManifest[] = [];

    for (const [filePath, fileData] of this.mockFileStore.entries()) {
      if (filePath.endsWith("mosaix.json") || filePath.endsWith("plugin.json")) {
        try {
          const parsed = JSON.parse(fileData.manifestContent) as PluginManifest;
          if (parsed && parsed.id && parsed.targetAppId) {
            const entry: WorkspacePluginEntry = {
              dirPath: filePath.substring(0, filePath.lastIndexOf("/")),
              manifestFile: filePath,
              manifest: parsed,
              lastModified: fileData.mtime,
            };
            this.discoveredEntries.set(parsed.id, entry);
            discovered.push(parsed);

            // Register with engine if not present
            if (!this.engine.registry.has(parsed.id) && this.options.autoActivate !== false) {
              await this.engine.registerAndActivate(parsed);
            }
          }
        } catch (err) {
          console.error(`Failed to parse plugin manifest at ${filePath}:`, err);
        }
      }
    }

    return discovered;
  }

  /**
   * Reload a plugin dynamically on file change
   */
  async reloadPlugin(pluginId: string): Promise<boolean> {
    const entry = this.discoveredEntries.get(pluginId);
    if (!entry) return false;

    // 1. Unload old version
    await this.engine.lifecycle.unload(pluginId);

    // 2. Re-read manifest
    const fileData = this.mockFileStore.get(entry.manifestFile);
    if (!fileData) return false;

    const updatedManifest = JSON.parse(fileData.manifestContent) as PluginManifest;
    entry.manifest = updatedManifest;
    entry.lastModified = fileData.mtime;

    // 3. Register & activate fresh instance
    await this.engine.registerAndActivate(updatedManifest);
    return true;
  }

  /**
   * Start periodic watching for file modifications
   */
  startWatching(onChange?: (pluginId: string, event: "updated" | "deleted") => void): void {
    const interval = this.options.watchIntervalMs ?? 1000;
    this.watchTimer = setInterval(async () => {
      for (const [pluginId, entry] of this.discoveredEntries.entries()) {
        const fileData = this.mockFileStore.get(entry.manifestFile);
        if (!fileData) {
          // File deleted
          await this.engine.lifecycle.unload(pluginId);
          this.discoveredEntries.delete(pluginId);
          onChange?.(pluginId, "deleted");
        } else if (fileData.mtime > entry.lastModified) {
          // File updated
          await this.reloadPlugin(pluginId);
          onChange?.(pluginId, "updated");
        }
      }
    }, interval);
  }

  /**
   * Stop file watcher
   */
  stopWatching(): void {
    if (this.watchTimer) {
      clearInterval(this.watchTimer);
      this.watchTimer = undefined;
    }
  }

  getDiscoveredEntries(): readonly WorkspacePluginEntry[] {
    return Array.from(this.discoveredEntries.values());
  }
}
