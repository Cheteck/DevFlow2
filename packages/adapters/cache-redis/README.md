# @mosaix/adapter-cache-redis

Redis cache adapter implementing [`CachePort`](../../ports/cache), backed by [ioredis](https://github.com/redis/ioredis).

## Constructor

```typescript
new RedisCacheAdapter(clientOrOptions?: Redis | string | RedisCacheAdapterOptions);
```

- **Redis instance** — use an existing connected client.
- **string** — Redis connection URL (e.g. `redis://127.0.0.1:6379`).
- **connection options** — forwarded to `new Redis(...)` (e.g. `host`, `port`, `lazyConnect`).
- **`{ mock: true }`** — explicit in-memory mock client (no Redis connection).
- **nothing / empty object** — **throws**: a missing Redis configuration is an error, never a silent `lazyConnect` fallback.

## Features

- Values are **JSON-serialized** on `set` (except strings, stored as-is) and parsed on `get`. Raw non-JSON values are returned as strings.
- `set` with `ttl` uses Redis `SET key value EX ttl`.
- `clear()` issues `FLUSHDB` on the current database.
- `disconnect()` quits the client (not part of the port; call it during shutdown).

## Usage

```typescript
import { RedisCacheAdapter } from "@mosaix/adapter-cache-redis";

const cache = new RedisCacheAdapter("redis://127.0.0.1:6379");

await cache.set("key", { value: 123 }, { ttl: 3600 });
const data = await cache.get<{ value: number }>("key");
await cache.disconnect();
```

## Related

- Port: [`@mosaix/ports-cache`](../../ports/cache)
