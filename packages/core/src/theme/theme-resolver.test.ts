/**
 * ThemeResolver — co-located vitest suite (THEME-05, D-13/D-14/D-15/D-17/D-20).
 *
 * Gates the 5-step decomposed pipeline (resolveTarget → resolveAssignment →
 * resolveThemeId → resolveMode → resolveInheritance) and the public
 * ThemeResolver.resolve(ctx) entry:
 *   1. entity-first precedence with ctx.precedence override (D-13), source
 *      recorded on the themeId authority only (D-15);
 *   2. themeId/mode decoupling — a preference selects ONLY mode (D-01,
 *      roadmap criterion #2);
 *   3. fail-open resolve() — ThemeErrors attached to the outcome, never
 *      thrown; unassigned/unregistered targets resolve gracefully (D-20,
 *      roadmap criteria #4/#7);
 *   4. idempotent + deterministic — repeated resolve() deep-equals and never
 *      mutates registry or store (roadmap criterion #3, invariant #5);
 *   5. interface-first inheritance step — delegation to the injected
 *      ThemeInheritanceResolverLike (spy); the DFS implementation ships in
 *      02-04 behind the same contract.
 *
 * Fixture rule (roadmap invariant #8): store / brand / workspace targets
 * only — no other target-type literal appears in this file (grep gate).
 */

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type {
  ResolvedTheme,
  ThemeAssignment,
  ThemeAssignmentChangedPayload,
  ThemeAssignmentsStore,
  ThemeManifest,
  ThemeMode,
  ThemePreference,
  ThemeResolution,
  ThemeResolutionContext,
  ThemeResolutionSource,
  ThemeTarget,
} from "@mosaix/contracts";
import {
  ThemeNotFoundError,
  ThemeVersionError,
  type ThemeError,
} from "./theme-errors";
import {
  InMemoryThemeAssignmentsStore,
  type ThemeMutationListener,
} from "./in-memory-theme-assignments-store";
import {
  ThemeTargetRegistry,
  type ThemeTargetRegistration,
} from "./theme-target-registry";
import {
  DEFAULT_THEME_PRECEDENCE,
  ThemeResolver,
  createThemeResolver,
  resolveAssignment,
  resolveInheritance,
  resolveMode,
  resolveTarget,
  resolveThemeId,
  satisfiesVersion,
  type ThemeIdDecision,
  type ThemeInheritanceResolverLike,
  type ThemeResolverOptions,
  type TargetStepResult,
  type ThemeResolutionOutcome,
  type ModeStepResult,
} from "./theme-resolver";

/** store / brand / workspace fixture set — never a space-type target (invariant #8). */
const shownTypes: readonly ThemeTargetRegistration[] = [
  {
    type: "store",
    capabilities: { userSelectable: true, adminConfigurable: true },
  },
  {
    type: "brand",
    capabilities: { userSelectable: true, adminConfigurable: false },
  },
  {
    type: "workspace",
    capabilities: { userSelectable: false, adminConfigurable: true },
  },
];

const storeTarget: ThemeTarget = { type: "store", id: "acme" };

function assignment(overrides: Partial<ThemeAssignment> = {}): ThemeAssignment {
  return {
    target: storeTarget,
    themeId: "ocean",
    source: "admin",
    updatedAt: "2026-08-09T01:00:00.000Z",
    updatedBy: "alice",
    ...overrides,
  };
}

function manifest(overrides: Partial<ThemeManifest> = {}): ThemeManifest {
  return {
    id: "mosaix.ocean",
    name: "Ocean",
    version: "1.2.3",
    type: "theme",
    metadata: { name: "Ocean" },
    tokens: { colors: { primary: "#1e73e8" } },
    modes: { dark: { colors: { primary: "#0a3d62" } } },
    ...overrides,
  };
}

/** Deterministic manifest provider used by the harness (ocean 1.2.3 / forest 2.0.0). */
function defaultLoadManifest(themeId: string): ThemeManifest | undefined {
  if (themeId === "ocean") return manifest();
  if (themeId === "forest") {
    return manifest({ id: "mosaix.forest", name: "Forest", version: "2.0.0" });
  }
  return undefined;
}

interface ResolverHarnessOverrides {
  readonly registry?: ThemeTargetRegistry;
  readonly store?: ThemeAssignmentsStore;
  readonly loadManifest?: (themeId: string) => ThemeManifest | undefined;
  readonly inheritance?: ThemeInheritanceResolverLike;
  readonly defaultMode?: ThemeMode;
}

