/**
 * @mosaix/orm — Seeders & Factories
 */

import type { DatabasePort } from "@mosaix/ports-database";

export abstract class Seeder {
  abstract run(db: DatabasePort): Promise<void>;
}

export type FactoryDefinition<T> = (index: number) => Partial<T> | Record<string, unknown>;

export class Factory<T> {
  private definition: FactoryDefinition<T>;

  constructor(definition: FactoryDefinition<T>) {
    this.definition = definition;
  }

  make(count = 1): Array<Partial<T> | Record<string, unknown>> {
    const items: Array<Partial<T> | Record<string, unknown>> = [];
    for (let i = 0; i < count; i++) {
      items.push(this.definition(i));
    }
    return items;
  }
}
