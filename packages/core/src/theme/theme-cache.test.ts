/**
 * ThemeCache — co-located vitest suite (THEME-09).
 *
 * Gates the LRU-bounded keyed CompiledTheme store: canonical key
 * composition (`themeId:version:mode`), reference-preserving get (repeat
 * resolutions are served from the cache), LRU eviction over the cap,
 * recency refresh on get, manual invalidate (exact / partial / zero-arg),
 * clear, and miss-undefined lookups.
 *
 * Determinism is asserted via object identity and eviction ORDER (which key
 * survives), never timing — the ≤ 100 ms hot-switch claim belongs to the
 * 03-04 benchmark.
 *
 * Fixture rule (roadmap invariant #8): store/brand/workspace-style theme
 * ids and modes only — no other business-entity literal appears in this
 * file (grep gate).
 */

import { beforeEach, describe, expect, expectTypeOf, it } from "vitest";

import type { CompiledTheme } from "@mosaix/contracts";
import { ThemeCache, toThemeCacheKey } from "./theme-cache";

/** Small cap so eviction tests can overflow the cache. */
let cache: ThemeCache;

/** Deterministic CompiledTheme fixture — CSS variable map (C2 shape). */
function makeCompiled(): CompiledTheme {
  return {
    "--mx-color-primary": "#1e73e8",
    "--mx-color-primary-hover": "#1a5cb8",
    "--mx-space-md": "16px",
  };
}

beforeEach(() => {
  cache = new ThemeCache(2);
});

describe("ThemeCache", () => {
  it("composes the canonical key themeId:version:mode — ocean/1.0.0/dark differs from ocean/1.0.0/system", () => {
    expect(toThemeCacheKey("ocean", "1.0.0", "dark")).toBe("ocean:1.0.0:dark");
    expect(toThemeCacheKey("ocean", "1.0.0", "system")).toBe(
      "ocean:1.0.0:system",
    );
    expect(toThemeCacheKey("ocean", "1.0.0", "dark")).not.toBe(
      toThemeCacheKey("ocean", "1.0.0", "system"),
    );

    cache.set("ocean", "1.0.0", "dark", makeCompiled());
    expect(cache.has("ocean", "1.0.0", "dark")).toBe(true);
    expect(cache.has("ocean", "1.0.0", "system")).toBe(false);
    expect(cache.get("ocean", "1.0.0", "system")).toBeUndefined();
  });

  it("get returns the SAME CompiledTheme reference stored by set — repeat resolutions are cache hits", () => {
    const compiled = makeCompiled();
    cache.set("ocean", "1.0.0", "dark", compiled);

    expect(cache.get("ocean", "1.0.0", "dark")).toBe(compiled);
    expect(cache.get("ocean", "1.0.0", "dark")).toBe(compiled);
  });

  it("set beyond maxEntries evicts the least-recently-used entry (first inserted)", () => {
    cache.set("ocean", "1.0.0", "dark", makeCompiled());
    cache.set("forest", "1.0.0", "dark", makeCompiled());
    cache.set("vine", "1.0.0", "dark", makeCompiled());

    expect(cache.size).toBe(2);
    expect(cache.has("ocean", "1.0.0", "dark")).toBe(false); // LRU evicted
    expect(cache.has("forest", "1.0.0", "dark")).toBe(true);
    expect(cache.has("vine", "1.0.0", "dark")).toBe(true);
  });

  it("get refreshes recency so a touched key survives eviction", () => {
    cache.set("ocean", "1.0.0", "dark", makeCompiled()); // A
    cache.set("forest", "1.0.0", "dark", makeCompiled()); // B
    cache.get("ocean", "1.0.0", "dark"); // refresh A → A newest
    cache.set("vine", "1.0.0", "dark", makeCompiled()); // C → evicts B

    expect(cache.size).toBe(2);
    expect(cache.has("forest", "1.0.0", "dark")).toBe(false); // B evicted
    expect(cache.has("ocean", "1.0.0", "dark")).toBe(true); // A survives
    expect(cache.has("vine", "1.0.0", "dark")).toBe(true);
  });

  it("invalidate with exact args removes exactly that one key", () => {
    cache.set("ocean", "1.0.0", "dark", makeCompiled());
    cache.set("ocean", "1.0.0", "light", makeCompiled());
    cache.set("forest", "1.0.0", "dark", makeCompiled());

    cache.invalidate("ocean", "1.0.0", "dark");

    expect(cache.has("ocean", "1.0.0", "dark")).toBe(false);
    expect(cache.has("ocean", "1.0.0", "light")).toBe(true);
    expect(cache.has("forest", "1.0.0", "dark")).toBe(true);
  });

  it("invalidate with partial args matches only the provided fields", () => {
    cache.set("ocean", "1.0.0", "dark", makeCompiled());
    cache.set("ocean", "1.0.0", "light", makeCompiled());
    cache.set("forest", "1.0.0", "dark", makeCompiled());

    cache.invalidate("ocean", undefined, undefined);

    expect(cache.has("ocean", "1.0.0", "dark")).toBe(false);
    expect(cache.has("ocean", "1.0.0", "light")).toBe(false);
    expect(cache.has("forest", "1.0.0", "dark")).toBe(true);
  });

  it("zero-arg invalidate() empties the cache (no-args wildcard == clear)", () => {
    cache.set("ocean", "1.0.0", "dark", makeCompiled());
    cache.set("forest", "2.0.0", "light", makeCompiled());

    cache.invalidate();

    expect(cache.size).toBe(0);
  });

  it("clear() empties the cache; get on a missing key returns undefined without throwing", () => {
    cache.set("ocean", "1.0.0", "dark", makeCompiled());
    cache.clear();

    expect(cache.size).toBe(0);
    expect(() => cache.get("ocean", "1.0.0", "dark")).not.toThrow();
    expect(cache.get("ocean", "1.0.0", "dark")).toBeUndefined();
    expect(() => cache.invalidate("ocean", "1.0.0", "dark")).not.toThrow();
  });

  it("cap-0 cache is constructible and accepts get/set/invalidate safely", () => {
    const emptyCache = new ThemeCache(0);

    expect(() =>
      emptyCache.set("ocean", "1.0.0", "dark", makeCompiled()),
    ).not.toThrow();
    expect(emptyCache.size).toBe(0); // every insert evicts immediately
    expect(emptyCache.get("ocean", "1.0.0", "dark")).toBeUndefined();
    expect(() => emptyCache.invalidate("ocean")).not.toThrow();

    expectTypeOf(cache.get).parameter(0).toBeString();
    expectTypeOf(cache.set).parameter(3).toEqualTypeOf<CompiledTheme>();
    expectTypeOf(ThemeCache).toBeConstructibleWith(0);
  });
});
