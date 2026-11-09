# Audit d'architecture — Système de migrations MosaiX vers TypeScript natif

**Date :** 2026-11-09  
**Mode :** OFF_RECORD — ADMIN — Investigation et proposition d'architecture (AUCUNE modification de fichier)  
**Livrable :** `.project/reports/migrations-typescript-architecture-audit-2026-11-09.md`  
**Statut :** Rapport factuel et proposition architecturale — en attente de validation indépendante avant toute implémentation

---

## 1. État réel de l'existant avec chemins des fichiers

Le dépôt MosaiX possède déjà un moteur de migrations structuré, implémenté dans le package `@mosaix/migrations`. Ce n'est pas un système de "chaînes SQL brutes" sans structure : un DSL de schéma (SchemaBuilder), des grammaires SQL (SQLite/Postgres), un registre de providers, un planner, un runner, un store persistant et une CLI existent déjà.

### 1.1 Package moteur — `@mosaix/migrations` (`packages/migrations/src/`)

| Fichier | Responsabilité | État |
|---------|---------------|------|
| `migration.ts` | Contrat `Migration` (id, content, down?, checksum, resources, dependencies?) + `MigrationProvider` (ownerId, migrations()) + `parseMigrationId` / `compareMigrationIds` | Implémenté |
| `schema-builder.ts` | DSL fluent `SchemaBuilder`/`TableBuilder`/`ColumnBuilder` produisant un `Blueprint` AST (createTable, dropTable, addColumn, dropColumn, renameColumn, renameTable, createIndex) | Implémenté |
| `grammar.ts` | `Grammar` interface + `SQLiteGrammar` + `PostgresGrammar` compilant un `Blueprint` en `SqlStatement[]` (sql + params) | Implémenté |
| `checksum.ts` | `computeChecksum` (FNV-1a 64-bit, déterministe, sans dépendance externe) | Implémenté |
| `registry.ts` | `MigrationRegistry` agrégeant les `MigrationProvider`, détection de collision d'identité (`MigrationConflictError`), `loadMigration` | Implémenté |
| `planner.ts` | `MigrationPlanner` : delta Registry → Store, détection checksum (`MigrationChecksumError`), détection store-absent-registry (`MigrationMissingError`), détection collisions de ressources SQL (`MigrationResourceConflictError`), plan de rollback inverse, `computeSourceVersion` | Implémenté |
| `runner.ts` | `MigrationRunner` : exécution du plan sous lock (`acquireMigrationLock`), transaction par migration, enregistrement dans le Store (id, owner, checksum, batchId, appliedAt), dry-run, `previewSQL` | Implémenté |
| `store.ts` | `MigrationStore` interface (list, get, save, remove) + `InMemoryMigrationStore` (tests/prototypes uniquement) | Implémenté |
| `sql-store.ts` | `SqlMigrationStore` : table `mosaix_migrations` (id, owner, checksum, batch_id, applied_at), placeholders dialect-aware (`?` / `$n`), upsert `ON CONFLICT` | Implémenté |
| `dependency-resolver.ts` | `DependencyResolver` : tri topologique déterministe, détection de cycle, priorité `framework.*` (R10) | Implémenté |
| `cli.ts` | `MigrationCLI` (migrate, rollback, status, create template) + `MigrationStatus` | Implémenté |
| `errors.ts` | Hiérarchie d'erreurs typées (`MigrationError`, `MigrationConflictError`, `MigrationChecksumError`, `MigrationMissingError`, `MigrationAlreadyAppliedError`, `MigrationLockError`, `MigrationTransactionError`, `MigrationExecutionError`, `MigrationResourceConflictError`) | Implémenté |
| `file-provider.ts` | `FileMigrationProvider` : scanne un répertoire pour fichiers `.ts` / `.sql`, id = nom de fichier, content = lecture brute | Implémenté (spike/outillage) |
| `index.ts` | Barrel d'export public du package | Implémenté |

### 1.2 Package ports — `@mosaix/ports-database` (`packages/ports/database/src/`)

| Fichier | Responsabilité |
|---------|---------------|
| `index.ts` | `DatabasePort` (execute, query, transaction, acquireMigrationLock, capabilities), `DatabaseCapabilities` (dialect, transactions, lock), `LockCapabilities` (distributed, processSafe, runtimeSafe), `MigrationLock` (release), `DatabaseConnection` (execute, query) |

### 1.3 Package adaptateurs et résolution — `@mosaix/database` + `@mosaix/adapter-database-sqlite`

