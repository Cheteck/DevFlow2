# ADR-0006 — Database Port and Migration Engine Architecture

- **Date :** 2026-08-06
- **Statut :** Accepted
- **Décideurs :** Architecture Steward
- **Lié à :** PRD-0006 (`.project/prd/PRD-0006-migrations-engine.md`, V2.3) ;
  rapport de faisabilité `.project/reports/feasibility-prd-0006-2026-08-06.md` ;
  Spike T-ADR-0006 ; roadmap North Star (Offline-First SQLite/WASM) ; ADR-0001,
  ADR-0002, ADR-0003 ; Constitution (Lois 2, 3, 5, 6)

## Context

MosaiX est un « Operating System for Composable Application Ecosystems ».
Le North Star (Forge Multi-Store Sync Test) exige une persistance locale
SQLite/WASM offline-first et un storage persistant (backlog Phase 2).
Aujourd'hui le kernel ne possède aucun accès aux bases de données : pas de port
`DatabasePort`, pas de moteur de migration.

Le PRD-0006 propose un moteur de migration de schéma (`@mosaix/migrations`)
couvrant runtime Node et navigateur, PostgreSQL et SQLite, avec des sources
multiples (framework MosaiX et applications installées). L'analyse de
faisabilité conclut à un **GO conditionnel** (score 35/45) : le design est
architecturalement aligné (ports/adapters, Constitution, invariants manifest,
direction des dépendances), mais 14 décisions structurantes doivent être figées
avant toute implémentation.

Sans décision, les risques sont : collisions de schéma entre sources,
dépendance du moteur aux moteurs SQL, ordre non déterministe, verrous
concurrents incohérents, upgrade de sources non gouverné.

## Decision

Les décisions R1-R14 du PRD V2.3 sont figées. Les règles suivantes font
autorité pour l'implémentation des Phases 0-7.

### 1. Le Manifest applicatif est la source unique de découverte (R1)

La suppression de `@mosaix/manifest` est actée. Le moteur découvre les
migrations **exclusivement** via l'`ApplicationManifest` existant
(`@mosaix/contracts`, validé par `@mosaix/schemas`, champ
`domain.migrations: string[]`). Le moteur ne possède aucune représentation
parallèle du Manifest et ne parcourt jamais le système de fichiers.

### 2. Le moteur dépend uniquement des ports (R2, R4)

`@mosaix/migrations` dépend uniquement des ports (`@mosaix/ports-database`,
`DatabasePort`, `DatabaseCapabilities`). Le SQL est généré exclusivement par
une `Grammar`. L'adaptateur SQLite est driver-agnostique via un contrat interne
`SQLiteDriver` (`better-sqlite3`, `sql.js`, `sqlite-wasm`, OPFS) — le choix de
driver reste un détail d'infrastructure remplaçable.

### 3. Checksum et immutabilité (R2)

Le checksum d'une migration est **calculé au chargement** et enregistré à
l'exécution. Les migrations appliquées sont **immuables** : toute modification
est détectée au chargement suivant (`MigrationChecksumError`). Une migration
présente dans le Store mais absente du Registry est une erreur bloquante
(`MigrationMissingError`, R5).

### 4. Verrouillage : responsabilité de l'adaptateur (R3)

La garantie de concurrence appartient à l'adaptateur de stockage, jamais au
Runner. `MigrationLock` expose `LockCapabilities`
(`distributed`/`processSafe`/`runtimeSafe`). Modèle asymétrique assumé :
PostgreSQL advisory lock (distribué), SQLite Node `BEGIN EXCLUSIVE`
(process-safe), SQLite navigateur single-writer explicite (runtime-safe
uniquement — la limite multi-instance est documentée).

### 5. Ordre déterministe (R6, R10)

L'identifiant canonique est `owner.module.version.sequence_name` ; la séquence
est comparée **numériquement**. L'ordonnancement global est :

```text
framework bootstrap → modules framework → DAG des dépendances applicatives
→ migrations applicatives
```

Le graphe global est déterministe : même ensemble de providers → même ordre.
Le moteur ne dépend jamais du nom des fichiers.

### 6. Sources multiples — `MigrationProvider` (R7, R8)

Le moteur est **unique et agnostique à l'origine**. Chaque source publie un
Migration Bundle via un `MigrationProvider` :

```ts
interface MigrationProvider {
  ownerId(): string;
  migrations(): readonly Migration[];
}
```

Le Manifest d'une application ne déclare que son **espace local**
(`domain.migrations = ["users.v1"]`) ; l'owner est ajouté par la couche de
composition (`identity.users.v1.001_create_users`). Deux applications ne
fusionnent jamais le même namespace.

### 7. Collisions : deux validations distinctes (R9)

- **Collision d'identité complète** (`owner.module.version.sequence_name`) :
  bloquante au chargement, dans le **Registry** (`MigrationConflictError`).
- **Collision de ressource SQL** (ex. `appA.users` et `appB.users` créant tous
  deux une table `users`) : détectée au niveau **Blueprint/compilation** par le
  **Planner** (comparaison des Blueprints du plan global).

Les deux mécanismes sont séparés et ne peuvent pas être confondus.

### 8. Le Planner est une frontière architecturale forte (R13)

Le pipeline est :

```text
Avant                         Après
Registry                      Registry
   ↓                             ↓
Runner                        Migration Planner
                                 ↓
                              MigrationPlan
                                 ↓
                              Migration Runner
```

