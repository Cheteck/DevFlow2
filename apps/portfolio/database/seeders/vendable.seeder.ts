/**
 * @apps/portfolio — Vendable Seeder & Factory
 */

import { Factory, Seeder } from "@mosaix/sdk";
import type { DatabasePort } from "@mosaix/ports-database";
import { VendableModel } from "../../src/infrastructure/persistence/vendable.model";

export const VendableFactory = new Factory<VendableModel>((i) => ({
  id: `vend-${i + 1}`,
  title: `Product ${i + 1}`,
  type: "product",
  status: "Published",
}));

export class VendableSeeder extends Seeder {
  async run(db: DatabasePort): Promise<void> {
    const sampleVendables = VendableFactory.make(3);
    for (const item of sampleVendables) {
      await db.execute(
        `INSERT INTO vendables (id, title, type, status) VALUES (?, ?, ?, ?)`,
        [item.id, item.title, item.type, item.status]
      );
    }
  }
}
