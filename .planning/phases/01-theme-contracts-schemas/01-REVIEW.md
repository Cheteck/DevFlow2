---
phase: 01-theme-contracts-schemas
reviewed: 2026-08-09T00:35:00Z
depth: deep
files_reviewed: 15
files_reviewed_list:
  - packages/contracts/src/theme/theme-mode.ts
  - packages/contracts/src/theme/theme-target.ts
  - packages/contracts/src/theme/theme-assignment.ts
  - packages/contracts/src/theme/theme-preference.ts
  - packages/contracts/src/theme/theme-resolution.ts
  - packages/contracts/src/theme/theme-resolved.ts
  - packages/contracts/src/theme/theme-events.ts
  - packages/contracts/src/theme/theme-manifest.ts
  - packages/contracts/src/experience/theme-contract.ts
  - packages/contracts/src/index.ts
  - packages/contracts/src/theme/theme-contracts.test.ts
  - packages/contracts/src/theme/theme-events.test.ts
  - packages/schemas/src/theme.ts
  - packages/schemas/src/index.ts
  - packages/schemas/src/theme.test.ts
findings:
  critical: 0
  major: 1
  minor: 1
  nit: 2
  total: 4
verdict: pass-with-findings
---

# Phase 1 — Theme Contracts & Schemas: Code Review

**Reviewed:** 2026-08-09
**Depth:** deep (cross-file invariant tracing + CI-chain verification)
**Status:** findings

## Summary

The 4 commits (`6dfe201`, `9bcaa5f`, `2af5077`, `55ae871`) implement the Phase 1
plan faithfully. Every interface in the PLAN `<interfaces>` block is matched
exactly, and every locked invariant checked out:

- **D-04** — `ThemeResolutionSource` is exactly the 4-literal union; `"tenant"` /
  `"default"` are absent from both the type and the Zod enum; the schema
  runtime-rejects `source: "default"`. ✅
- **D-05** — `ThemeResolution = { themeId, mode, source }`, never mixes
  identity with preference. ✅
- **D-06** — `ThemeResolutionContext` is standalone; grep found zero
  `CompositionContext` occurrences in `packages/contracts/src/theme/`. ✅
- **D-08/D-09** — `modes` is `{ light?, dark? }`; the `.strict()` inner object
  schema rejects a `"system"` overlay key (runtime-tested), while manifests
  without `modes` still pass (additive). ✅
- **D-11/D-12** — both events declared with exact PRD-0008 §13 payloads
  (verified against PRD lines 587/594); constants exported as values;
  `themeEventPayloadSchemas` keyed by the imported constants; each value has
  `safeParse`; no `@mosaix/core` import anywhere in `@mosaix/schemas`
  (package deps: only `@mosaix/contracts` + `zod`). ✅
- **D-02** — `ExperienceThemePreference` rename + deprecated alias; both
  legacy consumers (`experience-contract.ts:7,22`, `application-experience.ts:7,14`)
  still resolve via the relative path. ✅
- **Scope** — `git diff 0477bea..55ae871` touches exactly the 15 planned files,
  977 insertions / 2 deletions, no edits to `experience-contract.ts` /
  `application-experience.ts`; the barrel diff replaces only the legacy
  `ThemePreference` line and appends theme exports (additive).
- **Verification run** — focused suites pass:
  `theme-contracts.test.ts` (17), `theme-events.test.ts` (5),
  `schemas/src/theme.test.ts` (27).
- Fixture rule respected: no `"space"` literal anywhere in the new files
  (`workspace` used as a _custom target type_, which is the sanctioned set).

The one substantive finding is a **gap between the plan's claimed CI gate and
reality**: the `expectTypeOf` shape-locks are not enforced anywhere, contrary
to the plan's testing strategy and threat model T-01 (see F-01).

## Findings

