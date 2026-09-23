# Codebase Structure

**Analysis Date:** 2026-08-08

## Directory Layout

```
DevFlow/                          # MosaiX monorepo root (pnpm workspace)
├── apps/                         # Bounded Application Contexts
│   ├── identity/                 # Reference app (hexagonal): domain, application, events, infrastructure
│   └── sales/                    # Consumer app: manifest + async event handler
├── packages/                     # Library packages (all @mosaix/*)
│   ├── types/                    # @mosaix/types — zero-dep primitives (UUID v7, PermissionString, TenantIdentity)
│   ├── contracts/                # @mosaix/contracts — ABI layer, type-only contracts
│   ├── schemas/                  # @mosaix/schemas — Zod validators
│   ├── core/                     # @mosaix/core — Runtime Kernel (modules, registries, event bus, authz)
│   ├── sdk/                      # @mosaix/sdk — MosaixApp + helpers
│   ├── config/                   # @mosaix/config — typed immutable config
│   ├── migrations/               # @mosaix/migrations — Registry/Planner/Runner schema migration engine
│   ├── ports/                    # @mosaix/ports-* — 19 hexagonal ports (one dir per port)
│   └── adapters/                 # @mosaix/adapter-* — 27+ implementations (one dir per adapter)
├── src/                          # Root shell layer (alias target @src/*, PRD-0007/ADR-0007)
│   └── shell/
│       ├── landing/              # resolve-shell-landing stub + home template
│       └── templates/            # home.html
├── demo/                         # E2E demo: identity-sales.ts (+ test)
├── .project/                     # Steward governance: architecture, decisions (ADRs), prd, backlog, reports
├── .planning/                    # GSD planning artifacts (codebase maps: this doc set)
├── .github/                      # GitHub Actions workflow (created, not activated — no remote)
├── package.json                  # Root: name "mosaix", scripts (dev/build/lint/format/test/check/demo)
├── pnpm-workspace.yaml           # Workspace globs: packages/*, packages/ports/*, packages/adapters/*, apps/*
├── tsconfig.json                 # Base TS config (strict, ES2022, ESM)
├── tsconfig.build.json           # Project references: every package + apps + src (build order)
├── eslint.config.mjs             # Boundary rules (element types + allow matrix) + TS recommended
├── vitest.config.ts              # Test runner config
├── prettier.config.json          # Formatting
└── AGENTS.md                     # Autonomous Engineering Steward Protocol (constitution of process)
```

## Directory Purposes

**`apps/identity/`** — Reference Bounded Application Context. Demonstrates the full production app pattern: hexagonal domain, governed events with payload contracts, capabilities exposed to the kernel, E2E cross-app flow with Sales. Internal layout (see `apps/identity/README.md`):

```
apps/identity/src/
├── index.ts               # MANIFEST + createIdentityApp() wiring + capability providers
├── start.ts               # Executable entrypoint (pnpm start:identity)
├── domain/                # Pure hexagonal domain: user.ts, user-service.ts, user-repository.ts (port), password.ts, errors.ts
├── application/           # IdentityCapabilities — orchestration + event publication
├── events/                # identity-events.ts — event types + Zod payload schemas (ADR-0003)
└── infrastructure/        # in-memory-user-repository.ts — adapter for the UserRepository port
```

**`apps/sales/`** — Minimal consumer Bounded Application: single-file manifest + `createSalesApp()` that subscribes to `identity.user.created`, resolves the user via the `user.lookup` capability and publishes `sales.order.created` (async, awaited handler). Test seams via `SalesAppOptions.lookupUser`/`createOrder`.

**`packages/types/`** — Lowest layer, zero runtime dependencies: `uuid.ts` (UUID v7 time-ordered), permission grammar types, tenant identity. Index: `packages/types/src/index.ts`.

**`packages/contracts/`** — The ABI layer (ADR-0001). Type-only; never imports Zod or runtime code. Index: `packages/contracts/src/index.ts` re-exports every contract family. Subdirectories mirror contract families:

