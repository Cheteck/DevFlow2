---
phase: 02-core-resolution
plan: 02
subsystem: core-theme
tags: [typescript, vitest, theme, errors, port, in-memory, expectTypeOf, zod]

# Dependency graph
requires:
  - phase: 01-theme-contracts-schemas
    provides: ThemeAssignment/ThemeTarget contracts, ThemeAssignmentChangedPayload events, strict Zod ThemeAssignmentSchema
  - phase: 02-core-resolution (02-01)
    provides: registry-only deliverable — no shared code dependency (plans are parallel; both feed 02-03)
provides:
  - Theme error taxonomy: ThemeErrorCode 6-member union + ThemeError + 6 subclasses extending KernelError (THEME-12, D-21/D-22)
  - ThemeAssignmentsStore port in @mosaix/contracts theme family, type-only, barrel-exported (THEME-06, D-18)
  - InMemoryThemeAssignmentsStore adapter in core: Map `${type}:${id}`, validation-before-write, idempotent unassign, snapshot get/list, onMutation emit
  - Mutation listener wiring point (ThemeMutationListener/onMutation) exported for 02-04 resolver bus wiring
affects:
  [
    02-core-resolution (02-03 resolver raises NotFound/Cycle/Version; 02-04 wires onMutation to EventBus),
    03-compile-inject,
  ]

# Tech tracking
tech-stack:
  added: [none]
  patterns:
    - "KernelError hierarchy with ASCII-tree header + theme-prefixed code union (kernel-errors analog, D-22)"
    - "Port interface in contracts theme family with sibling-theme imports + JSDoc per method (MigrationStore level)"
    - "Adapter implements port via type-only import from @mosaix/contracts barrel; constructor-injected onMutation callback (store never imports event-bus)"
    - "Zod safeParse → typed ThemeValidationError with issues before write (kernel.ts register() analog)"
    - "TDD RED (test commit) → GREEN (feat commit) with genuine failing gates"

key-files:
  created:
    - packages/core/src/theme/theme-errors.ts
    - packages/core/src/theme/theme-errors.test.ts
    - packages/contracts/src/theme/theme-assignments-store.ts
    - packages/contracts/src/theme/theme-assignments-store.test.ts
    - packages/core/src/theme/in-memory-theme-assignments-store.ts
    - packages/core/src/theme/in-memory-theme-assignments-store.test.ts
  modified:
    - packages/contracts/src/index.ts

key-decisions:
  - "Port lives in @mosaix/contracts theme family (D-18 resolution) — NOT a packages/ports/theme package (no second adapter in Phase 2, avoids over-engineering per 02-PATTERNS)"
  - "Contracts type-lock test's genuine RED gate is tsc (tsconfig.test.json) not vitest — expectTypeOf is compile-time-erased, so vitest passes even with the module missing; verified via TS2724 on the barrel import before GREEN"

patterns-established:
  - "Pattern: TDD on type-lock tests needs a compile-time RED proof (tsc test-config), not just vitest"
  - "Pattern: store emits via injected onMutation callback with changedBy ?? 'system' / at ?? now defaults"
  - "Pattern: fixture targets are store/brand/workspace — never space (invariant #8)"

requirements-completed: [THEME-12, THEME-06]

# Metrics
duration: 7min
completed: 2026-08-09
---

# Phase 2 Plan 2: Theme Errors + ThemeAssignmentsStore Port & In-Memory Adapter Summary

_*KernelError-based theme error hierarchy (6-code THEME_* union, ThemeNotFound/Cycle/Version/Validation raised, Compatibility/Authorization declared-only) plus a type-only ThemeAssignmentsStore port in @mosaix/contracts and a validated, mutation-emitting InMemoryThemeAssignmentsStore adapter in core — 17 assertions across 3 suites_*

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-09T01:47:00Z
- **Completed:** 2026-08-09T01:52:49Z
- **Tasks:** 2 (both TDD: RED → GREEN)
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments

