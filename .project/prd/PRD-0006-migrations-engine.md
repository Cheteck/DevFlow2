# PRD-0006 — MosaiX Database Migration Engine

**Statut** : Proposition — V2.3 (décisions architecte intégrées le 2026-08-06, figées dans ADR-0006)
**Priorité** : Haute

**Package principal** : `@mosaix/migrations`

**Packages associés**

* `@mosaix/ports-database`
* `@mosaix/adapter-database-sqlite`
* `@mosaix/adapter-database-postgres`
* `@mosaix/cli` (hors cœur)

> **Supprimé en V2.1** : `@mosaix/manifest` — voir Révision R1 (§6, §7, §38, §39).

---

# Révisions V2.3

Cette version intègre les décisions architecturales validées par l'architecte
le 2026-08-06 (suite à l'analyse de faisabilité
`.project/reports/feasibility-prd-0006-2026-08-06.md`).

**V2.2** a étendu le modèle à deux sources de migrations — framework MosaiX et
applications installées — via le concept de premier ordre `MigrationProvider`
(R7).

**V2.3** précise la gouvernance de composition (sémantique du Manifest,
collisions, ordonnancement, désinstallation, upgrade des providers) et ajoute
une couche **Migration Planner** entre le Registry et le Runner (R8-R14).

Ces décisions sont figées dans **ADR-0006 — Database Port and Migration
Engine Architecture** (Accepted, 2026-08-06) avant toute implémentation
(Phase 0).

| Révision | Décision | Sections impactées |
|----------|----------|--------------------|
| R1 | Suppression du package `@mosaix/manifest` — le Manifest applicatif existant (`ApplicationManifest` dans `@mosaix/contracts`, validé par `@mosaix/schemas`) est la source unique de vérité | §1, §6, §7, §38, §39, §49 |
| R2 | Le checksum est calculé au **chargement** de la migration (plus jamais « à la génération ») ; le checksum enregistré est celui réellement exécuté | §11, §25, §49 |
| R3 | Le contrat `MigrationLock` expose des capacités (`LockCapabilities`) ; la garantie de concurrence appartient à l'adaptateur, pas au Runner ; modèle explicitement asymétrique PostgreSQL (distribué) / SQLite Node / SQLite navigateur (single-writer) | §10, §28, §49 |
| R4 | L'adaptateur SQLite possède une **abstraction driver interne** (`SQLiteDriver`) pour supporter `better-sqlite3`, `sql.js`, `sqlite-wasm`, OPFS sans modifier le moteur | §7, §16bis, §49 |
| R5 | Une migration présente dans le Store mais absente du Registry provoque une erreur bloquante `MigrationMissingError` | §24, §25, §33 |
| R6 | Convention de tri obligatoire : identifiant `module.version.sequence_name`, séquence numérique comparée numériquement (padding recommandé) | §40, §42, §49 |
| R7 | Deux sources de migrations (framework / applications) : `MigrationProvider` (`ownerId`) comme concept de premier ordre, namespace `owner.module.version.sequence_name`, Store conservant l'origine (upgrades, install/uninstall, audit, détection de conflits), lifecycle install/upgrade/uninstall distinct du rollback | §1, §2, §4, §5, §7, §11, §18, §19, §20, §21, §38, §39, §40, §41, §42, §43bis, §46, §47, §49 |
| R8 | Sémantique du Manifest : une application ne déclare que son espace local (`domain.migrations`) ; l'`owner` est ajouté par la couche de composition ; deux applications ne fusionnent jamais le même namespace | §38, §40, §49 |
| R9 | Deux règles de collision distinctes : collision d'**identité complète** (`owner.module.version.sequence`) et collision de **ressource SQL** (ex. `appA.users` vs `appB.users`) — deux validations séparées | §20, §40, §49 |
| R10 | Ordonnancement global explicite : framework bootstrap → modules framework → DAG de dépendances applicatives → migrations applicatives | §42, §49 |
| R11 | Cleanup migrations formalisées : même owner, propre checksum, auditées dans le Store, ne réutilisent jamais les migrations d'installation | §43bis, §49 |
| R12 | Contrat d'upgrade des Providers : le Provider présente son **état complet courant** ; le Planner calcule le delta vs Store. Décision à clôturer avant le système d'installation | §43ter, §20bis, §49 |
| R13 | **Migration Planner** : couche intermédiaire Registry → Planner → Runner produisant un `MigrationPlan` explicite (affichage, dry-run, audit, approbation Control Plane, reprise après interruption) | §20bis, §21, §22, §23, §24, §46, §47, §49 |
| R14 | **Idempotence du Planner** : deux appels avec le même état source (providers) et le même état cible (Store) produisent exactement le même plan — tests reproductibles, audit fiable, prévisualisation, reprise après interruption | §20bis, §43ter, §49 |

Invariants ADR associés :

* Le Migration Engine consomme le Manifest applicatif existant. Il ne possède
  aucune représentation parallèle du Manifest.
* Une migration est immuable après application. L'identité d'une migration est
  déterminée par son contenu chargé au runtime.
* La garantie de concurrence appartient à l'adaptateur de stockage, pas au
  Migration Runner.
* Le moteur exécute un graphe global déterministe de plusieurs sources de
  migrations (framework + applications). L'origine d'une migration est un
  concept de premier ordre (`MigrationProvider.ownerId`), mais le moteur ne
  distingue pas les sources.
* Le Global Migration Registry et le Migration Planner constituent la frontière
  entre la composition de plateforme et l'exécution.

---

# 1. Vision

Le **MosaiX Database Migration Engine** est le mécanisme standard de gestion des évolutions de schéma au sein de l'écosystème MosaiX.

Il permet à chaque domaine de déclarer l'évolution de son modèle de persistance indépendamment :

* du moteur SQL utilisé ;
* du runtime d'exécution ;
* d'un ORM ;
* d'une implémentation spécifique de base de données.

Le moteur de migration constitue une infrastructure du framework et ne contient aucune logique métier.

Le moteur est **unique** et alimente deux sources de migrations (R7) :

* les **migrations du framework MosaiX** (nécessaires au fonctionnement interne
  de la plateforme, publiées par `@mosaix/core`, `@mosaix/kernel`,
  `@mosaix/platform`) ;
* les **migrations des applications MosaiX** (publiées par chaque application,
  ex. `identity`, `sales`, `billing`).

Le moteur ne connaît pas la différence entre les sources. Cette distinction
appartient au niveau de composition : chaque source expose un
`MigrationProvider` portant un `ownerId`.

Il expose un modèle déclaratif permettant de décrire un schéma relationnel sous la forme d'un DSL indépendant des dialectes SQL.

Cette description est transformée en représentation intermédiaire (AST), puis compilée vers le dialecte SQL approprié avant son exécution par un adaptateur de base de données.

Le système est conçu pour fonctionner aussi bien :

* dans un navigateur avec SQLite/WASM ;
* sur Node.js ;
* sur Bun ;
* sur Deno ;
* dans des runtimes serverless ;
* avec PostgreSQL en production.

---

# 2. Objectifs

Le moteur de migration doit permettre à une application MosaiX de faire évoluer son schéma de manière reproductible, sécurisée et indépendante des technologies utilisées.

Les objectifs principaux sont :

