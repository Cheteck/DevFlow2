# Rapport d'Analyse et de Modernisation du Système de Plugins MosaiX

- **Auteur :** Jules (Spécialiste Architecture MosaiX)
- **Date :** 2026-10-13
- **Statut :** Validé — Document de référence d'architecture et de backlog
- **Périmètre :** `@mosaix/plugin-engine`, `@mosaix/core` (registre d'extension), `@mosaix/contracts` / `@mosaix/schemas`, `plugins/*`, `apps/imperia` et intégration dans le Runtime Shell.

---

## 1. Synthèse Exécutive

### 1.1 État Général du Système
MosaiX dispose d'une infrastructure de gestion de plugins particulièrement avancée sur le plan théorique et algorithmique dans `@mosaix/plugin-engine` (moteur de hooks parallélisé/waterfall/bail, bac à sable temporel, résolution de capabilities par tiers `ui|application|privileged`, gestionnaire de paramètres avec schéma JSON, bus d'événements inter-plugins, registre marketplace avec signature HMAC/SHA-256, chargeur dynamique de workspace et runner CLI).

Cependant, le système souffre d'un **décrochage critique entre l'implémentation du moteur et son intégration réelle dans l'architecture applicative de MosaiX** :
1. **Divergence des Contrats de Manifeste** : Le type `PluginManifest` défini dans `@mosaix/contracts` / `@mosaix/schemas` (utilisant `extension: { target, point, hooks }`) est incompatible avec le type `PluginManifest` interne de `@mosaix/plugin-engine` (utilisant `targetAppId`, `requiresCapabilities`, `settingsSchema`).
2. **Dualité des Registres d'Extension** : Il existe deux registres indépendants non synchronisés : le `PluginRegistry` léger dans `@mosaix/core` (déclaratif par `owner:id`) et le `PluginRegistry` dynamique dans `@mosaix/plugin-engine`.
3. **Paquets Plugins Orphelins** : Les 6 paquets situés dans le dossier `plugins/*` (`commerce-badge-plugin`, `solara-content-moderator`, etc.) ne contiennent aucun manifeste `mosaix.json` / `PluginManifest`, ne sont enregistrés dans aucun registre et sont soit inutilisés, soit importés statiquement via `import` TypeScript direct dans le code applicatif BAC (`SolaraAppServiceProvider`).
4. **Catalogue Simulé dans Imperia** : La console d'administration `Imperia` (`ImperiaPluginManagerService`) gère les plugins d'administration via un catalogue durci en mémoire (`seedPrestaShopLikeCatalog`), totalement déconnecté du `@mosaix/plugin-engine`.
5. **Absence de Câblage au Démarrage (`bootstrap/`)** : Le `@mosaix/plugin-engine` n'est pas référencé dans les `applicationProviders` de `bootstrap/providers.ts` ni dans le `RuntimeKernel`, empêchant l'exécution automatique des hooks de plugins lors des requêtes HTTP du Shell.

### 1.2 Principaux Risques
- **Fausse Sécurité et Fausse Extensibilité** : L'existence de composants avancés de sandboxing donne l'illusion d'une isolation dynamique alors que le code métier actuel réalise des imports directs statiques sans barrière d'isolation.
- **Rupture de Contrat et Incompatibilité SemVer** : En l'absence de validation de schéma unifiée au chargement, toute tentative d'enregistrer un plugin externe échouera silencieusement ou lèvera des erreurs d'incompatibilité de type.
- **Dette Technique Accumulée** : La duplication des abstractions (`PluginLifecycleManager` dans `@mosaix/core` vs `@mosaix/plugin-engine`) complique le diagnostic et accroît le coût de maintenance.

### 1.3 Opportunités Majeures
- **Découplage Propre du Coeur MosaiX** : Connecter le `@mosaix/plugin-engine` au Shell et aux BACs permettra d'injecter dynamiquement des fonctionnalités transversales (modération Solara, calculs de remise Commerce, filtres de disponibilité Booking) sans modifier le code source des BACs.
- **Console d'Administration Unifiée** : Raccorder Imperia au registre réel du `@mosaix/plugin-engine` afin d'offrir une gouvernance opérationnelle authentique (installation, activation, configuration, désactivation).

