/**
 * @mosaix/core — ThemeResolver pipeline (THEME-05)
 *
 * Entity-first, themeId/mode-decoupled resolution (PRD-0008 §8, D-13/D-14/D-15).
 * Public entry resolve(ctx) wires 5 exported steps; each step is a pure function
 * of its inputs (idempotent, deterministic — roadmap criterion #3).
 * Fail-open policy (D-20): steps fail closed (throw ThemeError), resolve()
 * catches and returns an outcome with error attached — never crashes.
 *
 * Depends on: @mosaix/contracts (type-only), ./theme-target-registry (02-01),
 *   ./theme-errors (02-02), ./in-memory-theme-assignments-store port via contracts
 * Consumed by: Phase 3 ThemeRuntime, SDK theme.get/resolve (Phase 4), shell
 */

import type {
  ResolvedTheme,
  ThemeAssignment,
  ThemeAssignmentsStore,
  ThemeManifest,
  ThemeMode,
  ThemePreference,
  ThemeResolution,
  ThemeResolutionContext,
  ThemeResolutionSource,
  ThemeTarget,
} from "@mosaix/contracts";
import type { ThemeTargetRegistry } from "./theme-target-registry";
import {
  ThemeError,
  ThemeNotFoundError,
  ThemeVersionError,
} from "./theme-errors";
import {
  InMemoryThemeAssignmentsStore,
  type ThemeMutationListener,
} from "./in-memory-theme-assignments-store";

/** D-13 default authority chain — ctx.precedence overrides when present. */
export const DEFAULT_THEME_PRECEDENCE: readonly ThemeResolutionSource[] = [
  "entity",
  "user",
  "application",
  "platform",
] as const;

// ─── Step 1 — target (D-17: unknown type = absent source, NEVER an error) ───

export interface TargetStepResult {
  readonly target: ThemeTarget;
  /** registry.get(type) !== undefined — capabilities known, not a gate. */
  readonly registered: boolean;
}

export function resolveTarget(
  ctx: ThemeResolutionContext,
  registry: ThemeTargetRegistry,
): TargetStepResult {
  // registry.get only — never register (D-16/D-17, invariant #5).
  return {
    target: ctx.target,
    registered: registry.get(ctx.target.type) !== undefined,
  };
}

// ─── Step 2 — assignment (D-18: store.get is optional-return) ───

/** Returns the entity assignment for ctx.target, or undefined when unassigned. */
export function resolveAssignment(
  ctx: ThemeResolutionContext,
  store: ThemeAssignmentsStore,
): ThemeAssignment | undefined {
  return store.get(ctx.target);
}

// ─── Step 3 — themeId decision (D-13/D-15: authority chain, source recorded) ───

export interface ThemeIdDecision {
  readonly themeId: string;
  readonly source: ThemeResolutionSource;
}

/**
 * Iterates ctx.precedence ?? DEFAULT_THEME_PRECEDENCE.
 * Phase-2 surfaces: only "entity" carries a themeId (store assignment);
 * "user"/"application" preferences are mode-only per D-01 (reserved slots in
 * the chain); "platform" default has no store in Phase 2 (deferred). Returns
 * the first authority that yields a themeId, or undefined.
 */
export function resolveThemeId(
  ctx: ThemeResolutionContext,
  assignment: ThemeAssignment | undefined,
): ThemeIdDecision | undefined {
  const chain = ctx.precedence ?? DEFAULT_THEME_PRECEDENCE;
  for (const source of chain) {
    if (source === "entity") {
      const themeId = assignment?.themeId;
      if (themeId !== undefined) {
        return { themeId, source: "entity" };
      }
      // (Phase 2: no surface — user/application preferences are mode-only D-01;
      //  platform/default store deferred)
    }
  }
  return undefined;
}

// ─── Step 4 — mode decision (D-01/D-13: decoupled from themeId) ───

export interface ModeStepResult {
  readonly mode: ThemeMode;
  readonly from: "user" | "application" | "assignment" | "default";
}

/**
 * D-01: a preference determines ONLY mode. User preference wins (roadmap
 * criterion #2), constrained by allowedModes; inherit:true is skipped;
 * then application preference; then assignment.mode; then defaultMode ("system").
 */
export function resolveMode(
  ctx: ThemeResolutionContext,
  assignment: ThemeAssignment | undefined,
  defaultMode?: ThemeMode,
): ModeStepResult {
  const userMode = preferenceMode(ctx.userPreference);
  if (userMode !== undefined) {
    return { mode: userMode, from: "user" };
  }
  const applicationMode = preferenceMode(ctx.applicationPreference);
  if (applicationMode !== undefined) {
    return { mode: applicationMode, from: "application" };
  }
  if (assignment?.mode !== undefined) {
    return { mode: assignment.mode, from: "assignment" };
  }
  return { mode: defaultMode ?? "system", from: "default" };
}

/**
 * Mode candidate from a preference: undefined when the preference is absent,
 * inherits, has no preferredMode, or the preferredMode is outside allowedModes.
 */
