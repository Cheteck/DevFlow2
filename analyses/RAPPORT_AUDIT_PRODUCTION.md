# RAPPORT D'AUDIT D'ÉLIGIBILITÉ PRODUCTION (PRODUCTION-READINESS CODE AUDIT)

- **Projet :** MosaiX Framework & Applications
- **Auteur :** Jules (Senior Software Engineer & Technical Lead)
- **Date :** Septembre 2026
- **Portée :** Inspection approfondie du code source (`apps/`, `packages/`, `src/shell/`, `plugins/`)
- **Statut :** Complété

---

## 1. Résumé Exécutif

Un audit approfondi du code source de la plateforme **MosaiX** a été réalisé afin de vérifier la maturité et l'éligibilité pour une mise en production réelle (*production-readiness*).

L'analyse ne s'est pas limitée à la recherche de marqueurs textuels (tels que `TODO` ou `mock`), mais a procédé à une inspection systématique des flux d'exécution réels à travers les différentes couches applicatives :
$$\text{Controller / API} \longrightarrow \text{Service} \longrightarrow \text{Domain Logic} \longrightarrow \text{Repository / Data Access} \longrightarrow \text{Persistence / External API}$$

**Constat Principal :** Bien que l'architecture globale (architecture hexagonale, séparation des contrats, typage TypeScript strict) soit de très haut niveau, plusieurs composants applicatifs stratégiques contiennent des **stubs**, des **implémentations temporaires non persistées**, des **contournements de sécurité**, ou des **écritures en base de données silencieuses**. En l'état, une mise en production entraînerait des pertes de données sévères lors des redémarrages de serveurs, des failles d'authentification et des risques de double réservation sous charge.

---

## 2. Tableau Synthétique des Problèmes Identifiés

| Sévérité | Type | Fichier / Emplacement | Problème | Impact | Action Recommandée |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CRITICAL** | `NO_PERSISTENCE` | `apps/commerce/src/infrastructure/order.repository.ts` | Commandes stockées uniquement dans une `Map` mémoire | Perte totale des commandes et paniers au redémarrage serveur | Connecter un adaptateur Postgres/SQLite persistent |
| **CRITICAL** | `NO_PERSISTENCE` | `apps/subscription/src/domain/subscription.service.ts` | Abonnements et metering stockés uniquement en mémoire | Réinitialisation des forfaits payants et du compteur de consommation | Créer un dépôt persistant pour les abonnements et le metering |
| **CRITICAL** | `HARDCODED` / `STUB` | `apps/citadelle/src/infrastructure/identity-controller.ts` | `handleLogout`, `handleRefresh` et `getProfile` retournent des objets fixes hardcodés | La déconnexion, le rafraîchissement de token et la lecture de profil sont factices | Raccorder les méthodes à `AuthManager`, `TokenManager` et `IdentityStore` |
| **HIGH** | `PARTIAL_IMPLEMENTATION` | `apps/booking/src/domain/booking.model.ts` | Vérification et incrément de capacité de créneau non atomiques | Race condition permettant des doubles réservations simultanées | Implémenter un verrouillage transactionnel `SELECT ... FOR UPDATE` |
| **HIGH** | `SILENT_ERROR` | `apps/solara/src/domain/social.model.ts` | Sauvegarde en DB via `void savePost(...)` sans `await` ni gestion d'erreur | L'API indique un succès même si l'insertion DB échoue | Rendre les méthodes `async`, `await` la persistance et propager les erreurs |
| **HIGH** | `SILENT_ERROR` | `apps/solidarity/src/infrastructure/solidarity-service.ts` | Écritures en DB exécutées sans `await` avec `.catch()` masquant les échecs | Confirmation de création d'incident/don d'urgence sans garantie de persistance | Awaiter les appels aux dépôts et propager les erreurs d'écriture |
| **HIGH** | `NOT_PROD_READY` | `src/shell/psp-webhook-handler.ts` | Signature Webhook PSP ignorée hors `NODE_ENV=production` | Injection possible de faux paiements et validation frauduleuse d'ordres en Staging/UAT | Exiger la vérification de signature dans tous les environnements connectés |
| **HIGH** | `PARTIAL_IMPLEMENTATION` | `packages/auth/src/auth-manager.ts` | `authenticate()` crée une session active même si le MFA est activé | Contournement du second facteur de sécurité (2FA/MFA) | Intercepter le flux et exiger la validation du challenge TOTP avant émission de session |
| **MEDIUM** | `STUB` | `apps/citadelle/src/index.ts` | `createCitadelleComposition` instancie `IdentityController` sans services | Toutes les requêtes HTTP renvoient un code 503 "Service Unavailable" | Déprécier ou injecter obligatoirement `AuthManager` et `UserService` |
| **MEDIUM** | `HARDCODED` | Multiple (`booking`, `solara`, `solidarity`) | Identifiants d'entités générés via `Math.random().toString(36)` | Collisions de clés primaires sous forte charge et prédictibilité d'IDs | Injecter et utiliser `IdGeneratorPort` (`UuidGeneratorAdapter` / `UlidGeneratorAdapter`) |
| **MEDIUM** | `NO_PERSISTENCE` | `apps/portfolio/src/index.ts` | Fallback sur `InMemoryVendableRepository` si `databasePort` manque | Perte des articles de catalogue produits hors configuration explicite | Forcer l'injection du port de base de données au démarrage |

