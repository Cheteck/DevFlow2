# MosaiX Master Requirements Catalog (Traceable REQ-IDs)

## Phase 1 — MVP Core & Foundation

| REQ ID | Requirement Description | Status | Target Module / Spec |
|--------|-------------------------|--------|-----------------------|
| **REQ-001** | Monorepo scaffolding with pnpm workspaces, TS composite builds, and ESLint boundaries | ✅ Completed | `@mosaix/monorepo` |
| **REQ-002** | Runtime Kernel with module registration, lifecycle management, and discovery | ✅ Completed | `@mosaix/core` |
| **REQ-003** | Domain Contract Layer with immutable contract definitions | ✅ Completed | `@mosaix/contracts`, `ADR-0001` |
| **REQ-004** | Communication Backbone (Capability Registry, Domain Event Bus, Authorization Engine) | ✅ Completed | `@mosaix/core` |
| **REQ-005** | Identity Reference Application as reference BAC | ✅ Completed | `apps/identity` |
| **REQ-006** | Portfolio BAC (Products, Services, Digital Goods, Workflow transitions) | ✅ Completed | `apps/portfolio` |

---

## Phase 2 — Infrastructure Ports & Adapters

| REQ ID | Requirement Description | Status | Target Module / Spec |
|--------|-------------------------|--------|-----------------------|
| **REQ-010** | Phase 1 Ports (Clock, ID, Config, Secrets) & System/Fake Adapters | ✅ Completed | `@mosaix/ports-*`, `@mosaix/adapter-*` |
| **REQ-011** | Phase 2 Observability (Logging, Metrics, Tracing) & Pino/OTel Adapters | ✅ Completed | `@mosaix/ports-*`, `@mosaix/adapter-*` |
| **REQ-012** | Phase 3 Light Persistence (Cache, Storage) & Redis/S3 Adapters | ✅ Completed | `@mosaix/ports-*`, `@mosaix/adapter-*` |
| **REQ-013** | Phase 4 Database Port & Multi-App Migration Engine | ✅ Completed | `@mosaix/migrations`, `PRD-0006` |
| **REQ-014** | Phase 5 Communication (Email, SMS, HTTP) & SMTP/Fetch Adapters | ✅ Completed | `@mosaix/ports-*`, `@mosaix/adapter-*` |
| **REQ-015** | Phase 6 Security (CryptoPort) & NodeCrypto/WebCrypto Adapters | ✅ Completed | `@mosaix/ports-*`, `@mosaix/adapter-*` |
| **REQ-016** | Phase 7 Extensions (Search, Feature Flags) & Elastic/LaunchDarkly Adapters | ✅ Completed | `@mosaix/ports-*`, `@mosaix/adapter-*` |

---

## Active & Pending Priority Requirements (Wave 1 & 2)

| REQ ID | Requirement Description | Priority | Source Task |
|--------|-------------------------|----------|-------------|
| **REQ-101** | Full Infrastructure Module composition in `RuntimeKernel` | P1 High | `T-EXT-05` / `T-I1` (Completed) |
| **REQ-102** | Framework MigrationProvider DSL implementation for Auth tables | P0 Bloquant | `AUDIT-V2-01` (Completed) |
| **REQ-103** | Auth Local Provider CryptoPort password verification integration | P0 Bloquant | `AUDIT-V2-03` / `AUDIT-V2-05` (Completed) |
| **REQ-104** | Security Audits & Hardening for Auth (scrypt, session entropy, token validation, rate limiting) | P0 Bloquant | `SEC-AUTH-001..010` |
| **REQ-105** | Persistence Adapter Unit Tests (`credential-store-postgres`, `token-store-postgres`, `session-store-redis`) | P0 Bloquant | `AUDIT-V2-02` |
