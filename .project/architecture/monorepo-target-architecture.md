# MosaiX — Monorepo Target Architecture Specification

**Status:** Proposed Architecture
**Date:** August 19, 2026
**Author:** MosaiX Platform Architecture Review

---

## Executive Summary

This document formalizes the target repository topology, package taxonomy, dependency rules, public API surface, and testing architecture for **MosaiX** (*Modular Orchestration for Smart Application Integration eXperience*). It bridges documented architectural laws with physical enforcement, ensuring the monorepo remains explicit, predictable, enforceable, and maintainable as the ecosystem scales to 100+ packages and applications.

---

## A. Repository Topology Target Tree

```text
mosaix/
├── .mosaix/                            # Isolated Build Artifacts, Cache & Runtime State
│   ├── cache/                          # Intermediate build & TS caches (git-ignored)
│   ├── build/                          # Compiled production bundles
│   ├── static/                         # Assets & public exports
│   └── dev/                            # Active dev session state & sockets
│       └── sessions/
│
├── apps/                               # Bounded Application Contexts (BACs)
│   ├── identity/                       # Reference IAM Application
│   │   ├── mosaix.json                 # Declarative App Manifest
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── domain/                 # Pure domain models (Zero MosaiX runtime imports)
│   │   │   ├── application/            # CQRS Commands, Queries, Handlers
│   │   │   ├── infrastructure/         # DB Repositories, Adapters
│   │   │   └── composition-root.ts     # Wiring root connecting infrastructure to Ports
│   │   ├── frontend/                   # Experience surface (Pages, Slots, Navigation)
│   │   ├── database/                   # Migrations, Seeders, Factories
│   │   └── tests/                      # Application-scoped Test Suite
│   │
│   ├── portfolio/                      # Reference Vendables Application
│   └── commerce/                       # Reference Order & Checkout Application
│
├── packages/                           # Framework Core, Primitives, Ports & Tooling
│   ├── ABI & Contracts
│   │   ├── types/                      # Primitive Primitive Types & Branded Keys
│   │   ├── contracts/                  # Invariant Protocol Interfaces & Envelopes
│   │   └── schemas/                    # Zod Runtime Structural Schema Validators
│   │
│   ├── Core Runtime
│   │   ├── core/                       # RuntimeKernel, Lifecycle, Route & Module Registries
│   │   ├── container/                  # Official IoC Container
│   │   └── config/                     # Immutably Frozen Config Manager
│   │
│   ├── Framework Primitives
│   │   ├── sdk/                        # Ergonomic Application Developer Façade
│   │   ├── orm/                        # QueryBuilder, Model, Repository & Relations
│   │   ├── commands/                   # CQRS CommandBus & Handlers
│   │   ├── http/                       # Controller, Router, HttpRequest, OpenAPI
│   │   ├── events/                     # EventBus, Outbox Engine & Outbox Worker
│   │   ├── traits/                     # Dynamic Behavior Composition (SoftDelete, Timestampable)
│   │   ├── pipeline/                   # Onion-style Async Middleware Execution
│   │   ├── security/                   # Policy, Guard, UserContext
│   │   ├── orchestration/              # WorkflowEngine & Saga Compensation
│   │   ├── telemetry/                  # TelemetryContext & Tracing
│   │   ├── plugin-engine/              # Composable Plugin Runtime & Management
│   │   └── control-plane/              # Administrative & Governance Framework Package
│   │
│   ├── Hexagonal Ports
│   │   └── ports/                      # 23 Abstract Port Interfaces (database, cache, storage, etc.)
│   │
│   ├── Hexagonal Adapters
│   │   └── adapters/                   # 29 Concrete Adapter Drivers (postgres, sqlite, redis, etc.)
│   │
│   └── Developer Experience & Tooling
│       ├── cli/                        # MosaiX CLI binary, Scaffolder, mosaix doctor
│       ├── dev-server/                 # Dev Session Watcher & HMR Manager
│       ├── gateway/                    # Native Node.js HTTP Server & Token Bucket Rate Limiter
│       ├── auth/                       # Zero-Trust OidcTokenBridge
│       ├── conformance/                # AppConformanceValidator for MOSAIX-APP
│       ├── ui-runtime/                 # SlotRegistry, Navigation & I18nEngine
│       └── testing/                    # ChaosInjector & E2ETestHarness
│
├── plugins/                            # Basic E-Commerce Plugins (@mosaix-plugin/*)
│   ├── commerce-comparator-plugin/
│   ├── commerce-wishlist-plugin/
│   ├── commerce-reviews-plugin/
│   ├── commerce-recently-viewed-plugin/
│   └── commerce-badge-plugin/
│
├── tests/                              # Global Cross-System Platform & E2E Test Suite
│   ├── e2e/                            # Inter-app integration tests (Identity ➔ Gateway ➔ Portfolio)
│   ├── chaos/                          # Fault injection resiliency tests
│   └── conformance/                    # System-level conformance suites
│
├── .project/                           # Governance, PRDs, ADRs, State & Roadmap
├── eslint.config.mjs                   # ESLint Flat Config with Boundary Enforcement Rules
├── pnpm-workspace.yaml                 # Monorepo Workspace Package Map
├── tsconfig.json                       # Base Monorepo TSConfig
├── tsconfig.build.json                 # Monorepo Build Reference Compiler Configuration
└── vitest.config.ts                    # Root Vitest Multi-Project Workspace Configuration
```

