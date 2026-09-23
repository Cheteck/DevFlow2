# Deferred Items — Phase 03 (core-compilation-injection)

Out-of-scope discoveries logged per executor protocol (scope boundary rule).
These are NOT fixed here — they belong to other plans/waves.

| Item                                                                                                        | Discovered In | Status | Deferred To                                               |
| ----------------------------------------------------------------------------------------------------------- | ------------- | ------ | --------------------------------------------------------- |
| THEME-09 (ThemeCache) still `[ ]`/"Pending" in REQUIREMENTS.md despite plan 03-02 completing it (`ad7f113`) | 03-04         | Open   | Next phase/session — mark complete via requirements track |

## Resolved

- `packages/core/src/theme/theme-compiler.test.ts` was logged on 2026-08-10 during
  03-03 as an intentionally-RED suite (`228aef4`, THEME-08) awaiting its compiler.
  Since then the prior wave implemented the compiler (`2437502`) and the cache
  (`ad7f113`); the full theme suite now passes **8 files / 95 tests** green
  (verified 2026-08-10, including `theme-compiler.test.ts` 9/9 and
  `theme-injector.test.ts` 9/9). Entry resolved — no open deferred items.

## Notes

- The 03-03 focused verification gates (`vitest run src/theme/theme-injector.test.ts`,
  `vitest run src/theme/theme-errors.test.ts`, `tsc --noEmit`, `build`) pass;
  the full theme directory run is also green post-compiler.