* créer des migrations typées ;
* appliquer les migrations dans un ordre déterministe ;
* effectuer des rollbacks contrôlés ;
* suivre les migrations déjà exécutées ;
* gérer les batches de migration ;
* produire le SQL à partir d'un DSL indépendant ;
* fonctionner avec plusieurs dialectes SQL ;
* exécuter les migrations de manière transactionnelle lorsque le moteur le permet ;
* empêcher les exécutions concurrentes ;
* découvrir les migrations exclusivement via le Manifest applicatif ;
* agréger les migrations de plusieurs sources (framework + applications) en un
  graphe global déterministe (R7).

---

# 3. Non-objectifs

Le moteur de migration n'a pas vocation à :

* remplacer un ORM ;
* gérer les entités métier ;
* implémenter un repository ;
* gérer les tenants ;
* connaître les modules métier ;
* gérer les migrations NoSQL dans la première version ;
* générer automatiquement les migrations à partir d'un diff de schéma ;
* réaliser des migrations de données complexes.

Les migrations de données pourront être supportées ultérieurement via le `MigrationContext`, mais ne constituent pas un objectif du MVP.

---

# 4. Principes Architecturaux

Les principes suivants constituent des invariants de l'architecture.

Ils ne peuvent être remis en cause sans modification d'un ADR.

## 4.1 Ports avant implémentations

Le cœur du moteur dépend exclusivement de contrats.

Aucune dépendance directe vers SQLite, PostgreSQL ou toute autre technologie n'est autorisée.

```
Core

↓

Ports

↓

Adapters
```

## 4.2 Séparation entre schéma et SQL

Le DSL ne produit jamais directement du SQL.

Le SQL est exclusivement généré par une implémentation de `Grammar`.

```
Schema DSL

↓

Blueprint AST

↓

Grammar

↓

SQL
```

Cette séparation garantit :

* l'indépendance des moteurs ;
* la génération de plusieurs dialectes ;
* le support futur de nouveaux SGBD.

## 4.3 SQL comme détail d'infrastructure

Le moteur de migration ne connaît pas la syntaxe SQL.

Le SQL est considéré comme un détail d'implémentation.

Le cœur manipule uniquement des représentations abstraites du schéma.

## 4.4 Runtime agnostique

Aucune hypothèse ne peut être faite concernant :

* Node.js ;
* le filesystem ;
* les variables d'environnement ;
* les processus ;
* les threads.

Le moteur doit pouvoir fonctionner dans un runtime sans accès disque.

## 4.5 Manifest comme source de vérité

Les migrations sont découvertes exclusivement via les **manifests existants**
(`ApplicationManifest` de `@mosaix/contracts`, validé par `@mosaix/schemas`),
pour chaque source : framework et applications (R7).

Le moteur ne parcourt jamais directement le système de fichiers.

Le CLI peut utiliser le système de fichiers afin de générer des migrations, mais cette responsabilité lui appartient exclusivement.

## 4.6 Adaptateurs indépendants

Chaque moteur SQL fournit :

* son adaptateur `DatabasePort` ;
* sa `Grammar` ;
* ses mécanismes de verrouillage ;
* ses optimisations.

Le moteur de migration ne contient aucune logique spécifique à un SGBD.

## 4.7 Immutabilité des migrations

Une migration appliquée est considérée comme immuable.

Toute modification ultérieure est détectée par validation du checksum.

Le checksum est calculé au chargement de la migration (contenu réellement
exécuté), et enregistré au moment de son application.

Une migration modifiée après son exécution est considérée comme invalide.

## 4.8 Déterminisme

Deux applications possédant :

* le même Manifest ;
* les mêmes migrations ;
* les mêmes versions ;

doivent produire exactement le même schéma.

L'ordre d'exécution est déterminé par l'identifiant versionné
(`owner.module.version.sequence_name`, R7), comparé numériquement.

## 4.10 Sources multiples, moteur unique (R7)

Le moteur est unique et agnostique à l'origine des migrations.

Chaque source (framework ou application) publie un **Migration Bundle** via un
`MigrationProvider` portant un `ownerId`.

La distinction framework/application appartient à la couche de composition,
jamais au moteur.

## 4.9 Isolation des responsabilités

Le Runner :

* orchestre l'exécution ;
* ne génère jamais de SQL.

La Grammar :

* génère le SQL ;
* ne connaît pas le Runner.

Le DatabasePort :

* exécute le SQL ;
* ne connaît pas les migrations.

Le Schema Builder :

* construit un AST ;
* ne connaît pas la base de données.

---

# 5. Vue d'ensemble

```
      Framework Sources            Application Sources
      (framework migrations)       (app migrations)
            │                           │
            ▼                           ▼
   FrameworkMigrationProvider   ApplicationMigrationProvider
            │                           │
            └───────────┬───────────────┘
                        ▼
        Global Migration Registry
                        │
                        ▼
                 Migration Runner
                        │
                Migration Context
                        │
            ┌────────────┴────────────┐
            │                         │
            ▼                         ▼
      Schema Builder             DatabasePort
            │
            ▼
       Blueprint AST
            │
            ▼
         Grammar
            │
            ▼
      SQL Statements
            │
            ▼
      Database Adapter
            │
     ┌──────┴─────────┐
     │                │
 SQLite Adapter   PostgreSQL Adapter
```

---

# 6. Architecture des packages

```
@mosaix/ports-database
        ▲
        │
        │
@mosaix/migrations
        │
        ├──────────────┐
        │              │
        ▼              ▼
SQLite Adapter   PostgreSQL Adapter
```

Le package `@mosaix/migrations` dépend uniquement des ports.

Les adaptateurs SQL dépendent des ports ainsi que des bibliothèques natives nécessaires à leur implémentation.

Le CLI dépend du moteur de migration mais n'est jamais référencé par celui-ci.

Le Manifest applicatif vit dans `@mosaix/contracts` (types) et
`@mosaix/schemas` (validation Zod) — il n'existe **aucun** package
`@mosaix/manifest` dédié (Décision R1).

---

# 7. Responsabilités des packages

## `@mosaix/ports-database`

Définition des contrats d'accès aux bases de données.

Responsabilités :

* exécution SQL ;
* transactions ;
* capacités du moteur ;
* verrouillage des migrations.

Aucune implémentation.

## `@mosaix/migrations`

Contient l'intégralité du moteur de migration.

Responsabilités :

