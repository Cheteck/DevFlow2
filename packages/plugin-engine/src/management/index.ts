/**
 * @mosaix/plugin-engine/management — Plugin Management Service & Diagnostics
 */

import type { PluginEngine } from "../runtime";
import type { PluginDefinition, PluginState } from "../core";

export interface PluginDiagnostics {
  pluginId: string;
  state: PluginState;
  error?: string;
  hasInstance: boolean;
}

export class PluginManagementService {
  private engine: PluginEngine;

  constructor(engine: PluginEngine) {
    this.engine = engine;
  }

  list(): PluginDefinition[] {
    return Array.from(this.engine.registry["plugins"].values());
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
