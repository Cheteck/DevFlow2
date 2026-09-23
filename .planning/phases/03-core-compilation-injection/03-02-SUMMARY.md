---
phase: 03-core-compilation-injection
plan: 02
subsystem: core-theme
tags: [typescript, vitest, theme, lru-cache, expectTypeOf]

# Dependency graph
requires:
  - phase: 01-theme-contracts-schemas
    provides: CompiledTheme contract (Record<string, string>, correction C2) — the cached value type
  - phase: 03-core-compilation-injection (03-CONTEXT)
    provides: « ThemeCache » decision block — LRU-bounded ~100 entries, explicit get/set/clear/invalidate, no auto-invalidation wiring
provides:
  - ThemeCache LRU-bounded keyed CompiledTheme store (THEME-09, roadmap criterion #2 — repeat resolutions served from cache)
  - toThemeCacheKey canonical `themeId:version:mode` composition (single source of truth for 03-04 + hot-switch bench)
  - Co-located 9-assertion vitest suite gating keying / reference identity / LRU eviction / recency refresh / invalidate variants / clear / miss-undefined / cap-0
affects:
  [
    03-core-compilation-injection (03-04 ThemeRuntime cache-first lookup + hot-switch bench),
    03-03 compiler integration,
  ]

# Tech tracking
tech-stack:
  added: [none]
  patterns:
    - "LRU via Map iteration order: first key = least-recently-used; get refreshes recency by delete + re-set (O(1))"
    - "Opaque ThemeCacheKey string type with canonical toThemeCacheKey composer (single key-format authority)"
    - "Wildcard invalidate: omitted argument matches any value; zero-arg invalidate() == clear()"
    - "Class + private Map state (stateful-piece convention, store 02-02 analog), type-only contracts import, pure synchronous in-memory"

key-files:
  created:
    - packages/core/src/theme/theme-cache.ts
    - packages/core/src/theme/theme-cache.test.ts
  modified: []

key-decisions:
  - "Recency refresh happens in get() only — set() inserts and evicts when OVER cap; has() is a read-only probe (no recency side effects) per plan semantics"
  - "invalidate() splits each key deterministically on ':' (exactly three parts) so a version/mode containing ':' can only match its own composite (T3-05 mitigation)"
  - "Eviction while-loop guarantees size ≤ maxEntries invariant on every set() (T3-06 DoS mitigation); cap 0 is a legal empty cache (tested)"

patterns-established:
  - "Pattern: Map-backed LRU store where iteration order IS recency order; delete+re-set to promote a key"
  - "Pattern: wildcard-optional invalidation parameters (undefined = any)"
  - "Pattern: expectTypeOf locks on get parameter types + constructible-with cap 0"

requirements-completed: [THEME-09]

# Metrics
duration: 5min
completed: 2026-08-10
---

# Phase 3 Plan 2: ThemeCache — LRU-Bounded Keyed CompiledTheme Store Summary

**LRU-bounded Map-backed ThemeCache keyed by canonical `themeId:version:mode` with reference-preserving get, recency refresh on hit, wildcard invalidate, and a 9-assertion vitest suite — the cache-half of the ≤ 100 ms hot-switch path (THEME-09, roadmap criterion #2)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-10T01:26:38Z
- **Completed:** 2026-08-10T01:31:20Z
- **Tasks:** 2 (TDD: RED → GREEN)
- **Files modified:** 2 (both created)

## Accomplishments

- `ThemeCache` class: private `Map<ThemeCacheKey, CompiledTheme>`; `get` refreshes recency on hit (delete + re-set → O(1)) and returns `undefined` on miss (CONVENTIONS lookups); `set` inserts then evicts the first Map key (LRU) in a while-loop until `size ≤ maxEntries` (default `THEME_CACHE_DEFAULT_MAX = 100`, 03-CONTEXT)
- `toThemeCacheKey(themeId, version, mode)` → `` `${themeId}:${version}:${mode}` `` — canonical key composition exported as the single key-format authority for 03-04 + hot-switch bench; `ThemeCacheKey` opaque string type
- Wildcard invalidation: `invalidate("ocean", undefined, undefined)` removes all "ocean" keys; exact args remove exactly one; zero-arg `invalidate()` == `clear()`; split-on-":" matching is deterministic for keys whose parts contain ":" (T3-05)
- Purity per plan: type-only `CompiledTheme` import from `@mosaix/contracts`, no DOM/I/O/timers/globals, all methods synchronous; has() is a read-only probe that never mutates recency
- 9-assertion co-located suite green, including `expectTypeOf` locks (`get` param 0 is string, `set` param 3 is CompiledTheme, `ThemeCache` constructible with cap 0) and a runtime cap-0 test proving an empty cache accepts get/set/invalidate safely

## task Commits

Each task was committed atomically (TDD: test commit then feat commit):

1. **task 1 RED: ThemeCache failing suite** - `8fd4153` (test)
2. **task 1 GREEN: LRU-bounded ThemeCache** - `ad7f113` (feat)

## Files Created/Modified

- `packages/core/src/theme/theme-cache.ts` - THEME_CACHE_DEFAULT_MAX, ThemeCacheKey, toThemeCacheKey, ThemeCache (get/set/has/invalidate/clear/size)
- `packages/core/src/theme/theme-cache.test.ts` - 9-assertion suite: keying + mode separation, same-reference get, LRU eviction, recency refresh, invalidate exact/partial/zero-arg, clear + miss-undefined, cap-0 + expectTypeOf locks

## Decisions Made

- **Recency refresh in get() only** — per plan action step 3: "refresh-a-hit is done via get(); set() always inserts and only evicts when OVER cap". `has()` is a documented read-only probe with no recency side effect (plan action step 4).
- **Deterministic split matching for invalidate** — keys split on ":" into exactly three parts; a provided arg must equal its part or be undefined (wildcard). A version/mode containing ":" can only match its own composite key — T3-05 mitigation, no partial overwrite.
- **Opaque key type + single composer** — 03-04 and the benchmark call `toThemeCacheKey`, keeping the key format in one exported authority (plan action step 1: "Do NOT encode in any other order/format").

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- None — RED gate failed with the expected `Cannot find module './theme-cache'` (genuine fail-before-implementation), GREEN passed 9/9 on first run; tsc, build, and all grep gates passed first-try. No stale-dist issue: `CompiledTheme` was already in the current `@mosaix/contracts` dist barrel from Phase 2.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 03-04 (ThemeRuntime) can do cache-first lookup: `cache.get(themeId, version, mode)` → on miss compile via 03-01 `compile()` and `cache.set(...)`; `ThemeChangedEvent` hot-switch bench exercises the ≤ 100 ms path against this store
- `invalidate(...)` is the documented Phase-4 auto-invalidation subscription point (03-CONTEXT deferred); remains explicitly unsubscribed in Phase 3
- `packages/core/src/index.ts` deliberately untouched (barrel lands in 03-04, single owner, wave-2)

---

_Phase: 03-core-compilation-injection_
_Completed: 2026-08-10_

## Self-Check: PASSED

- Created files exist on disk: `packages/core/src/theme/theme-cache.ts`, `packages/core/src/theme/theme-cache.test.ts`, `.planning/phases/03-core-compilation-injection/03-02-SUMMARY.md` (verified via Test-Path)
- Commits present: `8fd4153` (test/03-02, RED), `ad7f113` (feat/03-02, GREEN) — verified via `git log`
- `pnpm --filter @mosaix/core exec vitest run src/theme/theme-cache.test.ts` → 9 passed (1 file, 9 tests)
- `pnpm --filter @mosaix/core exec tsc --noEmit` → clean (exit 0)
- `pnpm --filter @mosaix/core build` → builds (exit 0)
- grep gate source (`event-bus|theme.changed|subscribe` on theme-cache.ts) → 0 matches
- grep gate test (`subscribe|theme.changed|event-bus` on theme-cache.test.ts) → 0 matches
- grep gate no-`"space"` literal in test file → 0 matches
- `packages/core/src/index.ts` untouched (barrel lands in 03-04); `theme-injector.ts` pre-existing untracked file left alone
