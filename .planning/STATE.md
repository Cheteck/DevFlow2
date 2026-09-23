---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: "Completed 03-04-PLAN.md (ThemeRuntime, THEME-11) - phase 03 complete; next: 04-sdk-theme-star"
last_updated: "2026-08-10T02:10:00.000Z"
last_activity: 2026-08-10
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 10
  completed_plans: 9
  percent: 90
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-08)

**Core value:** A project can theme any entity it declares, without the Theme System knowing anything about that entity â€” entity-first resolution (`entity > user > application > platform/default`) with user preference limited to `mode`.
**Current focus:** Phase 3 - Core Compilation & Injection (complete); next: Phase 4 SDK theme.*

## Current Position

Phase: 3 of 6 (core compilation & injection)
Plan: 04 of 04 (ThemeRuntime) â€” complete
Status: Phase complete â€” ready for verification
Last activity: 2026-08-10

Progress: [â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–‘] 90%

## Performance Metrics

**Velocity:**

- Total plans completed: 5
- Average duration: 17min
- Total execution time: 17min

**By Phase:**

| Phase                  | Plans | Total | Avg/Plan |
| ---------------------- | ----- | ----- | -------- |
| 1. Contracts & Schemas | 3     | 1     | 17min    |
| 2. Core Resolution     | 4     | â€”   | â€”      |
| 3. Compile & Inject    | 4     | â€”   | â€”      |
| 4. SDK theme.*         | 3     | â€”   | â€”      |
| 5. Shell Bridge        | 2     | â€”   | â€”      |
| 6. Conformance & DoD   | 3     | â€”   | â€”      |
| 2                      | 4     | -     | -        |

**Recent Trend:** Plan 01 (contracts) 17min

