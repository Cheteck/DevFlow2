/**
 * @mosaix/gateway — Token Bucket RateLimiter with Distributed Cache Store Support (Phase 17)
 */

import type { CachePort } from "@mosaix/ports-cache";

export interface RateLimiterOptions {
  capacity: number;
  refillRatePerSecond: number;
  distributedStore?: CachePort | undefined;
}

export class RateLimiter {
  private readonly capacity: number;
  private readonly refillRate: number;
  private readonly distributedStore: CachePort | undefined;
  private readonly localTokens = new Map<string, { count: number; lastRefill: number }>();

  constructor(options: RateLimiterOptions) {
    this.capacity = options.capacity;
    this.refillRate = options.refillRatePerSecond;
    this.distributedStore = options.distributedStore;
  }

  async consume(key: string, cost = 1): Promise<{ allowed: boolean; remaining: number }> {
    if (this.distributedStore) {
      try {
        const redisKey = `ratelimit:${key}`;
        const current = (await this.distributedStore.get<number>(redisKey)) ?? this.capacity;
        if (current >= cost) {
          const remaining = current - cost;
          await this.distributedStore.set(redisKey, remaining, { ttl: Math.ceil(this.capacity / this.refillRate) });
          return { allowed: true, remaining };
        }
        return { allowed: false, remaining: current };
      } catch {
        // Fallback to in-memory bucket if distributed store is unreachable
      }
    }

    const now = Date.now();
    let bucket = this.localTokens.get(key);

    if (!bucket) {
      bucket = { count: this.capacity, lastRefill: now };
      this.localTokens.set(key, bucket);
    } else {
      const elapsedSeconds = (now - bucket.lastRefill) / 1000;
      const refilledTokens = Math.floor(elapsedSeconds * this.refillRate);
      if (refilledTokens > 0) {
        bucket.count = Math.min(this.capacity, bucket.count + refilledTokens);
        bucket.lastRefill = now;
      }
    }

    if (bucket.count >= cost) {
      bucket.count -= cost;
      return { allowed: true, remaining: bucket.count };
    }

    return { allowed: false, remaining: bucket.count };
  }
}
