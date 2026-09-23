/**
 * @mosaix/core — Capability Runtime Primitive (legacy context primitive)
 * First-class runtime unit representing an exposed context capability.
 *
 * @deprecated Use `CapabilityRegistry` / `CapabilityEntry` from
 * `./capability-registry` (canonique : ownerApp + permissions + validators).
 * Ce fichier est conservé comme alias compat pour `application-runtime.ts`
 * et sera supprimé en v2 (voir PLAN kernel-remediation T9).
 */

export interface CapabilityDefinition {
  id: string; // e.g. "spaces.create"
  version: string;
  ownerContext: string; // e.g. "spaces"
  description?: string;
  requiredPermissions?: string[];
  routes?: string[];
  commands?: string[];
  events?: string[];
  enabled?: boolean;
}

export class CapabilityRegistry {
  private capabilities = new Map<string, CapabilityDefinition>();

  register(capability: CapabilityDefinition): void {
    this.capabilities.set(capability.id, { ...capability, enabled: capability.enabled ?? true });
  }

  get(id: string): CapabilityDefinition | undefined {
    return this.capabilities.get(id);
  }

  has(id: string): boolean {
    return this.capabilities.has(id);
  }

  list(): CapabilityDefinition[] {
    return Array.from(this.capabilities.values());
  }

  listActive(): CapabilityDefinition[] {
    return this.list().filter((c) => c.enabled !== false);
  }

  setCapabilityState(id: string, enabled: boolean): void {
    const cap = this.capabilities.get(id);
    if (cap) {
      cap.enabled = enabled;
    }
  }

  clear(): void {
    this.capabilities.clear();
  }
}

export const capabilityRegistry = new CapabilityRegistry();
