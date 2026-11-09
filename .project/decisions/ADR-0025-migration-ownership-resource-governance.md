# ADR-0025 — Migration Ownership & Resource Governance

**Date :** 2026-11-09  
**Statut :** Accepté (proposition de phase 02 de la roadmap migrations TypeScript)  
**Décideurs :** Architecture Steward  
**Lié à :** PRD-0006 (R7, R9), ADR-0006, ADR-0014, ADR-0016  
**Roadmap :** Phase 02 — T02-01 à T02-03, T02-05, T02-07

---

## 1. Contexte

Le moteur de migrations MosaiX (`@mosaix/migrations`) agrège des migrations provenant de plusieurs sources : packages framework, Shell Core, 10 BACs, et potentiellement des plugins. Jusqu'à présent, l'ownership des ressources SQL n'était pas formalisé de manière opposable :

- Le shell possède `user_subscriptions` alors que le BAC `subscription` déclare la même table avec un schéma divergent.
- `MigrationGovernanceService` (Imperia) maintient un état des migrations en duplication du `MigrationStore`.
- Les IDs de migration `otp` utilisent un format timestamp non canonique.
- Aucun registre canonique des ressources SQL n'existe.

Sans règles d'ownership strictes, le moteur ne peut pas détecter de manière fiable les collisions de ressources entre propriétaires, ni empêcher un BAC de modifier les tables d'un autre BAC.

---

## 2. Décision

### 2.1 Namespaces des propriétaires

Chaque source de migrations possède un `ownerId` appartenant à l'un des trois namespaces suivants :

| Namespace | Préfixe | Exemples d'ownerId | Ressources autorisées |
|-----------|---------|-------------------|----------------------|
| Framework | `framework.<package>` | `framework.core`, `framework.kernel`, `framework.platform`, `framework.migrations` | Tables système, métadonnées moteur, configuration plateforme |
| BAC | `bac.<name>` | `bac.citadelle`, `bac.commerce`, `bac.booking`, `bac.imperia`, `bac.solara`, `bac.solidarity`, `bac.subscription`, `bac.beam`, `bac.spaces`, `bac.portfolio` | Tables métier du BAC, données transactionnelles |
| Plugin | `plugin.<publisher>.<name>` | `plugin.ijideals.analytics`, `plugin.partner.crm` | Tables d'extension propres au plugin |

**Règle D1 :** Un `ownerId` est stable et identifie le propriétaire des ressources, pas la version logicielle du package. Une mise à jour de package ne change pas l'ownerId.

### 2.2 Règle d'ownership unique

**Règle D3 :** Une ressource SQL (table, index, contrainte, colonne) possède un propriétaire unique et canonique. Aucun autre owner ne peut créer, modifier ou supprimer cette ressource via une migration.

L'accès à une ressource appartenant à un autre owner se fait exclusivement par :
- Une API publique applicative,
- Un événement de domaine,
- Un contrat versionné explicite.

**Interdiction :** Un BAC, un package framework ou un plugin ne doit jamais exécuter de DDL (CREATE/ALTER/DROP TABLE, ALTER COLUMN, etc.) sur une table dont il n'est pas le propriétaire canonique.

### 2.3 Registre canonique des ressources

Le `MigrationValidator` (Phase 04) maintient un registre canonique des ressources déclarées par chaque migration via le champ `resources[]`. Ce registre est vérifié contre les opérations Blueprint réellement compilées avant toute exécution.

Une collision de ressource (deux owners déclarant la même ressource) bloque le plan avant toute transaction.

---

## 3. Conséquences

### 3.1 Propriétaire de `user_subscriptions`

**Décision :** Le propriétaire canonique de `user_subscriptions` est `bac.subscription`.

**Justification :** `user_subscriptions` est une donnée métier d'abonnement, relevant du domaine billing/subscription. Le Shell Core ne doit pas posséder de données métier BAC.

**Plan de transfert :**
1. Le Shell Core (`shell.core.v1.002_create_subscription_tables`) conserve la table pour rétrocompatibilité sur les bases déjà migrées.
2. Le BAC `subscription` déclare `user_subscriptions` comme sa ressource canonique.
3. Une migration de transition est créée par `subscription` pour reprendre la propriété (vérification de l'historique, conservation des données, tests de compatibilité).
4. Une fois le transfert effectif, le Shell Core supprime sa déclaration de `user_subscriptions` dans ses ressources et ne crée plus la table dans ses nouvelles migrations.

### 3.2 Ressources système Framework vs Citadelle

| Ressource | Propriétaire | Justification |
|-----------|-------------|---------------|
| `mosaix_migrations` (table des migrations) | `framework.migrations` | Métadonnées du moteur, infrastructure commune |
| Tables système framework (settings, feature flags, etc.) | `framework.core` / `framework.kernel` | Infrastructure plateforme |
| Identités, sessions, credentials, tokens | `bac.citadelle` | Domaine authentification/identité (Citadelle) |
| Espaces, équipes, rôles locaux | `bac.spaces` | Domaine organisationnel |
| Données métier (offres, commandes, posts, incidents, etc.) | BAC propriétaire métier | Chaque BAC possède ses données |

Citadelle ne possède pas les données métier des autres BACs. Citadelle gère l'authentification et l'autorisation, jamais la donnée métier directe.

### 3.3 Règles d'accès inter-BAC

| Type d'accès | Autorisé | Interdit |
|-------------|----------|----------|
| Lecture de données via API publique | ✅ | |
| Événement de domaine (publish/subscribe) | ✅ | |
| Contrat versionné explicite | ✅ | |
| DDL direct sur table étrangère (CREATE/ALTER/DROP) | | ✅ |
| Requête SQL directe sur table étrangère (bypass API) | | ✅ |
| Modification de schéma d'une ressource étrangère | | ✅ |

### 3.4 Règles de collision R9 (trois niveaux)

| Niveau | Contrôle | Quand détecté | Action |
|--------|----------|---------------|--------|
| Déclaratif | `resources[]` dans le Manifest/migration | Chargement (Registry) | `MigrationConflictError` si ID dupliqué |
| Structurel | Analyse des opérations Blueprint/AST | Validation du plan (Planner) | `MigrationResourceConflictError` si ressource SQL en double |
| Base réelle | Vérification des objets SQL existants et leur ownership | Validation du plan (Planner) | Blocage si un owner tente de modifier une ressource étrangère |

---

## 4. Conséquences négatives

- Une couche de validation supplémentaire (`MigrationValidator`) doit être implémentée avant l'exécution (Phase 04).
- Le transfert de `user_subscriptions` nécessite une migration de transition contrôlée.
- Les providers BAC existants déclarant des ressources sous des noms non préfixés doivent être audités.

---

## 5. Alternatives considérées

1. **Aucun ownership, premier arrivé premier servi** — Rejeté : ne permet pas de détecter les collisions inter-BAC.
2. **Ownership par schéma PostgreSQL uniquement** — Rejeté : SQLite ne supporte pas les schémas de la même manière ; l'ownership doit être porté par le contrat, pas seulement par le SGBD.
3. **Ownership géré par Imperia** — Rejeté : créerait une dépendance circulaire et un point de contrôle centralisé contraire à l'autonomie des BACs.

---

## 6. Critère de sortie (Jalon G0 de Phase 02)

Chaque ressource connue possède un propriétaire unique et les règles de modification sont explicites. Aucun owner ne peut modifier une ressource dont il n'est pas le propriétaire canonique.

---
*ADR produit dans le cadre de la Phase 02 de la roadmap migrations TypeScript. Aucun code modifié.*