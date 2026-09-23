---
phase: 01-theme-contracts-schemas
plan: 01
subsystem: contracts
tags: [typescript, vitest, zod, theme, contracts, schemas, expectTypeOf]

# Dependency graph
requires:
  - phase: 00-init
    provides: roadmap invariants, PRD-0008 V2.3, ADR-0007 context, existing theme/* contract surface
provides:
  - Generic theme ABI: ThemeMode, ThemeTarget, AssignmentSource, ThemeAssignment, ThemePreference, ThemeResolutionSource, ThemeResolution, ThemeResolutionContext, ResolvedTheme, CompiledTheme
  - ThemeManifest.modes light/dark overlay (additive, no "system" key)
  - Theme events: theme.assignment.changed / theme.changed constants + 4 typed interfaces
  - Strict Zod schemas for every new contract + themeEventPayloadSchemas map keyed by constants
  - Legacy ThemePreference renamed to ExperienceThemePreference with deprecated alias (D-02)
affects: [02-core-resolution, 03-compile-inject, 04-sdk, 06-conformance]

# Tech tracking
tech-stack:
  added: [none — zod pre-existing, vitest pre-existing, expectTypeOf via vitest]
  patterns:
    - "Mutual toMatchTypeOf for cross-module object-shape locks (toEqualTypeOf identity quirk)"
    - "Event constants + typed payload interfaces in one module (identity-events pattern)"
    - "Zod schema map keyed by imported event constants (D-12, PayloadValidator-compatible)"

key-files:
  created:
    - packages/contracts/src/theme/theme-mode.ts
    - packages/contracts/src/theme/theme-target.ts
    - packages/contracts/src/theme/theme-assignment.ts
    - packages/contracts/src/theme/theme-preference.ts
    - packages/contracts/src/theme/theme-resolution.ts
    - packages/contracts/src/theme/theme-resolved.ts
    - packages/contracts/src/theme/theme-events.ts
    - packages/contracts/src/theme/theme-contracts.test.ts
    - packages/contracts/src/theme/theme-events.test.ts
    - packages/schemas/src/theme.test.ts
  modified:
    - packages/contracts/src/theme/theme-manifest.ts (modes overlay)
    - packages/contracts/src/experience/theme-contract.ts (rename + deprecated alias)
    - packages/contracts/src/index.ts (barrel)
    - packages/schemas/src/theme.ts (new schemas + modes)
    - packages/schemas/src/index.ts (barrel)

key-decisions:
  - "Object-shape locks use mutual toMatchTypeOf (both directions extends) because expect-type's toEqualTypeOf reports false for structurally identical types declared in different modules; unions/records/same-module aliases keep toEqualTypeOf (strongest check, works there)"
  - "ThemeManifestSchema.modes is an inner .strict() object — a 'system' overlay key fails validation deterministically (D-09)"
  - "themeEventPayloadSchemas keyed by imported constants from @mosaix/contracts, not literals (T-01-01, zero key drift)"
  - "Prettier run on plan files only; repo-wide prettier gate is pre-existing red (Windows core.autocrlf=true vs endOfLine:lf) and out of scope"

patterns-established:
  - "Pattern: co-located expectTypeOf suite per contract family, it() wrappers visible in vitest, compile-time enforced by tsc --build"
  - "Pattern: fixture targets are store/brand/workspace — never space (invariant #8)"
  - "Pattern: contract constants are the single key source for schema maps (schemas → contracts downward boundary)"

requirements-completed: [THEME-01, THEME-02, THEME-03]

# Metrics
duration: 17min
completed: 2026-08-08
---

# Phase 1 Plan 1: Theme Contracts & Schemas Summary

**Generic theme ABI in @mosaix/contracts — 10 type-only contracts + ThemeManifest.modes overlay + 2 theme events with constants, plus strict .strict() Zod schemas and a constants-keyed event payload schema map in @mosaix/schemas, with 49 compile-time/runtime assertions passing**

## Performance

- **Duration:** 17 min (continuation session, execution portion)
- **Started:** 2026-08-08T19:08:00Z (approx, plan executed in continuation)
- **Completed:** 2026-08-08T19:27:00Z
- **Tasks:** 3
- **Files modified:** 15 (10 created, 5 modified)

## Accomplishments

- 10 generic theme contracts shipped with exact PRD §4 shapes: ThemeMode, ThemeTarget (zero business fields), ThemeAssignment + AssignmentSource (4 authorities), canonical ThemePreference (mode-only, V2.3), ThemeResolutionSource (entity/user/application/platform — no tenant/default), ThemeResolution (lightweight `{ themeId, mode, source }`), ThemeResolutionContext (standalone, no ADR-0007 composition-context import), ResolvedTheme (final manifest), CompiledTheme = Record<string,string> (never unknown)
- ThemeManifest.modes optional light/dark DesignTokens overlay — additive; existing manifests without modes unchanged (D-10); "system" key rejected by the strict Zod inner object (D-09)
- Legacy experience `ThemePreference` renamed to `ExperienceThemePreference` with a deprecated alias — `ExperienceContract` / `ApplicationExperienceContract` compile untouched (D-02/D-03)
- Theme events per PRD §13: `theme.assignment.changed` / `theme.changed` constants + 4 typed payload interfaces (mode kept as string, faithful to spec)
- Strict Zod schemas for every new contract; `themeEventPayloadSchemas` map keyed by the imported constants — structurally PayloadValidator-compatible (D-12, T-01-01)
- Verification suite: 17 contracts + 5 events + 27 schema assertions; full workspace build, lint, and 325-test suite green

## task Commits

Each task was committed atomically:

1. **task 1: 01-01 generic theme contracts** - `6dfe201` (feat)
2. **task 2: 01-02 theme events** - `9bcaa5f` (feat)
3. **task 3: 01-03 Zod schemas + payload map** - `2af5077` (feat)
4. **follow-up: prettier formatting of plan files** - `55ae871` (style)

**Plan metadata:** `0477bea` (docs: create phase 1 plan)

## Files Created/Modified

- `packages/contracts/src/theme/theme-mode.ts` - Single ThemeMode alias ("light"|"dark"|"system"), drift prevention, "system" is resolution-time only (D-09)
- `packages/contracts/src/theme/theme-target.ts` - ThemeTarget { type, id }, INV-THEME-001/002, no business fields
- `packages/contracts/src/theme/theme-assignment.ts` - AssignmentSource (4 authorities) + ThemeAssignment (PRD §4.2)
- `packages/contracts/src/theme/theme-preference.ts` - Canonical generic ThemePreference (D-01, PRD §4.3 V2.3, mode only)
- `packages/contracts/src/theme/theme-resolution.ts` - ThemeResolutionSource / ThemeResolution / ThemeResolutionContext (D-04/D-05/D-06)
- `packages/contracts/src/theme/theme-resolved.ts` - ResolvedTheme + CompiledTheme (D-07, C2)
- `packages/contracts/src/theme/theme-events.ts` - Event constants + 4 typed interfaces (PRD §13, D-11)
- `packages/contracts/src/theme/theme-contracts.test.ts` - expectTypeOf suite: exact shapes, custom store/brand/workspace fixtures
- `packages/contracts/src/theme/theme-events.test.ts` - event type-literal locks + value builds
- `packages/contracts/src/theme/theme-manifest.ts` - ADDED `modes?: { light?; dark? }` (D-08/D-10)
- `packages/contracts/src/experience/theme-contract.ts` - Renamed to ExperienceThemePreference + @deprecated alias (D-02)
- `packages/contracts/src/index.ts` - Barrel: canonical ThemePreference now generic (D-01); events constants + types exported
- `packages/schemas/src/theme.ts` - 10 new strict schemas + modes overlay + event payload schemas + map (D-12)
- `packages/schemas/src/index.ts` - Re-exports all new schemas + map
- `packages/schemas/src/theme.test.ts` - 27 runtime safeParse assertions incl. D-04/D-09 negatives and THEME-03

## Decisions Made

- **Object-shape locking strategy:** `toEqualTypeOf` (expect-type's `isTypeIdenticalTo`) fails for structurally identical types declared in different modules — plan's literal assertion form for interfaces (`ThemeResolution`, `ResolvedTheme`, `ThemeResolutionContext`, `ThemeAssignment`, `ThemePreference`, `ExperienceThemePreference` shape) could not compile. Used mutual `toMatchTypeOf` (both directions extends ⇒ exact shape modulo readonly, which is erased at runtime); kept `toEqualTypeOf` where TS identity genuinely works (unions, `Record`, same-module alias). A why-comment documents this at the top of the test file.
- **Fixture rule honored:** store / brand / workspace targets only — verified by grep (zero `"space"` matches in plan files).
- **No new dependencies added** — zod + vitest were pre-existing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] expect-type identity quirk broke plan's literal toEqualTypeOf assertions**

- **Found during:** task 1 (01-01, verification suite)
- **Issue:** `expectTypeOf<ThemeResolution>().toEqualTypeOf<{...}>()` (and 4 other imported-interface vs literal assertions) failed with `TS2554: Expected 1 arguments, but got 0` — expect-type's type-identity operator reports false for identical types from different modules. Isolated with a repro file; confirmed `toMatchTypeOf` (structural extends) works cross-module.
- **Fix:** Mutual `toMatchTypeOf` (contract extends shape AND shape extends contract) for object shapes; unions/records/aliases keep the plan's `toEqualTypeOf`. Added why-comment.
- **Files modified:** packages/contracts/src/theme/theme-contracts.test.ts
- **Verification:** tsc type-check passes; 17 vitest assertions pass; package build green
- **Committed in:** 6dfe201 (task 1 commit)

**2. [Rule 1 - Bug] Wrong relative import in schemas test**

- **Found during:** task 3 (01-03)
- **Issue:** `import ... from "../index"` — vitest: "Cannot find module '../index'". Established repo convention (index.test.ts) uses `"./index"`.
- **Fix:** Changed to `from "./index"`.
- **Files modified:** packages/schemas/src/theme.test.ts
- **Verification:** 27 vitest assertions pass
- **Committed in:** 2af5077 (task 3 commit)

**3. [Rule 2 - Missing critical] D-06 grep verification violated by plan's own JSDoc instruction**

- **Found during:** task 1 (01-01, verification)
- **Issue:** Plan step 5 required JSDoc noting the standalone design AND a grep that no `CompositionContext` string appears. The literal token in JSDoc (and a test name) failed the plan's own verification grep.
- **Fix:** Reworded to "composition-context type" in JSDoc and "no composition-context dependency" in the test name — intent preserved, grep green.
- **Files modified:** packages/contracts/src/theme/theme-resolution.ts, packages/contracts/src/theme/theme-contracts.test.ts
- **Verification:** `grep CompositionContext packages/contracts/src/theme/` → zero matches
- **Committed in:** 6dfe201 (task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing verification compliance)
**Impact on plan:** All auto-fixes necessary for correctness and plan-verification compliance. No scope creep.

## Issues Encountered

- **Stale package dist/:** after adding the event constants to the barrel, `@mosaix/schemas` resolution failed against `@mosaix/contracts`'s stale `dist/` until `pnpm --filter @mosaix/contracts build` ran — normal incremental-build ordering, resolved by rebuilding contracts first.
- **Pre-existing uncommitted work (out of scope):** working tree contained prior-session artifacts not in `files_modified` — root `src/` experiment files + `.project/*` governance docs + edits to README.md / tsconfig.build.json / vitest.config.ts (all tracked as modified/untracked before this plan began). Left untouched per scope boundary; they will surface in `git diff --stat` for the phase verifier.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1 plan 2 (core resolution) can consume `ThemeResolution`, `ThemeResolutionContext`, `ThemePreference` and the resolver's precedence contract directly — the ABI is business-agnostic (verified by compile-time custom-target fixtures).
- Phase 1 plan 3 downstream: `themeEventPayloadSchemas` is ready to register into core's `EventSchemaRegistry` (out of scope here by plan).
- **Concern:** `pnpm check` prettier gate remains red repo-wide (379 files) due to `core.autocrlf=true` on Windows vs `endOfLine: "lf"` — pre-existing environment-level condition predating this plan. All files created/modified by this plan are prettier-clean. Recommended backlog item: `.gitattributes` `*.ts text eol=lf` or prettier config endOfLine auto + one-time `prettier --write`.

---

_Phase: 01-theme-contracts-schemas_
_Completed: 2026-08-08_

## Self-Check: PASSED

- 10/10 created contract/test files exist (verified on disk)
- SUMMARY.md exists at `.planning/phases/01-theme-contracts-schemas/01-SUMMARY.md`
- All 4 commits present in git history: `6dfe201`, `9bcaa5f`, `2af5077`, `55ae871`
- Focused suites green: 17 (contracts) + 5 (events) + 27 (schemas) = 49 assertions
- Full workspace: build green, lint green, 325 tests / 55 files green
- Plan greps: `CompositionContext` → 0 matches, `"tenant"/"default"` in theme-resolution union → 0 matches, `"space"` in plan files → 0 matches