function preferenceMode(
  preference: ThemePreference | undefined,
): ThemeMode | undefined {
  if (preference === undefined) return undefined;
  if (preference.inherit) return undefined; // inherit:true → skip (D-01)
  const preferred = preference.preferredMode;
  if (preferred === undefined) return undefined;
  const allowed = preference.allowedModes;
  if (allowed !== undefined && !allowed.includes(preferred)) return undefined;
  return preferred;
}

// ─── Step 5 — inheritance boundary (DFS implementation lands in 02-04) ───

export interface ThemeInheritanceResolverLike {
  /**
   * DFS parent-first resolve of the extends graph rooted at themeId.
   * Throws ThemeNotFoundError / ThemeCycleError (fails-closed in step, D-20).
   * Implemented by ThemeInheritanceResolver in 02-04.
   */
  resolve(
    themeId: string,
    mode: ThemeMode,
    load: (themeId: string) => ThemeManifest | undefined,
  ): ResolvedTheme;
}

export interface InheritanceStepDeps {
  readonly loadManifest: (themeId: string) => ThemeManifest | undefined;
  /** Injected by 02-04; absent → single-theme fast path (no extends traversal). */
  readonly inheritance?: ThemeInheritanceResolverLike;
  /** assignment.version (semver range, e.g. "^1.0.0") — checked against the leaf manifest. */
  readonly requiredVersion?: string;
}

/**
 * Fails-closed in step (D-20/D-21): missing manifest → ThemeNotFoundError,
 * version-range mismatch → ThemeVersionError. Delegates to the injected DFS
 * inheritance resolver when present; single-theme fast path otherwise.
 */
export function resolveInheritance(
  decision: ThemeIdDecision,
  mode: ThemeMode,
  deps: InheritanceStepDeps,
): ResolvedTheme {
  const manifest = deps.loadManifest(decision.themeId);
  if (manifest === undefined) {
    throw new ThemeNotFoundError(decision.themeId);
  }
  if (
    deps.requiredVersion !== undefined &&
    !satisfiesVersion(deps.requiredVersion, manifest.version)
  ) {
    throw new ThemeVersionError(
      decision.themeId,
      deps.requiredVersion,
      manifest.version,
    );
  }
  if (deps.inheritance !== undefined) {
    return deps.inheritance.resolve(decision.themeId, mode, deps.loadManifest);
  }
  return {
    themeId: decision.themeId,
    version: manifest.version,
    mode,
    manifest,
  };
}

/** Minimal semver satisfaction: exact match or ^major.minor.patch caret (0.x clamped, WR-01). */
export function satisfiesVersion(required: string, found: string): boolean {
  const req = required.trim();
  const fnd = found.trim();
  if (req === fnd) return true;

  // Found is always a concrete manifest version (exact triple).
  const foundTriple = /^(\d+)\.(\d+)\.(\d+)$/.exec(fnd);
  if (foundTriple === null) return false;

  // Minimal caret check — full semver stays out of core (Phase 3 compiler concern).
  const caret = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(req);
  if (caret === null) return false;

  const reqMajor = Number(caret[1]);
  const reqMinor = Number(caret[2]);
  const reqPatch = Number(caret[3]);
  const foundMajor = Number(foundTriple[1]);
  const foundMinor = Number(foundTriple[2]);
  const foundPatch = Number(foundTriple[3]);

  if (foundMajor !== reqMajor) return false;
  if (reqMajor === 0) {
    // Major-0 caret (WR-01, semver): ^0.x.y < 0.(x+1).0; ^0.0.y is exact.
    if (foundMinor !== reqMinor) return false;
    return reqMinor === 0 ? foundPatch === reqPatch : foundPatch >= reqPatch;
  }
  if (foundMinor > reqMinor) return true;
  if (foundMinor < reqMinor) return false;
  return foundPatch >= reqPatch;
}

// ─── Public entry (mirrors kernel.ts executeCapability flow-comment style) ───

export interface ThemeResolverOptions {
  /** Injected theme manifest provider (Phase-3 catalog/bootstrap wires the real one). */
  readonly loadManifest?: (themeId: string) => ThemeManifest | undefined;
  /** DFS extends resolver — wired by 02-04. */
  readonly inheritance?: ThemeInheritanceResolverLike;
  /** Fallback mode when nothing sets one. Default: "system" (D-09). */
  readonly defaultMode?: ThemeMode;
  /**
   * Kernel EventBus wiring for store mutations (roadmap criterion #5).
   * Accepted by the `createThemeResolver` factory (forwarded into the store
   * wiring); the ThemeResolver class itself ignores it — the store never
   * imports the kernel bus (02-02 invariant). Requires an in-memory store:
   * supplying it with a non-`InMemoryThemeAssignmentsStore` throws TypeError
   * instead of being silently dropped (WR-02).
   */
  readonly onMutation?: ThemeMutationListener;
}

