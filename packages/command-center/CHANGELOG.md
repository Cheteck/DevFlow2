# @mosaix/command-center — Changelog

## [0.1.0] — 2026-10-31

### Added
- Package initial extrait de `@mosaix/dev-server/src/command-center/` (ADR-0023).
- 17 modules : `supervisor`, `event-bus`, `process-manager`, `terminal-renderer`,
  `cockpit`, `palette`, `layout`, `diagnostics`, `restart-tracker`,
  `secret-guard`, `env-watcher`, `format`, `theme`, `renderer`,
  `supervisor-types`, plus tests.
- API publique : 15 exports (voir `src/index.ts`).
- Tests : 44 tests superviseur + 7 tests TerminalRenderer (P0 duplication bug).
- Zéro dépendance externe (Node builtins + ANSI maison).

### Changed
- En-têtes JSDoc : `@mosaix/dev-server —` → `@mosaix/command-center —`.
- `scripts/dev.ts` migre vers `import { DevSupervisor } from "@mosaix/command-center"`.

### Deprecated
- Ré-export via `@mosaix/dev-server` (JSDoc `@deprecated v0.2.0`).
- Suppression prévue en v1.0.0.

### Migration
- `pnpm add @mosaix/command-center` (workspace) puis remplacer les imports
  `@mosaix/dev-server` par `@mosaix/command-center` pour les symboles du
  Command Center.