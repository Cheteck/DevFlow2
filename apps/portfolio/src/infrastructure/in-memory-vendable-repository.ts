import type { Vendable } from "../domain/vendable.js";
import type { VendableRepository } from "../domain/vendable-repository.js";
import { InMemoryGuard } from "@mosaix/support";

export class InMemoryVendableRepository implements VendableRepository {
  private vendables = new Map<string, Vendable>();

  constructor() {
    InMemoryGuard.reportFallback("InMemoryVendableRepository");
  }

  save(vendable: Vendable): void {
    this.vendables.set(vendable.identity.id, vendable);
  }

  findById(id: string): Vendable | undefined {
    return this.vendables.get(id);
  }

  findByReference(reference: string): Vendable | undefined {
    for (const v of this.vendables.values()) {
      if (v.identity.reference === reference) {
        return v;
      }
    }
    return undefined;
  }

  findAll(): Vendable[] {
    return Array.from(this.vendables.values());
  }

  delete(id: string): void {
    this.vendables.delete(id);
  }
}
