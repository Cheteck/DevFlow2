/**
 * Theme contracts — type-assertion suite for the generic theme ABI.
 *
 * `expectTypeOf` assertions are enforced at compile time (tsc); the `it()`
 * wrappers make them visible in `pnpm test`. Fixtures use custom target types
 * (store, brand, workspace) per roadmap invariant #8 / THEME-15.
 *
 * Note: `toEqualTypeOf` relies on TS's internal type-identity operator, which
 * reports false for structurally identical types declared in different
 * modules. Object shapes are therefore locked with mutual `toMatchTypeOf`
 * (both directions extend each other ⇒ exact shape, ignoring readonly which is
 * erased at runtime); unions, records and same-module aliases keep
 * `toEqualTypeOf`.
 *
 * PRD-0008 §4, CONTEXT D-01/D-02/D-04/D-05/D-06/D-07, correction C2.
 */

import { describe, expect, expectTypeOf, it } from "vitest";

import type {
  ExperienceThemePreference,
  ThemePreference as LegacyThemePreference,
} from "../experience/theme-contract";
import type {
  AssignmentSource,
  CompiledTheme,
  ResolvedTheme,
  ThemeAssignment,
  ThemeManifest,
  ThemeMode,
  ThemePreference,
  ThemeResolution,
  ThemeResolutionContext,
  ThemeResolutionSource,
  ThemeTarget,
} from "../index";

describe("ThemeMode (D-09, drift prevention)", () => {
  it("is exactly light | dark | system", () => {
    expectTypeOf<ThemeMode>().toEqualTypeOf<"light" | "dark" | "system">();
  });
});

describe("ThemeTarget (INV-THEME-001/002, success criteria #5)", () => {
  it("is exactly { type: string; id: string } with zero business fields", () => {
    expectTypeOf<ThemeTarget>().toEqualTypeOf<{
      readonly type: string;
      readonly id: string;
    }>();
  });

  it("authors a target for a custom entity type without business references", () => {
    const target: ThemeTarget = { type: "store", id: "store_9" };
    expect(target).toEqual({ type: "store", id: "store_9" });
  });
});

describe("ThemeAssignment (PRD §4.2)", () => {
  it("declares exactly the four assignment authorities", () => {
    expectTypeOf<AssignmentSource>().toEqualTypeOf<
      "platform" | "admin" | "user" | "application"
    >();
  });

  it("has the PRD §4.2 shape", () => {
    type AssignmentShape = {
      readonly target: ThemeTarget;
      readonly themeId: string;
      readonly version?: string;
      readonly mode?: ThemeMode;
      readonly source: AssignmentSource;
      readonly updatedAt?: string;
      readonly updatedBy?: string;
    };
    expectTypeOf<ThemeAssignment>().toMatchTypeOf<AssignmentShape>();
    expectTypeOf<AssignmentShape>().toMatchTypeOf<ThemeAssignment>();
  });

  it("builds an assignment for a custom target (success criteria #5)", () => {
    const assignment: ThemeAssignment = {
      target: { type: "brand", id: "brand_7" },
      themeId: "ocean",
      version: "^1.0.0",
      mode: "dark",
      source: "admin",
    };
    expect(assignment.target.type).toBe("brand");
    expect(assignment.source).toBe("admin");
  });
});

describe("ThemePreference (D-01, PRD §4.3 V2.3)", () => {
  it("is the canonical generic preference: mode only, never identity", () => {
    type PreferenceShape = {
      readonly inherit: boolean;
      readonly allowedModes?: readonly ThemeMode[];
      readonly preferredMode?: ThemeMode;
    };
    expectTypeOf<ThemePreference>().toMatchTypeOf<PreferenceShape>();
    expectTypeOf<PreferenceShape>().toMatchTypeOf<ThemePreference>();
  });

  it("is schema-valid with no assignment context (THEME-03, structure only)", () => {
    const preference: ThemePreference = {
      inherit: false,
      preferredMode: "dark",
    };
    expect(preference.inherit).toBe(false);
  });

  it("deprecated legacy alias resolves to ExperienceThemePreference (D-02)", () => {
    expectTypeOf<LegacyThemePreference>().toEqualTypeOf<ExperienceThemePreference>();
    type ExperienceShape = {
      readonly inherit: boolean;
      readonly supports: string[];
      readonly preferred?: string;
    };
    expectTypeOf<ExperienceThemePreference>().toMatchTypeOf<ExperienceShape>();
    expectTypeOf<ExperienceShape>().toMatchTypeOf<ExperienceThemePreference>();
  });
});

