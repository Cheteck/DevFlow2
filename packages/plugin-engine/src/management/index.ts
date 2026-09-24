/**
 * @mosaix/plugin-engine/management — Plugin Management Service, Marketplace & CLI
 */

export * from "./marketplace-registry.js";
export * from "./plugin-cli.js";

import type { PluginEngine } from "../runtime/index.js";
import type { PluginDefinition, PluginState } from "../core/index.js";

export interface PluginDiagnostics {
  pluginId: string;
  state: PluginState;
  error?: string;
  hasInstance: boolean;
}

export class PluginManagementService {
  constructor(private readonly engine: PluginEngine) {}

  list(): PluginDefinition[] {
    return this.engine.registry.list();
  }

  get(pluginId: string): PluginDefinition | undefined {
    return this.engine.registry.get(pluginId);
  }

  async activate(pluginId: string): Promise<void> {
    await this.engine.lifecycle.activate(pluginId);
  }

  async disable(pluginId: string): Promise<void> {
    await this.engine.lifecycle.disable(pluginId);
  }

  async unload(pluginId: string): Promise<void> {
    await this.engine.lifecycle.unload(pluginId);
  }

  getDiagnostics(pluginId: string): PluginDiagnostics {
    const plugin = this.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin [${pluginId}] not found.`);
    }

    return {
      pluginId,
      state: plugin.state,
      hasInstance: plugin.instance !== undefined,
      ...(plugin.error ? { error: plugin.error } : {}),
    };
  }
}
