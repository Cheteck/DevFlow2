# MosaiX / IJIDeals — Project Overview

**Date :** 2026-10-31  
**Branch :** `audit-technique-mosaix-8397822254578305712` (8 ahead of `devflow2`)  
**Status :** Production blockers identified — active remediation

---

## 1. What This Project Is

**MosaiX** — Modular Orchestration for Smart Application Integration eXperience  
An operating system for composable application ecosystems. Provides a modular, governed runtime enabling autonomous Bounded Application Contexts (BACs) to execute, communicate, and compose without tight coupling.

**IJIDeals** — First vertical platform (marketplace + community + campus) built on MosaiX.

---

## 2. Current Architecture (Verified)

### Dependency Flow (Strict)
```
apps → sdk → core → schemas → contracts → types
```
No direct cross-app imports; no reverse layer dependencies.

### Core Backbone (Runtime Kernel)
- **CapabilityRegistry** — Capability discovery & execution
- **DomainEventBus** — Event publication/subscription with schemas
- **AuthorizationEngine** — Permission resolution (DENY > ALLOW)
- **KernelModule** system — Lifecycle: CREATED → INITIALIZING → READY → RUNNING → STOPPING → STOPPED/FAILED

### 10 Canonical BACs (All Implemented)
| BAC | Domain | Primary Tables | Key Invariant |
|-----|--------|----------------|---------------|
| `citadelle` | Identity & IAM | `citadelle_identities`, `credentials`, `sessions` | Owns identity; never price/stock |
| `spaces` | Multi-tenant | `spaces`, `space_members` | Space isolation; custom domains |
| `portfolio` | PIM (Catalog) | `portfolio_vendables` + 14 CS-Cart tables | **Pure PIM** — variants have NO price/stock |
| `commerce` | Offers & Sales | `commerce_offers`, `payment_intents`, `auctions` | **Only source of price/stock/offer** |
| `beam` | Messaging E2E | `beam_conversations`, `messages` | ECDH/AES-GCM encryption |
| `solara` | Social | `solara_posts`, `comments`, `reactions` | Actor types: user \| space |
| `booking` | Appointments | `booking_slots`, `reservations` | iCalendar RFC 5545 |
| `solidarity` | Humanitarian | 7 tables (incidents, needs, donations...) | GeoJSON + Merkle audit |
| `imperia` | Governance | `imperia_audit_logs`, `policies` | Rego/OPA compliance |
| `subscription` | Recurring Billing | `user_subscriptions`, `metering_buckets` | Computes dues; never invoices/payments |

### Horizon BACs (Not Implemented)
- `delivery` (Phase 3b), `wallet` (medium-term)
- Sports: `olympia`, `chronos`, `patronus`, `arena`, `curator` (Phase 4)
- Campus: `academy`, `career`, `mentor` (Phase 5)

---

## 3. Verified Implementation Status

### ✅ Completed (Production-Quality)
- Runtime Kernel + Module system + 39 packages
- 10 BACs with full domain logic, ports & adapters
- Hexagonal architecture enforced (ports in `@mosaix/ports-*`, adapters in `@mosaix/adapter-*`)
- **1157 tests passing / 199 suites** (2026-10-31)
- 8 security vulnerabilities resolved (SEC-01)
- `Money` value object (unique currency handling)
- `EffectivePermissionResolver` (DENY > ALLOW, snapshots)
- Theme system: `ThemeResolver` 5-step cascade, 2 validated themes
- Proposals v1.3: `portfolio_proposals` mutable table, atomic approve
- Commerce: `CommerceOffer` (priceInCents, stockAllocation, commissionRateBps)
- COD Algeria payment flow + wallet escrow design
- MCP Gateway with Bearer auth + permission gate
- Plugin engine: 8 core components implemented

### ⚠️ Production Blockers (Active)
| ID | Risk | Status |
|----|------|--------|
| **R06** | Silent in-memory fallbacks in prod (Metrics, Tracer, SessionStore, repos) | **OPEN** — P0-1 in roadmap |
| **R05** | `/health/ready` doesn't verify DB/Redis | **OPEN** — P0-2 |
| **R02** | Migration immutability guard missing (incident `commerce.shop.v1.001`) | **OPEN** — P0-3 |
| **R09** | No GitHub Actions release workflow | **OPEN** — P0-4 |
| **R01** | Secrets versioning/revocation incomplete | **OPEN** — P0-5 |
| **R07** | No backup/restore strategy (RPO/RTO) | **OPEN** — P0-6 |
| **R03** | Distributed transaction audit (sagas) | **OPEN** — P0-7 |
| **R04** | MCP tool permissions audit | **OPEN** — P0-8 |
| **R08** | Tenant isolation: Redis keys + RLS PG | **OPEN** — P0-9 |

