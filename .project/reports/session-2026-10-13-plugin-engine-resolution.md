# Session 2026-10-13 (incident boot) — `@mosaix/plugin-engine` non résolu

## Symptômes (log utilisateur, 1 cause)

- `[bac-wiring] commerce descriptor not wired (static fallback)` +
  `ERR_MODULE_NOT_FOUND Cannot find package '@mosaix/plugin-engine'`
  (depuis `src/shell/plugin-engine-bootstrap.ts`).
- `[mcp-server] commerce tools unwired` — même chaîne causale (bootstrap partagé).
- Serveur servait quand même (fail-soft), mais commerce sur fallback statique
  et outils MCP commerce non câblés.

## Diagnostic

1. Pas de lien `node_modules/@mosaix/plugin-engine` : la racine `package.json`
   ne déclarait pas la dép (vitest masquait le problème via son alias → `src/`).
2. `exports` du paquet → uniquement `dist/`, jamais buildé (et `tsc --build`
   du paquet est rouge pré-existant : pas de build possible sans chantier).

## Décision (GO)

Miroir de la convention `@mosaix/core` (exports → `src/`, pas de build) :
exports `.`/`./core`/`./runtime`/`./management` → `src/` ; `+ workspace:*`
en racine ; `pnpm install`. `./ui` laissé intact (sans pendant `src/`, aucun
importeur — dette signalée, pas créée). Pas de commit (non demandé).

## Validation

- Boot tsx : log sans `ERR_MODULE_NOT_FOUND`/`not wired`/`unwired`, listening :3000.
- Live (watcher, avec fix) : `/` `/commerce` `/login` 200,
  `/__mosaix` running (11 BACs dont commerce), head servi = correctifs SSR.
- `plugin-engine/src/index.test.ts` 17/17. `pnpm-lock.yaml` +3 lignes
  (attendu : nouvelle dép racine).

## Résidus

- `/health` anonyme rend la page login (garde auth) : pas de health
  machine-readable sans session — à trancher (endpoint public vs gardé).
- `./ui` dangling dans les exports ; tsc global toujours rouge (CONF-DETTE).

## Git State

- Branche `feat-plugin-engine-audit-11753157743017484321`, base `5eabadc`, rien commité.
- Modifié : `packages/plugin-engine/package.json` (exports),
  `package.json` (+1 dép), `pnpm-lock.yaml` (+3), changelog, ce rapport.
- Rollback : `git checkout -- package.json packages/plugin-engine/package.json pnpm-lock.yaml`
  (+ `pnpm install` pour retirer le lien).
