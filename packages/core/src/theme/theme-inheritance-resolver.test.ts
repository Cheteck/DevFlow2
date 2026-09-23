/**
 * ThemeInheritanceResolver — co-located vitest suite (THEME-07, D-19/D-20).
 *
 * Gates the DFS parent-first merge of the static `extends` graph:
 *   1. single theme (no extends) → spread-merged identity, leaf id preserved;
 *   2. linear chain a→b — b merges FIRST, a overlays LAST (parent-first, D-19);
 *   3. token precedence — when parent and child define the same token key, the
 *      child's value wins (child overlays last);
 *   4. cycle a↔b → ThemeCycleError with the cycle path in details
 *      (["a","b","a"]), never an infinite loop;
 *   5. self-cycle a.extends=a → ThemeCycleError;
 *   6. missing parent → ThemeNotFoundError(ghost) — fails-closed in step (D-20);
 *   7. deep chain cycle isolation — a→b→c→a throws while an independent
 *      sibling chain (midnight→base) resolves;
 *   8. structural lock — ThemeInheritanceResolver satisfies the 02-03
 *      ThemeInheritanceResolverLike contract (pipeline delegation proof).
 *
 * Fixture rule (DoD §19): theme ids ocean / midnight / base / acme-brand —
 * no space-type literal appears in this file (grep gate).
 */

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type {
  ResolvedTheme,
  ThemeManifest,
  ThemeMode,
} from "@mosaix/contracts";
import { ThemeCycleError, ThemeNotFoundError } from "./theme-errors";
import {
  ThemeInheritanceResolver,
  resolveThemeInheritance,
  type ThemeInheritanceResolverOptions,
  type ThemeManifestLookup,
} from "./theme-inheritance-resolver";
import type { ThemeInheritanceResolverLike } from "./theme-resolver";

/** Fixture manifest factory — theme ids without a space-type literal (DoD §19). */
function makeManifest(
  id: string,
  overrides: Partial<ThemeManifest> = {},
): ThemeManifest {
  return {
    id: `mosaix.${id}`,
    name: id,
    version: "1.0.0",
    type: "theme",
    metadata: { name: id },
    tokens: { colors: { primary: "#1e73e8" } },
    ...overrides,
  };
}

interface InheritanceHarness {
  readonly load: (id: string) => ThemeManifest | undefined;
  readonly resolver: ThemeInheritanceResolver;
}

function makeResolver(
  manifests: Record<string, ThemeManifest | undefined>,
): InheritanceHarness {
  const load = vi.fn((id: string) => manifests[id]);
  const resolver = new ThemeInheritanceResolver({
    lookup: { get: (id: string) => manifests[id] },
  });
  return { load, resolver };
}

