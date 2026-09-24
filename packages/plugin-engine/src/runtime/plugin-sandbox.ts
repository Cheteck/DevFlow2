/**
 * @mosaix/plugin-engine/runtime — Plugin Sandbox Environment
 */

import type { PluginManifest } from "../core/index.js";
import type { PluginEventBus } from "./plugin-event-bus.js";
import type { HookExecutionEngine } from "./hook-engine.js";
import type { PluginSettingsManager } from "./plugin-settings.js";

export interface SandboxExecutionOptions {
  timeoutMs?: number;
  memoryLimitMb?: number;
}

export interface SandboxedPluginContext<TSettings = Record<string, unknown>> {
  pluginId: string;
  targetAppId: string;
  version: string;
  capabilities: Readonly<Record<string, unknown>>;
  permissions: readonly string[];
  settings: Readonly<TSettings>;
  events: {
    publish: <T = unknown>(topic: string, payload: T) => Promise<void>;
    subscribe: <T = unknown>(topic: string, listener: (event: { topic: string; payload: T }) => void) => () => void;
  };
  hooks: {
    register: <T = unknown, R = unknown>(point: string, handler: (payload: T) => Promise<R> | R, priority?: number) => string;
  };
  logger: {
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
  dispose: () => Promise<void> | void;
}

export class PluginSandboxEnvironment {
  /**
   * Create an isolated sandboxed plugin context
   */
  static createSandboxedContext<TSettings extends Record<string, unknown> = Record<string, unknown>>(
    manifest: PluginManifest,
    injectedCapabilities: Record<string, unknown>,
    settingsManager: PluginSettingsManager<TSettings>,
    eventBus: PluginEventBus,
    hookEngine: HookExecutionEngine
  ): SandboxedPluginContext<TSettings> {
    const grantedPermissions = (manifest.permissions ?? []).map((p) => p.name);
    const registeredHookIds: string[] = [];
    const registeredSubIds: string[] = [];

    const context: SandboxedPluginContext<TSettings> = {
      pluginId: manifest.id,
      targetAppId: manifest.targetAppId,
      version: manifest.version,
      capabilities: Object.freeze({ ...injectedCapabilities }),
      permissions: Object.freeze([...grantedPermissions]),
      settings: settingsManager.get(),
      events: {
        publish: async <T = unknown>(topic: string, payload: T) => {
          await eventBus.publish(topic, manifest.id, payload);
        },
        subscribe: <T = unknown>(topic: string, listener: (event: { topic: string; payload: T }) => void) => {
          const sub = eventBus.subscribe(topic, manifest.id, (evt) => {
            listener({ topic: evt.topic, payload: evt.payload as T });
          });
          registeredSubIds.push(sub.id);
          return () => sub.unsubscribe();
        },
      },
      hooks: {
        register: <T = unknown, R = unknown>(point: string, handler: (payload: T) => Promise<R> | R, priority?: number) => {
          const id = hookEngine.registerHook(point, handler, {
            priority,
            pluginId: manifest.id,
          });
          registeredHookIds.push(id);
          return id;
        },
      },
      logger: {
        info: (msg, ...args) => console.log(`[Plugin:${manifest.id}] ${msg}`, ...args),
        warn: (msg, ...args) => console.warn(`[Plugin:${manifest.id}] ⚠️ ${msg}`, ...args),
        error: (msg, ...args) => console.error(`[Plugin:${manifest.id}] ❌ ${msg}`, ...args),
      },
      dispose: async () => {
        // Clean up all hooks, subscriptions and resources
        for (const hid of registeredHookIds) {
          hookEngine.unregisterHook(hid);
        }
        eventBus.unsubscribePlugin(manifest.id);
      },
    };

    return context;
  }

  /**
   * Run sandboxed entrypoint execution with timeout and boundary isolation
   */
  static async runIsolated<TResult = unknown>(
    fn: () => Promise<TResult> | TResult,
    options: SandboxExecutionOptions = {}
  ): Promise<TResult> {
    const timeoutMs = options.timeoutMs ?? 5000;
    let timer: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Sandbox execution exceeded timeout threshold of ${timeoutMs}ms.`));
      }, timeoutMs);
    });

    try {
      const res = await Promise.race([Promise.resolve(fn()), timeoutPromise]);
      return res;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