/**
 * `createThemeResolver` — composition factory (roadmap criterion #5: store
 * mutation events → kernel EventBus by the service layer; the store itself
 * never imports the kernel bus). Accepts a registry, an assignments store, and an
 * optional `onMutation` emitter:
 *  - when the caller supplies a store already wired with `onMutation`, it is
 *    used as-is (cleanest, explicit wiring);
 *  - when `onMutation` is supplied AND the store is the in-memory adapter, the
 *    store is re-wrapped with the emitter wired and re-seeded from
 *    `store.list()` via `seed()` — existing bindings survive the wrap WITHOUT
 *    re-emitting backdated mutation events (WR-02);
 *  - when `onMutation` is supplied AND the store is NOT the in-memory adapter,
 *    a `TypeError` is thrown instead of silently dropping the wiring (WR-02).
 * Returns `new ThemeResolver(registry, store, options)`.
 */
export function createThemeResolver(
  options: ThemeResolverOptions & {
    readonly registry: ThemeTargetRegistry;
    readonly store: ThemeAssignmentsStore;
  },
): ThemeResolver {
  const { registry, store, onMutation, ...resolverOptions } = options;

  let wiredStore = store;
  if (onMutation !== undefined) {
    if (!(store instanceof InMemoryThemeAssignmentsStore)) {
      throw new TypeError(
        "createThemeResolver: onMutation requires an InMemoryThemeAssignmentsStore (or a pre-wired store)",
      );
    }
    const seededStore = new InMemoryThemeAssignmentsStore({ onMutation });
    seededStore.seed(store.list());
    wiredStore = seededStore;
  }

  return new ThemeResolver(registry, wiredStore, resolverOptions);
}

export interface ThemeResolutionOutcome {
  readonly target: ThemeTarget;
  /** Decision record: { themeId, mode, source } — source = themeId authority (D-15). */
  readonly decision?: ThemeResolution;
  /** Extends-resolved manifest ready for Phase-3 compile. Undefined on fail-open. */
  readonly resolved?: ResolvedTheme;
  /** Attached on fail-open (D-20): ThemeNotFoundError / ThemeVersionError / ThemeCycleError. Never thrown from resolve(). */
  readonly error?: ThemeError;
}

export class ThemeResolver {
  private readonly loadManifest: (themeId: string) => ThemeManifest | undefined;

  constructor(
    private readonly registry: ThemeTargetRegistry,
    private readonly store: ThemeAssignmentsStore,
    private readonly options: ThemeResolverOptions = {},
  ) {
    // Unconfigured provider fails open as "theme not found" (D-20) rather than
    // crashing with a TypeError — programmer error stays rethrowable.
    this.loadManifest = options.loadManifest ?? (() => undefined);
  }

  /**
   * Resolve which theme applies to ctx.target.
   * Flow (numbered, kernel.ts 422–446 style):
   *  1. resolveTarget  — registry.read, never registers (D-17, invariant #5)
   *  2. resolveAssignment — store.get(ctx.target) (optional-return)
   *  3. resolveThemeId — precedence chain (D-13), source recorded (D-15)
   *  4. resolveMode    — preference-first, decoupled (D-01)
   *  5. resolveInheritance — manifest load + version gate + extends DFS (D-19/D-20)
   * Fail-open: ThemeError raised by steps → caught, attached to outcome.error,
   *  never rethrown (D-20, roadmap criterion #7). Non-ThemeError → rethrow.
   */
  async resolve(ctx: ThemeResolutionContext): Promise<ThemeResolutionOutcome> {
    //  1. resolveTarget — registry.read, never registers (D-17, invariant #5)
    resolveTarget(ctx, this.registry);

    //  2. resolveAssignment — store.get(ctx.target) (optional-return)
    const assignment = resolveAssignment(ctx, this.store);

    let decision: ThemeResolution | undefined;
    try {
      //  3. resolveThemeId — precedence chain (D-13), source recorded (D-15)
      const themeIdDecision = resolveThemeId(ctx, assignment);
      if (themeIdDecision === undefined) {
        // Unassigned / no authority yields → graceful outcome (roadmap #4).
        return { target: ctx.target };
      }

      //  4. resolveMode — preference-first, decoupled (D-01)
      const modeStep = resolveMode(ctx, assignment, this.options.defaultMode);
      decision = {
        themeId: themeIdDecision.themeId,
        mode: modeStep.mode,
        source: themeIdDecision.source,
      };

      //  5. resolveInheritance — manifest load + version gate + extends DFS (D-19/D-20)
      const deps: InheritanceStepDeps = {
        loadManifest: this.loadManifest,
        ...(this.options.inheritance !== undefined
          ? { inheritance: this.options.inheritance }
          : {}),
        ...(assignment?.version !== undefined
          ? { requiredVersion: assignment.version }
          : {}),
      };
      const resolved = resolveInheritance(themeIdDecision, modeStep.mode, deps);

      return { target: ctx.target, decision, resolved };
    } catch (error) {
      if (error instanceof ThemeError) {
        // Fail-open: theme failures attach, never crash (D-20, roadmap #7).
        const outcome: ThemeResolutionOutcome = {
          target: ctx.target,
          error,
          ...(decision !== undefined ? { decision } : {}),
        };
        return outcome;
      }
      throw error; // programmer error — rethrow
    }
  }
}
