# Rapport — Responsabilités des packages `@mosaix/*`

Date : 2026-08-08
Contexte : cadrage de `apps/governance` (Control Plane de la plateforme).
Fondement : audit direct des 9 packages racine + inventaire ports/adapters.

---

## 0. Vues d'ensemble

```
                ┌──────────────┬──────────────┐
                │  Déclare (WHAT can be registered) │
                │  @mosaix/types · @mosaix/contracts │
                │  @mosaix/schemas                   │
                └──────┬────────────────────────────┘
                       │  (types-only, pas de runtime)
                       ▼
              ┌────────────────────────┐
              │ Runtime (HOW it runs)  │
              │ @mosaix/core · @mosaix/sdk │
              └──────┬──────────────────┘
                     │
     ┌───────────────┼──────────────────────────────┐
     ▼               ▼                              ▼
┌ @mosaix/ports ─┐  ┌ @mosaix/adapters (32) ┐  ┌ @mosaix/migrations ┐
│ 18 interfaces  │  │ implantations réelles │  │ moteur de schémas  │
└────────────────┘  └───────────────────────┘  └────────────────────┘
```

**Règle de frontière (vision utilisateur) :**
- *Package* = capacité réutilisable, générique, consommable par plusieurs apps.
- *Application* (`/apps/<BAC>`) = module autonome qui **compose** ces packages
  et fournit son propre domaine (backend, UI, migrations, events, capabilities).
- Governance = une application comme les autres, avec un rôle privilégié,
  **jamais un étage spécial du kernel**.

---

## 1. Couche fondation — `@mosaix/types`

> *« Foundation primitives » — ne dépend d'aucun autre package mosaix.*

| Responsabilité | Détail |
|---|---|
| Identité de tenant | `TenantIdentity` (`organizationId`, `spaceId`) |
| Enveloppe d'événement | `MosaixEventEnvelope` (id, type, version, source, tenant, timestamp, correlationId, causationId, payload, metadata, security) |
| Grammaire de permissions | `PermissionString` (chemin colon-délimité) |
| IDs temporellement ordonnés | `uuidV7` |
| Cycle de vie / statuts | types de base |

**Rôle vis-à-vis de Governance** : socle de ce que toute donnée échangée
portera (événement, permission, tenant).

---

## 2. Couche ABI — `@mosaix/contracts`

> *« Domain Contract Layer » — analogue à la spécification OCI : ne s'exécute pas, définit ce qui permet l'interopérabilité. LAYER TE INT**ética : contracts → types uniquement (vers le bas).*