---

## B. Package Taxonomy & Layers Matrix

| Package Family | Plane | Layer | Description & Responsibility | Allowed Dependencies |
|---|---|---|---|---|
| `@mosaix/types` | ABI / Contracts | Layer 0 | Primitive types, UUID/ULID brands | None (Self-contained) |
| `@mosaix/contracts` | ABI / Contracts | Layer 1 | Protocol interfaces, event envelopes, platform contracts | `@mosaix/types` |
| `@mosaix/schemas` | ABI / Contracts | Layer 2 | Zod runtime structural validators | `@mosaix/contracts`, `@mosaix/types` |
| `@mosaix/ports/*` | Infrastructure ABI | Layer 2 | 23 abstract port interfaces | `@mosaix/contracts`, `@mosaix/types` |
| `@mosaix/adapters/*` | Infrastructure Drivers | Layer 3 | 29 concrete adapter drivers | `@mosaix/ports/*`, `@mosaix/contracts`, `@mosaix/types` |
| `@mosaix/core` | Runtime Kernel | Layer 3 | RuntimeKernel, lifecycle state machine, registries | `@mosaix/schemas`, `@mosaix/contracts`, `@mosaix/types`, `@mosaix/ports/*` |
| `@mosaix/container` | Core Primitives | Layer 3 | Official IoC Container | `@mosaix/types` |
| `@mosaix/config` | Core Primitives | Layer 3 | Frozen configuration manager | `@mosaix/types` |
| `@mosaix/sdk` | Developer Framework | Layer 4 | Ergonomic developer façade for BACs | `@mosaix/core`, `@mosaix/contracts`, `@mosaix/types`, Framework Primitives |
| Framework Primitives (`orm`, `commands`, `http`, `events`, `traits`, `pipeline`, `security`, `orchestration`, `telemetry`, `plugin-engine`, `control-plane`) | Developer Framework | Layer 4 | Specialized application development primitives | `@mosaix/types`, `@mosaix/contracts`, `@mosaix/ports/*` |
| Tooling & Dev Runtime (`cli`, `gateway`, `dev-server`, `conformance`, `ui-runtime`, `testing`, `auth`) | Developer Tooling | Layer 5 | Server, CLI, HMR, testing, and UI rendering drivers | Core, Framework Primitives, Ports, Contracts, Types |
| Bounded Applications (`apps/*`) | Application Context | Layer 6 | Autonomous business domains (Identity, Portfolio, Commerce) | `@mosaix/sdk`, `@mosaix/contracts`, `@mosaix/types`, `@mosaix/ports/*` (in Infrastructure/Composition-Root only) |

