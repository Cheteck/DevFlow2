import type { Vendable } from "../domain/vendable";
import type { VendableRepository } from "../domain/vendable-repository";

export class InMemoryVendableRepository implements VendableRepository {
  private vendables = new Map<string, Vendable>();

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
