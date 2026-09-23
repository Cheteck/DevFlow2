/**
 * @mosaix/core — ThemeCompiler (THEME-08, PRD-0008 §4.8)
 *
 * The compile leg of the Phase-3 pipeline: a pure, deterministic translation
 * of a resolved `ThemeManifest` + `ThemeMode` into a `CompiledTheme` — a
 * plain `{ "--mx-<groupe>-<token>": value }` string map. No DOM, no I/O, no
 * global state: identical inputs produce byte-identical output (keys sorted
 * alphabetically).
 *
 * Naming ABI (PRD-0008 §4.8): groups map through `THE_GROUP_CSS_NAMES` at
 * every nesting level (`colors` → `color`, `spacing` → `space`), token names
 * stay verbatim; nested groups flatten with `-`
 * (`colors.primary` → `--mx-color-primary`, `motion.duration.fast` →
 * `--mx-motion-duration-fast`).
 *
 * Mode overlay (CR-01): "light"/"dark" deep-merge `manifest.modes[mode]` over
 * base `tokens` — a partial overlay preserves untouched parent subtrees;
 * "system" compiles base tokens with NO overlay (D-09).
 *
 * Invariants:
 * - Target-agnostic (INV-THEME-007): compile never references the target
 *   type — zero target imports, zero target literals.
 * - Value coercion is exhaustive (string/number/boolean/undefined handled);
 *   rejected leaves (null, object at leaf, function, symbol, bigint) raise
 *   `ThemeValidationError` deterministically — no coerced garbage reaches CSS
 *   (T3-01). Names are built from `--mx-` + table-mapped groups + verbatim
 *   token keys — never raw string interpolation into selectors; the output is
 *   a plain string map, never CSS text (T3-02).
 *
 * Depends on: @mosaix/contracts (type-only), ./theme-errors (02-02)
 * Consumed by: ThemeCache (03-02), ThemeRuntime (03-04) — no barrel export in
 *   this plan (Phase-3 barrel lands in 03-04).
 */

import type {
  CompiledTheme,
  ThemeManifest,
  ThemeMode,
} from "@mosaix/contracts";
import { ThemeValidationError } from "./theme-errors";

/**
 * PRD-0008 §4.8 — deterministic group-name → CSS-name table.
 * LOCKED by the PRD: colors→color, spacing→space.
 * Deterministic (OpenCode discretion, documented): remaining DesignTokens
 * groups use singularized CSS names (shadows→shadow) or verbatim
 * (typography, radius, motion). Output keys are sorted alphabetically, so
 * this table cannot affect byte-stability.
 */
export const THE_GROUP_CSS_NAMES: Readonly<Record<string, string>> = {
  colors: "color",
  typography: "typography",
  spacing: "space",
  radius: "radius",
  shadows: "shadow",
  motion: "motion",
};

/**
 * compile — pure, deterministic tokens → CSS variables.
 *  1. mode overlay: "light"/"dark" deep-merge manifest.modes[mode] over
 *     manifest.tokens (child wins, partial overlay preserves untouched
 *     subtrees — CR-01). "system" → base tokens only (D-09).
 *  2. flatten: nested groups joined with "-" under `--mx-<group>`,
 *     token names verbatim.
 *  3. coerce leaves: string → passthrough; number → `${n}px`;
 *     boolean → "1"/"0"; undefined → skip; null/object/function →
 *     ThemeValidationError.
 *  4. sort: return keys alphabetically sorted (byte-stable).
 */
export function compile(
  manifest: ThemeManifest,
  mode: ThemeMode,
): CompiledTheme {
  const tokens = tokensWithModeOverlay(manifest, mode);
  const out: Record<string, string> = {};
  flatten([], tokens, out);
  return sortKeys(out);
}

/**
 * CR-01 overlay resolution: "system" (D-09) and absent overlays compile the
 * base tokens as-is; light/dark deep-merge `modes[mode]` over the base.
 */