---

## 2. Cartographie de l'Existant

### 2.1 Architecture des Composants Impliqués

```
                               ┌──────────────────────────────────────────┐
                               │       @mosaix/contracts / schemas        │
                               │  - PluginManifest (target, point)        │
                               └────────────────────┬─────────────────────┘
                                                    │ (Import)
                                                    ▼
┌───────────────────────────────────────────────────┴───────────────────────────────────────────────────┐
│ @mosaix/core (Kernel Plane)                                                                           │
│  - PluginRegistry: Registre clé owner:id, points d'extension ouverts (target:point)                   │
│  - PluginLifecycleManager: Machine à états DISCOVERED > VALIDATED > LOADED > INITIALIZED > ACTIVE...   │
└───────────────────────────────────────────────────┬───────────────────────────────────────────────────┘
                                                    │ (Divergence de contrat)
                                                    ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ @mosaix/plugin-engine (Control & Extension Plane)                                                     │
│  - Core: Local PluginManifest (targetAppId, settingsSchema, slotContributions)                        │
│  - Runtime: PluginEngine, PluginRegistry, HookExecutionEngine, PluginEventBus, CapabilityResolver,     │
│             PluginSettingsManager, PluginSandboxEnvironment                                           │
│  - Adapters: WorkspacePluginLoader (scan mosaix.json, hot reload)                                     │
│  - Management: PluginMarketplaceRegistry, PluginCliCommandRunner                                      │
└───────────────────────────────────────────────────┬───────────────────────────────────────────────────┘
                                                    │
                 ┌──────────────────────────────────┴──────────────────────────────────┐
                 ▼                                                                     ▼
┌──────────────────────────────────────────────────┐               ┌──────────────────────────────────┐
│ plugins/* (Orphelins)                            │               │ apps/imperia                     │
│  - commerce-badge-plugin                         │               │  - ImperiaPluginManagerService   │
│  - commerce-comparator-plugin                    │               │    (Catalog en mémoire simulé)   │
│  - commerce-recently-viewed-plugin               │               └──────────────────────────────────┘
│  - commerce-reviews-plugin                       │                                   ▲
│  - commerce-wishlist-plugin                      │                                   │ (Import Statique)
│  - solara-content-moderator                      │ ──────────────────────────────────┘
└──────────────────────────────────────────────────┘
```

### 2.2 Fichiers et Classes Réellement Impliqués

| Composant | Fichier source | Rôle & Fonctionnement Actuel |
|---|---|---|
| **Contrats & Schémas** | `packages/contracts/src/plugin/*`<br/>`packages/schemas/src/index.ts` | Définition canonique de `PluginManifest` et `PluginManifestSchema` (propriétés `extension.target`, `extension.point`). |
| **Noyau Core** | `packages/core/src/plugin/plugin-registry.ts`<br/>`packages/core/src/plugin/plugin-lifecycle.ts` | Registre minimal clé `owner:id` avec recherche par point d'extension `target:point`. |
| **Moteur d'extension** | `packages/plugin-engine/src/core/index.ts`<br/>`packages/plugin-engine/src/runtime/*` | `PluginEngine` complet avec `HookExecutionEngine` (parallel/waterfall/bail), `PluginSandboxEnvironment`, `CapabilityRegistry`. |
| **Adapteurs & Management** | `packages/plugin-engine/src/adapters/workspace-loader.ts`<br/>`packages/plugin-engine/src/management/*` | Scanner de workspace pour fichiers `mosaix.json`, registre marketplace, vérification de signature cryptographique HMAC-SHA256, runner CLI. |
| **Applications Client/BAC** | `apps/solara/src/infrastructure/solara-service-provider.ts`<br/>`apps/imperia/src/domain/plugin-manager.service.ts` | Import direct statique de `SolaraContentModeratorPlugin` dans Solara. Catalogue durci en mémoire dans Imperia sans lien vers `PluginEngine`. |
| **Paquets Plugins** | `plugins/commerce-*-plugin/`<br/>`plugins/solara-content-moderator/` | Classes isolées avec `responsibilities.md` déclaratif, mais sans manifeste `mosaix.json` ni câblage runtime. |

