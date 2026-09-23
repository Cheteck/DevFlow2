# @mosaix/adapter-search-elasticsearch

Elasticsearch search adapter implementing [`SearchPort`](../../ports/search), built on `@elastic/elasticsearch`.

## Constructor

```typescript
new ElasticsearchSearchAdapter(clientOrConfig?: Client | { node?: string });
```

- **Client** — use an existing Elasticsearch client.
- **config object** — `{ node }`; defaults to `http://localhost:9200`.

## Features

- **index** — indexes a document under `indexName` with the given `id`.
- **search** — full-text `multi_match` over all fields, combined with exact-match `term` filters from `query.filters`. Honors `offset`/`limit` pagination. `total` is read from the ES hit count.
- **delete** — removes a document by id.

## Usage

```typescript
import { ElasticsearchSearchAdapter } from "@mosaix/adapter-search-elasticsearch";

const search = new ElasticsearchSearchAdapter({
  node: "http://localhost:9200",
});

await search.index("products", "123", {
  name: "Keyboard",
  category: "Electronics",
});
const res = await search.search("products", {
  term: "keyboard",
  filters: { category: "Electronics" },
});
```

## Related

- Port: [`@mosaix/ports-search`](../../ports/search)
