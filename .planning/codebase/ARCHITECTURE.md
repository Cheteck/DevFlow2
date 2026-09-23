<!-- refreshed: 2026-08-08 -->

# Architecture

**Analysis Date:** 2026-08-08

## System Overview

MosaiX ("Operating System for Composable Application Ecosystems") is a pnpm/TypeScript monorepo. Applications are **Bounded Application Contexts** that branch onto a shared **Runtime Kernel**; they never communicate directly. Every interaction (events, commands, queries, capability invocations) flows through governed contracts enforced by the kernel. The foundational invariant: **the Runtime is an arbiter, never an actor** — the kernel routes, validates, authorizes, coordinates, but implements no business logic and owns no domains (Loi 3, `.project/architecture/constitution.md`).

```text
┌───────────────────────────────────────────────────────────────────┐
│                        APPLICATIONS (Bounded Contexts)             │
│  apps/identity (reference app)        apps/sales (consumer app)   │
│  domain / application / events / infra   manifest + async handler │
└───────────────────────┬───────────────────────────────────────────┘
                        │  MosaixApp (@mosaix/sdk) — publish / subscribe /
                        │  provideCapability / executeCapability
                        ▼
┌───────────────────────────────────────────────────────────────────┐
│                     RUNTIME KERNEL (@mosaix/core)                 │
│  RuntimeKernel (packages/core/src/kernel.ts) — orchestrator only  │
│  ├── KernelContext (service locator)                              │
│  ├── AppRegistry + AppLifecycle (discovered → active → degraded)  │
│  └── installed KernelModules (default: Permissions, Capabilities, │
│      Events) — provide the communication backbone:                │
│      DomainEventBus+EventStore · EventSchemaRegistry ·            │
│      CapabilityRegistry · PermissionRegistry+AuthorizationEngine  │
└───────┬───────────────────────────────────────────────────────────┘
        │  executes → validates against ports? NO — ports live beside core
        ▼
┌───────────────────────────────────────────────────────────────────┐
│            CONTRACT / SCHEMA / TYPE LAYERS (downward only)        │
│  @mosaix/types (primitives) ← @mosaix/contracts (ABI, types only) │
│  ← @mosaix/schemas (Zod validators)                               │
└───────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────┐
│   INFRASTRUCTURE: ports/adapters (currently NOT wired to kernel)  │
│   @mosaix/ports-* (19 ports: database, clock, cache, storage…)    │
│   @mosaix/adapter-* (27+ adapters: sqlite, postgres, redis, s3…)  │
│   @mosaix/migrations (Registry/Planner/Runner engine)             │
└───────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component                                | Responsibility                                                                                                                                                                       | File                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| RuntimeKernel                            | Orchestrator: installs modules, start/stop, execution boundary, backward-compatible facade                                                                                           | `packages/core/src/kernel.ts`                                                            |
| KernelContext                            | Typed service locator: config, logger, metrics, tracer, apps, events, eventStore, eventSchemas, permissions, authorization, capabilities                                             | `packages/core/src/kernel.ts` (impl) + `packages/core/src/kernel-module.ts` (interfaces) |
| KernelModule                             | Extension contract: `name`, `version`, `register(ctx)`, `initialize?()`, `shutdown?()`                                                                                               | `packages/core/src/kernel-module.ts`                                                     |
| Default modules                          | Permissions, Capabilities, Events — installed by `defaultModules()`                                                                                                                  | `packages/core/src/modules/`                                                             |
| DomainEventBus + EventStore              | Publish/subscribe with schema+payload+permission checks, idempotent append, retry, dead-letter                                                                                       | `packages/core/src/event-bus.ts`                                                         |
| EventSchemaRegistry                      | Single-owner per event type, SemVer versions, payload validation                                                                                                                     | `packages/core/src/event-schema-registry.ts`                                             |
| CapabilityRegistry                       | Capability declaration/resolution (Flow B provider lookup)                                                                                                                           | `packages/core/src/capability-registry.ts`                                               |
| PermissionRegistry + AuthorizationEngine | `domain:resource:action:scope` grammar, allow/deny/wildcard, tenant-scoped checks                                                                                                    | `packages/core/src/permission.ts`                                                        |
| AppRegistry / AppLifecycle               | Manifest registration, lifecycle states (discovered → active → degraded → disabled), drain                                                                                           | `packages/core/src/app-registry.ts`, `packages/core/src/lifecycle.ts`                    |
| Observability                            | ConsoleLogger, InMemoryMetrics, InMemoryTracer (OTel interfaces defined, impl deferred)                                                                                              | `packages/core/src/observability.ts`                                                     |
| KernelError hierarchy                    | Serializable errors: RegistrationError, CapabilityError, AuthorizationError, EventError, LifecycleError, ValidationError, ServiceNotInstalledError                                   | `packages/core/src/kernel-errors.ts`                                                     |
| MosaixApp (SDK)                          | Developer-facing API: register, publish, subscribe, provideCapability, executeCapability, registerEventSchema + helpers (uuid, ulid, now, logger, cache, dispatch, execute, feature) | `packages/sdk/src/index.ts`, `packages/sdk/src/helpers.ts`                               |
| @mosaix/contracts                        | ABI layer: type-only contracts (application, plugin, capability, experience, theme, events, security). Never imports Zod or runtime code                                             | `packages/contracts/src/`                                                                |
| @mosaix/schemas                          | Zod validators for manifests, envelope, permissions                                                                                                                                  | `packages/schemas/src/`                                                                  |
| @mosaix/types                            | Zero-dependency primitives: UUID v7, PermissionString, TenantIdentity                                                                                                                | `packages/types/src/`                                                                    |
| @mosaix/migrations                       | Schema migration engine: MigrationRegistry → MigrationPlanner (immutable plan) → MigrationRunner; Grammar (SQLite/Postgres), SchemaBuilder DSL, CLI                                  | `packages/migrations/src/`                                                               |
| DatabasePort                             | Storage contract consumed by migrations: DatabaseCapabilities, LockCapabilities, MigrationLock, DatabaseConnection                                                                   | `packages/ports/database/src/index.ts`                                                   |
| Identity app                             | Reference app: User aggregate, UserService, IdentityCapabilities, 3 owned events w/ payload contracts, 6 capabilities                                                                | `apps/identity/src/`                                                                     |
| Sales app                                | Consumer app: async handler on `identity.user.created` → `sales.order.created`                                                                                                       | `apps/sales/src/index.ts`                                                                |
| Demo                                     | E2E script: shared kernel, both apps, full lifecycle, Control Plane grants                                                                                                           | `demo/identity-sales.ts`                                                                 |
| Shell (landing stub)                     | Root `src/` layer; currently only `resolveShellLanding()` + home template. Target: Experience Composition Model (ADR-0007)                                                           | `src/shell/landing/resolve-shell-landing.ts`                                             |

## Pattern Overview

**Overall:** Three-plane architecture (Control Plane / Runtime Plane / Applications) + layered contract stack (`types → contracts → schemas → core → sdk → apps`) + hexagonal ports & adapters at the infrastructure layer. The kernel is a **micro-kernel / module system** (ADR-0002): a minimal orchestrator over installed `KernelModule`s reached through a stable `KernelContext`; the public kernel API is a backward-compatible facade over module services.

**Key Characteristics:**

- **Downward-only dependency direction**, enforced by `eslint-plugin-boundaries` in `eslint.config.mjs` (element types: types → contracts → schemas → core → sdk → apps → demo; ports/adapters/migrations isolated).
- **Everything is a contract** (Loi 2): apps, plugins, themes, capabilities, experiences, events are governed runtime contracts; `@mosaix/contracts` is the "OCI spec of MosaiX".
- **No business logic in the kernel** (Loi 6): kernel owns only lifecycle, communication, security, contract resolution.
- **Single owner per event** (Loi 4): publisher = owner; consumers request access via explicit permissions.
- **Control Plane grants (ARCH-012)**: the SDK/kernel never grants from manifests; grants are external `KernelConfig.grants` — the sole authority.
- **One Bounded Context = one application** (Loi 7), with its own hexagonal domain (see `apps/identity`).
- **Ports/adapters exist but are not yet wired** into the kernel bootstrap (dashboard watchpoint T-I1).

## Layers

**Contracts Layer (@mosaix/contracts):**

- Purpose: Canonical ABI — declares what can be registered, loaded, executed, governed. Type-only.
- Location: `packages/contracts/src/`
- Contains: `mosaix-artifact.ts` (artifact root), `application/` (manifest, lifecycle, permissions, experience), `plugin/`, `capability/`, `experience/`, `theme/`, `events/` (event-contract, command, query), `security/` (permission-contract, trust-level, signature), `version.ts` (`CONTRACT_VERSION`)
- Depends on: `@mosaix/types` only
- Used by: core, sdk, apps, adapters, migrations, demo

**Schema Layer (@mosaix/schemas):**

- Purpose: Zod validators so consumers of pure types never embed Zod (ADR-0001).
- Location: `packages/schemas/src/`
- Contains: `application.ts`, `artifact.ts`, `capability.ts`, `events.ts`, `permission.ts`, `theme.ts`
- Depends on: contracts, types
- Used by: core (manifest validation in `RuntimeKernel.register`, envelope validation in `EventsModule`), apps, migrations

**Kernel Layer (@mosaix/core):**

- Purpose: Runtime Kernel — lifecycle, registries, communication backbone. Never imports Zod directly except through schemas.
- Location: `packages/core/src/`
- Contains: `kernel.ts`, `kernel-module.ts`, `app-registry.ts`, `lifecycle.ts`, `event-bus.ts`, `event-schema-registry.ts`, `capability-registry.ts`, `permission.ts`, `identity.ts`, `observability.ts`, `kernel-errors.ts`, `modules/`
- Depends on: schemas, contracts, types, ports (allowed by boundaries; no module consumes ports today)
- Used by: sdk, apps, demo

**SDK Layer (@mosaix/sdk):**

- Purpose: Developer-facing API (`MosaixApp`) + ambient helpers (`setActiveApp`/`getActiveApp`, `uuid`, `ulid`, `now`, `logger`, `cache`, `dispatch`, `execute`, `feature`).
- Location: `packages/sdk/src/`
- Contains: `index.ts`, `helpers.ts`
- Depends on: core, contracts, types
- Used by: apps/identity, apps/sales

**Application Layer (apps/):**

- Purpose: Bounded Application Contexts — own domain, events, capabilities, permissions; branch onto kernel via SDK.
- Location: `apps/identity/src/`, `apps/sales/src/`
- Contains: hexagonal structure for identity (`domain/`, `application/`, `events/`, `infrastructure/`); single-file manifest app for sales
- Depends on: sdk, core, contracts, schemas, types, adapters (allowed)
- Used by: demo

**Infrastructure Layer (packages/ports, packages/adapters, packages/migrations, packages/config):**

- Purpose: Hexagonal ports (`@mosaix/ports-*`) as contracts the kernel depends on; adapters (`@mosaix/adapter-*`) as implementations; `@mosaix/migrations` migration engine; `@mosaix/config` typed config.
- Location: `packages/ports/*`, `packages/adapters/*`, `packages/migrations/src/`, `packages/config/src/`
- Contains: 19 ports (cache, clock, config, crypto, database, email, event-store, feature-flags, http, id, logging, message-bus, metrics, pubsub, search, secrets, sms, storage, tracing); 27+ adapters (sqlite, postgres, redis, s3, kafka, rabbitmq, ses, smtp, twilio, pino, winston, otel, node/web crypto, memory/launchdarkly feature flags, …); migration engine (checksum, grammar, planner, registry, runner, schema-builder, store, cli)
- Depends on: ports/database, ports, contracts, types (boundaries enforce adapters → ports → contracts → types)
- Used by: nothing yet at runtime — integration into kernel bootstrap is the next workstream (T-I1)

**Shell Layer (root src/):**

- Purpose: Experience composition layer (PRD-0007/ADR-0007). Currently a landing resolver stub; target model: Application → Experience → Contribution (semantic intent) → Placements → Surface → Slot → Policy → Renderer.
- Location: `src/shell/`, alias `@src/*` (per PRD-0007 Q10; the repo root tsconfig has no `paths` mapping yet — alias is aspirational)
- Depends on (target): contracts, schemas, core, ui — **never** `apps/*` (ADR-0007 §10)
- Used by: nothing yet (stub)

## Data Flow

### Primary Request Path — Flow B: Capability Invocation

1. App calls `app.executeCapability(id, input)` (`packages/sdk/src/index.ts:136`) → `kernel.executeCapability(id, callerApp, tenant, input)`.
2. Resolve provider: `CapabilityRegistry.resolve` (`packages/core/src/kernel.ts:437`).
3. Authorization: `authz.authorize(perm, tenant, callerApp)` where perm = `${ownerApp}:${capabilityId}:execute:tenant` (`packages/core/src/kernel.ts:444-451`) — denied throws `CapabilityError`.
4. Executor lookup: `executors.get(capabilityId)` — registered via `app.provideCapability` (`packages/sdk/src/index.ts:119` → `kernel.registerCapabilityExecutor`).
5. Invoke executor inside a tracing span (`tracing.begin("capability.execute", …)`), increment metrics, return structured result (`packages/core/src/kernel.ts:461-474`).
6. The executor (e.g. `IdentityCapabilities.create` in `apps/identity/src/application/identity-capabilities.ts`) runs domain logic and publishes events.

### Secondary Flow — Flow A: Event Publication & Consumption

1. `app.publish(type, version, payload, options)` builds a `MosaixEventEnvelope` (UUID v7 id, tenant, correlationId/causationId, metadata, security classification incl. PII) (`packages/sdk/src/index.ts:78-108`).
2. `kernel.bus.publish(envelope, appId)` (`packages/core/src/event-bus.ts:157`):
   - schema check (`MosaixEventEnvelopeSchema` + `EventSchemaRegistry.validateEnvelope`) — reject unknown/unowned event
   - payload check (`EventSchemaRegistry.validatePayload` against registered `payloadSchema`, ADR-0003)
   - publish permission check (`*:event:<type>:publish:tenant`)
   - `store.append(envelope)` — tenant-scoped, idempotent by envelope id
3. For each subscriber with consume permission (`*:event:<type>:consume:tenant`), `deliver()` runs the handler; on failure, retries per `RetryPolicy` (exponential backoff), then dead-letter (`deadLetters()` / `flushDeadLetters()`).
4. Consumer example (`apps/sales/src/index.ts:138-153`): async handler awaits `user.lookup` capability and `sales.order.created` publication — order guaranteed to exist when handler resolves.

### Bootstrap / Lifecycle Flow

1. `new RuntimeKernel(hooks, options)` — installs default modules, applies external `KernelConfig.grants` (`packages/core/src/kernel.ts:142-169`).
2. `MosaixApp.register({manifest, tenant}, kernel)` → `kernel.register(manifest)` — validates manifest with `ApplicationManifestSchema`, seeds `CapabilityRegistry` + `EventSchemaRegistry` ownership, creates `AppLifecycle` state `discovered` (`packages/core/src/kernel.ts:288-337`).
3. `kernel.start()` — phase `starting` → `module.initialize()` for each module → `bootstrap()` initializes every app to `active`; failures degrade the app (`packages/core/src/kernel.ts:207-227`, `366-379`).
4. `kernel.stop()` — drains active/ready apps, then `module.shutdown()` in reverse install order (`packages/core/src/kernel.ts:229-259`).

### Demo End-to-End Flow (`demo/identity-sales.ts`)

1. Control Plane grants both apps via `KernelConfig.grants` (identity publish, sales consume/publish, sales execute `user.lookup`).
2. `createIdentityApp(kernel, tenant)` + `createSalesApp(kernel, tenant)` on a shared kernel.
3. `capabilities.create(...)` → publishes `identity.user.created` → Sales handler resolves user via `user.lookup` → publishes `sales.order.created`.
4. `kernel.store.query(tenant)` dumps the tenant-scoped event store (sequence + envelope).

**State Management:** In-memory, kernel-owned. Event store is per-tenant append-only in memory (`EventStore`, `packages/core/src/event-bus.ts:24-65`); app lifecycle states held in `AppRegistry`; capabilities/event schemas/permissions in their registries. No persistent storage is wired yet (Phase 2 backlog: persistent storage, OpenTelemetry, multi-tenant policy engine).

## Key Abstractions

**MosaixApp (SDK facade):**

- Purpose: The single object an application developer interacts with; wraps kernel registration, publishing, subscription, capability provision/execution.
- File: `packages/sdk/src/index.ts`
- Pattern: Facade over `RuntimeKernel`; also ambient-actor via `setActiveApp`/`getActiveApp` used by `helpers.ts` (logger, dispatch, execute, feature).

**KernelModule + KernelContext:**

- Purpose: Extension system (ADR-0002) — future kernel features are new modules, never kernel modifications. `KernelContext.setService`/`get` is a typed service locator with duplicate/absent protection.
- Files: `packages/core/src/kernel-module.ts`, module impls in `packages/core/src/modules/`
- Pattern: Micro-kernel / plugin; modules receive only the context, never the kernel.

**Mosaix Artifacts & Manifests:**

- Purpose: `ApplicationManifest`, `PluginManifest`, `ThemeManifest` extend `MosaixArtifactManifest` — declarative, validated contracts ("Dockerfile of MosaiX").
- Files: `packages/contracts/src/mosaix-artifact.ts`, `packages/contracts/src/application/application-manifest.ts`
- Pattern: Declarative contract; Zod-validated at registration (`ApplicationManifestSchema`); apps never self-grant permissions.

**Ports & Adapters (hexagonal):**

- Purpose: Decouple core from infrastructure. `@mosaix/ports-*` define contracts (e.g. `DatabasePort` in `packages/ports/database/src/index.ts`), `@mosaix/adapter-*` implement them. ADR-0006 rules: migration engine depends only on ports; SQL generated only by Grammar; concurrency guarantees belong to the adapter (`LockCapabilities`).
- Files: `packages/ports/*/src/index.ts`, `packages/adapters/*/src/index.ts`
- Pattern: Dependency inversion; adapters advertise capabilities (e.g. `DatabaseCapabilities.lock.distributed`).

**MigrationEngine (Registry/Planner/Runner):**

- Purpose: Deterministic, source-agnostic schema migrations (ADR-0006): Registry aggregates `MigrationProvider`s and validates identities; Planner computes an immutable idempotent delta plan; Runner executes only validated plans. Checksums enforce immutability of applied migrations.
- Files: `packages/migrations/src/registry.ts`, `planner.ts`, `runner.ts`, `checksum.ts`, `grammar.ts`, `schema-builder.ts`, `store.ts`, `cli.ts`

**Experience/Composition Model (ADR-0007 — ratified, not yet implemented):**

- Purpose: Single composition architecture: Surface (declarative region) → Slot (typed extension point) → Contribution (semantic intent `kind` + content + policies + placements, **no renderer**) → Placement (`{surfaceId, slotId}`) → Policy → Renderer. Four disjoint states: registered → eligible → visible → active. Structural vs Contextual ownership matrix locked (shell owns structural vocabulary; apps contribute to structural slots and declare contextual surfaces).
- Files (target): contracts in `@contracts/experience` (Surface/Slot/Contribution/Placement/Experience — not yet present), runtime in `@core` `CompositionRuntime` (not yet present), API in `@sdk` `app.experience` (not yet present).
- Current state: legacy experience contracts (`ExperienceContract` with `navigation`/`slots`/`layouts`/`widgets`/`theme`) in `packages/contracts/src/experience/` predate the ADR and are expected to be superseded (per ADR-0007 §8, kinds unify NavigationItem/Action/Insight/Badge/Widget/Command; `NavigationExtension` eliminated).

## Entry Points

**Runtime Kernel:**

- Location: `packages/core/src/kernel.ts` — `RuntimeKernel` constructor is the composition root for modules; `kernel.start()`/`stop()` drive the ecosystem.
- Triggers: SDK `MosaixApp.register`, apps, demo script.
- Responsibilities: module installation, lifecycle, execution boundary, facade.

**SDK:**

- Location: `packages/sdk/src/index.ts` — `MosaixApp.register` is the app bootstrap entry; `MosaixApp.publish/executeCapability/provideCapability/subscribe` are the app-facing API.
- Triggers: application `create*App` factories.

**Applications:**

- `apps/identity/src/index.ts` — `createIdentityApp(kernel, tenant, options)` factory + `MANIFEST`.
- `apps/identity/src/start.ts` — executable entrypoint (`pnpm start:identity`).
- `apps/sales/src/index.ts` — `createSalesApp` factory + `main()`.

**Demo:**

- `demo/identity-sales.ts` — E2E script (`pnpm demo`, runs after `pnpm build`).
- `demo/identity-sales.test.ts` — integration test.

**Shell:**

- `src/index.ts` — exports `DEFAULT_HOME_TEMPLATE`, `isDefaultLanding`, `resolveShellLanding` (landing stub).
- Target shell root per PRD-0007/ADR-0007: `src/` with alias `@src/*` (alias not yet configured in tsconfig).

**Migrations CLI:**

- `packages/migrations/src/cli.ts` — `MigrationCLI` command handlers (status, up/down operations).

## Architectural Constraints

- **Dependency direction:** `apps → sdk → core → schemas → contracts → types` plus `adapters → ports → contracts → types` and `migrations → ports → contracts → types`; `contracts` may never import core/runtime or Zod; enforced by `eslint-plugin-boundaries` (`eslint.config.mjs`), each package declares `eslintBoundaries.type` in its `package.json` (e.g. `"type": "core"` in `packages/core/package.json`).
- **Kernel minimalism:** The kernel never imports implementations; future features are new modules (ADR-0002, Loi 6). The kernel owns exactly four responsibilities: lifecycle, communication, security, contract resolution.
- **The Runtime is an arbiter:** kernel implements no business logic; `CompositionRuntime` (target) must remain business-free (ADR-0007 consequences).
- **Single event ownership:** publisher = owner; `EventSchemaRegistry` enforces it (Loi 4, ADR-0003).
- **Grant authority (ARCH-012):** only external `KernelConfig.grants` grant permissions; an app's manifest declares intent only.
- **Manifest is declarative:** no executable logic in manifests (Loi 5); validated at registration.
- **Execution boundary:** authN → authZ → execution, no shortcuts (`executeCapability`, `DomainEventBus.publish`).
- **Global state:** module-level active app singleton in `packages/sdk/src/helpers.ts` (`activeAppInstance`) — the only module-level mutable state; set by `MosaixApp.register`, consumed by ambient helpers. In-memory stores/registries are instance-level, kernel-owned.
- **Threading:** single-threaded Node event loop; no workers/spawning in the current code (web-worker isolation is declared in manifests as target runtime, roadmap §3).
- **Versioning:** every contract surface is versioned (manifest `1.0.0`, event versions, `CONTRACT_VERSION`); events SemVer with additive-only minor/patch; breaking change = new major type.

## Anti-Patterns

### Kernel facade duplication vs module services

**What happens:** `RuntimeKernel` exposes getters (`bus`, `store`, `permissions`, `authz`, `capabilities`, `eventSchemas`) that re-expose `KernelContext` services — two ways to reach the same service.
**Why it's wrong:** New code reaching through the facade may bypass the module contract and couple to the kernel class (the very God Object ADR-0002 removed).
**Do this instead:** New code must consume `KernelContext` (passed to modules) and the facade only for backward compatibility — see `packages/core/src/kernel.ts:265-284`.

### Manifest permission declarations that are not grants

**What happens:** Manifests declare `permissions` arrays (e.g. `apps/identity/src/index.ts:132-176`); without external grants these declarations grant nothing.
**Why it's wrong:** A developer may assume declared permissions are effective; runtime denies every publish/execute without an external grant.
**Do this instead:** Always provision `KernelConfig.grants` (Control Plane) — see `demo/identity-sales.ts:25-48`; treat manifest permissions as documentation/contracts only.

### Legacy experience contract vs ADR-0007 model

**What happens:** `packages/contracts/src/experience/*` still models the pre-ADR-0007 world (`ExperienceContract` aggregates `navigation`, `slots`, `layouts`, `widgets`, `theme`; `WidgetContract` binds to `capabilityId`).
**Why it's wrong:** ADR-0007 ratifies Surface/Slot/Contribution/Placement semantics; keeping both would recreate the dual navigation/composition channel the ADR eliminates (§8).
**Do this instead:** Implement the ADR-0007 contracts in `@contracts/experience` (SurfaceContract, SlotContract, ContributionContract, PlacementContract, ExperienceContract) and migrate apps through the SDK v2 experience API; keep `kind:'component'` present but disabled by default in the RendererRegistry.

## Error Handling

**Strategy:** Typed error hierarchy rooted at `KernelError` (serializable, `code`, `details`) — `packages/core/src/kernel-errors.ts`. The kernel never throws raw `Error`s; `asKernelError()` normalizes unknown errors. Domain errors are app-owned (`apps/identity/src/domain/errors.ts`).

**Patterns:**

- Registration errors: duplicate module/app/service, manifest validation issues.
- Authorization errors: denied permission → `CapabilityError`/`EventError` with actor + tenant context.
- Event failures: schema/payload validation failures rejected at publish; consumer handler failures retried per `RetryPolicy` then dead-lettered (`packages/core/src/event-bus.ts:200-228`).
- Lifecycle errors: `AppLifecycle` moves apps to `degraded` on initialize failure; `kernel.stop()` drains and warns on failures.
- Migration errors: `MigrationChecksumError` (modified applied migration), `MigrationConflictError` (identity collision), `MigrationMissingError`, `MigrationResourceConflictError` (SQL resource collision) — `packages/migrations/src/errors.ts`.

## Cross-Cutting Concerns

**Logging:** Structured logger interfaces (`Logger`, `LogLevel`, `LogRecord`) with `ConsoleLogger` default in `packages/core/src/observability.ts`; SDK ambient `logger` helper prefixes `[LEVEL] [appId] msg` (`packages/sdk/src/helpers.ts`). OTel adapter `tracing-otel`/`logger-pino`/`logger-winston` exist but are not wired.
**Validation:** Zod schemas isolated in `@mosaix/schemas`; manifests validated at registration; event envelopes + payloads validated at publish; capability I/O schemas are a backlog item (T-A5).
**Authentication:** Not yet implemented (Phase 1 scope: authorization only; `authentication.login` explicitly excluded in `apps/identity/README.md`). `trust-level`/`signature` contracts exist in `packages/contracts/src/security/` for future sandbox/trust model.
**Observability:** Metrics (`InMemoryMetrics`) and tracing (`InMemoryTracer`, `KernelTrace`) interfaces with OTel adapters available but not wired into kernel bootstrap.
**Tenant isolation:** `TenantIdentity` (`organizationId` + optional `spaceId`) carried on every envelope; EventStore keyed per tenant; permission scope is exact-match (`tenant`), never wildcarded.

---

_Architecture analysis: 2026-08-08_
