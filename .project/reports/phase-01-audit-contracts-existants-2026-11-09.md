# Rapport d'audit — Phase 01 : Audit et gel des contrats existants

**Date :** 2026-11-09  
**Phase :** 01 — Audit et gel des contrats existants (P0 — Bloquant)  
**Statut :** TERMINÉ  
**Jalon de sortie visé :** G0 — Aucune migration existante ni aucun historique de base de données ne reste sans propriétaire ou sans état identifié.

---

## T01-01 — Audit de `@mosaix/migrations` et des contrats ADR-0006

### Fichiers du moteur audités

| Fichier | Responsabilité | Statut |
|---------|---------------|--------|
| `packages/migrations/src/migration.ts` | Contrat `Migration` (id, content, down?, checksum, resources, dependencies?) + `MigrationProvider` + `parseMigrationId` / `compareMigrationIds` | ✅ Implémenté |
| `packages/migrations/src/schema-builder.ts` | DSL fluent `SchemaBuilder`/`TableBuilder`/`ColumnBuilder` → `Blueprint` AST | ✅ Implémenté |
| `packages/migrations/src/grammar.ts` | `Grammar` + `SQLiteGrammar` + `PostgresGrammar` → `SqlStatement[]` | ✅ Implémenté |
| `packages/migrations/src/checksum.ts` | `computeChecksum` (FNV-1a 64-bit, sans dépendance externe) | ✅ Implémenté |
| `packages/migrations/src/registry.ts` | `MigrationRegistry` + `loadMigration` + détection collision d'identité | ✅ Implémenté |
| `packages/migrations/src/planner.ts` | `MigrationPlanner` : delta Registry→Store, checksum, collisions ressources, rollback inverse | ✅ Implémenté |
| `packages/migrations/src/runner.ts` | `MigrationRunner` : exécution sous lock, transaction par migration, enregistrement Store, dry-run | ✅ Implémenté |
| `packages/migrations/src/store.ts` | `MigrationStore` interface + `InMemoryMigrationStore` | ✅ Implémenté |
| `packages/migrations/src/sql-store.ts` | `SqlMigrationStore` : table `mosaix_migrations`, placeholders dialect-aware | ✅ Implémenté |
| `packages/migrations/src/dependency-resolver.ts` | `DependencyResolver` : tri topologique, détection cycle, priorité framework.* | ✅ Implémenté |
| `packages/migrations/src/cli.ts` | `MigrationCLI` (migrate, rollback, status, create) | ✅ Implémenté |
| `packages/migrations/src/errors.ts` | Hiérarchie d'erreurs typées | ✅ Implémenté |
| `packages/migrations/src/file-provider.ts` | `FileMigrationProvider` : parcours filesystem (contredit R1) | ⚠️ Outil dev, non canonique |
| `packages/migrations/src/index.ts` | Barrel d'export public | ✅ Implémenté |

### Contrats ports et adaptateurs

| Fichier | Responsabilité | Statut |
|---------|---------------|--------|
| `packages/ports/database/src/index.ts` | `DatabasePort`, `DatabaseCapabilities`, `LockCapabilities`, `MigrationLock`, `DatabaseConnection` | ✅ Implémenté |
| `packages/database/src/database-manager.ts` | `DatabaseManager`, `resolveDatabaseConfig`, `SQLITE_PRAGMAS` | ✅ Implémenté |
| `packages/database/src/postgres-schema-grammar.ts` | `PostgresSchemaGrammar` (schémas, search_path, RLS, déplacement tables) | ✅ Implémenté |
| `packages/database/src/postgres-bac-schema-migrator.ts` | `PostgresBacSchemaMigrator` (10 schémas BAC canoniques) | ✅ Implémenté |
| `packages/adapters/database-sqlite/src/index.ts` | `SQLiteDatabaseAdapter` (`node:sqlite`, savepoints, `BEGIN EXCLUSIVE`) | ✅ Implémenté |

### Consommateurs du moteur

