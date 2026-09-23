---
phase: 02-core-resolution
status: all_fixed
findings_in_scope: 4
fixed: 4
skipped: 0
iteration: 1
reviewed_at: 2026-08-09T03:10:00Z
fixed_at: 2026-08-09
---

# Phase 2: Code Review Fix Report

**Scope:** critical + warning (1 critical, 3 warnings)

## Fixed

### CR-01 — Shallow spread-merge drops inherited parent token subtrees

**File:** `packages/core/src/theme/theme-inheritance-resolver.ts`
**Fix:** Replaced top-level spread with `deepMergeManifest` — a recursive
merge where child scalars/arrays win while nested plain-object subtrees
(`tokens`, `modes`, `accessibility`, `assets`, `metadata`) merge depth-first,
so a partial child overlay preserves the parent's untouched subtrees.
**Test:** `theme-inheritance-resolver.test.ts` — "CR-01 regression: a partial
child overlay preserves untouched parent token subtrees".
**Also:** Single-theme fast path now spread-copies the manifest (IN-03) so no
path aliases the catalog manifest.

### WR-01 — `satisfiesVersion` caret accepts incompatible 0.x versions

**File:** `packages/core/src/theme/theme-resolver.ts`
**Fix:** Added a major-0 clamp: `^0.x.y` requires `foundMinor === x` with
`foundPatch >= y`; `^0.0.y` requires exact patch. Major ≥ 1 keeps the
same-major + `>= minor.patch` rule.
**Test:** `theme-resolver.test.ts` — "satisfiesVersion: major-0 caret clamps
to semver (WR-01)".

### WR-02 — Factory re-emits mutation events at bootstrap; silently drops `onMutation` for custom stores

**File:** `packages/core/src/theme/theme-resolver.ts` + `in-memory-theme-assignments-store.ts`
**Fix:** `createThemeResolver` now throws `TypeError` when `onMutation` is
supplied with a non-`InMemoryThemeAssignmentsStore` (no silent drop), and
re-seeds the wrapped store via a new `seed()` bulk-load method that validates
all-or-nothing and writes WITHOUT emitting, so existing bindings survive the
wrap with no backdated events.
**Tests:** `theme-resolver.test.ts` — factory seeds pre-populated store without
emitting + throws on non-store; `in-memory-theme-assignments-store.test.ts` —
`seed()` no-emit + schema-invalid all-or-nothing throw.

### WR-03 — Store emit payload can violate the event payload schema

**File:** `packages/core/src/theme/in-memory-theme-assignments-store.ts`
**Fix:** `changedBy` is normalized via `changedByOf()` — trimmed, empty falls
back to `"system"` so the payload always satisfies
`ThemeAssignmentChangedPayloadSchema` (`changedBy` min-1, `at` datetime).
**Test:** `in-memory-theme-assignments-store.test.ts` — "empty/whitespace
updatedBy emits changedBy 'system' passing the payload schema".

## Also Fixed (info findings, opportunistically in scope)

- **IN-02:** `get()` now returns a snapshot copy (`{ ...record }`).
- **IN-03:** fast-path `resolveInheritance` spread-copies the manifest.
- **IN-04:** `ThemeCompatibilityError` / `ThemeAuthorizationError` JSDoc now
  documents their Phase-3 PolicyResolver raise sites.

## Deferred

- **IN-01:** `resolveTarget` result still discarded in `resolve()` (step 1 is
  observability-only for now). Documented; a later phase may surface
  `outcome.registered`. Out of critical/warning scope.
