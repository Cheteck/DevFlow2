# Session 2026-10-13 (incident) — Boot dev bloqué : `MigrationChecksumError` commerce v1.001

## Symptôme (log utilisateur)

`MigrationChecksumError: Migration "commerce.shop.v1.001_create_commerce_tables" was modified
after being applied` — expected `28c911d68c35eea2`, actual `8a6989f5ec73bd17`.
Boot `src/start.ts` impossible (garde ADR-0006, `planner.ts:153`).

## Diagnostic

- v1.001 est générée en code par `CommercePostgresMigrationProvider`
  (`apps/commerce/src/infrastructure/migrations.ts`), checksum = FNV-1a du SQL compilé.
- `a04e055` (2026-10-13 02:40) a ajouté `"PendingPayment"` à l'enum `status`
  **dans v1.001 déjà appliquée** (ledger : appliquée 2026-09-27) → checksum modifié.
- Le même commit ajoutait correctement `v1.004` (`20261013000000_order_pending_payment.ts`,
  ALTER défensif et idempotent du CHECK) : l'édition en place était inutile.
- Règle violée : migrations appliquées immuables (le message d'erreur lui-même l'exige).

## Décision (GO)

Revert 1 ligne de v1.001 (restaure le contenu appliqué) plutôt que chirurgie du
ledger (`UPDATE mosaix_migrations` : bénit la mutation, viole ADR-0006, à
répéter par environnement). Preuve de justesse AVANT boot : checksum recalculé
via le provider réel = ledger au caractère près.

## Validation

- `verify-commerce-checksum.ts` (temp) : MATCH `28c911d68c35eea2`.
- Boot : garde passée, `MosaiX platform host listening on http://0.0.0.0:3000`
  (premier essai : EADDRINUSE = watcher utilisateur déjà relancé avec le fix).
- Ledger PG : v1.001 `28c911d68c35eea2` intacte, v1.004 appliquée 21:46 UTC ;
  `orders.orders_status_check` live contient `PendingPayment` → schéma convergé.
- `commerce.test.ts` 13/13 verts. Aucun commit créé.

## Résidus (non bloquants, pré-existants)

- `@mosaix/plugin-engine` non résolu (exports `dist/` sans build) → warnings
  fail-soft `bac-wiring`/`mcp-server`. Même famille systémique que CONF-DETTE.
- Backlog : MIG-IMMUT-01 (snapshot checksums en CI, P1) pour empêcher toute
  récidive d'édition en place.

## Git State

- Branche : `feat-plugin-engine-audit-11753157743017484321`, base `5eabadc`.
- Modifié : `apps/commerce/src/infrastructure/migrations.ts` (1 ligne revertée),
  changelog, BACKLOG.md, ce rapport. Scripts de preuve hors repo (temp).
- Rollback : `git checkout -- apps/commerce/src/infrastructure/migrations.ts`
  (restore l'état fautif — ne pas faire sans relire ce rapport).
- Action utilisateur : relancer le watcher dev (`pnpm dev`) — le port :3000 était
  libre en fin de session (serveur de vérification arrêté par timeout).