---

## 3. Diagnostic Détaillé

### 3.1 Tableau des Constats et Évaluations

| ID | Composants concernés | Problème observé & Cause | Conséquences pour MosaiX | Gravité / Probabilité | Confiance | Recommandation |
|---|---|---|---|---|---|---|
| **GAP-PLG-01** | `@mosaix/contracts`<br/>`@mosaix/schemas`<br/>`@mosaix/plugin-engine` | **Mismatch de types de manifeste** : `@mosaix/plugin-engine` re-déclare sa propre interface `PluginManifest` (`targetAppId`, etc.) qui diverge de `@mosaix/contracts` (`extension.target`, `extension.point`). | Impossible de réutiliser le validateur de schéma unifié `@mosaix/schemas` dans `@mosaix/plugin-engine`. Risque de rupture de type lors du chargement de plugins externes. | **Élevée (P1)**<br/>Probabilité: 100% | **Haute (100%)** | Unifier le contrat `PluginManifest` dans `@mosaix/contracts` et étendre le schéma dans `@mosaix/schemas` pour englober les attributs avancés (`settingsSchema`, `slotContributions`, `capabilities`). |
| **GAP-PLG-02** | `@mosaix/core`<br/>`@mosaix/plugin-engine` | **Dualité et isolation des registres** : `@mosaix/core` possède un `PluginRegistry` léger et `@mosaix/plugin-engine` possède un `PluginEngine`/`PluginRegistry` indépendant. | Duplication des concepts de cycle de vie (`DISCOVERED...ACTIVE`), confusion pour les développeurs sur le registre à interroger. | **Moyenne (P2)**<br/>Probabilité: 100% | **Haute (100%)** | Clarifier l'architecture : conserver dans `@mosaix/core` le registre minimal d'injection du Kernel, et faire de `@mosaix/plugin-engine` le gestionnaire d'exécution dynamique. |
| **GAP-PLG-03** | `plugins/*`<br/>`apps/solara` | **Plugins orphelins et imports statiques** : Les 6 paquets de `plugins/*` n'ont pas de `mosaix.json` et sont importés statiquement via TypeScript `import`. | Contournement complet de la sandbox, du contrôle de capabilities et de la désactivation dynamique. | **Élevée (P1)**<br/>Probabilité: 100% | **Haute (100%)** | Dotoir chaque paquet `plugins/*` d'un manifeste `mosaix.json` valide et remplacer l'import statique par un enregistrement dynamique via `PluginEngine`. |
| **GAP-PLG-04** | `apps/imperia`<br/>`@mosaix/plugin-engine` | **Déconnexion de la console Imperia** : `ImperiaPluginManagerService` gère un catalogue simulé en mémoire (`seedPrestaShopLikeCatalog`). | L'administrateur Imperia ne voit pas l'état réel des plugins chargés dans le runtime MosaiX et les actions d'activation/désactivation n'ont aucun effet réel. | **Moyenne (P2)**<br/>Probabilité: 100% | **Haute (100%)** | Raccorder `ImperiaPluginManagerService` au `PluginEngine` / `PluginRegistry` réel pour refléter les états réels et exécuter les actions du cycle de vie. |
| **GAP-PLG-05** | `bootstrap/*`<br/>`src/start.ts` | **Absence de bootstrapping du Plugin Engine** : `PluginEngine` n'est pas instancié au boot du serveur ni fourni dans le conteneur de dépendances du Shell. | Impossible pour les BACs d'exécuter des hooks (`engine.runHook("commerce.checkout.calculateDiscount", ...)`) lors des traitements de requêtes. | **Élevée (P1)**<br/>Probabilité: 100% | **Haute (100%)** | Ajouter un provider `plugin-engine` dans `bootstrap/providers.ts` et enregistrer l'instance `PluginEngine` dans le conteneur du Shell. |

