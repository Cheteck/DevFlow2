import type { CachePort } from "@mosaix/ports-cache";

export class Cache {
  protected store: CachePort;

  constructor(store: CachePort) {
    this.store = store;
  }

  /**
   * Get an item from the cache.
   */
  async get<T>(
    key: string,
    fallback?: T | (() => T | Promise<T>),
  ): Promise<T | undefined> {
    const value = await this.store.get<T>(key);

    if (value !== undefined) {
      return value;
    }

    if (fallback !== undefined) {
      if (typeof fallback === "function") {
        return (fallback as () => T | Promise<T>)();
      }
      return fallback;
    }

    return undefined;
  }

  /**
   * Set an item in the cache with an optional TTL (in seconds).
   */
  async put<T>(key: string, value: T, ttl?: number): Promise<void> {
    const options: { ttl?: number } = {};
    if (ttl !== undefined) {
      options.ttl = ttl;
    }
    await this.store.set<T>(key, value, options);
  }

  /**
   * Get an item from the cache, or execute the given factory and store it.
   */
  async remember<T>(
    key: string,
    ttl: number,
    factory: () => T | Promise<T>,
  ): Promise<T> {
    const value = await this.get<T>(key);

    if (value !== undefined) {
      return value;
    }

    const newValue = await factory();
    await this.put<T>(key, newValue, ttl);
    return newValue;
  }

  /**
   * Delete an item from the cache.
   */
  async forget(key: string): Promise<void> {
    await this.store.delete(key);
  }

  /**
   * Determine if an item exists in the cache.
   */
  async has(key: string): Promise<boolean> {
    const value = await this.store.get(key);
    return value !== undefined;
  }

  /**
   * Increment the value of an item in the cache.
   */
  async increment(key: string, value = 1): Promise<number> {
    const current = await this.get<number>(key);
    const start =
      current !== undefined && typeof current === "number" ? current : 0;
    const next = start + value;
    await this.put<number>(key, next);
    return next;
  }

  /**
   * Decrement the value of an item in the cache.
   */
  async decrement(key: string, value = 1): Promise<number> {
    return this.increment(key, -value);
  }
}
