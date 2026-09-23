/**
 * @mosaix/plugin-engine/ui — Plugin Management UI Components
 */

export interface PluginManagerConfig {
  appId: string;
}

export class PluginManagerUI {
  renderPluginList(plugins: Array<{ id: string; name: string; state: string }>): string {
    return plugins.map((p) => `[${p.state}] ${p.name} (${p.id})`).join("\n");
  }
}
