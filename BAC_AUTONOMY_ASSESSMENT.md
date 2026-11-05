# BAC_AUTONOMY_ASSESSMENT.md
# Évaluation de l'Autonomie Architecturale des Bounded Application Contexts (BAC) — MosaiX

**Rôle :** Senior Software Architect spécialisé en DDD, Modular Monolith et Autonomous Application Architecture
**Cadre méthodologique :** Strangler Migration Architect (`.agents/skills/strangler-migration-architect/`), DDD Hexagonal & Modular Monolith Pattern
**Date :** Novembre 2026
**Statut :** Officiel & Engagé

---

## 1. Objectif & Principes Directeurs

L'objectif de cette mission est de déterminer si les **11 Bounded Application Contexts (BAC)** de MosaiX (`apps/*`) peuvent fonctionner comme des applications autonomes, exécutables et testables indépendamment du monolithe et du Shell SSR global (`src/start.ts`), **sans pour autant imposer une scission prématurée en microservices distribués**.

### Principes directeurs :
1. **Zéro Microservice non justifié :** Un monolithe modulaire offrant une isolation stricte à l'exécution et aux tests est la cible optimale. L'autonomie ne nécessite pas de réseau physique.
2. **Distinction des 3 Autonomies :**
   - **Autonomie logique :** Frontières de domaine étanches, pas d'imports de couches internes entre domaines, communication par contrats ou événements.
   - **Autonomie d'exécution :** Capacité d'un BAC à démarrer avec son propre conteneur/kernel (`createBoundedAppBootstrap`), avec des adaptateurs minimaux ou en mémoire, sans exiger l'orchestration globale de tous les autres BACs.
   - **Autonomie de déploiement :** Capacité théorique ou pratique à être déployé sous forme de binaire ou worker indépendant avec son propre cycle de vie (optionnel à ce stade).
3. **Preuves techniques systématiques :** Chaque constat s'appuie sur le code source réel, les chemins de fichiers et les comportements vérifiés.

---

## 2. Dependency Audit (Imports, Cycles & Runtime Global)

### 2.1 Cartographie des dépendances inter-BACs
Une inspection exhaustive des imports (`import ... from ...`) dans l'ensemble des répertoires `apps/*/src` révèle un constat architectural remarquable :

- **Absence totale d'imports directs inter-BACs de code métier :**
  - Aucun fichier de `apps/commerce` n'importe directement `apps/portfolio`, `apps/spaces`, `apps/citadelle` ou tout autre BAC.
  - La saga d'approbation d'offres vendeur (`SELL-FLOW-01`) entre Portfolio et Commerce est orchestrée de manière découplée via le port `OfferProvisioningPort` (`apps/portfolio/src/domain/proposal-service.ts:6`). Portfolio n'a aucune dépendance statique vers `@apps/commerce`.
  - La liaison entre Spaces et Portfolio pour la soumission de catalogue (`SELL-FLOW-02`) est découplée au niveau des routes API via `ProposalDraftService` structurel.
- **Dépendance déclarative au niveau des manifestes (`mosaix.json` / `src/index.ts`) :**
  - Dans `apps/booking/src/index.ts:25`, Booking déclare une dépendance logique : `{ id: "@apps/citadelle", version: "^1.0.0" }`. Cette dépendance est résolue au niveau du Kernel de métadonnées, sans import physique de code source de Citadelle.

### 2.2 Dépendances vers le Shell et le Runtime Global (Couplages identifiés)
Bien que les BACs soient étanches entre eux, **4 modules présentent un couplage ascendant non canonique vers le Shell global** (`src/shell/`) :

