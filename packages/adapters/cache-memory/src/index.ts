import type { CachePort } from "@mosaix/ports-cache";

interface CacheEntry {
  value: unknown;
  expiresAt: number | null;
}

export class MemoryCacheAdapter implements CachePort {
  private readonly store = new Map<string, CacheEntry>();

  async get<T = unknown>(key: string): Promise<T | null | undefined> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T = unknown>(key: string, value: T, options?: { ttl?: number }): Promise<void> {
    const ttl = options?.ttl;
    const expiresAt = ttl !== undefined ? Date.now() + ttl * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