---

## 4. Recommandations Architecturales

### 4.1 Arbitrage Architectural : Cible d'Unification (`@mosaix/core` vs `@mosaix/plugin-engine`)

#### Option A : Unification Totale par Remplacement de `@mosaix/core` par `@mosaix/plugin-engine`
- *Principe* : Supprimer `packages/core/src/plugin/` et faire dépendre `@mosaix/core` de `@mosaix/plugin-engine`.
- *Inconvénient* : Entraîne une dépendance circulaire (`plugin-engine` dépend déjà de `core` via `contracts`/`types`) ou alourdit inutilement le noyau noyau avec le bac à sable et la marketplace.

#### Option B : Conservation des Deux Mécanismes Indépendants
- *Principe* : Maintenir les deux systèmes séparés sans aucun lien.
- *Inconvénient* : Perpetue la confusion, la fausse sécurité et la duplication de code.

#### Option C (RECOMMANDÉE) : Convergence par Délégation et Alignement des Contrats
- *Principe* :
  1. **Source de Vérité des Contrats** : Centraliser le contrat `PluginManifest` dans `@mosaix/contracts` et la validation dans `@mosaix/schemas`.
  2. **Core Kernel Extension Point** : Conserver le `PluginRegistry` minimal dans `@mosaix/core` comme registre d'injection synchrone pour les `KernelModules` et capacités internes du noyau.
  3. **Plugin Engine Runtime** : Faire de `@mosaix/plugin-engine` le gestionnaire d'exécution dynamique (moteur de hooks, sandboxing, résolution de capabilities, paramètres JSON, marketplace). Le `PluginRegistry` de `plugin-engine` s'abonne ou synchronise son état avec le registre du Core.
- *Compromis & Bénéfices* : Respect de la hiérarchie des couches (Core → Contracts ← Plugin-Engine), zéro dépendance circulaire, pas de sur-ingénierie, et transition sans rupture pour le noyau.

---