| Fichier | Responsabilité |
|---------|---------------|
| `packages/database/src/database-manager.ts` | `DatabaseManager` : résolution de config (DB_CONNECTION / DATABASE_URL → sqlite ou pgsql), factories injectées (`sqlite`, `pgsql`), hook `onConnect` (PRAGMAs SQLite awaités), `ready()` |
| `packages/database/src/postgres-schema-grammar.ts` | `PostgresSchemaGrammar` : CREATE/DROP schema, search_path, GRANT, déplacement de table entre schémas, enable RLS, tenant policy |
| `packages/database/src/postgres-bac-schema-migrator.ts` | `PostgresBacSchemaMigrator` : provisionnement des 10 schémas BAC canoniques, déplacement de tables préfixées `public` vers schéma BAC, renommage pour supprimer le préfixe redondant |
| `packages/database/src/database-manager.ts` (SQLITE_PRAGMAS) | `SQLITE_PRAGMAS` : WAL, synchronous=NORMAL, busy_timeout=5000, foreign_keys=ON |
| `packages/adapters/database-sqlite/src/index.ts` | `SQLiteDatabaseAdapter` : `node:sqlite` (`DatabaseSync`), savepoints imbriqués, `BEGIN EXCLUSIVE` pour le lock migration, capabilities `processSafe` (pas distributed) |

### 1.4 Consommateurs du moteur dans le shell et les BACs

| Fichier | Rôle |
|---------|------|
| `src/shell/migrations.ts` | `runShellMigrations(db)` (CLI uniquement) + `getPendingMigrationIds(db)` (verificateur boot, lecture seule) |
| `src/shell/migration-registry.ts` | `createShellMigrationRegistry(dialect)` : agrégateur shell-core (rank 0) + BACs (rank 1), gated par dialect (Postgres-only pour les BACs) |
| `src/shell/bac-migrations.ts` | 10 providers BAC (citadelle, commerce, booking, imperia, solara, solidarity, subscription, beam, spaces, portfolio) re-mappés sous ids canoniques `owner.module.version.sequence_name` ; `CanonicalIdProvider`, `StaticMigrationProvider`, `SubscriptionPhase0Provider` (filtrage des statements `user_subscriptions` propriété shell) |
| `src/shell/database/core-migration.ts` | `ShellCoreMigrationProvider` : migrations shell-core `shell.core.v1.001_create_core_tables` et `shell.core.v1.002_create_subscription_tables` — contenu SQL en chaînes brutes (UP/DOWN) |
| `src/shell/database-bootstrap.ts` | `initDatabase()` / `databaseReady()` : connect-only, PRAGMAs awaités, jamais de DDL au boot |
| `src/start.ts` | Boot : compose l'application, vérifie (migrations fail-fast via CLI, pas au boot) |
| `packages/cli/src/commands/migration-commands.ts` | Commandes CLI : `migrate`, `migrate:status`, `migrate:rollback`, `migrate:fresh`, `migrate:install`, `migrate:reset`, `migrate:mark` |
| `src/shell/seeders/database-seeder.ts` | `runDatabaseSeeds(db)` : seeds idempotents, CLI uniquement, refusé en production |

### 1.5 Exemples de migrations déclarées (chaînes SQL)

Les migrations BACs et shell construisent un `Blueprint` via `SchemaBuilder`, le compilent avec `PostgresGrammar`, puis joignent les `sql` en une **chaîne SQL unique** stockée dans `Migration.content` / `Migration.down` :

- `apps/imperia/src/infrastructure/migrations.ts` — `imperia.v1.001_create_imperia_tables` (5 tables, SQL contenu)
- `apps/solara/src/infrastructure/migrations.ts` — `solara.v1.001_create_social_tables` (7 tables, SQL contenu)
- `apps/commerce/src/infrastructure/migrations.ts` — `commerce.v1.001_create_commerce_tables`
- `apps/portfolio/src/infrastructure/migrations/20260922162000_create_portfolio_tables.ts` (id timestamp, Blueprint + grammar)
- `apps/portfolio/src/infrastructure/migrations/20260924120000_create_portfolio_proposals.ts`
- `src/shell/database/core-migration.ts` — `shell.core.v1.001` (UP/DOWN en chaînes SQL brutes, ~25 tables)

### 1.6 Documents de référence (décisions et PRD)

| Document | Chemin | Statut |
|----------|--------|--------|
| PRD-0006 — Migration Engine | `.project/prd/PRD-0006-migrations-engine.md` | V2.3, décisions figées R1-R14 |
| ADR-0006 — Database Port & Migration Engine | `.project/decisions/ADR-0006-database-port-migration-engine.md` | Accepted 2026-08-06 |
| ADR-0014 — PostgreSQL BAC Schemas & RLS | `.project/decisions/ADR-0014-postgresql-bac-schemas-and-native-rls.md` | Accepted 2026-09-23 |
| ADR-0016 — BAC Ownership & Boundaries | `.project/decisions/ADR-0016-bac-ownership-and-boundaries.md` | Accepted (target) |
| Architecture fédérée | `.project/architecture/mosaix-federated-migration-system.md` | Modèle Laravel-like simplifié |

---

## 2. Cartographie du fonctionnement actuel

