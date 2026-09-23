import type { CachePort, CacheOptions } from "@mosaix/ports-cache";

interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
}

export class MemoryCacheAdapter implements CachePort {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const entry: CacheEntry<unknown> = { value };
    if (options?.ttl !== undefined) {
      entry.expiresAt = Date.now() + options.ttl * 1000;
    }
    this.store.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
