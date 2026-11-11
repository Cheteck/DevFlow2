import type { Vendable } from "./vendable.js";

export interface VendableRepository {
  save(vendable: Vendable, tenantId: string): Promise<void> | void;
  findById(id: string, tenantId: string): Promise<Vendable | undefined> | Vendable | undefined;
  findByReference(
    reference: string,
    tenantId: string,
  ): Promise<Vendable | undefined> | Vendable | undefined;
  findAll(tenantId: string): Promise<Vendable[]> | Vendable[];
  delete(id: string, tenantId: string): Promise<void> | void;
}
