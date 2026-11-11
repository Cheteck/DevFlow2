# Roadmap d'implémentation — Migrations TypeScript MosaiX

**Date :** 2026-11-09  
**Mode :** OFF_RECORD — Documentation uniquement (aucun code modifié)  
**Livrable :** `.project/reports/migrations-implementation-roadmap-2026-11-09.md`  
**Sources d'entrée :**
- `.project/reports/migrations-typescript-architecture-audit-2026-11-09.md`
- Critique et roadmap ChatGPT (conversation `dd97f687-c833-4dbf-af3e-3d1a8620b5d6`)
- PRD-0006 V2.3, ADR-0006, ADR-0014, ADR-0016

---

## 0. Vue d'ensemble

La roadmap est organisée en **10 phases séquentielles**, réparties sur 3 objectifs :

1. **Stabiliser le moteur de migrations existant** sans casser les contrats ADR-0006 (Phases 01–05).
2. **Instituer une gouvernance stricte des ressources** entre Framework, BACs et Plugins (Phases 02, 06–08).
3. **Faire du moteur une infrastructure fiable** pour l'installation, la mise à jour et la désinstallation des composants MosaiX (Phases 09–10).

**Principe directeur :** aucune migration des dix BACs ni aucun développement du système de migrations des plugins ne doit commencer avant que le moteur central ait démontré sa fiabilité (jalons G0 à G3 validés).

La roadmap est séquentielle sur les fondations. Certaines tâches de documentation et de tests peuvent être conduites en parallèle, mais aucune implémentation de phase N+1 ne doit précéder la validation du jalon G de la phase N.

---

## 1. Structure des 10 phases

| Phase | Intitulé | Priorité | Objectif principal |
|-------|----------|----------|-------------------|
| 01 | Audit et gel des contrats existants | P0 — Bloquant | Connaître précisément l'existant à conserver, modifier ou supprimer |
| 02 | Gouvernance et ownership des ressources | P0 — Bloquant | Définir les propriétaires des ressources avant de toucher au moteur |
| 03 | Contrats TypeScript natifs | P0 — Bloquant | Introduire `MigrationContext`, `Migration`, `up`/`down`, `rawSql` |
| 04 | MigrationCompiler et MigrationValidator | P0 — Bloquant | Séparer compilation, validation et exécution |
| 05 | Sécurisation du Runtime et du Store | P0 — Bloquant | Rendre l'exécution fiable en environnement multi-instance |
| 06 | Framework et Shell Core | P1 — Prioritaire | Migrer les fondations avant les BACs métier |
| 07 | Migration des 10 BACs | P1 — Prioritaire | Faire adopter les migrations TypeScript par tous les BACs |
| 08 | Isolation PostgreSQL et sécurité SQL | P1 — Prioritaire | Faire respecter techniquement les frontières de gouvernance |
| 09 | Cycle de vie des Plugins | P2 — Évolutif | Permettre aux plugins de posséder et gérer leurs propres migrations |
| 10 | CLI et industrialisation | P2 — Évolutif | Rendre le système exploitable par les développeurs et administrateurs |

**Répartition de l'effort indicatif :**
- P0 (Phases 01–05) : 50 %
- P1 (Phases 06–08) : 30 %
- P2 (Phases 09–10) : 20 %

---

## 2. Détail des phases

### Phase 01 — Audit et gel des contrats existants

**Priorité :** P0 — Bloquant  
**Objectif :** Établir la vérité sur l'existant avant toute modification.

#### Travaux

