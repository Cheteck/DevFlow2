/**
 * @mosaix/shell — LRU Fragment Cache for High-Throughput SSR
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class FragmentCache<T = string> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;

  constructor(maxEntries: number = 200, defaultTtlMs: number = 60_000) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Refresh position for LRU
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  getOrCompute(key: string, computeFn: () => T, ttlMs?: number): T {
    const existing = this.get(key);
    if (existing !== undefined) {
      return existing;
    }

    const computed = computeFn();
    this.set(key, computed, ttlMs);
    return computed;
  }

  invalidate(keyPrefix?: string): void {
    if (!keyPrefix) {
      this.cache.clear();
      return;
    }

    for (const k of this.cache.keys()) {
      if (k.startsWith(keyPrefix)) {
        this.cache.delete(k);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }
}

export const ssrFragmentCache = new FragmentCache<string>(500, 30_000); // 30s TTL