- `application/` — `application-manifest.ts`, `application-lifecycle.ts`, `application-permissions.ts`, `application-experience.ts`
- `plugin/` — `plugin-manifest.ts`, `plugin-lifecycle.ts`, `plugin-permissions.ts`, `plugin-extension.ts`
- `capability/` — `capability-contract.ts`, `capability-provider.ts`, `capability-consumer.ts`
- `experience/` — `experience-contract.ts`, `layout-contract.ts`, `navigation-contract.ts`, `widget-contract.ts`, `theme-contract.ts` (legacy pre-ADR-0007 model — see ARCHITECTURE.md anti-patterns)
- `theme/` — `theme-manifest.ts`, `design-tokens.ts`, `branding.ts`, `accessibility.ts`
- `events/` — `event-contract.ts` (envelope), `command-contract.ts`, `query-contract.ts`
- `security/` — `permission-contract.ts`, `trust-level.ts`, `signature.ts`
- root — `mosaix-artifact.ts` (artifact root), `version.ts` (`CONTRACT_VERSION`)

**`packages/schemas/`** — Zod validators mirroring contracts: `application.ts`, `artifact.ts`, `capability.ts`, `events.ts` (envelope schema), `permission.ts`, `theme.ts`. Index: `packages/schemas/src/index.ts`.

**`packages/core/`** — Runtime Kernel. Public API in `packages/core/src/index.ts`. Modules installed by default in `packages/core/src/modules/index.ts` (`defaultModules()`: PermissionsModule, CapabilitiesModule, EventsModule). Kernel module system + `KernelContext` in `kernel-module.ts`.

**`packages/sdk/`** — Developer SDK: `index.ts` (`MosaixApp`), `helpers.ts` (ambient helpers using the active-app singleton). `packages/sdk/src/index.test.ts` + `helpers.test.ts`.

**`packages/ports/`** — One directory per port, each a `@mosaix/ports-*` package with a single `src/index.ts` (contract types only, plus `README.md` for the database port). Ports: `cache, clock, config, crypto, database, email, event-store, feature-flags, http, id, logging, message-bus, metrics, pubsub, search, secrets, sms, storage, tracing`.

**`packages/adapters/`** — One directory per adapter, each a `@mosaix/adapter-*` package with `src/index.ts` + `src/index.test.ts` (external mocks). Adapters: `cache-memory, cache-redis, clock-fake, clock-system, config-env, crypto-node, crypto-web, database-postgres, database-sqlite, email-ses, email-smtp, featureflags-launchdarkly, featureflags-memory, http-fetch, id-ulid, id-uuid, kafka, logger-pino, logger-winston, messagebus-mosaix, metrics-otel, rabbitmq, search-elasticsearch, search-memory, secrets-env, sms-twilio, storage-local, storage-s3, tracing-otel`.

**`packages/migrations/`** — Migration engine (ADR-0006). Internals: `registry.ts` (aggregates `MigrationProvider`s, validates identities), `planner.ts` (deterministic immutable plan), `runner.ts` (executes plans only), `checksum.ts`, `grammar.ts` (`SQLiteGrammar`/`PostgresGrammar`), `schema-builder.ts` (Blueprint DSL), `store.ts` (executed-migration store incl. `InMemoryMigrationStore`), `cli.ts` (`MigrationCLI`), `errors.ts`. Entry: `packages/migrations/src/index.ts` (also re-exports `@mosaix/ports-database` types).

**`packages/config/`** — Typed, immutable, validated config: `config.ts`, `env.ts`, `config.test.ts`.

**`src/`** — Shell layer root (not a `@mosaix/*` package). Currently only the landing stub; per PRD-0007 it is the future home of the Experience Composition runtime consuming contracts + schemas + core + ui (never apps). Contains its own `tsconfig.json` (composite, referenced from `tsconfig.build.json`).

**`demo/`** — `identity-sales.ts` E2E script + `identity-sales.test.ts` integration test; runs on a shared kernel with Control Plane grants.

**`.project/`** — Steward governance (AGENTS.md): `architecture/` (constitution.md + invariant specs), `decisions/` (ADR-0001..0007), `prd/` (PRD-0006, 0007, 0008 + experience-composition-protocol.md), `backlog/`, `reports/`, `risks/`, `roadmap.md`, `dashboard.md`, `project_state.md`, `changelog.md`, `workflows/`, `working/`.

