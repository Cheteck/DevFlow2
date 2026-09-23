---
phase: 02-core-resolution
reviewed: 2026-08-09T03:10:00Z
depth: deep
files_reviewed: 20
files_reviewed_list:
  - packages/core/src/theme/theme-target-registry.ts
  - packages/core/src/theme/theme-errors.ts
  - packages/core/src/theme/in-memory-theme-assignments-store.ts
  - packages/core/src/theme/theme-resolver.ts
  - packages/core/src/theme/theme-inheritance-resolver.ts
  - packages/core/src/index.ts
  - packages/core/src/theme/theme-target-registry.test.ts
  - packages/core/src/theme/theme-errors.test.ts
  - packages/core/src/theme/in-memory-theme-assignments-store.test.ts
  - packages/core/src/theme/theme-resolver.test.ts
  - packages/core/src/theme/theme-inheritance-resolver.test.ts
  - packages/contracts/src/theme/theme-assignment.ts
  - packages/contracts/src/theme/theme-assignments-store.ts
  - packages/contracts/src/theme/theme-events.ts
  - packages/contracts/src/theme/theme-manifest.ts
  - packages/contracts/src/theme/theme-preference.ts
  - packages/contracts/src/theme/theme-resolution.ts
  - packages/contracts/src/theme/theme-resolved.ts
  - packages/contracts/src/mosaix-artifact.ts
  - packages/schemas/src/theme.ts
findings:
  critical: 1
  warning: 3
  info: 4
  total: 8
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-08-09T03:10:00Z
**Depth:** deep
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Reviewed the complete Phase-2 theme resolution kernel: `ThemeTargetRegistry` (02-01), `theme-errors` (02-02), `InMemoryThemeAssignmentsStore` (02-02), the 5-step `ThemeResolver` pipeline (02-03), `ThemeInheritanceResolver` DFS (02-04), the core barrel, and the cross-referenced contracts/schemas theme families.

Verification basis: `vitest run` — 59 core theme tests + 2 contracts port tests green; `tsc --noEmit` clean for `@mosaix/core` and `@mosaix/contracts`. DoD cleanliness gates verified independently: zero `"space"` literals in `packages/core/src/theme/` (only comments and the allowed `workspace` type), zero `event-bus` imports in the theme runtime (comment mentions only), zero Zod in core.

The milestone is structurally sound: fail-open/fail-closed two-layer policy (D-20) is correctly implemented and tested, cycle detection terminates with `ThemeCycleError` carrying the path, dependency direction (core → contracts, downward only) is respected everywhere, and the 02-03 `ThemeInheritanceResolverLike` contract is structurally locked by tests.

The principal defect is in the inheritance **merge formula itself** (CR-01): the plan-mandated shallow spread-merge silently drops entire parent token subtrees for any child that does partial overrides — the most common `extends` use case. Secondary warnings concern semver-gate deviations, event re-emission at bootstrap, and a latent payload-schema asymmetry.

## Critical Issues

### CR-01: Shallow spread-merge drops inherited parent token subtrees

**File:** `packages/core/src/theme/theme-inheritance-resolver.ts:80`
**Issue:** The merge formula `manifest: { ...parentMerged.manifest, ...manifest }` is a **top-level-only** spread. `ThemeManifest.tokens` (and `modes`, `accessibility`, `assets`) is a single object key: when a child manifest defines its own `tokens`, the parent's entire `tokens` object is replaced wholesale. A child that overrides only `colors.primary` silently loses every parent token group it does not redefine (`typography`, `spacing`, `radius`, `shadows`, `motion`), and a child with only a `dark` modes overlay drops the parent's `light` overlay. This defeats the stated purpose of the feature — "Ancestors merge first; the child overlays its manifest LAST (spread-merge, child wins on key conflicts — D-19)" — because for the non-conflicting _leaves_ there is no conflict, yet the conflicting top-level `tokens` key causes parent data loss. The suites only lock the single-key case (test 3 asserts one `colors.primary` override; tests 2/7 never verify preservation of a token group the child does not touch), so the gap is untested. Note: 02-04-PLAN.md `<interfaces>` mandates this exact shape, so the plan itself carries the flaw — the implementation is faithful to a defective spec.
**Fix:** Deep-merge the nested token/overlay subtrees leaf-first while keeping the top-level spread for scalar keys:

```ts
function mergeManifest(
  parent: ThemeManifest,
  child: ThemeManifest,
): ThemeManifest {
  const { tokens: parentTokens, modes: parentModes, ...parentRest } = parent;
  const { tokens: childTokens, modes: childModes, ...childRest } = child;
  return {
    ...parentRest, // scalar/array keys: child overlays last
    ...childRest,
    tokens: { ...parentTokens, ...childTokens },
    modes: {
      ...parentModes,
      ...childModes,
      ...(childModes?.light
        ? { light: { ...parentModes?.light, ...childModes.light } }
        : {}),
      ...(childModes?.dark
        ? { dark: { ...parentModes?.dark, ...childModes.dark } }
        : {}),
    },
  };
}
```

Add a test: parent defines `tokens.spacing` + `tokens.colors`; child overrides only `tokens.colors.primary` — assert the resolved manifest still carries the parent's `spacing`. Update the D-19 merge rule in 02-03/02-04 plans and the ADR before Phase 3 compiles against resolved manifests.

## Warnings

### WR-01: `satisfiesVersion` caret accepts incompatible 0.x versions

