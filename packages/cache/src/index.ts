import type { CachePort } from "@mosaix/ports-cache";

export class CacheService implements CachePort {
  constructor(private readonly driver: CachePort) {}

  async get<T = unknown>(key: string): Promise<T | null | undefined> {
    return this.driver.get<T>(key);
  }

  async set<T = unknown>(key: string, value: T, options?: { ttl?: number }): Promise<void> {
    return this.driver.set(key, value, options);
  }

  async delete(key: string): Promise<void> {
    return this.driver.delete(key);
  }

  async clear(): Promise<void> {
    if (this.driver.clear) {
      await this.driver.clear();
    }
  }
}

export type { CachePort };