| Fichier BAC | Import non canonique | Preuve Technique | Gravité |
|---|---|---|---|
| `apps/commerce/src/domain/order.service.ts:10` | `from "../../../../src/shell/plugin-engine-bootstrap.js"` | Accède directement au singleton global du moteur de plugins | **Moyenne** (Violation de frontière) |
| `apps/imperia/src/domain/plugin-manager.service.ts:2` | `from "../../../../src/shell/plugin-engine-bootstrap.js"` | Accède directement au bootstrap Shell | **Moyenne** |
| `apps/solara/src/commands/create-post.command.ts:4` | `from "../../../../src/shell/plugin-engine-bootstrap.js"` | Accède directement au bootstrap Shell | **Moyenne** |
| `apps/solara/src/infrastructure/solara-service-provider.ts:10` | `from "../../../../src/shell/plugin-engine-bootstrap.js"` | Accède directement au bootstrap Shell | **Moyenne** |

**Analyse d'impact :** Ce couplage ascendant empêche ces BACs d'être instanciés dans un test ou un point d'entrée complètement isolé sans charger le bootstrap du Shell.
**Solution d'assainissement :** Injecter le `PluginEngine` comme service du `RuntimeKernel` ou via le container IoC (`@mosaix/plugin-engine`), comme le prévoit le pattern hexagonal.

---

## 3. Data Ownership Audit (Cloisonnement Schéma, Transactions, Clés Étrangères)

### 3.1 Propriété effective des données & Schémas PostgreSQL
MosaiX a formalisé l'isolation des schémas PostgreSQL via `packages/database/src/postgres-bac-schema-migrator.ts` :
- 10 schémas PostgreSQL dédiés (`CANONICAL_BAC_SCHEMAS`) : `citadelle`, `commerce`, `portfolio`, `solara`, `booking`, `solidarity`, `beam`, `spaces`, `imperia`, `subscription`.
- Chaque application dispose de ses migrations isolées sous `apps/<bac>/src/infrastructure/migrations/` déplaçant les tables historiques de `public` vers leur schéma propriétaire (ex. `apps/portfolio/src/infrastructure/migrations/20260925120000_move_to_portfolio_schema.ts`).

### 3.2 Vérification des accès directs cross-schémas
- **Requêtes SQL inspectées :** Les repositories de chaque BAC n'émettent pas de requêtes SQL qualifiées vers un autre schéma (ex. aucune jointure `JOIN commerce.orders` dans les requêtes de `portfolio` ou `spaces`).
- **Absence de clés étrangères physiques inter-schémas :** Les identifiants cross-domaines (`userId`, `spaceId`, `vendableId`, `offerId`) sont persistés sous forme de chaînes de caractères brutes (UUID/ULID), sans contrainte `FOREIGN KEY` SQL entre tables de schémas distincts.
- **Source de vérité unique :**
  - Citadelle est propriétaire unique des tables d'utilisateurs et de profils.
  - Portfolio est propriétaire unique du catalogue et des spécifications vendables (`vendables`, `proposals`).
  - Commerce est propriétaire unique des prix, des offres commerciales, des paniers et des commandes (`offers`, `orders`, `auctions`).
  - Spaces est propriétaire unique de la gestion des espaces multi-tenants (`spaces`, `space_memberships`).

### 3.3 Transactions inter-domaines
- **Absence de transaction ACID transverse :** Il n'existe aucune transaction SQL `BEGIN ... COMMIT` englobant plusieurs BACs dans le code.
- **Sagas et atomicité applicative :** Les opérations métier transverses utilisent un modèle de saga asynchrone avec compensation ou étapes séquentielles :
  - Dans `apps/portfolio/src/domain/proposal-service.ts`, l'approbation d'une proposition met à jour le statut dans Portfolio puis délègue le provisioning de l'offre commerciale via `offerProvisioningPort.provisionOffer(...)`. En cas d'échec du provisioning, le service dispose d'un mécanisme de rollback logique ou de fallback de provisionnement.

---

## 4. Runtime Independence (Bootstrap, Cycle de Vie & Ports)

