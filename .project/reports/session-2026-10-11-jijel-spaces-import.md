# Session 2026-10-11 — Scrap Jijel (téléphonie) → Spaces DB via MCP Mosaix

## Objectif
Scraper la zone Google Maps Jijel (36.8210144, 5.7634126), priorité magasins de
téléphonie, et les ajouter en base via le MCP Mosaix (ajouter les tools si nécessaire).

## Travaux réalisés
1. **Constat** : les tools Spaces MCP existants étaient des mocks
   (`spaces_search_docs`, `mosaix_create_business_space` — IDs aléatoires, zéro
   persistance). Pattern de référence : provider Portfolio persisté.
2. **Nouveau provider `packages/mcp/src/providers/spaces.ts`** : 4 tools réels
   (`create/read/search/bulk_import`), client BAC injecté, absence honnête sans
   client, permissions alignées manifest, resource `spaces://directory`, prompt
   `spaces_shop_import_brief`.
3. **Wiring** : `mcp-routes.ts` (HTTP, Postgres via contrat public `index.ts` —
   `PostgresSpaceRepository` désormais exporté) + `stdio-server.ts` (in-memory).
   Test `permission-alignment` étendu, nouveau `spaces-tools.test.ts` (4 tests).
4. **`Space.metadata` optionnel** (adresse/tél/geo/note/source) + `hydrate`
   Postgres préservé + slug unicode-safe. Aucune coordonnée inventée.
5. **Scrap** : Google Maps non scrapable directement → Exa Places + pagesmaghreb :
   13 magasins de téléphonie géolocalisés (11 avec GPS, 2 sans — champs omis).
6. **Import** (`scripts/seed-jijel-spaces.ts`) : via `tools/call`
   `spaces_space_bulk_import` sur gateway MCP réelle → Postgres `mosaix_dev`,
   `spaces.spaces`, `tenantId=jijel-dz`, `template=store`.

## Décisions
- Permissions courtes (`spaces:space:create`) plutôt que `:tenant` : alignées sur
  `mosaix.json` + verrou `KNOWN_PERMISSIONS` existant (pas de phantom).
- Pas de table SQLite locale : les migrations BAC sont Postgres-only par design ;
  l'import cible `mosaix_dev` (vérifié : table vide avant, 13 lignes après).
- Overpass OSM écarté (406) — données Exa suffisantes et sourcées.

## Validation
- `vitest run packages/mcp/src apps/spaces/src` : **43/43 verts** (8 fichiers).
- ESLint : propre sur les 10 fichiers touchés (1 erreur corrigée : import
  interne BAC interdit → contrat public `index.ts`).
- Seed : 1er run 13 créés, re-runs `createdCount=0/skippedCount=13` (idempotent).
- DB : `SELECT ... WHERE "tenantId"='jijel-dz'` → 13 slugs.

## Risques / suivis
- Données annuaire (notes/tél 2024-2026) : prévoir réconciliation périodique.
- `COUNT(*)` aliasé échoue via l'adapter PG (`string is not defined`) — bug
  pré-existant hors scope, backlog suggéré.
- Autres catégories Jijel (restaurants, hôtels) : même pipeline, autre `tenant`
  ou `businessCategory`.

## Git State
- Branche active : à vérifier (`git status` : autres modifications pré-existantes
  non touchées).
- Fichiers touchés : `apps/spaces/src/domain/space.model.ts`,
  `apps/spaces/src/infrastructure/postgres-space-repository.ts`,
  `apps/spaces/src/index.ts`, `packages/mcp/src/providers/spaces.ts` (new),
  `packages/mcp/src/spaces-tools.test.ts` (new), `packages/mcp/src/index.ts`,
  `packages/mcp/src/stdio-server.ts`,
  `packages/mcp/src/permission-alignment.test.ts`,
  `src/server/routes/mcp-routes.ts`, `scripts/seed-jijel-spaces.ts` (new),
  `.project/changelog.md`.
- Rollback : `git checkout -- <fichiers>` (DB : `DELETE FROM spaces.spaces
  WHERE "tenantId"='jijel-dz'`). Aucun commit effectué (non demandé).