| Tâche | Description | Critère d'acceptation |
|-------|-------------|----------------------|
| T01-01 | Auditer `@mosaix/migrations` et les contrats ADR-0006 | Inventaire des fichiers et contrats publics |
| T01-02 | Vérifier la conformité effective aux règles R1–R12 | Matrice R1–R12 vs code réel, écarts listés |
| T01-03 | Inventorier les migrations des packages, Shell Core et 10 BACs | Liste exhaustive avec chemins et IDs |
| T01-04 | Recenser les IDs canoniques et non canoniques | Tableau des IDs existants avec statut canonique/non canonique |
| T01-05 | Identifier les migrations déjà exécutées dans SQLite et PostgreSQL | État du `mosaix_migrations` par environnement |
| T01-06 | Identifier toutes les collisions de ressources | Matrice des ressources en double entre owners |
| T01-07 | Localiser les duplications entre `MigrationGovernanceService` et `MigrationStore` | Preuve de la duplication d'état (Imperia) |
| T01-08 | Vérifier les transactions, checksums, locks et rollbacks existants | Preuve de fonctionnement ou de manque |

#### Livrables

- Rapport d'audit technique vérifié dans le code (fichier existant : `.project/reports/migrations-typescript-architecture-audit-2026-11-09.md`)
- Inventaire exhaustif des migrations
- Matrice des ressources et propriétaires actuels
- Liste des écarts ADR/PRD
- Plan de compatibilité rétroactive

#### Critère de sortie (Jalon G0)

Aucune migration existante ni aucun historique de base de données ne reste sans propriétaire ou sans état identifié.

---

### Phase 02 — Gouvernance et ownership des ressources

**Priorité :** P0 — Bloquant  
**Objectif :** Établir les règles fondamentales de propriété avant de toucher au moteur.

#### Travaux

| Tâche | Description | Critère d'acceptation |
|-------|-------------|----------------------|
| T02-01 | Définir les namespaces des propriétaires : `framework.<package>`, `bac.<name>`, `plugin.<publisher>.<name>` | Convention d'ID figée dans un ADR |
| T02-02 | Définir le registre canonique des ressources | Chaque ressource SQL a un propriétaire unique |
| T02-03 | Définir la règle `One business datum ⇒ One owner BAC` | Règle opposable, pas seulement documentaire |
| T02-04 | Déterminer définitivement le propriétaire de `user_subscriptions` : `subscription` | Décision documentée, plan de transfert établi |
| T02-05 | Définir les ressources système appartenant au Framework et à Citadelle | Séparation claire infrastructure / métier |
| T02-06 | Définir les règles d'accès inter-BAC | API, événements, contrats — jamais DDL direct |
| T02-07 | Formaliser les règles de collision R9 (déclaratif, structurel, base réelle) | Détection bloquante avant transaction |
| T02-08 | Définir la politique de dépendances entre packages, BACs et plugins | DAG unique, pas de cycles |

#### Livrables

- ADR Ownership & Resource Governance
- ADR Migration Identity & Naming
- Catalogue des propriétaires
- Registre initial des ressources
- Matrice des dépendances autorisées

#### Critère de sortie (Jalon G0)

Chaque ressource connue possède un propriétaire unique et les règles de modification sont explicites.

---

### Phase 03 — Contrats TypeScript natifs

**Priorité :** P0 — Bloquant  
**Objectif :** Introduire les migrations TypeScript sans supprimer la compatibilité SQL historique.

#### Travaux

| Tâche | Description | Critère d'acceptation |
|-------|-------------|----------------------|
| T03-01 | Introduire `MigrationContext` (`schema: SchemaBuilder`, `database: MigrationDatabase`, `logger`, `runtime`) | Contrat typé, pas de connexion brute exposée |
| T03-02 | Introduire `MigrationLogger` (`log`, `warn`, `error`) | Interface de journalisation |
| T03-03 | Introduire `MigrationRuntime` (`dialect`, `capabilities`) | Informations runtime typées |
| T03-04 | Faire évoluer le contrat `Migration` : ajouter `up(context)?`, `down(context)?`, `rawSql?` | `content`/`down` historiques conservés pour rétrocompat |
| T03-05 | Définir le contrat `rawSql` (échappement SQL natif, explicitement déclaré) | SQL natif identifié et validé séparément |
| T03-06 | Définir les règles de compatibilité avec `content` et `down` historiques | Coexistence prouvée dans le même Registry |
| T03-07 | Définir les types de résultats et d'erreurs | Hiérarchie d'erreurs cohérente |
| T03-08 | Définir un contrat discriminé pour éviter les modes d'exécution incompatibles | Une migration ne déclare pas simultanément plusieurs modes |