---

## C. Architectural Planes

MosaiX is organized around three explicit planes:

1. **Applications Plane (`apps/*`)**:
   - Owns business logic, domain aggregates, CQRS commands, HTTP controllers, and UX surfaces.
   - Operates in complete isolation from other BACs. Communicates solely via capabilities and events.
2. **Runtime Kernel Plane (`packages/core`, `@mosaix/container`, `@mosaix/gateway`)**:
   - Owns execution supervision, capability dispatch, route resolution, event transport, and multi-tenant isolation.
   - Contains **zero business logic**.
3. **Control / Governance Plane (`packages/control-plane`)**:
   - Provides administrative inspection, topology health monitoring, DLQ event management, and circuit breaker metrics.
   - Implemented as a **framework package** in Layer 4 (`@mosaix/control-plane`).

---

## D. Dependency Graph & Immutable Rules

```text
Layer 0: @mosaix/types
   ▲
   │
Layer 1: @mosaix/contracts
   ▲
   │
Layer 2: @mosaix/schemas & @mosaix/ports/*
   ▲                             ▲
   │                             │
Layer 3: @mosaix/core & @mosaix/adapters/*
   ▲
   │
Layer 4: @mosaix/sdk & Framework Primitives (including @mosaix/control-plane & @mosaix/plugin-engine)
   ▲
   │
Layer 5: Developer Tooling & Gateway
   ▲
   │
Layer 6: apps/* (Bounded Applications)
```

---

## E. Boundary Matrix (ESLint Flat Config Target)

| Source Element (`from`) | Allowed Imports (`allow`) | Forbidden Imports (`disallow`) |
|---|---|---|
| `types` | `types` | Everything else |
| `contracts` | `contracts`, `types` | `schemas`, `core`, `sdk`, `apps`, `adapters` |
| `schemas` | `schemas`, `contracts`, `types` | `core`, `sdk`, `apps`, `adapters` |
| `ports` | `ports`, `contracts`, `types` | `adapters`, `core`, `sdk`, `apps` |
| `adapters` | `adapters`, `ports`, `contracts`, `types` | `core`, `sdk`, `apps` |
| `core` | `core`, `schemas`, `contracts`, `types`, `ports` | `adapters`, `sdk`, `apps` |
| `sdk` | `sdk`, `core`, `schemas`, `contracts`, `types`, `ports`, `framework-primitives` | `adapters`, `apps` |
| `app-domain` | `types`, `contracts` | `sdk`, `core`, `adapters`, `ports`, `apps` |
| `app-infrastructure` | `types`, `contracts`, `ports`, `adapters`, `sdk` | Other `apps` |
| `app-composition-root` | `types`, `contracts`, `ports`, `adapters`, `sdk`, `core` | Other `apps` |

---

## L. ADR-0012 Platform Auth & Layer Taxonomy Alignment

- **Platform Layer Taxonomy**:
  - `Layer 1`: `framework-foundation` (`types`, `contracts`, `schemas`)
  - `Layer 2`: `framework-port` (`ports/*`)
  - `Layer 3`: `framework-adapter` (`adapters/*`)
  - `Layer 4`: `framework-primitive` (`core`, `container`, `config`, `orm`, `commands`, `http`, `events`, `traits`, `pipeline`, `security`, `orchestration`, `telemetry`, `auth`, `migrations`, `plugin-engine`, `control-plane`, `database`)
  - `Layer 5`: `runtime-entry` (`gateway`)
  - `Layer 6`: `sdk` (`sdk`)
  - `Layer 7`: `apps` (`apps/*`)
  - `Tooling`: `dev-tooling` (`cli`, `dev-server`, `dev-session`, `watcher`, `conformance`, `ui-runtime`, `testing`)

- **Rule (ADR-0012)**: *1 User ➔ 1 Platform Authentication ➔ 1 Platform Session ➔ N Applications.* Identity provides user workflows; Platform Auth owns platform authentication state and sessions.
