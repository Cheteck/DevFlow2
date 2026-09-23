/**
 * @mosaix/core — ThemeInheritanceResolver (THEME-07, D-19/D-20)
 *
 * DFS parent-first resolution of the static `extends` inheritance graph
 * (PRD-0008 §4.4/§8). Ancestors merge first; the child overlays its manifest
 * LAST (spread-merge, child wins on key conflicts — D-19). A cycle in the
 * graph raises ThemeCycleError carrying the cycle path in `details`; a missing
 * manifest raises ThemeNotFoundError — the resolver FAILS CLOSED inside the
 * step (D-20 two-layer policy: ThemeResolver.resolve() stays fail-open).
 *
 * Implements the ThemeInheritanceResolverLike contract declared in 02-03
 * (same resolve(themeId, mode, load): ResolvedTheme surface), so the
 * pipeline's 5th step can delegate to the real DFS.
 *
 * Depends on: @mosaix/contracts (type-only), ./theme-errors (02-02)
 * Consumed by: ThemeResolver (02-03 step 5), Phase-3 theme compiler
 */

import type {
  ResolvedTheme,
  ThemeManifest,
  ThemeMode,
} from "@mosaix/contracts";
import { ThemeCycleError, ThemeNotFoundError } from "./theme-errors";
import type { ThemeInheritanceResolverLike } from "./theme-resolver";

/** Manifest lookup seam — injected, mirrors MigrationPlanner constructor style. */
export interface ThemeManifestLookup {
  get(themeId: string): ThemeManifest | undefined;
}

export interface ThemeInheritanceResolverOptions {
  readonly lookup: ThemeManifestLookup;
}

export class ThemeInheritanceResolver implements ThemeInheritanceResolverLike {
  /** Constructor-injected manifest seam (PATTERNS line 198). */
  readonly lookup: ThemeManifestLookup;

  constructor(options: ThemeInheritanceResolverOptions) {
    this.lookup = options.lookup;
  }

  /** DFS parent-first resolve of the extends graph rooted at themeId. */
  resolve(
    themeId: string,
    mode: ThemeMode,
    load: (id: string) => ThemeManifest | undefined,
  ): ResolvedTheme {
    return visit(themeId, mode, [], load);
  }
}

/**
 * DFS parent-first merge rooted at `id`.
 * `stack` is the visited-path state (PATTERNS cycle-visit idiom); re-entering
 * an id already on the stack is a cycle → ThemeCycleError with the cycle path
 * (current stack + re-entered id, e.g. ["a","b","a"]).
 */
function visit(
  id: string,
  mode: ThemeMode,
  stack: readonly string[],
  load: (themeId: string) => ThemeManifest | undefined,
): ResolvedTheme {
  const manifest = load(id);
  if (manifest === undefined) {
    // D-20 fails-closed in step: missing manifest is a resolution error.
    throw new ThemeNotFoundError(id);
  }
  if (stack.includes(id)) {
    // D-19: cycle path = the DFS stack at re-entry + the re-entered id.
    throw new ThemeCycleError([...stack, id]);
  }
  const childStack = [...stack, id];
  if (manifest.extends !== undefined) {
    const parentMerged = visit(manifest.extends, mode, childStack, load);
    // Merge formula (D-19): parent base first, child overlays last — leaf
    // themeId/version/mode win at the ResolvedTheme level; nested plain-object
    // subtrees (tokens/modes/metadata) DEEP-merge so parent subtrees survive
    // partial child overlap (CR-01). Scalars and arrays: child wins.
    return {
      themeId: id,
      version: manifest.version,
      mode,
      manifest: deepMergeManifest(parentMerged.manifest, manifest),
    };
  }
  // Single-theme fast path — spread-copied identity (no aliasing, IN-03).
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

/**
 * Recursive manifest merge (D-19 formula): child scalars and arrays win;
 * nested plain objects merge depth-first so a partial child overlay preserves
 * the parent's remaining subtree (CR-01 — never drop inherited tokens).
 */
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

/** Standalone helper for tests/consumers — resolves an extends chain to a merged ResolvedTheme. */
export function resolveThemeInheritance(
  themeId: string,
  mode: ThemeMode,
  load: (id: string) => ThemeManifest | undefined,
): ResolvedTheme {
  return visit(themeId, mode, [], load);
}
