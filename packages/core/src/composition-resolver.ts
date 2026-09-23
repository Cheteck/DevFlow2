/**
 * @mosaix/core — Topological ApplicationCompositionResolver
 * Resolves application definitions into ordered execution plans using DAG dependency sorting.
 */

import type { ApplicationDefinition, ContextManifest } from "@mosaix/contracts";
import type { ContextRegistry } from "./context-registry";

export interface CompositionResolutionResult {
  valid: boolean;
  executionOrder: ContextManifest[];
  resolvedCapabilities: string[];
  errors: string[];
}

export class ApplicationCompositionResolver {
  private registry: ContextRegistry;

  constructor(registry: ContextRegistry) {
    this.registry = registry;
  }

  resolve(appDef: ApplicationDefinition): CompositionResolutionResult {
    const errors: string[] = [];
    const resolvedManifests: ContextManifest[] = [];
    const resolvedCapabilities = new Set<string>();

    // 1. Validate context presence (défensif : un def partiel legacy — ex.
    // marketplaceDef sans contexts — résout en composition vide plutôt qu'en crash)
    for (const ctxReq of appDef.contexts ?? []) {
      const reg = this.registry.get(ctxReq.id);
      if (!reg) {
        if (!ctxReq.optional) {
          errors.push(`Required context [${ctxReq.id}] is not registered in ContextRegistry.`);
        }
        continue;
      }
      resolvedManifests.push(reg.manifest);

      // Collect provided capabilities
      if (reg.manifest.provides) {
        for (const cap of reg.manifest.provides) {
          resolvedCapabilities.add(cap);
        }
      }
    }

    // 2. Validate capability requirements
    for (const capReq of appDef.capabilities ?? []) {
      if (!resolvedCapabilities.has(capReq.id)) {
        errors.push(`Application requires capability [${capReq.id}] which is not provided by any enabled context.`);
      }
    }

    // 3. Topological sort (DAG)
    const sorted: ContextManifest[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (manifest: ContextManifest) => {
      if (visiting.has(manifest.id)) {
        errors.push(`Circular dependency detected involving context [${manifest.id}].`);
        return;
      }
      if (!visited.has(manifest.id)) {
        visiting.add(manifest.id);
        if (manifest.requires) {
          for (const req of manifest.requires) {
            const reqReg = this.registry.get(req.id);
            if (reqReg) {
              visit(reqReg.manifest);
            }
          }
        }
        visiting.delete(manifest.id);
        visited.add(manifest.id);
        sorted.push(manifest);
      }
    };

    for (const manifest of resolvedManifests) {
      if (!visited.has(manifest.id)) {
        visit(manifest);
      }
    }

    return {
      valid: errors.length === 0,
      executionOrder: sorted,
      resolvedCapabilities: Array.from(resolvedCapabilities),
      errors,
    };
  }
}
