/**
 * @mosaix/plugin-engine/runtime — Plugin Lifecycle Manager, Engine, Registry & Sandbox
 */

import type { PluginDefinition, PluginManifest, PluginState } from "../core/index.js";
import { HookExecutionEngine, type HookExecutionOptions, type HookExecutionResult, type HookHandler } from "./hook-engine.js";
import { PluginSettingsManager } from "./plugin-settings.js";
import { PluginEventBus } from "./plugin-event-bus.js";
import { CapabilityRegistry, PluginCapabilityResolver } from "./capability-resolver.js";
import { PluginSandboxEnvironment, type SandboxedPluginContext } from "./plugin-sandbox.js";
import type { PluginCapabilityGrant } from "../plugin-capability-model.js";

export * from "./hook-engine.js";
export * from "./plugin-settings.js";
export * from "./plugin-event-bus.js";
export * from "./capability-resolver.js";
export * from "./plugin-sandbox.js";

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

  list(): PluginDefinition[] {
    return Array.from(this.plugins.values());
  }
}

export class PluginLifecycleManager {
  constructor(
    private readonly registry: PluginRegistry,
    private readonly hookEngine: HookExecutionEngine,
    private readonly eventBus: PluginEventBus
  ) {}

  validate(manifest: PluginManifest): { valid: boolean; error?: string } {
    if (!manifest.id || !manifest.targetAppId || !manifest.entrypoint) {
      return { valid: false, error: "Missing required manifest fields: id, targetAppId, or entrypoint." };
    }
    if (!manifest.version) {
      return { valid: false, error: "Missing required manifest version." };
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

    // 1. Dispose context
    const ctx = plugin.context as { dispose?: () => Promise<void> | void } | undefined;
    if (ctx && typeof ctx.dispose === "function") {
      try {
        await ctx.dispose();
      } catch {
        // Suppress context disposal errors
      }
    }

    // 2. Dispose instance
    const inst = plugin.instance as { dispose?: () => Promise<void> | void } | undefined;
    if (inst && typeof inst.dispose === "function") {
      try {
        await inst.dispose();
      } catch {
        // Suppress instance disposal errors
      }
    }

    // 3. Clean up hooks & events
    this.hookEngine.unregisterPluginHooks(pluginId);
    this.eventBus.unsubscribePlugin(pluginId);

    this.registry.updateState(pluginId, "UNLOADED");
    this.registry.delete(pluginId);
  }
}

export class PluginEngine {
  readonly registry = new PluginRegistry();
  readonly capabilities = new CapabilityRegistry();
  readonly resolver = new PluginCapabilityResolver(this.capabilities);
  readonly hooks = new HookExecutionEngine();
  readonly eventBus = new PluginEventBus();
  readonly lifecycle = new PluginLifecycleManager(this.registry, this.hooks, this.eventBus);

  /**
   * Run all hooks on a given extension point
   */
  async runHook<T = unknown, R = unknown>(
    point: string,
    args: T,
    options?: HookExecutionOptions,
    context?: unknown
  ): Promise<HookExecutionResult<R>> {
    return this.hooks.runHook<T, R>(point, args, options, context);
  }

  /**
   * Register a hook directly on the engine
   */
  registerHook<T = unknown, R = unknown>(
    point: string,
    handler: HookHandler<T, R>,
    options?: { priority?: number; pluginId?: string }
  ): string {
    return this.hooks.registerHook(point, handler, options);
  }

  /**
   * Register and initialize a plugin with full capability resolution, sandbox creation, and settings validation
   */
  async registerAndActivate<TSettings extends Record<string, unknown> = Record<string, unknown>>(
    manifest: PluginManifest,
    options?: {
      rawSettings?: Record<string, unknown>;
      grants?: PluginCapabilityGrant[];
      instanceFactory?: (context: SandboxedPluginContext<TSettings>) => unknown | Promise<unknown>;
    }
  ): Promise<PluginDefinition<TSettings>> {
    // 1. Validate manifest
    const validation = this.lifecycle.validate(manifest);
    if (!validation.valid) {
      throw new Error(`Plugin validation failed for [${manifest.id}]: ${validation.error}`);
    }

    // 2. Validate & initialize settings
    const settingsManager = new PluginSettingsManager<TSettings>(
      manifest.settingsSchema,
      options?.rawSettings ?? {}
    );

    // 3. Resolve required capabilities
    const capResolution = this.resolver.resolve(manifest, options?.grants ?? []);
    if (!capResolution.resolved) {
      const err = `Capability resolution failed for [${manifest.id}]. Missing: [${capResolution.missingCapabilities.join(", ")}], Denied: [${capResolution.deniedCapabilities.join(", ")}]`;
      throw new Error(err);
    }

    // 4. Create Sandboxed Context
    const sandboxedContext = PluginSandboxEnvironment.createSandboxedContext<TSettings>(
      manifest,
      capResolution.injectedCapabilities,
      settingsManager,
      this.eventBus,
      this.hooks
    );

    const definition: PluginDefinition<TSettings> = {
      manifest,
      state: "INITIALIZED",
      context: sandboxedContext,
      settings: settingsManager.get(),
      loadedAt: new Date().toISOString(),
    };

    this.registry.register(definition as PluginDefinition);

    // 5. Instantiate and activate instance inside sandbox boundary
    if (options?.instanceFactory) {
      const instance = await PluginSandboxEnvironment.runIsolated(async () => {
        return await options.instanceFactory!(sandboxedContext);
      });
      definition.instance = instance;
    }

    await this.lifecycle.activate(manifest.id, definition.instance);

    return definition;
  }
}
