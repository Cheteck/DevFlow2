# @mosaix/ports-cache

Cache port for the MosaiX platform. Decouples application caching from memory, Redis or other cache providers.

## Exports

```typescript
export interface CacheOptions {
  /** Time to live in seconds. */
  ttl?: number;
}

export interface CachePort {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}
```

## Usage

```typescript
import type { CachePort } from "@mosaix/ports-cache";

class MyService {
  constructor(private readonly cache: CachePort) {}

  async getCachedUser(id: string) {
    const cached = await this.cache.get(`user:${id}`);
    if (cached) return cached;
    // ...
  }

  async cacheUser(id: string, user: unknown) {
    await this.cache.set(`user:${id}`, user, { ttl: 300 });
  }
}
```

## Adapters

- [`@mosaix/adapter-cache-memory`](../../adapters/cache-memory) — in-memory `Map` with TTL.
- [`@mosaix/adapter-cache-redis`](../../adapters/cache-redis) — Redis via `ioredis`, JSON serialization.
