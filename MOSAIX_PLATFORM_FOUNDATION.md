# MosaiX Platform Foundation — Spécification & Analyse d'Implémentation

**Rôle :** Senior Software Architect & Platform Engineer
**Périmètre :** `@mosaix/contracts`, `@mosaix/core`, `@mosaix/sdk` et l'écosystème des BACs (`apps/*`)
**Date :** Novembre 2026
**Statut :** Spécification Fondatrice Référente

---

## Vue d'Ensemble

**MosaiX** est une plateforme d'orchestration applicative modulaire et composable en TypeScript, conçue selon les principes de l'Architecture Hexagonale, du Domain-Driven Design (DDD) et du Monolithe Modulaire durci.

La plateforme repose sur trois piliers fondamentaux :
1. **Application Contract** : Le contrat déclaratif et typé qui formalise l'identité, les exigences, les capabilities et l'exposition d'un Bounded Application Context (BAC).
2. **Application Runtime** : Le moteur d'exécution autonome (`RuntimeKernel`) qui assure le cycle de vie, la gouvernance de sécurité RBAC/ABAC, le bus d'événements typé et la médiation des capabilities.
3. **Platform SDK** : La surface de programmation unifiée (`@mosaix/sdk`) permettant à un domaine métier d'interagir avec le noyau, de publier des événements, d'exécuter des workflows et de s'abstraire de l'infrastructure.

```
                           +-------------------------------------+
                           |        Application Contract         |
                           |    (ApplicationManifest, Typage)    |
                           +------------------+------------------+
                                              |
                                              v
+-------------------------------------+                +-------------------------------------+
|           Platform SDK              | <------------> |         Application Runtime         |
|   (MosaixApp, IoC, Router, Saga)    |                |     (RuntimeKernel, EventBus, RBAC) |
+-------------------------------------+                +-------------------------------------+
                                              |
                                              v
                           +-------------------------------------+
                           |   Bounded Application Contexts      |
                           |   (apps/citadelle, commerce, etc.)  |
                           +-------------------------------------+
```

---

## 1. Application Contract : Qu'est-ce qu'une application MosaiX ?

Dans MosaiX, une application n'est ni un simple script exécutable, ni un composant React isolé, ni un microservice réseau indépendant. Une application MosaiX est un **Bounded Application Context (BAC)** formalisé par un contrat déclaratif versionné, étendant le concept racine de **Mosaix Artifact**.

### 1.1 L'Artefact Racine (`MosaixArtifactManifest`)
Dans `packages/contracts/src/mosaix-artifact.ts`, la plateforme établit qu'elle n'administre pas des fichiers arbitraires, mais des unités gouvernées :
```typescript
export interface MosaixArtifactManifest {
  id: string;               // Identifiant canonique (ex: "@apps/commerce")
  name: string;             // Nom d'affichage lisible
  version: string;          // Version SemVer stricte (ex: "1.0.0")
  type: "application" | "plugin" | "theme";
  metadata?: ArtifactMetadata;
  capabilities?: CapabilityContract[] | Array<{ id: string; version: string }>;
  permissions?: PermissionContract[] | string[];
  dependencies?: ArtifactDependency[];
  trustLevel?: number;      // Niveau de confiance d'exécution (1..5)
  signature?: ArtifactSignature;
}
```

### 1.2 Le Contrat Applicatif Spécialisé (`ApplicationManifest`)
Dans `packages/contracts/src/application/application-manifest.ts`, le contrat `ApplicationManifest` enrichit l'artefact avec les dimensions d'architecture hexagonale :

1. **Domain Definition (`domain`) :**
   Déclare le nom du domaine métier, ainsi que la liste de ses entités, commandes et événements canoniques (ex: `apps/citadelle/src/index.ts`).
2. **Runtime Specification (`runtime`) :**
   Définit le point d'entrée d'exécution et le mode d'isolation :
   ```typescript
   runtime: { entrypoint: "./src/index.ts", isolation: "trusted" }
   ```