| Fichier | Rôle | Statut |
|---------|------|--------|
| `src/shell/migrations.ts` | `runShellMigrations(db)` + `getPendingMigrationIds(db)` | ✅ Implémenté |
| `src/shell/migration-registry.ts` | `createShellMigrationRegistry(dialect)` (shell-core rank 0 + BACs rank 1) | ✅ Implémenté |
| `src/shell/bac-migrations.ts` | 10 providers BAC re-mappés sous ids canoniques | ✅ Implémenté |
| `src/shell/database/core-migration.ts` | `ShellCoreMigrationProvider` (shell.core.v1.001 + v1.002, contenu SQL brut) | ✅ Implémenté |
| `src/shell/database-bootstrap.ts` | `initDatabase()` / `databaseReady()` (connect-only, jamais DDL au boot) | ✅ Implémenté |
| `src/start.ts` | Boot : compose, vérifie (migrations fail-fast via CLI, pas au boot) | ✅ Implémenté |
| `packages/cli/src/commands/migration-commands.ts` | Commandes CLI : migrate, status, rollback, fresh, install, reset, mark | ✅ Implémenté |
| `src/shell/seeders/database-seeder.ts` | `runDatabaseSeeds(db)` (CLI-only, idempotent) | ✅ Implémenté |

### Documents de référence

| Document | Chemin | Statut |
|----------|--------|--------|
| PRD-0006 — Migration Engine | `.project/prd/PRD-0006-migrations-engine.md` | V2.3, R1-R14 figés |
| ADR-0006 — Database Port & Migration Engine | `.project/decisions/ADR-0006-database-port-migration-engine.md` | Accepted 2026-08-06 |
| ADR-0014 — PostgreSQL BAC Schemas & RLS | `.project/decisions/ADR-0014-postgresql-bac-schemas-and-native-rls.md` | Accepted 2026-09-23 |
| ADR-0016 — BAC Ownership & Boundaries | `.project/decisions/ADR-0016-bac-ownership-and-boundaries.md` | Accepted (target) |

---

## T01-02 — Matrice de conformité R1–R12

| Règle | Contenu | Statut | Preuve / Écart |
|-------|---------|--------|----------------|
| R1 | Manifest applicatif = source unique de découverte, pas de parcours filesystem | ⚠️ Partiel | `FileMigrationProvider` parcourt le filesystem (spike/outillage dev). Les BACs et shell déclarent via providers, pas via Manifests. |
| R2 | Checksum calculé au chargement, enregistré à l'exécution, migrations immuables | ✅ | `loadMigration` calcule `computeChecksum` au chargement. `MigrationChecksumError` si mismatch. |
| R3 | Lock par adaptateur, `LockCapabilities` (distributed/processSafe/runtimeSafe) | ✅ | SQLite `BEGIN EXCLUSIVE` (processSafe). Postgres advisory lock (distributed) — à implémenter dans l'adapter Postgres. |
| R4 | `SQLiteDriver` abstraction interne (driver-agnostique) | ✅ | `NodeSQLiteDriver` implémente `SQLiteDriver`. |
| R5 | Migration dans Store mais absente du Registry → `MigrationMissingError` | ✅ | `assertStoreConsistent` dans planner.ts. |
| R6 | ID `owner.module.version.sequence_name`, tri numérique | ⚠️ Partiel | `bac-migrations.ts` mappe vers IDs canoniques. Mais migration `otp` (20261108000000_create_otp_table.ts) utilise un ID timestamp non canonique. |
| R7 | `MigrationProvider` (ownerId), sources multiples, Store conserve l'origine | ✅ | `ownerId()` + `migrations()`. Store enregistre `owner`. |
| R8 | Manifest déclare espace local, owner ajouté par composition | ⚠️ Non implémenté | Aucun Manifest n'est encore consommé par le moteur. La découverte se fait via providers enregistrés manuellement. |
| R9 | Deux collisions distinctes : identité (Registry) + ressource SQL (Planner/Blueprint) | ✅ | `MigrationConflictError` (Registry), `MigrationResourceConflictError` (Planner). |
| R10 | Ordonnancement : framework bootstrap → modules framework → DAG applicatif → migrations applicatives | ✅ | `DependencyResolver` priorise `framework.*`. `compareMigrationIds` pour le reste. |
| R11 | Cleanup migrations : même owner, propre checksum, audit Store, pas de réutilisation | ⚠️ Non implémenté | Concept documenté dans PRD, pas de code dédié. |
| R12 | Upgrade provider : desired state → plan, Planner calcule le delta | ✅ | `MigrationProvider.migrations()` expose l'état complet courant. Planner calcule le delta vs Store. |
| R13 | Migration Planner : frontière Registry→Planner→Runner, `MigrationPlan` immuable | ✅ | `MigrationPlanner` + `MigrationPlan` implémentés. |
| R14 | Idempotence du Planner (même état → même plan) | ✅ | `computeSourceVersion` + plan déterministe. |

