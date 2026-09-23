# Rapport d'Audit : Stubs, Mocks, Persistance & Écarts de Production
**Date :** 22 Septembre 2026  
**Auteur :** Autonomous Engineering Steward  
**Statut :** Validé — Conforme à l'état réel du code

---

## 1. Résumé Exécutif

L'audit approfondi de la plateforme MosaiX révèle une infrastructure hexagonale (Ports & Adapters) particulièrement soignée au niveau des abstractions (`packages/ports-*`, `packages/contracts`, `packages/schemas`), mais un **fossé critique entre les contrats déclarés et l'exécution réelle** au niveau des Bounded Applications (BACs) et du runtime d'entrée (`src/start.ts`).

### Chiffres clés de l'audit
- **8 BACs sur 9** fonctionnent encore avec des magasins d'état en mémoire (`Map<string, T>` ou tableaux JS volatils) pour leurs opérations courantes, même lorsque des adaptateurs PostgreSQL existent.
- **28 occurrences d'interactions fictives (`alert()` / `prompt()`)** dans le code frontend des BACs simulant des actions métier sans appel API.
- **0 BAC ServiceProvider démarré dans `src/start.ts`** : le point d'entrée central sert les vues HTML des applications sans initialiser leurs contrôleurs ni leurs conteneurs d'injection de dépendances.
- **1 faille de sécurité critique** dans le pont OIDC / Introspection JWT (`packages/auth/src/oidc-bridge.ts`) acceptant des JWT non signés et intégrant un bypass en dur (`token-valid-*`).

---

## 2. Inventaire Détaillé par Domaine

### A. Sécurité, IAM & Gestion de Session (Critique)

| Composant | Fichier | Implémentation Actuelle | Risque / Écart |
| :--- | :--- | :--- | :--- |
| **OIDC Token Bridge** | `packages/auth/src/oidc-bridge.ts` | Décodage base64 direct du payload sans validation cryptographique de signature + bypass `token.startsWith("token-valid-")` | **Critique** : N'importe quel client peut forger un JWT arbitraire avec des rôles administrateur. |
| **Token Manager** | `packages/auth/src/token-manager.ts` | Enregistre `tokenId` dans le store mais renvoie un `accessToken` aléatoire distinct | **Élevé** : Désynchronisation entre le token détenu par le client et l'identifiant vérifiable en base. |
| **Citadelle IAM** | `apps/citadelle/src/index.ts` | Utilise par défaut `InMemoryUserRepository`, `InMemorySessionStore`, `InMemoryTokenStore`, `InMemoryCredentialStore`, `InMemorySecretsAdapter` | **Critique** : Toute authentification et tout compte utilisateur sont détruits au redémarrage du processus. |
| **Citadelle Frontend** | `apps/citadelle/frontend/src/index.ts` | Formulaires `<form id="login-form">` et `<form id="register-form">` sans script JS ni action de soumission | **Élevé** : Formulaires factices non raccordés aux endpoints d'authentification. |
| **Profils Utilisateur Shell** | `src/shell/profiles.ts` | Dictionnaire statique `USER_PROFILES` (`member`, `moderator`, `admin`) commuté via cookie | **Moyen** : Système de session démo, non connecté aux identités réelles de Citadelle ou SQLite. |

---

### B. Persistance & Logique Métier des Applications (Élevé)

| Application (BAC) | Fichiers Concernés | État de la Persistance | Statut de Raccordement |
| :--- | :--- | :--- | :--- |
| **Booking** | `apps/booking/src/domain/booking.model.ts`<br>`postgres-booking-repository.ts` | **Hybride (Corrigé)** : Persistance PostgreSQL implémentée avec fallback Map local | **Prod-Ready backend** (Référence pour les autres BACs). |
| **Spaces** | `apps/spaces/src/domain/space.model.ts`<br>`spaces-service-provider.ts` | `private spaces = new Map<string, Space>()`. Le constructeur de `SpaceService` ne prend aucun repository. | **Stub RAM** : `PostgresSpaceRepository` existe mais n'est pas injecté dans le service. Données volatiles. |
| **Solara** | `apps/solara/src/domain/social.model.ts`<br>`solara-service-provider.ts` | `new Map<string, Post>()`, `new Map<string, Comment[]>()`. Constructeur avec `_repository?: unknown` non référencé. | **Stub RAM** : Le repository Postgres n'est jamais appelé (`this.repository` undefined). Lectures 100% RAM. |
| **Beam** | `apps/beam/src/domain/messaging.model.ts`<br>`beam-service-provider.ts` | `new Map<string, ConversationModel>()` et `messages: MessageModel[] = []`. | **Écriture aveugle seule** : Appels `save*` en tâche de fond, mais toutes les lectures (`listConversations`, `getMessages`) lisent la RAM. Données perdues à la réouverture. |
| **Portfolio** | `apps/portfolio/src/index.ts`<br>`portfolio-service.ts` | `PortfolioAdapters` n'accepte que `InMemoryVendableRepository`. | **Non raccordé** : `PostgresVendableRepository` existe mais est exclu du Provider et de l'interface d'adaptateurs. |
| **Commerce** | `apps/commerce/src/infrastructure/order.repository.ts` | `private orders = new Map<string, OrderModel>()` | **Mock pur** : Aucune persistance SQL, stockage en mémoire vive uniquement. |
| **Solidarity** | `apps/solidarity/src/infrastructure/solidarity-service.ts` | 7 `Map<string, T>` distinctes (incidents, besoins, dons, ressources, hubs, missions, distributions) | **Mock pur** : Aucune table de base de données, pas de repository. |
| **Imperia** | `apps/imperia/src/domain/platform-settings.service.ts` | `overrides = new Map<string, string>()` avec étiquette trompeuse `source: "database_override"` | **Stub RAM** : Paramètres modifiés à chaud en mémoire, non persistés en base. |
| **Fil d'actualité Shell** | `src/shell/feed-store.ts` | `export const feedStore: FeedPost[] = [...]` (tableau JavaScript) | **Stub RAM** : Les posts créés via `/api/feed` sont stockés dans un tableau JS en mémoire. |

