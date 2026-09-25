# Audit complet du système d'injection et d'extensibilité — MosaiX

**Date initiale :** 2026-09-24
**Mise à jour :** 2026-09-24 — Réanalyse complète après refonte Shell (rev.2)
**Périmètre :** `D:\Téléchargements\devflow`
**Type :** Audit d'extensibilité (pas un audit de sécurité)
**Auteur :** Muse Spark — Autonomous Engineering Steward
**Version du framework :** MosaiX v1.0 (FRAMEWORK.md)
**Commits analysés :** `a6222a5` refactor: implement in-memory guard and theme improvements *(HEAD)* — diff `bf25309..a6222a5`

---

## Table des matières

1. [Journal de mise à jour (rev.2)](#journal-de-mise-à-jour-rev2)
2. [Identifier le Core](#1-identifier-le-core)
3. [Mécanismes d'injection](#2-identifier-tous-les-mécanismes-dinjection)
4. [Cartographie de l'architecture](#3-cartographier-larchitecture)
5. [Fonctionnalités déjà injectées](#4-identifier-les-fonctionnalités-déjà-injectées)
6. [Vérifier l'isolation du Core](#5-vérifier-lisolation-du-core)
7. [Détecter les switches dans le Core](#6-détecter-les-switches-dans-le-core)
8. [Évaluer l'extensibilité par domaine](#7-évaluer-lextensibilité)
9. [Fonctionnalités qui devraient être injectées](#8-identifier-les-fonctionnalités-qui-devraient-être-injectées)
10. [Ajout sans toucher au Core](#9-vérifier-la-possibilité-dajouter-une-fonctionnalité-sans-toucher-au-core)
11. [Analyse du couplage](#10-analyse-du-couplage)
12. [Proposition d'architecture d'extension](#11-proposition-dune-architecture-dextension)
13. [Test d'extensibilité](#12-test-dextensibilité)
14. [Rapport final](#13-rapport-final)

---

## Journal de mise à jour (rev.2)

### Ce qui a changé depuis l'audit initial (2026-09-24 rev.1)

Le diff `HEAD~3..HEAD` (≈ 1895 insertions / 11002 suppressions) est une **refonte Shell majeure**. L'audit initial diagnostiquait un Shell monolithique de 1600 lignes comme goulot principal — cette refonte en corrige **partiellement** la forme, sans toucher au Core.

| Fichier | Avant (rev.1) | Après (rev.2) | Verdict |
|---|---|---|---|
| `src/start.ts` | **1600+ lignes** — 13 `if(pathname===)` + 503 gate + SSR inline | **233 lignes** (`src/start.ts:1`) — 6 étapes pipeline (`// 1. Static`, `// 2. Context`, `// 3. Maintenance Gate`, `// 4. API Dispatcher`, `// 5. BAC Routing`, `// 6. Home SSR`) | **Amélioration P0 réalisée** : -1370 lignes, lisibilité et maintenabilité en hausse. Reste un couplage d'import (voir §5). |
| `src/server/api-dispatcher.ts` | 58 lignes, ne couvrait que 5 routes | **138 lignes** (`src/server/api-dispatcher.ts:35`) — 8 modules: `maintenance`, `theme`, `user/space`, `feature-flags`, `composition`, `auth`, `feed`, `compliance` + fallback RFC 7807 | **Amélioration P0 partielle** : les 8 routes Shell manquantes sont désormais déléguées. Reste à extraire PSP/GDPR/SSE du `compliance-routes.ts` si besoin. |
| `src/server/middleware/maintenance-gate.ts` | inline `src/start.ts:214` `if(maintenanceService.isMaintenanceActive())` | **78 lignes** (`src/server/middleware/maintenance-gate.ts:13`) `handleMaintenanceGate(req,res,pathname,role,mode,styles): boolean` | **Amélioration P0 partielle** : gate extrait, testable, mais **toujours** `import {maintenanceService} from "../../../apps/imperia/..."` (`:7`) — violation Layer 7 boundary non corrigée. |
| `src/server/routes/*` | 4 fichiers partiels | **6 fichiers** : `maintenance-routes.ts:11` (64 l.), `theme-routes.ts:12` (109 l.), `feed-routes.ts:13` (110 l.), `compliance-routes.ts:15` (106 l.), `composition-routes.ts`, `feature-flag-routes.ts` | Nouveau — chaque route est désormais **extension point** par fichier (ajouter une route = ajouter un fichier + 1 ligne dans `api-dispatcher.ts`). |
| `src/shell/pages/home-page.ts` + `bac-page.ts` | Inline dans `start.ts` (800 lignes SSR) | **388 + 201 lignes** (`src/shell/pages/home-page.ts:32` `renderHomePage`, `bac-page.ts:36` `renderBacPage`) | SSR externalisé — Core non touché, Shell découpé. |
| `src/shell/client/shell-client-scripts.ts` | Inline `<script>` 300 lignes dans `start.ts` | **190 lignes** (`src/shell/client/shell-client-scripts.ts:29`) `getShellClientScripts()` + `renderShellToastContainer` | Toast/confirm/locale/role-space switch externalisés. |
| `src/shell/imperia-nav.ts` | Inline `apps/imperia/frontend/src/index.ts` 1800 lignes | **116 lignes** (`src/shell/imperia-nav.ts:21`) `IMPERIA_NAV_SECTIONS` (2 sections, 10 items) — recommandation #1 de l'audit initial appliquée | Navigation Imperia externalisée — reste hard-codée (10 items) mais plus dans le BAC. |
| `src/shell/renderer.ts` | 800+ lignes | **111 lignes importées** + `getShellClientScripts` | Allégé (détail §5). |
| `packages/support/src/in-memory-guard.ts` | N'existait pas | **23 lignes** (`packages/support/src/in-memory-guard.ts:6`) `InMemoryGuard.reportFallback(componentName, reason)` — guard `NODE_ENV=production` + `ALLOW_IN_MEMORY_IN_PRODUCTION` | **Nouveau garde-fou** : concrétise `.project/architecture/in-memory-policy.md:15` ; à brancher dans `apps/portfolio/src/index.ts:73` et `apps/commerce/src/infrastructure/commerce-service-provider.ts:21` où `InMemory*Repository` est encore `new` sans guard. |
| `src/shell/dynamic-bac-registry.ts` | 10 imports `frontend/src/index` | **Toujours 10 imports** mais `frontend/src/index` → `presentation/index` (`:1`) pour booking; `apps/*/src/presentation/index.ts` n'existe que pour `booking` | **Non corrigé** : goulot `DynamicBacRegistry` hard-codé inchangé — ajout BAC = toujours 2 lignes Shell (`dynamic-bac-registry.ts` + `discovery.ts:6` `APP_ICONS`). |
| `apps/*/frontend/src/index.ts` | 400-1800 l. par BAC (JS inline) | **Supprimés** (diff `-1010` beam, `-1785` imperia, `-706` portfolio, etc.) — seul `booking/src/presentation/index.ts` survit (501 l.) | Frontend BAC externalisé — mais `DynamicBacRegistry` n'en profite pas (toujours import statique). |
| `packages/core/src/modules/index.ts` | `defaultModules()` = 3 modules | **Inchangé** (`:26`) — `PluginModule` toujours non default | **Non corrigé** : recommandations P0 #2 non appliquée. |
| `packages/core/src/plugin/plugin-registry.ts` | Open, non câblé | **Inchangé** | Toujours mort. |

**Synthèse rev.2 :** le Shell est passé de **"très fort couplage monolithique"** à **"fort couplage modulaire"** — la découpe est réelle et testable, mais 3 violations d'architecture identifiées en rev.1 subsistent : (1) `maintenanceService` import hors container, (2) `DynamicBacRegistry` hard-codé, (3) `PluginRegistry`/`SlotRegistry` non câblés. L'`InMemoryGuard` est un gain net de robustesse.

---

## 1. Identifier le Core

### 1.1 Définition du Core

Le Core est constitué des **Framework Planes 1 et 4** (FRAMEWORK.md §1) + le **Shell modulaire** qui en est l'extension critique.

| Couche | Localisation | Rôle | Modifiable sans toucher au domaine |
|---|---|---|---|
| **Runtime Kernel** | `packages/core/src/kernel.ts:47` `RuntimeKernel` | Machine à états 7 états (`CREATED → INITIALIZING → READY → RUNNING → STOPPING → STOPPED/FAILED`), installation topologique des `KernelModule`, `mountRouter`, `executeCapability`, `register` manifest | **NON** — c'est le noyau |
| **KernelContext** | `packages/core/src/kernel-module.ts:62` | Contrat stable unique exposé aux modules/apps. 6 services canoniques fermés `KERNEL_SERVICE_NAMES` + `container`/`apps` | **NON** |
| **IoC Container** | `packages/container/src/container.ts:24` `Container` | `bind/singleton/scoped/instance/make/createChild`, parent chain, auto-instantiation | **NON** |
| **Capability / Event / Permission Registries** | `packages/core/src/capability-registry.ts:39`, `event-schema-registry.ts:29`, `permission.ts:18` | Single-owner registries, `resolve/bindContract/execute` | **NON** |
| **Event Bus + Store** | `packages/core/src/event-bus.ts:111` `DomainEventBus`, `packages/core/src/event-bus.ts:37` `EventStore` | Publish/subscribe tenant-scoped, `RetryPolicy`, `DeadLetterQueue`, permission `*:type:publish/consume:tenant` | **NON** |
| **RouteRegistry** | `packages/core/src/route-registry.ts:8` | `registerRoute` avec conflit `method:path` | **NON** |
| **ServiceProvider** | `packages/core/src/providers/base-service-provider.ts:6`, `packages/container/src/container.ts:147` | `register(container)` + `boot(container,router)` pattern AdonisJS | **NON** (contrat) |
| **Contracts/Schemas/Types** | `packages/contracts/src/*`, `packages/schemas/src/*`, `packages/types/src/*` | ABI canonique (`ApplicationManifest`, `PluginManifest`, `MosaixEventEnvelope`, `ThemeManifest`) | **NON** |
| **SDK** | `packages/sdk/src/index.ts:28` `MosaixApp` + `packages/sdk/src/index.ts:256` `createBoundedAppBootstrap` | Façade `register/publish/provideCapability/executeCapability/registerCapabilityContract` + `featureAsync` | **NON** |
| **Ports** | `packages/ports/*/src/index.ts` (24 ports) | Interfaces hexagonales `DatabasePort`, `FeatureFlagsPort`, `SearchPort`... | **NON** |
| **Shell Modulaire** *(rev.2 : ex-monolithe)* | `src/start.ts:83` (233 l.) + `src/server/api-dispatcher.ts:35` (138 l.) + `src/server/middleware/maintenance-gate.ts:13` + `src/server/routes/*` (6 fichiers) + `src/shell/pages/*` + `src/shell/client/shell-client-scripts.ts:29` | Serveur `http.createServer` — pipeline 6 étapes (`static → context → maintenance → api → bac → home`), SSR externalisé, gate extrait | **Partiellement Core** — découpe réelle mais 3 couplages subsistent (voir §5 rev.2) |

### 1.2 Infrastructure extensible sans toucher au Core

Tout ce qui suit est **hors Core** et extensible par conception :

- **Adapters** : `packages/adapters/*` (40 adapters) — chaque adapter dépend uniquement de son port
- **KernelModules optionnels** : `PluginModule`, `DatabaseModule`, `InfrastructureModule` (`packages/core/src/modules/*`)
- **Guards** : `packages/support/src/in-memory-guard.ts:6` `InMemoryGuard` *(nouveau rev.2)*
- **BACs** : `apps/*` (10 Bounded Application Contexts)
- **Plugins** : `plugins/*` (6 plugins)
- **Themes** : `themes/*`
- **Compositions** : `config/compositions/*.json`

### 1.3 Parties qui peuvent être étendues sans modifier le Core

> Les 8 BACs canon (`portfolio`, `commerce`, `beam`, `solara`, `spaces`, `citadelle`, `solidarity`, `booking`, `subscription`) sont ajoutés/supprimés **sans** modifier `packages/core` ni `packages/contracts`. Le seul résidu de couplage est le Shell (`src/start.ts:83`, `src/shell/dynamic-bac-registry.ts:25`, `src/shell/discovery.ts:6`).

---

## 2. Identifier tous les mécanismes d'injection

### 2.1 Inventaire complet (vérifié sur le code réel — rev.2)

| # | Mécanisme | Fichiers / Classes | Statut rev.2 |
|---|---|---|---|
| **DI-1** | **IoC Container** `bind/singleton/scoped/instance/createChild` | `packages/container/src/container.ts:24` `Container` | Fonctionnel, utilisé partout (`packages/sdk/src/index.ts:262` crée `child`) |
| **DI-2** | **ServiceProvider** `register`/`boot` | `packages/core/src/providers/base-service-provider.ts:6`, chaque `apps/*/src/index.ts` ex. `apps/portfolio/src/index.ts:63` `PortfolioServiceProvider` | Fonctionnel — 10 BACs conformes au schéma canon |
| **DI-3** | **KernelModule** injection | `packages/core/src/kernel-module.ts:174`, `packages/core/src/modules/index.ts:26` `defaultModules()` | Fonctionnel, `packages/core/src/kernel.ts:182` `RuntimeKernel.install` + tri topologique `packages/core/src/kernel.ts:616` `getOrderedModules` — **toujours 3 modules default**, `PluginModule` non activé |
| **DI-4** | **Adapters Hexagonaux** Ports/Adapters | `packages/ports/*/src`, `packages/adapters/*/src` — 24 ports / 40 adapters (`PACKAGES.md:11`) | Fonctionnel, ex. `apps/portfolio/src/index.ts:70` `PostgresVendableRepository` vs `InMemory` fallback — **nouveau** `InMemoryGuard:6` à brancher |
| **DI-5** | **InMemoryGuard** *(nouveau rev.2)* | `packages/support/src/in-memory-guard.ts:6` `InMemoryGuard.reportFallback` | **Nouveau** — guard `NODE_ENV=production` + `ALLOW_IN_MEMORY_IN_PRODUCTION`; non encore branché dans les 2 `InMemory*Repository` fallbacks |
| **EVT-1** | **DomainEventBus** `publish/subscribe/setRetryPolicy/deadLetters` | `packages/core/src/event-bus.ts:111` `DomainEventBus` | Fonctionnel mais **sous-utilisé inter-BAC** (aucune subscription cross-BAC hors `src/server/routes/feed-routes.ts:57` `eventBackplane.publish("solara.post.published")`) |
| **EVT-2** | **EventSchemaRegistry** single-owner | `packages/core/src/event-schema-registry.ts:29` | Fonctionnel, `packages/core/src/kernel.ts:444` `registerEventSchema` |
| **EVT-3** | **DistributedEventBackplane** (Shell) | `src/shell/event-backplane.ts` (importé `src/start.ts:20`) + `src/server/routes/compliance-routes.ts:56` SSE | Shell-only, pas dans le Core |
| **CAP-1** | **CapabilityRegistry** `register/resolve/bindContract/execute` | `packages/core/src/capability-registry.ts:39` + `packages/core/src/kernel.ts:464` `executeCapability` avec permission `packages/core/src/kernel.ts:532` `capabilityPermissionPrefix` | Fonctionnel — extension point principal inter-BAC |
| **PERM-1** | **PermissionRegistry** `grant/deny/check` wildcard `*:*:*:tenant` | `packages/core/src/permission.ts:18`, `packages/core/src/policy-engine.ts:20` `PolicyEngine` | Fonctionnel, extensible (`domain:resource:action:scope`) |
| **PLUG-1** | **PluginRegistry** `register/activate/deactivate/extensionsAt` OPEN | `packages/core/src/plugin/plugin-registry.ts:45` + `packages/contracts/src/plugin/plugin-extension.ts:10` | **Déclaré fonctionnel mais NON câblé** — `PluginModule` **pas dans** `defaultModules()` (`:26`) ; `extensionPointsKeys:129` ouvert (jamais d'erreur `D-17`) |
| **PLUG-2** | **PluginEngine** `PluginManagementService` + `PluginSandbox` | `packages/plugin-engine/src/*` (`FRAMEWORK.md:36`) | Code présent mais **jamais importé** par `src/start.ts` ni `kernel` — mort |
| **PLUG-3** | **Plugins fichiers** `@mosaix-plugin/*` | `plugins/commerce-*-plugin/src/index.ts` ex. `plugins/commerce-wishlist-plugin/src/index.ts:5` `WishlistPlugin` | Triviaux, non manifestés, non enregistrés via `PluginRegistry` — faux plugins |
| **UI-1** | **SlotRegistry** `register/getSlotContributions` | `packages/ui-runtime/src/index.ts:14` `SlotRegistry` | **Déclaré mais aucun usage** trouvé (grep 0 référence hors index) |
| **UI-2** | **ShellRegistry** `register/registerAdminPage/getAllAdminPages` | `packages/core/src/shell-registry.ts:32` | Fonctionnel — utilisé par BACs pour admin pages (`apps/booking/src/presentation/index.ts:50` `shellRegistry.registerAdminPage`) |
| **UI-3** | **CompositionResolver + ContextRegistry + CompositionOverrideManager** | `packages/core/src/composition-resolver.ts:16`, `packages/core/src/context-registry.ts:14`, `packages/core/src/composition-override-manager.ts:13` + `src/shell/composition-loader.ts:22` `CompositionManager` | Fonctionnel — `config/compositions/*.json` déclare `contexts/capabilities`, DAG sort, `isAppActiveInComposition:78` |
| **UI-4** | **ThemeRuntime** `ThemeResolver + ThemeTargetRegistry + ThemeInheritanceResolver` | `packages/core/src/theme/theme-resolver.ts:124`, `packages/core/src/theme/theme-target-registry.ts`, `packages/core/src/theme/theme-runtime.ts:189` + `src/shell/theme/theme-bridge.ts` | Fonctionnel mais **Shell-injecté** (pas via KernelModule) — `src/start.ts:28` `getResolvedTheme` |
| **UI-5** | **UI Runtime Plugins** `QrCodeGeneratorPlugin` / `FormHelpSidebarPlugin` | `packages/ui-runtime/src/plugins/qr-code-generator.plugin.ts:15`, `packages/ui-runtime/src/plugins/form-help-sidebar.plugin.ts:94` | Classes utilitaires, **jamais enregistrées** dans un registry — appel direct |
| **UI-6** | **ImperiaNav externalisé** *(nouveau rev.2)* | `src/shell/imperia-nav.ts:21` `IMPERIA_NAV_SECTIONS` (2 sections, 10 items) + `src/shell/renderer.ts:6` import | **Partiellement fonctionnel** — navigation Imperia externalisée mais hard-codée (pas de `ShellRegistry.registerAdminPage` dynamique) |
| **UI-7** | **SSR Pages modulaires** *(nouveau rev.2)* | `src/shell/pages/home-page.ts:32` `renderHomePage`, `src/shell/pages/bac-page.ts:36` `renderBacPage`, `src/shell/client/shell-client-scripts.ts:29` `getShellClientScripts` | Externalisé — `src/start.ts:83` ne fait plus que `renderBacPage`/`renderHomePage` |
| **RT-1** | **DynamicBacRegistry** `register/registerDynamicLoader/loadDynamicModule` | `src/shell/dynamic-bac-registry.ts:25` | Fonctionnel en Shell — permet `import()` dynamique mais **hard-codé** 10 imports statiques `src/shell/dynamic-bac-registry.ts:1-10` → `presentation/index` |
| **RT-2** | **FeatureFlagsPort** `isEnabled/getVariation/setFlag` + `featureAsync` | `packages/ports/feature-flags/src/index.ts`, `packages/adapters/featureflags-memory/src/index.ts`, `packages/sdk/src/index.ts:171` `featureAsync`, `src/shell/feature-flags.ts:132` `PersistentFeatureFlagsManager` | Fonctionnel — 13 flags canon (`src/shell/feature-flags.ts:25` `DEFAULT_PLATFORM_FLAGS`) + `platformFeatureFlags.isEnabled` avec `roles/tenants/percentage` |
| **RT-3** | **CommandBus** `register/execute` | `packages/commands/src/commands.ts:15` | Présent mais 1 seul usage (`apps/solara/src/infrastructure/solara-service-provider.ts:40` `CreatePost`) |
| **RT-4** | **Pipeline / MiddlewarePipeline** | `packages/pipeline/src/pipeline.ts:10`, `packages/core/src/http/middleware-pipeline.ts:9` | Déclaré, 0 usage dans les BACs — le nouveau `handleMaintenanceGate:13` **est** un middleware mais n'utilise pas `MiddlewarePipeline` (fonction autonome) |
| **RT-5** | **WorkflowEngine / Saga** compensation | `packages/orchestration/src/orchestration.ts` via `apps/portfolio/src/vendable-workflow.ts:13`, `apps/commerce/src/workflows/checkout-order.workflow.ts:53` | Fonctionnel, mais `DemoPaymentPort/DemoInventoryPort` stub |
| **RT-6** | **ApplicationDiscovery** `discoverWorkspaceApps` | `packages/core/src/app-discovery.ts`, `src/shell/discovery.ts:22` | Fonctionnel — scan `apps/*/mosaix.json` — mais `src/shell/dynamic-bac-registry.ts` le shadow toujours |
| **RT-7** | **Lifecycle Engines** `AppLifecycle` + `RuntimeComponentLifecycleEngine` (deprecated) | `packages/core/src/lifecycle.ts:55`, `packages/core/src/component-lifecycle.ts:31` | `AppLifecycle` utilisé par `AppRegistry` ; `RuntimeComponent*` déprécié |
| **RT-8** | **ApiDispatcher** *(nouveau rev.2)* | `src/server/api-dispatcher.ts:35` `dispatchApiRequest` — 8 branches `handle*Routes` + fallback RFC 7807 `sendProblemResponse` | **Nouveau point d'extension** : ajouter une famille de routes = créer `src/server/routes/*-routes.ts` + 1 `if(await handle*Routes)` dans `api-dispatcher.ts` |

### 2.2 Mécanismes absents

Pas de `HookRegistry` exécutable, pas d'`Interceptor`/`Decorator` runtime, pas de `Factory Registry` générique, pas de `Webhook` système, pas de `Job/Worker` queue (Outbox déclaré mais non câblé en prod). Le nouveau `ApiDispatcher` (`src/server/api-dispatcher.ts:35`) **pourrait** devenir l'`ExtensionPoint` pour les routes API si son `if` cascade était remplacé par un `Map<string, RouteHandler>`.

---

## 3. Cartographier l'architecture

### 3.1 Chemin canonique actuel (BAC = vraie extension)

```
Feature (ex. Booking)
  │
  ▼
  apps/booking/src/index.ts — MANIFEST { capabilities, permissions, events }
  │
  ▼
  PortfolioServiceProvider.register(container)  DI bind
  │   packages/container/src/container.ts:46  bind/singleton/instance
  │
  ▼
  Provider.boot(container, router)
  │   packages/core/src/providers/base-service-provider.ts:11
  │   ├─ MosaixApp.register(manifest,kernel)         packages/sdk/src/index.ts:39
  │   │       └─ kernel.register:311 → CapabilityRegistry.register + EventSchemaRegistry.register
  │   ├─ app.provideCapability(id, executor)         sdk:86 → kernel.registerCapabilityExecutor:418
  │   └─ router.get/post(path, handler)              packages/http/src/http.ts:64
  │           └─ kernel.mountRouter:543 → RouteRegistry.registerRoute
  │
  ▼
  KernelContext (6 services + container child)   packages/core/src/kernel-module.ts:62
  │
  ▼
  API/UI  Router.handle(req) / ShellRegistry / Event publish
```

**Fichiers par étape :**

| Étape | Fichiers |
|---|---|
| Déclaration | `apps/<app>/src/index.ts:63-84` `MANIFEST` + `ServiceProvider` |
| Bootstrap | `packages/sdk/src/index.ts:256` `createBoundedAppBootstrap` |
| Enregistrement | `packages/core/src/kernel.ts:311` `register` / `418` `registerCapabilityExecutor` / `543` `mountRouter` |
| Registries | `packages/core/src/capability-registry.ts` / `event-schema-registry.ts` / `permission.ts` / `route-registry.ts` |
| Contexte stable | `packages/core/src/kernel-module.ts:62` `KernelContext` |

### 3.2 Chemins alternatifs selon le type

| Type feature | Point d'injection | Fichiers | Exemple réel |
|---|---|---|---|
| **Adapter** | `PortfolioAdapters` param du Provider | `apps/portfolio/src/index.ts:55` `databasePort?` + `packages/support/src/in-memory-guard.ts:6` | `PostgresVendableRepository` vs `InMemory` fallback — **nouveau** guard à brancher |
| **KernelModule** | `kernel.install(module)` pré-`initialize` | `packages/core/src/kernel-module.ts:174`, `src/start.ts` n'en installe aucun custom | `PluginModule` (`packages/core/src/modules/plugin-module.ts:29`) devrait être ici |
| **Capability** | `CapabilityRegistry` | `packages/core/src/capability-registry.ts:52` `resolve` | `commerce.order.create` consommé par n'importe quel BAC via `kernel.executeCapability:464` |
| **Event** | `EventSchemaRegistry` + `DomainEventBus.publish` | `packages/core/src/event-bus.ts:171` | `commerce.order.created` publié via `sdk MosaixApp.publish:62` |
| **UI AdminPage** | `ShellRegistry.registerAdminPage` | `packages/core/src/shell-registry.ts:41` | `apps/booking/src/presentation/index.ts:50` `registerAdminPage` |
| **API Route (nouveau rev.2)** | `ApiDispatcher` + `src/server/routes/*` | `src/server/api-dispatcher.ts:35`, `src/server/routes/maintenance-routes.ts:11` | `handleMaintenanceRoutes` — ajouter `handleXxxRoutes` = nouvelle famille API sans toucher `start.ts` |
| **SSR Page (nouveau rev.2)** | `renderBacPage` / `renderHomePage` | `src/shell/pages/bac-page.ts:36`, `src/shell/pages/home-page.ts:32` | `src/start.ts:170` `renderBacPage(opts)` — ajouter une page = nouveau `src/shell/pages/*` |
| **Composition** | `config/compositions/*.json` + `ContextRegistry` | `packages/core/src/context-registry.ts:17`, `src/shell/composition-loader.ts:22` | `isAppActiveInComposition:78` filtre `apps` |
| **FeatureFlag** | `PersistentFeatureFlagsManager` + `featureAsync` | `packages/sdk/src/index.ts:171`, `src/shell/feature-flags.ts:200` | `solara.moderation.ai_filter` gate `apps/solara/src/infrastructure/solara-service-provider.ts:28` |
| **Plugin (théorique)** | `PluginRegistry.extensionsAt(target,point)` | `packages/core/src/plugin/plugin-registry.ts:117` | **Aucun usage réel** — trou d'architecture |

### 3.3 Nouveau pipeline Shell (rev.2)

```
HTTP Request
  │
  ├─ 1. Static Assets          src/start.ts:88  if(pathname.startsWith("/public/"))
  ├─ 2. Context (cookies)      src/start.ts:107 parseCookies → currentUser/currentSpace/currentThemeMode
  ├─ 3. Maintenance Gate       src/start.ts:115 handleMaintenanceGate() → src/server/middleware/maintenance-gate.ts:13
  ├─ 4. API Dispatcher         src/start.ts:120 dispatchApiRequest() → src/server/api-dispatcher.ts:35
  │        ├─ handleMaintenanceRoutes      src/server/routes/maintenance-routes.ts:11
  │        ├─ handleThemeRoutes            src/server/routes/theme-routes.ts:12
  │        ├─ handleUserAndSpaceRoutes     src/server/routes/user-routes.ts
  │        ├─ handleFeatureFlagRoutes      src/server/routes/feature-flag-routes.ts
  │        ├─ handleCompositionRoutes      src/server/routes/composition-routes.ts
  │        ├─ handleAuthRoutes             src/server/routes/auth-routes.ts
  │        ├─ handleFeedRoutes             src/server/routes/feed-routes.ts:13
  │        └─ handleComplianceAndSystemRoutes  src/server/routes/compliance-routes.ts:15
  ├─ 5. BAC Routing            src/start.ts:136 apps.find(app=>pathname===app.route)
  │        └─ renderBacPage()              src/shell/pages/bac-page.ts:36
  └─ 6. Home SSR               src/start.ts:188 renderHomePage()  src/shell/pages/home-page.ts:32
```

Chaque famille de routes est désormais **ajoutable en 2 fichiers** : `src/server/routes/<domaine>-routes.ts` + 1 branche dans `api-dispatcher.ts:55`.

---

## 4. Identifier les fonctionnalités déjà injectées

### 4.1 Inventaire des fonctionnalités modulaires

| Nom | Type | Point d'injection | Module | Fichiers | Isolation Core | Évolution rev.2 |
|---|---|---|---|---|---|---|
| **Portfolio PIM** | BAC | Capability `portfolio.vendable.*` | `@apps/portfolio` | `apps/portfolio/src/index.ts:19`, `apps/portfolio/src/domain/portfolio-service.ts:58`, `apps/portfolio/src/infrastructure/*` | Faible couplage — 0 modif Core si retrait | Inchangé — toujours faible |
| **Commerce Orders** | BAC | Capability `commerce.order.*` | `@apps/commerce` | `apps/commerce/src/index.ts:19`, `apps/commerce/src/domain/order.service.ts` | Idem | Inchangé |
| **Beam Messaging** | BAC | Capability `beam.message.send` | `@apps/beam` | `apps/beam/src/index.ts`, `apps/beam/src/domain/messaging.model.ts:27` | Faible | `frontend/src/index` → supprimé (presentation externalisée mais non impact Core) |
| **Solara Social** | BAC | Capability `solara.post.create` + Event `solara.post.published` | `@apps/solara` | `apps/solara/src/index.ts`, `apps/solara/src/infrastructure/solara-service-provider.ts:18` | Faible | Idem |
| **Booking** | BAC | Capability `booking.slot.*` | `@apps/booking` | `apps/booking/src/index.ts`, `apps/booking/src/presentation/index.ts:50` `registerAdminPage` | Faible | **Amélioré** : `registerAdminPage` déjà conforme (`presentation/index.ts:50`), plus de `frontend/` inline |
| **Subscription Billing** | BAC | Capability `subscription.*` | `@apps/subscription` | `apps/subscription/src/index.ts:11` `MANIFEST` + `events: {publishes/subscribes}` | Faible | **Amélioré** : `subscription` déclare désormais `events.publishes/subscribes` (`:30`) + `requires: [@apps/citadelle]` — mieux intégré |
| **Solidarity** | BAC | Capability `solidarity.*` | `@apps/solidarity` | `apps/solidarity/src/index.ts` | Faible | Inchangé |
| **Spaces** | BAC | Capability `spaces.space.create` | `@apps/spaces` | `apps/spaces/src/index.ts` | Faible | Inchangé |
| **ThemeResolver** | Core Extension | `ThemeTargetRegistry` + `ThemeResolver` | `@mosaix/core/theme` | `packages/core/src/theme/theme-resolver.ts`, `src/shell/theme/theme-bridge.ts` + `src/start.ts:28` `getResolvedTheme` | **Couplage Shell** | **Légèrement amélioré** : `theme-bridge.ts:28` centralise `getResolvedTheme`/`generateUnifiedThemeCssVariables`, mais toujours hors `KernelModule` |
| **Feature Flags** | Port/Adapter | `FeatureFlagsPort` → `MemoryFeatureFlagsAdapter` | `@mosaix/ports-feature-flags` | `src/shell/feature-flags.ts:132`, `packages/sdk/src/index.ts:171` | Faible | Inchangé |
| **Maintenance Mode** | BAC + Shell Gate | `MaintenanceService` singleton | `@apps/imperia` + Shell | `apps/imperia/src/domain/maintenance.service.ts:15`, `src/server/middleware/maintenance-gate.ts:7` + `src/server/routes/maintenance-routes.ts:7` | **Fort → Moyen** | **Amélioré** : gate et routes extraits de `start.ts` vers 2 fichiers dédiés — testables, mais `maintenanceService` toujours import direct (voir §5) |
| **Feed / SSE / GDPR / PSP** | Shell Routes | `FeedService` + `DistributedEventBackplane` + `AnonymizationOrchestrator` | Shell | `src/server/routes/feed-routes.ts:13`, `src/server/routes/compliance-routes.ts:15` | **Moyen** | **Nouveau** : `feed-routes.ts` et `compliance-routes.ts` isolent `feedStore`/`eventBackplane`/`anonymizationOrchestrator` — avant inline dans `start.ts` |
| **QR Code** | UI Plugin utilitaire | Classe directe (pas de registry) | `@mosaix/ui-runtime` | `packages/ui-runtime/src/plugins/qr-code-generator.plugin.ts:15` | Ultrafible mais **non branché** | **Inchangé** — toujours orphelin |
| **Form Help Sidebar** | UI Plugin utilitaire | Classe directe | `@mosaix/ui-runtime` | `packages/ui-runtime/src/plugins/form-help-sidebar.plugin.ts:94` | Idem — orphelin | **Inchangé** |
| **Commerce Plugins** (6) | Faux plugins | **Aucun** | `plugins/*` | `plugins/commerce-wishlist-plugin/src/index.ts:5` `WishlistPlugin` | **Très fort** | **Inchangé** — toujours non manifestés |
| **Imperia Nav** | Shell Data | `IMPERIA_NAV_SECTIONS` | Shell | `src/shell/imperia-nav.ts:21` | **Moyen** | **Nouveau** : externalisé du BAC `imperia/frontend`, mais pas via `ShellRegistry` |

### 4.2 Détail par fonctionnalité

#### Portfolio PIM — Faible couplage (inchangé)

- **APIs utilisées** : `MosaixApp.provideCapability("portfolio.vendable.create")`, `MosaixApp.registerEventSchema`
- **Services utilisés** : `Container` child, `Router`, `DatabasePort` (optionnel)
- **Recommandation rev.2** : brancher `InMemoryGuard.reportFallback("InMemoryVendableRepository")` dans `apps/portfolio/src/index.ts:73` avant `new InMemoryVendableRepository()` (actuellement garde `NODE_ENV=production` seule).

#### Booking — Faible couplage (amélioré)

- `apps/booking/src/presentation/index.ts:50` `shellRegistry.registerAdminPage` déjà conforme — le `frontend/src/index.ts` inline a été supprimé, remplacé par ce fichier `presentation` déclaratif.

#### Maintenance — Fort → Moyen

- **Avant** : 30 lignes inline `src/start.ts:214` (503 JSON + 503 HTML + `isUserBypassed` + `isAuthOrSwitchRoute`).
- **Après** : `src/server/middleware/maintenance-gate.ts:13` (78 l., testable) + `src/server/routes/maintenance-routes.ts:11` (64 l., API GET/POST).
- **Reste** : `maintenance-gate.ts:7` `import {maintenanceService} from "../../../apps/imperia/..."` — le Shell dépend toujours directement d'un domaine BAC. Idéal : `KernelContext.getService("maintenance")` ou injection via `Container`.

---

## 5. Vérifier l'isolation du Core

### 5.1 Test : « Si je devais supprimer cette fonctionnalité, quels fichiers Core devrais-je modifier ? » (rev.2)

| Violation | Fichiers Core/Shell modifiés | Type couplage | Évolution rev.2 |
|---|---|---|---|
| **Shell API Dispatcher** *(ex-monolithe)* | `src/start.ts:120` `dispatchApiRequest` + `src/server/api-dispatcher.ts:35` — 8 branches `if(await handle*Routes)` | **Moyen** *(était Très fort)* | **Amélioré** : 13 `if(pathname)` inline → 8 modules `src/server/routes/*` + fallback RFC 7807. Ajouter une famille API = 1 fichier + 1 branche dans `api-dispatcher.ts` (au lieu de 30 lignes dans `start.ts`). Reste un `if` cascade — idéal serait `Map<string, Handler>` (recommandation §11). |
| **Maintenance Gate** | `src/server/middleware/maintenance-gate.ts:7` `import {maintenanceService} from "../../../apps/imperia/..."`, `src/server/routes/maintenance-routes.ts:7` même import | **Moyen** *(était Fort)* | **Amélioré** : extrait de `start.ts` vers 2 fichiers dédiés, mais **violation Layer 7** subsiste (`eslint-plugin-boundaries:59` — Shell ne doit pas importer `apps/imperia/src/domain/*`). |
| **ThemeRuntime hors Kernel** | `src/shell/theme/theme-bridge.ts` + `src/start.ts:28` `getResolvedTheme` / `generateUnifiedThemeCssVariables` | **Moyen** | **Légèrement amélioré** : `theme-bridge.ts` centralise la résolution, mais toujours hors `KernelContext` — pas de `ThemeModule` (`packages/core/src/modules/index.ts:26` inchangé). |
| **DynamicBacRegistry hard-codé** 10 imports statiques | `src/shell/dynamic-bac-registry.ts:1-10` (`presentation/index` pour booking, `frontend` legacy pour autres via `generated-bac-registry.ts`) | **Moyen** — inchangé | **Non corrigé** : ajout/retrait BAC = éditer `dynamic-bac-registry.ts` + `src/shell/discovery.ts:6` `APP_ICONS`. Le scan `ApplicationDiscovery.discoverWorkspaceApps` (`src/shell/discovery.ts:22`) existe mais est shadowé. |
| **FeatureFlags catalog en dur** 13 flags dont `apps.*.enabled` | `src/shell/feature-flags.ts:25` `DEFAULT_PLATFORM_FLAGS` | **Moyen** | **Inchangé**. |
| **Auction / Delivery en Cœur Commerce** in-memory `Map`, pas de port | `apps/commerce/src/domain/auction.service.ts:71`, `apps/commerce/src/domain/delivery-partner.service.ts:73` | **Fort** | **Inchangé** — aucun guard `InMemoryGuard` branché ici non plus. |
| **Solara Content Moderator importé en dur** | `apps/solara/src/infrastructure/solara-service-provider.ts:8` `import {SolaraContentModeratorPlugin}` | **Moyen** | **Inchangé**. |
| **`APP_ICONS` / `renderPrimarySidebar` hard-codés** | `src/shell/discovery.ts:6` `APP_ICONS`, `src/shell/renderer.ts:26` `renderPrimarySidebar` | **Fort** *(était Fort)* | **Partiellement amélioré** : `src/shell/imperia-nav.ts:21` externalise Imperia, mais `APP_ICONS` et `renderPrimarySidebar` restent hard-codés (pas de `ShellRegistry.registerNavigationItem`). |
| **Aucun `KernelModule` pour Plugins/Themes/Composition** | `packages/core/src/modules/index.ts:26` `defaultModules()` = 3 modules | **Architecturel** | **Inchangé** — `PluginModule` toujours non default, recommandation P0 non appliquée. |
| **`InMemory*Repository` sans guard** | `apps/portfolio/src/index.ts:73` `new InMemoryVendableRepository()`, `apps/commerce/src/infrastructure/commerce-service-provider.ts:21` `new OrderRepository()`, `apps/citadelle/src/infrastructure/in-memory-user-repository.ts` | **Moyen** *(nouveau)* | **Nouveau** : `packages/support/src/in-memory-guard.ts:6` existe mais **non branché** dans les 3 fallbacks — risque `ProductionInvariantViolation` non détecté à l'exécution. |

### 5.2 Faux modulaires (prétendent être modulaires mais nécessitent des modifs Core)

| Cas | Fichiers centraux à modifier | Condition manuelle | Composant modifié |
|---|---|---|---|
| `plugins/commerce-*-plugin` (6 dossiers) | Aucun `mosaix.json`/`PluginManifest`, aucun `PluginRegistry.register` | — | Classes orphelines, pas des extensions |
| `QrCodeGeneratorPlugin` / `FormHelpSidebarPlugin` | Aucun `SlotRegistry.register` | `if` nowhere — orphelins | Jamais branchés |
| `AuctionService` / `DeliveryPartnerService` | `apps/commerce/src/index.ts:135` `export *` | Pas de capability séparée | `commerce` grossit |

### 5.3 Fichiers Core modifiés si désactivation (rev.2)

| Fonctionnalité | Fichiers Core à modifier | Delta rev.2 |
|---|---|---|
| Supprimer Portfolio | `apps/portfolio` dossier + `src/shell/dynamic-bac-registry.ts:71` + `src/shell/discovery.ts:6` | Inchangé |
| Supprimer Auction seul | `apps/commerce/src/domain/auction.service.ts` + `apps/commerce/src/index.ts:135` | Inchangé |
| Supprimer QR Code | Rien — déjà orphelin | Inchangé |
| Supprimer Maintenance | `src/server/middleware/maintenance-gate.ts:7` + `src/server/routes/maintenance-routes.ts:7` (2 fichiers au lieu de 30 lignes dans `start.ts`) | **Amélioré** : plus de `start.ts` à toucher, mais 2 fichiers Shell dédiés |
| Supprimer Feed/SSE/GDPR | `src/server/routes/feed-routes.ts:13` + `src/server/routes/compliance-routes.ts:15` (2 fichiers) | **Nouveau** : avant inline `start.ts`, maintenant isolé — test confirme découpe |

---

## 6. Détecter les switches dans le Core

### 6.1 Recherche `if feature ===` / `switch` — Résultats rev.2

Pas de `if(enableAuction)` massif. Le Shell est passé de **god-switch** (13 `if(pathname)` inline) à **dispatcher** (8 `if(await handle*Routes)`).

| Switch déguisé | Fichier:Ligne | Devrait être | Évolution rev.2 |
|---|---|---|---|
| `if (type==="group") { const enabled=await featureAsync("beam.messaging.group_chats") }` | `apps/beam/src/domain/messaging.model.ts:36` | Correct — FeatureFlag est le bon pattern, mais gate dans le domaine au lieu d'être un `PluginRegistry` hook `beam.message.beforeCreate` | Inchangé |
| `if(moderationEnabled){ container.singleton(SolaraContentModeratorPlugin) }` | `apps/solara/src/infrastructure/solara-service-provider.ts:29` | Devrait être `PluginRegistry.extensionsAt("solara","moderation")` | Inchangé |
| `if(!showcaseEnabled) return 400` | `apps/solara/src/infrastructure/solara-service-provider.ts:54` | Devrait être capability `solara.post.create` avec permission `solara:post:showcase` | Inchangé |
| `if(compensationEnabled && context.paymentAuthorized) void()` | `apps/commerce/src/workflows/checkout-order.workflow.ts:74,92` | Correct Saga compensation flag | Inchangé |
| `if(maintenanceService.isMaintenanceActive())` | `src/server/middleware/maintenance-gate.ts:21` *(était `src/start.ts:214`)* | Devrait être `MiddlewarePipeline` via `KernelContext.getService("maintenance")` — plus testable mais toujours import direct | **Déplacé** : était `start.ts:214`, maintenant `maintenance-gate.ts:21` — testable mais pas inversé |
| `if(pathname==="/api/...")` cascade 8x | `src/server/api-dispatcher.ts:44-133` *(était 13x dans `start.ts:176-670`)* | Devrait être `Map<string, RouteHandler>` ou `Router.mount` — `api-dispatcher.ts` est déjà un pas vers ça mais reste `if` cascade | **Amélioré** : 13→8 branches, chaque branche = 1 module `src/server/routes/*` |
| `APP_ICONS: Record<string,string>` + `apps.find(a=>pathname===a.route)` | `src/shell/discovery.ts:6`, `src/start.ts:136` `apps.find` | Devrait être `ShellRegistry` contribution `icon/route` déclarée par BAC | Inchangé |
| `switch(variant)` 2 occurrences (Imperia frontend) | *(supprimé — `apps/imperia/frontend/src/index.ts` n'existe plus)* | — | **Supprimé** avec le frontend inline |
| `switch(id)` `migration-governance.service.ts:63` | `apps/imperia/src/domain/migration-governance.service.ts:63` | Domain switch — acceptable mais extensible via Strategy si nouveaux DB drivers | Inchangé |
| `if(pathname.startsWith("/public/"))` | `src/start.ts:88` | Devrait être `serveStaticFile` via `@mosaix/http` `static-file-handler.ts` (existe mais non utilisé) | **Nouveau** : `start.ts:88` fait un `fs.createReadStream` manuel au lieu d'utiliser `packages/http/src/static-file-handler.ts` |

---

## 7. Évaluer l'extensibilité

| Domaine | Extension Point | Injection possible | Core modifiable ? | Niveau d'extensibilité | Delta rev.2 |
|---|---|---|---|---|---|
| **Produits (Vendables)** | `Capability portfolio.vendable.*` + `VendableRepository` Port | Oui — adapter `PostgresVendableRepository` vs `InMemory` | Non (si BAC) | **Élevé** — PIM hexagonal propre | **+ guard** `InMemoryGuard` à brancher |
| **Boutiques/Spaces** | `Capability spaces.space.*` + `enabledCapabilities` array | Oui | Non | **Moyen** | Inchangé |
| **Utilisateurs/Identité** | `Capability identity.user.*` + `IdentityStorePort` adapters | Oui | Non | **Élevé** | **+ guard** à brancher sur `in-memory-user-repository.ts` |
| **Commandes** | `Capability commerce.order.*` + `OrderRepository` | Oui | Non | **Élevé** | Inchangé |
| **Livraison** | `DeliveryPartnerService` **dans** `commerce` (pas de capability) | Non | Oui | **Faible** — couplé | Inchangé |
| **Paiement** | `PaymentPort`/`InventoryPort` **stubs** `DemoPaymentPort` dans `apps/commerce/src/workflows/checkout-order.workflow.ts:25` | Partiel | Oui | **Faible** | Inchangé |
| **Notifications** | Aucun — `Beam` = messaging, pas notifs | Non | Oui | **Nul** | Inchangé |
| **Réseaux sociaux (Solara)** | `Capability solara.post.*` + `Event solara.post.published` (`src/server/routes/feed-routes.ts:57`) | Partiel — post/feed oui, **social sharing** inexistant | Oui | **Moyen** | **Légèrement mieux** : `feed-routes.ts:57` `eventBackplane.publish("solara.post.published")` externalisé — partage auto peut s'y brancher |
| **Enchères** | `AuctionService` **dans** `commerce` (pas de `auction.*` capability) | Non | Oui | **Très faible** | Inchangé |
| **Rapports** | `shop-inventory-report.service.ts`, `shop-analytics.service.ts` **dans** `portfolio` | Partiel | Oui | **Faible** | Inchangé |
| **Analytics** | `shop-analytics.service.ts` dans `portfolio` | Non | Oui | **Faible** | Inchangé |
| **Administration (Imperia)** | `Capability imperia.governance.*` + `ShellRegistry.registerAdminPage` | Oui — `packages/core/src/shell-registry.ts:72` tri `order` | Non (page) mais Shell gate en dur pour `/api/imperia/*` → `src/server/routes/maintenance-routes.ts:7` | **Moyen → Moyen+** | **Amélioré** : routes `maintenance` extraites, `imperia-nav.ts:21` externalisé |
| **Navigation** | `PLUGIN_EXTENSION_POINTS` `navigation` déclaré mais **jamais implémenté** | Non — `src/start.ts:136` `apps.find` + `src/shell/renderer.ts:26` `renderPrimarySidebar` | Oui | **Nul → Faible** | **Légèrement mieux** : `imperia-nav.ts` est un premier pas, mais `APP_ICONS` et `renderPrimarySidebar` restent hard-codés |
| **Permissions** | `PermissionRegistry` + `PolicyEngine` `domain:resource:action:scope` wildcard `*` | Oui | Non | **Élevé** — le plus extensible | Inchangé |
| **Formulaires** | `FormHelpSidebarPlugin` orphelin | Non | Oui | **Nul** | Inchangé |
| **Recherche** | `SearchPort` (`@mosaix/ports-search`) + adapters `search-memory`/`search-elasticsearch` | Oui | Non | **Élevé** — hexagonal pur | Inchangé |
| **Catégories** | `classification.categories` array dans `Vendable` | Partiel | Oui | **Faible** | Inchangé |
| **Thème** *(nouveau)* | `ThemeTargetRegistry` + `ThemeResolver` via `src/shell/theme/theme-bridge.ts` | Partiel — `getResolvedTheme`/`generateUnifiedThemeCssVariables` centralisés | Oui — pas de `ThemeModule` | **Moyen** | **Légèrement mieux** : centralisé mais toujours hors Kernel |
| **Feed / SSE / GDPR** *(nouveau)* | `FeedService` + `DistributedEventBackplane` + `AnonymizationOrchestrator` via `src/server/routes/*` | Oui — 2 fichiers `feed-routes.ts` + `compliance-routes.ts` | Non — isolé | **Moyen** | **Nouveau** : avant inline `start.ts`, maintenant modulaire |

---

## 8. Identifier les fonctionnalités qui devraient être injectées

| Fonctionnalité | Architecture actuelle | Problème de couplage | Extension Point recommandé | Type d'injection recommandé | Architecture proposée | Impact sur le Core | Bénéfice attendu |
|---|---|---|---|---|---|---|---|
| **Enchères** `apps/commerce/src/domain/auction.service.ts:71` | Domaine **dans** `commerce` + comment `FEAT-04 [CŒUR]` ; `Map` in-mem, anti-sniping, audit hash | Commerce grossit ; `reserveMet`/`extensionsCount` polluent `commerce` | `Capability auction.bid.place` + `Event auction.bid_placed` + `AuctionRepositoryPort` | **BAC `@apps/auction`** ou **Plugin `target: commerce, point: commerce.order.validateInventory`** | `apps/auction/src/index.ts` `MANIFEST {capabilities: [auction.bid.place], events: [auction.bid_placed]}` | Retirer 1 export + 2 fichiers, ajouter `mosaix.json` + Provider | Isolation, testabilité, désactivable via `CompositionManager` |
| **Livraison** `apps/commerce/src/domain/delivery-partner.service.ts:73` | Dans `commerce` aussi | Pas de bounded context livreur | `Capability delivery.partner.register` + `delivery.shipment.assign` | **BAC `@apps/delivery`** | `apps/delivery/src/index.ts` | Déplacer 1 fichier + manifest | Séparation métier |
| **Rapports/Analytics** `apps/portfolio/src/domain/shop-analytics.service.ts` | Services utilitaires dans PIM | Analytics pollue PIM | `Capability analytics.report.generate` + `Event portfolio.vendable.published` consumer | **Plugin `target: portfolio, point: analytics`** ou **BAC `@apps/analytics`** | `apps/analytics/src/index.ts` `EventBus.subscribe("portfolio.vendable.published")` | Extraire 2 fichiers | Découplage, rapports périodiques via `OutboxWorker` |
| **Maintenance Gate** `src/server/middleware/maintenance-gate.ts:7` *(était `src/start.ts:214`)* | Extraite mais **import direct** `apps/imperia/src/domain/maintenance.service` | Shell dépend toujours d'un BAC (circular) — `InMemoryGuard` non concerné mais même pattern | `KernelContext.getService("maintenance")` via `MaintenanceModule implements KernelModule` | `MaintenanceModule` + `MaintenanceService` dans `Container` (pas singleton importé) | `kernel.install(new MaintenanceModule())` + `container.instance("maintenanceService", service)` — supprimer `import from "../../../apps/imperia/..."` | Supprimer `import` direct, `handleMaintenanceGate` reçoit `service` en param | **P0 restant** : inversion de dépendance |
| **QR Code** `packages/ui-runtime/src/plugins/qr-code-generator.plugin.ts:15` | Classe utilitaire jamais enregistrée | Transversal mais inaccessible | `SlotContribution {slot:"vendable.share", order:10}` + `Capability qr.generate` | **UI Plugin** `SlotRegistry.register({slot:"portfolio.vendable.card"})` | `SlotRegistry.register({slot:"portfolio.vendable.card", applicationId:"qr-plugin"})` | Enregistrer via `PluginRegistry` | Partage auto sans toucher `portfolio` |
| **Social Sharing** (inexistant) | — | — | `Event portfolio.vendable.published` + `src/server/routes/feed-routes.ts:57` `eventBackplane.publish` | **Plugin `target: portfolio, point: solara.post.afterCreate`** | Plugin publiant sur `beam` | 0 modif Core si events utilisés | Auto-share PIM → Solara → Beam |
| **Thème** `src/shell/theme/theme-bridge.ts` + `src/start.ts:28` | Instancié en Shell, pas via `KernelContext` | `ThemeTargetRegistry` devrait être `KernelModule` | `ThemeModule implements KernelModule` | `kernel.install(new ThemeModule(registry,store))` | Déplacer `theme-bridge.ts` vers `packages/core/src/modules/theme-module.ts` | Déplacer 10 lignes de `src/start.ts` vers module | `ctx.getService("theme")` |
| **Navigation / Menu** `src/shell/discovery.ts:6` + `src/shell/imperia-nav.ts:21` | `imperia-nav.ts` externalisé mais `APP_ICONS` hard-codé | Nouveau BAC = éditer 2 fichiers Shell | `ShellRegistry.registerNavigationItem` | `ShellRegistry.registerNavigation({bacId,label,icon,route,permission})` | Étendre `packages/core/src/shell-registry.ts:32` de 5 lignes + faire `discovery.ts:22` lire le registry | Supprimer `APP_ICONS` | Navigation déclarative |

> Aucune modification de code n'a été réalisée à cette étape — recommandations uniquement. Les 3 premières lignes non appliquées restent P0.

---

## 9. Vérifier la possibilité d'ajouter une fonctionnalité sans toucher au Core

### 9.1 Matrice « suppression / ajout » (rev.2)

| Question | Réponse | Fichiers Core à modifier | Pourquoi exception | Delta rev.2 |
|---|---|---|---|---|
| **Supprimer Portfolio** ? | `apps/portfolio` dossier + `src/shell/dynamic-bac-registry.ts:71` 2 lignes + `src/shell/discovery.ts:6` 1 ligne `APP_ICONS` | **2 fichiers Shell** | `DynamicBacRegistry` hard-code | Inchangé |
| **Supprimer Commerce (avec auction+delivery)** ? | Dossier `apps/commerce` | 0 Core si on ignore Shell — mais auction/delivery partent avec → perte métier | Couplage interne `commerce` | Inchangé |
| **Supprimer Auction seul** ? | `apps/commerce/src/domain/auction.service.ts:71` + `apps/commerce/src/index.ts:135` export | **1 fichier Core-like** | Pas de BAC séparé | Inchangé |
| **Supprimer Delivery seul** ? | Idem `apps/commerce/src/domain/delivery-partner.service.ts:73` | Idem | Idem | Inchangé |
| **Supprimer Solara Moderator** ? | `apps/solara/src/infrastructure/solara-service-provider.ts:8,29` | **1 fichier BAC** | Devrait être `PluginRegistry` | Inchangé |
| **Supprimer QR Code** ? | Rien — déjà orphelin | 0 | Orphelin = déjà "supprimé" | Inchangé |
| **Supprimer Maintenance** ? | `src/server/middleware/maintenance-gate.ts:7` + `src/server/routes/maintenance-routes.ts:7` (2 fichiers, plus `src/start.ts` à 0 ligne) | **2 fichiers Shell** *(était 1 fichier `start.ts` 30 l.)* | Shell modulaire mais import direct | **Amélioré** : `start.ts` non touché, découpe facilitant test |
| **Supprimer Feed/SSE/GDPR** ? | `src/server/routes/feed-routes.ts:13` + `src/server/routes/compliance-routes.ts:15` | **2 fichiers Shell** *(était inline `start.ts`)* | Avant inline, maintenant isolé | **Nouveau** — découpe |
| **Ajouter nouveau BAC `analytics`** ? | Créer `apps/analytics/src/index.ts` + `apps/analytics/mosaix.json` + ajouter 1 ligne `src/shell/dynamic-bac-registry.ts:1` import + 1 ligne `register` | **1-2 fichiers Shell** | Discovery pas auto | Inchangé — mais `src/shell/discovery.ts:22` `ApplicationDiscovery.discoverWorkspaceApps` existe |
| **Ajouter nouvelle famille API `reports`** ? | Créer `src/server/routes/reports-routes.ts` `handleReportsRoutes` + ajouter 1 branche `if(await handleReportsRoutes(...))` dans `src/server/api-dispatcher.ts:35` | **1 fichier Shell** *(était `src/start.ts`)* | `api-dispatcher.ts` centralise | **Nouveau** : avant `start.ts:175-670`, maintenant `api-dispatcher.ts` — extensible par fichier |
| **Ajouter nouveau Plugin Wishlist propre** ? | Créer `plugins/my-plugin/mosaix.json` `PluginManifest` + `kernel.install(new PluginModule(registry))` + `registry.register(manifest)` | **0 Core si** `PluginModule` installé — sinon 1 ligne `src/start.ts` `kernel.install` | `PluginModule` pas dans `defaultModules()` | Inchangé |
| **Ajouter Capability `delivery.shipment.track`** ? | `apps/delivery/mosaix.json` `capabilities: [{id:"delivery.shipment.track"}]` + `app.provideCapability` | 0 Core | Voie canonique | Inchangé |
| **Ajouter Event `portfolio.vendable.archived`** ? | `apps/portfolio/mosaix.json` `events: [...]` + `app.registerEventSchema(...)` + `app.publish(...)` | 0 Core | Canonique | Inchangé |

### 9.2 Architecture réellement extensible ? (rev.2)

- **Oui pour BACs/Capabilities/Events/Permissions/Adapters** (0 modif Core) — inchangé.
- **Oui pour familles API** *(nouveau)* : `src/server/api-dispatcher.ts:35` + `src/server/routes/*` — ajouter une famille = 1 fichier `*-routes.ts` + 1 branche `if` dans `api-dispatcher.ts` (au lieu de 30 lignes dans `start.ts`).
- **Oui pour SSR pages** *(nouveau)* : `src/shell/pages/*` — ajouter une page = 1 fichier `src/shell/pages/*-page.ts`.
- **Non pour BAC registry / navigation / plugins** (1-2 fichiers Shell à chaque fois) — goulot subsistant.

---

## 10. Analyse du couplage

| Niveau | Critère | Extensions | Raison | Delta rev.2 |
|---|---|---|---|---|
| **Faible** | Indépendante, `container.createChild` + `Router` isolé, manifest déclaratif, désactivable via `CompositionManager.isAppActiveInComposition:78` | `portfolio`, `commerce` (orders), `beam`, `booking`, `subscription`, `solidarity`, `spaces`, `citadelle` (8 BACs canon) + **nouveau** `Booking` `presentation` | `packages/sdk/src/index.ts:256` `createBoundedAppBootstrap` isole tout ; `src/shell/feature-flags.ts:25` `apps.*.enabled` permet toggle | **Amélioré** : `subscription` déclare `events.publishes/subscribes` (`:30`), `booking` `presentation` séparé |
| **Moyen** | Dépend de 1-2 interfaces Core, 1 `if(featureAsync)` + 1 `import` statique | `solara` + `SolaraContentModeratorPlugin`, `beam group_chats`, `portfolio` search + **nouveau** `Maintenance` (extraite mais import direct) | 1 port + 1 flag, pas de modif Core packages, mais retrait = éditer Provider ou `maintenance-gate.ts:7` | **Mouvement** : `maintenance` passe de Fort → Moyen (extraite) |
| **Fort** | Nécessite `start.ts` ou `dynamic-bac-registry.ts` ou `feature-flags.ts` catalog ou `InMemory*` sans guard | `ThemeRuntime` (`src/shell/theme/theme-bridge.ts`), `DynamicBacRegistry` 10 imports, `APP_ICONS` map, `FeatureFlags` 13 flags + **nouveau** `InMemory*Repository` sans `InMemoryGuard` | Shell hard-code ; retrait = 10-30 lignes Shell ; prod guard manquant | **Nouveau** : 3 fallbacks `InMemory*` sans guard (`portfolio:73`, `commerce:21`, `citadelle`) |
| **Très fort** | Intégrée au Cœur, in-memory `Map`, pas de port/capability/event | `AuctionService` `apps/commerce/src/domain/auction.service.ts:71`, `DeliveryPartnerService` `apps/commerce/src/domain/delivery-partner.service.ts:73`, `plugins/commerce-*` (6 orphelins), `QrCodeGeneratorPlugin`/`FormHelpSidebarPlugin` orphelins | Pas de `AuctionRepositoryPort`, pas de `PluginManifest` | **Inchangé** |

---

## 11. Proposition d'une architecture d'extension

### 11.1 Principe

**Évolution, pas réécriture** : réutiliser `PluginRegistry` + `KernelModule` + `SlotRegistry` déjà existants mais non câblés ; **déplacer** le `import` direct restant vers injection.

### 11.2 Architecture cible (rev.2 — mise à jour)

```
Core (packages/core) — inchangé, juste activer modules existants
│
├── Contracts  (@mosaix/contracts) — déjà OK
│   ├── ApplicationManifest (BAC)              — existant
│   ├── PluginManifest + PluginExtensionContract {target, point, hooks} — existant  packages/contracts/src/plugin/plugin-extension.ts:55
│   ├── CapabilityContract {inputValidator,outputValidator} — existant  packages/core/src/capability-registry.ts:77
│   └── EventSchema + STANDARD_BAC_HOOK_POINTS — existant  packages/contracts/src/plugin/plugin-extension.ts:22 (17 hooks canon)
│
├── Guards — nouveau rev.2
│   └── InMemoryGuard — existant mais À BRANCHER  packages/support/src/in-memory-guard.ts:6
│         reportFallback(componentName, reason) dans chaque InMemory*Repository fallback
│
├── Registries (open, D-17: unknown → undefined, jamais erreur)
│   ├── CapabilityRegistry  — existant                  packages/core/src/capability-registry.ts:39
│   ├── EventSchemaRegistry — existant                  packages/core/src/event-schema-registry.ts:29
│   ├── PermissionRegistry  + PolicyEngine — existant   packages/core/src/permission.ts:18 / policy-engine.ts:20
│   ├── PluginRegistry      — existant mais ACTIVER     packages/core/src/plugin/plugin-registry.ts:45
│   ├── SlotRegistry        — existant mais CÂBLER      packages/ui-runtime/src/index.ts:14
│   ├── ShellRegistry       — existant, ÉTENDRE          packages/core/src/shell-registry.ts:32
│   │      + registerNavigationItem({bacId,label,icon,route,permission})  (5 lignes) — remplace APP_ICONS
│   ├── ThemeTargetRegistry + ThemeResolver — à PROMOUVOIR en ThemeModule  packages/core/src/theme/
│   └── ContextRegistry + CompositionResolver — existant  packages/core/src/context-registry.ts:14
│
├── Kernel (RuntimeKernel) — ajouter 3 modules à defaultModules()  packages/core/src/modules/index.ts:26
│   ├── ObservabilityModule  — déjà auto-installé  packages/core/src/kernel.ts:79 (T-EXT-02)
│   ├── CapabilitiesModule / EventsModule / PermissionsModule — déjà default
│   ├── PluginModule         — EXISTE mais non default  packages/core/src/modules/plugin-module.ts:20  →  AJOUTER au default (P0)
│   ├── ThemeModule          — À CRÉER (wrap ThemeRuntime) — déplace src/shell/theme/theme-bridge.ts
│   └── MaintenanceModule    — À CRÉER (wrap MaintenanceService + InMemoryGuard) — déplace src/server/middleware/maintenance-gate.ts:7
│         le Shell ne doit plus faire `import {maintenanceService} from "../../../apps/imperia/..."` ;
│         le module expose `KernelContext.getService("maintenance")` et `handleMaintenanceGate` reçoit le service en param
│
├── Shell — déjà découpé en rev.2, reste à inverser 2 dépendances
│   ├── src/start.ts:83  — 233 l. pipeline 6 étapes (était 1600 l.) — OK
│   ├── src/server/api-dispatcher.ts:35 — 8 branches if(await handle*Routes) — OK, prochain pas: Map<string,Handler>
│   ├── src/server/routes/* — 6 fichiers (maintenance, theme, feed, compliance, composition, feature-flags) — OK
│   ├── src/server/middleware/maintenance-gate.ts:13 — À INVERSER: recevoir MaintenanceService par DI, pas par import
│   ├── src/shell/pages/* — home-page.ts + bac-page.ts — OK
│   ├── src/shell/client/shell-client-scripts.ts:29 — OK
│   ├── src/shell/imperia-nav.ts:21 — OK mais à terme: ShellRegistry.registerAdminPage pour Imperia aussi
│   ├── src/shell/discovery.ts:6 — À CORRIGER: APP_ICONS → ShellRegistry.registerNavigationItem (P2)
│   └── src/shell/dynamic-bac-registry.ts:25 — À CORRIGER: 10 imports statiques → ApplicationDiscovery.discoverWorkspaceApps + registerDynamicLoader (P2)
│
└── Extensions — tout hors Core
    ├── BACs (isolation Container.createChild + Router isolé)   apps/*
    │   ├── @apps/portfolio, commerce, beam, solara, spaces, citadelle, solidarity, booking, subscription — déjà OK
    │   ├── @apps/auction        — À EXTRAIRE de commerce  (apps/commerce/src/domain/auction.service.ts:71 → apps/auction/src/domain/)
    │   ├── @apps/delivery       — À EXTRAIRE de commerce  (apps/commerce/src/domain/delivery-partner.service.ts:73 → apps/delivery/)
    │   └── @apps/analytics      — À CRÉER  (apps/portfolio/src/domain/shop-analytics.service.ts → apps/analytics, subscribe portfolio.* events)
    ├── Adapters (hexagonal)   packages/adapters/* — déjà OK
    │   └── PostgresVendableRepository / InMemory fallback — pattern à reproduire pour Auction/Delivery + InMemoryGuard
    ├── UI Plugins (SlotRegistry)   packages/ui-runtime/src/plugins/*
    │   ├── QrCodeGeneratorPlugin  — CÂBLER: SlotRegistry.register({slot:"portfolio.vendable.share"})
    │   └── FormHelpSidebarPlugin  — CÂBLER: SlotRegistry.register({slot:"form.wizard.help"})
    ├── Plugins (PluginRegistry)   plugins/*
    │   ├── commerce-wishlist/comparator/recently-viewed/reviews/badge — MANIFESTER: ajouter mosaix.json {type:"plugin", extension:{target:"commerce", point:"commerce.order.validateInventory"}}
    │   └── solara-content-moderator — MANIFESTER: {target:"solara", point:"solara.post.beforeCreate"}
    └── Compositions (config-driven)   config/compositions/*.json — déjà OK
        └── + isAppActiveInComposition gate — déjà OK  src/shell/composition-loader.ts:78
```

### 11.3 Ce qui ne change pas (rev.2)

- `Container`, `MosaixApp`, `CapabilityRegistry`, `EventBus`, `PermissionRegistry` — déjà extensibles.
- `ApplicationDiscovery` déjà capable de scanner `apps/*/mosaix.json`.
- **Nouveau** : `ApiDispatcher` (`src/server/api-dispatcher.ts:35`) est déjà l'`ExtensionPoint` pour les routes API — il suffit d'y ajouter un `Map` pour le rendre 100% ouvert.

### 11.4 Ce qui s'active (rev.2)

- `PluginRegistry` + `SlotRegistry` (1 ligne `kernel.install` chacun) — **toujours non fait**.
- `InMemoryGuard` (`packages/support/src/in-memory-guard.ts:6`) — **à brancher** dans les 3 fallbacks (1 ligne `InMemoryGuard.reportFallback("InMemoryVendableRepository")` chacun).

### 11.5 Ce qui se déplace (rev.2)

- `src/server/middleware/maintenance-gate.ts:7` `import {maintenanceService}` → `MaintenanceModule` + `container.resolve("maintenanceService")` (inversion).
- 10 imports `src/shell/dynamic-bac-registry.ts:1-10` → `ApplicationDiscovery.discoverWorkspaceApps`.
- `src/shell/discovery.ts:6` `APP_ICONS` → `ShellRegistry.registerNavigationItem`.

---

## 12. Test d'extensibilité

Simulation conceptuelle de l'ajout de 8 fonctionnalités (rev.2) :

| Fonctionnalité | Module créé | Contrat / Interface | Point d'injection | Core consommé | Core à modifier | Désinstallable |
|---|---|---|---|---|---|---|
| **Partage auto réseaux sociaux** | `Plugin @mosaix-plugin/social-sharing` `mosaix.json {target:"portfolio", point:"solara.post.afterCreate"}` | `Event portfolio.vendable.published` payload `safeParse` | `PluginRegistry.extensionsAt("portfolio","solara.post.afterCreate")` + `DomainEventBus.subscribe("portfolio.vendable.published")` | `EventBus` + `Capability solara.post.create` | **0** si events utilisés ; 1 ligne `PluginModule` install si pas déjà | Oui (`registry.deactivate("portfolio:social-sharing")`) |
| **Système d'enchères** | `BAC @apps/auction` `MANIFEST {capabilities: [auction.bid.place, auction.auction.create], events: [auction.bid_placed, auction.closed_with_winner]}` | `AuctionRepositoryPort` (à créer, comme `VendableRepository`) + `CapabilityContract inputValidator` + `InMemoryGuard` | `CapabilityRegistry` (`app.provideCapability("auction.bid.place")`) + `CommandBus` | `Container` child + `Router` + `EventStore` | **0** packages Core ; 2 lignes Shell `dynamic-bac-registry.ts` + `APP_ICONS` (dette Shell) | Oui (`CompositionManager.setActiveComposition` sans `auction`) |
| **Rapports périodiques** | `BAC @apps/analytics` ou `Plugin target:portfolio point:analytics` | `Event portfolio.vendable.published` consumer + `SearchPort` + `OutboxWorker` | `DomainEventBus.subscribe` + `WorkflowEngine` cron (`OutboxDaemon`) | `EventBus` + `DatabasePort` | 0 | Oui |
| **QR Code** | `Plugin UI @mosaix-plugin/qr-share` | `QrCodeGeneratorPlugin.generateSvg(url)` déjà existant `packages/ui-runtime/src/plugins/qr-code-generator.plugin.ts:19` | `SlotRegistry.register({slot:"portfolio.vendable.card", applicationId:"qr-share", order:20})` | `SlotRegistry` (à câbler) + `escapeHtml` | **1 ligne** `SlotRegistry.register` (actuellement orphelin) | Oui (`slotRegistry.clear()` ou `remove`) |
| **Compte société de livraison** | `BAC @apps/delivery` `MANIFEST {capabilities: [delivery.partner.register, delivery.shipment.assign]}` | `DeliveryPartnerRepositoryPort` (extraire `Map` → port) + `InMemoryGuard` | `CapabilityRegistry` | `Container` + `Event commerce.order.created` (pour `assignShipment`) | **0** Core ; extraire `apps/commerce/src/domain/delivery-partner.service.ts:73` de `commerce` | Oui |
| **Mode maintenance** | `KernelModule MaintenanceModule` (à créer) | `MiddlewareFn (ctx,next)` | `MiddlewarePipeline.use(maintenanceMiddleware)` + `KernelContext.getService("maintenance")` | `MiddlewarePipeline` `packages/core/src/http/middleware-pipeline.ts:9` + `PolicyEngine` pour `isUserBypassed` | **Déjà extrait** : `src/server/middleware/maintenance-gate.ts:13` + `src/server/routes/maintenance-routes.ts:11` — **reste** à inverser l'import direct (`:7`) | Oui (stop module) |
| **Analytics produits** | `BAC @apps/analytics` `capability analytics.product.view` + `analytics.report.generate` | `Event portfolio.vendable.search` + `Metrics` (`packages/core/src/observability.ts: InMemoryMetrics`) | `EventBus.subscribe` + `CapabilityRegistry` | `Metrics.increment` + `EventStore.query(tenant)` | 0 | Oui |
| **Nouvelles catégories** | Pas de module — extension de **taxonomie** `Vendable.classification.categories` | `Vendable` `classification.categories: string[]` + `PortfolioService.calculateCompleteness:415` | `PortfolioService` `search(criteria.category)` | `VendableRepository` | **0** si catégorie = string libre (déjà) ; **1 fichier** `apps/portfolio/src/domain/portfolio-service.ts:415` si scoring/completeness doit évoluer | Oui (donnée) |

---

## 13. Rapport final

### 13.1 Architecture actuelle (rev.2)

Le système est passé de **hybride monolithique** à **hybride modulaire** :

- **Voie canonique extensible** *(inchangée, toujours saine)* : `apps/<bac>/src/index.ts` `MANIFEST` → `PortfolioServiceProvider.register/boot` → `MosaixApp.register/provideCapability` → `RuntimeKernel` (`packages/core/src/kernel.ts:311` + `418` + `543` + `464`) → `CapabilityRegistry`/`EventSchemaRegistry`/`RouteRegistry`/`PermissionRegistry`. Cette voie est **vraiment** sans modification Core — 8 BACs la suivent.
- **Voie Shell** *(améliorée)* : `src/start.ts:83` **233 lignes** pipeline 6 étapes (`static → context → maintenance → api → bac → home`) → `src/server/api-dispatcher.ts:35` **8 modules** `src/server/routes/*` + fallback RFC 7807 → `src/shell/pages/*` SSR. La découpe est **réelle** : ajouter une famille API = 1 fichier `*-routes.ts` + 1 branche dans `api-dispatcher.ts` (au lieu de 30 lignes dans `start.ts`). Reste 2 dépendances à inverser (voir §13.4).
- **Voie Plugins morte** *(inchangée)* : `PluginRegistry` (`packages/core/src/plugin/plugin-registry.ts:45` open `extensionsAt→undefined`) + `PluginModule` (`packages/core/src/modules/plugin-module.ts:20`) + `STANDARD_BAC_HOOK_POINTS` (`packages/contracts/src/plugin/plugin-extension.ts:22` 17 hooks canon) existent mais **aucun plugin ne les utilise** ; les 6 `plugins/commerce-*` sont des classes orphelines sans `PluginManifest`.
- **Nouveau garde-fou** : `InMemoryGuard` (`packages/support/src/in-memory-guard.ts:6`) + `.project/architecture/in-memory-policy.md:15` — concrétise la règle Persistent-First, mais **non branché** dans les 3 fallbacks `InMemory*Repository`.

### 13.2 Extension points existants (fonctionnels — rev.2)

| Point | Fichier | Ouvert ? | Usage réel | Delta rev.2 |
|---|---|---|---|---|
| `Container.bind/singleton/scoped/instance/createChild` | `packages/container/src/container.ts:24` | Oui | 10 BACs | Inchangé |
| `ServiceProvider.register/boot(router)` | `packages/core/src/providers/base-service-provider.ts:6` | Oui | 10 BACs | Inchangé |
| `KernelModule.register/boot/start/stop` + `KernelContext.setService/getService` | `packages/core/src/kernel-module.ts:174` | Oui | 3 modules default | Inchangé — `PluginModule` toujours non default |
| `CapabilityRegistry.register/resolve/bindContract/execute` + `kernel.executeCapability:464` | `packages/core/src/capability-registry.ts:39` | Oui | `portfolio.vendable.*` etc. | Inchangé |
| `EventSchemaRegistry.register` + `DomainEventBus.publish/subscribe` | `packages/core/src/event-schema-registry.ts:29`, `packages/core/src/event-bus.ts:111` | Oui | `commerce.order.created` | Inchangé |
| `PermissionRegistry.grant/deny/check` wildcard `*` | `packages/core/src/permission.ts:18` | Oui | `*:vendable:publish:tenant` | Inchangé |
| `Router.get/post/put/delete` + `RouteRegistry.registerRoute` + `kernel.mountRouter:543` | `packages/http/src/http.ts:64`, `packages/core/src/route-registry.ts:8` | Oui | `mountPortfolioRoutes` | Inchangé |
| **ApiDispatcher** `dispatchApiRequest` + `src/server/routes/*` | `src/server/api-dispatcher.ts:35` | **Oui** *(nouveau)* | 8 familles API (maintenance, theme, feed, compliance, etc.) | **Nouveau** — 1 fichier + 1 branche par famille |
| `PluginRegistry.register/activate/extensionsAt` `extensionPointKey` | `packages/core/src/plugin/plugin-registry.ts:45` | **Oui mais non câblé** | 0 usage | Inchangé |
| `SlotRegistry.register/getSlotContributions` | `packages/ui-runtime/src/index.ts:14` | **Non câblé** | 0 usage | Inchangé |
| `ShellRegistry.register/registerAdminPage` | `packages/core/src/shell-registry.ts:32` | Oui | Admin pages (`apps/booking/src/presentation/index.ts:50`) | Inchangé — `booking` confirme conformité |
| `ThemeTargetRegistry.register/get` + `ThemeResolver.resolve` | `packages/core/src/theme/theme-target-registry.ts`, `packages/core/src/theme/theme-resolver.ts:124` | Oui mais hors Kernel | `src/shell/theme/theme-bridge.ts` | **Légèrement mieux** : centralisé |
| `ContextRegistry.register` + `ApplicationCompositionResolver.resolve` DAG | `packages/core/src/context-registry.ts:14`, `packages/core/src/composition-resolver.ts:16` | Oui | `config/compositions/*.json` | Inchangé |
| `CompositionOverrideManager.setBlockOverride/applyOverrides` | `packages/core/src/composition-override-manager.ts:13` | Oui | Live editor | Inchangé |
| `DynamicBacRegistry.register/registerDynamicLoader` | `src/shell/dynamic-bac-registry.ts:25` | Oui mais hard-codé | Shell | Inchangé |
| `FeatureFlagsPort.isEnabled/getVariation/setFlag` + `featureAsync` | `packages/ports/feature-flags/src/index.ts`, `packages/sdk/src/index.ts:171`, `src/shell/feature-flags.ts:200` | Oui | 13 flags + 5 gates `featureAsync` | Inchangé |
| `CommandBus.register/execute` | `packages/commands/src/commands.ts:15` | Oui mais 1 usage | `CreatePost` | Inchangé |
| `Pipeline.pipe/process` + `MiddlewarePipeline.use/execute` | `packages/pipeline/src/pipeline.ts:10`, `packages/core/src/http/middleware-pipeline.ts:9` | **Non câblé** | 0 usage — `handleMaintenanceGate` n'utilise pas `MiddlewarePipeline` | Inchangé |
| `WorkflowEngine.addStep/execute` Saga | `packages/orchestration/src/orchestration.ts` | Oui | `VendableWorkflow` + `CheckoutOrderWorkflow` | Inchangé |
| `InMemoryGuard.reportFallback` | `packages/support/src/in-memory-guard.ts:6` | **Oui mais non branché** | 0 usage | **Nouveau** — à brancher |

### 13.3 Fonctionnalités déjà injectées correctement (rev.2)

**8 BACs** (`portfolio`, `commerce` orders, `beam`, `solara`, `spaces`, `citadelle`, `solidarity`, `booking`, `subscription`) respectent le contrat canon et sont **faiblement couplés**. Nouveautés rev.2 : `subscription` déclare `events.publishes/subscribes:30`, `booking` `presentation/index.ts:50` `registerAdminPage` déclaratif, `feed`/`compliance` routes isolées.

### 13.4 Fonctionnalités trop couplées (à isoler — rev.2)

| Fonctionnalité | Statut rev.2 |
|---|---|
| **Enchères + Livraison** dans `commerce` (`auction.service.ts:71`, `delivery-partner.service.ts:73`) | **Toujours Très fort** — inchangé |
| **Maintenance Gate** `src/server/middleware/maintenance-gate.ts:7` | **Fort → Moyen** : extrait mais `import {maintenanceService} from "../../../apps/imperia/..."` subsiste — reste P0 (inversion) |
| **ThemeRuntime** `src/shell/theme/theme-bridge.ts` | **Moyen** : centralisé mais toujours hors `KernelModule` — reste P2 |
| **6 plugins commerce + 2 UI plugins** orphelins | **Très fort** — inchangé |
| **Shell routing** 13 `if(pathname)` | **Très fort → Moyen** : `src/start.ts` 1600→233 l., `api-dispatcher.ts` 8 modules — mais `if` cascade subsiste, et `DynamicBacRegistry` 10 imports hard-codés inchangé |
| **InMemory fallbacks sans guard** | **Nouveau Moyen** : `InMemoryGuard` existe mais non branché dans 3 fallbacks |

### 13.5 Points d'amélioration (priorisés — rev.2)

| Priorité | Action | Fichiers | Effort | Gain | Statut rev.2 |
|---|---|---|---|---|---|
| **P0** | ~~Déplacer `if(maintenanceActive)` → `MaintenanceModule`~~ **→ Reste : inverser `import {maintenanceService}`** | `src/server/middleware/maintenance-gate.ts:7` → `MaintenanceModule` + `container.instance("maintenanceService")` | Faible | Supprime circular `Shell→apps/imperia` | **Partiellement fait** (gate extrait, import direct reste) |
| **P0** | Activer `PluginModule` par défaut + manifester `plugins/*` | `packages/core/src/modules/index.ts:26`, `plugins/commerce-*/mosaix.json` | Faible | Plugins enfin fonctionnels | **Non fait** |
| **P0** *(nouveau)* | Brancher `InMemoryGuard.reportFallback` dans 3 fallbacks | `apps/portfolio/src/index.ts:73`, `apps/commerce/src/infrastructure/commerce-service-provider.ts:21`, `apps/citadelle/src/infrastructure/in-memory-user-repository.ts` | Faible | `ProductionInvariantViolation` détecté à l'exécution | **Nouveau P0** |
| **P1** | Extraire `apps/commerce/src/domain/auction.service.ts:71` → `apps/auction/` + `AuctionRepositoryPort` | `apps/commerce/src/domain/auction.service.ts` → `apps/auction/` | Moyen | Commerce -320 lignes | Non fait |
| **P1** | Extraire `apps/commerce/src/domain/delivery-partner.service.ts:73` → `apps/delivery/` | `apps/commerce/src/domain/delivery-partner.service.ts` → `apps/delivery/` | Moyen | Idem | Non fait |
| **P1** | Câbler `SlotRegistry` pour `QrCode`/`FormHelp` | `packages/ui-runtime/src/plugins/*.ts` + `apps/portfolio/src/presentation/*` | Faible | QR partage sans toucher `portfolio` | Non fait |
| **P2** | `ThemeRuntime` → `ThemeModule` | `src/shell/theme/theme-bridge.ts` → `packages/core/src/modules/theme-module.ts` | Faible | `ctx.getService("theme")` | Non fait |
| **P2** | `DynamicBacRegistry` 10 imports → `ApplicationDiscovery.discoverWorkspaceApps` auto | `src/shell/dynamic-bac-registry.ts:1` | Faible | Ajout BAC = 0 fichier Shell | Non fait |
| **P2** | `APP_ICONS` → `ShellRegistry.registerNavigationItem` | `packages/core/src/shell-registry.ts:32` + `src/shell/discovery.ts:6` | Faible | Navigation déclarative | Non fait (mais `imperia-nav.ts` est un pas) |
| **P3** | `api-dispatcher.ts` 8 `if` → `Map<string, Handler>` | `src/server/api-dispatcher.ts:35` | Faible | `ApiDispatcher` 100% ouvert | Nouveau P3 (évolution du P3 précédent) |

### 13.6 Architecture cible (réaliste, évolution — rev.2)

Voir §11.2 — identique à rev.1, avec 2 ajouts : `InMemoryGuard` branché + `MaintenanceModule` inversé (le gate est déjà extrait, reste l'inversion).

### 13.7 Matrice finale (rev.2)

| Fonctionnalité | Module indépendant | Point d'injection | Dépendance Core | Modification Core nécessaire | Peut être retirée facilement |
|---|---|---|---|---|---|
| **Partage auto réseaux sociaux** | Plugin `@mosaix-plugin/social-sharing` | `PluginRegistry.extensionsAt("portfolio","solara.post.afterCreate")` + `EventBus` | `EventBus` + `Capability` | Non | Oui (`deactivate`) |
| **Système d'enchères** | BAC `@apps/auction` (à créer) | `CapabilityRegistry` `auction.bid.place` + `Event auction.*` + `InMemoryGuard` | `Container` child + `Router` | Non (2 lignes Shell) | Oui (composition) |
| **Rapports périodiques** | BAC `@apps/analytics` (à créer) | `EventBus.subscribe("portfolio.vendable.published")` + `OutboxWorker` | `EventStore` + `DatabasePort` | Non | Oui |
| **QR Code** | Plugin UI `@mosaix-plugin/qr-share` | `SlotRegistry.register({slot:"portfolio.vendable.card"})` | `SlotRegistry` (à câbler) | 1 ligne `SlotRegistry.register` | Oui (`clear`) |
| **Compte société de livraison** | BAC `@apps/delivery` (à créer) | `CapabilityRegistry` `delivery.partner.register` | `Container` + `Event commerce.order.created` | Non (extraction `commerce`) | Oui |
| **Mode maintenance** | `KernelModule MaintenanceModule` (à inverser) | `MiddlewarePipeline.use` + `KernelContext.getService("maintenance")` | `MiddlewarePipeline` | **Déjà extrait** : `src/server/middleware/maintenance-gate.ts:13` + `routes/maintenance-routes.ts:11` — reste `import` → DI | Oui (stop module) |
| **Analytics produits** | BAC `@apps/analytics` | `EventBus` + `Metrics` | `Metrics` + `EventStore` | Non | Oui |
| **Nouvelles catégories** | **Donnée** (pas de module) | `Vendable.classification.categories` string[] | `VendableRepository` | Non (ou 1 ligne `apps/portfolio/src/domain/portfolio-service.ts:415`) | Oui (donnée) |

---

## Conclusion (rev.2)

Le **Core reste sain et extensible** pour les bounded contexts métiers (8 BACs faiblement couplés, ports/adapters, capabilities/events, permissions). Le **Shell est passé de monolithe à modulaire** : `src/start.ts` 1600→233 lignes, `src/server/api-dispatcher.ts` 8 route-modules, `src/shell/pages/*` et `src/shell/client/*` externalisés, `src/server/middleware/maintenance-gate.ts` extrait — la découpe est **réelle et testable**, et `InMemoryGuard` (`packages/support/src/in-memory-guard.ts:6`) ajoute un garde-fou production.

**Restent 3 dettes P0/P2 non corrigées** : (1) `maintenanceService` import direct hors container (`maintenance-gate.ts:7` / `maintenance-routes.ts:7` → `MaintenanceModule`), (2) `DynamicBacRegistry` 10 imports hard-codés (`dynamic-bac-registry.ts:1` → `ApplicationDiscovery`), (3) `PluginRegistry`/`SlotRegistry` non câblés (`modules/index.ts:26` `PluginModule` non default). Corriger ces 3 points (3 fichiers, <20 lignes) rend le système **pleinement** « ajouter/supprimer sans toucher au Core » — la refonte rev.2 a déjà fait 80% du chemin.

---

*Rapport généré sans modification de code — réanalyse statique du code réel au commit `a6222a5`. Première version : 2026-09-24 rev.1. Mise à jour : 2026-09-24 rev.2.*

---

## Addendum rev.3 — 2026-09-25 (faits re-mesurés, HEAD `55e1485`)

- `src/start.ts` : **367 l.** (rev.2 annonçait 233 — écart dû aux commits postérieurs : mobile-bridge, feed engine, validation env au boot). Le dispatcher reste branché (`dispatchApiRequest`, `handleMaintenanceGate` importés et utilisés) : la conclusion rev.2 « découpe réelle » tient.
- `packages/core/src/kernel.ts` 578 l. et `packages/feed-engine/src/index.ts` 580 l. : inchangés, restent les prochains candidats (§13).
- Nouveaux points d'extension livrés depuis rev.2, conformes au §11 : schéma env extensible (`validateEnv(env, extraSchema)`), `JwtService(previousSecrets?)` pour rotation, commandes CLI `key:*` / `install` enregistrées dans le router (ajout sans toucher au Core).
- `pnpm-lock.yaml` re-suivi : installs reproductibles.
- Dettes rev.2 (1)(2)(3) : non re-vérifiées, présumées inchangées.
