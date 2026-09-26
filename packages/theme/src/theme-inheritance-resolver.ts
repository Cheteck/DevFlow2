/**
 * @mosaix/theme — ThemeInheritanceResolver
 */

import type {
  ResolvedTheme,
  ThemeManifest,
  ThemeMode,
} from "@mosaix/contracts";
import { ThemeCycleError, ThemeNotFoundError } from "./theme-errors.js";

export interface ThemeManifestLookup {
  get(themeId: string): ThemeManifest | undefined;
}

export interface ThemeInheritanceResolverOptions {
  readonly lookup: ThemeManifestLookup;
}

export interface ThemeInheritanceResolverLike {
  resolve(
    themeId: string,
    mode: ThemeMode,
    load: (themeId: string) => ThemeManifest | undefined,
  ): ResolvedTheme;
}

export class ThemeInheritanceResolver implements ThemeInheritanceResolverLike {
  readonly lookup: ThemeManifestLookup;

  constructor(options: ThemeInheritanceResolverOptions) {
    this.lookup = options.lookup;
  }

  resolve(
    themeId: string,
    mode: ThemeMode,
    load: (id: string) => ThemeManifest | undefined,
  ): ResolvedTheme {
    return visit(themeId, mode, [], load);
  }
}

function visit(
  id: string,
  mode: ThemeMode,
  stack: readonly string[],
  load: (themeId: string) => ThemeManifest | undefined,
): ResolvedTheme {
  const manifest = load(id);
  if (manifest === undefined) {
    throw new ThemeNotFoundError(id);
  }
  if (stack.includes(id)) {
    throw new ThemeCycleError([...stack, id]);
  }
  const childStack = [...stack, id];
  if (manifest.extends !== undefined) {
    const parentMerged = visit(manifest.extends, mode, childStack, load);
    return {
      themeId: id,
      version: manifest.version,
      mode,
      manifest: deepMergeManifest(parentMerged.manifest, manifest),
    };
  }
  return {
    themeId: id,
    version: manifest.version,
    mode,
    manifest: { ...manifest },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMergeManifest(
  base: ThemeManifest,
  overlay: ThemeManifest,
): ThemeManifest {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(overlay)) {
    const baseValue = (base as unknown as Record<string, unknown>)[key];
    const overlayValue = (overlay as unknown as Record<string, unknown>)[key];
    if (isPlainObject(baseValue) && isPlainObject(overlayValue)) {
      result[key] = deepMergeObjects(baseValue, overlayValue);
    } else {
      result[key] = overlayValue;
    }
  }
  return result as unknown as ThemeManifest;
}

function deepMergeObjects(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): unknown {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(overlay)) {
    const baseValue = base[key];
    const overlayValue = overlay[key];
    if (isPlainObject(baseValue) && isPlainObject(overlayValue)) {
      result[key] = deepMergeObjects(baseValue, overlayValue);
    } else {
      result[key] = overlayValue;
    }
  }
  return result;
}

export function resolveThemeInheritance(
  themeId: string,
  mode: ThemeMode,
  load: (id: string) => ThemeManifest | undefined,
): ResolvedTheme {
  return visit(themeId, mode, [], load);
}