---

### C. Infrastructure, Modules Transverses & Moteur de Thèmes (Moyen)

| Composant | Emplacement | Implémentation | Impact Production |
| :--- | :--- | :--- | :--- |
| **Theme Assignments** | `@mosaix/core` | `InMemoryThemeAssignmentsStore` utilisé dans `start.ts` | Les préférences de thème (mode clair/sombre, thème actif par tenant) sont réinitialisées au redémarrage. |
| **Migrations** | `packages/migrations` | `InMemoryMigrationStore` par défaut | L'historique des migrations appliquées n'est pas persisté si le store SQL n'est pas injecté explicitement. |
| **Observabilité** | `packages/core/src/observability.ts` | `InMemoryMetrics` et `InMemoryTracer` | Métriques et traces accumulées en RAM sans exporteur OTel ou Prometheus actif par défaut. |
| **Bus d'Événements** | `packages/core/src/event-bus.ts` | `InMemoryEventBus` | Pas d'outbox durable : les événements asynchrones sont perdus en cas de crash lors de l'émission. |

---

### D. Interfaces Utilisateur & Frontends (Démo-Ware)

L'audit des répertoires `apps/*/frontend/` met en évidence un découplage presque complet entre les interfaces visuelles et les API backend :

1. **Interactions factices via `alert()` et `prompt()`** (28 occurrences) :
   - **Portfolio** (`apps/portfolio/frontend/src/index.ts`) : La création d'offre utilise `prompt("Nom de l'offre :")` et crée un élément `<tr>` dans le DOM sans aucune requête réseau. L'export JSON et les boutons d'impression déclenchent des `alert()`.
   - **Spaces** (`apps/spaces/frontend/src/index.ts`) : Les boutons de suppression de membre, export de métriques et duplication de template affichent des `alert()`.
   - **Commerce** (`apps/commerce/frontend/src/index.ts`) : L'ajout d'articles et la commande sont simulés via `alert()`.
   - **Solidarity** (`apps/solidarity/frontend/src/index.ts`) : La prise en charge de mission affiche des dialogues d'alerte.
2. **Absence de requêtes asynchrones vers les contrôleurs BAC** :
   - Les contrôleurs HTTP des BACs (`SpaceController`, `SolaraController`, `BeamController`, `BookingController`) exposent des routes REST (`/spaces`, `/solara/feed`, `/beam/conversations`), mais les frontends ne les appellent pas. Ils affichent du HTML pré-rendu avec des données statiques en dur.

---

### E. Point d'Entrée & Runtime du Shell (`src/start.ts`)

1. **Non-démarrage des conteneurs BAC** :
   - `src/start.ts` n'initialise aucun `RuntimeKernel` exécutant `boot()` sur les `ServiceProviders` des applications.
   - Les requêtes sur les routes BAC (ex. `/booking`, `/spaces`, `/solara`) sont interceptées pour injecter du HTML statique (`matchedApp.renderView()`) sans monter les routeurs d'API.
2. **SQLite minimaliste ad-hoc** :
   - Un fichier `data/mosaix.sqlite` est créé avec une unique table `identities` sommaire, non synchronisée avec les modèles ORM ou le système de migrations formel.

---

## 3. Plan d'Action Recommandé (Roadmap de Remédiation)

### Phase 1 : Sécurisation & Intégrité Noyau (P0) — **[COMPLETED]**
1. **[COMPLETED] Corriger OIDC Bridge & Token Manager** : Valider la signature JWT cryptographique et éliminer le bypass de test `token-valid-*`. Aligner `tokenId` et `accessToken` dans `TokenManager`.
2. **[COMPLETED] Brancher Citadelle sur une persistance réelle** : Raccorder `CitadelleServiceProvider` à `SQLiteIdentityStoreAdapter` / `PostgresIdentityStoreAdapter` et implémenter `PostgresCredentialStore` / `SQLiteCredentialStore` pour les mots de passe.

### Phase 2 : Persistance des Applications Clés (P1)
1. **Spaces & Solara** :
   - Injecter `PostgresSpaceRepository` dans `SpaceService` (à l'identique de ce qui a été fait sur `BookingService`).
   - Corriger `SolaraSocialService` pour qu'il sauvegarde ET relise depuis `PostgresSocialRepository`.
2. **Beam & Portfolio** :
   - Raccorder `BeamMessagingService.listConversations` et `getMessages` au repository persistant.
   - Étendre `PortfolioAdapters` pour accepter `databasePort` et instancier `PostgresVendableRepository`.
3. **Persistance Shell & Imperia** :
   - Remplacer `feedStore` en mémoire par une table SQLite/Postgres.
   - Brancher `PlatformSettingsService` sur la base de données.

### Phase 3 : Raccordement Frontend-Backend (P2)
1. **Remplacer les `alert()` / `prompt()` par des appels d'API réels** (`fetch('/spaces', ...)` / `fetch('/portfolio', ...)`).
2. **Activer le routage API des BACs dans le serveur central** via un routeur unifié ou une passerelle API.
