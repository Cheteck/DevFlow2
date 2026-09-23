import type { Vendable } from "./vendable";

export interface VendableRepository {
  save(vendable: Vendable): Promise<void> | void;
  findById(id: string): Promise<Vendable | undefined> | Vendable | undefined;
  findByReference(
    reference: string,
  ): Promise<Vendable | undefined> | Vendable | undefined;
  findAll(): Promise<Vendable[]> | Vendable[];
  delete(id: string): Promise<void> | void;
}