```
┌─────────────────────────────────────────────────────────────────┐
│                     SOURCES DE MIGRATIONS                       │
│  Shell core (src/shell/database/core-migration.ts)              │
│  BACs (apps/*/src/infrastructure/migrations.ts / *.ts)          │
│  Fichiers autonomes (apps/*/src/infrastructure/migrations/*.ts)│
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│         MIGRATION PROVIDERS  (ownerId + migrations())           │
│  ShellCoreMigrationProvider, CitadellePostgresMigrationProvider,│
│  CanonicalIdProvider, StaticMigrationProvider, Subscription…   │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              GLOBAL MIGRATION REGISTRY                          │
│  (src/shell/migration-registry.ts → createShellMigrationRegistry)│
│  Agglomère providers, détecte collisions d'identité (R9)        │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              MIGRATION PLANNER  (packages/migrations/planner.ts)│
│  Delta Registry → Store, checksum, collisions ressources SQL,   │
│  plan ordonné (R6, R10), rollback inverse (PRD §29)             │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              MIGRATION RUNNER  (packages/migrations/runner.ts)  │
│  Lock (acquireMigrationLock) → transaction par migration →      │
│  exécution content/down → enregistrement Store → release lock   │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              DATABASE PORT  (@mosaix/ports-database)            │
│  execute / query / transaction / acquireMigrationLock           │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              ADAPTATEURS  (SQLite node:sqlite / Postgres)       │
│  Schéma mosaix_migrations (ledger persistant)                   │
└─────────────────────────────────────────────────────────────────┘
```

### Flux d'exécution courant

1. **Boot** (`src/start.ts`, `src/shell/database-bootstrap.ts`) : connexion uniquement, PRAGMAs SQLite, jamais de DDL. `getPendingMigrationIds()` peut être appelé en lecture pour signaler des migrations en attente (ne crée rien, ne migre pas).
2. **CLI** (`mosaix migrate`) : `buildMigrationCli()` résout le driver, crée le registry dialect-gaté, le `SqlMigrationStore`, le `MigrationPlanner`, le `MigrationRunner`, puis exécute le plan.
3. **Chaque migration** : le provider construit un `Blueprint` (SchemaBuilder), le compile avec la `Grammar` adaptée au dialecte, le résultat est une chaîne SQL (`content` / `down`) exécutée via `db.execute()` dans une transaction, puis enregistré dans `mosaix_migrations` avec son checksum, owner et batchId.

### Consommateurs de tests

| Fichier | Ce qui est testé |
|---------|-----------------|
| `packages/migrations/src/schema-builder.test.ts` | SchemaBuilder DSL, SQLiteGrammar, PostgresGrammar, DependencyResolver, MigrationCLI, MigrationRunner (dry-run/preview) |
| `tests/production/migrations-concurrency.e2e.test.ts` | Lock collision (double instance), détection tampering checksum (MIG-IMMUT-01) |
| `src/shell/theme/theme-persistence.test.ts` | `runShellMigrations` idempotence (2ème appel ne migre rien) |
| `src/shell/seeders/database-seeder.test.ts` | Flux migrate + seed (CLI-only) |
| `tests/imperia-migration-preview-ocp.test.ts` | Extension OCP du prévisualiseur SQL (Imperia) |

---

## 3. Problèmes et limites identifiés

### 3.1 Les migrations sont des chaînes SQL, pas des modules TypeScript avec `up()`/`down()`

Le contrat `Migration` actuel (`packages/migrations/src/migration.ts:24-40`) expose :
- `content: string` — le SQL d'upgrade sous forme de chaîne brute
- `down?: string` — le SQL de rollback sous forme de chaîne brute
- `checksum: string` — empreinte du contenu

Il n'existe **pas** de `MigrationContext` passé à une fonction `up(context)` / `down(context)`. Les migrations BACs (ex. imperia, solara) instancient elles-mêmes un `SchemaBuilder` + `PostgresGrammar`, compilent en SQL, et stockent le résultat en chaîne. Le moteur ne voit que du SQL brut à exécuter.

**Conséquence :** le moteur ne peut pas valider sémantiquement le schéma avant exécution, ne peut pas composer des blueprints de plusieurs migrations pour détecter les collisions au niveau AST (il détecte les collisions de ressources déclarées dans `resources`, pas au niveau des blueprints réels), et ne peut pas offrir un `MigrationContext` typé (schema builder, database, logger, runtime).

### 3.2 Le `file-provider.ts` parcourt le système de fichiers

`FileMigrationProvider` lit directement le disque (`fs.readdirSync`, `fs.readFileSync`) et utilise le nom de fichier comme id (timestamp `YYYYMMDDHHMMSS_name`). Cela contredit le PRD-0006 §4.5 et ADR-0006 R1 : "Le moteur ne parcourt jamais le système de fichiers. Les migrations sont découvertes exclusivement via les manifests." Ce provider est un outil de développement/spike, pas une découverte canonique.