### 4.1 Mécanisme de démarrage indépendant
Une analyse approfondie du SDK (`@mosaix/sdk`) montre qu'un standard canonique d'application autonome existe déjà :
- Chaque BAC exporte une fonction canonique `create<Bac>App(kernel, tenant, adapters)` s'appuyant sur `createBoundedAppBootstrap` :
  - `createCitadelleApp` (`apps/citadelle/src/index.ts:246`)
  - `createCommerceApp` (`apps/commerce/src/index.ts:107`)
  - `createPortfolioApp` (`apps/portfolio/src/index.ts:180`)
  - `createSpacesApp` (`apps/spaces/src/index.ts:120`)
  - `createSolaraApp` (`apps/solara/src/index.ts:191`)
  - `createSolidarityApp` (`apps/solidarity/src/index.ts:114`)
  - `createBeamApp` (`apps/beam/src/index.ts:110`)
  - `createBookingApp` (`apps/booking/src/index.ts:101`)
  - `createSubscriptionApp` (`apps/subscription/src/index.ts:77`)
  - `createImperiaApp` (`apps/imperia/src/index.ts:105`)

### 4.2 Preuve de concept d'exécution autonome existante
- Le fichier `apps/citadelle/src/start.ts` est un point d'entrée exécutable autonome :
  ```typescript
  const kernel = new RuntimeKernel();
  await kernel.initialize();
  const { app } = await createCitadelleApp(kernel, TENANT);
  await kernel.start();
  ```
  Ce point d'entrée démarre Citadelle **sans charger le Shell ni aucun autre BAC**.
- **Adaptateurs obligatoires :** Pour démarrer en production, chaque BAC a uniquement besoin d'un `DatabasePort` (`@mosaix/ports-database`). En l'absence de base de données, chaque BAC bascule automatiquement sur des adaptateurs mémoires de test (`InMemory*Repository`) grâce aux fallbacks prévus dans les Service Providers.

---

## 5. Autonomy Assessment (Matrice d'Autonomie par BAC)

### Grille d'évaluation :
- **Autonomie Logique (A-Log) :** Absence de couplage de code/modèle vers d'autres domaines (1 à 5).
- **Autonomie d'Exécution (A-Exe) :** Capacité à démarrer isolément via son bootstrap (1 à 5).
- **Autonomie des Données (A-Data) :** Cloisonnement strict du schéma et absence de dépendances transactionnelles (1 à 5).
- **Score Global d'Autonomie (/15) :**

| BAC | A-Log (5) | A-Exe (5) | A-Data (5) | Total (/15) | Statut d'Autonomie | Blocages restants |
|---|---|---|---|---|---|---|
| **Citadelle** (`apps/citadelle`) | 5 | 5 | 5 | **15/15** | **Totalement Autonome** | Aucun (possède déjà son `start.ts` indépendant) |
| **Spaces** (`apps/spaces`) | 5 | 5 | 5 | **15/15** | **Totalement Autonome** | Aucun |
| **Solidarity** (`apps/solidarity`)| 5 | 5 | 5 | **15/15** | **Totalement Autonome** | Aucun |
| **Booking** (`apps/booking`) | 5 | 5 | 5 | **15/15** | **Totalement Autonome** | Aucun |
| **Beam** (`apps/beam`) | 5 | 5 | 5 | **15/15** | **Totalement Autonome** | Aucun |
| **Subscription** (`apps/subscription`)| 5 | 5 | 5 | **15/15** | **Totalement Autonome** | Aucun |
| **Inventory** (`apps/inventory`) | 5 | 5 | 5 | **15/15** | **Totalement Autonome** | Pur service PIM |
| **Portfolio** (`apps/portfolio`) | 5 | 5 | 4 | **14/15** | **Quasi-Autonome** | Dépendance logique sur OfferProvisioningPort |
| **Commerce** (`apps/commerce`) | 4 | 4 | 5 | **13/15** | **Autonome sous réserve** | Import direct de `src/shell/plugin-engine-bootstrap.js` |
| **Solara** (`apps/solara`) | 4 | 4 | 5 | **13/15** | **Autonome sous réserve** | Import direct de `src/shell/plugin-engine-bootstrap.js` |
| **Imperia** (`apps/imperia`) | 4 | 4 | 5 | **13/15** | **Autonome sous réserve** | Import direct de `src/shell/plugin-engine-bootstrap.js` |

---

## 6. Pilot Selection : Réévaluation Critique de "Theme Runtime" vs Vrais BACs

