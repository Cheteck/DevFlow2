# IJIDeals Platform Infrastructure Specification

- **Version :** 1.0.0
- **Status :** Approved & Implemented
- **Bounded Applications (8) :** Identity (`@apps/identity`), Spaces (`@apps/spaces`), Portfolio (`@apps/portfolio`), Commerce (`@apps/commerce`), Solara (`@apps/solara`), Beam (`@apps/beam`), Solidarity (`@apps/solidarity`), Imperia (`@apps/imperia`).

---

## 1. Executive Summary

IJIDeals is an integrated multi-application platform built on top of MosaiX runtime primitives. The platform unifies 8 autonomous Bounded Application Contexts (BACs) behind a single entrypoint (the Application Shell) powered by deterministic experience composition.

---

## 2. Platform Architecture Topology

```
                         ┌──────────────────────┐
                         │      IJIDeals        │
                         │       Platform       │
                         └──────────┬───────────┘
                                    │
                              ┌─────▼─────┐
                              │   Shell   │
                              └─────┬─────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 │                  │                  │
                 ▼                  ▼                  ▼
             Identity             API             App Registry
             (@auth)          (@gateway)     (PlatformAppRegistry)
                 │                  │                  │
                 └──────────────────┼──────────────────┘
                                    │
          ┌─────────┬─────────┬─────┼─────┬─────────┬─────────┐
          ▼         ▼         ▼           ▼         ▼         ▼
       Identity   Spaces   Portfolio   Commerce   Solara    Beam  ...
```

---

## 3. Platform App Registry

The single source of truth for application metadata across the Shell, Guest Landing, and Auth App Hub is `PlatformAppRegistry` in `@mosaix/ui-runtime`:

- **Identity (`@apps/identity`)** — Route: `/login` · Single Sign-On & Session Control.
- **Spaces (`@apps/spaces`)** — Route: `/spaces/dashboard` · Space & Organization Management.
- **Portfolio (`@apps/portfolio`)** — Route: `/portfolio/catalog` · Vendables & Product Catalog.
- **Commerce (`@apps/commerce`)** — Route: `/commerce/checkout` · Order Checkout Sagas.
- **Solara (`@apps/solara`)** — Route: `/solara/feed` · Community Feed & Social Network.
- **Beam (`@apps/beam`)** — Route: `/beam/chat` · Real-time Messenger & Conversations.
- **Solidarity (`@apps/solidarity`)** — Route: `/solidarity` · Crisis Coordination & Mutual Aid.
- **Imperia (`@apps/imperia`)** — Route: `/imperia/dashboard` · Platform Governance & Supervision.

---

## 4. Navigation & Landing Decision Pipeline

1. **Guest State (`usr_guest` or unauthenticated)**:
   - Root route `/` renders `IJIDeals Guest Landing` page (`renderIJIDealsGuestLanding`).
   - Presents platform capabilities and call to action to sign in or create account.
2. **Authenticated State**:
   - Root route `/` renders `IJIDeals Application Hub` page (`renderIJIDealsAppHub`).
   - Presents interactive cards for all 8 BAC applications with permission/capability availability status.
3. **Deep Links**:
   - Routes like `/solara/feed` or `/portfolio/catalog` bypass landing and resolve active contribution content directly into the Shell tri-zone layout (`main.content` slot).
4. **Diagnostics & Health**:
   - Route `/__mosaix` — Full composition runtime diagnostic dashboard.
   - Route `/health` — Platform health check payload (`status: "UP"`).

---

## 5. Environment & Configuration Strategy

Platform configuration is governed by `@mosaix/config` and repository `.env.example`:
- `MOSAIX_ENV` (`development` | `staging` | `production`)
- `MOSAIX_PORT` (Default: `3000`)
- `MOSAIX_AUTH_JWT_SECRET`
- `MOSAIX_DATABASE_URL` (SQLite / Postgres)
- `MOSAIX_TELEMETRY_OTLP_ENDPOINT`

---

## 6. Staging & Production Container Stack (Phase P7)

The platform is packaged for containerized deployment using Docker Compose:
- **Local / Dev Compose:** `compose.yml`
- **Staging Compose:** `compose.staging.yml` (PostgreSQL 16, Redis 7, Jaeger OTLP, MosaiX Gateway)

---

## 7. Operational Runbooks & Recovery (Phase P8)

- **Backup Script:** `scripts/db-backup.ts` (`pnpm tsx scripts/db-backup.ts`)
- **Disaster Recovery Runbook:** `.project/workflows/recovery/disaster-recovery-runbook.md`
- **Prometheus Metrics:** `GET /metrics`
- **Health Check Probe:** `GET /health`
- **Composition Diagnostic:** `GET /__mosaix`