### 3.3 Format d'id non canonique pour les fichiers autonomes

Les fichiers autonomes (ex. `apps/portfolio/.../20260922162000_create_portfolio_tables.ts`) utilisent des ids basés sur des timestamps (`20260922162000_create_portfolio_tables`), pas le format canonique `owner.module.version.sequence_name` requis par `parseMigrationId` (4 parties séparées par des points). Le shell doit les re-mapper via `CanonicalIdProvider` / `StaticMigrationProvider` dans `bac-migrations.ts` pour les rendre compatibles avec le tri `compareMigrationIds`. C'est une couche d'adaptation fragile (length guard, risque de désaccord si une migration est ajoutée au provider interne).

### 3.4 Pas de `MigrationContext` typé

Le PRD-0006 §12 définit un `MigrationContext` avec `schema: SchemaBuilder`, `database: DatabasePort`, `logger`, `runtime`. Il n'existe pas dans l'implémentation. Les migrations n'ont pas accès à un contexte structuré ; elles génèrent du SQL chaîne et le moteur l'exécute aveuglément.

### 3.5 Séparation imparfaite DSL / SQL dans les providers BACs

Les providers BACs font elles-mêmes `builder.blueprints.flatMap(bp => grammar.compile(bp))` puis joignent le SQL. La logique de compilation SQL est dupliquée dans chaque provider plutôt que d'être poussée dans le moteur (Planner/Runner). Le `Migration.content` est une chaîne, donc le Runner ne manipule jamais de Blueprints.

### 3.6 Double stockage d'état (ledger mosaix_migrations + MigrationGovernanceService d'Imperia)

`apps/imperia/src/domain/migration-governance.service.ts` maintient une liste statique en mémoire de migrations avec statut appliqué/non appliqué et un registre de prévisualiseurs SQL (`MigrationSqlPreviewGenerator`). Cela duplique le rôle du `MigrationStore` et du `MigrationPlanner`, sans source unique de vérité partagée.

### 3.7 SQLite en production — gage de concurrence limité

L'adaptateur SQLite utilise `BEGIN EXCLUSIVE` pour `acquireMigrationLock`, ce qui donne une garantie `processSafe` (même machine) mais **pas** `distributed`. Sur plusieurs instances SQLite (fichiers séparés), il n'y a pas de verrou global. Ce risque est documenté dans ADR-0006 (modèle asymétrique assumé) mais doit être explicité.

### 3.8 Gaps d'orphelins documentés dans `bac-migrations.ts`

Quatre migrations orphelines sont explicitement exclues (normalize_commerce_orders, harden_booking_constraints, add_solidarity_transaction_state, harden_citadelle_security) car elles ALTERent des colonnes inexistantes. Ce n'est pas géré par le moteur : c'est une exclusion manuelle dans le shell.

### 3.9 Collision subscription / shell-core sur `user_subscriptions`

`shell.core.v1.002` possède `user_subscriptions` sur `mosaix_dev`, tandis que `subscription.v1.001` déclare la même table avec un schéma divergent. Le shell filtre les statements de `user_subscriptions` du provider subscription (Phase-0 view). Le transfert de propriété complet est reporté (backlog DB-BAC-OWNERSHIP). Cela illustre la difficulté de la gouvernance multi-sources quand un même objet est revendiqué par deux owners.

---

## 4. Architecture cible recommandée

L'architecture cible doit **faire évoluer l'existant**, pas le remplacer. Le PRD-0006 et l'ADR-0006 figent déjà une architecture ports/adapters saine. L'évolution vers "migrations TypeScript natives" consiste à :

1. **Passer de `content: string` / `down?: string` à `up(context)` / `down(context)`** dans le contrat `Migration`, avec un `MigrationContext` typé exposant `schema: SchemaBuilder`, `database: DatabasePort`, `logger`, `runtime`.
2. **Faire du `SchemaBuilder` l'API principale des migrations** : les modules TS construisent des `Blueprint` directement, le moteur compile via la `Grammar` au moment de l'exécution (et non plus au moment de la déclaration du provider).
3. **Conserver le `content` comme option d'échappement** (SQL natif) pour les cas où le DSL ne suffit pas (ex. ALTER TYPE complexe, fonctions PL/pgSQL, index partiels).
4. **Conserver tous les contrats existants** : `MigrationProvider`, `MigrationRegistry`, `MigrationPlanner`, `MigrationRunner`, `MigrationStore`, `DatabasePort`, `Grammar`, `SqlMigrationStore`, `DependencyResolver`, erreurs typées.

### Principe directeur (ADR-0006)

> "Le cœur manipule uniquement des représentations abstraites du schéma. Le SQL est considéré comme un détail d'implémentation."

L'objectif : le `Migration.content` (chaîne SQL) devient un détail d'implémentation optionnel ; le cœur manipule des `Blueprint` via le `SchemaBuilder`.

