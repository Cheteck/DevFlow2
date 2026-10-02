# MosaiX Platform & IJIDeals State Specification

- **Current Date :** September 2026
- **Status :** PRODUCTION-READY PLATFORM (Gap Analysis: `.project/reports/gap-analysis-report-2026-09-28.md`)
- **Active Bounded Application Contexts (10) :** `citadelle`, `solara`, `solidarity`, `imperia`, `spaces`, `commerce`, `beam`, `portfolio`, `booking`, `subscription`
- **Total Test Coverage :** 127 Test Suites · 690 Passing Tests (100% Pass Rate)

---

## Completed Platform Architecture Milestones

1. **Frontend Composition Runtime v1 (ADR-0007)**:
   - Pure semantic contracts (`SurfaceContract`, `SlotContract`, `PlacementContract`, `ContributionContract`, `CompositionContext`, `CompositionSnapshot`).
   - Unified `ContributionRegistry`, `CompositionPolicyEngine`, `CompositionResolver`, `RendererRegistry`.
   - Dynamic Shell Tri-Zone rendering (`ShellNavbar`, `ShellPrimarySidebar`, `ShellSecondarySidebar`) driven purely by resolved composition snapshots without hardcoded app lists.

2. **IJIDeals Platform Navigation & Landing**:
   - Guest State -> `IJIDealsGuestLanding` (Multi-application platform presentation).
   - Auth State -> `IJIDealsAppHub` (Central 10-application hub).
   - Solara restored as autonomous Bounded Application at `/solara/feed`.
   - Legacy MosaiX framework marketing template backed up at `src/shell/templates/mosaix-framework-landing.backup.html`.

3. **IJIDeals Platform App Registry**:
   - `PlatformAppRegistry` in `@mosaix/ui-runtime` acting as single source of truth for all 10 BACs.

4. **Security, Gateway & Telemetry**:
   - Distributed `RateLimiter`, `CorsMiddleware`, and `SecurityHeadersMiddleware` in `@mosaix/gateway` and `@mosaix/http`.
   - `JwtAuthMiddleware` with claims context hydration and `IdentityController` auth routes (`/login`, `/register`, `/logout`, `/refresh`).
   - Prometheus metrics exporter at `/metrics` and health check at `/healthz` / `/readyz`.

5. **Containerization & Operational Runbooks**:
   - `compose.staging.yml` isolated staging stack.
   - `scripts/db-backup.ts` database backup utility.
   - `.project/workflows/recovery/disaster-recovery-runbook.md` RTO/RPO runbook.