3. **Capabilities Exposes & Requises :**
   Liste exhaustive des capabilities fonctionnelles offertes à l'écosystème (ex: `spaces.space.create`, `portfolio.vendable.search`) et consommables par d'autres modules sans couplage de code.
4. **Matrice de Permissions (`permissions`) :**
   Grammaire stricte `domaine:resource:action:scope` (ex: `spaces:space:create:tenant`, `commerce:order:read:tenant`).
5. **Événements du Domaine (`events`) :**
   Contrat des événements asynchrones émis ou écoutés (ex: `spaces.space.created`, `commerce.order.completed`).
6. **Schéma & Stratégie de Données (`database`) :**
   Déclaration explicite de la stratégie de persistance (`per-app`), garantissant l'isolation dans son schéma PostgreSQL canonique (`CANONICAL_BAC_SCHEMAS`).
7. **Expérience & Extension UI (`experience` / `ui`) :**
   Déclaration des slots et points d'ancrage pour l'interface SSR et client (ex: contribution de fragments ou menus dans `frontend/src/index.ts`).

---

## 2. Application Runtime : Comment une application MosaiX fonctionne-t-elle ?

Le cœur d'exécution de la plateforme est le **RuntimeKernel** (`packages/core/src/kernel.ts`), qui orchestre le cycle de vie, la sécurité et la communication sans jamais créer de dépendances circulaires ni d'appels sauvages.

### 2.1 Le Cycle de Vie Unifié (`RuntimeComponentLifecycle`)
Chaque application franchit une machine à états déterministe lors du boot :
$$\text{DISCOVERED} \longrightarrow \text{VALIDATED} \longrightarrow \text{RESOLVED} \longrightarrow \text{LOADED} \longrightarrow \text{ACTIVE}$$
- **DISCOVERED :** Découverte du manifeste (`mosaix.json` ou export TypeScript).
- **VALIDATED :** Contrôle de conformité de schéma via Zod (`@mosaix/schemas` / `@mosaix/conformance`).
- **RESOLVED :** Résolution des dépendances et tri topologique DAG sans cycle.
- **LOADED :** Instanciation du Service Provider dans un conteneur IoC isolé.
- **ACTIVE :** Enregistrement des capabilities, schémas d'événements et montage des routes.

### 2.2 Médiation et Exécution des Capabilities
L'invocation d'une fonctionnalité entre applications ne se fait jamais par appel direct d'une fonction d'un autre module, mais via `kernel.executeCapability(capabilityId, callerApp, tenant, input)` :

1. **Vérification RBAC / ABAC :**
   Le Runtime calcule dynamiquement la permission requise via :
   ```typescript
   const required = `${RuntimeKernel.capabilityPermissionPrefix(entry.ownerApp, entry.id)}execute:tenant`;
   this.context.permissions.check(required, tenant, callerApp);
   ```
   Si l'application appelante ne possède pas la permission, une exception `AuthorizationError` est levée.
2. **Validation des Contrats (Input / Output) :**
   Si des validateurs (`PayloadValidator`, Zod) sont enregistrés, le Runtime valide l'entrée avant l'appel et la sortie après l'appel.
3. **Traçabilité & Métriques :**
   L'appel est enveloppé dans un span OpenTelemetry (`capability.execute`) avec corrélation de tenant et incrément métrique.
4. **Exécution de l'Exécuteur Déclaré :**
   L'exécuteur bound par l'application propriétaire traite la requête et retourne le résultat.

### 2.3 Bus d'Événements Métier Typé (`DomainEventBus`)
La synchronisation inter-domaines est asynchrone :
- Les schémas d'événements doivent être enregistrés au démarrage via `kernel.registerEventSchema(...)`.
- Toute émission produit une enveloppe universelle `MosaixEventEnvelope` (`id`, `type`, `version`, `source`, `timestamp`, `payload`, `tenant`, `correlationId`).
- Le bus valide le schéma du payload avant diffusion locale ou sur le message bus d'infrastructure.