---

## 3. Statistiques & Répartitions de l'Audit

### Nombre Total de Problèmes Confirmés : 11

### Répartition par Sévérité
- **CRITICAL (Bloquant / Perte de données majeure / Faille) :** 3 (27.3%)
- **HIGH (Risque fonctionnel majeur / Incohérence) :** 5 (45.5%)
- **MEDIUM (Dette technique / Robustesse) :** 3 (27.2%)
- **LOW :** 0

### Répartition par Type de Problème
- `NO_PERSISTENCE` (Non raccordé à la persistance) : 3
- `SILENT_ERROR` (Erreurs silencieuses / Écritures masquées) : 2
- `HARDCODED` / `STUB` (Valeurs statiques / Méthodes factices) : 2
- `PARTIAL_IMPLEMENTATION` (Fonctionnalité incomplète / Lock manquant) : 2
- `NOT_PROD_READY` (Bypass de sécurité / Inquiétude d'environnement) : 2

### Fonctionnalités Concernées
- **Commerce & Commandes (`commerce`) :** Validation de commande, gestion des paniers, persistance des transactions.
- **Abonnements & Metering (`subscription`) :** Droits d'accès, suivi des unités consommées, forfaits récurrents.
- **Identité & Authentification (`citadelle`, `@mosaix/auth`) :** Profils utilisateurs, déconnexion, rafraîchissement de token, interception MFA.
- **Réservations & Prise de RDV (`booking`) :** Atomicité des créneaux, prévention du sur-booking.
- **Réseau Social (`solara`) & Entraide D'Urgence (`solidarity`) :** Garantie de persistance des publications, dons et incidents.
- **Passerelle de Paiement PSP (`src/shell`) :** Sécurisation cryptographique des webhooks bancaires.

---

## 4. Rapport Détaillé des Problèmes Identifiés

### 1. Absence de Persistance dans le BAC Commerce (`OrderRepository`)
- **Fichier et Emplacement :** `apps/commerce/src/infrastructure/order.repository.ts` (`OrderRepository`, Lignes 3–24) & `apps/commerce/src/index.ts` (Ligne 115)
- **Type de problème :** `NO_PERSISTENCE`
- **Description :**
  Les commandes clients créées via le service Commerce sont stockées exclusivement dans une `Map<string, OrderModel>` en mémoire vive. Aucun schéma de base de données, ORM ou adaptateur SQL/Postgres n'est raccordé à ce dépôt.
- **Preuves dans le code :**
  ```typescript
  export class OrderRepository {
    private orders = new Map<string, OrderModel>();

    async save(order: OrderModel): Promise<OrderModel> {
      order.touch();
      this.orders.set(order.id as string, order);
      return order;
    }
  ```
- **Impact :**
  Toutes les commandes passées par les clients, les historiques de paiement et les statuts de livraison sont définitivement perdus lors du redémarrage du processus Node.js ou lors du déploiement d'une mise à jour.
- **Sévérité :** `CRITICAL`
- **Action recommandée :**
  Implémenter un adaptateur de dépôt `PostgresOrderRepository` (et/ou `SQLiteOrderRepository`) basé sur `@mosaix/ports-database`, effectuer la migration de table `commerce_orders` et l'injecter dans `CommerceAppServiceProvider`.
- **Statut de confiance :** `CONFIRMED`

---

### 2. Absence de Persistance dans le BAC Subscription (`SubscriptionService`)
- **Fichier et Emplacement :** `apps/subscription/src/domain/subscription.service.ts` (`SubscriptionService`, Lignes 3–108)
- **Type de problème :** `NO_PERSISTENCE`
- **Description :**
  Le service de gestion des abonnements, des forfaits récurrents et du metering de consommation s'appuie sur deux attributs privés de type `Map` : `private plans = new Map()` et `private subscriptions = new Map()`. Aucune interface de persistance n'est définie ni injectée.
- **Preuves dans le code :**
  ```typescript
  export class SubscriptionService {
    private plans = new Map<string, SubscriptionPlan>();
    private subscriptions = new Map<string, UserSubscription>();
  ```
- **Impact :**
  Les souscriptions d'abonnements payants, les dates d'expiration de périodes et le comptage des unités d'usage (metering) sont volatils. Tout redémarrage réinitialise l'ensemble des utilisateurs sur le forfait gratuit par défaut.
- **Sévérité :** `CRITICAL`
- **Action recommandée :**
  Créer l'interface `SubscriptionRepositoryPort`, implémenter un adaptateur de persistance SQL pour les tables `subscription_plans`, `user_subscriptions` et `metered_usage_logs`, puis raccorder le service au noyau runtime.
- **Statut de confiance :** `CONFIRMED`

---

### 3. Réponses Hardcodées et Stubs dans le Contrôleur d'Authentification (`IdentityController`)
- **Fichier et Emplacement :** `apps/citadelle/src/infrastructure/identity-controller.ts` (`IdentityController`, Lignes 59–71)
- **Type de problème :** `HARDCODED` / `STUB`
- **Description :**
  Les méthodes d'API `handleLogout`, `handleRefresh` et `getProfile` retournent des réponses JSON fixes hardcodées sans effectuer la moindre logique métier ni appeler le moteur d'authentification ou la persistance.
- **Preuves dans le code :**
  ```typescript
  async handleLogout(_req: HttpRequest): Promise<HttpResponse> {
    return { statusCode: 200, body: { message: "Logged out" } };
  }

  async handleRefresh(_req: HttpRequest): Promise<HttpResponse> {
    return { statusCode: 200, body: { token: "refreshed-token" } };
  }

  async getProfile(_req: HttpRequest): Promise<HttpResponse> {
    return { statusCode: 200, body: { user: { id: "profile-1" } } };
  }
  ```
- **Impact :**
  - `handleLogout` ne révoque aucune session ni aucun token côté serveur.
  - `handleRefresh` délivre un token factice `"refreshed-token"` sans vérifier le refresh token transmis.
  - `getProfile` retourne toujours l'identifiant statique `"profile-1"` au lieu du profil de l'utilisateur authentifié.
- **Sévérité :** `CRITICAL`
- **Action recommandée :**
  Raccorder `handleLogout` à `authManager.revokeSession()`, raccorder `handleRefresh` à `tokenManager.refreshToken()`, et raccorder `getProfile` à `identityStore.findById(currentUserId)`.
- **Statut de confiance :** `CONFIRMED`

---

### 4. Absence de Verrouillage Atomique et Condition de Course (`BookingService.createReservation`)
- **Fichier et Emplacement :** `apps/booking/src/domain/booking.model.ts` (`BookingService`, Lignes 319–383)
- **Type de problème :** `PARTIAL_IMPLEMENTATION` / `NOT_PROD_READY`
- **Description :**
  La réservation de créneau vérifie la capacité (`slot.reservedCount >= slot.capacity`) puis incrémente le compteur (`slot.reservedCount += 1`) en mémoire simple. La mise à jour en base de données n'utilise pas de transaction SQL avec verrouillage de ligne.
- **Preuves dans le code :**
  ```typescript
  if (slot.reservedCount >= slot.capacity) {
    slot.status = "fully_booked";
    throw new Error(`Ce créneau [${input.slotId}] est complet...`);
  }
  ...
  slot.reservedCount += 1;
  ```
- **Impact :**
  Lors de pics de réservation simultanées (ex: ouverture de billetterie), deux requêtes exécutées en parallèle passeront la vérification de capacité avant que le compteur ne soit incrémenté, entraînant des **doubles réservations (sur-booking)** non autorisées.
- **Sévérité :** `HIGH`
- **Action recommandée :**
  Implémenter une requête SQL atomique au niveau du dépôt :
  `UPDATE booking_slots SET reserved_count = reserved_count + 1 WHERE id = ? AND reserved_count < capacity`
  ou utiliser un bloc transactionnel PostgreSQL `SELECT ... FOR UPDATE`.
- **Statut de confiance :** `CONFIRMED`

---

### 5. Écritures Asynchrones Silencieuses sans `await` dans le BAC Solara (`SolaraSocialService`)
- **Fichier et Emplacement :** `apps/solara/src/domain/social.model.ts` (`SolaraSocialService`, Lignes 216–218, 281–283)
- **Type de problème :** `SILENT_ERROR` / `PARTIAL_IMPLEMENTATION`
- **Description :**
  Les opérations de persistance en base de données (`savePost` et `addFollower`) sont exécutées de manière asynchrone non attendue (`void this.repository.savePost(...)`), et les rejets de promesses sont interceptés par un `.catch()` qui se contente d'afficher un `console.error`.
- **Preuves dans le code :**
  ```typescript
  if (this.repository) {
    void this.repository.savePost(post).catch((err: unknown) => {
      console.error("[Solara] Failed to persist post to Postgres:", err);
    });
  }
  return post;
  ```
- **Impact :**
  L'API retourne un résultat positif (HTTP 201) à l'utilisateur alors que la sauvegarde en base de données PostgreSQL a pu échouer (ex: panne DB, contrainte violée). Le contenu est perdu au redémarrage sans que l'utilisateur ou le client API n'en soit informé.
- **Sévérité :** `HIGH`
- **Action recommandée :**
  Transformer les méthodes `createPost` et `followActor` en fonctions `async`, appliquer un `await` sur les méthodes du dépôt, et propager les exceptions d'écriture vers la couche contrôleur/API.
- **Statut de confiance :** `CONFIRMED`

---

### 6. Écritures Asynchrones Silencieuses sans `await` dans le BAC Solidarity (`SolidarityService`)
- **Fichier et Emplacement :** `apps/solidarity/src/infrastructure/solidarity-service.ts` (`SolidarityService`, Lignes 42–126)
- **Type de problème :** `SILENT_ERROR` / `PARTIAL_IMPLEMENTATION`
- **Description :**
  Même schéma que Solara : les méthodes `createIncident`, `declareNeed`, `submitDonation`, `registerHub`, `assignMission` et `confirmDistribution` lancent la persistance DB via `void this.repository.save...()` sans `await`.
- **Preuves dans le code :**
  ```typescript
  if (this.repository) {
    void this.repository.saveIncident(incident).catch((err: unknown) => {
      console.error("[Solidarity] Failed to persist incident:", err);
    });
  }
  return incident;
  ```
- **Impact :**
  S'agissant d'un module de gestion d'urgence humanitaire et de solidarité, la fausse confirmation de création d'incident ou de don en cas de défaillance réseau/DB peut avoir des conséquences critiques sur le terrain.
- **Sévérité :** `HIGH`
- **Action recommandée :**
  Convertir la totalité des méthodes de création de `SolidarityService` en méthodes asynchrones `async/await` garantissant la validation de l'écriture en base avant le retour HTTP.
- **Statut de confiance :** `CONFIRMED`

---

### 7. Contournement de la Vérification de Signature Webhook PSP Hors-Production (`PspWebhookHandler`)
- **Fichier et Emplacement :** `src/shell/psp-webhook-handler.ts` (`PspWebhookHandler.handleWebhookRequest`, Lignes 38–42)
- **Type de problème :** `NOT_PROD_READY` / `HARDCODED`
- **Description :**
  Le traitement des webhooks de paiement (Stripe/Adyen/Mollie) vérifie la signature HMAC-SHA256, mais **ignore l'échec de signature** si la variable d'environnement `NODE_ENV` n'est pas strictement égale à `"production"`.
- **Preuves dans le code :**
  ```typescript
  const isValid = this.verifySignature(bodyStr, signatureHeader, webhookSecret);
  if (!isValid && process.env.NODE_ENV === "production") {
    sendProblemResponse(res, 401, "Invalid Signature", "La signature cryptographique du webhook est invalide.");
    return;
  }
  ```
- **Impact :**
  Dans les environnements de recette (Staging, Dev, UAT), n'importe quel tiers peut envoyer des requêtes HTTP POST non authentifiées sur `/api/psp/webhook` et valider arbitrairement des commandes (`commerce.order.paid`) ou accorder des abonnements gratuits (`subscription.user.updated`).
- **Sévérité :** `HIGH`
- **Action recommandée :**
  Refuser systématiquement les webhooks dont la signature est invalide dès lors qu'une clé secrète est configurée, et lever une erreur bloquante au démarrage si `PSP_WEBHOOK_SECRET` n'est pas définie.
- **Statut de confiance :** `CONFIRMED`

---

### 8. Absence d'Interception MFA lors de l'Authentification (`AuthManager.authenticate`)
- **Fichier et Emplacement :** `packages/auth/src/auth-manager.ts` (`AuthManager.authenticate`, Lignes 47–111)
- **Type de problème :** `PARTIAL_IMPLEMENTATION`
- **Description :**
  Lorsqu'un utilisateur s'authentifie, le gestionnaire `AuthManager` valide le mot de passe puis génère immédiatement une session valide sans vérifier si le compte exige un second facteur (MFA/2FA), ignorant l'attribut `mfa_enabled`.
- **Preuves dans le code :**
  ```typescript
  const session = await this.createSession(
    principal.identityId,
    tenantId,
    request.context,
  );

  return {
    status: "authenticated",
    principal,
    session,
  };
  ```
- **Impact :**
  Bien que les endpoints de configuration MFA existent (`/identity/mfa/setup`), le second facteur n'est jamais réclamé lors de la connexion, annulant la protection contre la compromission de mots de passe.
- **Sévérité :** `HIGH`
- **Action recommandée :**
  Connecter `ChallengeManager` au sein de `AuthManager.authenticate()` : si `identity.attributes.mfa_enabled` est vrai, retourner `status: "mfa_required"` avec un `challengeId` temporaire au lieu d'une session finale.
- **Statut de confiance :** `CONFIRMED`

---

### 9. Factory de Composition Déconnectée / Incomplète dans Citadelle (`createCitadelleComposition`)
- **Fichier et Emplacement :** `apps/citadelle/src/index.ts` (`createCitadelleComposition`, Lignes 185–199)
- **Type de problème :** `STUB` / `PARTIAL_IMPLEMENTATION`
- **Description :**
  La fonction de composition legacy `createCitadelleComposition` instancie `new IdentityController()` sans lui passer `AuthManager` ni `UserService`.
- **Preuves dans le code :**
  ```typescript
  export function createCitadelleComposition(parentContainer?: Container) {
    ...
    const controller = new IdentityController();
    container.instance(IdentityController, controller);
  ```
- **Impact :**
  Toute partie de l'application qui utiliserait cette factory pour démarrer le module d'identité Citadelle obtiendra des réponses HTTP 503 sur toutes les routes d'authentification.
- **Sévérité :** `MEDIUM`
- **Action recommandée :**
  Déprécier explicitement `createCitadelleComposition` au profit de `createCitadelleApp()` ou injecter les instances complètes des services requis.
- **Statut de confiance :** `CONFIRMED`

---

### 10. Génération d'Identifiants Pseudo-Aléatoires Insécurisés (`Math.random()`)
- **Fichier et Emplacement :**
  - `apps/booking/src/domain/booking.model.ts` (Lignes 189, 248, 303, 345)
  - `apps/solara/src/domain/social.model.ts` (Ligne 200)
  - `apps/solidarity/src/infrastructure/solidarity-service.ts` (Lignes 36, 50, 64)
- **Type de problème :** `HARDCODED` / `NOT_PROD_READY`
- **Description :**
  Plusieurs services du domaine métier génèrent les clés primaires de leurs entités (réservations, créneaux, posts, incidents, dons) via `Math.random().toString(36)` combiné à `Date.now()`.
- **Preuves dans le code :**
  ```typescript
  id: `slot-${Math.random().toString(36).substring(2, 9)}`,
  id: `res-${Math.random().toString(36).substring(2, 9)}`,
  id: `post-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  id: `INC-${Date.now()}`,
  ```
- **Impact :**
  1. Risque élevé de collisions de clés primaires en cas de requêtes simultanées dans la même milliseconde.
  2. Prédictibilité des identifiants (vulnérabilité de type Resource Enumeration).
- **Sévérité :** `MEDIUM`
- **Action recommandée :**
  Injecter systématiquement le port `IdGeneratorPort` (`UuidGeneratorAdapter` ou `UlidGeneratorAdapter` fournis par la plateforme) dans tous les constructeurs de services du domaine.
- **Statut de confiance :** `CONFIRMED`

---

### 11. Fallback vers un Dépôt In-Memory par Défaut dans Portfolio (`PortfolioServiceProvider`)
- **Fichier et Emplacement :** `apps/portfolio/src/index.ts` (`PortfolioServiceProvider.register`, Lignes 72–85)
- **Type de problème :** `NO_PERSISTENCE` / `HARDCODED`
- **Description :**
  Lors de l'enregistrement du provider Portfolio, si `databasePort` n'est pas explicitement fourni dans les options, le système retombe silencieusement sur `InMemoryVendableRepository`.
- **Preuves dans le code :**
  ```typescript
  if (this.adapters.vendableRepository) {
    repository = this.adapters.vendableRepository();
  } else if (this.adapters.databasePort) {
    repository = new PostgresVendableRepository(this.adapters.databasePort);
  } else {
    repository = new InMemoryVendableRepository();
  }
  ```
- **Impact :**
  Si le démarrage de l'application omet d'injecter la configuration de base de données, le catalogue produits bascule en mode volatile sans avertissement bloquant.
- **Sévérité :** `MEDIUM`
- **Action recommandée :**
  Lever une erreur de configuration explicite en environnement de production si aucun `databasePort` ni adaptateur persistant n'est détecté.
- **Statut de confiance :** `CONFIRMED`

---

## 5. Dépendances & Intégrations Manquantes

Pour rendre l'ensemble de l'écosystème **MosaiX** pleinement opérationnel en production, les éléments techniques suivants doivent être implémentés ou raccordés :

1. **Adaptateurs de Persistance SQL / ORM :**
   - Adaptateur de persistance pour les commandes (`PostgresOrderRepository` / `Commerce BAC`).
   - Adaptateur de persistance pour les abonnements et le suivi de consommation (`Subscription BAC`).
2. **Gestionnaire de Transactions & Verrouillage DB :**
   - Support des verrous transactionnels `SELECT FOR UPDATE` au niveau de `@mosaix/ports-database` pour les réservations d'ateliers et de créneaux (`Booking BAC`).
3. **Moteur d'Interception MFA / TOTP :**
   - Intégration du flux de validation TOTP à 2 facteurs au sein du pipeline `@mosaix/auth`.
4. **Générateur d'Identifiants Sécurisés Unifié :**
   - Remplacement de `Math.random()` par l'adaptateur ULID/UUID (`@mosaix/adapter-id-uuid`) dans tous les BACs applicatifs.

---

## 6. Checklist de Mise en Production (Production Readiness Checklist)

Cette checklist est établie **exclusivement** à partir des défaillances et insuffisances réellement observées dans le code source lors de cet audit.

### 🔐 Sécurité & Authentification
- [ ] **MFA Guard Interceptif :** Vérifier que `AuthManager.authenticate()` retourne `status: "mfa_required"` et exige la validation TOTP avant délivrance du token de session.
- [ ] **Contrôleur Identity Citadelle :** Raccorder `handleLogout` à la révocation réelle de session et `handleRefresh` à la validation cryptographique des refresh tokens.
- [ ] **Validation Signature Webhook PSP :** Supprimer la condition `process.env.NODE_ENV === "production"` dans `PspWebhookHandler` et rejeter strictement tout webhook non signé ou invalide.
- [ ] **Génération d'IDs Sécurisés :** Remplacer tous les appels à `Math.random()` par `UuidGeneratorAdapter` / `UlidGeneratorAdapter`.

### 🗄️ Persistance & Transactions Base de Données
- [ ] **Persistance Commerce :** Remplacer la `Map` mémoire d' `OrderRepository` par une table SQL `commerce_orders` persistée sous Postgres/SQLite.
- [ ] **Persistance Subscription :** Remplacer les `Map` mémoire de `SubscriptionService` par un dépôt persistant pour les forfaits et le metering d'usage.
- [ ] **Garantie d'Écriture Solara & Solidarity :** Supprimer le mot-clé `void` et le `.catch()` aveugle sur `savePost`, `saveIncident`, `submitDonation` ; appliquer `await` et propager les erreurs SQL.
- [ ] **Réservation Atomique Anti-Double Booking :** Implémenter une contrainte atomique ou un verrou `FOR UPDATE` sur la table `booking_slots` lors de la création d'une réservation.
- [ ] **Fail-Fast Configuration DB :** Interdire le fallback silencieux sur des dépôts In-Memory (`InMemoryVendableRepository`, `InMemoryUserRepository`) lorsque l'application tourne en mode production.

---

### Conclusion & Évaluation Globale

**Score d'Éligibilité Production Actuel : 14 / 40 (Niveau Fragile / Correctifs Requis)**

| Domaine | Statut Observé | Action Prioritaire |
| :--- | :--- | :--- |
| **Architecture & Typage** | 🟢 Conforme & Robuste | Conserver le modèle d'injection de dépendances et de contrats |
| **Persistance des Données** | 🔴 Non Conforme (3 BACs en mémoire) | Implémenter les dépôts Postgres pour Commerce & Subscription |
| **Sécurité Webhooks & Auth** | 🟠 Risques Majeurs | Activer l'intercepteur MFA et la validation stricte des webhooks |
| **Intégrité des Transactions** | 🟠 Risques de Race Condition | Sécuriser l'atomicité des réservations Booking |

Une fois les 11 points corrigés conformément aux actions recommandées dans ce rapport, le système MosaiX atteindra un niveau d'éligibilité production optimal.
