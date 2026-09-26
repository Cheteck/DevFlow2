/**
 * @mosaix/theme — ThemeCompiler
 */

import type {
  CompiledTheme,
  ThemeManifest,
  ThemeMode,
} from "@mosaix/contracts";
import { ThemeValidationError } from "./theme-errors.js";

export const THE_GROUP_CSS_NAMES: Readonly<Record<string, string>> = {
  colors: "color",
  typography: "typography",
  spacing: "space",
  radius: "radius",
  shadows: "shadow",
  motion: "motion",
};

export function compile(
  manifest: ThemeManifest,
  mode: ThemeMode,
): CompiledTheme {
  const tokens = tokensWithModeOverlay(manifest, mode);
  const out: Record<string, string> = {};
  flatten([], tokens, out);
  return sortKeys(out);
}

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

function isGroup(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value) && Object.keys(value).length > 0;
}

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

function coerceValue(value: unknown, fullCssName: string): string | undefined {
  if (typeof value === "string") {
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

function sortKeys(out: Record<string, string>): CompiledTheme {
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(out).sort()) {
    const value = out[key];
    if (value !== undefined) sorted[key] = value;
  }
  return sorted;
}