#### Contrat conceptuel (recommandé)

```typescript
export interface MigrationContext {
  schema: SchemaBuilder;
  database: MigrationDatabase;  // privilèges contrôlés, pas d'accès SQL illimité
  logger: MigrationLogger;
  runtime: MigrationRuntime;
}

export interface Migration {
  id: string;
  checksum: string;
  resources: string[];
  dependencies?: string[];

  up?: (context: MigrationContext) => Promise<void>;
  down?: (context: MigrationContext) => Promise<void>;

  content?: string;   // historique, rétrocompat
  rawSql?: string;    // échappement natif déclaré
}
```

#### Livrables

- Contrats TypeScript documentés
- Types publics exportés
- Tests de compilation
- Tests de compatibilité des anciennes migrations
- Exemples de migrations TypeScript

#### Critère de sortie (Jalon G1)

Une migration SQL historique et une migration TypeScript peuvent coexister dans le même Registry sans ambiguïté.

---

### Phase 04 — MigrationCompiler et MigrationValidator

**Priorité :** P0 — Bloquant  
**Objectif :** Séparer compilation, validation et exécution (séparation critique recommandée par ChatGPT).

#### A. MigrationCompiler

**Responsabilités :**
- Recevoir une migration TypeScript.
- Exécuter sa partie déclarative dans un contexte de compilation contrôlé.
- Récupérer les Blueprints.
- Compiler les Blueprints via `SQLiteGrammar` ou `PostgresGrammar`.
- Produire des `SqlStatement[]`.
- Identifier les opérations nécessitant du SQL natif (`rawSql`).

#### B. MigrationValidator

**Responsabilités :**
- Vérifier l'identité des migrations (IDs, unicité).
- Vérifier les checksums.
- Vérifier les dépendances et les cycles DAG.
- Vérifier les propriétaires des ressources.
- Détecter les collisions entre ressources (niveau déclaratif + structurel).
- Vérifier les modifications de tables, colonnes, index et contraintes.
- Vérifier les compatibilités dialecte.
- Comparer les ressources déclarées aux ressources réellement observables dans les opérations compilées.
- Valider le SQL natif déclaré (`rawSql`).

**Point important :** le contrôle structurel porte sur les opérations du Blueprint, et ne prétend pas analyser parfaitement le comportement arbitraire d'une fonction TypeScript.

#### Architecture cible

```
MigrationProvider → MigrationRegistry → MigrationPlanner → MigrationValidator → MigrationCompiler → MigrationRunner → DatabasePort
```

Le Runner reste responsable de l'exécution, des transactions et du cycle de vie. Il ne compile pas.

#### Travaux

| Tâche | Description | Critère d'acceptation |
|-------|-------------|----------------------|
| T04-01 | Implémenter `MigrationCompiler` | Transforme migrations TS en `SqlStatement[]` via Grammar |
| T04-02 | Implémenter `MigrationValidator` | Valide plan avant exécution : IDs, dépendances, cycles, collisions, checksum, cohérence Store |
| T04-03 | Tests de collisions par paire de propriétaires | Collision bloquante avant exécution |
| T04-04 | Tests de validation du DAG | Cycle détecté, dépendance absente détectée |
| T04-05 | Tests SQLite/PostgreSQL | Compilation correcte pour les deux dialectes |
| T04-06 | Rapport `dry-run` exploitable | Plan validé sans exécution |

#### Livrables

- `MigrationCompiler`
- `MigrationValidator`
- Tests de collisions par paire de propriétaires
- Tests de validation du DAG
- Tests SQLite/PostgreSQL
- Rapport `dry-run` exploitable

#### Critère de sortie (Jalon G2)

Aucune migration invalide ne peut atteindre le Runner.

---

### Phase 05 — Sécurisation du Runtime et du Store

**Priorité :** P0 — Bloquant  
**Objectif :** Rendre l'exécution fiable en environnement multi-instance.

