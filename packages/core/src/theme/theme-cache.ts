/**
 * @mosaix/core — ThemeCache (THEME-09)
 *
 * LRU-bounded, keyed store of compiled themes. Makes repeated resolutions
 * cheap: compilation (the costly step, 03-01) runs exactly once per
 * `themeId:version:mode`, and repeat resolutions are served from the cache
 * (roadmap criterion #2 — the ≤ 100 ms hot-switch benchmark in 03-04
 * depends on cache hits).
 *
 * Behavior (03-CONTEXT « ThemeCache » decisions):
 *  - Map iteration order = recency order (first key = least-recently used).
 *  - get() refreshes recency on a hit (delete + re-set); a miss returns
 *    undefined (CONVENTIONS lookups).
 *  - set() inserts and evicts the least-recently-used entry whenever size
 *    exceeds maxEntries (default ~100) — the size ≤ maxEntries invariant
 *    holds after every set.
 *  - Invalidation is manual and explicit: invalidate(themeId?, version?,
 *    mode?) with partial arguments matches on the PROVIDED fields only (a
 *    missing arg acts as a wildcard; zero args clears). There is NO
 *    auto-invalidation wiring in Phase 3 — nothing in this module reacts
 *    to external events (03-CONTEXT defers that wiring to Phase 4).
 *
 * Dependency direction: core → contracts, type-only import of
 * `CompiledTheme` (no value import). Pure in-memory state: no DOM, no I/O,
 * no timers, no globals; every method is synchronous.
 *
 * Consumers: ThemeRuntime (03-04), hot-switch benchmark (03-04).
 */

import type { CompiledTheme } from "@mosaix/contracts";

/** Default LRU cap (~100 entries, 03-CONTEXT). */
export const THEME_CACHE_DEFAULT_MAX = 100;

/** Opaque cache key type — composed `themeId:version:mode`. */
export type ThemeCacheKey = string;

/** Compose the canonical key. */
export function toThemeCacheKey(
  themeId: string,
  version: string,
  mode: string,
): ThemeCacheKey {
  return `${themeId}:${version}:${mode}`;
}

/**
 * LRU-bounded CompiledTheme store (THEME-09).
 * - Map iteration order = recency order (first key = LRU).
 * - get() refreshes recency (delete + re-set).
 * - set() evicts the LRU entry when size exceeds maxEntries.
 * - Explicit invalidate/clear only — NO auto-invalidation wiring
 *   in Phase 3 (03-CONTEXT): invalidate(themeId?, version?, mode?)
 *   with a partial argument matches on the PROVIDED fields only.
 */
export class ThemeCache {
  private readonly cache = new Map<ThemeCacheKey, CompiledTheme>();
  constructor(private readonly maxEntries: number = THEME_CACHE_DEFAULT_MAX) {}

  /**
   * Resolve a cached compiled theme; refreshes recency on a hit so a
   * touched key survives eviction. Miss → undefined.
   */
  get(
    themeId: string,
    version: string,
    mode: string,
  ): CompiledTheme | undefined {
    const key = toThemeCacheKey(themeId, version, mode);
    const compiled = this.cache.get(key);
    if (compiled === undefined) return undefined;
    // refresh recency: delete + re-set moves the key to the Map tail
    this.cache.delete(key);
    this.cache.set(key, compiled);
    return compiled;
  }

  /** Insert or overwrite a compiled theme; evicts the LRU entry over cap. */
  set(
    themeId: string,
    version: string,
    mode: string,
    compiled: CompiledTheme,
  ): void {
    const key = toThemeCacheKey(themeId, version, mode);
    this.cache.set(key, compiled);
    while (this.cache.size > this.maxEntries) {
      const lruKey = this.cache.keys().next().value;
      if (lruKey === undefined) break; // size ≤ maxEntries guaranteed
      this.cache.delete(lruKey);
    }
  }

  /** Read-only presence probe — does NOT refresh recency. */
  has(themeId: string, version: string, mode: string): boolean {
    return this.cache.has(toThemeCacheKey(themeId, version, mode));
  }

  /**
   * Remove matching keys. Missing args act as wildcards; no args clears all.
   * Each key splits deterministically on ":" into exactly three parts, so a
   * version/mode containing ":" can only match its own composite (T3-05).
   */
  invalidate(themeId?: string, version?: string, mode?: string): void {
    for (const key of [...this.cache.keys()]) {
      const [id, ver, modePart] = key.split(":");
      const idMatches = themeId === undefined || themeId === id;
      const versionMatches = version === undefined || version === ver;
      const modeMatches = mode === undefined || mode === modePart;
      if (idMatches && versionMatches && modeMatches) {
        this.cache.delete(key);
      }
    }
  }

  /** Empty the cache entirely. */
  clear(): void {
    this.cache.clear();
  }

  /** Number of cached entries. */
  get size(): number {
    return this.cache.size;
  }
}
