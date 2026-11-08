import { OtpCacheRateLimiterAdapter } from "./index.js";
import type { CachePort } from "@mosaix/ports-cache";

class MockCache implements CachePort {
  private store = new Map<string, unknown>();

  async get<T = unknown>(key: string): Promise<T | null | undefined> {
    return this.store.get(key) as T | null | undefined;
  }

  async set<T = unknown>(key: string, value: T, _options?: { ttl?: number }): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

describe("OtpCacheRateLimiterAdapter", () => {
  const cache = new MockCache();
  const limiter = new OtpCacheRateLimiterAdapter(cache);

  beforeEach(() => {
    cache.delete("otp:rate:test:scope");
  });

  test("reserveSlot returns true when under limit", async () => {
    const res = await limiter.reserveSlot("test:scope");
    expect(res).toBe(true);
  });

  test("reserveSlot returns false when limit reached (5)", async () => {
    for (let i = 0; i < 5; i++) await limiter.reserveSlot("test:scope");
    const res = await limiter.reserveSlot("test:scope");
    expect(res).toBe(false);
  });

  test("releaseSlot frees a slot", async () => {
    for (let i = 0; i < 5; i++) await limiter.reserveSlot("test:scope");
    expect(await limiter.reserveSlot("test:scope")).toBe(false);
    await limiter.releaseSlot("test:scope");
    expect(await limiter.reserveSlot("test:scope")).toBe(true);
  });

  test("canRequest & recordRequest are no-ops (deprecated)", async () => {
    expect(await limiter.canRequest("test")).toBe(true);
    await limiter.recordRequest("test");
  });
});