### 2.4 Isolation des Contextes & Multi-Tenant
- **Conteneurs IoC Hiérarchiques :** Chaque BAC reçoit un conteneur enfant (`kernel.context.container.createChild()`). Cela empêche un BAC d'écraser les bindings du noyau ou d'un autre BAC.
- **Contextes Locaux Asynchrones (ALS) :** Le contexte de requête SSR (`renderContext`, `themeStateStorage`) est confiné dans `AsyncLocalStorage`, garantissant la thread-safety sous forte concurrence.

---

## 3. Platform SDK : Comment une application utilise-t-elle les capacités de MosaiX ?

Le package `@mosaix/sdk` (`packages/sdk/src/index.ts`) est l'unique dépendance framework qu'une application métier doit consommer pour s'intégrer à MosaiX.

### 3.1 La Fabrique de Démarrage Canonique (`createBoundedAppBootstrap`)
Chaque BAC initialise son instance via un bootstrap standardisé :
```typescript
export async function createBoundedAppBootstrap(options: BoundedAppBootstrapOptions): Promise<{
  container: Container;
  router: Router;
  app: MosaixApp;
}>
```
Cette méthode :
1. Crée le conteneur IoC enfant isolé pour l'application.
2. Injecte les instances stables (`kernel`, `tenant`, `manifest`).
3. Instancie un routeur HTTP isolé (`Router`).
4. Invoque les phases `register` puis `boot` du `ServiceProvider` de l'application.
5. Retourne l'instance `MosaixApp`.

### 3.2 L'Objet Applicatif `MosaixApp`
La classe `MosaixApp` encapsule toutes les interactions de haut niveau avec la plateforme :

- **Publication d'Événements :**
  ```typescript
  await app.publish("spaces.space.created", "1.0.0", { spaceId, name });
  ```
  Le SDK génère automatiquement l'enveloppe signée avec UUIDv7 et le contexte de tenant courant.
- **Fourniture de Capabilities :**
  ```typescript
  app.provideCapability("spaces.space.create", async (input) => {
    return spaceService.createSpace(input.name, input.ownerId);
  });
  ```
- **Consommation de Capabilities :**
  ```typescript
  const result = await app.executeCapability("portfolio.vendable.get", { ref: "SKU-123" });
  ```
- **Enregistrement de Schémas :**
  ```typescript
  app.registerEventSchema({ type: "spaces.space.created", version: "1.0.0", schema: spacesCreatedSchema });
  ```

### 3.3 Consommation des Services de Plateforme via le SDK
Le SDK expose également les abstractions clés évitant tout couplage infrastructure :
1. **Feature Flags Déclaratifs (`featureAsync`, `featureVariationAsync`) :**
   Évaluation unifiée à 4 niveaux (Port hexagonal -> Surcharges mémoire -> Variables d'environnement -> Valeur par défaut).
2. **Abstractions HTTP & Contrôleurs :**
   Re-export de `Router`, `Controller`, `HttpRequest`, `HttpResponse` (`@mosaix/http`).
3. **Persistance & ORM Hexagonal :**
   Re-export de `Model`, `applyTraits`, `SoftDeleteTrait`, `TimestampableTrait` (`@mosaix/orm`).
4. **Orchestration de Sagas :**
   Re-export de `WorkflowEngine` (`@mosaix/orchestration`) pour piloter les transactions longues avec compensation.

---

## 4. Synthèse : Matrice des Responsabilités

| Dimension | Application Contract | Application Runtime | Platform SDK |
|---|---|---|---|
| **Rôle** | Définition & Spécification | Gouvernance & Exécution | Utilisation & Outillage |
| **Localisation** | `packages/contracts` | `packages/core` | `packages/sdk` |
| **Responsabilité** | Typage, schémas, manifestes v2 | Cycle de vie, sécurité, bus, médiation | Classe `MosaixApp`, IoC, flags, HTTP |
| **Couplage Métier** | Zéro code exécutable | Agnostique des domaines | Interface fluide pour les développeurs de BAC |
| **Garantie** | Interopérabilité des artefacts | Herméticité & Sécurité runtime | Développabilité & Autonomie locale |

---

*Ce document fait foi pour toute implémentation ou refactorisation d'application au sein de la plateforme MosaiX.*
