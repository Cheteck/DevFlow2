# MosaiX / IJIDeals Platform Active Backlog & Future Milestones

- **Last Updated :** 2026-09-16
- **Status :** Active

---

## Completed Phases
- ✅ Phases 1-16 (Developer Foundation Roadmap)
- ✅ Phases 17-20 (Distributed Rate Limiting, Vault Secret Resolution, Multi-Tenant Schema Isolation, OTLP Telemetry)
- ✅ Phase P1 (Auth) — JWT HMAC-SHA256 middleware implémenté et branché dans Gateway pipeline (2026-09-14)
- ✅ Phase P2 (Persistence) — 8 adaptateurs Postgres créés et branchés dans tous les BACs (2026-09-14)
- ✅ Phase P4 (Security) — CORS, RateLimiter (branché avec Redis), SecurityHeadersMiddleware, JWT auth middleware
- ✅ Phase P5 (Observability) — `/metrics` Prometheus dynamiques + OTLP trace export (2026-09-14)
- ✅ Phase IHM (UniTheme) — Persistance sur disque `.mosaix/composition-overrides.json`, Exporter/Importer JSON Presets, Solara Post Composer & Showcase Widgets (2026-09-19)
- ✅ Phase BAC Apps Gaps — Endpoints MFA Identity (`/identity/mfa/setup`, `/identity/mfa/verify`), Câblage dynamique Postgres Solara & Beam, Route Webhook Commerce (`/commerce/checkout/webhook`) (2026-09-19)
- ✅ Phases P6-P8 (Tests, CI/CD, Operations)

---

## Backlog Critiques — Lacunes de Dogfooding (Audit 2026-09-14)

| ID | Gap | Status | Resolution |
|---|---|---|---|
| BL-010 | `AuthorizationEngine` non branché — RBAC factice dans `src/index.ts` | ✅ RÉSOLU | `PermissionGuard` avec `AuthorizationEngine` créé et branché dans Gateway pipeline (`gateway.ts:123-136`). Toutes les routes BAC backend valident JWT. |
| BL-011 | Créer `PermissionGuard` middleware + le brancher dans Gateway pipeline | ✅ RÉSOLU | `PermissionGuard` (`src/shell/middleware/permission-guard.ts`) + JWT middleware injecté dans `GatewayConfig.authOptions`. |
| BL-012 | 8 adaptateurs Postgres à implémenter | ✅ RÉSOLU | Créé pour chaque BAC: `PostgresUserRepository`, `PostgresVendableRepository`, `PostgresOrderRepository`, `PostgresSpaceRepository`, `PostgresSocialRepository`, `PostgresMessagingRepository`, `PostgresSolidarityRepository`, `PostgresImperiaRepository`. |
| BL-013 | Brancher `AuthManager` de `@mosaix/auth` dans `IdentityServiceProvider` | ✅ RÉSOLU | `AuthManager` créé avec `LocalPasswordProvider`, in-memory adapters pour SessionStore/TokenStore/CredentialStore/IdentityStore. `IdentityController` délègue l'authentification via `AuthManager`. |
| BL-014 | Brancher `OTLPTraceExporter` réel dans Gateway | ✅ RÉSOLU | Span creation dans Gateway request handler + flush on shutdown. `setCompositionMetrics()` appelé depuis `ShellHtmlRenderer.renderShellPage`. |
| BL-015 | Normaliser les imports BACs via `@mosaix/sdk` | ✅ RÉSOLU | Tous les imports directs de `@mosaix/container`, `@mosaix/http`, `@mosaix/orm`, `@mosaix/core` remplacés par `@mosaix/sdk` dans les 8 BACs. |
| BL-016 | Brancher les événements domaine via `OutboxWorker` | ✅ RÉSOLU (2026-09-16) | `resolveMessageBusDriver()` + `createOutboxMessagingPublisher()` (kafka/rabbitmq/memory) + `startOutboxDaemonFromEnv()` branché au boot (`src/index.ts`) + worker séparé `scripts/outbox-worker.ts`. Reste : acks consommateurs live + tests broker (infra requise). |
| BL-017 | `PostgresSocialRepository` (solara) vs modèle | ✅ RÉSOLU (2026-09-16) | Adapter réécrit sur `Post`/`Comment`/`FollowerRelation` (`actorId`, `publicationType`, `createdAt: Date`). Reste : câblage service↔repo (service toujours in-memory). |
| BL-018 | `PostgresMessagingRepository` (beam) vs `MessageModel` | ✅ RÉSOLU (2026-09-16) | Typage `unknown` durci, pagination bornée, `listConversations(limit)`. |
| BL-019 | `PostgresSolidarityRepository` vs modèles | ✅ RÉSOLU (2026-09-16) | Colonnes alignées sur `Incident`/`Need`/`Donation`/`Resource`/`Hub`/`Mission`/`Distribution` + hydratation typée. |
| BL-020 | `PostgresImperiaRepository` | ✅ RÉSOLU (2026-09-16) | Interfaces `ImperiaAuditLog/Policy/DLQItem/CircuitBreaker` exportées, plus de `unknown[]`. Test admin mis à jour + test 403 ajouté. |
| BL-021 | `PostgresVendableRepository` (portfolio) vs `Vendable` | ✅ RÉSOLU (2026-09-16) | `hydrate` typé (`asString`/`asJson`) + route `composition-root` construisant un vrai `Vendable`. |
| BL-022 | Stores identity persistants au boot | ✅ RÉSOLU (2026-09-16) | `resolveIdentityStores()` (Redis sessions via `REDIS_URL`, Postgres identity/token/credential via `databasePort`, warns prod) + `identityStore` injectable. Reste : appel au boot prod + migrations tables. |
| BL-023 | Worker Outbox séparé + acks + tests broker (Phase 21) | ✅ RÉSOLU (2026-09-16, code) | `src/outbox-daemon-boot.ts` + `scripts/outbox-worker.ts` + test (3 cas). Reste : broker live + acks consommateurs (infra). |