**`.planning/`** — GSD planning artifacts: `codebase/` holds this map (ARCHITECTURE.md, STRUCTURE.md, plus STACK.md/INTEGRATIONS.md from prior runs).

## Key File Locations

**Entry Points:**

- `packages/core/src/kernel.ts`: `RuntimeKernel` — composition root / orchestrator
- `packages/core/src/index.ts`: kernel public API
- `packages/sdk/src/index.ts`: `MosaixApp` — app-facing API
- `apps/identity/src/index.ts`: `createIdentityApp` factory + manifest
- `apps/identity/src/start.ts`: standalone executable (`pnpm start:identity`)
- `apps/sales/src/index.ts`: `createSalesApp` + `main()`
- `demo/identity-sales.ts`: E2E demo (`pnpm demo`)
- `src/index.ts`: shell public exports (landing stub)
- `packages/migrations/src/cli.ts`: `MigrationCLI` command handlers

**Configuration:**

- `tsconfig.json` (base, strict) → `tsconfig.build.json` (project references; authoritative build order: types → contracts → schemas → ports → config → migrations → adapters → core → sdk → apps → src)
- `eslint.config.mjs`: boundary element types + allow matrix (single source of truth for dependency rules)
- `pnpm-workspace.yaml`: workspace globs
- `package.json`: root scripts (`dev`, `build`, `lint`, `format`, `test`, `test:coverage`, `check`, `demo`, `start:identity`, `clean`)
- `prettier.config.json`, `vitest.config.ts`, `.prettierignore`

**Core Logic:**

- Event backbone: `packages/core/src/event-bus.ts` (DomainEventBus, EventStore), `packages/core/src/event-schema-registry.ts`
- Authorization: `packages/core/src/permission.ts` (PermissionRegistry, AuthorizationEngine)
- Capabilities: `packages/core/src/capability-registry.ts`
- Lifecycle: `packages/core/src/lifecycle.ts` (AppLifecycle), `packages/core/src/app-registry.ts`
- Module system: `packages/core/src/kernel-module.ts` (+ `packages/core/src/modules/`)
- Errors: `packages/core/src/kernel-errors.ts`
- Identity app domain: `apps/identity/src/domain/user-service.ts`, `apps/identity/src/domain/user.ts`
- Migration engine: `packages/migrations/src/planner.ts`, `runner.ts`, `registry.ts`

**Testing:**

- Co-located `*.test.ts` files next to source (e.g. `packages/core/src/kernel.test.ts`, `apps/identity/src/index.test.ts`)
- `demo/identity-sales.test.ts` — cross-app integration test
- Runner: Vitest (`vitest.config.ts`); commands: `pnpm test`, `pnpm test:watch`, `pnpm test:coverage`

## Naming Conventions

**Files:**

- `kebab-case.ts` for library units and directories (`event-bus.ts`, `in-memory-user-repository.ts`, `capability-registry.ts`)
- `*.test.ts` co-located with the unit under test (`event-bus.test.ts`, `user-service.test.ts`)
- Port vs adapter distinct basenames (rule: no duplicated basenames): port `user-repository.ts` (domain) vs adapter `in-memory-user-repository.ts` (infrastructure); port dirs `packages/ports/<name>` vs adapter dirs `packages/adapters/<name>-<impl>`
- Root `src/` shell files keep the `resolve-<domain>-<name>.ts` prefix pattern (`resolve-shell-landing.ts`)

**Packages:**

- `@mosaix/<core-layer>` — `types`, `contracts`, `schemas`, `core`, `sdk`, `config`, `migrations`
- `@mosaix/ports-<name>` — e.g. `@mosaix/ports-clock`, `@mosaix/ports-database`
- `@mosaix/adapter-<name>-<impl>` — e.g. `@mosaix/adapter-clock-system`, `@mosaix/adapter-database-sqlite`
- Workspace-versioned with `workspace:*` in `dependencies`/`devDependencies`

**Code identifiers:**

