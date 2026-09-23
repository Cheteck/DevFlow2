/**
 * @mosaix/plugin-engine/adapters — Static & Workspace Plugin Loaders
 */

import type { PluginManifest } from "../core";

export class StaticPluginLoader {
  private manifests = new Map<string, PluginManifest>();

  registerManifest(manifest: PluginManifest): void {
    this.manifests.set(manifest.id, manifest);
  }

  getManifest(pluginId: string): PluginManifest | undefined {
    return this.manifests.get(pluginId);
  }

  discover(): PluginManifest[] {
    return Array.from(this.manifests.values());
  }
}
