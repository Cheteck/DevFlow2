/**
 * @mosaix/shell — Dynamic & Pluggable BAC Registry
 * Manages runtime registration, dynamic loaders, and discovery for Bounded App Contexts.
 */

import type { BacDescriptor } from "@mosaix/contracts";

export interface BacPluginRegistration {
  id: string;
  contributions: unknown[];
  pageViews?: Array<[string, unknown]>;
  dynamicLoader?: () => Promise<unknown>;
  descriptor?: BacDescriptor;
}

export type DynamicModuleLoader = () => Promise<{
  contributions?: unknown[];
  pageViews?: Array<[string, unknown]>;
  [key: string]: unknown;
}>;

export class DynamicBacRegistry {
  private static registry = new Map<string, BacPluginRegistration>();
  private static dynamicLoaders = new Map<string, DynamicModuleLoader>();
  private static listeners = new Set<(plugin: BacPluginRegistration) => void>();

  static {
    // Register canonical core modules
    const coreModules = [
      "citadelle",
      "solara",
      "solidarity",
      "imperia",
      "spaces",
      "commerce",
      "beam",
      "portfolio",
      "booking",
      "subscription",
    ];

    for (const mod of coreModules) {
      this.register({
        id: mod,
        contributions: [],
        pageViews: [],
      });
    }
  }

  static register(plugin: BacPluginRegistration): void {
    const cleanId = plugin.id.replace(/^@apps\//, "");
    this.registry.set(cleanId, plugin);
    this.registry.set(plugin.id, plugin);

    for (const listener of this.listeners) {
      try {
        listener(plugin);
      } catch (err) {
        console.error(`[DynamicBacRegistry] Listener error on plugin ${plugin.id}:`, err);
      }
    }
  }

  static registerDynamicLoader(id: string, loader: DynamicModuleLoader): void {
    const cleanId = id.replace(/^@apps\//, "");
    this.dynamicLoaders.set(cleanId, loader);
    this.dynamicLoaders.set(id, loader);
  }

  static async loadDynamicModule(id: string): Promise<BacPluginRegistration | undefined> {
    const cleanId = id.replace(/^@apps\//, "");
    const existing = this.get(cleanId);
    if (existing && existing.contributions.length > 0) return existing;

    const loader = this.dynamicLoaders.get(cleanId);
    if (!loader) return existing;

    try {
      const moduleExport = await loader();
      const registration: BacPluginRegistration = {
        id: cleanId,
        contributions: moduleExport.contributions || [],
        pageViews: moduleExport.pageViews || [],
      };
      this.register(registration);
      return registration;
    } catch (err) {
      console.error(`[DynamicBacRegistry] Failed to load dynamic module [${id}]:`, err);
      return existing;
    }
  }

  static get(id: string): BacPluginRegistration | undefined {
    const cleanId = id.replace(/^@apps\//, "");
    return this.registry.get(cleanId) || this.registry.get(id);
  }

  static has(id: string): boolean {
    const cleanId = id.replace(/^@apps\//, "");
    return this.registry.has(cleanId) || this.dynamicLoaders.has(cleanId);
  }

  static getAll(): BacPluginRegistration[] {
    return Array.from(new Set(this.registry.values()));
  }

  static getAllContributions(): unknown[] {
    return this.getAll().flatMap((b) => b.contributions);
  }

  static onPluginRegistered(listener: (plugin: BacPluginRegistration) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

// Export backward-compatible array for seamless transition
export const bacRegistry = DynamicBacRegistry.getAll();