#### Travaux — Runner

| Tâche | Description | Critère d'acceptation |
|-------|-------------|----------------------|
| T05-01 | Exécution des migrations TypeScript (via `MigrationCompiler`) | `up(context)` exécuté, Blueprints compilés et exécutés |
| T05-02 | Rétrocompatibilité SQL (`content` historique) | Anciennes migrations encore exécutables |
| T05-03 | Transactions par migration (PRD §26) | Atomicité : BEGIN → SQL → Store.save → COMMIT ; ROLLBACK sur erreur |
| T05-04 | Gestion des erreurs | `MigrationExecutionError` avec migrationId et cause |
| T05-05 | Gestion des batches (PRD §30) | `batchId` partagé dans une invocation |
| T05-06 | Rollback contrôlé (PRD §29) | Ordre inverse, `down` optionnel, erreur explicite si absent |
| T05-07 | Libération garantie des locks | `finally` sur release, même en cas d'erreur |

#### Travaux — Store

| Tâche | Description | Critère d'acceptation |
|-------|-------------|----------------------|
| T05-08 | Conserver `SqlMigrationStore` comme source de vérité | Table `mosaix_migrations` avec id, owner, checksum, batch_id, applied_at |
| T05-09 | Supprimer la duplication d'état dans Imperia (`MigrationGovernanceService`) | Imperia consulte le Store, pas d'état concurrent |
| T05-10 | Détecter les migrations manquantes (`MigrationMissingError`, R5) | Store présente, Registry absent → blocage |
| T05-11 | Prévenir les exécutions concurrentes et les doubles enregistrements | Lock acquis avant exécution, vérification avant save |

#### Travaux — Locks

| Tâche | Description | Critère d'acceptation |
|-------|-------------|----------------------|
| T05-12 | Implémenter PostgreSQL advisory locks | `pg_try_advisory_lock`, garantie `distributed` |
| T05-13 | Formaliser le comportement SQLite `BEGIN EXCLUSIVE` | Garantie `processSafe`, pas `distributed` |
| T05-14 | Documenter la limite `processSafe` (SQLite) | Limite multi-instance documentée |
| T05-15 | Tester les interruptions de processus | Reprise après crash cohérente |

#### Travaux — Checksum

| Tâche | Description | Critère d'acceptation |
|-------|-------------|----------------------|
| T05-16 | Définir une stratégie de hash stable pour les modules compilés et leurs dépendances | Pas uniquement `Function.toString()` |
| T05-17 | Tests de checksum | Migration modifiée après application → `MigrationChecksumError` |

#### Livrables

- Runner consolidé
- Store unique
- Lock PostgreSQL fonctionnel
- Tests de crash et de reprise
- Tests de checksum
- Tests de rollback

#### Critère de sortie (Jalon G3)

Une migration interrompue ne peut pas être considérée silencieusement comme réussie ou exécutée deux fois.

---

### Phase 06 — Framework et Shell Core

**Priorité :** P1 — Prioritaire  
**Objectif :** Migrer les fondations de MosaiX avant les BACs métier.

#### Travaux

| Tâche | Description | Critère d'acceptation |
|-------|-------------|----------------------|
| T06-01 | Migrer les providers des packages framework (`@mosaix/core`, `@mosaix/kernel`, `@mosaix/platform`, `@mosaix/migrations`) | `up(context)`/`down(context)` natifs |
| T06-02 | Définir leurs `ownerId` définitifs (`framework.<package>`) | Convention Phase 02 respectée |
| T06-03 | Déclarer leurs migrations dans les Manifests (R1) | Découverte par Manifest, pas par filesystem |
| T06-04 | Supprimer progressivement les compilations SQL locales des providers | Le `MigrationCompiler` compile, pas le provider |
| T06-05 | Supprimer `FileMigrationProvider` au profit de la découverte par Manifests | R1 respecté |
| T06-06 | Normaliser les IDs des migrations autonomes (format canonique) | `owner.module.version.sequence_name` |
| T06-07 | Migrer les 25 tables du Shell Core (`shell.core.v1.001_create_core_tables`) | Migration TS native |
| T06-08 | Résoudre le conflit `user_subscriptions` (propriétaire : `subscription`) | Transfert explicite, historique conservé, pas de recréation de table |

