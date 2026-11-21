# MosaiX & IJIDeals

### Building the foundations of a composable digital ecosystem.

<p align="center">
  <strong>MosaiX</strong> · Application Infrastructure<br/>
  <strong>IJIDeals</strong> · Digital Ecosystem<br/>
  <strong>RAQIB</strong> · Intelligent Operations
</p>

---

## Overview

**MosaiX** is a TypeScript-based application framework and runtime ecosystem designed to build, compose and operate autonomous applications through modular, independently evolvable components called **Bounded Application Contexts (BACs)**.

**IJIDeals** is a digital ecosystem built on these foundations, bringing together specialized applications for identity, commerce, social networking, communication and business operations.

**RAQIB** is the intelligent operational system envisioned to coordinate, supervise and evolve this ecosystem through specialized AI agents, skills and composable capabilities.

Together, they explore a new approach to software architecture: **building digital ecosystems through composition rather than accumulation.**

## The Ecosystem

```mermaid
flowchart TB
    R["RAQIB<br/>Intelligent Operations"]

    subgraph E["Digital Ecosystem"]
        I["IJIDeals"]
        A["Citadelle<br/>Identity"]
        S["Spaces<br/>Organizations"]
        C["Commerce<br/>Marketplace"]
        SO["Solara<br/>Social"]
        B["Beam<br/>Messaging"]
        P["Payments<br/>& Subscription"]
        BK["Booking<br/>Scheduling"]
        SD["Solidarity<br/>Coordination"]
        PF["Portfolio<br/>Assets"]

        I --> A
        I --> S
        I --> C
        I --> SO
        I --> B
        I --> P
        I --> BK
        I --> SD
        I --> PF
    end

    M["MosaiX<br/>Application Infrastructure"]

    R --> I
    R --> M
    I --> M
```

### MosaiX — Build

The infrastructure for developing and operating composable applications.

- **Bounded Application Contexts (BACs)** — Autonomous domain modules
- **Modular architecture & domain isolation** — Hexagonal architecture with ports/adapters
- **Runtime & lifecycle management** — Kernel, registries, composition engine
- **Dependency injection & service orchestration** — Zero-config DI container
- **Domain events & integration contracts** — Event-driven communication
- **Infrastructure abstraction** — Database, cache, auth, storage ports
- **Identity & capability-based authorization** — Fine-grained permissions
- **Application composition & extensibility** — Plugin engine, theming
- **Developer tooling & SDKs** — CLI, generators, type-safe contracts

### IJIDeals — Connect

A unified digital environment composed of specialized applications.

| Application | Domain | Status |
| ----------- | ------ | ------ |
| **Citadelle** | Identity, authentication, authorization | Active |
| **Spaces** | Businesses, organizations, communities | Active |
| **Solara** | Social networking, content, feeds | Active |
| **Portfolio** | Product information management, assets | Active |
| **Commerce** | Marketplace, offers, transactions | Active |
| **Beam** | Messaging, communication, notifications | Active |
| **Payments** | Payment infrastructure, subscriptions | Active |
| **Booking** | Reservations, scheduling, calendars | Active |
| **Solidarity** | Citizen solidarity, emergency coordination | Active |
| **Imperia** | Platform governance, settings, admin | Active |
| **Inventory** | Stock management, logistics | Active |
| **Developer Portal** | API documentation, SDK references, developer experience | Active |

### RAQIB — Operate

An intelligent operational system designed to:

- Create and coordinate specialized agents
- Delegate and supervise missions
- Discover and execute authorized skills
- Compose capabilities through BACs
- Maintain operational memory and audit trails
- Verify execution results
- Protect sensitive data when interacting with external AI models

---

## Core Architecture

MosaiX is built around the **Bounded Application Context (BAC)**.

A BAC encapsulates a business domain, its logic, dependencies, capabilities and contracts.

The architecture targets three execution models:

| Runtime  | Description                                     |
| -------- | ----------------------------------------------- |
| **Shared**   | Multiple BACs operating within a shared runtime |
| **Isolated** | BACs operating in isolated environments         |
| **External** | Independently managed BAC runtimes              |

The goal is to provide application autonomy without imposing unnecessary distributed-system complexity.

### Architectural Layers

