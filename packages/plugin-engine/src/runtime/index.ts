/**
 * @mosaix/plugin-engine/runtime — Plugin Lifecycle Manager, Engine, Sandbox & Registry
 */

import type { PluginDefinition, PluginManifest, PluginState } from "../core";

export interface PluginContext {
  pluginId: string;
  targetAppId: string;
  capabilities: Record<string, unknown>;
  permissions: string[];
  dispose: () => void;
}

export class PluginRegistry {
  private plugins = new Map<string, PluginDefinition>();

  register(definition: PluginDefinition): void {
    this.plugins.set(definition.manifest.id, definition);
  }

  get(pluginId: string): PluginDefinition | undefined {
    return this.plugins.get(pluginId);
  }

  getPluginsForApp(appId: string): PluginDefinition[] {
    return Array.from(this.plugins.values()).filter(
      (p) => p.manifest.targetAppId === appId
    );
  }

  getActivePlugins(appId: string): PluginDefinition[] {
    return this.getPluginsForApp(appId).filter((p) => p.state === "ACTIVE");
  }

  getPluginsByState(state: PluginState): PluginDefinition[] {
    return Array.from(this.plugins.values()).filter((p) => p.state === state);
  }

  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  updateState(pluginId: string, state: PluginState, error?: string): void {
    const p = this.plugins.get(pluginId);
    if (p) {
      p.state = state;
      if (error !== undefined) {
        p.error = error;
      }
    }
  }

  delete(pluginId: string): boolean {
    return this.plugins.delete(pluginId);
  }
}

export class PluginLifecycleManager {
  private registry: PluginRegistry;

  constructor(registry: PluginRegistry) {
    this.registry = registry;
  }

  validate(manifest: PluginManifest): { valid: boolean; error?: string } {
    if (!manifest.id || !manifest.targetAppId || !manifest.entrypoint) {
      return { valid: false, error: "Missing required manifest fields: id, targetAppId, or entrypoint." };
    }
    return { valid: true };
  }

  async activate(pluginId: string, instance?: unknown): Promise<void> {
    const plugin = this.registry.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin [${pluginId}] not found in registry.`);
    }

    if (instance) {
      plugin.instance = instance;
    }

    this.registry.updateState(pluginId, "ACTIVE");
  }

  async disable(pluginId: string): Promise<void> {
    const plugin = this.registry.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin [${pluginId}] not found in registry.`);
    }

    this.registry.updateState(pluginId, "DISABLED");
  }

  async unload(pluginId: string): Promise<void> {
    const plugin = this.registry.get(pluginId);
    if (!plugin) return;

    if (plugin.instance && typeof plugin.instance.dispose === "function") {
      try {
        await plugin.instance.dispose();
      } catch {
        // Suppress disposal errors during unload
      }
    }

    this.registry.updateState(pluginId, "UNLOADED");
    this.registry.delete(pluginId);
  }
}

export class PluginSandbox {
  static createContext(manifest: PluginManifest): PluginContext {
    const grantedPermissions = (manifest.permissions ?? []).map((p) => p.name);

    return {
      pluginId: manifest.id,
      targetAppId: manifest.targetAppId,
      capabilities: {},
      permissions: grantedPermissions,
      dispose: () => {},
    };
  }
}

export class PluginEngine {
  readonly registry = new PluginRegistry();
  readonly lifecycle = new PluginLifecycleManager(this.registry);

  async registerAndActivate(manifest: PluginManifest, instance?: unknown): Promise<void> {
    const validation = this.lifecycle.validate(manifest);
    if (!validation.valid) {
      throw new Error(`Plugin validation failed for [${manifest.id}]: ${validation.error}`);
    }

    this.registry.register({
      manifest,
      state: "VALIDATED",
    });

    const context = PluginSandbox.createContext(manifest);
    const p = this.registry.get(manifest.id);
    if (p) {
      p.context = context;
      p.state = "INITIALIZED";
    }

    await this.lifecycle.activate(manifest.id, instance);
  }
}