---

## 5. Contrats TypeScript proposés

### 5.1 MigrationContext (nouveau — PRD-0006 §12)

```typescript
// packages/migrations/src/migration-context.ts

export interface MigrationContext {
  readonly schema: SchemaBuilder;      // DSL pour construire des blueprints
  readonly database: DatabasePort;     // exécution SQL (raw si nécessaire)
  readonly logger: MigrationLogger;    // logs de migration
  readonly runtime: MigrationRuntime;  // dialect, capabilities, etc.
}

export interface MigrationLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface MigrationRuntime {
  readonly dialect: "sqlite" | "postgres";
  readonly capabilities: DatabaseCapabilities;
}
```

### 5.2 Migration (évolué — `packages/migrations/src/migration.ts`)

```typescript
export interface Migration {
  readonly id: string;                                    // owner.module.version.sequence_name
  readonly up(context: MigrationContext): Promise<void> | void;
  readonly down?(context: MigrationContext): Promise<void> | void;
  readonly checksum: string;                              // calculé au chargement (R2)
  readonly resources: readonly string[];                  // blueprint de collision (R9)
  readonly dependencies?: readonly string[];              // DAG (R41)
  readonly rawSql?: string;                               // échappement SQL natif (optionnel)
}
```

**Règles :**
- `up` et `down` reçoivent un `MigrationContext` typé (jamais de connexion brute).
- `down` optionnel : si absent et rollback demandé → erreur `MigrationExecutionError` ("no down() body") — migration irréversible (PRD-0006 §32).
- `rawSql` : chaîne SQL brute exécutée telle quelle, pour les cas hors-DSL. Doit être déclarée dans `resources` pour la détection de collisions.
- Le checksum est calculé sur le contenu effectif (source TS + rawSql si présent), au chargement (R2).

### 5.3 MigrationProvider (inchangé — déjà conforme)

```typescript
export interface MigrationProvider {
  ownerId(): string;
  migrations(): readonly Migration[];
}
```

Le provider expose l'**état complet courant** (R12) ; le Planner calcule le delta vs Store.

### 5.4 Planner et Plan (inchangés — déjà conformes ADR-0006 §8-9)

Le `MigrationPlanner` reste la frontière décisionnelle. Le `MigrationPlan` est immuable. Le Runner ne reçoit qu'un plan déjà calculé.

### 5.5 Store (inchangé — déjà conforme)

`MigrationStore` (list, get, save, remove) + `SqlMigrationStore` (table `mosaix_migrations`, owner conservé pour audit R7).

---

## 6. Stratégie d'adaptation PostgreSQL / SQLite

### 6.1 Déjà implémenté (à conserver)

| Aspect | SQLite | PostgreSQL |
|--------|--------|------------|
| Grammaire | `SQLiteGrammar` (TEXT, INTEGER, NUMERIC, UUID→TEXT, TIMESTAMP→TEXT, JSON→TEXT, BOOLEAN→INTEGER) | `PostgresGrammar` (VARCHAR(255), UUID, TIMESTAMPTZ, JSONB, BOOLEAN, ON DELETE CASCADE) |
| Placeholders | `?` | `$n` (via `SqlMigrationStore.bind`) |
| Transactions | savepoints imbriqués + BEGIN/COMMIT/ROLLBACK | natif (à adapter via `createPostgresDatabasePort`) |
| Lock | `BEGIN EXCLUSIVE` (`processSafe`) | advisory lock `pg_try_advisory_lock` (distributed) — à implémenter dans l'adapter Postgres |
| Schémas BAC | N/A (SQLite mono-fichier) | Schémas dédiés par BAC (ADR-0014), `SET search_path`, RLS natif |

### 6.2 Recommandations d'adaptation

1. **Grammaire unique dans le moteur** : le `SchemaBuilder`/`Grammar` existant dans `packages/migrations` couvre déjà les deux dialectes. Les migrations TS l'utiliseront directement via `context.schema`.

2. **SQL natif comme échappement** : `rawSql` dans `Migration` permet des instructions spécifiques (ex. `ALTER COLUMN ... TYPE BIGINT` PG-only, `CREATE EXTENSION`, index partiels PG). Le moteur exécute `rawSql` via `context.database.execute()` sans compilation.

3. **Isolation BAC sur Postgres** : les migrations d'un BAC ciblent son schéma canonique (`citadelle`, `commerce`, …) via `context.schema.inSchema(bac)` ou `rawSql` avec `SET search_path`. Le `PostgresBacSchemaMigrator` reste responsable du provisionnement des schémas et du déplacement des tables préfixées legacy.

4. **Pas de détection de dialecte dans le Runner** : le Runner utilise `context.database.capabilities` uniquement (transactions, lock). Jamais de `if (dialect === "postgres")` dans le cœur.

---