```mermaid
flowchart TB
    subgraph CP["Control Plane"]
        AR["App Registry"]
        CR["Capability Registry"]
        ESR["Event Schema Registry"]
        PR["Permission Registry"]
    end

    subgraph RP["Runtime Plane"]
        RK["Runtime Kernel"]
        DEB["Domain Event Bus"]
        AE["Authorization Engine"]
        CB["Communication Backbone"]
    end

    subgraph AP["Application Plane"]
        BAC1["BAC: Citadelle"]
        BAC2["BAC: Spaces"]
        BAC3["BAC: Commerce"]
        BACN["... 10+ BACs"]
    end

    CP --> RP
    RP --> AP
```

---

## Architectural Principles

| Principle | Description |
| --------- | ----------- |
| **Composition over accumulation** | Extend systems through reusable capabilities, not copy-paste |
| **Autonomy over coupling** | Maintain explicit application boundaries with contracts |
| **Modularity over fragmentation** | Avoid unnecessary microservices; BACs are modules first |
| **Infrastructure independence** | Abstract infrastructure behind stable ports/adapters |
| **Security by design** | Enforce identity, authorization and isolation at every layer |
| **Evidence-driven maturity** | Validate capabilities through tests and operational evidence |
| **Open foundations** | Prioritize open standards and self-hostable technologies |

---

## Technology Stack

| Area | Technologies |
| ---- | ------------ |
| **Language** | TypeScript 5.x |
| **Frontend** | React 19, Next.js 15, Tailwind CSS |
| **Backend** | Fastify, Node.js 22+ |
| **Databases** | PostgreSQL, MySQL, SQLite (dev) |
| **Architecture** | DDD, Hexagonal Architecture, Ports & Adapters |
| **Runtime** | MosaiX Kernel (custom) |
| **Frontend Composition** | Native ESM, Import Maps, Module Federation |
| **AI Integration** | MCP (Model Context Protocol), A2A |
| **Package Manager** | pnpm 9+ (workspace) |
| **Testing** | Vitest, Playwright |
| **CI/CD** | GitHub Actions, Docker |

*Technology choices may vary across individual components.*

---

## Project Structure

