---
phase: 03-core-compilation-injection
plan: 01
subsystem: theme
tags:
  - theme-compiler
  - css-variables
  - determinism
  - mode-overlay
requires: [02-03, 02-04]
provides: [03-02, 03-04]
affects:
  [
    packages/core/src/theme/*,
    .planning/phases/03-core-compilation-injection/03-04-PLAN.md,
  ]
tech-stack:
  added: []
  patterns:
    - "pure exported function per pipeline step (compile(manifest, mode))"
    - "CR-01 deep-merge overlay replicated locally (no cross-module import)"
    - "group vs leaf discriminated by value type, not name whitelist (DesignTokens open at runtime)"
    - "byte-stable output via Object.keys(out).sort() rebuild"
key-files:
  created:
    - packages/core/src/theme/theme-compiler.ts
    - packages/core/src/theme/theme-compiler.test.ts
  modified: []
decisions:
  - "THE_GROUP_CSS_NAMES: PRD-locked colors->color, spacing->space; shadows->shadow singularized, typography/radius/motion verbatim (OpenCode discretion, documented in table JSDoc)"
  - "Empty plain object at leaf position is rejected (isGroup = non-empty plain object); a group used where a token is expected fails with ThemeValidationError"
  - "Mode overlay applied ONLY when mode is light/dark AND manifest.modes[mode] is defined; system (D-09) and absent overlays compile base tokens unchanged"
  - "standalone sortKeys rebuild keeps output byte-stable; sorted keys make the group table order irrelevant to determinism"
metrics:
  duration: 10min
  completed_date: 2026-08-10
requirements-completed: [THEME-08]
---

# Phase 03 Plan 01: Deterministic ThemeCompiler (THEME-08) Summary

**Pure `compile(manifest, mode) → CompiledTheme` with the PRD-0008 §4.8 `--mx-<groupe>-<token>` ABI, CR-01 deep-merge mode overlay, exhaustive value coercion, and byte-stable sorted output — target-agnostic (INV-THEME-007), zero DOM/I/O.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-10T01:27:00Z
- **Completed:** 2026-08-10T01:37:01Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 2 (one new source, one new test)

## Accomplishments

- Implemented `compile(manifest: ThemeManifest, mode: ThemeMode): CompiledTheme` — pure function, type-only `@mosaix/contracts` imports + `ThemeValidationError` from `./theme-errors`
- PRD-0008 §4.8 naming locked: `colors.primary → --mx-color-primary`, `spacing.md → --mx-space-md`, nested flatten `motion.duration.fast → --mx-motion-duration-fast`, token names verbatim
- CR-01 deep-merge overlay semantics: `modes.dark` partial overlay preserves untouched base subtrees; mode `system` compiles base tokens with NO overlay (D-09)
- Exhaustive coercion table: string passthrough, number → `${n}px`, boolean → "1"/"0", undefined skipped; null / object-at-leaf / function / symbol / bigint → `ThemeValidationError` (T3-01 mitigated)
- Determinism: keys rebuilt alphabetically sorted — two `compile()` calls deep-equal with identical key order
- 9 co-located vitest `it`s green (≥ 8 required); `expectTypeOf` locks the compile signature

## task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **task 1 (RED): ThemeCompiler suite** - `228aef4` (test)
2. **task 1 (GREEN): ThemeCompiler implementation** - `2437502` (feat)

**Plan metadata:** pending final docs commit

## Files Created/Modified

- `packages/core/src/theme/theme-compiler.ts` - Pure deterministic `compile` + `THE_GROUP_CSS_NAMES` table; private `mergeTokens`/`flatten`/`coerceValue`/`sortKeys` helpers
- `packages/core/src/theme/theme-compiler.test.ts` - 9-`it` co-located suite: naming, nested flatten, CR-01 overlay, system mode, coercion, rejection, determinism, sort order, signature lock

## Decisions Made

- **THE_GROUP_CSS_NAMES contents:** the two PRD-locked entries (colors→color, spacing→space) plus deterministic entries for the remaining DesignTokens groups (typography verbatim, radius verbatim, shadows→shadow singularized, motion verbatim). Sorted output keys make this table order-independent for byte-stability — documented in the table's JSDoc.
- **Group vs leaf by value type:** a non-empty plain object is a group (recurse); an empty plain object is a rejected leaf — this is what makes "a group used where a token is expected" fail with `ThemeValidationError` instead of silently emitting nothing.
- **Overlay application condition:** `mode === "light" || mode === "dark"` AND `manifest.modes?.[mode] !== undefined` → deep merge; otherwise base only. Keeps "system" (D-09) and absent-overlay manifests deterministic.
- **No barrel edit:** `packages/core/src/index.ts` untouched — the Phase-3 barrel lands in 03-04 (respected; no wave-1 file conflict).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mis-expected kebab-cased token names**

- **Found during:** GREEN verification (task 1)
- **Issue:** The coercion test asserted `--mx-typography-base-size`/`--mx-typography-heading`, but token names are verbatim per the plan → actual output is `--mx-typography-baseSize`. Compiler was correct; test expectation was wrong.
- **Fix:** Changed assertions to the verbatim names `--mx-typography-baseSize` / `--mx-typography-heading` with a comment noting no kebab-casing.
- **Files modified:** packages/core/src/theme/theme-compiler.test.ts
- **Verification:** suite green 9/9
- **Committed in:** `2437502` (part of GREEN commit)

**2. [Rule 1 - Bug] JSDoc comment tripped the ThemeTarget grep gate**

- **Found during:** Gate 1 verification
- **Issue:** The header JSDoc said "compile never sees a `ThemeTarget`" — the literal string `ThemeTarget` matched `grep -n "ThemeTarget"` (gate requires 0 matches anywhere in the file, comments included).
- **Fix:** Reworded to "compile never references the target type — zero target imports, zero target literals" (meaning preserved).
- **Files modified:** packages/core/src/theme/theme-compiler.ts
- **Verification:** grep gate now 0 matches; tsc clean
- **Committed in:** `2437502`

**3. [Rule 1 - Bug] noUncheckedIndexedAccess in sortKeys**

- **Found during:** first `tsc --noEmit` run
- **Issue:** `sorted[key] = out[key]` — `out[key]` is `string | undefined` under `noUncheckedIndexedAccess` → TS2322.
- **Fix:** Guarded with `const value = out[key]; if (value !== undefined) sorted[key] = value;`
- **Files modified:** packages/core/src/theme/theme-compiler.ts
- **Verification:** `tsc --noEmit` exit 0
- **Committed in:** `2437502`

**4. [Rule 2 - Missing] Fixture lacked required MosaixArtifactManifest fields**

- **Found during:** test authoring
- **Issue:** The plan's `<interfaces>` fixture block omits `name`/`metadata`, but `ThemeManifest extends MosaixArtifactManifest` requires them (strict TS would reject the fixture).
- **Fix:** `makeManifest()` factory supplies `name: "Ocean"`, `metadata: { name: "Ocean" }` (matches `theme-resolver.test.ts` convention), `id: "ocean"` per plan.
- **Files modified:** packages/core/src/theme/theme-compiler.test.ts
- **Verification:** tsc clean, suite green
- **Committed in:** `228aef4`

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 missing field)
**Impact on plan:** All auto-fixes necessary for correctness/type-checking. No scope creep — only the two plan-scoped files touched.

## Gate Note (plan-triggered, not a code deviation)

The prompt's gate list includes `grep -n '"space"' packages/core/src/theme/theme-compiler.ts → 0 matches`. This conflicts with the plan's own contract: the `<interfaces>` block **mandates** `THE_GROUP_CSS_NAMES` with `spacing: "space"` (PRD-0008 §4.8 ABI `--mx-space-md`, walk-through and must-have truth #2), and the plan's own `<verification>` section only greps the **test** file for `"space"` (fixture rule, invariant #8) — not the compiler. The plan contract wins: the compiler contains exactly one `"space"` literal (the PRD-locked table entry, line 53), and the test file has 0 matches as required. Both the plan's stated verification greps pass: `ThemeTarget` in compiler → 0, `"space"` in test → 0.

## Issues Encountered

- Plan's interfaces fixture omits required artifact fields (handled via factory — deviation #4)
- No other issues; all verification paths ran clean on first meaningfully-configured attempt

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `compile()` ready for ThemeCache (03-02) to store `CompiledTheme` and ThemeRuntime (03-04) to consume on cache miss
- The compiler is target-agnostic and pure — cache hot-switch benchmark (03-02) can rely on byte-stable keys
- Barrel export of the theme family still pending (03-04, single owner)

---

_Phase: 03-core-compilation-injection_
_Completed: 2026-08-10_

## Self-Check: PASSED

- SUMMARY.md exists ✓
- Commit `228aef4` (test, RED) present ✓
- Commit `2437502` (feat, GREEN) present ✓
- `packages/core/src/theme/theme-compiler.ts` exists ✓
- `packages/core/src/theme/theme-compiler.test.ts` exists ✓
