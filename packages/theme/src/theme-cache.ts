/**
 * @mosaix/theme — ThemeCache
 */

import type { CompiledTheme } from "@mosaix/contracts";

export const THEME_CACHE_DEFAULT_MAX = 100;
export type ThemeCacheKey = string;

export function toThemeCacheKey(
  themeId: string,
  version: string,
  mode: string,
): ThemeCacheKey {
  return `${themeId}:${version}:${mode}`;
}

export class ThemeCache {
  private readonly cache = new Map<ThemeCacheKey, CompiledTheme>();
  constructor(private readonly maxEntries: number = THEME_CACHE_DEFAULT_MAX) {}

  get(
    themeId: string,
    version: string,
    mode: string,
  ): CompiledTheme | undefined {
    const key = toThemeCacheKey(themeId, version, mode);
    const compiled = this.cache.get(key);
    if (compiled === undefined) return undefined;
    this.cache.delete(key);
    this.cache.set(key, compiled);
    return compiled;
  }

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
      if (lruKey === undefined) break;
      this.cache.delete(lruKey);
    }
  }

  has(themeId: string, version: string, mode: string): boolean {
    return this.cache.has(toThemeCacheKey(themeId, version, mode));
  }

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

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
