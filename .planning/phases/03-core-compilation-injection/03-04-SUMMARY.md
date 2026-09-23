---
phase: 03-core-compilation-injection
plan: 04
subsystem: core
tags: theme, runtime, facade, domain-events, d-12, hot-switch, benchmark, vitest, barrel

# Dependency graph
requires:
  - phase: 03-core-compilation-injection
    plan: 03
    provides: ThemeInjector (inject/flush + INJECTOR_BATCH_THRESHOLD), ThemeInjectionError
  - phase: 02-core-resolution
    provides: createThemeResolver, ThemeResolver, ThemeResolutionOutcome, ThemeAssignmentsStore
  - phase: 01-theme-contracts-schemas
    provides: ThemeManifest/ThemeResolutionContext types, themeChangedEvent const, ThemeManifestSchema, ThemeChangedPayloadSchema
provides:
  - ThemeRuntime facade: explicit registerTarget/registerTheme bootstrap, cache-first apply pipeline (resolve → compile → cache → inject → notify)
  - createThemeRuntime factory: D-12 wiring — theme.changed@1.0.0 registered on the kernel EventSchemaRegistry with ThemeChangedPayloadSchema, single-owner publish (mosaix/core)
  - hot-switch verification: 42-root bench harness reporting mean 0.12 ms (gate ≤ 100 ms) + deterministic timing gate test
  - first Phase-3 barrel exports: ThemeRuntime surface + ThemeInjectionError in packages/core/src/index.ts, bench script
affects:
  - 04-sdk-theme-star (theme.* SDK consumption of createThemeRuntime)
  - Shell bridge (Phase 5): ThemeChangedPublisher seam
  - T3-13/T3-14/T3-15 traceability (inject-before-notify, ThemeValidationError wrapping, single publish per apply)

# Tech tracking
tech-stack:
  added: (none — no new dependencies)
  patterns:
    - facade class with injected seams, factory wires the real dependencies (02-04 split)
    - explicit bootstrap (registerTarget/registerTheme) vs. read-only resolution path (D-16/D-17)
    - fail-open resolution passthrough (D-20): unresolved → bare { resolution }
    - cache-first hot path (cache.get before compile; same CompiledTheme reference on hit)
    - vitest bench harness with warm-up outside measured iterations + guarded rAF fallback

key-files:
  created:
    - packages/core/src/theme/theme-runtime.ts
    - packages/core/bench/theme-hot-switch.bench.ts
  modified:
    - packages/core/src/theme/theme-runtime.test.ts
    - packages/core/src/index.ts
    - packages/core/package.json

key-decisions:
  - "03-04: runtime OWNS composition — constructs its resolver via createThemeResolver from injected registry/store, builds defaults for cache/injector; the class imports only the narrow ThemeChangedPublisher seam, never event-bus"
  - "03-04: apply() is fail-open (D-20) — unresolvable/inheritance-blocked targets return { resolution } bare; compile/inject/notify only on resolved manifests; inject failures still propagate as ThemeInjectionError and block publish (fail-closed on injection)"
  - "03-04: apply() body contains NO register token (grep-gated invariant) — registration lives exclusively in registerTarget/registerTheme"
  - "03-04: theme.changed published after injection with timestamp captured inject-first (T3-13); exactly ONE publish per apply via the injected bus (T3-15)"
  - "03-04: bench harness uses guarded synchronous rAF fallback + explicit injector.flush() for determinism; timing gate test uses stubbed rAF (no wall-clock sleeps) with warm-up excluded"

patterns-established:
  - "Pattern: explicit-bootstrap facade with grep-invariant no-registration resolution path"
  - "Pattern: vitest bench measuring a cached hot path with warm-up outside the measured callback"
  - "Pattern: narrow publisher seam (type-only) kept out of the class, wired by the factory"

requirements-completed: [THEME-11]

# Metrics
duration: 4min
completed: 2026-08-10
---

# Phase 3 Plan 4: ThemeRuntime Summary

**ThemeRuntime facade with explicit bootstrap, cache-first apply pipeline and theme.changed@1.0.0 D-12 wiring, verified by a 42-root hot-switch bench at 0.12 ms mean (THEME-11)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-10T02:04:00Z
- **Completed:** 2026-08-10T02:08:14Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)
- **Hot-switch bench:** `42 roots cached compile+inject` — mean **0.1229 ms**, p75 0.142 ms, p99 0.2518 ms, 4069 samples, 8 136 hz (gate: ≤ 100 ms)

## Accomplishments

- `ThemeRuntime` facade: `registerTarget`/`registerTheme` (D-16, last-write-wins registry, D-21 manifest validation via `ThemeManifestSchema.safeParse` → `ThemeValidationError(issues)` — never a bare Zod TypeError, T3-14); `apply(ctx)` runs the resolution pipeline `resolve → compile → cache → inject → notify` with cache-first `cache.get(themeId, version, mode)` and returns `ThemeApplyOutcome { resolution, compiled?, appliedAt? }`.
- Fail-open passthrough (D-20): unresolved or invalid outcomes return `{ resolution }` bare — no compile, no inject, no publish.
- Inject-before-notify (T3-13): `injector.inject(compiled)` strictly precedes the payload timestamp capture; an inject failure propagates as `ThemeInjectionError` and no event is published. Exactly ONE publish per apply (T3-15).
- `createThemeRuntime`: D-12 wiring — registers `theme.changed@1.0.0` on the kernel `EventSchemaRegistry` with `ThemeChangedPayloadSchema`, builds EventsModule-mirror envelope + owner (`mosaix/core`) + payload checks, `uuidV7` envelope (internal classification), and once-per-apply publish through the injected bus. `THEME_CHANGED_EVENT_VERSION`, `THEME_RUNTIME_OWNER_APP`, `THEME_RUNTIME_DEFAULT_TENANT` exported.
- Hot-switch verification: `bench/theme-hot-switch.bench.ts` (42 CssStyleHost-style stub roots on one injector, warm-up apply outside the measured loop, guarded synchronous rAF for the ≥ 40-root batch path) plus a deterministic timing-gate `it` in the runtime suite — both demonstrating mean ≈ 0.12 ms, orders of magnitude under the 100 ms roadmap criterion.
- First Phase-3 barrel: `index.ts` re-exports `ThemeRuntime`, `createThemeRuntime`, `THEME_CHANGED_EVENT_VERSION`, `THEME_RUNTIME_OWNER_APP`, `ThemeApplyOutcome`/`ThemeRuntimeOptions`/`ThemeRuntimeFactoryOptions`/`ThemeChangedPublisher` types plus `ThemeInjectionError` (error group now 8 members); `package.json` gains `bench: vitest bench`.