## 7. Stratégie de migration progressive de l'existant

**Règle d'or : aucune réécriture en big bang. Chaque lot est réversible et indépendant.**

### Lot A — Contrats et contexte (fondation)
1. Ajouter `MigrationContext`, `MigrationLogger`, `MigrationRuntime` dans `packages/migrations/src/`.
2. Faire évoluer l'interface `Migration` pour ajouter `up(context)` / `down(context)` tout en **conservant** `content` et `down` (chaîne) comme champs optionnels pour rétrocompatibilité.
3. Ajouter `rawSql?: string` à `Migration`.
4. Adapter `loadMigration` (registry.ts) pour accepter les deux formes (ancienne `content`/`down` en chaîne, nouvelle `up`/`down`).
5. Tests : unitaires sur `MigrationContext`, compatibilité ascendante avec les anciens objets `content: string`.

### Lot B — Moteur : compilation des blueprints au runtime
1. Faire évoluer `MigrationRunner.applyUp/applyDown` pour accepter soit une fonction `up(context)`, soit une chaîne `content` (rétrocompat).
2. Si `up(context)` est présent : créer un `SchemaBuilder`, appeler `up(context)`, compiler les blueprints via la `Grammar` du dialecte, exécuter les `SqlStatement` via `context.database.execute()`.
3. Si seul `content` est présent : exécuter directement (comportement actuel).
4. Le `checksum` est recomputé sur le contenu effectif.

### Lot C — Migration des providers BACs (un par un, protocole Lot 2)
Pour chaque BAC (ordre : citadelle → commerce → booking → imperia → solara → solidarity → subscription → beam → spaces → portfolio) :
1. Convertir la migration `content: string` (SQL) en module TS avec `up(context)` utilisant `context.schema.createTable(...)` etc.
2. Conserver `down(context)` quand réversible, sinon omettre (migration irréversible documentée).
3. Déclarer `resources` (liste des tables/index créés) pour la détection de collisions R9.
4. Ajouter des tests dédiés : création de tables, idempotence, absence de fuite de secrets, rollback si `down` présent.
5. Vérifier que le Planner détecte les collisions de ressources entre BACs (ex. deux BACs ne créent pas la même table).
6. Ne pas toucher aux autres BACs pendant ce lot.

### Lot D — Shell et registre
1. Mettre à jour `bac-migrations.ts` pour enregistrer les nouveaux providers TS (plus besoin de `CanonicalIdProvider` si les ids sont déjà canoniques dans les modules TS).
2. Supprimer les re-mappings d'ids fragiles (length guard devient inutile).
3. Conserver `ShellCoreMigrationProvider` en mode rétrocompat (chaîne SQL) jusqu'à sa conversion (Lot E).

### Lot E — Shell core (dernier, à haut risque)
1. Convertir `shell.core.v1.001_create_core_tables` (25 tables, chaînes SQL brutes) en migration TS.
2. Gérer le transfert de propriété de `user_subscriptions` (shell.core.v1.002 → subscription BAC) dans ce lot ou un lot dédié.
3. Tests d'intégration : `runShellMigrations` sur SQLite `:memory:` et sur Postgres testcontainer.

### Lot F — CLI et outillage
1. `mosaix migrate:create` génère un module TS avec `up(context)`/`down(context)` (template).
2. `mosaix migrate --dry-run` / `mosaix migrate:preview` affiche le SQL compilé sans exécution (déjà prévu PRD Phase 7).
3. Suppression de `FileMigrationProvider` si la découverte passe exclusivement par les Manifests (R1) — ou le garder comme outil dev uniquement.

---

## 8. Risques techniques et mesures de prévention

| Risque | Niveau | Mesure de prévention |
|--------|--------|---------------------|
| Régression sur les migrations déjà appliquées (checksum mismatch) | Critique | Conserver `content`/`down` en rétrocompat ; le checksum est calculé sur le contenu effectif. Ne jamais modifier une migration appliquée. |
| Collision de ressources SQL entre BACs | Élevé | Le Planner détecte les collisions au niveau Blueprint (R9). Tests dédiés par paire de BACs. |
| Perte de données lors d'un rollback | Élevé | `down` optionnel ; si absent, le rollback échoue explicitement. Les migrations irréversibles sont documentées. Les `cleanup migrations` (R11) sont le seul mécanisme d'uninstall. |
| Concurrence multi-instance SQLite | Moyen | Documenter `processSafe` uniquement (pas `distributed`). Utiliser Postgres advisory lock en production multi-instance. |
| Migration partiellement exécutée (crash mid-transaction) | Moyen | Transaction par migration (PRD §26) : BEGIN → SQL → Store.save → COMMIT. Sur erreur : ROLLBACK, Store inchangé, lock libéré. |
| Couplage moteur / dialecte SQL | Faible | Le Runner ne connaît que `DatabasePort` et `Grammar`. Jamais de SQL brut dans le cœur (sauf `rawSql` échappement explicitement déclaré). |
| Découverte par filesystem contredit R1 | Faible | `FileMigrationProvider` reste un outil dev/CLI, pas utilisé par le moteur en production. |
| Complexité du `MigrationContext` | Faible | Interface minimale : schema, database, logger, runtime. Pas d'ORM, pas de repository. |