```
devflow/                          # Monorepo root
├── apps/                         # Bounded Application Contexts (BACs)
│   ├── _template/                # BAC starter template
│   ├── beam/                     # Messaging & communication
│   ├── booking/                  # Reservations & scheduling
│   ├── citadelle/                # Identity & authentication
│   ├── commerce/                 # Marketplace & offers
│   ├── developer-portal/         # API docs & developer UX
│   ├── imperia/                  # Platform governance
│   ├── inventory/                # Stock & logistics
│   ├── otp/                      # One-time passwords
│   ├── portfolio/                # Product & asset management
│   ├── solara/                   # Social networking & content
│   ├── solidarity/               # Citizen coordination
│   ├── spaces/                   # Organizations & communities
│   └── subscription/             # Recurring billing & metering
│
├── packages/                     # Framework packages (MosaiX Core)
│   ├── adapters/                 # Concrete implementations
│   │   ├── database/             # Postgres, MySQL, SQLite
│   │   ├── cache/                # Redis, memory
│   │   ├── auth/                 # OIDC, JWT, sessions
│   │   └── ...
│   ├── ports/                    # Interface definitions
│   │   ├── database/             # DatabasePort
│   │   ├── cache/                # CachePort
│   │   ├── auth/                 # AuthPort
│   │   └── ...
│   ├── core/                     # Runtime kernel, registries, composition
│   ├── gateway/                  # HTTP gateway, rate limiting, CORS
│   ├── http/                     # HTTP client, middleware, OpenAPI
│   ├── contracts/                # Shared domain contracts
│   ├── plugin-engine/            # Plugin system & extension points
│   ├── theme/                    # Theming system & design tokens
│   ├── orchestration/            # Workflow & saga orchestration
│   ├── events/                   # Domain event bus & schemas
│   ├── security/                 # Crypto, secrets, permissions
│   ├── setup-core/               # Setup assistant engine
│   ├── setup-engine/             # Setup execution runtime
│   ├── setup-contracts/          # Setup step contracts
│   ├── cli/                      # CLI commands
│   ├── command-center/           # Dev command center UI
│   ├── dev-server/               # Development server
│   ├── dev-session/              # Session management
│   ├── foundation/               # Base utilities, types, errors
│   ├── types/                    # Shared TypeScript types
│   ├── ui-runtime/               # UI composition runtime
│   ├── mobile-bridge/            # Mobile/WebView bridge
│   ├── mcp/                      # Model Context Protocol server
│   ├── intelligence/             # AI/ML integration layer
│   ├── analytics/                # Telemetry & analytics
│   ├── telemetry/                # Observability (metrics, traces)
│   ├── pipeline/                 # Data processing pipelines
│   ├── orm/                      # Lightweight ORM
│   ├── database/                 # Database utilities
│   ├── cache/                    # Cache utilities
│   ├── auth/                     # Auth utilities
│   ├── config/                   # Configuration management
│   ├── support/                  # Support utilities
│   ├── conformance/              # Contract conformance testing
│   ├── container/                # DI container
│   ├── schemas/                  # Validation schemas (Zod)
│   ├── filesystems/              # File system abstraction
│   ├── feed-engine/              # Feed & timeline engine
│   └── migrations/               # Migration system
│
├── plugins/                      # Cross-cutting plugins
│   ├── commerce-badge-plugin/
│   ├── commerce-comparator-plugin/
│   ├── commerce-recently-viewed-plugin/
│   ├── commerce-reviews-plugin/
│   ├── commerce-wishlist-plugin/
│   └── solara-content-moderator/
│
├── themes/                       # Design system themes
│   ├── _template/                # Theme starter template
│   ├── sage/                     # Nature-inspired
│   ├── midnight/                 # Dark professional
│   ├── arctic/                   # Clean minimal
│   ├── aurora/                   # Vibrant gradient
│   ├── cobalt/                   # Blue corporate
│   ├── copper/                   # Warm metallic
│   ├── desert/                   # Earth tones
│   ├── forest/                   # Deep green
│   ├── lime/                     # High contrast
│   ├── luxury/                   # Premium gold
│   ├── midnight-ocean/           # Deep blue
│   ├── monochrome/               # B&W accessibility
│   ├── mosaic-default/           # Default MosaiX theme
│   ├── nordic/                   # Cool neutrals
│   ├── ocean/                    # Blue-green
│   ├── paper/                    # Print-like
│   ├── plum/                     # Purple creative
│   ├── sunset/                   # Warm gradient
│   └── terracotta/               # Clay tones
│
├── src/                          # Application entry points
│   ├── shell/                    # Current shell (legacy)
│   ├── workbench/                # New Workbench (in development)
│   ├── server/                   # Server bootstrap
│   ├── theme/                    # Theme runtime
│   ├── themes/                   # Theme registry
│   ├── assets/                   # Static assets
│   └── test/                     # Test utilities
│
├── config/                       # Configuration files
│   ├── compositions/             # App composition definitions
│   ├── shell.config.json         # Shell configuration
│   └── workbench.ijideals.json   # Workbench configuration
│
├── docs/                         # Documentation
│   ├── bacs/                     # Per-BAC documentation
│   ├── plugins-guide.md
│   ├── themes.md
│   ├── MOSAIX-ROADMAP-EVOLUTION.md
│   ├── IJIDEALS-ECOSYSTEM-ROADMAP.md
│   ├── dev-command-center.md
│   └── decisions.md              # ADRs
│
├── .project/                     # Project governance (internal)
│   ├── PROJECT.md                # Master specification
│   ├── REQUIREMENTS.md           # Requirements catalog (REQ-001 to REQ-105)
│   ├── STATE.md                  # Active execution state
│   ├── architecture/             # Blueprints & invariants
│   ├── decisions/                # Architecture Decision Records
│   ├── roadmap.md                # Release roadmap
│   ├── changelog.md              # Change journal
│   └── workflows/                # Operational workflows
│
├── bootstrap/                    # App bootstrap & providers
├── scripts/                      # Utility scripts
├── skills/                       # AI agent skills
├── public/                       # Static public assets
├── remotion/                     # Video generation (Remotion)
├── tests/                        # Cross-cutting tests
└── compose*.yml                  # Docker Compose stacks
```

---

## Quick Start

### Prerequisites

- **Node.js 22+**
- **pnpm 9+**
- **Docker & Docker Compose** (for databases)

