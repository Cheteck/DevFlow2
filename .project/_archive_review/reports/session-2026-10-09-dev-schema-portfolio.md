# Session 2026-10-09 — Dev server : diagnostic panne + isolation schéma portfolio (v1.003)

## Panne dev server
- Constat 00:08 : aucun processus node — superviseur + plateforme + MCP tous tombés (cause probable : session shell fermée ayant emporté le superviseur ; pas de reprise auto).
- Relance détachée : plateforme `HTTP 200`, MCP fils actif.
- Découverte : **deux générations de superviseurs cohabitaient** (doublons plateforme/MCP, conflits de port) — table rase (kill ciblé des PIDs dev) + **une seule** génération relancée (vérifiée : PIDs uniques, HTTP 200, MCP HTTP 15 outils).
- Fix fuite superviseur : `scripts/dev.ts:startMcpServer()` tuait jamais l'ancien fils MCP au restart → kill préalable ajouté (pris en compte au prochain restart supervisé).

## Isolation par schéma — portfolio (débruité, exécuté)
- Décisions : noms débruités (`portfolio.vendables`, …), pas de `tenant_id`/RLS (catalogue PIM partagé plateforme, N Spaces vendent via offres Commerce).
- 15 tables inventoriées : 14 v1.001 + `portfolio_proposals` v1.002.
- Migration `portfolio.catalog.v1.003_move_to_schema` : `CREATE SCHEMA` + `SET SCHEMA` + `RENAME` (down inverse exact) ; enregistrée dans `bac-migrations.ts`.
- Repos Postgres + strip-script qualifiés (`PORTFOLIO_SCHEMA`, helper dialect-aware pour SQLite) ; archive → `portfolio.commercial_archive`.
- Backup pre-migration `portfolio_backup_20261009.sql` (déplacé vers Temp opencode).
- Validation dev PG : migrate OK (15 tables, 0 en public), 20 FK + 35 index intacts, smoke CRUD OK, **rollback prouvé** (15 de retour en public, anciens noms) puis re-migrate final.
- Tests : 55/55 verts (portfolio, strip, inventory, backlog, e2e, mcp) ; ESLint propre ; tsc : 0 erreur périmètre (TS2835 pré-existants inchangés).
- Docs : `docs/bacs/08-portfolio.md` (noms qualifiés), backlog BOUND-01b.

## Git State
- Branche `backlog-tasks-completion-16894022842581055701`.
- Ajout : migration v1.003. Modifiés : repos, strip(+test), bac-migrations, 08-portfolio.md, backlog, scripts/dev.ts, compose.yml (port 5432, session précédente).
- Backup hors repo (Temp). Aucun commit effectué.