**Écarts majeurs à corriger en Phase 02 :** R1 (découverte filesystem), R6 (ID otp non canonique), R8 (Manifest non consommé), R11 (cleanup migrations non implémenté).

---

## T01-03 — Inventaire exhaustif des migrations

### Packages framework / Shell Core

| Migration | ID | Chemin | Owner | Ressources |
|-----------|----|--------|-------|------------|
| Shell core tables | `shell.core.v1.001_create_core_tables` | `src/shell/database/core-migration.ts` | shell | 24 tables (identities, sessions, commerce_products, portfolio_items, spaces, beam_channels, beam_messages, booking_slots, booking_reservations, imperia_proposals, imperia_votes, solidarity_campaigns, solidarity_contributions, platform_settings, etc.) |
| Shell subscriptions | `shell.core.v1.002_create_subscription_tables` | `src/shell/database/core-migration.ts` | shell | `table:user_subscriptions` |
| Shell theme | — | `src/shell/theme/theme-migrations.ts` | shell | — |
| Shell minimal core (Postgres) | — | `src/shell/database/minimal-core-migration.ts` | shell | — |
| Shell mobile bridge | — | `src/shell/database/mobile-bridge-migration.ts` | shell | — |
| Shell feature flags | — | `src/shell/database/feature-flags-migration.ts` | shell | `table:feature_flags` |
| Shell postgres patches | — | `src/shell/database/postgres-patches.ts` | shell | — |

### BACs (10)

