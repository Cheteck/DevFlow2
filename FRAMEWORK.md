# MosaiX Framework Documentation (v1.0 — 2026)

MosaiX is an **Operating System for Composable Application Ecosystems** built on Clean Architecture (Hexagonal Ports & Adapters), TypeScript Project References, and pnpm Workspaces. It provides a declarative, capability-driven Application Orchestration Runtime where applications run as isolated Bounded Application Contexts (BACs).

---

## 1. Architectural Architecture & Planes

MosaiX organizes execution across 5 decoupled planes:

### 1. Runtime Kernel Plane (`packages/core`, `@mosaix/container`, `@mosaix/gateway`)

- **Runtime Kernel (`RuntimeKernel`)**: Lifecycle orchestrator managing kernel initialization (`INITIALIZING`), app registration (`register`), state transitions, module capabilities, and graceful shutdown (`STOPPED`).
- **IoC Container (`Container`)**: Singleton, transient, and scoped dependency injection supporting child containers per tenant (`createChild()`).
- **HTTP Gateway (`@mosaix/gateway`)**: Edge routing engine serving dynamic routes, OpenApi specifications (`/openapi.json`), rate limiting, and zero-trust authentication middleware (`OidcGatewayMiddleware`).

### 2. Applications Plane (`apps/*`)

- **8 Bounded Application Contexts (BACs)**:
  1. `@apps/identity` — Platform Authentication, Credentials, Tokens, Sessions, User Profiles.
  2. `@apps/imperia` — Platform Governance, Topology Inspection, Policy Engine, DLQ Supervision, Circuit Breaker Monitoring, Migration SQL Preview.
  3. `@apps/commerce` — Orders, Checkout Sagas, Payment Integration, E-Commerce Workflows.
  4. `@apps/spaces` — Modular Entity & Page Engine (Facebook Pages / Spaces paradigm), Team Roles, Acting-As-Space Audit Logs.
  5. `@apps/portfolio` — Product Information Management (PIM), Decoupled Vendables (Products, Services, Experiences, Digital Goods), Completeness Calculation, Localized Content (FR/EN/AR).
  6. `@apps/beam` — Real-time Instant Messaging, Direct & Group Conversations, Message Dispatch.
  7. `@apps/solara` — Actor-Agnostic Social Feed Engine, Polymorphic Publications (Polls, Articles, Showcases), Content Moderation Hooks, Follower Relations.
  8. `@apps/solidarity` — Crisis Coordination, Incident Reporting, Need Declarations, Donations, Warehouse Hubs, Mission Dispatch, Beneficiary Distribution Confirmation.

### 3. Hexagonal Ports & Adapters Plane (`packages/ports/*`, `packages/adapters/*`)

- **23 Hexagonal Ports**: Hexagonal interfaces for database (`DatabasePort`), secrets, clock, id, logging, metrics, tracing, email, sms, http, event store, message bus, pubsub, crypto, search, feature flags, storage, identity store, session store, credential store, token store, and session creation.
- **29 Concrete Adapters**: Concrete infrastructure drivers (e.g. `PostgresDatabaseAdapter`, `SQLiteDatabaseAdapter`, `RedisSessionStore`, `LaunchDarklyFeatureFlags`, `S3Storage`, `Elasticsearch`, `OtelTracing`, `TwilioSMS`, `SMTP/SES Email`).

### 4. Control & Extension Plane (`plugins/*`, `@mosaix/plugin-engine`)

- **Plugin Lifecycle Engine (`PluginManagementService`)**: Full plugin lifecycle management (`DISCOVERED` ➔ `VALIDATED` ➔ `LOADED` ➔ `INITIALIZED` ➔ `ACTIVE` ➔ `DISABLED` ➔ `UNLOADED`).
- **Plugin Sandbox (`PluginSandbox`)**: Isolated execution environment preventing untrusted plugins from mutating core memory.
- **Plugins**: `@mosaix-plugin/commerce-badge`, `commerce-comparator`, `commerce-recently-viewed`, `commerce-reviews`, `commerce-wishlist`, `solara-content-moderator`.

### 5. UI Runtime & Experience Plane (`packages/ui-runtime`)

- **Slot Registry (`SlotRegistry`)**: Decoupled UI slot contribution model allowing applications to contribute admin pages and widgets without compile-time coupling.
- **I18n Engine (`I18nEngine`)**: Dynamic multi-locale translation support (French, English, Arabic).

---

## 2. Layer Taxonomy & Boundary Rules

Enforced via `eslint-plugin-boundaries` in `eslint.config.mjs`:

| Layer       | Type Identifier        | Description / Included Packages                                                                                                                                                                    | Allowed Imports                                               |
| ----------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Layer 1** | `framework-foundation` | `@mosaix/types`, `@mosaix/contracts`, `@mosaix/schemas`                                                                                                                                            | None (leaf nodes)                                             |
| **Layer 2** | `framework-port`       | `@mosaix/ports-*` (23 hexagonal ports)                                                                                                                                                             | `framework-foundation`                                        |
| **Layer 3** | `framework-adapter`    | `@mosaix/adapters-*` (29 concrete adapters)                                                                                                                                                        | `framework-foundation`, `framework-port`                      |
| **Layer 4** | `framework-primitive`  | `@mosaix/core`, `container`, `config`, `orm`, `commands`, `http`, `events`, `traits`, `pipeline`, `security`, `orchestration`, `telemetry`, `auth`, `migrations`, `plugin-engine`, `control-plane` | `framework-foundation`, `framework-port`, `framework-adapter` |
| **Layer 5** | `runtime-entry`        | `@mosaix/gateway`                                                                                                                                                                                  | Layers 1–4                                                    |
| **Layer 6** | `sdk`                  | `@mosaix/sdk`                                                                                                                                                                                      | Layers 1–5                                                    |
| **Layer 7** | `apps`                 | `apps/*` (`@apps/identity`, `@apps/portfolio`, `@apps/commerce`, etc.)                                                                                                                             | Layers 1–6 (NO inter-app direct imports)                      |

