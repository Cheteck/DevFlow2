import { describe, it, expect } from "vitest";
import { Cache } from "./cache";
import type { CachePort, CacheOptions } from "@mosaix/ports-cache";

class FakeCacheStore implements CachePort {
  private data = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T | undefined;
  }

  async set<T>(key: string, value: T, _options?: CacheOptions): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async clear(): Promise<void> {
    this.data.clear();
  }
}

describe("Developer Cache Manager", () => {
  it("should retrieve cached items and handle fallback values", async () => {
    const store = new FakeCacheStore();
    const cache = new Cache(store);

    await cache.put("key1", "hello");
    expect(await cache.get("key1")).toBe("hello");

    // Static fallback
    expect(await cache.get("key2", "fallback-static")).toBe("fallback-static");

    // Dynamic factory fallback
    expect(await cache.get("key3", () => "fallback-dynamic")).toBe(
      "fallback-dynamic",
    );
  });

  it("should check existence of keys using has()", async () => {
    const store = new FakeCacheStore();
    const cache = new Cache(store);

    expect(await cache.has("some-key")).toBe(false);

    await cache.put("some-key", "present");
    expect(await cache.has("some-key")).toBe(true);

    await cache.forget("some-key");
    expect(await cache.has("some-key")).toBe(false);
  });

  it("should resolve values with remember() and cache them", async () => {
    const store = new FakeCacheStore();
    const cache = new Cache(store);
    let resolvedTimes = 0;

    const factory = () => {
      resolvedTimes++;
      return "resolved-value";
    };

    const val1 = await cache.remember("item", 3600, factory);
    const val2 = await cache.remember("item", 3600, factory);

    expect(val1).toBe("resolved-value");
    expect(val2).toBe("resolved-value");
    expect(resolvedTimes).toBe(1); // Cached on first call
  });

  it("should support increment and decrement", async () => {
    const store = new FakeCacheStore();
    const cache = new Cache(store);

    // Initial increment starting at 0
    const inc1 = await cache.increment("counter");
    expect(inc1).toBe(1);

    const inc2 = await cache.increment("counter", 5);
    expect(inc2).toBe(6);

    // Decrement
    const dec1 = await cache.decrement("counter");
    expect(dec1).toBe(5);

    const dec2 = await cache.decrement("counter", 3);
    expect(dec2).toBe(2);
  });
});
