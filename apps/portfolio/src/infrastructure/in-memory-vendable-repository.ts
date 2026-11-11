import type { Vendable } from "../domain/vendable.js";
import type { VendableRepository } from "../domain/vendable-repository.js";
import { InMemoryGuard } from "@mosaix/support";

export class InMemoryVendableRepository implements VendableRepository {
  private vendables = new Map<string, { vendable: Vendable; tenantId: string }>();

  constructor() {
    InMemoryGuard.reportFallback("InMemoryVendableRepository");
  }

  save(vendable: Vendable, tenantId: string): void {
    this.vendables.set(vendable.identity.id, { vendable, tenantId });
  }

  findById(id: string, tenantId: string): Vendable | undefined {
    const entry = this.vendables.get(id);
    if (!entry || entry.tenantId !== tenantId) return undefined;
    // Return a deep copy to prevent external mutations
    return JSON.parse(JSON.stringify(entry.vendable));
  }

  findByReference(reference: string, tenantId: string): Vendable | undefined {
    for (const entry of this.vendables.values()) {
      if (entry.tenantId === tenantId && entry.vendable.identity.reference === reference) {
        return JSON.parse(JSON.stringify(entry.vendable));
      }
    }
    return undefined;
  }

  findAll(tenantId: string): Vendable[] {
    return Array.from(this.vendables.values())
      .filter((entry) => entry.tenantId === tenantId)
      .map((entry) => JSON.parse(JSON.stringify(entry.vendable)));
  }

  delete(id: string, tenantId: string): void {
    const entry = this.vendables.get(id);
    if (entry && entry.tenantId === tenantId) {
      this.vendables.delete(id);
    }
  }
}