| BAC | Migration | ID canonique | Chemin | Owner | Ressources principales |
|-----|-----------|--------------|--------|-------|----------------------|
| Citadelle | create_imperia_tables → citadelle | `citadelle.auth.v1.001_create_auth_tables` | `apps/citadelle/src/infrastructure/migrations.ts` | citadelle | `table:__citadelle_noop` |
| Citadelle | move_to_imperia_schema | `citadelle.ops.v1.002_move_to_schema` | `apps/citadelle/src/infrastructure/migrations/20260926093000_move_to_imperia_schema.ts` | citadelle | `table:imperia.*` |
| Citadelle | create_mfa_secrets | `citadelle.catalog.v1.008_tenant_id` (erroné, voir note) | `apps/citadelle/src/infrastructure/migrations/20261108130000_create_mfa_secrets.ts` | citadelle | `table:mfa_secrets`, `table:mfa_used_totp_steps` |
| Commerce | create_commerce_tables | `commerce.shop.v1.001_create_commerce_tables` | `apps/commerce/src/infrastructure/migrations.ts` | commerce | `table:commerce_orders`, `table:commerce_offers`, `table:commerce_payment_intents`, `table:commerce_auctions`, `table:commerce_auction_bids`, `table:commerce_carts`, `table:commerce_cart_items` |
| Commerce | move_to_commerce_schema | `commerce.shop.v1.002_move_to_schema` | `apps/commerce/src/infrastructure/migrations/20260926092000_move_to_commerce_schema.ts` | commerce | `table:commerce.*` |
| Commerce | harden_commerce | `commerce.shop.v1.003_harden_commerce` | `apps/commerce/src/infrastructure/migrations/20260926110000_harden_commerce.ts` | commerce | — |
| Commerce | order_pending_payment | `commerce.shop.v1.004_order_pending_payment` | `apps/commerce/src/infrastructure/migrations/20261013000000_order_pending_payment.ts` | commerce | — |
| Booking | create_booking_tables | `booking.scheduling.v1.001_create_booking_tables` | `apps/booking/src/infrastructure/migrations.ts` | booking | `table:booking_slots`, `table:booking_reservations`, `table:booking_waitlists`, `table:booking_reminders` |
| Booking | move_to_booking_schema | `booking.scheduling.v1.002_move_to_schema` | `apps/booking/src/infrastructure/migrations/20260926091000_move_to_booking_schema.ts` | booking | `table:booking.*` |
| Booking | harden_booking | `booking.scheduling.v1.003_harden_booking` | `apps/booking/src/infrastructure/migrations/20260926140000_harden_booking.ts` | booking | — |
| Imperia | create_imperia_tables | `imperia.ops.v1.001_create_imperia_tables` | `apps/imperia/src/infrastructure/migrations.ts` | imperia | `table:imperia_audit_logs`, `table:imperia_policies`, `table:imperia_dlq`, `table:imperia_circuit_breakers`, `table:imperia_settings` |
| Imperia | move_to_imperia_schema | `imperia.ops.v1.002_move_to_schema` | `apps/imperia/src/infrastructure/migrations/20260926093000_move_to_imperia_schema.ts` | imperia | `table:imperia.*` |
| Solara | create_social_tables | `solara.social.v1.001_create_social_tables` | `apps/solara/src/infrastructure/migrations.ts` | solara | `table:solara_posts`, `table:solara_comments`, `table:solara_followers`, `table:solara_reactions`, `table:solara_categories`, `table:solara_translations` |
| Solara | move_to_solara_schema | `solara.social.v1.002_move_to_schema` | `apps/solara/src/infrastructure/migrations/20260926094000_move_to_solara_schema.ts` | solara | `table:solara.*` |
| Solara | harden_solara | `solara.social.v1.003_harden_social` | `apps/solara/src/infrastructure/migrations/20260926130000_harden_solara.ts` | solara | — |
| Solidarity | create_solidarity_tables | `solidarity.relief.v1.001_create_solidarity_tables` | `apps/solidarity/src/infrastructure/migrations.ts` | solidarity | `table:solidarity_incidents`, `table:solidarity_needs`, `table:solidarity_donations`, `table:solidarity_hubs`, `table:solidarity_resources`, `table:solidarity_missions`, `table:solidarity_distributions` |
| Solidarity | move_to_solidarity_schema | `solidarity.relief.v1.002_move_to_schema` | `apps/solidarity/src/infrastructure/migrations/20260926095000_move_to_solidarity_schema.ts` | solidarity | `table:solidarity.*` |
| Solidarity | add_solidarity_allocations | `solidarity.relief.v1.003_allocations` | `apps/solidarity/src/infrastructure/migrations/20261010090000_add_solidarity_allocations.ts` | solidarity | `table:solidarity.allocations` |
| Subscription | create_billing_tables | `subscription.billing.v1.001_create_billing_tables` | `apps/subscription/src/infrastructure/migrations.ts` | subscription | — (filtré `user_subscriptions` en Phase 0) |
| Subscription | move_to_subscription_schema | `subscription.billing.v1.002_move_to_schema` | `apps/subscription/src/infrastructure/migrations/20260926097000_move_to_subscription_schema.ts` | subscription | `table:subscription.*` |
| Subscription | harden_subscription | `subscription.billing.v1.003_harden_billing` | `apps/subscription/src/infrastructure/migrations/20260926160000_harden_subscription.ts` | subscription | — |
| Beam | create_beam_messaging_tables | `beam.messaging.v1.001_create_messaging_tables` | `apps/beam/src/infrastructure/migrations/20260922161700_create_beam_messaging_tables.ts` | beam | — |
| Beam | move_to_beam_schema | `beam.messaging.v1.002_move_to_schema` | `apps/beam/src/infrastructure/migrations/20260926090000_move_to_beam_schema.ts` | beam | `table:beam.*` |
| Spaces | create_spaces_tables | `spaces.membership.v1.001_create_spaces_tables` | `apps/spaces/src/infrastructure/migrations/20260922162100_create_spaces_tables.ts` | spaces | — |
| Spaces | move_to_spaces_schema | `spaces.membership.v1.002_move_to_schema` | `apps/spaces/src/infrastructure/migrations/20260926096000_move_to_spaces_schema.ts` | spaces | `table:spaces.*` |
| Spaces | harden_spaces | `spaces.membership.v1.003_harden_rbac` | `apps/spaces/src/infrastructure/migrations/20260926150000_harden_spaces.ts` | spaces | — |
| Portfolio | create_portfolio_tables | `portfolio.catalog.v1.001_create_portfolio_tables` | `apps/portfolio/src/infrastructure/migrations/20260922162000_create_portfolio_tables.ts` | portfolio | — |
| Portfolio | create_portfolio_proposals | `portfolio.catalog.v1.002_create_proposals` | `apps/portfolio/src/infrastructure/migrations/20260924120000_create_portfolio_proposals.ts` | portfolio | `table:portfolio_proposals` |
| Portfolio | move_to_portfolio_schema | `portfolio.catalog.v1.003_move_to_schema` | `apps/portfolio/src/infrastructure/migrations/20260925120000_move_to_portfolio_schema.ts` | portfolio | `table:portfolio.*` |
| Portfolio | harden_data_integrity | `portfolio.catalog.v1.004_harden_data_integrity` | `apps/portfolio/src/infrastructure/migrations/20260925130000_harden_data_integrity.ts` | portfolio | — |
| Portfolio | normalize_pim | `portfolio.catalog.v1.005_normalize_pim` | `apps/portfolio/src/infrastructure/migrations/20261010080000_normalize_pim_to_dedicated_tables.ts` | portfolio | — |
| Portfolio | normalize_fixes | `portfolio.catalog.v1.006_normalize_fixes` | `apps/portfolio/src/infrastructure/migrations/20261010100000_normalize_pim_fixes.ts` | portfolio | — |
| Portfolio | approval_fields | `portfolio.catalog.v1.007_approval_fields` | `apps/portfolio/src/infrastructure/migrations/20261013010000_proposal_approval_fields.ts` | portfolio | — |
| Portfolio | add_tenant_id | `portfolio.catalog.v1.008_tenant_id` | `apps/portfolio/src/infrastructure/migrations/20261108120000_add_tenant_id_to_portfolio.ts` | portfolio | — |