#### Ordre recommandé

```
Framework bootstrap
       |
       v
Framework packages
       |
       v
Shell Core
       |
       v
BAC dependencies
```

#### Livrables

- Providers framework natifs
- Shell Core migré
- Manifests normalisés
- IDs canoniques
- Historique cohérent
- Suppression des remappings fragiles (`CanonicalIdProvider`, `StaticMigrationProvider` si IDs déjà canoniques)

#### Critère de sortie (Jalon G4)

Une installation neuve et une mise à niveau d'une installation existante produisent le même état de schéma attendu.

---

### Phase 07 — Migration des 10 BACs

**Priorité :** P1 — Prioritaire  
**Objectif :** Faire adopter les migrations TypeScript par tous les BACs, un par un.

**Règle :** Ne pas migrer les dix BACs en parallèle. Un BAC à la fois, tests + revue avant le suivant.

#### Ordre de migration recommandé (proposition, à valider contre le DAG réel)

| Ordre | BAC | Vérification particulière |
|-------|-----|--------------------------|
| 1 | Citadelle | Identité, utilisateurs, sessions |
| 2 | Spaces | Ownership et membres |
| 3 | Portfolio | Produits et ressources commerciales |
| 4 | Subscription | Abonnements et facturation |
| 5 | Commerce | Offres, commandes et dépendances |
| 6 | Beam | Messagerie |
| 7 | Booking | Réservations |
| 8 | Solara | Social et interactions |
| 9 | Solidarity | Données et opérations de solidarité |
| 10 | Imperia | Gouvernance et audit |

**Attention :** Cet ordre est une proposition de travail, pas une déclaration de dépendances. Le DAG validé doit déterminer l'ordre effectif d'exécution.

#### Travaux pour chaque BAC

| Tâche | Description | Critère d'acceptation |
|-------|-------------|----------------------|
| T07-X.1 | Migrer ses providers | `up(context)`/`down(context)` natifs |
| T07-X.2 | Déclarer les migrations dans son Manifest (R1) | Découverte par Manifest |
| T07-X.3 | Remplacer `content` par `up(context)` progressivement | Rétrocompat pendant la transition |
| T07-X.4 | Ajouter les opérations `down` lorsqu'elles sont réellement sûres | Pas de `down` destructif présenté comme garanti |
| T07-X.5 | Déclarer toutes les ressources (`resources[]`) | Pour détection de collisions R9 |
| T07-X.6 | Vérifier l'ownership | Aucune collision avec un autre BAC déjà migré |
| T07-X.7 | Vérifier les dépendances inter-BAC | DAG respecté |
| T07-X.8 | Ajouter les tests de migration neuve et de mise à niveau | Tests verts par BAC |
| T07-X.9 | Supprimer les filtres manuels devenus inutiles | Ex. filtrage `user_subscriptions` dans `bac-migrations.ts` |

#### Livrables

- Dix providers migrés
- Dix Manifests conformes
- Tests d'intégration par BAC
- Matrice finale des ressources
- Graphe DAG validé

#### Critère de sortie (Jalon G5)

Aucun BAC ne modifie une ressource dont il n'est pas propriétaire.

---

### Phase 08 — Isolation PostgreSQL et sécurité SQL

**Priorité :** P1 — Prioritaire  
**Objectif :** Faire respecter techniquement les frontières définies dans la gouvernance.

#### Travaux — PostgreSQL

