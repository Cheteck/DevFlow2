import { describe, expect, it } from "vitest";
import Redis from "ioredis";
import { RedisCacheAdapter } from "./index";

interface MockRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, val: string): Promise<void>;
  del(key: string): Promise<void>;
  flushdb(): Promise<void>;
  quit(): Promise<void>;
}

describe("RedisCacheAdapter", () => {
  it("serializes and calls redis methods correctly", async () => {
    // Simple in-memory mock
    const mockStore = new Map<string, string>();
    const mockClient: MockRedisClient = {
      get: async (key: string) => mockStore.get(key) ?? null,
      set: async (key: string, val: string) => {
        mockStore.set(key, val);
      },
      del: async (key: string) => {
        mockStore.delete(key);
      },
      flushdb: async () => {
        mockStore.clear();
      },
      quit: async () => {},
    };

    const cache = new RedisCacheAdapter(mockClient as unknown as Redis);

    await cache.set("user:1", { name: "Bob" });
    await expect(cache.get("user:1")).resolves.toEqual({ name: "Bob" });

    await cache.delete("user:1");
    await expect(cache.get("user:1")).resolves.toBeUndefined();

    await cache.set("user:2", "Alice");
    await cache.clear();
    await expect(cache.get("user:2")).resolves.toBeUndefined();
  });

  it("throws when no configuration is provided", () => {
    expect(() => new RedisCacheAdapter()).toThrow(/missing Redis/i);
    expect(() => new RedisCacheAdapter({})).toThrow(/missing Redis/i);
  });

  it("uses the explicit in-memory mock client when { mock: true } is provided", async () => {
    const cache = new RedisCacheAdapter({ mock: true });

    await cache.set("user:1", { name: "Bob" });
    await expect(cache.get("user:1")).resolves.toEqual({ name: "Bob" });

    await cache.set("user:2", "Alice");
    await cache.clear();
    await expect(cache.get("user:2")).resolves.toBeUndefined();

    await cache.set("user:3", 42, { ttl: 60 });
    await expect(cache.get("user:3")).resolves.toBe(42);

    await expect(cache.disconnect()).resolves.toBeUndefined();
  });

  it("accepts an explicit connection config object", async () => {
    // lazyConnect avoids any network connection during the test.
    const cache = new RedisCacheAdapter({
      host: "127.0.0.1",
      port: 6379,
      lazyConnect: true,
    });
    expect(cache).toBeInstanceOf(RedisCacheAdapter);
    await cache.disconnect();
  });
});
