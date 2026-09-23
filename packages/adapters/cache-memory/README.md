# @mosaix/adapter-cache-memory

In-memory cache adapter implementing [`CachePort`](../../ports/cache). Stores entries in a `Map` with optional TTL expiry. Ideal for tests and local development.

## Features

- **TTL** — entries expire `ttl` seconds after being set; expired entries are removed lazily on read.
- No external dependencies, fully synchronous underneath an async interface.

## Usage

```typescript
import { MemoryCacheAdapter } from "@mosaix/adapter-cache-memory";

const cache = new MemoryCacheAdapter();

await cache.set("key", "value", { ttl: 60 });
const value = await cache.get("key"); // "value"

await cache.set("user:1", { name: "Ada" });
await cache.delete("user:1");
await cache.clear();
```

## Related

- Port: [`@mosaix/ports-cache`](../../ports/cache)
