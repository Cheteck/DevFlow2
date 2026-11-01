# @mosaix/command-center — Responsibilities

## Purpose

TUI supervisor for development processes: cockpit multi-panneaux, palette
Ctrl+K, grille adaptative, diagnostics temps réel. Zéro dépendance externe
(ANSI maison, Node builtins uniquement).

## Scope (Port)

- **DevSupervisor** — orchestration du cycle de vie (spawn, readiness, restart,
  shutdown, watch .env). API publique : `start()`, `stop()`, `onEvent()`.
- **EventBus + EventHistory** — bus structuré + historique circulaire borné.
- **ProcessManager** — child process supervisé (readiness honnête, EADDRINUSE,
  signaux).
- **TerminalRenderer + cockpit** — moteur VT single-owner + compositeur
  grille (3/2/1 colonnes, budgets).
- **Palette** — modèle Ctrl+K pur (testable sans terminal).
- **Diagnostics / RestartTracker / SecretGuard / EnvWatcher** — sous-modules
  autonomes, réutilisables.

## Contracts (Interfaces)

- `supervisor-types.ts` — contrats partagés (DevSupervisorOptions, ProcessSpec,
  ProcessState, ReadinessSignal, SupervisorEvent).
- Tous les exports sont purs TypeScript (pas de side-effects à l'import).

## Non-Goals (Hors périmètre)

- Lanceur HTTP / HMR → `@mosaix/dev-server` (séparé).
- Gestion de sessions persistantes → futur `@mosaix/dev-session`.
- Infrastructure BAC / Kernel / Capabilities → packages framework.

## Allowed Dependencies

- **Internal** : imports relatifs uniquement (`./event-bus`, `./process-manager`).
- **External** : **aucun** (Node builtins : `node:child_process`, `node:events`,
  `node:fs`, `node:path`, `node:util`, `node:os`).
- **Workspace** : **interdit** d'importer `@mosaix/dev-server`,
  `@mosaix/dev-session`, ou tout autre package MosaiX (couplage descendant
  bloqué par `eslint-plugin-boundaries`).

## Versioning

- `0.1.x` — initial, dual-write via `@mosaix/dev-server` (déprécié v0.2.0).
- `1.0.0` — suppression re-export déprécié, API stable.

## Testing

- `command-center.test.ts` — 44 tests (superviseur, cycle de vie, palette,
  restart, diagnostics).
- `terminal-renderer.test.ts` — 7 tests (moteur VT, duplication bug P0).
- Couverture : 100 % des exports publics.

## Migration Notes (ADR-0023)

- Extrait de `@mosaix/dev-server/src/command-center/` (17 fichiers déplacés,
  pas copiés).
- `dev-server` ré-exporte pour compatibilité (JSDoc `@deprecated v0.2.0`).
- Seul consommateur : `scripts/dev.ts` (import direct `@mosaix/command-center`).