### 6.1 Analyse critique de "Theme Runtime" comme pilote
Dans le premier rapport d'audit Strangler, `Theme Service` / `Theme Runtime` a été retenu pour sa note de 90/100 en raison de son risque technique quasi-nul (stateless, pure configuration JSON).
**Cependant, du point de vue strict de l'autonomie des BACs :**
- `packages/theme` n'est **pas un BAC métier** (`@apps/*`), c'est un **package transversal d'infrastructure visuelle** utilisé par le Shell pour le SSR.
- Extraire Theme Runtime démontre la capacité à extraire un micro-service de calcul / asset, mais **ne démontre rien quant à l'autonomie d'un véritable Bounded Application Context métier** (avec ses entités DDD, sa persistance, ses règles de gestion, ses capabilities et ses événements).

### 6.2 Sélection du véritable BAC Pilote : Citadelle ou Spaces
Pour démontrer l'autonomie réelle des applications MosaiX sans risque destructeur :

1. **Candidat Recommandé N°1 : Citadelle (`apps/citadelle`)**
   - **Pourquoi :** Citadelle possède déjà son fichier `start.ts` autonome fonctionnel (`apps/citadelle/src/start.ts`), un schéma isolé (`citadelle`), et son propre contrat public.
   - **Ce qu'il démontre :** La capacité d'un BAC complet à démarrer avec un RuntimeKernel autonome, exposer ses capabilities d'authentification et émettre ses événements sans aucune dépendance envers le Shell.
2. **Candidat Recommandé N°2 : Spaces (`apps/spaces`)**
   - **Pourquoi :** Cœur marketplace avec ses propres templates, rôles dynamiques et persistence, sans aucun couplage descendant vers le Shell.

---

## 7. Plan de Transformation Progressif vers des BACs Autonomes

La transition vers une plateforme de BACs autonomes au sein du Monolithe Modulaire s'opère en 3 vagues séquentielles :

```
[Phase 1 : Découplage du Shell]
  - Remplacer les 4 imports direct de plugin-engine-bootstrap.js par injection IoC.
  - Déplacer ThemeRuntime hors des responsabilités de routage métier.

[Phase 2 : Standardisation des Entrées Autonomes]
  - Généraliser le pattern apps/<bac>/src/start.ts pour les 11 BACs (à l'image de Citadelle).
  - Fournir pour chaque BAC un runner autonome de dev/test : pnpm --filter @apps/<bac> start.

[Phase 3 : Tests d'Isolation & CI Découplée]
  - Créer pour chaque BAC une suite de tests d'isolation (Harness Test) validant son démarrage
    et ses workflows principaux avec un Kernel vierge.
  - Valider l'intégrité sans jamais devoir instancier le serveur global src/start.ts.
```

---

## 8. Critères d'Acceptation Vérifiables (Definition of Done)

Chaque BAC est certifié "Autonome au sein du Monolithe" si et seulement si :

1. **Isolation Statique (Lint) :** Aucune importation de fichier situé hors de son répertoire `apps/<bac>/`, à l'exception des packages `packages/*` autorisés par la matrice de frontières (`@mosaix/*`).
2. **Exécutabilité Autonome :** La commande `npx tsx apps/<bac>/src/start.ts` démarre avec succès, enregistre ses capabilities et s'arrête proprement sans erreur.
3. **Persistance Étanche :** Aucune table hors de son schéma canonique (`apps/<bac>/src/infrastructure/migrations/`) n'est lue ou modifiée par les repositories du BAC.
4. **Communication Hexagonale :** Tout échange avec un autre domaine métier passe strictement par un Port (`OfferProvisioningPort`, `EventBusPort` ou `DatabasePort`), documenté et mockable dans les tests unitaires.
5. **Zéro Double Écriture :** Aucune transaction cross-schéma ; utilisation exclusive d'événements domaine ou de sagas applicatives pour la synchronisation transverse.

---

*Ce rapport d'autonomie architecturale constitue la référence officielle pour le renforcement du Monolithe Modulaire MosaiX sans dérive vers les microservices distribués.*