describe("ThemeInheritanceResolver (THEME-07, D-19/D-20)", () => {
  // ── 1. Single theme, no extends ──────────────────────────────────────────
  it("resolves a single theme to a spread-merged identity (leaf id, mode, manifest)", () => {
    const manifests: Record<string, ThemeManifest | undefined> = {
      ocean: makeManifest("ocean", {
        tokens: { colors: { primary: "#1e73e8" } },
      }),
    };
    const { load, resolver } = makeResolver(manifests);

    const resolved = resolver.resolve("ocean", "dark", load);

    expect(load).toHaveBeenCalledWith("ocean");
    expect(resolved).toEqual({
      themeId: "ocean",
      version: "1.0.0",
      mode: "dark",
      manifest: manifests.ocean,
    });
  });

  // ── 2. Linear chain — parent-first merge (D-19) ──────────────────────────
  it("merges a linear chain parent-first: b's base field survives, a's override wins, leaf id preserved", () => {
    const manifests: Record<string, ThemeManifest | undefined> = {
      b: makeManifest("b", {
        trustLevel: 2,
        tokens: { colors: { primary: "#0a3d62" } },
      }),
      a: makeManifest("a", {
        extends: "b",
        version: "2.0.0",
        tokens: { colors: { primary: "#1e73e8" } },
      }),
    };
    const { load, resolver } = makeResolver(manifests);

    const resolved = resolver.resolve("a", "dark", load);

    expect(load).toHaveBeenCalledWith("a");
    expect(load).toHaveBeenCalledWith("b");
    expect(resolved.themeId).toBe("a"); // leaf id, not the parent's
    expect(resolved.version).toBe("2.0.0"); // leaf version at the ResolvedTheme level
    expect(resolved.mode).toBe("dark");
    expect(resolved.manifest.extends).toBe("b"); // preserved
    expect(resolved.manifest.trustLevel).toBe(2); // b's base field survives
    expect(resolved.manifest.tokens.colors.primary).toBe("#1e73e8"); // a's override wins
  });

  // ── 3. Parent-first order proof — token precedence (D-19) ────────────────
  it("parent-first: when parent and child define colors.primary, the child's value wins", () => {
    const manifests: Record<string, ThemeManifest | undefined> = {
      b: makeManifest("b", { tokens: { colors: { primary: "#0a3d62" } } }),
      a: makeManifest("a", {
        extends: "b",
        tokens: { colors: { primary: "#1e73e8" } },
      }),
    };
    const { load, resolver } = makeResolver(manifests);

    const resolved = resolver.resolve("a", "dark", load);

    expect(resolved.manifest.tokens.colors.primary).toBe("#1e73e8");
  });

  // ── 3b. Partial overlay regression (CR-01) ────────────────────────────────
  it("CR-01 regression: a partial child overlay preserves untouched parent token subtrees", () => {
    const manifests: Record<string, ThemeManifest | undefined> = {
      base: makeManifest("base", {
        tokens: {
          colors: { primary: "#1e73e8", background: "#ffffff" },
          spacing: { sm: "4px", lg: "16px" },
        },
      }),
      ocean: makeManifest("ocean", {
        extends: "base",
        tokens: { colors: { primary: "#0a3d62" } },
      }),
    };
    const { load, resolver } = makeResolver(manifests);

    const resolved = resolver.resolve("ocean", "dark", load);

    // child override wins on the leaf it defines
    expect(resolved.manifest.tokens.colors.primary).toBe("#0a3d62");
    // parent subtrees the child does NOT touch survive the deep merge (CR-01)
    expect(resolved.manifest.tokens.colors.background).toBe("#ffffff");
    expect(resolved.manifest.tokens.spacing).toEqual({ sm: "4px", lg: "16px" });
  });

  // ── 4. Cycle → ThemeCycleError with the cycle path (D-19) ────────────────
  it("raises ThemeCycleError carrying the cycle path on a two-node cycle (a↔b)", () => {
    const manifests: Record<string, ThemeManifest | undefined> = {
      a: makeManifest("a", { extends: "b" }),
      b: makeManifest("b", { extends: "a" }),
    };
    const { load, resolver } = makeResolver(manifests);

    let caught: unknown;
    try {
      resolver.resolve("a", "dark", load);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ThemeCycleError);
    // No infinite recursion — the throw terminates (implicit in the test passing).
    expect((caught as ThemeCycleError).toJSON().details.cycle).toEqual([
      "a",
      "b",
      "a",
    ]);
  });

  // ── 5. Self-cycle ────────────────────────────────────────────────────────
  it("raises ThemeCycleError on a self-cycle (a.extends = a)", () => {
    const manifests: Record<string, ThemeManifest | undefined> = {
      a: makeManifest("a", { extends: "a" }),
    };
    const { load, resolver } = makeResolver(manifests);

    expect(() => resolver.resolve("a", "dark", load)).toThrow(ThemeCycleError);
  });

  // ── 6. Missing parent — fails closed in step (D-20) ──────────────────────
  it("fails closed with ThemeNotFoundError(ghost) when a parent manifest is missing", () => {
    const manifests: Record<string, ThemeManifest | undefined> = {
      a: makeManifest("a", { extends: "ghost" }),
    };
    const { load, resolver } = makeResolver(manifests);

    let caught: unknown;
    try {
      resolver.resolve("a", "dark", load);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ThemeNotFoundError);
    expect((caught as ThemeNotFoundError).toJSON().details.themeId).toBe(
      "ghost",
    );
  });

  // ── 7. Deep chain cycle isolation ────────────────────────────────────────
  it("detects a cycle in a deep chain while an independent sibling chain resolves", () => {
    const manifests: Record<string, ThemeManifest | undefined> = {
      a: makeManifest("a", { extends: "b" }),
      b: makeManifest("b", { extends: "c" }),
      c: makeManifest("c", { extends: "a" }),
      base: makeManifest("base", {
        tokens: { colors: { primary: "#0a3d62" } },
      }),
      midnight: makeManifest("midnight", {
        extends: "base",
        tokens: { colors: { primary: "#2c3e50" } },
      }),
    };
    const { load, resolver } = makeResolver(manifests);

    let caught: unknown;
    try {
      resolver.resolve("a", "dark", load);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ThemeCycleError);
    expect((caught as ThemeCycleError).toJSON().details.cycle).toEqual([
      "a",
      "b",
      "c",
      "a",
    ]);

    // The standalone helper resolves an independent sibling chain (midnight→base).
    const sibling = resolveThemeInheritance("midnight", "dark", load);
    expect(sibling.themeId).toBe("midnight");
    expect(sibling.manifest.extends).toBe("base");
    expect(sibling.manifest.tokens.colors.primary).toBe("#2c3e50");
  });

  // ── 8. 02-03 contract lock (delegation proof) ────────────────────────────
  it("implements the 02-03 ThemeInheritanceResolverLike contract", () => {
    expectTypeOf<ThemeInheritanceResolver>().toMatchTypeOf<ThemeInheritanceResolverLike>();
    expectTypeOf<ThemeInheritanceResolverOptions>().toMatchTypeOf<{
      readonly lookup: ThemeManifestLookup;
    }>();
    expectTypeOf<typeof resolveThemeInheritance>().toMatchTypeOf<
      (
        themeId: string,
        mode: ThemeMode,
        load: (id: string) => ThemeManifest | undefined,
      ) => ResolvedTheme
    >();
  });
});
