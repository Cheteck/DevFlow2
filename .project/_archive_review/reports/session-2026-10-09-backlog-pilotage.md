# Session 2026-10-09 — Backlog → système de pilotage livraison

## Objectif
Transformer le backlog monolithique en pilotage release (sans perte historique), selon les 6 étapes proposées.

## Travaux réalisés
- Snapshot legacy : `.project/archive/active-backlog-2026-10-09-legacy.md` (70 281 o, identique à l'original).
- Nouveau `.project/backlog/BACKLOG.md` : registre 5 P0 · 6 P1 · 9 P2, format minimal (statut/priorité/domaine/dépendances/risque/objectif/critères/preuves/prochaine action), horizons 1/2/3, registre DONE + doublons résolus.
- Nouveau `.project/backlog/RELEASE-READINESS.md` : gate prod (auth, MCP, PG, frontières, E2E).
- `active-backlog.md` gelé (bandeau LEGACY, plus de tâches ici).
- `dashboard.md` §3 repointé vers le nouveau pilotage (fini les compteurs manuels `13/17`, `27 dont 15`).
- Réconciliation code (branch `backlog-tasks-completion-16894022842581055701`, `7c7fcde`+`980262b` = VERIFY) :
  - AUTH-01/02/04/06 existent (`bootstrap/auth-composition.ts`, `postgres-session-store-adapter.ts`, `session-resolver.ts`, `auth-routes.ts`) mais E2E PG + guard secrets manquants → VERIFY P0.
  - MCP-01/02/04/05 DONE ; MCP-03 Bearer encore simulé (`principal-resolver.ts:27`) → OPEN P0 `MCP-03c`.
  - `AuctionService:72` toujours `Map` malgré tables `commerce.auctions` → OPEN P0 `AUCTION-PERSIST`.
  - `PgClient` + `createPgPoolClient` existent, câblage `DB_CONNECTION=pgsql` à prouver → VERIFY P0.
  - 10/10 `*-view.ts` existent → VERIFY P1 (E2E manquante). `BOUND-01` garde `FORBIDDEN_OPERATIONAL_KEYS` verte → VERIFY.

## Décisions
- Pas de suppression d'historique : tout le legacy reste lisible en archive.
- PRD-0011 découpé A (P1 vente) / B-C (P2) ; `BOUND-0304` en BLOCKED tant que le périmètre release n'est pas tranché.
- `DATA-07c` en P0→P1 conditionnel à la preuve E2E de `980262b`.

## Validation
- Fichiers présents : `BACKLOG.md` (12 183 o), `RELEASE-READINESS.md`, snapshot archive OK.
- Aucun code métier modifié ; docs seules → pas de tests à relancer. Prochaine validation : E2E PG (AUTH/DB/AUCTION/MCP-03c).

## Risques / prochaines actions
- Risque : commits AUTH/DATA-07 sur branche non mergée passent pour DONE → gardés en VERIFY.
- Next : 1. `db:setup` PG locale (log joint) → 2. E2E AUTH restart/révocation + guard secrets → 3. MCP-03c Bearer → 4. AUCTION-PERSIST → 5. BOUND-02 → 6. VIEW-E2E-A/B.

## Git State
- Branche active : `backlog-tasks-completion-16894022842581055701`
- Commit avant : `980262b` (session démarrée dessus, non mergé)
- Commit après : (aucun — fichiers pilotage non commités, à reviewer)
- Fichiers : `BACKLOG.md` + `RELEASE-READINESS.md` (nouveaux), `active-backlog.md` (bandeau), `dashboard.md` (§3), snapshot archive.
- Rollback : supprimer les 2 nouveaux fichiers + `git checkout -- .project/backlog/active-backlog.md .project/dashboard.md` (snapshot archive conservé comme preuve).