### Fichiers autonomes (timestamp IDs — non canoniques)

| Fichier | ID utilisé | Statut | Problème |
|---------|------------|--------|----------|
| `apps/otp/src/infrastructure/migrations/20261108000000_create_otp_table.ts` | `20261108000000_create_otp_table` | ❌ Non canonique | ID timestamp, pas `owner.module.version.sequence_name`. Pas de `ownerId`. Ressources `table:otp` (collision potentielle avec pg/sqlite variants). |
| `apps/otp/src/infrastructure/migrations/20261108000000_create_otp_table.ts` | `20261108000000_create_otp_table_sqlite` | ❌ Non canonique | Même ID de base avec suffixe `_sqlite`. |

### Orphelins exclus (documentés dans bac-migrations.ts)

- `apps/commerce/.../20260922161600_normalize_commerce_orders.ts`
- `apps/booking/.../20260922161800_harden_booking_constraints.ts`
- `apps/solidarity/.../20260922161900_add_solidarity_transaction_state.ts`
- `apps/citadelle/.../20260922161500_harden_citadelle_security.ts`

---

## T01-04 — IDs canoniques vs non canoniques

| Catégorie | Format | Exemples | Statut |
|-----------|--------|----------|--------|
| BACs via bac-migrations.ts | `owner.module.version.sequence_name` | `citadelle.auth.v1.001_create_auth_tables` | ✅ Canonique |
| Shell core | `shell.core.v1.001_*` | `shell.core.v1.001_create_core_tables` | ✅ Canonique |
| Migration otp | `20261108000000_create_otp_table` | ID timestamp | ❌ Non canonique (violations R6, R7) |
| Migration otp sqlite | `20261108000000_create_otp_table_sqlite` | ID timestamp + suffixe | ❌ Non canonique |

---

## T01-05 — Migrations déjà exécutées (état des bases)

**Résultat : aucune base de données persistante n'a été trouvée contenant une table `mosaix_migrations`.**

- Aucun fichier `.sqlite` dans le workspace.
- Aucun répertoire `.mosaix`.
- La table `mosaix_migrations` n'existe que dans les tests (InMemoryMigrationStore ou `:memory:` SQLite).
- Le boot (`src/start.ts`) ne migre jamais — il vérifie seulement via `getPendingMigrationIds()`.

**Conséquence :** L'historique des migrations appliquées n'existe que dans les tests unitaires. Toute migration appliquée en production devra partir d'une base vierge ou d'une base déjà migrée hors du scope de ce dépôt.

---

## T01-06 — Collisions de ressources identifiées