- `ThemeErrorCode` 6-member union (`THEME_NOT_FOUND`/`THEME_CYCLE`/`THEME_VERSION`/`THEME_VALIDATION`/`THEME_COMPATIBILITY`/`THEME_AUTHORIZATION`) with `ThemeError extends KernelError` — stable codes + structured details + toJSON (THEME-12, D-22)
- Raised set per D-21: `ThemeNotFoundError(themeId)`, `ThemeCycleError(cycle)` with "a → b" path, `ThemeVersionError(themeId, required, found)`, `ThemeValidationError(issues)`; `ThemeCompatibilityError`/`ThemeAuthorizationError` declared-not-raised with gated comments
- `ThemeAssignmentsStore` port in `packages/contracts/src/theme/` — type-only, 4 methods (assign/unassign/get/list), JSDoc-contracted, sibling-theme imports, barrel-exported from `@mosaix/contracts` (THEME-06, D-18)
- `InMemoryThemeAssignmentsStore` implements the port: Map keyed `${type}:${id}`, Zod `ThemeAssignmentSchema.safeParse` BEFORE write → `ThemeValidationError` on breach (nothing stored), last-write-wins, idempotent silent unassign for absent targets, snapshot get/list
- Mutation emit (roadmap criterion #5): synchronous `onMutation` callback fires with `{ target, assignment, changedBy, at }` on assign AND unassign (unassign carries the removed record); `changedBy` defaults `updatedBy ?? "system"`, `at` defaults `updatedAt ?? now`; store never imports event-bus (port stays composable for 02-04 wiring)
- 17 assertions green: 6 (errors) + 2 (port type-lock) + 9 (adapter); tsc clean on core, contracts, and the contracts test-config; core + contracts builds green

## task Commits

Each task was committed atomically (TDD: test commit then feat commit):

1. **task 1 RED: theme error taxonomy test** - `8aaf61d` (test)
2. **task 1 GREEN: theme error taxonomy** - `fb896eb` (feat)
3. **task 2 RED: store port + adapter tests** - `0f551ba` (test)
4. **task 2 GREEN: store port + in-memory adapter** - `ca6d4dc` (feat)

## Files Created/Modified

- `packages/core/src/theme/theme-errors.ts` - ThemeErrorCode union + ThemeError hierarchy (7 classes, KernelError-derived, D-21/D-22)
- `packages/core/src/theme/theme-errors.test.ts` - 6-assertion suite: codes/names, instanceof chain, toJSON shape, union lock, declared-only classes
- `packages/contracts/src/theme/theme-assignments-store.ts` - D-18 port interface (4 methods, JSDoc per method)
- `packages/contracts/src/theme/theme-assignments-store.test.ts` - expectTypeOf type-lock on the port surface + barrel-export proof
- `packages/core/src/theme/in-memory-theme-assignments-store.ts` - adapter: Map store, validation-before-write, idempotent unassign, onMutation emit
- `packages/core/src/theme/in-memory-theme-assignments-store.test.ts` - 9-assertion suite: store semantics, replace, idempotent unassign, emit payloads, changedBy default, ThemeValidationError
- `packages/contracts/src/index.ts` - barrel gains `export type { ThemeAssignmentsStore }` (Theme group)

## Decisions Made

- **Port placement (D-18 discretion):** `packages/contracts/src/theme/` won over a dedicated `packages/ports/theme` package — only one adapter exists in Phase 2, so a package would be over-engineering (02-PATTERNS line 106); core imports the port via the contracts barrel with type-only imports
- **Port imports are sibling-relative** (`./theme-assignment`, `./theme-target`), never the contracts barrel — theme-events.ts rule; the barrel exports it for consumers
- **Adapter emits synchronously via injected callback** — matches emit-after-commit layering; the resolver (02-04) wires the real EventBus at the injection point

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's JSDoc header instruction tripped the 7-line extends grep**

- **Found during:** task 1 (theme-errors.ts)
- **Issue:** Acceptance criterion `grep "class .*extends"` → 7 lines (ThemeError + 6 subclasses), but my JSDoc comment "Base class for all theme errors — extends KernelError (D-22)" matched the regex (8 lines)
- **Fix:** Reworded to "Base class for all theme errors — KernelError-derived (D-22)"; class declarations still all extend (7 lines)
- **Files modified:** packages/core/src/theme/theme-errors.ts
- **Verification:** `grep "class .*extends"` → 7 (PASS); tsc clean
- **Committed in:** fb896eb (task 1 GREEN commit)

**2. [Rule 1 - Bug] Header-comment mention of the forbidden literal failed the space-literal grep**

- **Found during:** task 2 (adapter test)
- **Issue:** My fixture-rule header comment quoted `"space"`, tripping the zero-`"space"` grep gate
- **Fix:** Reworded to "no other target-type literal appears in this file (grep gate)"
- **Files modified:** packages/core/src/theme/in-memory-theme-assignments-store.test.ts
- **Verification:** `grep '"space"'` on the theme dir → 0 matches
- **Committed in:** ca6d4dc (task 2 GREEN commit)

**3. [Rule 3 - Blocking] Stale contracts dist/ blocked core tsc**

- **Found during:** task 2 (verification)
- **Issue:** After adding the barrel export, `pnpm --filter @mosaix/core exec tsc --noEmit` failed with TS2724 — core resolves `@mosaix/contracts` against its built `dist/` declarations, which predated the new export
- **Fix:** Ran `pnpm --filter @mosaix/contracts build` (incremental-build ordering, same as Phase 1's documented issue); retry → clean
- **Files modified:** none (rebuild only)
- **Verification:** core tsc clean after rebuild
- **Committed in:** ca6d4dc (task 2 GREEN commit)

---

**Total deviations:** 3 auto-fixed (2 bugs — self-referential grep gates, 1 blocking — stale dist)
**Impact on plan:** All fixes necessary for the plan's own verification gates and correct build ordering. No scope creep.

## Issues Encountered

- **Contracts type-lock test passes under vitest even in RED** — expectTypeOf assertions are compile-time only and erased at runtime, so the plan's "run both — must FAIL" instruction cannot be satisfied by vitest for the port test. Resolved by proving the RED gate via `tsc --noEmit -p packages/contracts/tsconfig.test.json` (TS2724: barrel has no ThemeAssignmentsStore), then confirming GREEN after implementation. Documented as a decision for future type-lock TDD.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-03 (ThemeInheritanceResolver + ThemeResolver) can import and raise `ThemeNotFoundError`/`ThemeCycleError`/`ThemeVersionError` without a circular plan dependency (declared+typed here)
- Plan 02-04 wiring can inject `onMutation` → kernel EventBus publish of `themeAssignmentChangedEvent` (roadmap criterion #5); store stays port-clean
- `@mosaix/contracts` dist/ rebuilt — downstream packages resolve the new port export

---

_Phase: 02-core-resolution_
_Completed: 2026-08-09_

## Self-Check: PASSED

- 6 created files + 1 modified file all exist on disk (verified: theme-errors.ts/.test.ts, theme-assignments-store.ts/.test.ts, in-memory-theme-assignments-store.ts/.test.ts, contracts index.ts)
- Commits present: `8aaf61d`, `fb896eb`, `0f551ba`, `ca6d4dc`
- `pnpm --filter @mosaix/core exec vitest run src/theme/theme-errors.test.ts` → 6 passed
- `pnpm --filter @mosaix/contracts exec vitest run src/theme/theme-assignments-store.test.ts` → 2 passed
- `pnpm --filter @mosaix/core exec vitest run src/theme/in-memory-theme-assignments-store.test.ts` → 9 passed
- `pnpm --filter @mosaix/contracts exec tsc --noEmit` → clean; `pnpm --filter @mosaix/core exec tsc --noEmit` → clean; contracts tsconfig.test.json → clean
- `pnpm --filter @mosaix/core build` + `pnpm --filter @mosaix/contracts build` → both build
- grep `"space"` on packages/core/src/theme/ + contracts theme-assignments-store files → 0 matches
- No `import` of event-bus.ts / EventBus in the store adapter (PASS)
