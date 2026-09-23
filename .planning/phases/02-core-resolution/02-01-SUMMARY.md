---
phase: 02-core-resolution
plan: 01
subsystem: core-theme
tags: [typescript, vitest, theme, registry, capabilities, expectTypeOf]

# Dependency graph
requires:
  - phase: 01-theme-contracts-schemas
    provides: generic theme ABI (ThemeTarget, ThemeAssignment), PRD §4.2b capability shapes, fixture conventions
provides:
  - ThemeTargetRegistry class + ThemeTargetCapabilities/ThemeTargetRegistration types (PRD §4.2b, THEME-04)
  - Two surfaces (declarative constructor list + programmatic register()) feeding ONE Map (D-16, roadmap criterion #1)
  - Bootstrap-only registration surface with NO resolve() method (D-16, invariant #5)
  - Per-type capabilities userSelectable/adminConfigurable; unknown types return undefined, never throw (D-17)
affects:
  [02-core-resolution (02-03 resolver consumes registry.get), 03-compile-inject]

# Tech tracking
tech-stack:
  added: [none]
  patterns:
    - "Map + entry-interface + register/get/has/list registry shape (capability-registry analog, last-write-wins no-throw)"
    - "Mutual toMatchTypeOf for cross-module object-shape locks (Phase 1 convention)"
    - "Co-located vitest suite with beforeEach factory (capability-registry.test.ts shape)"

key-files:
  created:
    - packages/core/src/theme/theme-target-registry.ts
    - packages/core/src/theme/theme-target-registry.test.ts
  modified: []

key-decisions:
  - "JSDoc avoids the literal token 'resolve(' so the plan's zero-resolve grep gate stays green while still stating the bootstrap-only invariant (same trap as Phase 1 deviation #3)"

patterns-established:
  - "Pattern: registry JSDoc header states PRD ref + D-number + dependency direction + consumers"
  - "Pattern: fixture targets are store/brand/workspace — never space (invariant #8)"

requirements-completed: [THEME-04]

# Metrics
duration: 6min
completed: 2026-08-09
---

# Phase 2 Plan 1: ThemeTargetRegistry Summary

**ThemeTargetRegistry with declarative + programmatic registration surfaces feeding one bootstrap-only Map, per-type userSelectable/adminConfigurable capabilities, and a 7-assertion co-located vitest suite — zero resolve() surface (D-16), zero business entities (INV-THEME-002)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-09T01:45:00Z
- **Completed:** 2026-08-09T01:51:00Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments

- `ThemeTargetCapabilities` (userSelectable/adminConfigurable booleans) + `ThemeTargetRegistration` (type + capabilities) exported — exact PRD §4.2b shapes, no business fields (INV-THEME-002)
- `ThemeTargetRegistry` class: private `Map<string, ThemeTargetRegistration>`, constructor feeds the declarative/manifest surface, `register()` is the programmatic surface — both mutate the SAME Map (D-16, roadmap criterion #1); last-write-wins, never throws (capability-registry convention, T2-01)
- Read surface `get`/`has`/`list`/`size`: `get("unknown")` returns undefined, never throws (D-17)
- Class exposes NO `resolve` method (bootstrap-only, D-16) — grep `resolve(` = 0; `expect("resolve" in registry).toBe(false)` in tests
- 7-assertion vitest suite green: programmatic register, declarative manifest surface, duplicate last-write-wins, D-17 undefined path, list() copy semantics, no-resolve check, expectTypeOf shape locks

## task Commits

Each task was committed atomically:

1. **task 1: Implement ThemeTargetRegistry** - `eaa8bb1` (feat)
2. **task 2: Co-located vitest suite** - `33eda7f` (test)

## Files Created/Modified

- `packages/core/src/theme/theme-target-registry.ts` - ThemeTargetCapabilities/ThemeTargetRegistration interfaces + ThemeTargetRegistry class (PRD §4.2b, D-16/D-17)
- `packages/core/src/theme/theme-target-registry.test.ts` - 7-assertion suite (vitest + expectTypeOf, beforeEach factory)

## Decisions Made

- **No barrel export** in `packages/core/src/index.ts` — deliberately deferred to plans 02-03/02-04 (file-ownership boundary; the plan's key_links note the barrel export lands with the resolver)
- **No imports at all** in the registry module — self-contained per plan; ids/capabilities only, contracts types not needed here

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's own JSDoc instruction tripped the zero-resolve grep gate**

- **Found during:** task 1 (registry implementation)
- **Issue:** The task action required JSDoc stating "ThemeResolver.resolve() never registers/creates targets" — but the acceptance grep `resolve(` mandates 0 matches; the literal token in JSDoc failed the gate (same trap as Phase 1 deviation #3)
- **Fix:** Reworded JSDoc to "the resolver in 02-03 never registers/creates targets — it only consumes this registry"; intent preserved, gate green
- **Files modified:** packages/core/src/theme/theme-target-registry.ts
- **Verification:** `grep "resolve("` → 0 matches
- **Committed in:** eaa8bb1 (task 1 commit)

**2. [Rule 1 - Bug] Header-comment mention of the forbidden literal failed the space-literal grep**

- **Found during:** task 2 (vitest suite)
- **Issue:** The plan asked for a header comment noting the fixture rule (store/brand/workspace only) — my phrasing quoted the literal `"space"`, tripping the zero-`"space"` grep
- **Fix:** Reworded to "no other target type literal appears in this file (verified by grep)"
- **Files modified:** packages/core/src/theme/theme-target-registry.test.ts
- **Verification:** `grep '"space"'` → 0 matches
- **Committed in:** 33eda7f (task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs — self-referential grep gates in plan wording)
**Impact on plan:** Both fixes were wording-level, required for the plan's own verification gates. No scope creep, no behavioral change.

## Issues Encountered

- None beyond the two grep-gate wording traps documented above (recurring pattern from Phase 1, worth a convention note: never quote literal tokens in JSDoc/comments when the plan greps for their absence).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-03 (ThemeResolver) can consume `registry.get(type)` → `{ type, capabilities }` to feed `resolveTarget().registered` — the registry has no themeId lookup (D-10: resolves nothing)
- Plan 02-02 (store + errors) is independent of this registry (depends_on: []) and was executed in the same wave

---

_Phase: 02-core-resolution_
_Completed: 2026-08-09_

## Self-Check: PASSED

- `packages/core/src/theme/theme-target-registry.ts` exists on disk (FOUND)
- `packages/core/src/theme/theme-target-registry.test.ts` exists on disk (FOUND)
- Commit `eaa8bb1` present in git history (FOUND)
- Commit `33eda7f` present in git history (FOUND)
- `pnpm --filter @mosaix/core exec vitest run src/theme/theme-target-registry.test.ts` → 7 tests passed
- `pnpm --filter @mosaix/core exec tsc --noEmit` → clean
- `pnpm --filter @mosaix/core build` → builds
- grep `resolve(` in theme-target-registry.ts → 0 matches
- grep `"space"` in theme-target-registry.test.ts → 0 matches
