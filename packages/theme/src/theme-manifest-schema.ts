/**
 * @mosaix/theme -- Centralized Theme Manifest Schema
 *
 * Single source of truth for manifest validation. All manifest
 * validation (discovery, runtime, persistence, bridge) MUST go
 * through this module. No inline regex, no duplicate checks.
 *
 * Schema matches the real manifest structure in theme folders:
 *   tokens: { colors: {...}, typography: {...}, ... }
 *   modes: { light: { tokens: {...}, tailwind: {...} }, dark: {...} }
 */

import { z } from "zod";
import { ThemeValidationError } from "./theme-errors.js";

/**
 * CSS token value. Validates that values are safe for CSS
 * injection (no XSS vectors, no semicolons, no braces).
 */
const CSS_SAFE_RE = /url\s*\(\s*[^"'()]*data:/i;
const EXPRESSION_RE = /expression\s*\(/i;

const CssTokenValueSchema = z.union([
  z.string().refine(
    (v) =>
      !v.includes(";") &&
      !v.includes("}") &&
      !CSS_SAFE_RE.test(v) &&
      !EXPRESSION_RE.test(v),
    { message: "CSS token value contains unsafe characters" },
  ),
  z.number(),
  z.boolean(),
]);

/**
 * A token group (e.g., colors, typography, spacing).
 * Each value is a CSS-safe token value.
 */
const TokenGroupSchema = z.record(z.string().min(1), CssTokenValueSchema);

/**
 * Tailwind palette -- flat map of Tailwind CSS variable names -> values.
 */
const TailwindMapSchema = z.record(z.string(), z.string());

/**
 * Mode overlay -- per-mode token overrides (light/dark).
 * "system" is NEVER a mode overlay key (D-09).
 */
const ModeOverlaySchema = z.object({
  tokens: TokenGroupSchema.optional(),
  tailwind: TailwindMapSchema.optional(),
});

/**
 * Design tokens -- the canonical structure from contracts/theme/design-tokens.ts.
 * Each group is a named set of CSS tokens.
 */
const DesignTokensSchema = z.object({
  colors: TokenGroupSchema,
  typography: TokenGroupSchema.optional(),
  spacing: TokenGroupSchema.optional(),
  radius: TokenGroupSchema.optional(),
  shadows: TokenGroupSchema.optional(),
  motion: TokenGroupSchema.optional(),
  tailwind: TailwindMapSchema.optional(),
});

/**
 * Theme manifest schema -- the canonical contract for all themes.
 */
export const ThemeManifestSchema = z.object({
  id: z
    .string()
    .min(1, "theme id must be non-empty")
    .regex(
      /^[a-zA-Z0-9-]+$/,
      "theme id must contain only letters, digits, and hyphens",
    ),
  name: z.string().min(1, "theme name must be non-empty"),
  version: z
    .string()
    .regex(
      /^\d+\.\d+\.\d+(-[0-9a-zA-Z.-]+)?(\+[0-9a-zA-Z.-]+)?$/,
      "version must be semver (e.g., 1.0.0)",
    ),
  contractVersion: z
    .string()
    .regex(
      /^\d+\.\d+\.\d+(-[0-9a-zA-Z.-]+)?(\+[0-9a-zA-Z.-]+)?$/,
      "contractVersion must be semver (e.g., 1.0.0)",
    )
    .optional(),
  description: z.string().optional(),
  extends: z.string().optional(),
  type: z.literal("theme").optional(),
  tokens: DesignTokensSchema,
  modes: z
    .record(z.enum(["light", "dark"]), ModeOverlaySchema)
    .optional(),
  metadata: z
    .object({
      author: z.string().optional(),
      license: z.string().optional(),
      homepage: z.string().url().optional(),
    })
    .optional(),
});

export type ThemeManifestInput = z.infer<typeof ThemeManifestSchema>;

/**
 * Validate a theme manifest. Throws ThemeValidationError on failure.
 * This is the ONLY validation entry point for manifests.
 */
export function validateThemeManifest(
  manifest: unknown,
  context?: { source?: string; themeId?: string },
): ThemeManifestInput {
  const result = ThemeManifestSchema.safeParse(manifest);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      ...(context ? { context } : {}),
    }));
    throw new ThemeValidationError(issues);
  }
  return result.data;
}

/**
 * Validate that a theme id matches its directory name.
 * Enforces the "folder name === manifest id" invariant.
 */
export function validateThemeIdConsistency(
  folderName: string,
  manifest: ThemeManifestInput,
): void {
  if (manifest.id !== folderName) {
    throw new ThemeValidationError([
      {
        path: "id",
        message: `Theme id mismatch: folder name is '${folderName}' but manifest id is '${manifest.id}'`,
        context: { folderName, manifestId: manifest.id },
      },
    ]);
  }
}