---

## 9. Découpage en lots indépendants

| Lot | Objet | Fichiers concernés | Risque | Dépendances |
|-----|-------|-------------------|--------|-------------|
| A | Contrats + `MigrationContext` | `packages/migrations/src/migration.ts`, `migration-context.ts`, `registry.ts` (`loadMigration`) | Faible | Néant |
| B | Moteur : exécution `up(context)` + rétrocompat `content` | `packages/migrations/src/runner.ts`, `grammar.ts` | Moyen | Lot A |
| C | Migration BACs (10 providers, un par un) | `apps/*/src/infrastructure/migrations.ts / *.ts` | Moyen par BAC | Lot B |
| D | Shell + registre (suppression re-mappings d'ids) | `src/shell/bac-migrations.ts`, `migration-registry.ts` | Faible | Lot C |
| E | Shell core (25 tables + `user_subscriptions` transfert) | `src/shell/database/core-migration.ts` | Élevé | Lot C, D |
| F | CLI + outillage (`migrate:create`, `--dry-run`) | `packages/cli/src/commands/migration-commands.ts`, `packages/migrations/src/cli.ts` | Faible | Lot A, B |

**Protocole :** un lot à la fois, tests + revue avant le suivant. Aucun lot ne modifie les autres en parallèle.

---

## 10. Tests et critères d'acceptation

### Tests par lot

**Lot A :**
- `loadMigration` accepte un objet `{ id, content, down, resources }` (ancien format) et produit un `Migration` valide avec checksum.
- `loadMigration` accepte un objet `{ id, up, down?, resources, rawSql? }` (nouveau format).
- Rétrocompat : un `Migration` avec `content: string` reste valide et exécute via le Runner (Lot B).

**Lot B :**
- `applyUp` exécute `up(context)` : le `SchemaBuilder` reçoit les appels `createTable`, `addColumn`, etc., la `Grammar` compile, `database.execute` reçoit les `SqlStatement`.
- `applyUp` exécute `content: string` (rétrocompat) : chaîne SQL exécutée directement.
- `applyDown` lance une erreur si `down` absent (migration irréversible).
- Dry-run : aucun appel `database.execute`, aucun enregistrement Store.
- Transaction : sur erreur dans `up`, rollback et Store inchangé.

**Lot C (par BAC) :**
- Migration crée les tables déclarées dans `resources`.
- `isEnabled` / présence des colonnes attendues (via requête sur `information_schema` ou `pragma_table_info`).
- Aucun secret dans les messages d'erreur.
- Pas de collision de ressources avec un autre BAC déjà migré (test d'intégration du Planner avec deux providers).
- Rollback fonctionne si `down` présent.

**Lot D :**
- `createShellMigrationRegistry` enregistre les providers TS sans `CanonicalIdProvider` quand les ids sont déjà canoniques.
- Pas de collision d'identité entre providers.

**Lot E :**
- `runShellMigrations` sur `:memory:` applique toutes les migrations shell-core une seule fois.
- Deuxième appel : idempotent (zéro migration appliquée).
- `getPendingMigrationIds` retourne `[]` après migration complète.

**Lot F :**
- `mosaix migrate:create` génère un fichier TS avec `up(context)`/`down(context)` et l'id canonique `owner.module.version.sequence_name`.
- `mosaix migrate --dry-run` affiche le SQL sans modifier la base.

### Critères d'acceptation globaux (PRD-0006 §47)

1. Une application peut créer son schéma via des migrations TS.
2. Plusieurs migrations s'exécutent dans un ordre déterministe (`compareMigrationIds`).
3. Le rollback fonctionne (ordre inverse, `down`).
4. Les batches sont suivis (`batchId` dans le Store).
5. Les checksums empêchent toute modification d'une migration appliquée (`MigrationChecksumError`).
6. Deux exécutions concurrentes ne modifient pas le schéma simultanément (garantie de l'adaptateur, `MigrationLockError`).
7. Une migration supprimée du Registry après application bloque (`MigrationMissingError`, R5).
8. Migrations framework et applications agrégées en graphe global déterministe, sans collision d'identifiants (R7).
9. Le Store conserve l'owner de chaque migration (audit R7).
10. Le Planner produit un `MigrationPlan` révisable avant exécution (R13).
11. Deux validations de collision distinctes : identité complète (Registry) et ressource SQL (Planner, R9).
12. Aucun secret codé en dur, aucun secret dans les logs/exceptions/réponses HTTP.

---

## 11. Décision recommandée

**Approche recommandée : développer le moteur propriétaire existant (approche évolutive), sans intégrer de bibliothèque externe.**

### Justification

1. **L'architecture existe déjà et est conforme aux invariants ADR-0006** : ports avant implémentations, séparation DSL/SQL (Grammar), Runner sans connaissance des moteurs SQL, `DatabasePort` unique, immutabilité par checksum, lock par adaptateur, `MigrationProvider` avec `ownerId`, Planner/Runner séparés, idempotence du Planner.

2. **Aucune bibliothèque existante ne répond à l'ensemble des contraintes MosaiX** :
   - Aucun ORM n'est souhaité (PRD-0006 §3 non-objectif : "remplacer un ORM" n'est pas le but, mais le moteur ne doit pas dépendre d'un ORM).
   - Knex.js, Prisma Migrations, TypeORM migrations, etc. imposent un ORM, un format de fichier spécifique, et une gestion d'état qui entrerait en conflit avec le `MigrationStore` et le `MigrationPlanner` MosaiX.
   - Le besoin multi-runtime (Node, navigateur, WASM, serverless) et multi-dialecte (SQLite + Postgres) avec abstraction driver (`SQLiteDriver`, R4) est spécifique et déjà couvert par l'existant.

3. **L'évolution vers TypeScript natif est une évolution interne du contrat `Migration`**, pas un remplacement du moteur. Elle conserve tous les contrats publics (`MigrationProvider`, `MigrationRegistry`, `MigrationPlanner`, `MigrationRunner`, `MigrationStore`, `DatabasePort`, `Grammar`).

### Alternative écartée : intégrer une bibliothèque existante

Rejetée car :
- Introduirait une dépendance lourde sur un ORM ou un outil de migration tiers, contraire à l'invariant "le cœur dépend exclusivement de ports".
- Casseraient le modèle `owner.module.version.sequence_name` et le `MigrationStore` avec `owner` (audit R7).
- Ne couvriraient pas le verrouillage asymétrique Postgres/SQLite ni le modèle desired-state → plan (R12).
- Imposeraient un format de fichier et une découverte par filesystem (contredisant R1).

### Alternative écartée : approche hybride (bibliothèque pour le SQL, MosaiX pour l'orchestration)

Rejetée car inutile : le `SchemaBuilder` + `Grammar` existant génère déjà du SQL pour SQLite et Postgres. Ajouter une bibliothèque de construction SQL ajouterait de la complexité sans gain.

### Décision finale

**Développer en interne**, en faisant évoluer le package `@mosaix/migrations` existant selon le découpage en lots (A→F) ci-dessus, sans intégrer de bibliothèque externe, sans réécriture en big bang, et en préservant la rétrocompatibilité avec les migrations déclarées sous forme de chaînes SQL (`content`/`down`) pendant la transition.

---

## Annexe — Fichiers de l'existant référencés (aucune modification)

**Moteur :** `packages/migrations/src/{migration,schema-builder,grammar,checksum,registry,planner,runner,store,sql-store,dependency-resolver,cli,errors,file-provider,index}.ts`

**Ports :** `packages/ports/database/src/index.ts`

**Adaptateurs :** `packages/database/src/{database-manager,postgres-schema-grammar,postgres-bac-schema-migrator,index}.ts`, `packages/adapters/database-sqlite/src/index.ts`

**Shell :** `src/shell/{migrations,migration-registry,bac-migrations,database-bootstrap,database/core-migration,database/minimal-core-migration,database/feature-flags-migration,database/mobile-bridge-migration,theme/theme-migrations}.ts`, `src/shell/seeders/database-seeder.ts`, `src/start.ts`

**BACs (migrations) :** `apps/{citadelle,commerce,booking,imperia,solara,solidarity,subscription,beam,spaces,portfolio}/src/infrastructure/migrations.ts` et `apps/{portfolio,booking,commerce,solara,solidarity,spaces,beam,subscription}/src/infrastructure/migrations/*.ts`

**CLI :** `packages/cli/src/commands/migration-commands.ts`

**Tests :** `packages/migrations/src/schema-builder.test.ts`, `tests/production/migrations-concurrency.e2e.test.ts`, `src/shell/theme/theme-persistence.test.ts`, `src/shell/seeders/database-seeder.test.ts`, `tests/imperia-migration-preview-ocp.test.ts`

**Documents de référence :** `.project/prd/PRD-0006-migrations-engine.md`, `.project/decisions/ADR-0006-database-port-migration-engine.md`, `.project/decisions/ADR-0014-postgresql-bac-schemas-and-native-rls.md`, `.project/decisions/ADR-0016-bac-ownership-and-boundaries.md`, `.project/architecture/mosaix-federated-migration-system.md`

---

*Rapport produit en mode OFF_RECORD — aucune modification de fichier n'a été effectuée. En attente de validation indépendante avant toute phase d'implémentation.*