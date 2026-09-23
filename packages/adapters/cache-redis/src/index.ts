import Redis from "ioredis";
import type { RedisOptions } from "ioredis";
import type { CachePort, CacheOptions } from "@mosaix/ports-cache";

export interface RedisCacheAdapterOptions {
  /** Explicitly opt into the in-memory mock client (no Redis connection). */
  mock?: boolean;
  /** Redis server host. */
  host?: string;
  /** Redis server port. */
  port?: number;
  /** Unix socket path (when connecting over a local socket). */
  path?: string;
  /** Additional ioredis connection options forwarded to `new Redis(...)`. */
  [key: string]: unknown;
}

/** Minimal in-memory stand-in for the redis client surface the adapter uses. */
export class InMemoryRedisClient {
  private readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(
    key: string,
    value: string,
    mode?: string,
    ttl?: number,
  ): Promise<"OK"> {
    this.store.set(key, value);
    if (mode === "EX" && ttl !== undefined) {
      // TTL is not enforced by the in-memory mock; entries live until deleted.
    }
    return "OK";
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async flushdb(): Promise<void> {
    this.store.clear();
  }

  async quit(): Promise<void> {}
}

export class RedisCacheAdapter implements CachePort {
  private readonly client: Redis | InMemoryRedisClient;

  constructor(clientOrOptions?: Redis | string | RedisCacheAdapterOptions) {
    if (
      clientOrOptions &&
      typeof clientOrOptions === "object" &&
      typeof clientOrOptions.get === "function"
    ) {
      this.client = clientOrOptions as Redis;
      return;
    }

    if (typeof clientOrOptions === "string") {
      this.client = new Redis(clientOrOptions);
      return;
    }

    const options: RedisCacheAdapterOptions =
      (clientOrOptions as RedisCacheAdapterOptions | undefined) ?? {};

    if (options.mock === true) {
      this.client = new InMemoryRedisClient();
      return;
    }

    const { mock: _mock, ...connection } = options;
    if (Object.keys(connection).length === 0) {
      throw new Error(
        "RedisCacheAdapter: missing Redis connection configuration. Provide a Redis instance, a connection URL/options (e.g. `host`, `port`), or `{ mock: true }` to explicitly opt into the in-memory mock client.",
      );
    }

    this.client = new Redis(connection as RedisOptions);
  }

  async get<T>(key: string): Promise<T | undefined> {
    const raw = await this.client.get(key);
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const serialized =
      typeof value === "string" ? value : JSON.stringify(value);
    if (options?.ttl !== undefined) {
      await this.client.set(key, serialized, "EX", options.ttl);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async clear(): Promise<void> {
    await this.client.flushdb();
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}