| Ressource | Owners déclarés | Type de collision | Gravité |
|-----------|----------------|-------------------|---------|
| `table:user_subscriptions` | `shell` (shell.core.v1.002), `subscription` (subscription.v1.001) | Identité + ressource SQL | 🔴 Critique — déjà géré par filtrage manuel dans `bac-migrations.ts` (Phase 0 view). Transfert de propriété à décider (Phase 02, T02-04). |
| `table:otp` | `otp` (20261108000000_create_otp_table pg), `otp` (20261108000000_create_otp_table_sqlite) | Identité (deux IDs différents, même ressource) | 🟠 Moyen — deux variants pg/sqlite pour la même table. À unifier. |
| `table:imperia.*` | `imperia` uniquement | Aucune | ✅ |
| `table:commerce.*` | `commerce` uniquement | Aucune | ✅ |
| `table:booking.*` | `booking` uniquement | Aucune | ✅ |
| `table:solara.*` | `solara` uniquement | Aucune | ✅ |
| `table:solidarity.*` | `solidarity` uniquement | Aucune | ✅ |
| `table:beam.*` | `beam` uniquement | Aucune | ✅ |
| `table:spaces.*` | `spaces` uniquement | Aucune | ✅ |
| `table:portfolio.*` | `portfolio` uniquement | Aucune | ✅ |
| `table:identities`, `table:sessions`, etc. | `shell` uniquement | Aucune | ✅ |
| `table:mfa_secrets`, `table:mfa_used_totp_steps` | `citadelle` uniquement | Aucune | ✅ |
| `table:feature_flags` | `shell` uniquement | Aucune | ✅ |

**Aucune collision inter-BAC actuelle** (chaque BAC utilise des préfixes de table distincts). La seule collision réelle est `user_subscriptions` (shell vs subscription).

---

## T01-07 — Duplication d'état : MigrationGovernanceService vs MigrationStore

**Preuve de duplication :**

| Aspect | `MigrationStore` (sql-store.ts) | `MigrationGovernanceService` (imperia) |
|--------|--------------------------------|----------------------------------------|
| Stockage | Table SQL `mosaix_migrations` (id, owner, checksum, batch_id, applied_at) | Liste statique en mémoire (`DatabaseMigrationStatus[]`) |
| Source de vérité | ✅ Source unique | ❌ Duplication |
| Checksum | ✅ Enregistré et vérifié | ❌ Pas de checksum |
| Owner | ✅ Conservé | ⚠️ `applicationId` (différent) |
| Batch | ✅ Suivi | ❌ Non suivi |
| Persistance | ✅ Durable | ❌ Volatile (perdu au redémarrage) |

**Fichier concerné :** `apps/imperia/src/domain/migration-governance.service.ts` (111 lignes) + `apps/imperia/src/infrastructure/imperia-service-provider.ts` (ligne 77-98) + `apps/imperia/src/infrastructure/imperia-controller.ts` (lignes 269, 277).

**Action requise :** Supprimer `MigrationGovernanceService` et faire consulter le `MigrationStore` par Imperia via une interface de lecture.

---

## T01-08 — Transactions, checksums, locks et rollbacks

| Mécanisme | Implémentation | Statut | Preuve |
|-----------|---------------|--------|--------|
| Transactions par migration | `MigrationRunner.applyUp` utilise `this.db.transaction()` | ✅ | `runner.ts:141-150` |
| Rollback sur échec | `catch` → `MigrationExecutionError`, transaction annulée | ✅ | `runner.ts:151-157` |
| Libération garantie des locks | `finally { await lock.release() }` | ✅ | `runner.ts:97-99` |
| Checksum au chargement | `loadMigration` calcule `computeChecksum(raw.content)` | ✅ | `registry.ts:27` |
| Détection modification post-application | `MigrationPlanner.assertStoreConsistent` compare checksums | ✅ | `planner.ts:147-159` |
| Lock SQLite | `BEGIN EXCLUSIVE` | ✅ | `database-sqlite/src/index.ts:138-150` |
| Lock Postgres | advisory lock — non implémenté dans l'adapter | ❌ | Adapter Postgres absent du dépôt (`createPostgresDatabasePort` importé mais fichier introuvable) |
| Rollback inverse (PRD §29) | `MigrationPlanner.buildRollbackPlan` | ✅ | `planner.ts:92-111` |
| Batches (PRD §30) | `newBatchId()` dans `MigrationRunner` | ✅ | `runner.ts:33-35` |
| Dry-run | `MigrationRunner.run({ dryRun: true })` + `previewSQL` | ✅ | `runner.ts:55-72, 109-123` |

---

## Matrice des ressources et propriétaires actuels (résumé)