| ID   | Severity | File:Line                                                                                                                                                    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Suggested fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-01 | major    | `packages/contracts/tsconfig.json:12` + `packages/schemas/tsconfig.json:12` + `vitest.config.ts:30-44` (+ `theme-contracts.test.ts`, `theme-events.test.ts`) | **Contract type-locks are not enforced by any CI gate.** The PLAN asserts "assertions are compile-time enforced by `pnpm build`" (testing_strategy, T-01-04) and that tests "are part of the build". Reality: both package tsconfigs `exclude: ["src/**/*.test.ts"]`, `tsconfig.build.json`/root tsconfig include no test files, `tsconfig.build.json` builds only project references, and vitest configs have no `test.typecheck`. `expectTypeOf<T>()(...)` calls are purely type-level: without a typecheck pass they perform no runtime assertion (the generic-only form has no runtime value to compare), and the abundant `expect(x).toEqual(x)` value asserts are trivially true against the fixture literals. Net effect: if `ThemeResolutionSource` gains `"tenant"` or `ThemeResolution` drifts, `pnpm check` stays green and consumers in later phases mis-validate silently. Only the **Zod schemas** runtime-enforce D-04/D-09 negatives today, so the type↔schema boundary drift is unguarded. | Wire a typecheck pass into `pnpm check` for the test files, e.g. a `packages/{contracts,schemas}/tsconfig.test.json` (includes `src/**/*.test.ts`) built by `tsc --noEmit -p` in the package `check`, or enable vitest `test.typecheck` (v3.2 supported). Alternatively turn the pure-type assertions into runtime assertions on the schema enum (e.g. `expect((ThemeResolutionSourceSchema.options)).toEqual(["entity","user","application","platform"])`), though that only locks the schema, not the contract type — the typecheck pass is the correct fix. |
| F-02 | minor    | `packages/contracts/src/theme/theme-manifest.ts:22`                                                                                                          | `modes` inner object `{ light?: …; dark?: … }` lacks `readonly`, while every new sibling contract (`ThemeAssignment`, `ThemePreference`, `ThemeResolution`, `ResolvedTheme`) is fully `readonly` per CONVENTIONS.md (`readonly` on interface fields). String: the pre-existing fields in this file (`tokens`, `extends`, …) are also non-readonly, so it is consistent with the file's inherited style — but the PLAN's "All fields readonly" directive (interfaces block) is not upheld for this one field.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `modes?: readonly { readonly light?: DesignTokens; readonly dark?: DesignTokens };` — deliberate divergence from file style needs a documented note if intentional.                                                                                                                                                                                                                                                                                                                                                                                            |
| F-03 | minor    | `packages/schemas/src/theme.ts:1-3`                                                                                                                          | Stale header JSDoc: "Zod validators for the theme manifest & design tokens" — the file now also hosts the whole generic ABI (9 schemas) + event payload schemas. Per CONVENTIONS the header must state the module's full purpose/gov references.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Update header to cover the Phase 1 scope (PRD-0008 §4 + D-01..D-12), mirroring the in-file section comment at line 155.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| F-04 | nit      | `packages/contracts/src/index.ts:92`                                                                                                                         | Public-API note (accepted design, D-01/D-02): the barrel export `ThemePreference` now has namespace meaning — old bag `{ inherit, supports, preferred? }` consumers cannot spell `.supports` anymore (compile error) if they cannot resize to relative-path imports. In-repo safe (repo-wide grep shows zero barrel consumers elsewhere), so "zero breaking changes" holds in-repo only. Worth a legacy-export footnote in the package barrel comment / changelog for any external surface.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Acceptable per governance decision; recommend a one-line `@readme` note in the barrel pointing to `ExperienceThemePreference` for legacy consumers.                                                                                                                                                                                                                                                                                                                                                                                                            |

## Verdict

**pass-with-findings** (fixable by `gsd-code-review-fix`)

- All 12 governance invariants (D-01…D-12) and the 5 success criteria verified
  ✅; exact interface conformance; diff scope is 15/15 planned files, additive
  at both type and schema levels.
- F-01 is the only copy-gating impact: it is a config-level fix (tsconfig /
  vitest typecheck wiring or a tiny script addition to `pnpm check`) — no
  contract shapes or schemas change. F-02/F-03 are trivial one-liners.
- Recommended fix wave: F-01 (add typecheck gate) → F-02 → F-03 → F-04 (doc).

---

_Reviewed: 2026-08-09_ · _Reviewer: OpenCode (gsd-code-review)_ · _Depth: deep_