| Bloc | Responsabilité |
|---|---|
| `mosaix-artifact` | Manifeste mère (type d'artefact, métadonnées, dépendances) |
| `application/*` | `ApplicationManifest`, domaines, runtime, lifecycle, permissions, expérience |
| `plugin/*` | `PluginManifest`, lifecycle, permissions, extension points |
| `capability/*` | `CapabilityContract`, opérations, **provider / consumer** |
| `experience/*` | `ExperienceContract`, **slots** de placement UI |
| `events/*` | contrats d'events, de commandes et de queries |
| `security/*` | contrats de sécurité |
| `theme/*` | contrats de thème (DesignTokens, couleurs, assets) |
| `CONTRACT_VERSION` | version du contrat (évène dans `version.ts`) |

**Règle** : zéro logique métier, zéro runtime, zéro réseau, zéro UI.

**Rôle vs Governance** : `ApplicationManifest` + `CapabilityContract` sont les
contrats exacts que l'app governance déclarera ; la notion **provider/consumer**
de capacité est le mécanisme central du dashboard.

---

## 3. Couche ABI — `@mosaix/schemas`

> *Validation runtime Zod des contrats. Séparé pour que les apps qui n'ont besoin que
> des types TS n'embarquent pas Zod.*

| Responsabilité |
|---|
| `ApplicationManifestSchema`, `PluginManifestSchema`, `CapabilityContractSchema` |
| `PermissionContractSchema`, `PermissionBundleSchema` |
| `ThemeManifestSchema`, design tokens, couleurs |
| `MosaixEventEnvelopeSchema`, `CommandContractSchema`, `QueryContractSchema` |
| `artifactManifest` |
| Vérifications de **compatibilité de versions** |

**Rôle vs Governance** : c'est LE garde-fou à l'entrée des manifests ; on utilisera les
schemas pour valider les manifests d'apps et de plugins énumérées par le dashboard.

---

## 4. Couche runtime — `@mosaix/core`

> *« Runtime Kernel — lifecycle, registres, backbone de communication ».*

**Services internes (`KernelServices`) fournis au contexte**

| Service | Type | Responsabilité |
|---|---|---|
| `events` | `DomainEventBus` | backbone de communication in-process (enveloppe `MosaixEventEnvelope`) |
| `eventStore` | `EventStore` | journal d'append-only des événements émis |
| `eventSchemas` | `EventSchemaRegistry` | registre des schemas/validators de payload |
| `permissions` | `PermissionRegistry` | registre central des permissions connues |
| `authorization` | `AuthorizationEngine` | décide si une opération sur une permission est autorisée |
| `capabilities` | `CapabilityRegistry` | registre des capacités fournies par les apps |

**Systèmes adjoints** :

| Composant | Responsabilité |
|---|---|
| `RuntimeKernel` | assemble services + modules, `register()` les apps, `start()`/`stop()` |
| `AppRegistry` / `RegisteredApp` | registre des apps enregistrées + `KernelHooks` |
| `AppLifecycle` | cycle de vie (hooks et observateurs) |
| `CapabilitiesModule` / `EventsModule` / `PermissionsModule` | modules par défaut que le kernel installe |
| `KernelError` + sous-types | erreurs normalisées (registration, lifecycle, authorization, capability, event, validation, service) |
| `createExecutionContext` / `describeTenant` | identité et traçabilité d'exécution |
| `ConsoleLogger`, `InMemoryMetrics`, `InMemoryTracer` | observabilité par défaut (adressables par ports) |
| `KernelConfig.grants` | **décision `PermissionGrant` (app + permission + tenant)** — source d'autorité du Control Plane (ARCH-012) |

**Rôle face à Governance** : registration de l'app, déclaration de ses capabilities,
events (bus + store + schemas), permissions & grants. **Governance n'implémente
jamais rien du bus/permissions/registres — elle les consomme.**

---

## 5. Couche SDK — `@mosaix/sdk`

> *« Application SDK — dev exp pour construire des Bounded Applications. »*

| Responsabilité |
|---|
| `MosaixApp` : wrapper app sur un `RuntimeKernel` |
| `MosaixAppConfig` : manifest + tenant |
| `kernel.register(manifest)` : seeds capabilities + ownership of event schemas |
| Règles ARCH-012 appliquées : l'app **ne s'octroie jamais de permissions** (grants départ kernel config) |
| Émission d'events enrichie : `MosaixPublishOptions` (correlationId, causationId, metadata, security) |

**Rôle vs Governance** : le pattern d'export de l'app governance (`createGovernanceApp(kernel, config)`)
doit passer par le SDK pour toutes ses publications.

---

## 6. Couche configuration — `@mosaix/config`

| Api | Responsabilité |
|---|---|
| `Config`, `ConfigManager`, `config` | config centralisée, type-safe, extensible, **immutable** |
| `env`, `createEnvHelper` | lecture/helper vars d'environnement |
| `ConfigEvent` | événements de changement de config |

**Rôle vs Governance** : les settings plateforme peuvent se superposer à ce
système (mais voir Q persistance : paramètres === tables gouvernance via migrations).
Repère confirmé : config immuable → pour `settings.*` il faudra une couche
governance persistante au-dessus.

---

## 7. Couche persistance — `@mosaix/migrations`

**Dépendance unique** : `@mosaix/ports-database` (ADR-0006).

| Composant | Responsabilité |
|---|---|
| `MigrationRegistry` + `loadMigration` + `DependencyResolver` | agrège les providers de migrations, charge et résout les dépendances |
| `MigrationPlanner` + `computeSourceVersion` | plan déterministe immuable (delta clair) |
| `MigrationRunner` + `newBatchId` | exécution du plan, `RunResult` |
| `MigrationStore` (InMemoryMigrationStore) | suivi des migrations exécutées |
| `checksum` / `computeChecksum` | intégrité des applied migrations |
| erreurs typées | déjà-appliquée, conflit, manquante, checksum, lock, transaction, exécution |
| `SchemaBuilder` + grammars `Blueprint`, `ColumnDefinition`, etc. | construction SQL (Phase 2) |
| `MigrationCLI` | commandes CLI |

**Rôle vs Governance** : c'est ce moteur qui crée `governance_feature_flags`,
`governance_roles`, `governance_settings`, `governance_audit`. Conforme à la
vision app=module avec ses propres migrations.

---

## 8. Ports — `@mosaix/ports` (18 contrats)

**Définition** : interfaces minimales qui découplent le noyau et les apps des
infrastructures concrètes. Index unique global + un fichier par port.

| Port | Contrat (responsabilité type-clé) |
|---|---|
| `cache` | cache valeur/clé |
| `clock` | horloge (fake/system) |
| `config` | config externalisée |
| `crypto` | chiffrement/hash |
| `database` | **exécution SQL + query + lock de migration + capabilities (dialecte, transactions, verrous)** (ADR-0006) |
| `email` | envoi d'emails |
| `event-store` | **append/read de streams d'événements par agrégat (séquence, validation d'expected version)** |
| `feature-flags` | **`isEnabled` / `getVariation`** (découplage des toggles : LaunchDarkly/Split/Unleash) |
| `http` | accès HTTP typé |
| `id` | génération d'IDs (uuid/ulid) |
| `logging` | logger typé |
| `message-bus` | `publish` / `subscribe` par topic (orchestration in-process) |
| `metrics` | métriques exposées (Otel) |
| `pubsub` | pub/sub plus larges (multi machine) |
| `search` | recherche (elasticsearch/in-memory) |
| `secrets` | accès secret hors config |
| `sms` | envoi sms |
| `storage` | stockage objets/état |
| `tracing` | traces (Otel) |

