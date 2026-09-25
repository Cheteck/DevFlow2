import type { CachePort } from "@mosaix/ports-cache";
import Redis from "ioredis";

export class RedisCacheAdapter implements CachePort {
  private readonly redis: Redis;

  constructor(redisOrUrl: Redis | string) {
    if (typeof redisOrUrl === "string") {
      this.redis = new Redis(redisOrUrl);
    } else {
      this.redis = redisOrUrl;
    }
  }

  async get<T = unknown>(key: string): Promise<T | null | undefined> {
    const data = await this.redis.get(key);
    if (data === null) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as unknown as T;
    }
  }

  async set<T = unknown>(key: string, value: T, options?: { ttl?: number }): Promise<void> {
    const data = typeof value === "string" ? value : JSON.stringify(value);
    const ttl = options?.ttl;
    if (ttl !== undefined && ttl > 0) {
      await this.redis.set(key, data, "EX", ttl);
    } else {
      await this.redis.set(key, data);
    }
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async clear(): Promise<void> {
    await this.redis.flushdb();
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
