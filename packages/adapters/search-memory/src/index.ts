import type {
  SearchPort,
  SearchQuery,
  SearchResult,
} from "@mosaix/ports-search";

export class MemorySearchAdapter implements SearchPort {
  private readonly indexes = new Map<string, Map<string, unknown>>();

  async index<T>(indexName: string, id: string, document: T): Promise<void> {
    let index = this.indexes.get(indexName);
    if (!index) {
      index = new Map();
      this.indexes.set(indexName, index);
    }
    index.set(id, document);
  }

  async search<T>(
    indexName: string,
    query: SearchQuery,
  ): Promise<SearchResult<T>> {
    const index = this.indexes.get(indexName);
    if (!index) {
      return { hits: [], total: 0 };
    }

    const term = query.term.toLowerCase();
    const hits: T[] = [];

    for (const doc of index.values()) {
      const match = JSON.stringify(doc).toLowerCase().includes(term);
      if (match) {
        // Evaluate custom filters if provided
        let filterMatch = true;
        if (query.filters) {
          const docRecord = doc as Record<string, unknown>;
          for (const [key, val] of Object.entries(query.filters)) {
            if (docRecord[key] !== val) {
              filterMatch = false;
              break;
            }
          }
        }
        if (filterMatch) {
          hits.push(doc as T);
        }
      }
    }

    const total = hits.length;
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 10;
    const paginated = hits.slice(offset, offset + limit);

    return { hits: paginated, total };
  }

  async delete(indexName: string, id: string): Promise<void> {
    const index = this.indexes.get(indexName);
    if (index) {
      index.delete(id);
    }
  }
}