* Runner ;
* Store (conserve l'origine de chaque migration — R7) ;
* Schema Builder ;
* Blueprint AST ;
* Registry (agrégateur de `MigrationProvider`, R7) ;
* résolution des migrations ;
* validation des checksums ;
* orchestration des transactions.

Ce package ne dépend d'aucun moteur SQL.

## `@mosaix/adapter-database-sqlite`

Implémentation SQLite du `DatabasePort`.

Responsabilités :

* exécution SQL SQLite ;
* Grammar SQLite ;
* gestion des transactions SQLite ;
* mécanisme de verrouillage SQLite (adapter-dépendant, voir §28) ;
* compatibilité WASM ;
* **abstraction driver interne `SQLiteDriver`** (Décision R4) pour supporter
  `better-sqlite3` (Node), `sql.js` / `sqlite-wasm` (navigateur), OPFS (Worker)
  sans modifier le moteur.

## `@mosaix/adapter-database-postgres`

Implémentation PostgreSQL du `DatabasePort`.

Responsabilités :

* exécution SQL PostgreSQL ;
* Grammar PostgreSQL ;
* advisory locks ;
* transactions PostgreSQL ;
* optimisations spécifiques au moteur.

## Manifests (framework + applications)

Le **Manifest applicatif existant** (`ApplicationManifest` dans
`@mosaix/contracts`, validé par `@mosaix/schemas`) déclare les migrations de
chaque application.

Les sources framework publient leurs migrations système de la même manière
(`MosaixArtifactManifest` des packages système).

Le Migration Engine consomme l'ensemble des manifests ; il ne possède aucune
représentation parallèle (Décision R1).

La distinction framework/application est portée par le `ownerId` des
`MigrationProvider` (R7), jamais par le moteur.

## `@mosaix/cli`

Responsable uniquement de l'expérience développeur.

Le CLI :

* génère les fichiers ;
* lance le Runner ;
* affiche les erreurs ;
* présente les statuts ;
* n'implémente aucune logique métier de migration.

---

# 8. Contrats Publics

L'ensemble des packages du moteur de migration communiquent exclusivement via des contrats.

Ces contrats constituent l'API publique de l'infrastructure.

Aucun composant ne doit dépendre d'une implémentation concrète.

---

# 9. DatabasePort

## Responsabilité

`DatabasePort` représente l'unique point d'entrée permettant au moteur de migration d'interagir avec une base de données.

Le moteur ne connaît jamais le client SQL sous-jacent.

Les implémentations sont fournies par les adaptateurs.

## Contrat

```ts
export interface DatabasePort {

  execute(
    sql: string,
    params?: readonly unknown[]
  ): Promise<void>;

  query<T>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<readonly T[]>;

  transaction<T>(
    callback: () => Promise<T>
  ): Promise<T>;

  capabilities(): DatabaseCapabilities;

}
```

## Capacités

Chaque moteur déclare explicitement les fonctionnalités qu'il supporte.

```ts
export interface DatabaseCapabilities {

  transactions: boolean;

  savepoints: boolean;

  advisoryLocks: boolean;

  json: boolean;

  returning: boolean;

  alterTable: boolean;

}
```

Le Runner ne doit jamais effectuer de détection basée sur le type de la base de données.

Toute décision est prise à partir des capacités exposées.

---

# 10. MigrationLock

## Responsabilité

Le verrouillage des migrations constitue une responsabilité du moteur de base de données.

Chaque adaptateur fournit sa propre implémentation.

Le Runner dépend uniquement du contrat.

## Contrat

```ts
export interface MigrationLock {

  acquire(): Promise<void>;

  release(): Promise<void>;

  capabilities(): LockCapabilities;

}
```

## Capacités de verrouillage (R3)

```ts
export interface LockCapabilities {

  /** Verrou valable entre plusieurs instances/processus (ex. advisory lock PG). */
  distributed: boolean;

  /** Verrou valable entre plusieurs processus sur la même machine. */
  processSafe: boolean;

  /** Verrou valable dans l'instance runtime courante (ex. single-writer WASM). */
  runtimeSafe: boolean;

}
```

## Garanties par adaptateur (R3)

| Adaptateur | Stratégie | Garantie |
|------------|-----------|----------|
| PostgreSQL | advisory lock (`pg_try_advisory_lock`) | **distributed** |
| SQLite (Node, fichier) | `BEGIN EXCLUSIVE` / verrou moteur | **processSafe** |
| SQLite (navigateur) | OPFS locking, `SharedWorker` single-writer, ou mécanisme coopératif applicatif | **runtimeSafe** (single-writer explicite) |

## Règle

La garantie de concurrence appartient à l'adaptateur de stockage, pas au
Migration Runner (Invariant ADR R3).

Le Runner utilise `capabilities()` pour décider du niveau de confiance à
accorder, sans jamais connaître la stratégie sous-jacente.

---

# 11. Migration

Une migration représente une évolution atomique du schéma.

Une migration est :

* unique ;
* versionnée ;
* immuable après exécution ;
* portée par une source (`owner`).

## Métadonnées d'origine (R7)

Chaque migration porte un contexte d'origine :

```ts
export interface MigrationMetadata {

  /** Propriétaire : "framework" ou appId (ex. "identity", "sales"). */
  owner: string;

  module: string;

  version: string;

  sequence: number;

  name?: string;

}
```

L'origine (`owner`) est un concept de premier ordre. Elle permet :

* les upgrades du framework ;
* l'installation / la désinstallation des applications ;
* l'audit ;
* la détection des conflits de namespace entre sources.

## Contrat

```ts
export interface Migration {

  readonly id: string;

  readonly owner: string;

  readonly checksum: string;

  up(
    context: MigrationContext
  ): Promise<void>;

  down(
    context: MigrationContext
  ): Promise<void>;

}
```

## Identifiant

Chaque migration possède un identifiant unique et **namespacé par l'origine**
(R7).

Exemple :

```text
framework.database.v1.001_create_migrations

identity.users.v1.001_create_users

sales.orders.v2.004_create_orders
```

Format obligatoire :

```text
owner.module.version.sequence_name
```

Règles (R6 + R7) :

* `owner` : source de la migration ("framework" ou appId) — le namespace
  préfixé évite qu'une application et le framework publient accidentellement le
  même identifiant ;
* `module` : identifiant du module (domaine) ;
* `version` : version du module ;
* `sequence` : entier strictement croissant, **comparaison numérique et non
  lexicale** ;
* `name` : libellé descriptif optionnel.

L'identifiant est utilisé :

* pour le tri ;
* pour le stockage ;
* pour la résolution des dépendances.

Deux sources ne peuvent pas produire le même identifiant complet.

## Checksum (R2)

Le checksum représente l'empreinte cryptographique du **contenu chargé** de la migration.

Il est calculé au moment du **chargement** de la migration (R2), jamais à sa
génération :

```text
Migration Source

↓

Migration Loader

↓

Checksum Calculator

↓

Migration Registry

↓

Migration Runner
```

Le checksum enregistré dans le Store est celui réellement exécuté.

Lorsqu'une migration déjà exécutée possède un checksum différent de celui
chargé, l'exécution est interrompue (`MigrationChecksumError`).

Une migration appliquée ne peut jamais être modifiée.

---

# 12. MigrationContext

## Responsabilité

Le contexte fournit toutes les dépendances nécessaires à une migration.

Une migration ne reçoit jamais directement une connexion SQL.

## Contrat

```ts
export interface MigrationContext {

  readonly schema: SchemaBuilder;

  readonly database: DatabasePort;

  readonly logger: LoggerPort;

  readonly runtime: RuntimeInfo;

}
```

## Principes

Le contexte permet :

* de construire le schéma ;
* d'exécuter exceptionnellement du SQL brut ;
* de produire des logs ;
* d'obtenir des informations sur le runtime.

Les migrations de données futures utiliseront également ce contexte.

---

# 13. SchemaBuilder

## Responsabilité

Le SchemaBuilder expose un DSL déclaratif permettant de construire un schéma.

Il ne produit jamais directement du SQL.

Son unique responsabilité consiste à produire un Blueprint.

## Exemple

```ts
await context.schema.createTable(
  "users",
  table => {

    table.uuid("id").primary();

    table.string("email").unique();

    table.timestamp("created_at");

  }
);
```

Le résultat n'est pas une requête SQL.

Il s'agit d'une représentation intermédiaire.

---

# 14. Blueprint

Le Blueprint représente un arbre de description du schéma.

Il constitue la représentation indépendante du moteur SQL.

## Exemple

```json
{
  "type": "createTable",
  "table": "users",
  "columns": [
    {
      "name": "id",
      "type": "uuid",
      "primary": true
    },
    {
      "name": "email",
      "type": "string",
      "unique": true
    }
  ]
}
```

Le Runner ne manipule jamais de chaînes SQL.

---

# 15. Grammar

## Responsabilité

Une Grammar traduit un Blueprint vers un dialecte SQL.

Chaque moteur fournit sa propre implémentation.

## Contrat

```ts
export interface Grammar {

  compile(
    blueprint: Blueprint
  ): readonly SqlStatement[];

}
```

## Principes

Une Grammar :

* ne connaît pas les migrations ;
* ne connaît pas le Runner ;
* ne connaît pas le Manifest ;
* ne produit que du SQL.

## Implémentations

Le MVP fournit :

* SQLiteGrammar
* PostgresGrammar

De nouveaux dialectes pourront être ajoutés sans modification du moteur.

---

# 16. SqlStatement

Le SQL généré est représenté par une structure typée.

```ts
export interface SqlStatement {

  sql: string;

  params: readonly unknown[];

}
```

Cette représentation facilite :

* les paramètres préparés ;
* les logs ;
* les tests ;
* le mode dry-run ;
* la prévisualisation SQL.

---

# 16bis. SQLiteDriver (contrat interne de l'adaptateur, R4)

L'adaptateur SQLite ne parle jamais directement à un driver.

Il dépend d'un contrat interne à l'adaptateur :

```ts
export interface SQLiteDriver {

  execute(
    sql: string,
    params?: readonly unknown[]
  ): Promise<void>;

  query<T>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<readonly T[]>;

  begin(): Promise<void>;

  commit(): Promise<void>;

  rollback(): Promise<void>;

}
```

Implémentations fournies par l'adaptateur :

* Node : `better-sqlite3` ;
* Navigateur : `sql.js` / `sqlite-wasm` ;
* Worker : OPFS.

Cette abstraction permet de changer de driver sans modifier
`@mosaix/migrations` ni le reste de l'adaptateur.

---

# 17. MigrationStore

## Responsabilité

Le MigrationStore assure la persistance de l'état des migrations exécutées.

Il ne contient aucune logique de migration.

## Contrat

```ts
export interface MigrationStore {

  has(
    id: string
  ): Promise<boolean>;

  record(
    migration: ExecutedMigration
  ): Promise<void>;

  remove(
    id: string
  ): Promise<void>;

  latestBatch(): Promise<number>;

  executed(): Promise<
    readonly ExecutedMigration[]
  >;

}
```

---

# 18. ExecutedMigration

```ts
export interface ExecutedMigration {

  id: string;

  owner: string;

  checksum: string;

  batch: number;

  executedAt: Date;

}
```

Le `owner` est conservé (R7) pour permettre :

* les upgrades du framework ;
* l'installation / la désinstallation des applications ;
* l'audit ;
* la détection des conflits de migrations.

---

# 19. Table système

Le moteur crée automatiquement la table système.

Nom :

```text
mosaix_migrations
```

Structure minimale :

| Colonne     | Type     | Description                        |
| ----------- | -------- | ---------------------------------- |
| id          | string   | Identifiant unique de la migration |
| owner       | string   | Source : "framework" ou appId      |
| checksum    | string   | Empreinte de validation            |
| batch       | integer  | Numéro du batch                    |
| executed_at | datetime | Date d'exécution                   |

Le checksum enregistré est celui **réellement exécuté** (R2).

Le `owner` est conservé (R7) pour permettre upgrades, install/uninstall, audit
et détection de conflits.

Le schéma exact est laissé à la responsabilité des adaptateurs.

Le moteur ne dépend jamais d'une représentation SQL spécifique.

---

# 20. MigrationProvider et Global Registry (R7)

Le moteur n'ingère pas un seul Manifest : il ingère **une source par
propriétaire**.

Chaque source expose un `MigrationProvider`.

## Contrat

```ts
export interface MigrationProvider {

  ownerId(): string;

  migrations(): readonly Migration[];

}
```

Exemples :

```ts
FrameworkMigrationProvider        // ownerId = "framework"
ApplicationMigrationProvider("identity")
ApplicationMigrationProvider("sales")
```

## Global Migration Registry

Le Registry est un **agrégateur** de providers :

```text
Framework Manifest
        |
        +
Application Manifests
        |
        ▼
Global Migration Registry
        |
        ▼
Migration Planner
        |
        ▼
Migration Runner
```

Le Registry :

* compose les providers en un graphe global ;
* valide les collisions (deux règles distinctes, R9) ;
* ne parcourt jamais le système de fichiers ;
* est alimenté exclusivement par les manifests (R1).

### Collisions — deux validations distinctes (R9)

1. **Collision d'identité complète** : deux sources ne peuvent pas produire le
   même identifiant `owner.module.version.sequence_name`. Cette collision est
   bloquante au chargement (`MigrationConflictError`).

2. **Collision de ressource SQL** : deux sources ne peuvent pas créer la même
   ressource relationnelle (ex. `appA.users` et `appB.users` créant tous deux
   une table `users`). Cette validation relève de la `Grammar`/du Blueprint :
   elle est effectuée lors de la **compilation**, après résolution des modules
   dépendants, et détectée par comparaison des Blueprints (`alterTable`,
   `createTable`, …) du plan global.

Les deux problèmes sont distincts et nécessitent deux mécanismes séparés :
l'un au niveau des identifiants (Registry), l'autre au niveau des ressources
SQL (Planner/compilation).

Le Registry constitue le point d'entrée unique des migrations dans le moteur.

Le moteur ne connaît pas la différence framework/application : il ne voit que
des providers portant un `ownerId` (R7).

---

# 20bis. Migration Planner (R13)

## Responsabilité

Le Planner transforme le graphe global des migrations en un **plan d'exécution
explicite**.

Il calcule le delta entre :

* les migrations déclarées (Registry) ;
* les migrations déjà exécutées (Store).

Il produit un `MigrationPlan` ordonné, prêt à être exécuté ou affiché.

## Contrat

Le `MigrationPlan` est **immuable** : il est calculé une fois par le Planner,
puis transmis tel quel au Runner.

```ts
export interface PlannedMigration {

  readonly migration: Migration;

  readonly operation: "up" | "down";

}

export interface MigrationPlan {

  readonly id: string;

  readonly createdAt: Date;

  readonly sourceVersion: string;

  readonly operations: readonly PlannedMigration[];

}
```

Le Runner reçoit un plan déjà calculé. Il ne peut pas le transformer :
un plan `A → B → C` ne peut pas devenir `A → C`.

Le Planner est **idempotent et déterministe** (R14) : deux appels avec le même
état source (providers) et le même état cible (Store) produisent exactement le
même plan — tests reproductibles, audit fiable, prévisualisation, reprise après
interruption.

Exemple de plan :

```text
1. framework.database.v1.001        (up)
2. framework.identity.v1.001        (up)
3. app.crm.users.v1.001             (up)
4. app.crm.contacts.v1.001          (up)
```

## Position dans le pipeline

```text
Providers
    ↓
Global Migration Registry
    ↓
Migration Planner
    ↓
Migration Runner
```

## Responsabilités

Le Planner :

* calcule le delta Registry ↔ Store ;
* applique l'ordonnancement global (R10) et le DAG de dépendances ;
* détecte les collisions de ressources SQL au niveau Blueprint (R9) ;
* produit un plan **explicite et révisable** avant toute exécution ;
* permet la reprise après interruption (le plan est recalculé à chaque
  invocation, l'état réel restant le Store).

## Usages

Le plan permet :

* l'affichage avant installation (CLI `migrate --dry-run`) ;
* le dry-run sans effet de bord ;
* l'audit (plan et résultat journalisés) ;
* l'approbation éventuelle par le Control Plane ;
* la reprise après interruption (seules les opérations non enregistrées dans le
  Store sont replanifiées).

Le Planner ne génère jamais de SQL et n'exécute rien : il orchestre la
décision, le Runner exécute.

---

# 21. Pipeline d'exécution

Le moteur applique une migration selon un pipeline déterministe.

Chaque étape possède une responsabilité unique.

```text
Framework Provider + Application Providers
    │
    ▼
Global Migration Registry
    │
    ▼
Migration Planner
    │
    ▼
Migration Runner
    │
    ▼
Migration Context
    │
    ▼
Schema Builder
    │
    ▼
Blueprint AST
    │
    ▼
Grammar
    │
    ▼
SQL Statements
    │
    ▼
DatabasePort
    │
    ▼
Database
```

Le SQL n'existe qu'à la fin du pipeline.

Toutes les couches précédentes manipulent exclusivement des abstractions.

---

# 22. Migration Runner

## Responsabilité

Le Runner orchestre l'ensemble du processus d'exécution.

Il ne possède aucune connaissance :

* du dialecte SQL ;
* du moteur de base de données ;
* du système de fichiers ;
* du Manifest ;
* du DSL.

Il coordonne uniquement les différents composants.

## Responsabilités

Le Runner doit :

* recevoir le plan produit par le **Migration Planner** (R13) ;
* récupérer les migrations déjà exécutées (Store) ;
* vérifier les checksums ;
* acquérir un verrou ;
* ouvrir une transaction lorsque le moteur le permet ;
* exécuter les opérations du plan ;
* enregistrer leur état ;
* libérer le verrou.

Le Runner n'exécute que le plan qui lui est fourni : il ne détermine pas
lui-même les migrations restantes (cette responsabilité appartient au Planner).

## Responsabilités exclues

Le Runner ne doit jamais :

* générer du SQL ;
* parser un Blueprint ;
* accéder directement à SQLite ;
* accéder directement à PostgreSQL ;
* connaître les détails d'un adaptateur.

---

# 23. Séquence d'exécution

```text
Runner
    │
    ├────────► Registry
    │             │
    │             ▼
    │     Liste des migrations
    │
    ├────────► Planner
    │             │
    │             ▼
    │     Migration Plan
    │
    ├────────► Store
    │             │
    │             ▼
    │     Migrations exécutées
    │
    ├────────► Validation checksum
    │
    ├────────► Acquisition du verrou
    │
    ├────────► Transaction
    │
    ├────────► up()
    │
    ├────────► Store.record()
    │
    ├────────► Commit
    │
    └────────► Release Lock
```

Chaque étape est atomique.

---

# 24. Détermination des migrations

Le **Migration Planner** calcule la liste des migrations à appliquer à partir
de (R13) :

* la liste déclarée dans le Registry ;
* les migrations enregistrées dans le Store.

Il produit un `MigrationPlan` que le Runner exécute ensuite.

Une migration est considérée comme applicable si :

* son identifiant est absent du Store.

Une migration est considérée comme invalide si :

* son identifiant existe ;
* son checksum est différent.

Dans ce cas, l'exécution est immédiatement interrompue.

**Migration manquante (R5)** : une migration présente dans le Store mais
**absente du Registry** (ex. supprimée du Manifest) provoque une erreur
bloquante `MigrationMissingError` :

```text
Store:
  identity.users.v1.001_create_users

Registry:
  (absent)

Résultat:
  MigrationMissingError
```

Le système refuse de continuer. Le Store doit représenter l'état réel de la
base : une exécution ne peut pas se faire sur un sous-ensemble silencieusement
réduit.

---

# 25. Validation des checksums

Avant toute exécution, le Runner compare les checksums **calculés au chargement**
des migrations (R2) avec ceux enregistrés dans le Store.

```text
Registry
    │
    ▼
Migration
    │
    │ checksum (chargé)
    ▼
Store
```

Les règles sont les suivantes :

Si la migration n'existe pas :

→ elle peut être exécutée.

Si la migration existe avec le même checksum :

→ elle est ignorée.

Si la migration existe avec un checksum différent :

→ `MigrationChecksumError`.

Si la migration existe dans le Store mais pas dans le Registry :

→ `MigrationMissingError` (R5).

Une migration appliquée est immuable.

---

# 26. Transactions

Lorsque le moteur supporte les transactions, l'exécution d'une migration est atomique.

```text
BEGIN

↓

Migration

↓

Store

↓

COMMIT
```

En cas d'erreur :

```text
BEGIN

↓

Migration

↓

Erreur

↓

ROLLBACK
```

Le comportement dépend exclusivement des capacités du `DatabasePort`.

---

# 27. Savepoints

Lorsque le moteur les supporte, les savepoints peuvent être utilisés pour améliorer la granularité des erreurs.

Cette optimisation est facultative.

Le moteur ne dépend jamais de leur présence.

---

# 28. Verrouillage (R3)

Une seule instance du Runner peut modifier le schéma à un instant donné.

Avant toute exécution :

```text
Acquire Lock

↓

Migration

↓

Release Lock
```

La stratégie de verrouillage et **la garantie de concurrence qui en découle**
appartiennent à l'adaptateur, pas au Runner (Invariant ADR R3).

| Adaptateur | Stratégie | Garantie |
|------------|-----------|----------|
| PostgreSQL | advisory lock | distributed |
| SQLite (Node) | `BEGIN EXCLUSIVE` / verrou moteur | processSafe |
| SQLite (navigateur) | OPFS locking, `SharedWorker` single-writer, ou mécanisme coopératif applicatif | runtimeSafe (single-writer explicite) |

Le Runner consulte `MigrationLock.capabilities()` pour connaître le niveau de
garantie réel. Dans un environnement où seule la garantie `runtimeSafe` est
disponible, la protection multi-instance est documentée comme limitée (ex.
navigateur : single-writer applicatif).

Le Runner ne dépend que du contrat `MigrationLock`.

---

# 29. Rollback

Le rollback consiste à exécuter les méthodes `down()` des migrations.

L'ordre est toujours inverse de celui de leur application.

```text
001

002

003
```

Rollback :

```text
003

002

001
```

Cette règle constitue un invariant.

---

# 30. Gestion des batches

Toutes les migrations exécutées lors d'une même opération appartiennent au même batch.

Exemple :

```text
Batch 1

001

002

003
```

Puis :

```text
Batch 2

004

005
```

Le rollback sans paramètre annule le dernier batch.

---

# 31. Rollback par nombre d'étapes

Le moteur peut également annuler un nombre précis de migrations.

Exemple :

```text
migrate:rollback --step=3
```

Le Runner sélectionne les trois dernières migrations exécutées.

L'ordre reste toujours inversé.

---

# 32. Échec d'une migration

Une migration est considérée comme échouée lorsqu'une exception est levée durant :

* la génération du Blueprint ;
* la compilation SQL ;
* l'exécution SQL ;
* l'enregistrement dans le Store.

Dans ce cas :

* la transaction est annulée ;
* le Store reste inchangé ;
* le verrou est libéré.

Le système revient dans son état précédent.

---

# 33. Hiérarchie des erreurs

Le moteur expose une hiérarchie d'erreurs typées.

Exemple :

```text
MigrationError
├── MigrationConflictError
├── MigrationChecksumError
├── MigrationMissingError
├── MigrationAlreadyAppliedError
├── MigrationLockError
├── MigrationTransactionError
├── MigrationCompilationError
├── BlueprintValidationError
└── MigrationExecutionError
```

Le CLI traduit ces erreurs en messages destinés à l'utilisateur.

Le cœur ne contient aucune logique d'affichage.

---

# 34. Génération du Blueprint

Le Schema Builder construit un arbre décrivant les opérations à effectuer.

Exemple :

```text
createTable

↓

columns

↓

indexes

↓

constraints
```

Le Builder ne produit jamais :

* de SQL ;
* de requêtes ;
* de connexion ;
* d'accès à la base.

---

# 35. Compilation

Une Grammar transforme un Blueprint en une séquence de commandes SQL.

```text
Blueprint

↓

Grammar

↓

CREATE TABLE ...

CREATE INDEX ...

ALTER TABLE ...
```

Chaque moteur possède sa propre Grammar.

Le Runner ignore totalement laquelle est utilisée.

---

# 36. Exécution SQL

Le résultat de la compilation est une liste de `SqlStatement`.

```text
Blueprint

↓

Grammar

↓

SqlStatement[]

↓

DatabasePort.execute()
```

Chaque instruction est exécutée dans l'ordre produit par la Grammar.

---

# 37. Invariants d'exécution

Le moteur garantit les propriétés suivantes :

* une migration n'est jamais exécutée deux fois ;
* une migration appliquée est immuable ;
* le SQL est toujours généré par une Grammar ;
* une seule instance peut modifier le schéma simultanément (au niveau de la
  garantie fournie par l'adaptateur, §28) ;
* l'ordre des migrations est déterministe ;
* le rollback s'effectue dans l'ordre inverse ;
* le Store représente toujours l'état réel de la base (y compris la détection
  des migrations manquantes du Registry, R5) ;
* aucune dépendance directe vers un moteur SQL n'existe dans le Runner ;
* l'échec d'une migration laisse le système dans un état cohérent grâce aux transactions lorsque celles-ci sont disponibles.

---

# 38. Manifest (R1 + R7)

## Responsabilité

Le **Manifest applicatif existant** (`ApplicationManifest` dans
`@mosaix/contracts`) constitue la source de vérité des migrations d'une
application.

Les sources framework déclarent leurs migrations système via leurs manifests
(`MosaixArtifactManifest` des packages système). Chaque source devient un
`MigrationProvider` (R7).

La validation Zod vit dans `@mosaix/schemas`.

Le moteur de migration ne découvre jamais les migrations par inspection du système de fichiers.

Cette responsabilité appartient exclusivement aux outils de développement.

## Déclaration

Exemple (champ existant `ApplicationManifest.domain.migrations`) :

```json
{
  "domain": {
    "migrations": [
      "users.v1",
      "orders.v2",
      "invoices.v1"
    ]
  }
}
```

Chaque entrée représente un module de migration **dans le namespace de la
source** (l'application) : le `MigrationProvider` préfixe l'`ownerId` (appId)
pour produire l'identifiant complet `owner.module.version.sequence_name` (R7).

## Sémantique du Manifest (R8)

Règles de composition :

* le Manifest d'une application ne déclare que son **espace local**
  (`domain.migrations`) ;
* l'`owner` est ajouté par la **couche de composition** (le provider), jamais
  par le Manifest lui-même ;
* deux applications ne peuvent **jamais fusionner le même namespace** : la
  ressource relationnelle produite est toujours namespacée par l'origine ;
* le Manifest ne décrit pas la manière dont les migrations sont exécutées.

Le Manifest décrit uniquement ce qui compose l'application.

Il ne décrit jamais la manière dont les migrations sont exécutées.

## Principes

Le Manifest garantit :

* une découverte déterministe ;
* un fonctionnement identique sur tous les runtimes ;
* l'absence de dépendance au système de fichiers ;
* une composition explicite des domaines.

## Invariant ADR (R1)

> Le Migration Engine consomme le Manifest applicatif existant. Il ne possède
> aucune représentation parallèle du Manifest.

---

# 39. Migration Registry

Le Registry est construit à partir de l'agrégation des manifests validés
(framework + applications), via les `MigrationProvider` (R7).

```text
Framework Manifest + Application Manifests
    │
    ▼
Migration Providers (par owner)
    │
    ▼
Global Migration Registry
    │
    ▼
Migration Runner
```

Le Runner ne lit jamais directement les manifests.

---

# 40. Modules de migration et sources (R7)

Les migrations sont organisées par **sources** (owner) puis par **modules**.

Exemple :

```text
framework.database.v1

identity.users.v1

sales.orders.v2

billing.invoices.v1
```

Chaque module constitue une unité de versionnement indépendante.

Un module contient une séquence ordonnée de migrations.

Exemple :

```text
identity.users.v1

001_create_users

002_add_email

003_add_indexes
```

L'ordre est strictement croissant.

## Convention de tri (R6 + R7)

Format obligatoire : `owner.module.version.sequence_name`.

Règles :

* `owner` : "framework" ou appId — le namespace préfixé empêche toute collision
  entre sources ;
* `sequence` est numérique, **comparé numériquement** (jamais lexicalement) ;
* le padding (`001`, `002`, …) est recommandé pour la lisibilité mais n'est
  pas l'autorité de tri ;
* deux migrations du même module ne peuvent pas partager la même séquence ;
* deux sources ne peuvent pas produire le même identifiant complet (collision
  d'identité, R9 — détectée au chargement).

Cette convention garantit l'ordre déterministe indépendant du nom des fichiers.

La collision d'identité (identifiant complet) et la collision de ressource SQL
(schema relationnel partagé) sont **deux validations distinctes** (R9) :
la première relève du Registry, la seconde du Planner au niveau Blueprint.

---

# 41. Graphe de dépendances

Les modules peuvent déclarer des dépendances.

Exemple (modules namespacés par source) :

```text
sales.orders.v2

↓

identity.users.v1
```

Les dépendances forment un **graphe orienté acyclique (DAG)**.

Les cycles sont interdits.

Le moteur résout automatiquement l'ordre global d'exécution à partir de ce graphe.

## Invariants

Le moteur garantit que :

* un module est exécuté après toutes ses dépendances ;
* un cycle provoque une erreur de démarrage ;
* le résultat est déterministe.

---

# 42. Ordonnancement global

L'ordre final est obtenu par (R10) :

1. **framework bootstrap** : migrations d'installation du framework
   (`framework.*`) ;
2. **modules framework** : migrations de maintenance du framework ;
3. **DAG des dépendances applicatives** : résolution des dépendances entre
   modules d'applications ;
4. **migrations applicatives** : tri des migrations à l'intérieur de chaque
   module (séquence numérique, R6).

```text
Framework bootstrap
        ↓
Framework modules
        ↓
Application dependencies DAG
        ↓
Application migrations
```

Exemple :

```text
framework.database.v1

001

002

↓

identity.users.v1

001

002

003

↓

sales.orders.v2

001

002
```

Le Runner ne dépend jamais du nom des fichiers.

Le graphe global est déterministe : même ensemble de providers → même ordre.

Le Migration Planner applique cet ordre lors de la construction du plan (R13).

---

# 43. Compatibilité des versions

Une nouvelle version d'un module constitue un nouveau module.

Exemple (module namespacé par source) :

```text
identity.users.v1

identity.users.v2
```

Le moteur ne fusionne jamais automatiquement plusieurs versions.

La stratégie de migration entre versions est définie par le module lui-même.

---

# 43bis. Cycle de vie des sources (R7)

Le cycle complet d'une source (framework ou application) :

```text
Framework install
        |
        ▼
Framework migrations


App install
        |
        ▼
App migrations


Framework upgrade
        |
        ▼
Framework migrations nouvelles


App upgrade
        |
        ▼
App migrations nouvelles


App uninstall
        |
        ▼
App cleanup migrations
```

Le moteur exécute uniquement les migrations déclarées par les providers
présents.

Les migrations d'une source désinstallée sont retirées de la composition ; le
Store conserve leur historique et leur origine pour l'audit.

## Rollback ≠ Uninstall

Les deux concepts restent séparés :

* **rollback** : opération de développement — retour à un batch précédent via
  `down()` ;
* **uninstall** : opération administrative — suppression volontaire d'un
  composant installé, via des **cleanup migrations** dédiées de la source.

`down()` n'est jamais utilisé comme mécanisme de désinstallation d'une
application.

## Cleanup migrations (R11)

Une cleanup migration est une migration de désinstallation, formalisée ainsi :

* elle appartient au **même owner** que la source désinstallée ;
* elle possède son **propre checksum** (calculé au chargement, R2) ;
* elle est **auditée dans le Store** comme toute autre migration
  (`ExecutedMigration` avec `owner`) ;
* elle **ne réutilise jamais les migrations historiques d'installation** : elle
  est déclarée et versionnée indépendamment par la source.

Le Planner traite les cleanup migrations comme des opérations du plan
(ordre inverse de l'installation pour la suppression des ressources propres à
la source), sans conflit avec le rollback de développement.

---

# 43ter. Upgrade d'un Provider (R12)

## Modèle retenu (confirmé dans ADR-0006 le 2026-08-06)

Le modèle d'upgrade suit **desired state → plan**, cohérent avec un Control
Plane (analogue Kubernetes / Terraform) :

```text
Provider State (état complet courant)
      +
Database State (Store)
      ↓
Migration Planner
      ↓
Desired Transition (MigrationPlan)
      ↓
Migration Runner
      ↓
DatabasePort
```

### Règles

* le **Provider expose l'état complet courant** de ses migrations (le Manifest
  de `identity-app v2` déclare l'intégralité de ses modules et migrations) ;
* le **Planner compare cet état avec le Store** existant ;
* le Planner produit un **delta d'exécution déterministe** ;
* le **Runner exécute uniquement le plan validé** ;
* le **Runner ne calcule jamais un upgrade lui-même**.

### Application du delta

Le Planner :

* ignore les migrations déjà exécutées et inchangées (checksum identique, R2) ;
* planifie les migrations nouvelles ;
* détecte une migration modifiée après application par checksum
  (`MigrationChecksumError`).

### Alternatives écartées

1. **Delta fourni par le Provider** — écarté : couplerait la logique de
   planification aux sources, contre la frontière Registry/Planner/Runner.
2. **Plan généré par le Provider** — écarté : même raison (le Provider ne
   décide jamais du plan).

### Conséquences

* sources purement déclaratives (aucune logique de delta) ;
* déterminisme du moteur (même état courant → même plan) ;
* reprise après interruption (le plan est recalculé à chaque invocation) ;
* idempotence du Planner (même état source + même état cible → même plan,
  R14).

Cette décision est **clôturée** : elle conditionnait le contrat
`MigrationProvider.migrations()` et la sémantique de la version d'un provider —
désormais figées dans ADR-0006.

---

# 44. Interface CLI

Le package `@mosaix/cli` fournit l'expérience développeur.

Il n'implémente aucune logique de migration.

Toutes les opérations passent par les API publiques du moteur.

## Commandes

Création :

```bash
mosaix migrate:create create_users
```

Application :

```bash
mosaix migrate
```

Statut :

```bash
mosaix migrate:status
```

Rollback du dernier batch :

```bash
mosaix migrate:rollback
```

Rollback par nombre d'étapes :

```bash
mosaix migrate:rollback --step=3
```

Prévisualisation SQL (future) :

```bash
mosaix migrate --dry-run
```

---

# 45. Responsabilités du CLI

Le CLI est responsable de :

* générer les fichiers de migration ;
* afficher les erreurs ;
* afficher la progression ;
* afficher le statut ;
* lancer le Runner.

Le CLI n'est jamais responsable :

* de générer du SQL ;
* d'exécuter les migrations ;
* de gérer les transactions ;
* de résoudre les dépendances.

---

# 46. Roadmap

## Phase 0 — Validation d'architecture

Objectif :

Valider les invariants, dont les décisions R1-R14 (figées dans ADR-0006).

Livrables :

* `DatabasePort`
* `MigrationLock`
* `MigrationStore`
* `MigrationRunner`
* adaptateur SQLite mémoire
* première migration fonctionnelle

Critère de succès :

Créer une table SQLite uniquement via le pipeline complet.

## Phase 1 — Core Migration Engine

Livrables :

* Runner
* Registry
* **Migration Planner (R13)**
* Store
* transactions
* verrouillage
* validation des checksums (au chargement, R2)
* détection des migrations manquantes (R5)
* batches
* rollback
* tests unitaires

## Phase 2 — Schema Builder

Livrables :

* DSL
* Blueprint
* AST
* validation
* compilation

Fonctionnalités minimales :

* createTable
* dropTable
* addColumn
* dropColumn
* renameColumn
* renameTable
* index
* unique
* foreignKey
* nullable
* default
* json
* enum
* uuid
* timestamp

## Phase 3 — SQLite Adapter

Livrables :

* SQLite Grammar
* SQLite DatabasePort
* SQLite MigrationLock (capacités R3)
* **abstraction `SQLiteDriver`** (R4) : `better-sqlite3` (Node), `sql.js` /
  `sqlite-wasm` (navigateur), OPFS (Worker)
* compatibilité WASM
* compatibilité Workers
* tests navigateur

Objectif :

Support complet du mode local-first.

## Phase 4 — PostgreSQL Adapter

Livrables :

* PostgreSQL Grammar
* PostgreSQL DatabasePort
* advisory locks
* transactions
* optimisation PostgreSQL

## Phase 5 — CLI

Livrables :

* génération des migrations (identifiants namespacés par owner, R7)
* auto-discovery via Manifest
* affichage du statut
* rollback
* logs
* erreurs détaillées

## Phase 6 — Modules et sources

Livrables :

* `MigrationProvider` et Global Registry (R7)
* **Migration Planner et `MigrationPlan` (R13)**
* résolution des dépendances
* DAG
* modules versionnés et namespacés par owner (R7)
* compatibilité multi-domaines
* **deux validations de collision** : identité complète + ressource SQL (R9)
* **ordonnancement global explicite** : framework bootstrap → modules framework
  → DAG applicatif → migrations applicatives (R10)
* convention de tri numérique (R6)
* Store avec origine (upgrades, install/uninstall, audit)
* **cleanup migrations (R11)** et contrat d'upgrade des providers (R12)

## Phase 7 — Production Hardening

Livrables :

* dry-run (via `MigrationPlan`, R13)
* affichage du plan avant installation
* prévisualisation SQL
* audit trail (plans et exécutions journalisés)
* hook d'approbation Control Plane
* métriques
* monitoring
* hooks d'observabilité
* optimisation des performances

---

# 47. Critères d'acceptation

Le moteur est considéré comme terminé lorsque les conditions suivantes sont réunies.

## Fonctionnelles

* une application peut créer son schéma via des migrations ;
* plusieurs migrations peuvent être exécutées dans un ordre déterministe ;
* le rollback fonctionne ;
* les batches sont correctement suivis ;
* les checksums empêchent toute modification d'une migration appliquée ;
* deux exécutions concurrentes ne peuvent pas modifier le schéma simultanément
  (au niveau de la garantie fournie par l'adaptateur, §28) ;
* une migration supprimée du Manifest après application bloque l'exécution
  (`MigrationMissingError`) ;
* les migrations du framework et des applications sont agrégées en un graphe
  global déterministe, sans collision d'identifiants (R7) ;
* le Store conserve l'origine de chaque migration (upgrades framework,
  install/uninstall d'applications, audit, détection de conflits) ;
* le Migration Planner produit un `MigrationPlan` révisable avant exécution
  (R13) ;
* les collisions sont détectées par deux validations distinctes : identité
  complète et ressource SQL (R9) ;
* l'ordre global suit : framework bootstrap → modules framework → DAG
  applicatif → migrations applicatives (R10) ;
* les cleanup migrations sont formalisées (même owner, propre checksum, audit
  Store, ne réutilisent pas les migrations d'installation — R11).

## Architecturales

* aucune dépendance directe vers SQLite ou PostgreSQL n'existe dans le cœur ;
* le SQL est exclusivement généré par une `Grammar` ;
* le Runner ne dépend que de contrats ;
* le Manifest applicatif est l'unique source de découverte des migrations ;
* le moteur est unique et agnostique à l'origine : la distinction
  framework/application appartient aux `MigrationProvider` (R7) ;
* les adaptateurs implémentent uniquement les ports publics ;
* l'adaptateur SQLite est driver-agnostique (abstraction `SQLiteDriver`) ;
* le moteur est compatible avec plusieurs runtimes.

## Développeur

Une migration standard peut être créée et appliquée en moins de trente secondes.

Exemple :

```bash
mosaix migrate:create create_users

mosaix migrate
```

Aucune configuration spécifique au moteur SQL n'est nécessaire dans le code de la migration.

---

# 48. Décisions reportées

Les éléments suivants ne font pas partie du MVP.

Ils pourront être traités dans des ADR dédiés.

* migrations de données ;
* génération automatique de migrations par diff de schéma ;
* support des bases NoSQL ;
* visualisation du graphe des migrations ;
* génération de documentation du schéma ;
* migration distribuée ;
* exécution parallèle de migrations indépendantes ;
* snapshots de schéma ;
* génération de SQL optimisée par moteur ;
* API de plugins pour le DSL.

---

# 49. Résumé des invariants

Les invariants suivants définissent l'architecture du moteur.

* Le cœur dépend exclusivement de ports.
* Le SQL est exclusivement généré par une `Grammar`.
* Le `SchemaBuilder` produit un `Blueprint` et jamais du SQL.
* Le `Runner` orchestre l'exécution sans connaître les moteurs SQL.
* Le `DatabasePort` constitue l'unique interface d'accès aux bases de données.
* Les migrations sont immuables après leur première exécution.
* Le checksum est calculé au chargement et enregistré à l'exécution (R2).
* Toute modification d'une migration appliquée est détectée par checksum.
* Le Manifest applicatif est l'unique source de découverte des migrations (R1).
* Les dépendances entre modules forment un graphe orienté acyclique.
* L'ordre des migrations est déterminé par l'identifiant versionné
  `owner.module.version.sequence_name`, comparé numériquement (R6 + R7).
* Le moteur est unique et agnostique à l'origine des migrations : la
  distinction framework/application appartient aux `MigrationProvider` (R7).
* Chaque source publie un Migration Bundle via un `MigrationProvider`
  (`ownerId`, `migrations`).
* Le Store conserve l'origine de chaque migration (upgrades, install/uninstall,
  audit, détection de conflits).
* Le rollback (`down()`) est séparé de la désinstallation (cleanup migrations).
* Les migrations manquantes du Registry sont des erreurs bloquantes (R5).
* La garantie de concurrence appartient à l'adaptateur de stockage, pas au
  Runner (R3).
* Les adaptateurs SQL sont des détails d'infrastructure et peuvent être
  remplacés sans modifier le moteur.
* L'adaptateur SQLite est driver-agnostique via un contrat interne
  `SQLiteDriver` (R4).

* Le manifest applicatif ne déclare que son espace local ; l'owner est ajouté
  par la couche de composition (R8).
* Deux validations de collision distinctes : identité complète (Registry) et
  ressource SQL (Planner, niveau Blueprint) (R9).
* L'ordre global est : framework bootstrap → modules framework → DAG des
  dépendances applicatives → migrations applicatives (R10).
* Les cleanup migrations sont formalisées : même owner, propre checksum, audit
  Store, jamais de réutilisation des migrations d'installation (R11).
* Le Migration Planner sépare la décision (plan) de l'exécution (Runner) (R13).

---

# Annexe A — Décisions figées dans ADR-0006

ADR-0006 — Database Port and Migration Engine Architecture doit figer :

1. Le Manifest applicatif est la source unique.
2. `@mosaix/migrations` dépend uniquement des ports.
3. Le SQL est généré exclusivement via Grammar.
4. Le checksum est calculé au chargement.
5. Les migrations appliquées sont immuables.
6. Le locking est une responsabilité des adapters.
7. SQLite possède une abstraction driver interne.
8. Les migrations manquantes sont des erreurs bloquantes.
9. L'ordre des migrations est déterministe par identifiant versionné.
10. Le moteur est unique ; les sources (framework / applications) sont des
    `MigrationProvider` portant un `ownerId` — le moteur ne distingue pas les
    sources.
11. L'identifiant est namespacé par l'origine :
    `owner.module.version.sequence_name`.
12. Le Store conserve l'origine de chaque migration (upgrades, install /
    uninstall, audit, détection de conflits).
13. Rollback et désinstallation sont deux concepts séparés ; `down()` n'est pas
    un mécanisme d'uninstall.
14. Le Manifest d'une application ne déclare que son espace local ; l'owner est
    ajouté par la couche de composition (R8).
15. Collision : deux validations distinctes — identité complète
    (`owner.module.version.sequence_name`) au chargement, et ressource SQL au
    niveau Blueprint/compilation (R9).
16. Ordonnancement global : framework bootstrap → modules framework → DAG des
    dépendances applicatives → migrations applicatives (R10).
17. Cleanup migrations : mêmes règles que les migrations d'installation (owner,
    checksum, audit Store) ; jamais de réutilisation des migrations
    d'installation (R11).
18. Upgrade des providers : **desired state → plan** — le provider expose son
    état complet courant, le Planner compare avec le Store et produit un delta
    déterministe, le Runner exécute uniquement le plan validé et ne calcule
    jamais un upgrade lui-même (R12, confirmée dans ADR-0006).
19. Migration Planner : un plan explicite (`MigrationPlan`) est calculé avant
    toute exécution ; le Runner exécute le plan, il ne le détermine pas (R13).
20. Idempotence du Planner : deux appels avec le même état source et le même
    état cible produisent exactement le même plan (R14).

Ces décisions sont issues du rapport de faisabilité
`.project/reports/feasibility-prd-0006-2026-08-06.md` et de la décision
architecte du 2026-08-06. Elles sont figées dans
`ADR-0006-database-port-migration-engine.md`.