### 🔍 In-Memory Fallbacks Audit (2026-10-31, Verified in Code)
| Guarded (fail-fast in prod) | Unguarded (silent fallback in prod) |
|---|---|
| `InMemoryUserRepository` (citadelle) | `InMemoryTokenStore` (citadelle) |
| `InMemorySecretsAdapter` (citadelle) | `InMemorySessionStore` (citadelle) |
| `InMemorySessionStore` (bootstrap) | `InMemoryIdentityStore` (citadelle) |
| `VendableRepository` (portfolio presentation) | `InMemoryCredentialStore` (citadelle) |
| `Metrics` / `Tracer` (observability) | `InMemoryThemeAssignmentsStore` (theme pkg) |
| | `InMemoryVendableRepository` (portfolio infra) |
| | `InMemoryProposalRepository` (portfolio infra) |
| | `InMemoryPlatformSettingsStore` (core default) |
| | Theme store (shell bridge + resolver) |

**Fail-closed (throw if no persistent adapter):**
- `PortfolioServiceProvider`, `CommerceAppServiceProvider`, `CitadelleServiceProvider`

---

## 4. Key Business Rules (Invariants)

1. **Proposal ≠ Vendable** — `portfolio_proposals` mutable (draft→approved→vendable); `portfolio_vendables` clean (12k real, not 100k drafts)
2. **Roles = Data, Permissions = Code** — `EffectivePermissionResolver` = Global ∪ Space ∪ Overrides; DENY > ALLOW absolute
3. **Money Unique** — `Money.fromCents(cents, currency)` — never `amount: number` float
4. **Theme Agnostic** — `ThemeTarget {type, id}` generic; resolver 5 steps: entity > user > application > platform
5. **Commerce = Single Source of Offer/Stock/Price** — `portfolio_variants` abstract; `FORBIDDEN_OPERATIONAL_KEYS` blocks `price` in attributes

---

## 5. Canonical Flows

**Catalog:** Space admin → `portfolio_proposals` Draft → Submit → InReview → Approve → INSERT `vendable` Published → `CommerceOffer` Active → notifications

**Purchase (Algeria COD):** Order create `Pending(cod_pending)` → `InventoryPort.reserve` (PaymentPort no-op) → Delivery `assigned→delivered(proofUrl)` → `cod_delivered→succeeded` → wallet escrow release

**Social:** `vendable.published` → `social-auto-share-plugin` → Solara draft → seller validates

---

## 6. Governance & Documentation Structure

```
.project/
├── PROJECT_OVERVIEW.md          ← THIS FILE (canonical current state)
├── ARCHITECTURE.md              ← Architecture summary + links
├── BACKLOG.md                   ← Active delivery backlog (register)
├── RELEASE-READINESS.md         ← Production gate checklist
├── PRODUCTION_ROADMAP.md        ← Phase 1-4 blockers & plan
├── PRODUCTION_AUDIT.md          ← Latest audit findings
├── decisions/                   ← ADR-0001..ADR-0023 (immutable)
├── architecture/                ← Blueprints, diagrams, invariants
├── backlog/                     ← INMEMORY_REMEDIATION.md, PLAN-VAGUES.md
├── knowledge/                   ← Consolidated domain knowledge
├── reports/                     ← Current session reports only
├── workflows/                   ← Operational procedures
└── _archive_review/             ← Archived obsolete docs (review before delete)
```

**Source of Truth Hierarchy:**
1. Code (always) → 2. ADRs → 3. This overview → 4. Backlog register → 5. Architecture blueprints

---

## 7. Immediate Next Actions

1. **P0-1 (R06)** — Add `InMemoryGuard.reportFallback()` to 10 unguarded components
2. **P0-2 (R05)** — Implement `/health/live`, `/health/ready` (DB ping), `/health/startup`
3. **P0-3 (R02)** — Migration lock + checksum guard (CI)
4. **P0-4 (R09)** — GitHub Actions: build + test + security + artefact
5. **P0-5 (R01)** — Secrets versioning + revocation + prod boot refusal

---

## 8. Human Validation Required

- [ ] Confirm production blocker priority order (R06 → R05 → R02 → R09 → R01 → R07 → R03/R04)
- [ ] Approve `ADR-0017-auth-session-shell-bridging.md` (currently Draft, two AI reviews done)
- [ ] Validate `RELEASE-READINESS.md` P0 gate criteria before any public exposure
- [ ] Decide on `chatgpt-web-mcp/` (embedded git repo, untracked, excluded from vitest) — submodule or .gitignore