**Rôle vs Governance** : les **3 adaptations natives pour le Dashboard** : `database`
(persistance settings/flags/audit), `feature-flags` (moteur des Feature Flags UI),
`event-store` (source de vérité audit si backend event-sourcing).

---

## 9. Adapters — `@mosaix/adapters` (32 implantations)

> **Principe** : un port doit avoir ses adaptateurs ; si le store est muet/in-memory
> de façon silencieuse, c'est un anti-pattern (dette identifiée : email-smtp
> jsonTransport, sms-twilio mock, featureflags-launchdarkly mockKey, cache-redis
> clear=flushdb, crypto-web.decrypt ignore tag, messagebus-mosaix avale erreurs).

| Domaine | Adapterés |
|---|---|
| cache | `cache-memory`, `cache-redis` |
| clock | `clock-fake`, `clock-system` |
| config | `config-env` |
| crypto | `crypto-node`, `crypto-web` |
| database | `database-postgres`, `database-sqlite` |
| email | `email-ses`, `email-smtp` |
| feature flags | `featureflags-launchdarkly`, `featureflags-memory` |
| http | `http-fetch` |
| id | `id-ulid`, `id-uuid` |
| messagerie | `kafka`, `rabbitmq`, `messagebus-mosaix` |
| logging | `logger-pino`, `logger-winston` |
| metrics | `metrics-otel` |
| search | `search-elasticsearch`, `search-memory` |
| secrets | `secrets-env` |
| sms | `sms-twilio` |
| storage | `storage-local`, `storage-s3` |
| tracing | `tracing-otel` |

**3 ports sans adapter encore** : `event-store`, `logging`, `pubsub` (gaps).

**Rôle vs Governance** : `database-postgres` = persistance réelle des settings ;
`feature-flags-memory`/`feature-flags-launchdarkly` à remplacer par un adaptateur
**deriveDatabasePort** piloté par governance (persistant).

---

## 10. Matrice de responsabilité — décision refus / application