function makeResolver(overrides: ResolverHarnessOverrides = {}) {
  const registry = overrides.registry ?? new ThemeTargetRegistry(shownTypes);
  const store = overrides.store ?? new InMemoryThemeAssignmentsStore();
  const options: ThemeResolverOptions = {
    loadManifest: overrides.loadManifest ?? defaultLoadManifest,
  };
  if (overrides.inheritance !== undefined)
    options.inheritance = overrides.inheritance;
  if (overrides.defaultMode !== undefined)
    options.defaultMode = overrides.defaultMode;
  return {
    registry,
    store,
    resolver: new ThemeResolver(registry, store, options),
  };
}

function ctx(
  overrides: Partial<ThemeResolutionContext> = {},
): ThemeResolutionContext {
  return { target: storeTarget, ...overrides };
}

describe("ThemeResolver (THEME-05, D-13/D-14/D-15/D-17/D-20)", () => {
  // ── 1. Shape locks (structural, PATTERNS line 309 convention) ────────────
  it("locks the step result shapes (TargetStepResult, ThemeIdDecision, ModeStepResult)", () => {
    expectTypeOf<TargetStepResult>().toMatchTypeOf<{
      readonly target: ThemeTarget;
      readonly registered: boolean;
    }>();
    expectTypeOf<{
      readonly target: ThemeTarget;
      readonly registered: boolean;
    }>().toMatchTypeOf<TargetStepResult>();

    expectTypeOf<ThemeIdDecision>().toMatchTypeOf<{
      readonly themeId: string;
      readonly source: ThemeResolutionSource;
    }>();
    expectTypeOf<{
      readonly themeId: string;
      readonly source: ThemeResolutionSource;
    }>().toMatchTypeOf<ThemeIdDecision>();

    expectTypeOf<ModeStepResult>().toMatchTypeOf<{
      readonly mode: ThemeMode;
      readonly from: "user" | "application" | "assignment" | "default";
    }>();
    expectTypeOf<{
      readonly mode: ThemeMode;
      readonly from: "user" | "application" | "assignment" | "default";
    }>().toMatchTypeOf<ModeStepResult>();
  });

  it("locks the outcome + inheritance resolver-like shapes (ThemeResolutionOutcome, ThemeInheritanceResolverLike)", () => {
    expectTypeOf<ThemeResolutionOutcome>().toMatchTypeOf<{
      readonly target: ThemeTarget;
      readonly decision?: ThemeResolution;
      readonly resolved?: ResolvedTheme;
      readonly error?: ThemeError;
    }>();
    expectTypeOf<{
      readonly target: ThemeTarget;
      readonly decision?: ThemeResolution;
      readonly resolved?: ResolvedTheme;
      readonly error?: ThemeError;
    }>().toMatchTypeOf<ThemeResolutionOutcome>();

    expectTypeOf<ThemeInheritanceResolverLike>().toMatchTypeOf<{
      resolve(
        themeId: string,
        mode: ThemeMode,
        load: (themeId: string) => ThemeManifest | undefined,
      ): ResolvedTheme;
    }>();
    expectTypeOf<{
      resolve(
        themeId: string,
        mode: ThemeMode,
        load: (themeId: string) => ThemeManifest | undefined,
      ): ResolvedTheme;
    }>().toMatchTypeOf<ThemeInheritanceResolverLike>();
  });

  it("locks the default precedence chain to entity > user > application > platform (D-13)", () => {
    expectTypeOf<typeof DEFAULT_THEME_PRECEDENCE>().toMatchTypeOf<
      readonly ThemeResolutionSource[]
    >();
    expect(DEFAULT_THEME_PRECEDENCE).toEqual([
      "entity",
      "user",
      "application",
      "platform",
    ]);
  });

  // ── 2. Step 1 — target (D-17) ────────────────────────────────────────────
  it("resolveTarget reports registered:true for a known target type, no throw", () => {
    const registry = new ThemeTargetRegistry(shownTypes);
    const result = resolveTarget(ctx(), registry);

    expect(result).toEqual({ target: storeTarget, registered: true });
  });

  it("resolveTarget reports registered:false for an unknown type, no throw (D-17)", () => {
    const registry = new ThemeTargetRegistry(shownTypes);
    const unknown: ThemeTarget = { type: "community", id: "c_1" };

    expect(() => resolveTarget({ target: unknown }, registry)).not.toThrow();
    expect(resolveTarget({ target: unknown }, registry)).toEqual({
      target: unknown,
      registered: false,
    });
  });

  // ── 3. Step 2 — assignment (D-18) ────────────────────────────────────────
  it("resolveAssignment returns the stored assignment for an assigned target", () => {
    const store = new InMemoryThemeAssignmentsStore();
    const input = assignment();
    store.assign(input);

    expect(resolveAssignment(ctx(), store)).toEqual(input);
  });

  it("resolveAssignment returns undefined for an unassigned target", () => {
    const store = new InMemoryThemeAssignmentsStore();
    expect(resolveAssignment(ctx(), store)).toBeUndefined();
  });

  // ── 4. Step 3 — themeId precedence (D-13/D-15) ───────────────────────────
  it("resolveThemeId resolves entity-first with source entity when assigned", () => {
    const store = new InMemoryThemeAssignmentsStore();
    store.assign(assignment());

    expect(resolveThemeId(ctx(), store.get(storeTarget))).toEqual({
      themeId: "ocean",
      source: "entity",
    });
  });

  it("resolveThemeId: user preference never yields a themeId (mode-only, D-01)", () => {
    const userPreference: ThemePreference = {
      inherit: false,
      preferredMode: "dark",
      allowedModes: ["dark", "light"],
    };

    expect(resolveThemeId(ctx({ userPreference }), undefined)).toBeUndefined();
  });

  it("resolveThemeId honors ctx.precedence override; application has no Phase-2 surface (D-13)", () => {
    const store = new InMemoryThemeAssignmentsStore();
    store.assign(assignment({ target: { type: "brand", id: "b_1" } }));
    const brandTarget: ThemeTarget = { type: "brand", id: "b_1" };

    const decision = resolveThemeId(
      { target: brandTarget, precedence: ["application", "entity"] },
      store.get(brandTarget),
    );

    expect(decision).toEqual({ themeId: "ocean", source: "entity" });
  });

  it("resolveThemeId returns undefined without an assignment", () => {
    expect(resolveThemeId(ctx(), undefined)).toBeUndefined();
  });

  // ── 5. Step 4 — mode decoupling (D-01, roadmap criterion #2) ─────────────
  it("resolveMode: user preferredMode within allowedModes wins (from user)", () => {
    const result = resolveMode(
      ctx({
        userPreference: {
          inherit: false,
          preferredMode: "dark",
          allowedModes: ["dark", "light"],
        },
      }),
      undefined,
    );

    expect(result).toEqual({ mode: "dark", from: "user" });
  });

  it("resolveMode: disallowed preferredMode falls through to assignment.mode", () => {
    const result = resolveMode(
      ctx({
        userPreference: {
          inherit: false,
          preferredMode: "dark",
          allowedModes: ["light"],
        },
      }),
      assignment({ mode: "light" }),
    );

    expect(result).toEqual({ mode: "light", from: "assignment" });
  });

  it("resolveMode: inherit:true is skipped; falls to default system (D-01)", () => {
    const result = resolveMode(
      ctx({
        userPreference: { inherit: true, preferredMode: "dark" },
      }),
      undefined,
    );

    expect(result).toEqual({ mode: "system", from: "default" });
  });

  it("resolveMode: application preference wins when no user preference", () => {
    const result = resolveMode(
      ctx({
        applicationPreference: {
          inherit: false,
          preferredMode: "light",
          allowedModes: ["light", "dark"],
        },
      }),
      undefined,
    );

    expect(result).toEqual({ mode: "light", from: "application" });
  });

  // ── 6. Version gate ──────────────────────────────────────────────────────
  it("satisfiesVersion: exact + caret triple matching", () => {
    expect(satisfiesVersion("^1.0.0", "1.2.3")).toBe(true);
    expect(satisfiesVersion("1.2.3", "1.2.3")).toBe(true);
    expect(satisfiesVersion("^1.0.0", "2.0.0")).toBe(false);
    expect(satisfiesVersion("^2.0.0", "2.1.0")).toBe(true);
    expect(satisfiesVersion("^1.0.0", "1.0.0")).toBe(true);
  });

  it("satisfiesVersion: major-0 caret clamps to semver (WR-01)", () => {
    expect(satisfiesVersion("^0.0.3", "0.0.3")).toBe(true);
    expect(satisfiesVersion("^0.0.3", "0.0.4")).toBe(false);
    expect(satisfiesVersion("^0.0.3", "0.1.0")).toBe(false);
    expect(satisfiesVersion("^0.2.3", "0.2.9")).toBe(true);
    expect(satisfiesVersion("^0.2.3", "0.3.0")).toBe(false);
    expect(satisfiesVersion("^0.2.3", "0.9.0")).toBe(false);
    // major ≥ 1 behavior unchanged
    expect(satisfiesVersion("^1.2.3", "1.9.9")).toBe(true);
    expect(satisfiesVersion("^1.2.3", "2.0.0")).toBe(false);
  });

  // ── 7. Step 5 — inheritance boundary (interface-first) ───────────────────
  it("resolveInheritance throws ThemeNotFoundError on a missing manifest", () => {
    expect(() =>
      resolveInheritance({ themeId: "missing", source: "entity" }, "dark", {
        loadManifest: () => undefined,
      }),
    ).toThrow(ThemeNotFoundError);
  });

  it("resolveInheritance throws ThemeVersionError on a version-range mismatch", () => {
    expect(() =>
      resolveInheritance({ themeId: "ocean", source: "entity" }, "dark", {
        loadManifest: defaultLoadManifest,
        requiredVersion: "^2.0.0",
      }),
    ).toThrow(ThemeVersionError);
  });

  it("resolveInheritance delegates to the injected inheritance resolver (spy)", () => {
    const resolveSpy = vi.fn(
      (
        themeId: string,
        mode: ThemeMode,
        load: (themeId: string) => ThemeManifest | undefined,
      ): ResolvedTheme => ({
        themeId,
        version: "1.2.3",
        mode,
        manifest: load(themeId) ?? manifest(),
      }),
    );
    const inheritance: ThemeInheritanceResolverLike = { resolve: resolveSpy };

    const result = resolveInheritance(
      { themeId: "ocean", source: "entity" },
      "dark",
      { loadManifest: defaultLoadManifest, inheritance },
    );

    expect(resolveSpy).toHaveBeenCalledTimes(1);
    expect(resolveSpy).toHaveBeenCalledWith(
      "ocean",
      "dark",
      expect.any(Function),
    );
    expect(result).toEqual({
      themeId: "ocean",
      version: "1.2.3",
      mode: "dark",
      manifest: manifest(),
    });
  });

  it("resolveInheritance single-theme fast path returns the ResolvedTheme", () => {
    const result = resolveInheritance(
      { themeId: "ocean", source: "entity" },
      "dark",
      { loadManifest: defaultLoadManifest },
    );

    expect(result).toEqual({
      themeId: "ocean",
      version: "1.2.3",
      mode: "dark",
      manifest: manifest(),
    });
  });

  // ── 8. Integration (roadmap criterion #2 fixture) ────────────────────────
  it("integration: store assignment + user dark preference → ocean/dark from entity", async () => {
    const { store, resolver } = makeResolver();
    store.assign(assignment());

    const outcome = await resolver.resolve(
      ctx({
        userPreference: {
          inherit: false,
          preferredMode: "dark",
          allowedModes: ["dark", "light"],
        },
      }),
    );

    expect(outcome.decision).toEqual({
      themeId: "ocean",
      mode: "dark",
      source: "entity",
    });
    expect(outcome.resolved).toMatchObject({
      themeId: "ocean",
      mode: "dark",
    });
    expect(outcome.error).toBeUndefined();
  });

  it("resolve() uses options.defaultMode when nothing sets a mode (D-09)", async () => {
    const { store, resolver } = makeResolver({ defaultMode: "light" });
    store.assign(assignment());

    const outcome = await resolver.resolve(ctx());

    expect(outcome.decision?.mode).toBe("light");
    expect(outcome.resolved?.mode).toBe("light");
  });

  // ── 9. Fail-open (D-20, roadmap criterion #7) ────────────────────────────
  it("fail-open: missing manifest → outcome with ThemeNotFoundError attached, NO throw", async () => {
    const { store, resolver } = makeResolver({
      loadManifest: () => undefined,
    });
    store.assign(assignment());

    const outcome = await resolver.resolve(ctx());

    expect(outcome.error).toBeInstanceOf(ThemeNotFoundError);
    expect(outcome.resolved).toBeUndefined();
    expect(outcome.decision).toEqual({
      themeId: "ocean",
      mode: "system",
      source: "entity",
    });
  });

  it("fail-open: unregistered target + no assignment → graceful { target }, NO registration (D-17, roadmap #4)", async () => {
    const registry = new ThemeTargetRegistry(shownTypes);
    const { resolver } = makeResolver({ registry });
    const unknown: ThemeTarget = { type: "community", id: "c_2" };

    const outcome = await resolver.resolve({ target: unknown });

    expect(outcome).toEqual({ target: unknown });
    expect(outcome.error).toBeUndefined();
    expect(registry.size).toBe(3); // no implicit target creation (invariant #5)
  });

  // ── 10. Idempotent + no implicit registration (roadmap criteria #3/#4) ───
  it("idempotent: two resolve() calls deep-equal; registry + store untouched", async () => {
    const { registry, store, resolver } = makeResolver();
    store.assign(assignment());
    const registrySize = registry.size;
    const storeCount = store.list().length;
    const context = ctx({
      userPreference: {
        inherit: false,
        preferredMode: "dark",
        allowedModes: ["dark", "light"],
      },
    });

    const first = await resolver.resolve(context);
    const second = await resolver.resolve(context);

    expect(second).toEqual(first);
    expect(registry.size).toBe(registrySize);
    expect(store.list()).toHaveLength(storeCount);
  });

  // ── 11. Store wiring + factory (roadmap criterion #5, 02-04 task 2) ───────
  it("createThemeResolver returns a resolver whose store emits through the wired onMutation (roadmap criterion #5)", () => {
    const spy = vi.fn();
    const store = new InMemoryThemeAssignmentsStore({ onMutation: spy });
    const resolver = createThemeResolver({
      registry: new ThemeTargetRegistry(shownTypes),
      store,
      loadManifest: defaultLoadManifest,
    });

    store.assign(
      assignment({
        mode: "dark",
        version: "1.0.0",
        updatedBy: "admin",
      }),
    );

    expect(resolver).toBeInstanceOf(ThemeResolver);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining<Partial<ThemeAssignmentChangedPayload>>({
        target: expect.objectContaining({ type: "store" }),
        changedBy: "admin",
      }),
    );
  });

  it("ThemeResolverOptions.onMutation is an optional wiring field (expectTypeOf lock)", () => {
    expectTypeOf<ThemeResolverOptions["onMutation"]>().toEqualTypeOf<
      ThemeMutationListener | undefined
    >();
  });

  it("WR-02: factory seeds a pre-populated store WITHOUT emitting; later assigns emit once", () => {
    const spy = vi.fn();
    const store = new InMemoryThemeAssignmentsStore();
    store.assign(assignment({ themeId: "ocean" }));

    const resolver = createThemeResolver({
      registry: new ThemeTargetRegistry(shownTypes),
      store,
      loadManifest: defaultLoadManifest,
      onMutation: spy,
    });

    // bootstrap re-seed emits no backdated events (WR-02)
    expect(spy).not.toHaveBeenCalled();

    // the resolver's wired store is a new in-memory store seeded from `store`
    const wiredStore = (
      resolver as unknown as { store: InMemoryThemeAssignmentsStore }
    ).store;
    wiredStore.assign(assignment({ themeId: "forest" }));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining<Partial<ThemeAssignmentChangedPayload>>({
        target: expect.objectContaining({ type: "store" }),
        changedBy: "alice",
      }),
    );
  });

  it("WR-02: onMutation with a non-in-memory store throws TypeError, not silently dropped", () => {
    const fakeStore: ThemeAssignmentsStore = {
      assign: () => {},
      unassign: () => {},
      get: () => undefined,
      list: () => [],
    };

    expect(() =>
      createThemeResolver({
        registry: new ThemeTargetRegistry(shownTypes),
        store: fakeStore,
        loadManifest: defaultLoadManifest,
        onMutation: () => {},
      }),
    ).toThrow(TypeError);
  });

  it("constructing without onMutation still resolves (no-op emit)", async () => {
    const { resolver } = makeResolver();

    const outcome = await resolver.resolve(ctx());

    expect(outcome).toEqual({ target: storeTarget });
    expect(outcome.error).toBeUndefined();
  });

  it("regression: factory-created resolver keeps fail-open semantics (no mutation wiring)", async () => {
    const store = new InMemoryThemeAssignmentsStore();
    store.assign(assignment());
    const resolver = createThemeResolver({
      registry: new ThemeTargetRegistry(shownTypes),
      store,
      loadManifest: () => undefined,
    });

    const outcome = await resolver.resolve(ctx());

    expect(outcome.error).toBeInstanceOf(ThemeNotFoundError);
    expect(outcome.resolved).toBeUndefined();
  });
});