**File:** `packages/core/src/theme/theme-resolver.ts:211-235`
**Issue:** The "same-major + ≥ minor.patch" caret check deviates from semver for major-0 ranges, and this ecosystem is at 0.x: `^0.2.3` accepts `0.9.0` (real caret: `<0.3.0` only) and `^0.0.3` accepts `0.0.9` (real caret: `<0.0.4`). The THEME_VERSION gate therefore admits manifests that should fail, resolving themes at incompatible patch/minor versions. The simplification is documented ("full semver stays out of core"), but the gate is a DoD behavior, so the deviation is a latent correctness risk rather than a pure style note.
**Fix:** Clamp major-0 ranges: for `^0.x.y` require `foundMajor === 0 && foundMinor === x && foundPatch >= y`; for `^0.0.y` require `foundPatch === y`. Otherwise keep the current same-major rule for major ≥ 1. Add `satisfiesVersion("^0.2.3", "0.9.0") === false` and `satisfiesVersion("^0.0.3", "0.0.9") === false` to the suite (theme-resolver.test.ts §6).

### WR-02: `createThemeResolver` re-emits mutation events for pre-existing bindings; silently drops `onMutation` for custom stores

**File:** `packages/core/src/theme/theme-resolver.ts:276-279`
**Issue:** When the caller supplies `onMutation` and an in-memory store, the factory seeds the re-wrapped store via `wiredStore.assign(existing)` for **every** existing binding. `assign` validates then calls the `onMutation` listener, so at bootstrap the bus emitter receives one `theme.assignment.changed` event per pre-existing binding — duplicate/backdated history (with `changedBy`/`at` re-derived from `updatedBy ?? "system"` / `updatedAt ?? now` when the stored record lacks them). Separately, when `onMutation` is supplied with a **non**-in-memory `ThemeAssignmentsStore`, the option is silently ignored — the caller believes event wiring is active when it is not.
**Fix:** Seed without emitting (add a private `set`/bulk-load path that bypasses the listener), and fail loudly on the unsupported combination:

```ts
if (
  onMutation !== undefined &&
  !(store instanceof InMemoryThemeAssignmentsStore)
) {
  throw new TypeError(
    "createThemeResolver: onMutation requires an InMemoryThemeAssignmentsStore (or a pre-wired store)",
  );
}
```

### WR-03: Store emit payload can violate the event payload schema

**File:** `packages/core/src/theme/in-memory-theme-assignments-store.ts:68-69,81-82` vs `packages/schemas/src/theme.ts:248-255`
**Issue:** `ThemeAssignmentSchema` accepts `updatedBy: ""` (optional string, no min-length) and `updatedAt` absent, so such an assignment passes the store's `safeParse` gate. The emitted `ThemeAssignmentChangedPayload` then carries `changedBy: ""` and `at: <now>` — but `ThemeAssignmentChangedPayloadSchema` requires `changedBy: z.string().min(1)` and `at: z.string().datetime({offset:true})`. An assignment that validates can therefore produce an event payload that fails the event schema — latent until Phase 3 registers these events in the kernel `EventSchemaRegistry` (D-12), at which point every such emit would be rejected.
**Fix:** Normalize at emit: `changedBy: (assignment.updatedBy ?? "system").trim() || "system"` and require a valid `updatedAt` (or stamp a fixed default) before emit; or relax `ThemeAssignmentChangedPayloadSchema.changedBy` to allow empty with a documented fallback. Add a store test asserting an `updatedBy: ""` assignment emits a payload that passes `ThemeAssignmentChangedPayloadSchema.safeParse`.

## Info

### IN-01: `resolveTarget` result discarded — step 1 is a no-op

**File:** `packages/core/src/theme/theme-resolver.ts:320`
**Issue:** `resolveTarget(ctx, this.registry)` is called and its result (`registered` flag) is never consumed anywhere in `resolve()`. The registry lookup is pure overhead and the documented "registered" signal never reaches the outcome. Either surface it (e.g., `outcome.registered`) or drop the call and the `TargetStepResult` plumbing.

### IN-02: `get()` returns the internal record by reference despite the snapshot-copy contract

**File:** `packages/core/src/theme/in-memory-theme-assignments-store.ts:86-88`
**Issue:** The docstring promises "`get`/`list` return undefined / a snapshot copy", and `list()` does copy — but `get()` returns the internal `Map` value directly. A caller mutating the returned assignment corrupts store state (last-write-wins and `list()` invariants). Return a shallow copy (`{ ...assignment }`).

### IN-03: Fast-path `resolveInheritance` aliases the catalog manifest while the DFS path copies

**File:** `packages/core/src/theme/theme-resolver.ts:202-207`
**Issue:** The single-theme fast path returns `manifest` by reference; the DFS path returns a spread copy. A consumer mutating `outcome.resolved.manifest` corrupts the shared catalog manifest in the fast path only — inconsistent snapshot semantics between the two paths. Spread-copy in the fast path for parity.

### IN-04: `ThemeCompatibilityError` / `ThemeAuthorizationError` exported with zero production raise sites

**File:** `packages/core/src/theme/theme-errors.ts` (exported from `packages/core/src/index.ts:138-139`)
**Issue:** Both classes are in the 6-member `ThemeErrorCode` union and exported from the core barrel, but no production code raises them (grep confirms constructions only in `theme-errors.test.ts:127-137`). Intentional forward-declaration per 02-02/D-21, but consumers can match on codes that never fire. Add an explicit "Phase-3 raise sites" note in the JSDoc so the public surface documents the intent.

---

_Reviewed: 2026-08-09T03:10:00Z_
_Reviewer: OpenCode (gsd-code-reviewer)_
_Depth: deep_