---

## 3. Canonical Application Schema

Every MosaiX Bounded Application MUST strictly conform to the **Canonical Application Schema** (`.project/architecture/canonical-app-schema.md`):

### Mandatory Directory Layout

```text
apps/<app_name>/
├── mosaix.json                   # Declarative manifest
├── package.json                  # Workspace package spec (must be @apps/<app_name>)
├── tsconfig.json                 # TypeScript build configuration extending root
├── README.md                     # Documentation
├── src/
│   ├── index.ts                  # CANONICAL ENTRY POINT (MANIFEST, ServiceProvider, factory, domain re-exports)
│   ├── domain/                   # Pure Domain Models, Aggregates, Domain Errors, Ports
│   ├── application/              # CQRS Commands, Capabilities, Event Schemas
│   └── infrastructure/           # Controllers (with Guard.authorize), Database Repositories
└── frontend/                     # UI Slot Contributions
    └── src/
        └── index.ts              # UI slot contributions & page registrations
```

### Canonical `src/index.ts` Requirements

1. **`MANIFEST` Constant**: Declarative manifest constant strictly matching `mosaix.json`.
2. **Adapters Type & Defaults**: DI options and default adapter factories.
3. **`<App>ServiceProvider` Class**: Implements `register(container)` (DI singletons) and `boot(container, router)` (route wiring, `provideCapability`, `registerEventSchema`).
4. **`create<App>App(kernel, tenant, adapters?)` Factory**: Standard bootstrap function validating `AppConformanceValidator.validateApp`, creating child container, booting provider, and calling `kernel.mountRouter`.
5. **Domain Re-exports**: Public domain models, services, and error types.

---

## 4. Data Relevance & Persistence Resolution Rules

MosaiX enforces a **Persistent-First Storage Policy**:

1. **Persistent Database First**: Application repositories and modules must attempt to resolve persistent `DatabasePort` connections (e.g. PostgreSQL or SQLite via `@mosaix/ports-database` and `DatabaseModule`) first.
2. **In-Memory Fallback strictly conditional**: In-memory data structures (e.g., `InMemoryUserRepository`, `InMemoryVendableRepository`) MUST ONLY be used as a graceful fallback mechanism when no valid database configuration or adapter is supplied.
3. **Resolver Integration**: `DatabaseModule` provides `resolveAdapter(appId, tenantId?, fallbackAdapter?)` through `AppDatabaseResolver` to guarantee persistent resolution before dropping back to in-memory fallbacks.

---

## 5. Framework Primitives Summary

- **`@mosaix/orm`**: Multi-dialect AST `QueryBuilder` (SQLite/PostgreSQL AST generation), `Model` base class with `hasMany`/`belongsTo`/`manyToMany` relations, `Repository<T>`, `Seeder`, `Factory`, and `QueryCacheManager`.
- **`@mosaix/commands`**: CQRS `CommandBus` and `CommandHandler` primitives.
- **`@mosaix/events`**: `DomainEventBus`, `EventStore` (tenant-isolated append-only journal), `TransactionalOutboxEngine`, `OutboxWorker` with `DeadLetterQueue` (DLQ), and `OutboxDaemon`.
- **`@mosaix/http`**: `Controller`, `Router`, `HttpRequest`, `HttpResponse`, and `OpenApiGenerator`.
- **`@mosaix/security`**: `Policy` and `Guard` access control abstractions (`Guard.authorize(context, permission)`).
- **`@mosaix/orchestration`**: `WorkflowEngine` with Saga step compensation.
- **`@mosaix/telemetry`**: Cryptographically secure trace/span context propagation using `randomBytes` IDs and `OTLPTraceExporter`.
- **`@mosaix/traits`**: Dynamic behavior composition (`SoftDeleteTrait`, `TimestampableTrait`, `CacheableTrait`).
- **`@mosaix/config`**: Type-safe environmental `env` parsing, deep freeze immutability, snapshots, and event listeners.
- **`@mosaix/migrations`**: SchemaBuilder DSL, SQLiteGrammar, PostgresGrammar, Directed Acyclic Graph (DAG) topological sorting, pre-installation SQL previews (`previewSQL`), dry-runs, and execution audit trail logs.
- **`@mosaix/conformance`**: `AppConformanceValidator` checking manifest contracts, capability/event declarations, and canonical entry points.

---

## 6. Conformance & Validation CLI Tools

Application conformance and monorepo health are validated automatically via:

```bash
# Validate all 8 applications against the Canonical Application Schema
pnpm check:app-schema

# Full monorepo verification (app schema + conformance + manifests + lint + typecheck + tests + prettier)
pnpm check
```
