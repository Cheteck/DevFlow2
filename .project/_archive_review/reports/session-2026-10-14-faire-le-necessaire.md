# Session 2026-10-14 — « Fais le nécessaire » : 5 rouges → 0, `/metrics`, 990/990

## Périmètre décidé (GO)

Ordre du gate : CLI-MIGRATE-01 (P1) → TEST-RED-01 (P1) → OBS-METRICS-01 (P2).
STOP : AUTH-E2E réel (wiring Citadelle, décision produit), CSP/Tailwind,
CONF-DETTE (chantiers dédiés, humains requis).

## Correctifs (chaque cause prouvée avant le fix)

1. **CLI `database is not open`** — repro minimale (2 commandes enchaînées) :
   même objet adapter resservi par `cachedBootstrap` après `manager.close()`,
   stack `NodeSQLiteDriver.query:49`. Fix : `closeCliDatabase()` (ferme +
   invalide le cache) dans les 8 `finally` (`migration-commands.ts` ×7,
   `seed-commands.ts` ×1). Le seed `[]` avait la même cause (COUNT sur handle
   fermé → catch → skip) : seeder non touché.
2. **FEAT-04** — test sync contre service async : 3 `await` (test seul).
3. **plugin-e2e** — devDep test-only manquante (jamais une dép runtime :
   interdite par l'architecture plugin) + assertion alignée sur le contrat
   réel du moteur (erreurs collectées, `stopOnError: false`).
4. **Suite http** — `TRUNCATE … CASCADE` des tables d'offres dans le clone
   jetable (jamais le dev), en-tête corrigé (clone postgres).
5. **auction-wiring flaky** — timeout 30 s sur le test d'import réel (4,16 s
   isolé, >5 s sous charge) ; passé isolé 3/3 après.
6. **`/metrics`** — `metrics-route.ts` (renderer pur + handler, 4 tests),
   branché dans `api-dispatcher.ts` avant la gate `/api/` ; live 200.

## Validation

- **990/990 (172 fichiers)** : la veille 979/984 + 14 skipped (suite http non bootée) ;
  ce soir 0 échec, 0 skip — dont 4 tests `/metrics` inédits.
- ESLint 0 erreur (4 erreurs api-dispatcher prouvées pré-existantes par stash).
- tsc : 0 erreur nouvelle (1 annotation mienne corrigée, familles inchangées).
- Prettier : fichiers déjà sales à HEAD laissés tels quels (prouvé par stash),
  lignes ajoutées conformes, 2 nouveaux fichiers propres.
- Live : `/metrics` 200 exposition valide ; dev server nominal.

## Décisions / risques

- Seeder `tableCount` catch→skip silencieux : wart connu, laissé (aucun test
  rouge ne l'exige — Minimal Sufficient Change).
- `./ui` dangling dans exports plugin-engine : signalé, non créé.
- Gate prod mis à jour : P1 migrations-CLI et observabilité partiellement
  levés ; restent P0 auth réelle, CSP, CONF-DETTE.

## Git State

- Branche `feat-plugin-engine-audit-11753157743017484321`, base `5eabadc`, rien commité.
- Modifiés : `packages/cli/...` (3), `packages/plugin-engine/package.json` (+devDep),
  `plugin-e2e.test.ts`, `backlog-features…test.ts`, `bac-access.http.test.ts`,
  `auction-wiring.test.ts`, `api-dispatcher.ts`, changelog, BACKLOG (3 tâches → DONE).
- Nouveaux : `metrics-route.ts`, `metrics-route.test.ts`, ce rapport.
- Rollback par fichier (`git checkout -- …`), aucun schéma/DB touché hors clones jetables.
