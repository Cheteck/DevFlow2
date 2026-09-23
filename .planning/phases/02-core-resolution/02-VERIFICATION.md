---
phase: 02-core-resolution
verified: 2026-08-09T11:05:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 2: Core Resolution Verification Report

**Phase Goal:** Given a `CompositionContext.target`, the kernel resolves which theme applies (entity-first, themeId/mode decoupled) from a single registry and store
**Verified:** 2026-08-09T11:05:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

The phase goal is achieved. The kernel resolves which theme applies to a target via a single `ThemeTargetRegistry` (bootstrap-only, capability-aware) + a `ThemeAssignmentsStore` port with in-memory adapter, through a 5-step decomposed `ThemeResolver` pipeline (entity-first, themeId/mode decoupled, fail-open), finishing with DFS `extends` inheritance resolution. All artifacts verified at levels 1–4 (exist, substantive, wired, data flowing). Full test suite: 394 tests / 61 files green; theme suite: 67 tests / 5 files green; `tsc --noEmit` clean for `@mosaix/core` and `@mosaix/contracts`.

### Observable Truths

| #   | Truth                                                                                                                                                                                                 | Status     | Evidence                                                                                                                                                                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Both registration surfaces (declarative constructor list + programmatic register()) feed ONE `ThemeTargetRegistry`; capabilities `userSelectable`/`adminConfigurable` stored per type (SC1, THEME-04) | ✓ VERIFIED | `theme-target-registry.ts`: single `Map<string, ThemeTargetRegistration>`, constructor + `register()` both call `types.set`; capabilities are two readonly booleans; 7 tests green                                                                                                                     |
| 2   | Entity assignment wins over user preference; user preference selects mode only, within `allowedModes`; assigned themeId unchanged (SC2, THEME-05)                                                     | ✓ VERIFIED | `theme-resolver.ts` `resolveThemeId` (entity-first via `assignment?.themeId`) + `resolveMode` (`preferenceMode` skips inherit/out-of-allowedModes); integration test asserts `{ themeId:"ocean", mode:"dark", source:"entity" }`                                                                       |
| 3   | 5-step decomposed pipeline exported, each step independently callable, concrete partial shapes; idempotent & deterministic; `source` records themeId authority (SC3, THEME-05)                        | ✓ VERIFIED | `resolveTarget/resolveAssignment/resolveThemeId/resolveMode/resolveInheritance` all module-level exports; `DEFAULT_THEME_PRECEDENCE`; idempotency test (two resolve() calls deep-equal); `decision.source` = themeId authority only                                                                    |
| 4   | resolve() never registers or creates targets implicitly; unregistered/unassigned target → graceful outcome, no throw (SC4, THEME-05)                                                                  | ✓ VERIFIED | `resolveTarget` uses `registry.get(type)` only; zero `register(` call in resolver (grep); `resolveThemeId === undefined` → `{ target }` outcome; registry entry count unchanged after resolve() (test)                                                                                                 |
| 5   | `ThemeAssignmentsStore` port in @mosaix/contracts + in-memory adapter; assign/unassign emit `ThemeAssignmentChangedEvent` payload via injected onMutation (SC5, THEME-06)                             | ✓ VERIFIED | Port `theme-assignments-store.ts` type-only, sibling imports, barrel-exported (contracts index.ts:92); `InMemoryThemeAssignmentsStore implements ThemeAssignmentsStore`, emits `{ target, assignment, changedBy, at }`; `changedByOf` normalizes empty→"system" (WR-03); 13 store tests green          |
| 6   | `extends` graph resolved via DFS parent-first (deep merge); cycle → `ThemeCycleError` with path; missing → `ThemeNotFoundError` (SC6, THEME-07)                                                       | ✓ VERIFIED | `theme-inheritance-resolver.ts` `visit()` recursion with stack-based cycle detection; `deepMergeManifest` recursive deep merge (CR-01 fix, IN-03 copy); 9 inheritance tests incl. CR-01 regression, cycle path `["a","b","a"]`, missing parent                                                         |
| 7   | Resolution/load failures fail open — resolve() never crashes on theme errors (SC7, D-20)                                                                                                              | ✓ VERIFIED | `resolve()` try/catch: `error instanceof ThemeError` → outcome with `error` attached; non-ThemeError rethrown (programmer error); fail-open tests green                                                                                                                                                |
| 8   | Theme error hierarchy: stable THEME_* codes, KernelError-extended, toJSON serializable, no message-string matching (THEME-12, D-22)                                                                   | ✓ VERIFIED | `theme-errors.ts`: 6-code union, `ThemeError extends KernelError` + 6 subclasses; codes/names/details/toJSON locked by 6 tests; Compatibility/Authorization declared-not-raised per D-21                                                                                                               |
| 9   | D-19 merge formula is a deep merge with regression tests (CR-01 fix)                                                                                                                                  | ✓ VERIFIED | `deepMergeManifest`/`deepMergeObjects` recursive (child scalars/arrays win, nested plain-object subtrees merge); test "CR-01 regression: a partial child overlay preserves untouched parent token subtrees" asserts `colors.background` and `spacing` survive child's partial `colors.primary` overlay |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact                                                            | Expected                         | Status     | Details                                                                                                                     |
| ------------------------------------------------------------------- | -------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/theme/theme-target-registry.ts`                  | Registry + caps types (THEME-04) | ✓ VERIFIED | 85 lines; Map + constructor/register/get/has/list/size; no resolve() method                                                 |
| `packages/core/src/theme/theme-target-registry.test.ts`             | Registry suite                   | ✓ VERIFIED | 7 tests, `describe('ThemeTargetRegistry'`                                                                                   |
| `packages/core/src/theme/theme-errors.ts`                           | Error hierarchy (THEME-12)       | ✓ VERIFIED | 106 lines; 6-code union, KernelError-derived, ASCII hierarchy header                                                        |
| `packages/core/src/theme/theme-errors.test.ts`                      | Error suite                      | ✓ VERIFIED | 6 tests, `describe('ThemeErrors'`                                                                                           |
| `packages/contracts/src/theme/theme-assignments-store.ts`           | Store port (D-18)                | ✓ VERIFIED | 33 lines; type-only, 4 methods, sibling imports, JSDoc-contracted                                                           |
| `packages/contracts/src/theme/theme-assignments-store.test.ts`      | Port type-lock                   | ✓ VERIFIED | expectTypeOf mutual locks on 4-method surface                                                                               |
| `packages/core/src/theme/in-memory-theme-assignments-store.ts`      | Store adapter                    | ✓ VERIFIED | 125 lines; implements port, Zod safeParse-before-write, idempotent unassign, seed() no-emit, WR-03 normalization            |
| `packages/core/src/theme/in-memory-theme-assignments-store.test.ts` | Adapter suite                    | ✓ VERIFIED | 13 tests incl. WR-02 seed + WR-03 payload                                                                                   |
| `packages/core/src/theme/theme-resolver.ts`                         | 5-step pipeline (THEME-05)       | ✓ VERIFIED | 386 lines; 5 exported steps + satisfiesVersion + ThemeResolver + createThemeResolver                                        |
| `packages/core/src/theme/theme-resolver.test.ts`                    | Resolver suite                   | ✓ VERIFIED | 32 tests incl. WR-01 major-0 clamp, WR-02 TypeError, integration/fail-open/idempotency                                      |
| `packages/core/src/theme/theme-inheritance-resolver.ts`             | DFS inheritance (THEME-07)       | ✓ VERIFIED | 148 lines; implements `ThemeInheritanceResolverLike`; deep merge (CR-01)                                                    |
| `packages/core/src/theme/theme-inheritance-resolver.test.ts`        | Inheritance suite                | ✓ VERIFIED | 9 tests incl. CR-01 regression, cycle, missing parent, contract lock                                                        |
| `packages/core/src/index.ts`                                        | Phase-2 barrel                   | ✓ VERIFIED | 147 lines; full set: registry, resolver + createThemeResolver, inheritance, 7 errors + code, store adapter + listener types |
| `packages/contracts/src/index.ts`                                   | Contracts barrel                 | ✓ VERIFIED | line 92 `export type { ThemeAssignmentsStore }`                                                                             |

### Key Link Verification

| From                          | To                              | Via                                                                               | Status  | Details                                                        |
| ----------------------------- | ------------------------------- | --------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------- |
| theme-resolver.ts             | theme-target-registry.ts        | `registry.get(ctx.target.type)`                                                   | ✓ WIRED | resolveTarget line 61; never registers                         |
| theme-resolver.ts             | contracts ThemeAssignmentsStore | `store.get(ctx.target)`                                                           | ✓ WIRED | resolveAssignment line 72                                      |
| theme-resolver.ts             | theme-errors.ts                 | `new ThemeNotFoundError` / `new ThemeVersionError`                                | ✓ WIRED | resolveInheritance lines 189/195                               |
| theme-resolver.ts             | theme-inheritance-resolver.ts   | `implements ThemeInheritanceResolverLike` + delegation `deps.inheritance.resolve` | ✓ WIRED | inheritance-resolver.ts:36; resolver.ts:202                    |
| theme-inheritance-resolver.ts | theme-errors.ts                 | `new ThemeCycleError([...stack, id])` / `new ThemeNotFoundError(id)`              | ✓ WIRED | lines 69/73                                                    |
| theme-errors.ts               | kernel-errors.ts                | `extends KernelError`                                                             | ✓ WIRED | line 41 chain                                                  |
| in-memory store               | @mosaix/schemas                 | `ThemeAssignmentSchema.safeParse`                                                 | ✓ WIRED | line 62; ThemeValidationError on breach                        |
| in-memory store               | contracts port                  | `implements ThemeAssignmentsStore`                                                | ✓ WIRED | line 49 (compile proof)                                        |
| createThemeResolver           | store onMutation                | re-wraps store w/ onMutation + `seed(store.list())`                               | ✓ WIRED | theme-resolver.ts:288-297; TypeError for non-in-memory (WR-02) |
| core index.ts                 | all theme modules               | barrel exports                                                                    | ✓ WIRED | full Phase-2 set importable from `@mosaix/core`                |

### Data-Flow Trace (Level 4)

| Artifact                      | Data Variable           | Source                                                               | Produces Real Data                             | Status    |
| ----------------------------- | ----------------------- | -------------------------------------------------------------------- | ---------------------------------------------- | --------- |
| ThemeResolver.resolve         | `assignment`            | `store.get(ctx.target)` → real Map lookup, returns copy              | Yes (stored assignment flows)                  | ✓ FLOWING |
| resolveInheritance            | `manifest`              | `deps.loadManifest(themeId)` → injected loader, real manifest object | Yes (missing → ThemeNotFoundError, fail-open)  | ✓ FLOWING |
| Inheritance DFS               | `parentMerged.manifest` | recursive `visit()` + `deepMergeManifest`                            | Yes (parent base + child overlay, deep-merged) | ✓ FLOWING |
| InMemoryThemeAssignmentsStore | assignments Map         | `assign()` validated via ThemeAssignmentSchema, stored, emitted      | Yes (real binding records)                     | ✓ FLOWING |
| ThemeResolver.decision.source | themeId authority       | `resolveThemeId` chain (entity only in Phase 2)                      | Yes (D-15, no source mix)                      | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior                                               | Command                                                 | Result                                    | Status |
| ------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------- | ------ |
| Theme suite green (67 tests, 5 files)                  | `npx vitest run packages/core/src/theme`                | 5 files / 67 passed, 1.07s                | ✓ PASS |
| Full repo suite green (no regression from fix commits) | `npx vitest run`                                        | 61 files / 394 passed, 9.83s              | ✓ PASS |
| Core type-checks clean                                 | `npx tsc --noEmit -p packages/core/tsconfig.json`       | exit 0                                    | ✓ PASS |
| Contracts type-checks clean                            | `npx tsc --noEmit -p packages/contracts/tsconfig.json`  | exit 0                                    | ✓ PASS |
| Review-fix commits present in history                  | `git log --oneline`                                     | be5b7c4, 9460655, c59cdcc present         | ✓ PASS |
| Cleanliness gates                                      | grep `"space"`, `zod`, `.register(`, `event-bus` import | 0 matches source; event-bus only in JSDoc | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                                       | Status      | Evidence                                                   |
| ----------- | ----------- | ----------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------- |
| THEME-04    | 02-01       | ThemeTargetRegistry — single registry, both surfaces, capabilities                                                | ✓ SATISFIED | Registry file + 7 tests; constructor+register feed one Map |
| THEME-05    | 02-03       | ThemeResolver — entity-first, decoupled, idempotent, decomposed pipeline, no implicit registration                | ✓ SATISFIED | 5-step pipeline, precedence, fail-open, 32 tests           |
| THEME-06    | 02-02       | ThemeAssignmentsStore — in-memory assign/unassign + events; port defined                                          | ✓ SATISFIED | Port in contracts + adapter + emit tests                   |
| THEME-07    | 02-04       | ThemeInheritanceResolver — static extends graph, DFS, cycle → ThemeCycleError                                     | ✓ SATISFIED | DFS + deep merge + cycle/missing tests                     |
| THEME-12    | 02-02       | Theme error hierarchy — Validation/NotFound/Version/Cycle raised; Compatibility/Authorization declared-not-raised | ✓ SATISFIED | 6-code union, KernelError-extended, D-21 gated classes     |

**Orphaned requirements:** none — all 5 Phase-2 requirement IDs claimed by a plan and satisfied. (ThemeInjectionError appears in THEME-12's text but is explicitly deferred to the Phase-3 ThemeInjector per D-21, documented in both plan and `theme-errors.ts` header; not a Phase-2 scope gap.)

### Anti-Patterns Found

| File | Line | Pattern                                                           | Severity | Impact |
| ---- | ---- | ----------------------------------------------------------------- | -------- | ------ |
| —    | —    | No TODO/FIXME/placeholder/stub patterns in any Phase-2 theme file | —        | None   |

**Stub classification:** no `return null`, empty handlers, hardcoded-empty data, or console.log-only implementations found in `packages/core/src/theme/`.

### Human Verification Required

None. This phase is a pure TypeScript kernel library (no UI, no external services, no real-time behavior, no runnable entry point requiring a server). Every observable truth is programmatically verifiable via the vitest suite (394 tests green) and static analysis (tsc clean, grep gates).

### Gaps Summary

No gaps found. All 9 must-haves verified at levels 1–4 (exists, substantive, wired, data flowing). The single code-review critical (CR-01 deep-merge) and 3 warnings (WR-01 semver 0.x, WR-02 seed-no-emit + TypeError, WR-03 payload normalization) were fixed and are covered by new regression tests, independently confirmed in the code. Info finding IN-01 (resolveTarget result discarded — observability-only) was deliberately documented as deferred and does not affect the phase goal (the step is still exported, executed, and independently testable per SC3). Roadmap SC3's "cache-aware" clause is explicitly a Phase-3 deliverable (ThemeCache, THEME-09), not a Phase-2 gap.

---

_Verified: 2026-08-09T11:05:00Z_
_Verifier: OpenCode (gsd-verifier)_