---

## Décisions interactives 2026-09-16 (appliquées)

| ID | Décision | Statut |
|---|---|---|
| DEC-JWT-001 | Fail-fast uniforme : `resolveGatewayJwtSecret()` throw en production si `MOSAIX_AUTH_JWT_SECRET` absent (<16 chars). Plus de défaut silencieux côté Gateway. | ✅ APPLIQUÉ (`src/index.ts`) |
| DEC-BACKUP-001 | `scripts/db-backup.ts` : vrai `pg_dump` via `execFileSync` (sans shell), copie fichier pour SQLite, échec bruyant — plus aucun dump mock. | ✅ APPLIQUÉ |
| DEC-SESS-001 | Stores persistants : `IdentityAdapters` accepte `sessionStore`/`tokenStore`/`credentialStore` (Redis/Postgres) ; défaut in-memory dev/test. Reste : câblage Redis/Postgres au boot + migrations. | 🔄 PARTIEL (`apps/identity/src/index.ts`) |
| DEC-ADAPT-001 | Adapters Postgres au cas par cas : `commerce` (import `OrderModel` du domaine) et `spaces` (import `DatabasePort`) corrigés ; `solara`/`beam`/`solidarity`/`imperia`/`portfolio` nécessitent un alignement modèles↔tables (voir BL-017–BL-021). | 🔄 PARTIEL |
| DEC-OUTBOX-001 | Phase 21 complète : factory publisher + driver env ; worker séparé et acks à suivre. | 🔄 EN COURS |

## Backlog — Alignement Postgres au cas par cas (Audit 2026-09-16) — ✅ SOLDÉ

| ID | Gap | Status | Note |
|---|---|---|---|
| BL-017 | `PostgresSocialRepository` (solara) vs modèle `Post`/`Comment`/`FollowerRelation` | ✅ RÉSOLU | Adapter réécrit ; reste câblage service↔repo |
| BL-018 | `PostgresMessagingRepository` (beam) vs `MessageModel` | ✅ RÉSOLU | Typage durci + pagination |
| BL-019 | `PostgresSolidarityRepository` vs modèles | ✅ RÉSOLU | Colonnes alignées + hydratation typée |
| BL-020 | `PostgresImperiaRepository` | ✅ RÉSOLU | Interfaces exportées, tests admin/403 |
| BL-021 | `PostgresVendableRepository` (portfolio) vs `Vendable` | ✅ RÉSOLU | Hydrate typé + caller corrigé |
| BL-022 | Câblage Redis/Postgres des stores identity au boot + migrations | ✅ RÉSOLU (code) | `resolveIdentityStores()` ; reste appel boot prod + migrations tables |
| BL-023 | Worker Outbox séparé + acks consommateurs + tests broker (Phase 21) | ✅ RÉSOLU (code) | Boot + worker + tests ; reste broker live |

## Suivi — câblage runtime restant (nécessite infra/migrations)

| ID | Sujet | Priorité |
|---|---|---|
| FUP-001 | Câbler `PostgresSocialRepository`/`PostgresMessagingRepository`/services in-memory vers Postgres au boot (services actuellement Map) | P1 |
| FUP-002 | Appeler `resolveIdentityStores()` dans le boot prod + migrations `tokens`/`credentials`/`sessions` | P0 |
| FUP-003 | Intégration broker live (Kafka/RabbitMQ) + acks consommateurs + driver `pg` pour l'outbox Postgres | P1 |

---

## Future Operational Enhancements

### Phase 21 — Kafka & RabbitMQ Production Cluster Drivers
- **Goal**: Harden `@mosaix/events` OutboxWorker to stream events to production Kafka clusters and RabbitMQ brokers with consumer acknowledgement.

### Phase 23 — User Subscriptions & Recurring Billing Module (`apps:subscription`)
- **Goal**: Implement recurring billing, subscription tiers, trial periods, and event-driven feature gating across BACs (`apps:booking`, `apps:commerce`, `apps:citadelle`).
- **Status**: Backlog (Approved 2026-09-22)

### Phase 24 — Additional Platform Monetization Models
- **Goal**: Implement alternative monetization strategies (Pay-per-use / Metered billing, Marketplace commissions, Enterprise SSO/SLA licensing, Premium Theme/Plugin store).