### Installation

```bash
# Clone & install dependencies
git clone https://github.com/Cheteck/DevFlow2.git
cd DevFlow2
pnpm install

# Start infrastructure (PostgreSQL + Redis)
docker compose up -d db cache

# Run database migrations
pnpm mosaix migrate

# Start development server
pnpm dev
# → http://localhost:3000
```

### Useful Commands

```bash
# Development
pnpm dev                    # Dev server with auto-reload
pnpm build                  # Incremental TypeScript build
pnpm start                  # Production server (no watch)

# Quality & Verification
pnpm check                  # Build + Lint + Typecheck + Test + Format
pnpm test                   # Run tests (Vitest)
pnpm check:conformance      # Contract conformance validation
pnpm mosaix doctor          # Architecture health check

# Setup & Keys (idempotent, non-interactive)
pnpm setup --dry-run                    # Preview changes
pnpm setup --admin-email=ops@ex.com     # Full setup: .env + secrets + DB + admin
pnpm key:generate                       # Generate missing secrets in .env
pnpm key:check                          # Audit secrets (CI-friendly)

# Docker
pnpm docker:up            # Full stack (app + postgres + redis)
pnpm docker:down          # Stop (add -v to remove volumes)
```

### Environment

Copy `.env.example` to `.env` and configure:

```env
MOSAIX_DATABASE_URL=postgresql://user:pass@localhost:5432/mosaix_dev
MOSAIX_REDIS_URL=redis://localhost:6379
MOSAIX_APP_KEY=base64:<32-bytes>          # AES-256-CBC, required
MOSAIX_AUTH_SECRET=base64:<32-bytes>      # JWT signing, required
```

---

## Documentation

| Document | Description |
| -------- | ----------- |
| **[Architecture Guide](docs/architecture.md)** | Hexagonal architecture, BAC boundaries, ports/adapters |
| **[BAC Development](docs/bacs/README.md)** | Creating, testing, and publishing BACs |
| **[Plugin System](docs/plugins-guide.md)** | Extending functionality through plugins |
| **[Theming](docs/themes.md)** | Design tokens, theme creation, dark mode |
| **[Runtime Spec](MOSAIX_APPLICATION_RUNTIME_SPEC.md)** | Kernel, registries, composition, lifecycle |
| **[Roadmap](docs/MOSAIX-ROADMAP-EVOLUTION.md)** | Milestones & evolution plan |
| **[Ecosystem Roadmap](docs/IJIDEALS-ECOSYSTEM-ROADMAP.md)** | IJIDeals platform vision |
| **[ADR Index](docs/decisions.md)** | Architecture Decision Records |
| **[Framework Spec](FRAMEWORK.md)** | Internal framework conventions |

> **Internal governance** (`.project/`) contains the master specification, requirements catalog, active state, and operational workflows. Not published to npm.

---

## Development Status

These projects are under active development. Implementation maturity is tracked separately from architectural vision.

| Project | Focus | Maturity |
| ------- | ----- | -------- |
| **MosaiX** | Core architecture, runtime, reusable infrastructure | 🟡 Beta |
| **IJIDeals** | Platform applications & ecosystem integration | 🟡 Beta |
| **RAQIB** | Agent orchestration, memory, operational autonomy | 🔵 Alpha |
| **Workbench** | Next-gen shell & developer experience | 🔵 Alpha |

---

## Contributing

1. **Fork** the repository
2. **Create a branch** — `git checkout -b feature/my-feature`
3. **Follow conventions** — See [AGENTS.md](AGENTS.md) for coding standards
4. **Commit** — `git commit -m "feat: my feature"`
5. **Push** — `git push origin feature/my-feature`
6. **Open a Pull Request**

### Code Standards

- **TypeScript strict mode** — No `any`, explicit returns
- **Hexagonal architecture** — Domain logic in BACs, infrastructure in adapters
- **SOLID principles** — Enforced via linting and architecture tests
- **Contracts first** — Define ports before implementing adapters
- **Test-driven** — Unit + integration + contract conformance tests

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<sub>Built around the idea that the future of software is composable, autonomous and interconnected.</sub>

<p align="center">
  <strong>MosaiX builds. IJIDeals connects. RAQIB operates.</strong>
</p>