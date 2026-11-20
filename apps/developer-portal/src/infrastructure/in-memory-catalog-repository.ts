/**
 * @ijideals/developer-portal — In-memory catalog projection.
 * Usage : tests et mode démo uniquement.
 */

import type { CatalogEntry } from "../domain/catalog-entry.js";
import type {
  CatalogQuery,
  CatalogRepository,
} from "../domain/catalog-repository.js";

export class InMemoryCatalogRepository implements CatalogRepository {
  private readonly entries = new Map<string, CatalogEntry>();

  async findAll(query?: CatalogQuery): Promise<CatalogEntry[]> {
    const all = [...this.entries.values()];
    if (!query) return all;

    const text = query.text?.trim().toLowerCase();
    return all.filter((entry) => {
      if (query.type && entry.type !== query.type) return false;
      if (!text) return true;
      return (
        entry.name.toLowerCase().includes(text) ||
        entry.description.toLowerCase().includes(text)
      );
    });
  }

  async findById(id: string): Promise<CatalogEntry | undefined> {
    return this.entries.get(id);
  }

  async findBySourceId(sourceId: string): Promise<CatalogEntry | undefined> {
    for (const entry of this.entries.values()) {
      if (entry.sourceId === sourceId) return entry;
    }
    return undefined;
  }

  async save(entry: CatalogEntry): Promise<CatalogEntry> {
    this.entries.set(entry.id, entry);
    return entry;
  }

  async delete(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }
}
