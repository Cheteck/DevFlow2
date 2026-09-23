import { describe, expect, it } from "vitest";
import { MemoryCacheAdapter } from "./index";

describe("MemoryCacheAdapter", () => {
  it("can set, get, delete, clear, and respect TTL", async () => {
    const cache = new MemoryCacheAdapter();

    await cache.set("user:1", { name: "Alice" });
    await expect(cache.get("user:1")).resolves.toEqual({ name: "Alice" });

    await cache.set("temp", "data", { ttl: 1 }); // 1 second TTL
    await expect(cache.get("temp")).resolves.toBe("data");

    // Mock Date.now() to test expiration
    const originalNow = Date.now;
    Date.now = () => originalNow() + 2000; // Advance time by 2 seconds
    try {
      await expect(cache.get("temp")).resolves.toBeUndefined();
    } finally {
      Date.now = originalNow;
    }

    await cache.delete("user:1");
    await expect(cache.get("user:1")).resolves.toBeUndefined();

    await cache.set("user:2", "Bob");
    await cache.clear();
    await expect(cache.get("user:2")).resolves.toBeUndefined();
  });
});
