/**
 * ThemeCompiler — co-located vitest suite (THEME-08, PRD-0008 §4.8).
 *
 * Gates the pure, deterministic `compile(manifest, mode) → CompiledTheme`
 * leg of the Phase-3 pipeline (ThemCompiler → ThemeCache 03-02 →
 * ThemeRuntime 03-04):
 *   1. PRD §4.8 naming ABI: colors.primary → --mx-color-primary,
 *      spacing.md → --mx-space-md; nested groups flatten with `-`; token
 *      names verbatim;
 *   2. CR-01 deep-merge: a partial light/dark overlay preserves untouched
 *      base subtrees; mode "system" compiles base tokens with NO overlay
 *      (D-09);
 *   3. value coercion: string passthrough, number → `${n}px`, boolean →
 *      "1"/"0", undefined skipped, null/object-at-leaf/function →
 *      ThemeValidationError;
 *   4. determinism: byte-stable sorted keys, deep-equal recompiles
 *      (INV-THEME-007 — compile never sees a ThemeTarget).
 *
 * Fixture rule (roadmap invariant #8): store / brand / workspace targets
 * only; theme id "ocean" — no space target-type literal appears in this
 * file (grep gate).
 */

import { describe, expect, expectTypeOf, it } from "vitest";

import type {
  CompiledTheme,
  ThemeManifest,
  ThemeMode,
} from "@mosaix/contracts";
import { ThemeValidationError } from "./theme-errors";
import { compile } from "./theme-compiler";

/**
 * PRD §4.8 fixture — theme id "ocean".
 * Includes the required MosaixArtifactManifest fields (name/metadata) so the
 * factory returns a type-correct ThemeManifest.
 */
function makeManifest(overrides: Partial<ThemeManifest> = {}): ThemeManifest {
  return {
    id: "ocean",
    name: "Ocean",
    version: "1.0.0",
    type: "theme",
    metadata: { name: "Ocean" },
    tokens: {
      colors: { primary: "#1e73e8", background: "#0b0b0f" },
      spacing: { md: "16px", lg: "24px" },
    },
    modes: {
      dark: { colors: { background: "#000000" } },
    },
    ...overrides,
  };
}

/**
 * Fixture helper for raw (non-DesignTokens-typed) leaf values — number,
 * boolean, null, object-at-leaf. DesignTokens is open at runtime, so the
 * compiler must reject/coerce BY VALUE TYPE, never by name whitelist.
 */
function manifestWithTokens(tokens: Record<string, unknown>): ThemeManifest {
  return makeManifest({
    tokens: tokens as unknown as ThemeManifest["tokens"],
  });
}

describe("compile (THEME-08, PRD-0008 §4.8)", () => {
  it("locks the compile signature: (manifest: ThemeManifest, mode: ThemeMode) => CompiledTheme", () => {
    expectTypeOf<typeof compile>().toEqualTypeOf<
      (manifest: ThemeManifest, mode: ThemeMode) => CompiledTheme
    >();
  });

  it("maps PRD §4.8 names: colors.primary → --mx-color-primary, spacing.md → --mx-space-md", () => {
    const compiled = compile(makeManifest(), "light");

    expect(compiled["--mx-color-primary"]).toBe("#1e73e8");
    expect(compiled["--mx-space-md"]).toBe("16px");
    expect(compiled["--mx-space-lg"]).toBe("24px");
  });

  it("flattens nested groups: motion.duration.fast → --mx-motion-duration-fast", () => {
    const compiled = compile(
      manifestWithTokens({
        colors: { primary: "#1e73e8" },
        motion: { duration: { fast: "120ms" } },
      }),
      "light",
    );

    expect(compiled["--mx-motion-duration-fast"]).toBe("120ms");
  });

  it("deep-merges the dark overlay, preserving untouched base subtrees (CR-01)", () => {
    const compiled = compile(makeManifest(), "dark");

    // overlay wins on the overlapped token
    expect(compiled["--mx-color-background"]).toBe("#000000");
    // base tokens survive the partial overlay
    expect(compiled["--mx-color-primary"]).toBe("#1e73e8");
    // untouched top-level subtree survives untouched
    expect(compiled["--mx-space-md"]).toBe("16px");
  });

  it("compiles mode system with base tokens only (D-09)", () => {
    const compiled = compile(makeManifest(), "system");

    // NO overlay applied — base background survives
    expect(compiled["--mx-color-background"]).toBe("#0b0b0f");
    expect(compiled["--mx-color-primary"]).toBe("#1e73e8");
    expect(compiled["--mx-space-md"]).toBe("16px");
    expect(Object.keys(compiled)).toEqual([...Object.keys(compiled)].sort());
  });

  it("coerces number → px and boolean → 1/0; skips undefined", () => {
    const compiled = compile(
      manifestWithTokens({
        colors: { primary: "#1e73e8" },
        spacing: { md: 16, lg: 24 },
        typography: { baseSize: true, heading: false },
        radius: { sm: undefined },
      }),
      "light",
    );

    expect(compiled["--mx-space-md"]).toBe("16px");
    expect(compiled["--mx-space-lg"]).toBe("24px");
    // token names stay verbatim (no kebab-casing): baseSize → --mx-typography-baseSize
    expect(compiled["--mx-typography-baseSize"]).toBe("1");
    expect(compiled["--mx-typography-heading"]).toBe("0");
    // undefined leaf is skipped — the key never exists
    expect(compiled["--mx-radius-sm"]).toBeUndefined();
  });

  it("rejects null and object-at-leaf with ThemeValidationError", () => {
    // null leaf (T3-01 deterministic rejection — no coerced garbage to CSS)
    expect(() =>
      compile(manifestWithTokens({ colors: { primary: null } }), "light"),
    ).toThrow(ThemeValidationError);

    // plain object at leaf = a group used where a token is expected
    expect(() =>
      compile(manifestWithTokens({ colors: { primary: {} } }), "light"),
    ).toThrow(ThemeValidationError);
  });

  it("is deterministic: two calls deep-equal with identical key order", () => {
    const manifest = makeManifest();
    const first = compile(manifest, "dark");
    const second = compile(manifest, "dark");

    expect(second).toEqual(first);
    expect(Object.keys(second)).toEqual(Object.keys(first));
  });

  it("sorts keys alphabetically (byte-stable ABI)", () => {
    const compiled = compile(makeManifest(), "light");
    const keys = Object.keys(compiled);

    expect(keys).toEqual([...keys].sort());
  });
});
