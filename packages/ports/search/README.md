# @mosaix/ports-search

Search indexer and lookup port for the MosaiX platform. Decouples application indexing and full-text search from Elasticsearch, Meilisearch, etc.

## Exports

```typescript
export interface SearchQuery {
  term: string;
  limit?: number;
  offset?: number;
  filters?: Record<string, string | number | boolean>;
}

export interface SearchResult<T> {
  hits: T[];
  total: number;
}

export interface SearchPort {
  index<T>(indexName: string, id: string, document: T): Promise<void>;
  search<T>(indexName: string, query: SearchQuery): Promise<SearchResult<T>>;
  delete(indexName: string, id: string): Promise<void>;
}
```

## Notes

- `total` reflects the full match count before pagination; `hits` is the paginated slice.
- `filters` are exact-match field filters applied in addition to the full-text `term`.

## Usage

```typescript
import type { SearchPort } from "@mosaix/ports-search";

class MyService {
  constructor(private readonly searchService: SearchPort) {}

  async indexProduct(product: { id: string; name: string; category: string }) {
    await this.searchService.index("products", product.id, product);
  }

  async searchProducts(term: string) {
    const res = await this.searchService.search("products", {
      term,
      limit: 20,
      filters: { category: "Electronics" },
    });
    return res.hits;
  }
}
```

## Adapters

- [`@mosaix/adapter-search-memory`](../../adapters/search-memory) — in-memory substring search, for tests and local dev.
- [`@mosaix/adapter-search-elasticsearch`](../../adapters/search-elasticsearch) — Elasticsearch.