| Tâche | Description | Critère d'acceptation |
|-------|-------------|----------------------|
| T08-01 | Créer un schéma par BAC (ADR-0014) | 10 schémas canoniques (citadelle, commerce, …) |
| T08-02 | Créer les schémas framework nécessaires | `framework_core`, `framework_kernel`, `framework_platform`, `framework_migrations` |
| T08-03 | Configurer les permissions par owner | `GRANT USAGE, CREATE` par schéma, rôles minimaux |
| T08-04 | Contrôler le `search_path` | Par session, par transaction |
| T08-05 | Utiliser des noms qualifiés lorsque nécessaire | `schema.table` pour les références inter-schémas |
| T08-06 | Définir les rôles d'exécution des migrations | Privilèges limités |
| T08-07 | Définir les règles RLS pour les données multi-tenant | `ALTER TABLE ENABLE ROW LEVEL SECURITY` + politiques tenant_isolation |

#### Travaux — SQLite

| Tâche | Description | Critère d'acceptation |
|-------|-------------|----------------------|
| T08-08 | Définir une convention de nommage des ressources | Préfixe par owner si nécessaire |
| T08-09 | Appliquer le registre d'ownership | Propriété tracée dans le Store |
| T08-10 | Garantir les validations avant DDL | `MigrationValidator` bloque les collisions |
| T08-11 | Documenter les limites de concurrence (SQLite) | `processSafe`, pas `distributed` |

#### Travaux — Sécurité

| Tâche | Description | Critère d'acceptation |
|-------|-------------|----------------------|
| T08-12 | Empêcher les accès DDL transversaux non autorisés | `MigrationValidator` vérifie l'ownership réel |
| T08-13 | Limiter les privilèges des migrations | Connexion avec droits minimaux |
| T08-14 | Contrôler les instructions `rawSql` | Déclaré explicitement, validé renforcé |
| T08-15 | Tester les tentatives de modification de tables étrangères | Blocage par le moteur |

#### Livrables

- Stratégie d'isolation PostgreSQL
- Stratégie SQLite
- Matrice des permissions
- Tests de séparation des BACs
- Tests d'accès non autorisés

#### Critère de sortie (Jalon G6)

Une migration exécutée avec les privilèges d'un owner ne peut pas modifier arbitrairement les ressources d'un autre owner.

---

### Phase 09 — Cycle de vie des Plugins

**Priorité :** P2 — Évolutif  
**Objectif :** Permettre aux plugins de posséder et gérer leurs propres migrations.

**Dépendance :** Cette phase dépend obligatoirement des phases 02 à 08.

#### Travaux — Identité

| Tâche | Description | Critère d'acceptation |
|-------|-------------|----------------------|
| T09-01 | Owner stable `plugin.<publisher>.<name>` | Namespace dédié |
| T09-02 | Namespace de ressources dédié | Pas de collision avec BAC/framework |
| T09-03 | Vérification de l'identité de l'éditeur | Politique de confiance |
| T09-04 | Vérification de l'intégrité du package | Checksum du package |

#### Travaux — Installation

| Tâche | Description | Critère d'acceptation |
|-------|-------------|----------------------|
| T09-05 | Validation du Manifest | R1 respecté |
| T09-06 | Validation des dépendances | DAG vérifié |
| T09-07 | Validation de l'ownership | Pas de collision avec ressources existantes |
| T09-08 | Construction du plan | `MigrationPlanner` |
| T09-09 | Dry-run | `MigrationRunner` en mode dry-run |
| T09-10 | Exécution des migrations | `MigrationRunner` |
| T09-11 | Activation du plugin | Après succès des migrations |

#### Travaux — Mise à jour

| Tâche | Description | Critère d'acceptation |
|-------|-------------|----------------------|
| T09-12 | Détection de nouvelle version | Comparaison Manifest |
| T09-13 | Ajout de migrations immiables | Nouvelle séquence, pas de modification d'existant |
| T09-14 | Vérification de compatibilité | Checksum, dépendances |
| T09-15 | Migration contrôlée | Plan validé, exécution transactionnelle |
| T09-16 | Activation de la nouvelle version | Après succès |

#### Travaux — Désinstallation

