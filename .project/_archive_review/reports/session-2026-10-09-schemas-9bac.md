# Session 2026-10-09 — Isolation par schéma des 9 BAC (60 tables)

## Périmètre exécuté
beam (4), booking (4), commerce (7), imperia (5), solara (6), solidarity (7), spaces (9), subscription (3) + portfolio déjà fait (15). Citadelle : sans objet (aucune table BAC, seul `__citadelle_noop`).

## Migrations v1.002 × 8 (toutes appliquées en dev)
Pattern `portfolio v1.003` : `CREATE SCHEMA` + `SET SCHEMA` + `RENAME` (préfixe débruité), `down` inverse exact, `StaticMigrationProvider` + id canonique après la base du BAC. Échec intermédiaire instructif : `RENAME TO` identique (spaces/subscription, tables sans préfixe) → erreur PG → garde `legacy !== clean` ajoutée (rollback transactionnel propre constaté).
Enregistrements `bac-migrations.ts` + réparation d'un bloc dupliqué rencontré.

## Repos qualifiés (remplacement token exact, forme `"bac"."table"`)
beam (2 fichiers), booking, commerce (orders), imperia (5 tables), solara (4), solidarity (7), spaces (`spaces_spaces` → `spaces.spaces`), subscription (`coupons`, `?` conservés). Métadonnées ORM `tableName` dormantes inchangées (aucune instanciation vérifiée). Test mock beam (`beam-completeness.test.ts`) realigné sur le SQL qualifié.

## Faits d'inventaire notables
- Zéro FK inter-BAC sauf `subscription.*` → shell `public.user_subscriptions` (cross-schéma intacte, vérifiée).
- Doublon `space_members` résolu : version BAC camelCase avait gagné (`IF NOT EXISTS`), legacy snake reste en `public` — plus d'ambiguïté.
- Legacy shell (`portfolio_items`, `commerce_products/orders/cart_items`, `beam_messages` snake, `booking_*` snake, `imperia_proposals/votes`) : restés en `public`, volontairement hors périmètre.
- Toutes les tables BAC vides en dev (0 ligne) : moves sans risque données ; backup schéma pré-migration en Temp.

## Validation
- `migrate` : 8/8 appliquées ; `public` vidé des 45 tables BAC ; 0 FK invalide.
- `migrate:rollback --steps=8` : retour public exact ; re-`migrate` : état final restauré.
- Tests : 21 fichiers / 111 verts (dont beam réparé) ; ESLint propre ; tsc : 0 erreur périmètre.
- Dev server : HTTP 200 après restarts watch ; MCP HTTP 15 outils.
- Docs : notes d'isolation sur `docs/bacs/02,03,04,05,06,07,09,10` (+08 déjà) ; backlog BOUND-01b.

## Git State
- Ajouts : 8 fichiers migration. Modifiés : 8 repos, 1 mock test, `bac-migrations.ts`, 8 docs BAC, backlog.
- Backup schéma en Temp (hors repo). Aucun commit effectué.