Le Planner permet **d'inspecter une installation avant exécution**. La
frontière Registry/Planner/Runner est stricte :

- **Registry** : agrège les providers, valide les identités ;
- **Planner** : décide (delta, ordre, collisions SQL) ;
- **Runner** : exécute.

Aucune de ces responsabilités ne fusionne avec une autre.

### 9. `MigrationPlan` immuable (R13)

```ts
interface PlannedMigration {
  readonly migration: Migration;
  readonly operation: "up" | "down";
}

interface MigrationPlan {
  readonly id: string;
  readonly createdAt: Date;
  readonly sourceVersion: string;
  readonly operations: readonly PlannedMigration[];
}
```

Le Runner reçoit un plan **déjà calculé** et ne peut pas le transformer :
`A → B → C` ne peut pas devenir `A → C`. Le plan est calculé à chaque
invocation (l'état réel reste le Store), ce qui garantit la reprise après
interruption.

### 10. Idempotence du Planner (R14)

Deux appels du Planner avec le même état source (providers) et le même état
cible (Store) produisent **exactement le même plan**. Conséquences : tests
reproductibles, audit fiable, prévisualisation possible, reprise après
interruption.

### 11. Modèle d'upgrade — desired state → plan (R12)

Le modèle d'upgrade des providers suit **desired state → plan**, cohérent avec
un Control Plane (analogue Kubernetes / Terraform) :

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

Règles :

- le Provider expose l'**état complet courant** de ses migrations ;
- le Planner compare cet état avec le Store ;
- le Planner produit un **delta d'exécution déterministe** ;
- le Runner exécute **uniquement le plan validé** ;
- le Runner **ne calcule jamais un upgrade lui-même**.

Le delta ignore les migrations déjà exécutées et inchangées (checksum, R2),
planifie les nouvelles et détecte les migrations modifiées
(`MigrationChecksumError`).

### 12. Rollback ≠ uninstall (R11, R7)

Le rollback (`down()`) est une opération de développement (retour de batch).
La désinstallation est une opération administrative via des **cleanup
migrations** : même owner, propre checksum, auditées dans le Store, jamais de
réutilisation des migrations d'installation.

### 13. Store avec origine (R7)

`ExecutedMigration` porte l'`owner` ; le Store conserve l'origine de chaque
migration (upgrades framework, install/uninstall d'applications, audit,
détection de conflits).

## Consequences

### Positive

- **Inspectabilité** : le plan est révisable avant exécution (dry-run, audit,
  approbation Control Plane) — contrôle prévisible des installations.
- **Déterminisme et reproductibilité** : mêmes entrées → même plan → mêmes
  tests, audit fiable.
- **Séparation des responsabilités** : Registry (identités), Planner
  (décision), Runner (exécution) — chacun testable indépendamment.
- **Sources déclaratives** : aucun provider ne contient de logique de delta ou
  de planification ; l'ajout d'une source est additif.
- **Réversibilité** : l'état réel reste le Store ; la reprise après
  interruption est recalculée par le Planner.
- **Alignement écosystème** : modèle desired-state cohérent avec le Control
  Plane et les patterns Kubernetes/Terraform.

### Negative

- Une couche supplémentaire (Planner) et un contrat `MigrationPlan` explicite :
  coût de conception et de tests avant le premier runner fonctionnel.
- Le plan étant recalculé à chaque invocation, un surcoût de calcul léger à
  chaque démarrage (acceptable : les graphes de migrations sont petits).
- Le modèle asymétrique de verrouillage impose de documenter clairement la
  limite navigateur (single-writer) dans le SDK.

## Risks

- **Désalignement PRD ↔ ADR ↔ implémentation** → mitigation : cet ADR fige
  les contrats ; les Phases 0-7 du PRD les implémentent ; la relecture de
  l'ADR est obligatoire à la fin de l'implémentation (workflow adr-create).
- **R12 validée sur la base d'un consensus, sans prototype** → mitigation : le
  spike T-ADR-0006 prototypera le Planner et le collision detector avant la
  Phase 6 (système d'installation).
- **Driver SQLite bloqué par la policy supply-chain** (`better-sqlite3` vs
  `node:sqlite`) → mitigation : l'ADR et le contrat `SQLiteDriver` restent
  driver-agnostiques.
- **Limite navigateur multi-instance** → mitigation : garantir
  `runtimeSafe` (single-writer explicite) seulement ; documenter.

## Alternatives considered

1. **Delta fourni par le Provider (upgrade)** — rejeté : couplerait la
   logique de planification aux sources, rompant la frontière
   Registry/Planner/Runner.
2. **Plan généré par le Provider (upgrade)** — rejeté : même raison ; le
   Provider ne décide jamais du plan.
3. **Runner self-service (calcul du delta dans le Runner)** — rejeté :
   empêche l'inspection avant exécution et l'idempotence du plan.
4. **Moteur par source (un moteur framework, un moteur par app)** — rejeté :
   duplication, ordre global impossible, collision non détectable.
5. **Checksum à la génération** — rejeté : ne reflète pas le contenu réel
   exécuté ; remplacé par le checksum au chargement (R2).
6. **Verrouillage dans le Runner** — rejeté : la garantie de concurrence
   dépend du moteur SQL réel, elle appartient à l'adaptateur (R3).
