---
phase: 03-core-compilation-injection
plan: 03
subsystem: ui
tags: theme, shadow-dom, css-variables, requestAnimationFrame, batching, vitest, error-codes

# Dependency graph
requires:
  - phase: 02-core-resolution
    provides: ThemeResolver pipeline, ThemeAssignmentsStore, ThemeError/KernelError hierarchy
  - phase: 01-theme-contracts-schemas
    provides: CompiledTheme = Record<string, string> (C2) type-only import surface
provides:
  - diff-based Shadow-DOM-safe ThemeInjector (THEME-10, roadmap criterion #3)
  - diffCompiledTheme pure helper + INJECTOR_BATCH_THRESHOLD = 40 export
  - ThemeInjectionError (THEME_INJECTION) — 7-member ThemeErrorCode union (THEME-12)
affects:
  - 03-04 (ThemeRuntime facade + hot-switch benchmark driving 42 roots)
  - 04-sdk-theme-star (theme.* runtime consumption)
  - Governance PolicyResolver (Compatibility/Authorization raise gates unchanged)

# Tech tracking
tech-stack:
  added: (none — no new dependencies)
  patterns:
    - structural host resolution (typeof/in narrows, never instanceof DOM classes)
    - rAF coalescing at INJECTOR_BATCH_THRESHOLD with sync flush below
    - diff-based DOM writes (setProperty for changed, removeProperty for removed)
    - fail-closed error propagation with previous-run rollback

key-files:
  created:
    - packages/core/src/theme/theme-injector.ts
    - packages/core/src/theme/theme-injector.test.ts
  modified:
    - packages/core/src/theme/theme-errors.ts
    - packages/core/src/theme/theme-errors.test.ts

key-decisions:
  - "03-03: rAF captured as a free global binding at inject() call time (never imported, never globalThis-literal) so the module stays pure for node tests and vi.stubGlobal swaps it per test"
  - "03-03: flush() writes changed THEN removed per root with per-write try/catch wrapping into ThemeInjectionError; previous is committed only after ALL roots apply cleanly"
  - "03-03: resolveStyleHost throws on register-time-invalid roots ONLY at flush (register keeps Set semantics, injection fails closed)"
  - "03-03: test stub rAF is re-stubbed in beforeEach (plan skeleton's top-level only stub is un-stubbed by afterEach after the first test)"

patterns-established:
  - "Pattern: rAF-deferred batch flushes above a constant threshold, coalesced to one frame, asserted via stub capture not wall-clock"
  - "Pattern: CSSOM-touch confined to a minimal CssStyleHost structural surface on root (or root.host for ShadowRoot-like)"

requirements-completed: [THEME-10]

# Metrics
duration: 5min
completed: 2026-08-10
---

# Phase 3 Plan 3: ThemeInjector Summary

**Shadow-DOM-safe diff-based ThemeInjector with rAF batching at 40 roots (THEME-10), plus THEME_INJECTION/ThemeInjectionError extending the theme error union to 7 members (THEME-12)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-10T01:26:38Z
- **Completed:** 2026-08-10T01:31:30Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `ThemeInjector`: `register`/`unregister`/`has`/`size` over a reference-identity Set; `inject(compiled)` applies synchronously below 40 roots, defers through ONE coalesced `requestAnimationFrame` flush at ≥ 40 (`INJECTOR_BATCH_THRESHOLD` exported); `flush()` idempotent, applies diff to all roots then commits `previous`.
- `diffCompiledTheme` (pure, exported): `{ changed, removed }` sorted/deterministic; first-run (previous undefined) → all next changed, none removed; identical maps → no writes at all.
- Structural host resolution with `typeof`/`in` narrows only — accepts real HTMLElement, ShadowRoot (via `root.host`), or plain test stubs; no `instanceof` DOM classes, zero `document`/`window`/`customElements`/`globalThis` tokens (grep-enforced).
- Fail-closed injection: any root style failure raises `ThemeInjectionError` (code `THEME_INJECTION`, detail `hostKind`), and `previous` is NOT advanced — a retry re-applies from the original run.
- `ThemeErrorCode` union extended 6 → 7 with `THEME_INJECTION`; `ThemeInjectionError` declared per the Phase-2 deferral contract; header JSDoc tree updated; errors suite lock updated.

## Task Commits

Each task was committed atomically:

1. **task 1: Declare THEME_INJECTION + ThemeInjectionError; update the error union lock** - `cc9f685` (feat)
2. **task 2 (TDD): ThemeInjector with diff-based rAF-batched application**
   - RED: `2db38f1` (test)
   - GREEN: `ab7dc5f` (feat)

## Files Created/Modified

- `packages/core/src/theme/theme-injector.ts` - ThemeInjector class, diffCompiledTheme, INJECTOR_BATCH_THRESHOLD, CssStyleHost/ThemeRoot types, resolveStyleHost (created)
- `packages/core/src/theme/theme-injector.test.ts` - 9-test suite: diff semantics, sync/batched injection, shadow-like hosts, fail-closed, structural rejection (created)
- `packages/core/src/theme/theme-errors.ts` - THEME_INJECTION union member + ThemeInjectionError class + header tree reworded (modified)
- `packages/core/src/theme/theme-errors.test.ts` - 7-member union lock, instance codes, new injection `it` (modified)

## Decisions Made

- rAF resolved as a free global binding at `inject()` call time — keeps the module import-pure, lets `vi.stubGlobal` swap it per test, and avoids the `globalThis` literal the grep gate forbids.
- `flush()` applies changed-then-removed per root inside per-write try/catch; `previous` commits only after every root applies cleanly (fail-closed, THEME-12).
- Structural rejection happens at flush time (register never throws; `has()`/`size` stay consistent).
- Test rAF stub is installed in `beforeEach` (see deviations — plan skeleton only stubbed at module top level).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TS2352 unsafe cast in shadow-host branch**

- **Found during:** task 2 GREEN verification (`pnpm --filter @mosaix/core exec tsc --noEmit`)
- **Issue:** Initial `resolveStyleHost` cast `(root as { host: CssStyleHost }).host` was rejected by tsc — `ShadowRoot.host` is `Element`, whose `style` is incompatible with `CssStyleHost`; TS requires conversion through `unknown`.
- **Fix:** Restructured to extract `(root as { host: unknown }).host`, narrow with the `hasStyleSurface` type guard, and return the narrowed value directly (no host-shaped cast).
- **Files modified:** packages/core/src/theme/theme-injector.ts
- **Verification:** `pnpm --filter @mosaix/core exec tsc --noEmit` exit 0; injector suite 9/9 re-green.
- **Committed in:** `ab7dc5f` (part of task 2 GREEN commit)

**2. [Rule 3 - Blocking] Plan skeleton's rAF stub breaks after the first test**

- **Found during:** task 2 test scaffolding (design-time, before first run)
- **Issue:** The plan's stub sketch installs `vi.stubGlobal("requestAnimationFrame", ...)` at module top level but `afterEach(() => vi.unstubAllGlobals())` — after the first test completes, rAF is un-stubbed for every later test, so the ≥ 40-root batching test would throw `ReferenceError: requestAnimationFrame is not defined`.
- **Fix:** Moved the stub install into `beforeEach` (same capture semantics, re-installed per test); `afterEach` unchanged.
- **Files modified:** packages/core/src/theme/theme-injector.test.ts
- **Verification:** whole suite green across every ordering (9/9).
- **Committed in:** `2db38f1` (RED commit; behavior final in `ab7dc5f`)

**3. [Plan constraint alignment] Test CSS-variable names avoid the "space" token**

- **Found during:** task 2 test writing
- **Issue:** The plan's Test-1 behavior illustratively uses `--mx-space-md`; the plan's own grep gate and the shelling constraints forbid a `"space"` literal anywhere. `--mx-space-md` does not itself contain the quoted token, but staying unambiguous is safer.
- **Fix:** Used `--mx-radius-md` as the removed variable (`--mx-space-md`'s behavioral twin) — identical diff semantics under test.
- **Files modified:** packages/core/src/theme/theme-injector.test.ts
- **Verification:** `grep '"space"' theme-injector.test.ts` → 0 matches; diff tests green.
- **Committed in:** `2db38f1`

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 constraint alignment)
**Impact on plan:** All auto-fixes necessary for correctness/green gates. No scope creep.

## Issues Encountered

- Plan's errors-suite acceptance says "6 its incl. new injection it" — the existing file already had 6 original `it`s, so the suite is 7 green (the lock intent — updated union + new class test — is fully met).
- Full-core `vitest run` reported `src/theme/theme-compiler.test.ts` as a failing suite (missing `./theme-compiler`) at 03-03 completion time. This was a tracked, intentionally-RED suite from plan 03-01 (`228aef4`, THEME-08) awaiting its compiler implementation — out of 03-03 scope at the time; logged to `deferred-items.md`. **Resolved since:** the compiler (`2437502`) and cache (`ad7f113`) landed, and the full theme suite now passes 8 files / 95 tests green (verified 2026-08-10).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ThemeInjector`, `diffCompiledTheme`, `INJECTOR_BATCH_THRESHOLD` ready for 03-04 (ThemeRuntime facade: `inject(compiled)` call path, hot-switch benchmark driving 42 roots through the rAF batch).
- `ThemeInjectionError` raise site consumable by the 03-04 runtime path; `packages/core/src/index.ts` barrel still untouched (lands 03-04 per plan).

---

_Phase: 03-core-compilation-injection_
_Completed: 2026-08-10_

## Self-Check: PASSED

- Files verified: theme-injector.ts, theme-injector.test.ts, theme-errors.ts, theme-errors.test.ts, 03-03-SUMMARY.md
- Commits verified: cc9f685, 2db38f1, ab7dc5f
- Gates: vitest injector 9/9, vitest errors 7/7, tsc --noEmit exit 0, build exit 0, grep gates all 0
