/**
 * @mosaix/core — PlatformApplicationRuntime Orchestrator Kernel
 * @deprecated Legacy composition runtime. `RuntimeKernel` is the sole authoritative execution engine in MosaiX.
 * Orchestrates declarative platform application boot execution using ContextRegistry and ApplicationCompositionResolver.
 */

import type { Container } from "@mosaix/container";
import type { Router } from "@mosaix/http";
import type { ApplicationDefinition } from "@mosaix/contracts";
import { ContextRegistry, contextRegistry } from "./context-registry";
import { ApplicationCompositionResolver } from "./composition-resolver";
import { capabilityRegistry } from "./capability";
import { runtimeLifecycleEngine } from "./component-lifecycle";

/**
 * @deprecated Use `RuntimeKernel` instead. `RuntimeKernel` is the authoritative kernel engine.
 */
export class PlatformApplicationRuntime {
  private registry: ContextRegistry;
  private resolver: ApplicationCompositionResolver;

  constructor(registry: ContextRegistry = contextRegistry) {
    this.registry = registry;
    this.resolver = new ApplicationCompositionResolver(this.registry);
  }

  async bootApplication(
    appDef: ApplicationDefinition,
    container: Container,
    router?: Router
  ): Promise<{ success: boolean; bootedContexts: string[]; errors: string[] }> {
    const resolution = this.resolver.resolve(appDef);
    if (!resolution.valid) {
      return { success: false, bootedContexts: [], errors: resolution.errors };
    }

    const bootedContexts: string[] = [];

    for (const manifest of resolution.executionOrder) {
      const reg = this.registry.get(manifest.id);
      if (!reg) continue;

      // Register component in universal lifecycle engine (guarded chain)
      runtimeLifecycleEngine.registerComponent({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        type: "bac",
      });

      runtimeLifecycleEngine.transitionTo(manifest.id, "VALIDATED");
      runtimeLifecycleEngine.transitionTo(manifest.id, "RESOLVED");
      runtimeLifecycleEngine.transitionTo(manifest.id, "LOADED");

      // Register provided capabilities into CapabilityRegistry
      if (manifest.provides) {
        for (const capId of manifest.provides) {
          capabilityRegistry.register({
            id: capId,
            version: manifest.version,
            ownerContext: manifest.id,
            enabled: true,
          });
        }
      }

      // Instantiate & execute ServiceProvider
      const provider = reg.providerFactory();
      await provider.register(container);
      if (router && provider.boot) {
        await provider.boot(container, router);
      }

      runtimeLifecycleEngine.transitionTo(manifest.id, "INITIALIZED");
      runtimeLifecycleEngine.transitionTo(manifest.id, "ACTIVE");
      bootedContexts.push(manifest.id);
    }

    return { success: true, bootedContexts, errors: [] };
  }
}

export const platformApplicationRuntime = new PlatformApplicationRuntime();