| Tâche | Description | Critère d'acceptation |
|-------|-------------|----------------------|
| T09-17 | Cycle de vie : `installed → disabled → uninstalling → uninstalled` | Registre persistant des états |
| T09-18 | Désinstallation standard : conserver données et historique | Pas de suppression automatique |
| T09-19 | Purge : opération distincte, destructive, explicitement autorisée | Confirmation explicite, historique d'audit |
| T09-20 | Détection des plugins manquants (cas A et B) | Cas A (désinstallation volontaire) : pas d'erreur. Cas B (disparition anormale) : `MigrationMissingError` |

#### Travaux — Isolation

| Tâche | Description | Critère d'acceptation |
|-------|-------------|----------------------|
| T09-21 | Plugin ne modifie pas les tables du BAC hôte | Table d'extension propre, API publique, ou événements |

#### Livrables

- `PluginMigrationProvider`
- Plugin Registry persistant (états de cycle de vie)
- Plugin Lifecycle Service (workflow install/update/uninstall)
- Workflow de purge contrôlée
- Tests de récupération après interruption

#### Critère de sortie (Jalon G7)

Un plugin peut être installé, mis à jour et désinstallé sans compromettre les migrations ou les données d'un BAC hôte.

---

### Phase 10 — CLI et industrialisation

**Priorité :** P2 — Évolutif  
**Objectif :** Rendre le système exploitable par les développeurs et les administrateurs.

#### Travaux — Commandes CLI

| Commande | Fonction | Priorité |
|----------|----------|----------|
| `migrate:create` | Générer une migration TS (template `up`/`down`) | P2 |
| `migrate:plan` | Construire le plan | P2 |
| `migrate:validate` | Valider le plan | P2 |
| `migrate:dry-run` | Simuler l'exécution sans mutation | P2 |
| `migrate:up` | Exécuter les migrations | P2 |
| `migrate:down` | Rollback contrôlé | P2 |
| `migrate:status` | Consulter les états | P2 |
| `migrate:history` | Consulter l'historique | P2 |
| `migrate:inspect` | Inspecter une migration | P2 |
| `migrate:ownership` | Vérifier les propriétaires | P2 |
| `migrate:diagnose` | Diagnostiquer les incohérences | P2 |

#### Travaux complémentaires

| Tâche | Description | Critère d'acceptation |
|-------|-------------|----------------------|
| T10-01 | Intégration CI/CD | Tests automatiques sur SQLite et PostgreSQL |
| T10-02 | Vérification des Manifests | Détection des migrations modifiées |
| T10-03 | Détection des collisions | Rapport d'audit |
| T10-04 | Documentation développeur | Guide de création de migration |

#### Livrables

- CLI complète avec les commandes ci-dessus
- Intégration CI/CD
- Tests automatiques SQLite/PostgreSQL
- Documentation développeur

#### Critère de sortie (Jalon G8)

Un développeur peut créer, valider et tester une migration sans intervenir manuellement dans les mécanismes internes du Runner.

---

## 3. Jalons de validation

| Jalon | Phases concernées | Conditions obligatoires |
|-------|-------------------|------------------------|
| G0 — Gouvernance | 01, 02 | ADR, ownership et inventaire validés |
| G1 — Contrats | 03 | TypeScript et SQL historique coexistent |
| G2 — Compilation | 04 | Compiler et Validator opérationnels |
| G3 — Runtime | 05 | Transactions, locks, Store et reprise validés |
| G4 — Framework | 06 | Packages et Shell Core migrés |
| G5 — BACs | 07 | Les 10 BACs sont conformes |
| G6 — Sécurité | 08 | Isolation PostgreSQL et contrôles SQLite validés |
| G7 — Plugins | 09 | Cycle de vie complet opérationnel |
| G8 — Industrialisation | 10 | CLI, CI/CD et documentation opérationnels |

**Règle :** Aucun jalon ne peut être considéré comme validé si ses tests de non-régression échouent.

---

## 4. Stratégie de tests transversale

Cette stratégie doit commencer dès la phase 01 et accompagner toutes les phases.