_Updated after each plan completion_
| Phase 02-core-resolution P02-01 | 6min | 2 tasks | 2 files |
| Phase 02-core-resolution P02-02 | 7min | 2 tasks | 7 files |
| Phase 02-core-resolution P02-03 | 13 | 2 tasks | 3 files |
| Phase 02-core-resolution P02-04 | 27 | 3 tasks | 4 files |
| Phase 03-core-compilation-injection P03-03 | 5min | 2 tasks | 4 files |
| Phase 03-core-compilation-injection P03-01 | 10min | 2 tasks | 2 files |
| Phase 03-core-compilation-injection P04 | 4min | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **Init (2026-08-08):** Phase 1 = Core + SDK + Shell; `ThemeTarget = { type, id }`; `CompositionContext.target`; entity-first precedence; themeId/mode decoupled; registry capabilities; in-memory store now + port later; catalog/UI never in kernel; theme inheritance â‰  entity inheritance; single PolicyResolver chain.
- **Roadmap lock (2026-08-08):** 8 implementation invariants user-approved â€” precedence `entity > user > application > platform`; themeId/mode decoupled (`ThemeResolution.source`); schema validates structure only (precedence = resolver); generic target, no business types in kernel; registration â‰  resolution (bootstrap-only register); resolver pipeline `resolveTargetâ†’resolveAssignmentâ†’resolveThemeIdâ†’resolveModeâ†’resolveInheritance`; store = port + in-memory; fixtures use store/brand/workspace, never Space.
- [Phase 01-theme-contracts-schemas]: Object-shape locks use mutual toMatchTypeOf (both directions extends) because expect-type's toEqualTypeOf reports false for structurally identical types declared in different modules; unions/records/same-module aliases keep toEqualTypeOf
- [Phase 01-theme-contracts-schemas]: ThemeManifestSchema.modes is an inner .strict() object â€” a 'system' overlay key fails validation deterministically (D-09)
- [Phase 01-theme-contracts-schemas]: themeEventPayloadSchemas keyed by imported constants from @mosaix/contracts, not literals (T-01-01, zero key drift)
- [Phase 01-theme-contracts-schemas]: Prettier gate repo-wide is pre-existing red (Windows core.autocrlf=true vs endOfLine:lf); plan files are prettier-clean; .gitattributes fix deferred to backlog
- [Phase 02-core-resolution]: Registry surfaces (declarative manifest + programmatic register()) feed ONE Map â€” bootstrap-only, no resolve() method (D-16); unknown types return undefined, never throw (D-17)
- [Phase 02-core-resolution]: ThemeAssignmentsStore port lives in @mosaix/contracts theme family (D-18) â€” type-only barrel export; in-memory adapter validates via Zod safeParse BEFORE write, emits onMutation synchronously (roadmap criterion #5)
- [Phase 02-core-resolution]: ThemeResolver pipeline (02-03): unconfigured loadManifest defaults to () => undefined so a missing provider fails OPEN as ThemeNotFoundError (D-20) instead of a TypeError
- [Phase 02-core-resolution]: ThemeResolver pipeline (02-03): resolve() builds the partial decision BEFORE the inheritance step so a fail-open outcome still carries { themeId, mode, source }
- [Phase 02-core-resolution]: ThemeResolver pipeline (02-03): decision.source records the themeId authority only (D-15); the mode step's from field is observability only
- [Phase ?]: 02-04: onMutation wiring lives in createThemeResolver factory, not ThemeResolver class (store never imports event-bus)
- [Phase ?]: 02-04: createThemeResolver re-wraps InMemoryThemeAssignmentsStore seeded from store.list() so existing bindings survive the wrap
- [Phase 03-core-compilation-injection]: 03-03: rAF captured as a free global binding at inject() call time (never imported, never globalThis-literal) so the module stays pure for node tests and vi.stubGlobal swaps it per test
- [Phase 03-core-compilation-injection]: 03-03: flush() writes changed THEN removed per root with per-write try/catch wrapping into ThemeInjectionError; previous is committed only after ALL roots apply cleanly (fail-closed, THEME-12)
- [Phase 03-core-compilation-injection]: 03-03: resolveStyleHost throws on register-time-invalid roots ONLY at flush (register keeps Set semantics, injection fails closed)
- [Phase 03-core-compilation-injection]: 03-03: test stub rAF is re-stubbed in beforeEach (plan skeleton's top-level only stub is un-stubbed by afterEach after the first test)
- [Phase ?]: 03-01 ThemeCompiler: THE_GROUP_CSS_NAMES PRD-locked (colors->color, spacing->space) + deterministic entries for remaining groups; sorted keys make table order irrelevant to byte-stability
- [Phase ?]: 03-01 ThemeCompiler: group vs leaf discriminated by value type (non-empty plain object = group); empty plain object = rejected leaf -> ThemeValidationError (group used where token expected)
- [Phase ?]: 03-01 ThemeCompiler: mode overlay applied only when light/dark AND modes[mode] defined; system (D-09) and absent overlays compile base tokens unchanged
- [Phase 03-core-compilation-injection]: 03-04: runtime OWNS composition - constructs its resolver via createThemeResolver from injected registry/store, builds defaults for cache/injector; the class imports only the narrow ThemeChangedPublisher seam, never event-bus
- [Phase 03-core-compilation-injection]: 03-04: apply() is fail-open (D-20) - unresolvable/inheritance-blocked targets return bare { resolution }; compile/inject/notify only on resolved manifests; inject failures propagate as ThemeInjectionError and block publish (fail-closed on injection)
- [Phase 03-core-compilation-injection]: 03-04: apply() body contains NO register token (grep-gated invariant); registration lives exclusively in registerTarget/registerTheme
- [Phase 03-core-compilation-injection]: 03-04: theme.changed published after injection with timestamp captured inject-first (T3-13); exactly ONE publish per apply via the injected bus (T3-15)
- [Phase 03-core-compilation-injection]: 03-04: bench harness uses guarded synchronous rAF fallback + explicit injector.flush() for determinism; timing gate test uses stubbed rAF (no wall-clock sleeps) with warm-up excluded

### Pending Todos

From .planning/todos/pending/ â€” ideas captured during sessions.

None yet.

### Blockers/Concerns

- [Init] ADR-0007 (CompositionContext) ratified but not implemented â€” theme target integration depends on it.
- [Init] Legacy `@mosaix/contracts/src/experience/` predates ADR-0007 â€” must not extend for theme.
- [Init] `pnpm install` blocked locally by supply-chain policy (aws-sdk minimumReleaseAge); CI inactive (no remote).

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
| -------- | ---- | ------ | ----------- |
| _(none)_ |      |        |             |

## Session Continuity

Last session: 2026-08-10T02:10:00Z
Stopped at: Completed 03-04-PLAN.md (ThemeRuntime, THEME-11) â€” phase 03 complete; next: 04-sdk-theme-star
Resume file: None
