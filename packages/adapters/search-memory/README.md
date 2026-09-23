# @mosaix/adapter-search-memory

In-memory search indexer adapter implementing [`SearchPort`](../../ports/search). Ideal for tests and local development.

## Features

- **index** — stores a document by `id` in a per-index map.
- **search** — case-insensitive substring match on the JSON-serialized document, plus exact-match `filters`. Defaults: `limit = 10`, `offset = 0`. `total` is the full match count before pagination.
- **delete** — removes a document by id.

## Usage

```typescript
import { MemorySearchAdapter } from "@mosaix/adapter-search-memory";

const search = new MemorySearchAdapter();
await search.index("books", "1", { title: "Dune", author: "Frank Herbert" });

const res = await search.search("books", { term: "frank" });
// { hits: [{ title: "Dune", author: "Frank Herbert" }], total: 1 }
```

## Related

- Port: [`@mosaix/ports-search`](../../ports/search)