| Fonctionnalité | Appartient à | Justification (règle gén? spécifique) |
|---|---|---|
| event bus | `@mosaix/core` | générique runtime |
| permission engine | `@mosaix/core` | générique runtime |
| capability registry | `@mosaix/core` | générique runtime |
| database abstraction | `@mosaix/ports/database` | générique infra |
| identity | `@mosaix/…` + app identity (product) | les ports sont génériques ; le domaine build `apps/identity` |
| feature flags engine | `@mosaix/ports/feature-flags` + adapters | capacités réutilisables |
| plugin registry / registry app | `@mosaix/contracts` + `core/AppRegistry` | API canonical epub |
| **Role management métier + UI** | `apps/governance` | spécifique au domaine |
| **Governance dashboard** | `apps/governance` | spécifique |
| **Governance settings** | `apps/governance` | spécifique |
| **Governance audit views** | `apps/governance` | spécifique |
| **Governance-specific migrations** | `apps/governance/migrations` | spécifique |
| **UI primitives** | `@mosaix/ui` (à créer) *ou* embarqué v1 | décision Q3 en attente |

---

## 11. Hiérarchie de dépendances (orientation validée)

```
@mosaix/types          ── aucune dépendance mosaik
      ↑
@mosaix/contracts       ── types (downward only)
      ↑
@mosaix/schemas         ── contracts + zod (validation runtime)
      ↑
@mosaix/core            ── contracts, types, + ports (registres & bus)
      │  ├── @mosaix/ports (18) ── interfaces, zéro impl
      │  └── @mosaix/adapters ── implémentation d'un port pour un producteur rel
      │
@mosaix/sdk             ── core + contracts + types (API app dev)
      │
@mosaix/migrations      ── ports/database (+ schemas pour phase 2)
      │
apps/<BAC>              ── compose sdk + core + contracts + schemas
                            + ports/adapters + props migrations (dans l'app)
```

**Note de dette détectée** : `@mosaix/schemas` a une dépendance « fantôme » vers
`@mosaix/contracts` ; `contracts` ne dépend pas réellement de `schemas` pourtant la
matrice ci-dessus positionne schmas comme feuille. À re-vérifier lors de
l'alignement (Phase Architecture).

---

## 12. Correction proposée du modèle mental (vision cible)

```
MOSAIX KERNEL  (runtime, registres, backbone)
      │
      ├── @mosaix/* packages      → capacités réutilisables
      └── Core services           → events, permissions, capabilities, config

      ┌────────────────────────────────────────┐
      │             APPLICATIONS              │ (Application Registry — jamais dans le kernel)
      │                                        │
      │  apps/governance   ← Control Plane     │
      │    backend · ui · migrations · config  │
      │    events · capabilities               │
      │                                        │
      │  apps/identity · apps/sales · …        │
      └────────────────────────────────────────┘

  Chaque Application déclare : backend, UI, migrations, dependencies,
  capabilities, routes, events, configuration.
```

---

## 12. Règles d'or pour la prochaine étape (Governance)

1. **Pas de ré-implémentation** : governance compose `core` (caps + permissions + events),
   `contracts`/schemas (validation), `ports/database` + `feature-flags`, `migrations`.
2. **Domain spécifique à governance** : rôles métier+UI, settings, audit views, dlq UI → `apps/governance`.
3. **Grants depuis le Control Plane** (`KernelConfig.grants`) toujours, jamais depuis le manifest de l'app.
4. Les 3 ports sans adapter (event-store, logging, pubsub) sont des pré-requis à
   combler si governance veut du vrai audit durable.
5. Persistance des settings = tables governance via **migrations à l'intérieur de l'app**
   (conforme à la vision « module d'extension autonome »).
```

---

## A. Annexes — cartographie brute

- 9 packages racine (`config`, `contracts`, `core`, `migrations`, `ports`,
  `schemas`, `sdk`, `types`, `adapters`).
- 18 ports sous `packages/ports/{cache,clock,config,crypto,database,email,
  event-store,feature-flags,http,id,logging,message-bus,metrics,pubsub,search,
  secrets,sms,storage,tracing}`.
- 32 adapters (`packages/adapters/*`) — voir §9.
- Tests : 264 passants (pipeline, au 2026-08-08) — non couverts dans ce rapport.
```

Ce rapport est déposé dans `.project/reports/mosaix-packages-responsibilities.md`.

Souhaites-tu :
1. l'ajouter au backlog comme ADR/architecture (`/workflow documentation sync`) ?
2. passer directement au plan d'exécution de `apps/governance` en suivant la structure documentée ?