| Domaine | Tests obligatoires |
|---------|-------------------|
| Compatibilité | Anciennes migrations SQL + nouvelles migrations TS |
| Identité | IDs dupliqués, non canoniques, séquences incorrectes |
| Checksum | Migration modifiée après application |
| Dépendances | Dépendance absente, cycle DAG, version incompatible |
| Ownership | Collision entre deux packages, package/BAC, BAC/BAC, BAC/plugin |
| Compilation | Blueprint SQLite et PostgreSQL |
| SQL natif | Instructions non déclarées, dialecte incorrect |
| Transactions | Échec en cours de migration |
| Concurrence | Deux processus exécutant le même plan |
| Reprise | Arrêt brutal et redémarrage |
| Rollback | Absence de `down`, erreur pendant `down`, perte potentielle de données |
| Plugins | Installation, mise à jour, disparition et purge |
| Isolation | Tentative de modification d'une ressource étrangère |

### Tests de référence indispensables (quatre scénarios permanents)

1. **Installation neuve :** construire l'ensemble de la plateforme depuis une base vide.
2. **Upgrade :** passer d'une version MosaiX existante à une nouvelle version.
3. **Reprise :** interrompre une migration, redémarrer et vérifier la cohérence.
4. **Violation :** tenter volontairement une collision entre deux owners et vérifier le blocage avant exécution.

---

## 5. Signaux d'alerte / STOP

| Signal d'alerte | Décision |
|-----------------|----------|
| Deux BACs peuvent créer/modifier la même ressource sans autorisation explicite | **STOP** |
| Une migration TS peut exécuter du SQL sans traçabilité (pas de `rawSql` déclaré) | **STOP** |
| Le Runner accepte un plan dont les dépendances sont incohérentes | **STOP** |
| Le checksum dépend uniquement de `Function.toString()` | **STOP** |
| Imperia (ou tout service) peut modifier indépendamment l'état des migrations | **STOP** |
| Une migration appliquée peut être remplacée silencieusement | **STOP** |
| Le rollback destructif est présenté comme garanti | **STOP** |

---

## 6. Décisions à figer avant de commencer

| Décision | Recommandation |
|----------|---------------|
| Ownership | Un propriétaire unique par ressource |
| Versionnement | Version des migrations indépendante de la version du package |
| Compilation | `MigrationCompiler` séparé du Runner |
| Validation | `MigrationValidator` obligatoire |
| Gouvernance | `MigrationStore` comme source unique de vérité |
| Plugins | Uninstall conservateur, purge explicite |

---

## 7. Séparation des responsabilités (conseil architectural)

**A. Migration Engine — Infrastructure technique**

Responsable de : Découverte, Registry, Planning, Validation, Compilation, Exécution, Store, Rollback, Locks.

**B. Component Lifecycle Management — Gouvernance des composants**

Responsable de : Installation des packages, Installation des BACs, Installation des plugins, Mise à jour, Activation/désactivation, Désinstallation, Purge, Vérification des dépendances.

Les deux communiquent par des contrats publics. Le Lifecycle Management orchestre le Migration Engine, sans reproduire son état.

---

## 8. Consignes pour l'agent IA

- Une seule phase active à la fois.
- Lecture seule et audit avant toute modification.
- Rapport de conformité avant implémentation.
- Implémentation limitée au périmètre validé.
- Tests de régression après chaque lot.
- Rapport final avec preuves : fichiers modifiés, tests exécutés, résultats et risques résiduels.
- Aucun changement des ADR/PRD figés sans décision architecturale explicite.
- Ne pas anticiper les phases suivantes (ex. ne pas commencer la migration des providers BACs pendant qu'on stabilise encore le contrat du `MigrationContext`).

---

## 9. Priorité immédiate

Lancer les phases 01 et 02, puis soumettre leurs livrables à validation avant d'autoriser la phase 03.

Cette approche évite de construire un moteur TypeScript techniquement performant sur des règles d'ownership et de gouvernance encore ambiguës.

---

*Roadmap produite en mode OFF_RECORD — aucun code modifié. En attente de validation indépendante avant lancement de la Phase 01.*