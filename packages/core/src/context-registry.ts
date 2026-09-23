/**
 * @mosaix/core — Path-Decoupled ContextRegistry
 * Central registry mapping context IDs to manifests, capability providers, and ServiceProvider factories.
 */

import type { ServiceProvider } from "@mosaix/container";
import type { ContextManifest } from "@mosaix/contracts";

export interface ContextRegistration {
  manifest: ContextManifest;
  providerFactory: () => ServiceProvider;
}

export class ContextRegistry {
  private registry = new Map<string, ContextRegistration>();

  register(manifest: ContextManifest, providerFactory: () => ServiceProvider): void {
    this.registry.set(manifest.id, { manifest, providerFactory });
  }

  get(id: string): ContextRegistration | undefined {
    return this.registry.get(id);
  }

  has(id: string): boolean {
    return this.registry.has(id);
  }

  list(): ContextManifest[] {
    return Array.from(this.registry.values()).map((r) => r.manifest);
  }

  clear(): void {
    this.registry.clear();
  }
}

export const contextRegistry = new ContextRegistry();