## 5. Plan de Modernisation

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 1 : Assainissement des Contrats & Bootstrapping (V0 - P1)                   │
│  - Alignement de PluginManifest dans @mosaix/contracts & @mosaix/schemas         │
│  - Ajout de PluginEngineProvider dans bootstrap/providers.ts                     │
└─────────────────────────────────────────┬────────────────────────────────────────┘
                                          │
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 2 : Conformation des Plugins Existant & Suppression Imports Statiques (V1 - P1)│
│  - Ajout de mosaix.json aux 6 paquets plugins/*                                  │
│  - Migration de solara-content-moderator vers HookEngine                         │
└─────────────────────────────────────────┬────────────────────────────────────────┘
                                          │
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 3 : Raccordement de la Console de Gouvernance Imperia (V2 - P2)            │
│  - ImperiaPluginManagerService délégué à PluginEngine                            │
│  - Synchronisation bidirectionnelle de l'état (LOADED / ACTIVE / DISABLED)       │
└─────────────────────────────────────────┬────────────────────────────────────────┘
                                          │
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 4 : Intégration des Points de Hook Canoniques dans les BACs (V3 - P2)     │
│  - Exécution des hooks canoniques (commerce.checkout, booking.slot, etc.)        │
│  - Validation E2E du cycle de vie et de l'isolation                              │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Backlog Proposé (Prêt à l'Intégration)

### Initiative / Epic : `PLG-MODERNIZATION` — Modernisation du Système de Plugins MosaiX

---

#### Tâche 1 : `PLG-01` — Unification du contrat `PluginManifest` et schéma Zod
- **Type** : Refactoring / Contrats
- **Contexte** : Incompatibilité entre `PluginManifest` dans `@mosaix/contracts` et `@mosaix/plugin-engine`.
- **Objectif** : Disposer d'une définition unique de `PluginManifest` dans `@mosaix/contracts` validable par `@mosaix/schemas`.
- **Périmètre** : `packages/contracts/src/plugin/plugin-manifest.ts`, `packages/schemas/src/index.ts`, `packages/plugin-engine/src/core/index.ts`.
- **Critères d'acceptation** :
  1. `PluginManifest` dans `@mosaix/contracts` accepte la structure d'extension (`extension: { target, point }`) ainsi que les attributs optionnels avancés (`settingsSchema`, `slotContributions`, `capabilities`, `permissions`).
  2. `PluginManifestSchema` dans `@mosaix/schemas` valide sans erreur un manifeste complet de plugin.
  3. `@mosaix/plugin-engine` réexporte ou dérive directement son type de `@mosaix/contracts`.
  4. La suite de tests Vitest de `plugin-engine` et `core` passe à 100%.
- **Dépendances** : Aucune
- **Priorité** : P1 (Élevée)
- **Estimation** : 0.5 j/h
- **Validation** : `pnpm --filter @mosaix/contracts test` & `pnpm --filter @mosaix/plugin-engine test`
- **Traçabilité** : Diagnostic GAP-PLG-01

---

#### Tâche 2 : `PLG-02` — Bootstrapping du `PluginEngine` dans le Shell MosaiX
- **Type** : Amélioration / Architecture
- **Contexte** : `PluginEngine` n'est pas instancié ni enregistré au démarrage du serveur Shell.
- **Objectif** : Exposer un singleton `PluginEngine` accessible dans le conteneur d'injection du Shell.
- **Périmètre** : `bootstrap/providers.ts`, `bootstrap/app.ts`, `src/shell/plugin-engine-bootstrap.ts`.
- **Critères d'acceptation** :
  1. Un descripteur `plugin-engine` est ajouté à `applicationProviders` dans `bootstrap/providers.ts`.
  2. L'instance `PluginEngine` est enregistrée dans le conteneur global du Shell lors du boot.
  3. `WorkspacePluginLoader` scanne automatiquement le répertoire `plugins/` au démarrage en mode développement.
- **Dépendances** : `PLG-01`
- **Priorité** : P1 (Élevée)
- **Estimation** : 0.5 j/h
- **Validation** : Test d'intégration d'initialisation du Shell dans `bootstrap/app.test.ts`.
- **Traçabilité** : Diagnostic GAP-PLG-05

---

#### Tâche 3 : `PLG-03` — Conformation des paquets `plugins/*` et ajout des manifestes `mosaix.json`
- **Type** : Amélioration / Plugins
- **Contexte** : Les 6 paquets sous `plugins/*` ne possèdent aucun manifeste `mosaix.json`.
- **Objectif** : Transformer chaque paquet plugin en un artefact conforme possédant son manifeste `mosaix.json`.
- **Périmètre** : `plugins/commerce-badge-plugin/mosaix.json`, `plugins/commerce-comparator-plugin/mosaix.json`, `plugins/commerce-recently-viewed-plugin/mosaix.json`, `plugins/commerce-reviews-plugin/mosaix.json`, `plugins/commerce-wishlist-plugin/mosaix.json`, `plugins/solara-content-moderator/mosaix.json`.
- **Critères d'acceptation** :
  1. Chaque dossier de plugin sous `plugins/*` possède un fichier `mosaix.json` valide selon `PluginManifestSchema`.
  2. Le champ `extension.target` indique la BAC hôte appropriée (`commerce`, `solara`, etc.).
  3. `WorkspacePluginLoader.scanWorkspace()` découvre et valide correctement les 6 plugins.
- **Dépendances** : `PLG-01`
- **Priorité** : P1 (Élevée)
- **Estimation** : 0.5 j/h
- **Validation** : Exécution du scanner de workspace via `WorkspacePluginLoader`.
- **Traçabilité** : Diagnostic GAP-PLG-03

---

#### Tâche 4 : `PLG-04` — Migration de `solara-content-moderator` vers le moteur de hooks
- **Type** : Refactoring / Découplage
- **Contexte** : `SolaraContentModeratorPlugin` est actuellement importé statiquement dans `apps/solara/src/infrastructure/solara-service-provider.ts`.
- **Objectif** : Remplacer l'import statique par l'enregistrement d'un hook sur le point de hook canonique `solara.post.beforeCreate`.
- **Périmètre** : `apps/solara/src/infrastructure/solara-service-provider.ts`, `apps/solara/src/commands/create-post.command.ts`, `plugins/solara-content-moderator/src/index.ts`.
- **Critères d'acceptation** :
  1. L'import direct de `@mosaix-plugin/solara-content-moderator` est supprimé de `SolaraAppServiceProvider`.
  2. La modération s'exécute via `PluginEngine.runHook("solara.post.beforeCreate", ...)` lors de la création d'un post Solara.
  3. Si la modération échoue ou si le plugin est désactivé, le comportement configuré est respecté sans bloquer le coeur sauf rejet explicite.
- **Dépendances** : `PLG-02`, `PLG-03`
- **Priorité** : P1 (Élevée)
- **Estimation** : 1.0 j/h
- **Validation** : Suite de tests Solara (`pnpm --filter @apps/solara test`).
- **Traçabilité** : Diagnostic GAP-PLG-03

---

#### Tâche 5 : `PLG-05` — Raccordement d'Imperia (`ImperiaPluginManagerService`) au `PluginEngine`
- **Type** : Amélioration / Admin
- **Contexte** : `ImperiaPluginManagerService` utilise un catalogue simulé en mémoire.
- **Objectif** : Connecter le service d'administration d'Imperia au `PluginEngine` réel.
- **Périmètre** : `apps/imperia/src/domain/plugin-manager.service.ts`, `apps/imperia/src/infrastructure/imperia-controller.ts`.
- **Critères d'acceptation** :
  1. `listPlugins()` renvoie les plugins réellement enregistrés dans le `PluginEngine` en plus des paramètres d'extension.
  2. Les actions `enable`, `disable`, `configure` exécutées dans Imperia modifient réellement l'état du plugin dans le `PluginEngine`.
  3. L'audit log d'Imperia journalise fidèlement chaque changement d'état runtime de plugin.
- **Dépendances** : `PLG-02`, `PLG-03`
- **Priorité** : P2 (Moyenne)
- **Estimation** : 1.0 j/h
- **Validation** : Tests d'intégration d'Imperia (`pnpm --filter @apps/imperia test`).
- **Traçabilité** : Diagnostic GAP-PLG-04

---

#### Tâche 6 : `PLG-06` — Intégration des points de hooks canoniques dans la commande Checkout Commerce
- **Type** : Amélioration / Domaine
- **Contexte** : Le point de hook canonique `commerce.checkout.calculateDiscount` est défini dans le contrat mais jamais appelé.
- **Objectif** : Déclencher le hook de calcul de remise lors de l'exécution du Checkout dans Commerce.
- **Périmètre** : `apps/commerce/src/domain/order.service.ts` ou service Checkout associé.
- **Critères d'acceptation** :
  1. Lors du calcul du total du panier / commande, `PluginEngine.runHook("commerce.checkout.calculateDiscount", ...)` est appelé.
  2. Les plugins actifs proposant une remise (ex: `commerce-badge` ou discount engine) modifient le montant de manière traçable.
- **Dépendances** : `PLG-02`, `PLG-03`
- **Priorité** : P2 (Moyenne)
- **Estimation** : 1.0 j/h
- **Validation** : Tests unitaires et d'intégration Commerce.
- **Traçabilité** : Diagnostic GAP-PLG-05

---

#### Tâche 7 : `PLG-07` — Outillage de diagnostic CLI et documentation développeur de plugins
- **Type** : Documentation / Outillage
- **Contexte** : Absence de documentation formalisée sur la création de plugins pour MosaiX.
- **Objectif** : Fournir un guide développeur complet et valider les commandes CLI `pnpm mosaix plugin list|install|disable`.
- **Périmètre** : `docs/plugins-guide.md`, `packages/plugin-engine/src/management/plugin-cli.ts`.
- **Critères d'acceptation** :
  1. Création de `docs/plugins-guide.md` expliquant le cycle de vie, les manifestes `mosaix.json`, le sandboxing et la création de hooks.
  2. Vérification que la CLI `PluginCliCommandRunner` fonctionne correctement avec les plugins enregistrés.
- **Dépendances** : `PLG-01` à `PLG-05`
- **Priorité** : P3 (Faible)
- **Estimation** : 0.5 j/h
- **Validation** : Revue de documentation et exécution CLI.
- **Traçabilité** : Diagnostic d'expérience développeur.

---

## 7. Matrice de Traçabilité

| Constat Audit (GAP) | Recommandation Architecturale | Tâche Backlog | Critères d'Acceptation Clés |
|---|---|---|---|
| **GAP-PLG-01** (Mismatch de manifeste) | Centraliser `PluginManifest` dans `@mosaix/contracts` & `@mosaix/schemas`. | `PLG-01` | Schéma Zod unifié validant l'extension et les options avancées. |
| **GAP-PLG-02** (Dualité des registres) | Conserver Core pour le Kernel, déléguer le runtime dynamique à Plugin-Engine. | `PLG-01`, `PLG-02` | Pas de dépendance circulaire, rôle clair de chaque registre. |
| **GAP-PLG-03** (Plugins orphelins & imports statiques) | Dotoir chaque plugin de `mosaix.json` et utiliser l'exécution de hooks. | `PLG-03`, `PLG-04` | 6 `mosaix.json` créés, zéro import statique de plugin dans Solara. |
| **GAP-PLG-04** (Console Imperia déconnectée) | Connecter `ImperiaPluginManagerService` au `PluginEngine` réel. | `PLG-05` | Activation/désactivation dans Imperia modifie l'état réel du `PluginEngine`. |
| **GAP-PLG-05** (Absence de boot Shell) | Ajouter un provider `plugin-engine` dans `bootstrap/providers.ts`. | `PLG-02`, `PLG-06` | Singleton `PluginEngine` dans le Shell, exécution de hooks lors des requêtes HTTP. |

---

## 8. Questions Ouvertes et Décisions Requis

1. **Niveau d'Isolation en Production (`PluginSandboxEnvironment`)** :
   - *Question* : Souhaite-t-on imposer l'isolation par sous-contexte/worker pour tous les plugins tiers en production, ou conserver le mode In-Process isolé par timeout par défaut pour limiter la surcharge mémoire ?
   - *Recommandation* : Conserver In-Process avec timeout configurable (ex: 50ms) pour les plugins internes/de confiance, et réserver l'isolation poussée aux plugins marketplace tiers.

2. **Stratégie de Migration des 6 Plugins Existants** :
   - *Question* : Tous les plugins de `plugins/*` doivent-ils être convertis immédiatement en plugins dynamiques ou certains (ex: `commerce-comparator`) doivent-ils être intégrés comme composants natifs de Commerce ?
   - *Recommandation* : Traiter les 6 paquets comme des plugins dynamiques officiels MosaiX pour servir de référence d'implémentation pour l'écosystème.

---

## 9. Vue Synthétique des Priorités

- **Immédiat (V0 / P1)** : `PLG-01` (Contrats & Schémas), `PLG-02` (Bootstrapping Shell), `PLG-03` (Manifestes `mosaix.json`).
- **Moyen Terme (V1 / P1-P2)** : `PLG-04` (Migration Solara Moderator), `PLG-05` (Raccordement Imperia Admin).
- **Évolutions Ultérieures (V2 / P2-P3)** : `PLG-06` (Hooks Commerce Checkout), `PLG-07` (Outillage CLI & Guide Développeur).