describe("ThemeResolution (D-04/D-05/D-06)", () => {
  it("source is exactly entity | user | application | platform — no tenant/default", () => {
    expectTypeOf<ThemeResolutionSource>().toEqualTypeOf<
      "entity" | "user" | "application" | "platform"
    >();
  });

  it("is exactly the lightweight decision record { themeId, mode, source }", () => {
    type ResolutionShape = {
      readonly themeId: string;
      readonly mode: ThemeMode;
      readonly source: ThemeResolutionSource;
    };
    expectTypeOf<ThemeResolution>().toMatchTypeOf<ResolutionShape>();
    expectTypeOf<ResolutionShape>().toMatchTypeOf<ThemeResolution>();
  });

  it("builds a ThemeResolution value (D-05)", () => {
    const resolution: ThemeResolution = {
      themeId: "ocean",
      mode: "system",
      source: "user",
    };
    expect(resolution).toEqual({
      themeId: "ocean",
      mode: "system",
      source: "user",
    });
  });

  it("ThemeResolutionContext is standalone — exact shape, no composition-context dependency (D-06)", () => {
    type ContextShape = {
      readonly target: ThemeTarget;
      readonly userPreference?: ThemePreference;
      readonly applicationPreference?: ThemePreference;
      readonly precedence?: readonly ThemeResolutionSource[];
    };
    expectTypeOf<ThemeResolutionContext>().toMatchTypeOf<ContextShape>();
    expectTypeOf<ContextShape>().toMatchTypeOf<ThemeResolutionContext>();
  });

  it("accepts a target alone and an explicit precedence list", () => {
    const minimal: ThemeResolutionContext = {
      target: { type: "workspace", id: "ws_3" },
    };
    const withPrecedence: ThemeResolutionContext = {
      target: { type: "workspace", id: "ws_3" },
      precedence: ["entity", "user"],
    };
    expect(minimal.target.id).toBe("ws_3");
    expect(withPrecedence.precedence).toHaveLength(2);
  });
});

describe("ResolvedTheme + CompiledTheme (D-07, C2)", () => {
  it("ResolvedTheme has the D-07 shape with the final manifest", () => {
    type ResolvedShape = {
      readonly target?: ThemeTarget;
      readonly themeId: string;
      readonly version: string;
      readonly mode: ThemeMode;
      readonly manifest: ThemeManifest;
    };
    expectTypeOf<ResolvedTheme>().toMatchTypeOf<ResolvedShape>();
    expectTypeOf<ResolvedShape>().toMatchTypeOf<ResolvedTheme>();
  });

  it("CompiledTheme is Record<string, string>, never unknown (C2)", () => {
    expectTypeOf<CompiledTheme>().toEqualTypeOf<Record<string, string>>();
    const compiled: CompiledTheme = { "--mx-color-primary": "#1e73e8" };
    expect(compiled["--mx-color-primary"]).toBe("#1e73e8");
  });
});

describe("ThemeManifest.modes overlay (D-08/D-10)", () => {
  it("accepts an optional light/dark overlay, additive over the base fields", () => {
    const manifest: ThemeManifest = {
      id: "enterprise",
      name: "Enterprise",
      version: "1.0.0",
      type: "theme",
      metadata: { name: "Enterprise" },
      tokens: { colors: { primary: "#1f2937" } },
      modes: { dark: { colors: { primary: "#000000" } } },
    };
    expect(manifest.modes?.dark?.colors.primary).toBe("#000000");
  });
});