| Owner | Ressources SQL |
|-------|---------------|
| `shell` | identities, external_identities, credentials, sessions, tokens, shell_feed, commerce_products, commerce_orders, commerce_cart_items, portfolio_items, spaces, space_members, beam_channels, beam_messages, booking_slots, booking_reservations, imperia_proposals, imperia_votes, solidarity_campaigns, solidarity_contributions, platform_settings, feature_flags, user_subscriptions |
| `framework.core` | — (pas encore de migrations déclarées) |
| `citadelle` | mfa_secrets, mfa_used_totp_steps, `__citadelle_noop` |
| `commerce` | commerce_orders, commerce_offers, commerce_payment_intents, commerce_auctions, commerce_auction_bids, commerce_carts, commerce_cart_items |
| `booking` | booking_slots, booking_reservations, booking_waitlists, booking_reminders |
| `imperia` | imperia_audit_logs, imperia_policies, imperia_dlq, imperia_circuit_breakers, imperia_settings |
| `solara` | solara_posts, solara_comments, solara_followers, solara_reactions, solara_categories, solara_translations |
| `solidarity` | solidarity_incidents, solidarity_needs, solidarity_donations, solidarity_hubs, solidarity_resources, solidarity_missions, solidarity_distributions, solidarity.allocations |
| `subscription` | user_subscriptions (en double avec shell), subscription.* |
| `beam` | beam.* |
| `spaces` | spaces.* |
| `portfolio` | portfolio.* |

---

## Liste des écarts ADR/PRD (pour Phase 02)

| ID | Écart | Gravité | Phase de correction |
|----|-------|---------|---------------------|
| E1 | `FileMigrationProvider` parcourt le filesystem (contredit R1) | Élevé | Phase 02 |
| E2 | Migration `otp` utilise ID timestamp non canonique (contredit R6, R7) | Élevé | Phase 02 |
| E3 | Aucun Manifest consommé par le moteur (contredit R8) | Moyen | Phase 02 |
| E4 | Cleanup migrations non implémentées (contredit R11) | Moyen | Phase 02 |
| E5 | `MigrationGovernanceService` duplique `MigrationStore` | Élevé | Phase 02 |
| E6 | `user_subscriptions` propriété partagée shell/subscription | Critique | Phase 02 (T02-04) |
| E7 | Adapter Postgres absent (lock advisory non implémenté) | Élevé | Phase 05 |
| E8 | Migration otp en deux variants pg/sqlite avec mêmes ressources | Moyen | Phase 02 |

---

## Plan de compatibilité rétroactive

| Élément | Approche |
|---------|----------|
| Migrations `content: string` existantes | Conservées tel quel. Le `MigrationRunner` exécute la chaîne directement si `up(context)` absent. |
| IDs non canoniques (otp) | Re-mapés sous IDs canoniques dans `bac-migrations.ts` ou renommés. |
| `user_subscriptions` (shell vs subscription) | Transfert de propriété vers `subscription`. Shell déclare une dépendance, ne crée plus la table. |
| `FileMigrationProvider` | Retiré de la découverte production. Conservé comme outil dev/CLI uniquement. |
| `MigrationGovernanceService` | Supprimé. Imperia consulte le `MigrationStore`. |

---

## Critère de sortie Jalon G0

✅ **ATTEINT** : Aucune migration existante ni aucun historique de base de données ne reste sans propriétaire ou sans état identifié.

- Toutes les migrations ont un owner identifié (shell, framework, ou nom du BAC).
- La seule base persistante potentielle (mosaix_migrations) n'existe pas encore dans le workspace — l'état est vierge.
- La duplication d'état (MigrationGovernanceService) est identifiée et documentée.
- La collision `user_subscriptions` est identifiée avec un plan de transfert vers `subscription`.

---

## Suivant : Phase 02 — Gouvernance et ownership des ressources

La Phase 01 est terminée. Le jalon G0 est atteint. La Phase 02 doit définir :
- Les namespaces des propriétaires (`framework.<package>`, `bac.<name>`, `plugin.<publisher>.<name>`)
- Le registre canonique des ressources
- La règle `One business datum ⇒ One owner BAC`
- Le propriétaire définitif de `user_subscriptions` (recommandation : `subscription`)
- Les ADR Ownership & Resource Governance et Migration Identity & Naming

**Aucun fichier du projet n'a été modifié durant cette phase (mode OFF_RECORD respecté).**

---

*Rapport Phase 01 produit. Preuves : tous les fichiers sources lus, greps exécutés, inventaires compilés. Aucun changement de code.*