## Task Commits

Each task was committed atomically:

1. **task 1 (TDD): ThemeRuntime facade + createThemeRuntime D-12 wiring**
   - RED: `129943b` (test)
   - GREEN: `3d20aa3` (feat)
2. **task 2: hot-switch bench + timing gate + barrel + bench script**
   - `952f96d` (fix, Rule 1 — see deviations)
   - `e707c04` (test)

## Files Created/Modified

- `packages/core/src/theme/theme-runtime.ts` - ThemeRuntime class, createThemeRuntime factory, ThemeChangedPublisher seam, ThemeApplyOutcome/ThemeRuntimeOptions/ThemeRuntimeFactoryOptions, exported event constants (created, 304 lines)
- `packages/core/bench/theme-hot-switch.bench.ts` - 42-root cached-path bench with warm-up outside measurement (created)
- `packages/core/src/theme/theme-runtime.test.ts` - 9-test suite: A–H scenarios + timing gate (modified)
- `packages/core/src/index.ts` - ThemeRuntime surface + ThemeInjectionError re-exports (modified, additive)
- `packages/core/package.json` - `bench: vitest bench` script (modified, additive)

## Decisions Made

- Runtime owns its composition: constructs its resolver via `createThemeResolver` from the injected registry/store, defaulting cache/injector — mirrors the 02-04 factory/class split and the EventsModule bus-wiring shape.
- The class imports only the narrow `ThemeChangedPublisher` seam (type-only) — it never imports event-bus; the factory supplies the real publisher so the class stays bus-agnostic.
- `apply()` fail-open on resolution (D-20) but fail-closed on injection: resolved-but-broken injection surfaces `ThemeInjectionError` and suppresses publish.
- `ThemeResolutionOutcome` is typed from core's own `theme-resolver` (it is not a contracts type) — the runtime surfaces it through `ThemeApplyOutcome.resolution`.
- Bench/timing determinism: no wall-clock sleeps — stubbed synchronous rAF + explicit `injector.flush()`; warm-up compile/cache/inject excluded from the measured region.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wrong import source for ThemeResolutionOutcome + unused ThemeTarget**

- **Found during:** task 2 verification (strict build gate `pnpm --filter @mosaix/core build`)
- **Issue:** `theme-runtime.ts` imported `ThemeResolutionOutcome` from `@mosaix/contracts` — the type is defined/exported by core's own `theme-resolver.ts` (contracts has only `ThemeResolutionSource`) → TS2724. `ThemeTarget` was imported from contracts but never used → TS6196 (noUnusedLocals).
- **Fix:** Removed both from the contracts type import; added `type ThemeResolutionOutcome` to the existing `./theme-resolver` import.
- **Files modified:** packages/core/src/theme/theme-runtime.ts
- **Verification:** build exit 0; runtime suite 9/9 re-green.
- **Committed in:** `952f96d` (separate fix commit before the task-2 harness commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix necessary for the strict build gate. No scope creep.

## Issues Encountered

- Node's `vitest bench` prints "Benchmarking is an experimental feature" to stderr (PowerShell surfaces it as a NativeCommandError wrapper); exit code is 0 and the report is emitted normally — documented so future runs are not misread as failures.
- The working tree contains pre-existing unrelated changes (`.project/*`, `docs/`, `src/`, `README.md`, `tsconfig.build.json`, `vitest.config.ts`, etc.) that predate this plan and are untouched/out of scope per the executor scope boundary.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `createThemeRuntime` is the Phase-4 SDK consumption entry point (`theme.*`): SDK will supply the real bus, tenant, and manifest catalog while keeping `ThemeChangedPublisher`/`ThemeRuntimeOptions` seams.
- `ThemeApplyOutcome` and the exported event constants give the shell bridge (Phase 5) the notify surface for live theme changes.
- Barrel (`index.ts`) now carries the full theme surface (compiler, cache, injector, runtime, errors, resolver, store) — Phase 4 consumes it wholesale.

---

_Phase: 03-core-compilation-injection_
_Completed: 2026-08-10_

## Self-Check: PASSED

- Files verified: theme-runtime.ts, bench/theme-hot-switch.bench.ts, theme-runtime.test.ts, index.ts, package.json, 03-04-SUMMARY.md
- Commits verified: 129943b, 3d20aa3, 952f96d, e707c04
- Gates: runtime suite 9/9, full theme suite 104/104, bench exit 0 (mean 0.1229 ms ≤ 100 ms), build exit 0, grep gates (theme-runtime ×2 / ThemeInjectionError ×1 in dist/index.d.ts, apply() body 0 register) all clean
