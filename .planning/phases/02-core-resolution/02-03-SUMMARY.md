---
phase: 02-core-resolution
plan: 03
subsystem: core-theme
tags:
  [
    typescript,
    vitest,
    theme,
    resolver,
    pipeline,
    precedence,
    fail-open,
    expectTypeOf,
    tdd,
  ]

# Dependency graph
requires:
  - phase: 01-theme-contracts-schemas
    provides: ThemeResolution/ThemePreference/ResolvedTheme/ThemeTarget contracts, ThemeMode union, ThemeAssignmentsStore port (02-02), ThemeManifest
  - phase: 02-core-resolution (02-01)
    provides: ThemeTargetRegistry (read-only lookups — registry.get, never registers)
  - phase: 02-core-resolution (02-02)
    provides: ThemeError taxonomy (ThemeNotFoundError/ThemeVersionError/ThemeError), InMemoryThemeAssignmentsStore adapter
provides:
  - ThemeResolver class + 5 exported pure step functions (resolveTarget → resolveAssignment → resolveThemeId → resolveMode → resolveInheritance), THEME-05
  - DEFAULT_THEME_PRECEDENCE entity > user > application > platform with ctx.precedence override (D-13)
  - ThemeIdDecision/ModeStepResult/TargetStepResult/ThemeResolutionOutcome/ThemeInheritanceResolverLike shape contracts (D-14)
  - Fail-open resolve(): ThemeError attached to outcome, never thrown (D-20, roadmap #7); graceful { target } on unassigned/unregistered (D-17, #4)
  - satisfiesVersion minimal caret/exact semver gate; source recorded on themeId authority only (D-15)
  - Core barrel exports ThemeTargetRegistry + ThemeResolver pipeline (02-01 key_link satisfied)
affects:
  [
    02-core-resolution (02-04 ThemeInheritanceResolver implements ThemeInheritanceResolverLike DFS behind the same contract; 02-04 finalizes barrel with errors/store),
    03-compile-inject,
  ]

# Tech tracking
tech-stack:
  added: [none]
  patterns:
    - "Decomposed resolution pipeline: 5 module-level pure step functions, each independently testable, wired by a thin class (D-14, no Result ADT — optional-return style)"
    - "Precedence-chain iteration with early-return on first yielding source; entity is the only Phase-2 surface (D-13/D-01)"
    - "Fail-open at the boundary, fail-closed in steps: steps throw ThemeError, resolve() catches and attaches to outcome.error (D-20)"
    - "Interface-first dependency: ThemeInheritanceResolverLike declared + delegation proven by spy; DFS implementation deferred to 02-04"
    - "exactOptionalPropertyTypes-safe object building via conditional spread — never assigns undefined to optional readonly props"
    - "TDD RED (test commit) → GREEN (feat commit) with genuine failing gates"

key-files:
  created:
    - packages/core/src/theme/theme-resolver.ts
    - packages/core/src/theme/theme-resolver.test.ts
  modified:
    - packages/core/src/index.ts

key-decisions:
  - "Unconfigured loadManifest defaults to () => undefined so a missing provider fails OPEN as ThemeNotFoundError (D-20) instead of crashing with a TypeError"
  - "resolve() builds the partial decision BEFORE the inheritance step so a fail-open outcome still carries { themeId, mode, source } (decision survives step-5 failure)"
  - "decision.source records the themeId authority only (D-15); the mode step's from field is observability, never part of the decision"

patterns-established:
  - "Pattern: interface-first boundary — declare the like-interface + delegation in the current plan, implement the DFS in the next plan behind the same contract"
  - "Pattern: fail-open outcomes keep a partial decision for observability (never lose the decision when resolution fails at step 5)"
  - "Pattern: conditional spread {...(cond ? { prop: val } : {})} for exactOptionalPropertyTypes + readonly optional fields"

requirements-completed: [THEME-05]

# Metrics
duration: 13min
completed: 2026-08-09
---

# Phase 2 Plan 3: ThemeResolver 5-Step Pipeline Summary

**Entity-first, themeId/mode-decoupled theme resolution — ThemeResolver.resolve(ctx) wiring 5 exported pure steps (resolveTarget → resolveAssignment → resolveThemeId → resolveMode → resolveInheritance) with DEFAULT_THEME_PRECEDENCE entity > user > application > platform, ctx.precedence override, D-15 source recording, mode-only user preference, fail-open error attachment (D-20), and zero implicit registration — 25 assertions across the co-located suite**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-09T02:04:49Z
- **Completed:** 2026-08-09T02:47:59Z
- **Tasks:** 2 (task 1 TDD: RED → GREEN)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- **5-step decomposed pipeline** (THEME-05, roadmap #3): `resolveTarget` (registry read, never registers — invariant #5), `resolveAssignment` (store.get optional-return, D-18), `resolveThemeId` (precedence chain with early-return, D-13), `resolveMode` (preference-first, decoupled from themeId, D-01), `resolveInheritance` (manifest load + version gate + DFS delegation, interface-first)
- **D-13 precedence with override**: `DEFAULT_THEME_PRECEDENCE = ["entity","user","application","platform"]`; `ctx.precedence: ["application","entity"]` still resolves entity (application has no Phase-2 surface); entity assignment wins with `source: "entity"` (D-15 — source = themeId authority only)
- **Mode-only preferences (roadmap #2)**: user `preferredMode` wins within `allowedModes` (`from: "user"`); disallowed mode falls through to assignment.mode; `inherit: true` skipped; falls to `defaultMode ?? "system"` — a preference can NEVER replace an assigned themeId
- **Fail-open resolve() (D-20, roadmap #7)**: steps fail closed (ThemeNotFoundError on missing manifest, ThemeVersionError on range mismatch), resolve() catches ThemeError and attaches it to `outcome.error` — never rethrown; non-ThemeError rethrows (programmer error); unassigned/unregistered targets return graceful `{ target }` with NO throw and NO implicit registration (D-17, invariant #5)
- **Idempotent + deterministic (roadmap #3)**: all steps pure functions of inputs; two resolve() calls deep-equal; registry size + store count unchanged after resolution
- **Interface-first inheritance boundary**: `ThemeInheritanceResolverLike.resolve(themeId, mode, load)` declared + delegation proven via spy; single-theme fast path returns `{ themeId, version, mode, manifest }`; DFS implementation ships in 02-04 behind the same contract
- **`satisfiesVersion`** minimal caret/exact gate (exact triple match or `^major.minor.patch` with same-major + ≥ minor.patch)
- **Barrel (02-01 key_link)**: core index.ts exports ThemeTargetRegistry + full resolver pipeline; theme-errors/store deliberately absent (02-04 finalizes)

## task Commits

Each task was committed atomically (TDD: test commit then feat commit):

1. **task 1 RED: ThemeResolver pipeline failing tests** - `b1c9f02` (test)
2. **task 1 GREEN: ThemeResolver 5-step pipeline** - `602e70a` (feat)
3. **task 2: barrel exports for registry + resolver** - `d23ede8` (feat)

## Files Created/Modified

- `packages/core/src/theme/theme-resolver.ts` - DEFAULT_THEME_PRECEDENCE + 5 exported step functions + satisfiesVersion + ThemeResolver class (constructor-injected registry/store/options, async resolve with fail-open try/catch)
- `packages/core/src/theme/theme-resolver.test.ts` - 25-assertion co-located suite: shape locks (expectTypeOf ×4), step behaviors, precedence, mode decoupling, version gate, delegation spy, fail-open, idempotency
- `packages/core/src/index.ts` - new `// ─── Theme Resolution ───` section: registry + resolver exports (values + types)

## Decisions Made

- **Unconfigured manifest provider defaults to `() => undefined`** (not a TypeError): an options-less ThemeResolver fails open as ThemeNotFoundError (D-20) — resolution never crashes; a genuine programmer error (non-ThemeError) still rethrows
- **Partial decision survives step-5 failure**: resolve() builds `{ themeId, mode, source }` BEFORE resolveInheritance, so a fail-open outcome carries the full decision + error (observability; matches test "missing manifest → decision { ocean, system, entity } + ThemeNotFoundError")
- **decision.source = themeId authority only (D-15)**: mode step's `from` field stays observability — no source mix in the resolution record

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `ThemeError` imported as type-only but used as runtime value**

- **Found during:** task 1 GREEN verification (vitest run)
- **Issue:** `import type { ThemeError }` failed at runtime with `ReferenceError: ThemeError is not defined` — the class is used in `instanceof` (line 308), which needs a value import
- **Fix:** Changed to value import alongside ThemeNotFoundError/ThemeVersionError
- **Files modified:** packages/core/src/theme/theme-resolver.ts
- **Verification:** vitest 25/25 green
- **Committed in:** 602e70a (task 1 GREEN commit)

**2. [Rule 1 - Bug] exactOptionalPropertyTypes rejects explicit `undefined` on optional readonly props**

- **Found during:** task 1 verification (`tsc --noEmit` after first fix)
- **Issue:** Two TS errors: passing `{ inheritance: undefined }` to `InheritanceStepDeps` (TS2379) and `decision: undefined` in fail-open return (TS2375) — `exactOptionalPropertyTypes: true` forbids explicitly-set undefined
- **Fix:** Conditional spread construction `...(cond ? { prop: val } : {})` for deps (inheritance/requiredVersion) and outcome (decision)
- **Files modified:** packages/core/src/theme/theme-resolver.ts
- **Verification:** tsc clean; vitest 25/25 green
- **Committed in:** 602e70a (task 1 GREEN commit)

**3. [Rule 1 - Bug] Readonly prop assignment after conditional build (second tsc round)**

- **Found during:** task 1 verification (tsc rerun)
- **Issue:** After switching to conditional assignment, TS2540 — `deps.inheritance`/`deps.requiredVersion`/`outcome.decision` are readonly, cannot assign post-construction
- **Fix:** Replaced mutation-style conditional assignment with object-literal conditional spread (final form; both constraints satisfied)
- **Files modified:** packages/core/src/theme/theme-resolver.ts
- **Verification:** tsc clean; vitest 25/25 green
- **Committed in:** 602e70a (task 1 GREEN commit)

---

**Total deviations:** 3 auto-fixed (3 bugs — 1 runtime import, 2 strict-TS optional-property issues)
**Impact on plan:** All fixes were compiler/runtime correctness fixes within the planned file. No scope creep; no plan structure change.

## Issues Encountered

- **`tsc --noEmit` for the test file itself:** the plan's verify step runs tsc on the package (not the test tsconfig); the resolver's type-lock assertions are proven by vitest's expectTypeOf, which is compile-time-erased but run through the vitest transform — the suite passing under vitest + package tsc clean covers both the runtime and compile-time gates.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **02-04 (ThemeInheritanceResolver)**: implements `ThemeInheritanceResolverLike` (DFS parent-first over `extends` graphs, ThemeCycleError on cycles) behind the contract declared and delegation-tested here; wires InMemoryThemeAssignmentsStore onMutation → kernel EventBus; finalizes the core barrel (theme-errors + store adapter exports)
- **Phase 3 (ThemeRuntime/compile)**: consumes `ThemeResolutionOutcome.resolved` (extends-resolved ThemeManifest ready for token compilation); failure path already handled via outcome.error
- **SDK (Phase 4)**: `theme.get/resolve` can call `ThemeResolver.resolve(ctx)` directly — entity-first semantics, mode-only preferences, fail-open contract all proven
- Core suite: 155 tests green across 12 files (incl. this plan's 25)

---

_Phase: 02-core-resolution_
_Completed: 2026-08-09_

## Self-Check: PASSED

- Files exist: `packages/core/src/theme/theme-resolver.ts` (328 lines), `packages/core/src/theme/theme-resolver.test.ts` (517 lines), `packages/core/src/index.ts` (120 lines with Theme Resolution section)
- Commits present: `b1c9f02` (test RED), `602e70a` (feat GREEN), `d23ede8` (feat barrel)
- `pnpm --filter @mosaix/core exec vitest run src/theme/theme-resolver.test.ts` → 25 passed
- `pnpm --filter @mosaix/core exec vitest run` (full core) → 155 passed, 12 files
- `pnpm --filter @mosaix/core exec tsc --noEmit` → clean; `pnpm --filter @mosaix/core build` → green
- grep `"space"` on packages/core/src/theme/ → 0 matches (DoD §19)
- grep -in `zod` on theme-resolver.ts → 0 matches (ADR-0001)
- No `register(` call in theme-resolver.ts (invariant #5); `registry.get` only
- grep `theme-errors|in-memory-theme` on packages/core/src/index.ts → 0 matches (deferred to 02-04)