- `PascalCase` interfaces/classes: `ApplicationManifest`, `RuntimeKernel`, `MosaixApp`, `SurfaceContract` (ADR-0007 target)
- `camelCase` functions/consts: `createIdentityApp`, `createSalesApp`, `resolveShellLanding`
- Event types: `<domain>.<resource>.<past-tense-action>` — `identity.user.created`, `sales.order.created`
- Capability ids: `<domain>.<resource>.<action>` — `user.create`, `order.lookup`
- Permissions: `domain:resource:action:scope` — `identity:user.create:execute:tenant`, `*:event:identity.user.created:publish:tenant` (scope never wildcarded)
- Test doubles prefixed `InMemory`/`Fake`: `InMemoryUserRepository`, `InMemoryMigrationStore`

## Where to Add New Code

**New Feature (kernel capability):**

- Contracts first: extend `packages/contracts/src/` (new family dir + re-export in `packages/contracts/src/index.ts`)
- Validators: add matching Zod schema in `packages/schemas/src/`
- Kernel: add a new `KernelModule` in `packages/core/src/modules/` (register services on `KernelContext`); do **not** modify `kernel.ts` beyond wiring
- SDK: expose through `packages/sdk/src/index.ts` (`MosaixApp` method) if developer-facing
- App: implement the Bounded Context in `apps/<name>/src/` (domain/application/events/infrastructure) and register via `MosaixApp.register` + `create<Name>App` factory

**New Bounded Application:**

- Create `apps/<name>/` (package.json with `"eslintBoundaries": { "type": "app-<name>" }` + boundary rule in `eslint.config.mjs`)
- Reuse the identity layout: `src/domain/`, `src/application/`, `src/events/`, `src/infrastructure/`, `src/index.ts` (manifest + factory), `src/start.ts` if executable
- Add `{ "path": "apps/<name>" }` to `tsconfig.build.json`
- Cover with co-located `*.test.ts` suites

**New Port:**

- Add `packages/ports/<name>/` (package.json `@mosaix/ports-<name>`, single `src/index.ts` with contract types)
- Add to `pnpm-workspace.yaml` (covered by `packages/ports/*` glob) and `tsconfig.build.json`
- Implement via `packages/adapters/<name>-<impl>/`

**New Adapter:**

- Add `packages/adapters/<name>-<impl>/` (package.json `@mosaix/adapter-<name>-<impl>`), `src/index.ts` + `src/index.test.ts` with external mocks
- Add to `tsconfig.build.json` (covered by workspace glob)

**New Shell/Experience UI code (per ADR-0007 target):**

- Contracts: `packages/contracts/src/experience/` (SurfaceContract, SlotContract, ContributionContract, PlacementContract, ExperienceContract)
- Runtime: `packages/core/src/` — `CompositionRuntime` (Surface/Slot/Contribution registries, PolicyEngine, CompositionResolver) — no business logic
- SDK: `app.experience` API (`contribute()`, `placement()`, `commands()`)
- Shell UI: `src/shell/` + `@mosaix/ui` renderers; shell must never import `apps/*`

**Utilities/Shared helpers:**

- Pure platform primitives: `packages/types/src/` (zero deps)
- Generic helpers used across packages: `packages/sdk/src/helpers.ts` (ID, clock, logger, cache, dispatch, execute, feature)

## Special Directories

**`node_modules/`, `packages/*/dist/`, `src/dist/`, `tsconfig.tsbuildinfo`:** Build outputs / installed deps — git-ignored except where committed (see `.gitignore`); `dist` present in workspace after local builds.

**`.project/`:** Governance knowledge base (AGENTS.md). Contains the authoritative ADRs (`.project/decisions/`), PRDs (`.project/prd/`), architecture constitution + invariant specs (`.project/architecture/`), roadmap/backlog/dashboard. Read before architectural work; ADR-0007 (Experience Composition Model) and PRD-0007 (Shell V2.1) are the governing specs for the shell.

**`.planning/codebase/`:** GSD codebase map (this file, ARCHITECTURE.md, STACK.md, INTEGRATIONS.md). Consumed by `/gsd-plan-phase` and `/gsd-execute-phase`; keep paths and patterns in sync with the codebase.

**`.github/`:** CI workflow committed but not active (no git remote configured).

---

_Structure analysis: 2026-08-08_