function tokensWithModeOverlay(
  manifest: ThemeManifest,
  mode: ThemeMode,
): Record<string, unknown> {
  const base = manifest.tokens as unknown as Record<string, unknown>;
  if (mode === "system") return base;
  const overlay = manifest.modes?.[mode];
  if (overlay === undefined) return base;
  return mergeTokens(base, overlay as unknown as Record<string, unknown>);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A group is a non-empty plain object — an empty object is a rejected leaf. */
function isGroup(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value) && Object.keys(value).length > 0;
}

/**
 * CR-01 deep-merge (mirrors theme-inheritance-resolver, replicated locally —
 * no cross-module import of the formula, D-19): nested plain objects merge
 * depth-first so a partial overlay preserves the base's remaining subtree;
 * scalars win at the overlay leaf.
 */
function mergeTokens(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(overlay)) {
    const baseValue = base[key];
    const overlayValue = overlay[key];
    if (isPlainObject(baseValue) && isPlainObject(overlayValue)) {
      result[key] = mergeTokens(baseValue, overlayValue);
    } else {
      result[key] = overlayValue;
    }
  }
  return result;
}

/**
 * Recursive flatten: group keys map through THE_GROUP_CSS_NAMES at EVERY
 * level; token leaves keep their name verbatim. Group vs leaf is decided BY
 * VALUE TYPE (non-empty plain object → recurse; anything else → coerce) — no
 * token-name whitelists (DesignTokens is open at runtime).
 */
function flatten(
  groupPrefix: readonly string[],
  tokens: Record<string, unknown>,
  out: Record<string, string>,
): void {
  for (const key of Object.keys(tokens)) {
    const value = tokens[key];
    if (isGroup(value)) {
      const mapped = THE_GROUP_CSS_NAMES[key] ?? key;
      flatten([...groupPrefix, mapped], value, out);
    } else {
      const cssName = `--mx-${[...groupPrefix, key].join("-")}`;
      const coerced = coerceValue(value, cssName);
      if (coerced !== undefined) out[cssName] = coerced;
    }
  }
}

/**
 * Exhaustive leaf coercion: string → as-is; number → `${value}px`; boolean →
 * "1"/"0"; undefined → skipped (caller continues). null / plain object at
 * leaf / function / symbol / bigint → ThemeValidationError with the full CSS
 * name path only (no manifest content, no secrets — T3-04).
 */
function coerceValue(value: unknown, fullCssName: string): string | undefined {
  if (typeof value === "string") {
    // Sanitize against CSS injection breaking out of declarations or introducing dangerous URLs/expressions
    if (value.includes(";") || value.includes("}") || /url\s*\(\s*["']?data:/i.test(value) || /expression\s*\(/i.test(value)) {
      throw new ThemeValidationError([
        { path: [fullCssName], message: "malicious character sequence detected in CSS token value" },
      ]);
    }
    return value;
  }
  if (typeof value === "number") {
    const lowerName = fullCssName.toLowerCase();
    const isUnitless =
      lowerName.includes("opacity") ||
      lowerName.includes("z-index") ||
      lowerName.includes("zindex") ||
      lowerName.includes("line-height") ||
      lowerName.includes("lineheight") ||
      lowerName.includes("font-weight") ||
      lowerName.includes("fontweight") ||
      lowerName.includes("order") ||
      lowerName.includes("flex");
    return isUnitless ? String(value) : `${value}px`;
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value === undefined) return undefined;
  throw new ThemeValidationError([
    { path: [fullCssName], message: "unsupported token value" },
  ]);
}

/** Byte-stable rebuild: alphabetically sorted keys (deterministic ABI). */
function sortKeys(out: Record<string, string>): CompiledTheme {
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(out).sort()) {
    const value = out[key];
    if (value !== undefined) sorted[key] = value;
  }
  return sorted;
}
