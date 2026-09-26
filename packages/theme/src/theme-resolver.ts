/**
 * @mosaix/theme — ThemeResolver
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
import type { ThemeTargetRegistry } from "./theme-target-registry.js";
import {
  ThemeError,
  ThemeNotFoundError,
  ThemeVersionError,
} from "./theme-errors.js";
import {
  InMemoryThemeAssignmentsStore,
  type ThemeMutationListener,
} from "./in-memory-theme-assignments-store.js";

export const DEFAULT_THEME_PRECEDENCE: readonly ThemeResolutionSource[] = [
  "entity",
  "user",
  "application",
  "platform",
] as const;

export interface TargetStepResult {
  readonly target: ThemeTarget;
  readonly registered: boolean;
}

export function resolveTarget(
  ctx: ThemeResolutionContext,
  registry: ThemeTargetRegistry,
): TargetStepResult {
  return {
    target: ctx.target,
    registered: registry.get(ctx.target.type) !== undefined,
  };
}

export function resolveAssignment(
  ctx: ThemeResolutionContext,
  store: ThemeAssignmentsStore,
): ThemeAssignment | undefined {
  return store.get(ctx.target);
}

export interface ThemeIdDecision {
  readonly themeId: string;
  readonly source: ThemeResolutionSource;
}

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
    }
  }
  return undefined;
}

export interface ModeStepResult {
  readonly mode: ThemeMode;
  readonly from: "user" | "application" | "assignment" | "default";
}

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

function preferenceMode(
  preference: ThemePreference | undefined,
): ThemeMode | undefined {
  if (preference === undefined) return undefined;
  if (preference.inherit) return undefined;
  const preferred = preference.preferredMode;
  if (preferred === undefined) return undefined;
  const allowed = preference.allowedModes;
  if (allowed !== undefined && !allowed.includes(preferred)) return undefined;
  return preferred;
}

export interface ThemeInheritanceResolverLike {
  resolve(
    themeId: string,
    mode: ThemeMode,
    load: (themeId: string) => ThemeManifest | undefined,
  ): ResolvedTheme;
}

export interface InheritanceStepDeps {
  readonly loadManifest: (themeId: string) => ThemeManifest | undefined;
  readonly inheritance?: ThemeInheritanceResolverLike;
  readonly requiredVersion?: string;
}

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

export function satisfiesVersion(required: string, found: string): boolean {
  const req = required.trim();
  const fnd = found.trim();
  if (req === fnd) return true;

  const foundTriple = /^(\d+)\.(\d+)\.(\d+)$/.exec(fnd);
  if (foundTriple === null) return false;

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
    if (foundMinor !== reqMinor) return false;
    return reqMinor === 0 ? foundPatch === reqPatch : foundPatch >= reqPatch;
  }
  if (foundMinor > reqMinor) return true;
  if (foundMinor < reqMinor) return false;
  return foundPatch >= reqPatch;
}

export interface ThemeResolverOptions {
  readonly loadManifest?: (themeId: string) => ThemeManifest | undefined;
  readonly inheritance?: ThemeInheritanceResolverLike;
  readonly defaultMode?: ThemeMode;
  readonly onMutation?: ThemeMutationListener;
}

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
  readonly decision?: ThemeResolution;
  readonly resolved?: ResolvedTheme;
  readonly error?: ThemeError;
}

export class ThemeResolver {
  private readonly loadManifest: (themeId: string) => ThemeManifest | undefined;

  constructor(
    private readonly registry: ThemeTargetRegistry,
    private readonly store: ThemeAssignmentsStore,
    private readonly options: ThemeResolverOptions = {},
  ) {
    this.loadManifest = options.loadManifest ?? (() => undefined);
  }

  async resolve(ctx: ThemeResolutionContext): Promise<ThemeResolutionOutcome> {
    resolveTarget(ctx, this.registry);
    const assignment = resolveAssignment(ctx, this.store);

    let decision: ThemeResolution | undefined;
    try {
      const themeIdDecision = resolveThemeId(ctx, assignment);
      if (themeIdDecision === undefined) {
        return { target: ctx.target };
      }

      const modeStep = resolveMode(ctx, assignment, this.options.defaultMode);
      decision = {
        themeId: themeIdDecision.themeId,
        mode: modeStep.mode,
        source: themeIdDecision.source,
      };

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
        const outcome: ThemeResolutionOutcome = {
          target: ctx.target,
          error,
          ...(decision !== undefined ? { decision } : {}),
        };
        return outcome;
      }
      throw error;
    }
  }
}
