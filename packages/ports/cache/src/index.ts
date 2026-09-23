export interface CacheOptions {
  /** Time to live in seconds. */
  ttl?: number;
}

/**
 * CachePort — Decouples application caching from memory, Redis or other cache providers.
 */
export interface CachePort {
  /** Asynchronously gets an item from the cache. */
  get<T>(key: string): Promise<T | undefined>;
  /** Asynchronously sets an item in the cache. */
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  /** Asynchronously deletes an item from the cache. */
  delete(key: string): Promise<void>;
  /** Asynchronously clears all items in the cache. */
  clear(): Promise<void>;
}
