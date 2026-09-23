# External Integrations

**Analysis Date:** 2026-08-08

## APIs & External Services

All external integrations are implemented as hexagonal adapters (`packages/adapters/`) behind ports (`packages/ports/`). Adapters receive credentials/config via **constructor injection** (duck-typed clients or config records) — no adapter reads `process.env` directly, so no env var names are hard-coded at the package level.

**Messaging / Event Streaming:**

- Kafka — pub/sub via `@mosaix/adapter-kafka` (`packages/adapters/kafka/src/index.ts`)
  - SDK: `kafkajs` ^2.2.0
  - Port: `@mosaix/ports-pubsub` (`packages/ports/pubsub/`)
- RabbitMQ — pub/sub via `@mosaix/adapter-rabbitmq` (`packages/adapters/rabbitmq/src/index.ts`)
  - SDK: `amqplib` ^0.10.0
  - Port: `@mosaix/ports-pubsub`

**Email:**

- AWS SES — via `@mosaix/adapter-email-ses` (`packages/adapters/email-ses/src/index.ts`)
  - SDK: `@aws-sdk/client-ses` ^3.600.0
  - Auth: AWS credentials (SDK default credential chain)
- SMTP — via `@mosaix/adapter-email-smtp` (`packages/adapters/email-smtp/src/index.ts`)
  - SDK: `nodemailer` ^6.9.0
  - Port: `@mosaix/ports-email` (`packages/ports/email/`)

**SMS:**

- Twilio — via `@mosaix/adapter-sms-twilio` (`packages/adapters/sms-twilio/src/index.ts`)
  - SDK: `twilio` ^5.0.0
  - Auth: Account SID + Auth Token (supplied to SDK client)
  - Port: `@mosaix/ports-sms` (`packages/ports/sms/`)

**Feature Flags:**

- LaunchDarkly — via `@mosaix/adapter-featureflags-launchdarkly` (`packages/adapters/featureflags-launchdarkly/src/index.ts`)
  - SDK: `launchdarkly-node-server-sdk` ^7.0.0
  - Auth: SDK key (supplied to SDK client)
  - Port: `@mosaix/ports-feature-flags` (`packages/ports/feature-flags/`)

**Observability:**

- OpenTelemetry — tracing via `@mosaix/adapter-tracing-otel` and metrics via `@mosaix/adapter-metrics-otel` (`packages/adapters/tracing-otel/src/index.ts`, `packages/adapters/metrics-otel/src/index.ts`)
  - SDK: `@opentelemetry/api` ^1.9.0
  - Ports: `@mosaix/ports-tracing`, `@mosaix/ports-metrics`
- Logging backends: Pino (`pino` ^9.0.0, `packages/adapters/logger-pino`) and Winston (`winston` ^3.0.0, `packages/adapters/logger-winston`); port `@mosaix/ports-logging`

## Data Storage

**Databases:**

- PostgreSQL — via `@mosaix/adapter-database-postgres` (`packages/adapters/database-postgres/src/index.ts`)
  - Client: **duck-typed** — the adapter's constructor accepts any pg-compatible client/pool object (`{ query(sql, params): Promise<{ rows, rowCount }> }`); no `pg` package dependency declared
  - Supports transactions with savepoints and distributed migration locks (reported in `DatabaseCapabilities`)
  - Port: `@mosaix/ports-database` (`packages/ports/database/`)
- SQLite — via `@mosaix/adapter-database-sqlite` (`packages/adapters/database-sqlite/src/index.ts`)
  - Built on `node:sqlite` (Node built-in), zero external deps
  - Port: `@mosaix/ports-database`

**File Storage:**

- AWS S3 — via `@mosaix/adapter-storage-s3` (`packages/adapters/storage-s3/src/index.ts`)
  - SDK: `@aws-sdk/client-s3` ^3.600.0 (PutObject/GetObject/DeleteObject/HeadObject)
  - Auth: AWS credentials (default SDK credential chain); bucket name passed to constructor
  - Port: `@mosaix/ports-storage`
- Local filesystem — via `@mosaix/adapter-storage-local` (`packages/adapters/storage-local`) for development/tests

**Caching:**

- Redis — via `@mosaix/adapter-cache-redis` (`packages/adapters/cache-redis/src/index.ts`)
  - SDK: `ioredis` ^5.4.0
  - Port: `@mosaix/ports-cache`
- In-memory — via `@mosaix/adapter-cache-memory` (`packages/adapters/cache-memory`)

**Search:**

- Elasticsearch — via `@mosaix/adapter-search-elasticsearch` (`packages/adapters/search-elasticsearch/src/index.ts`)
  - SDK: `@elastic/elasticsearch` ^8.0.0
  - Port: `@mosaix/ports-search`
- In-memory — via `@mosaix/adapter-search-memory` (`packages/adapters/search-memory`)

## Authentication & Identity

**Auth Provider:**

- None external. Identity is a **demo bounded application** (`apps/identity/`) with its own domain model: user lifecycle, password hashing (`apps/identity/src/domain/password.ts`), capabilities (create/lookup/update/authenticate/disable), and an in-memory repository (`apps/identity/src/infrastructure/in-memory-user-repository.ts`)
- Permission/authorization model is kernel-internal (`@mosaix/core` — `permission.ts`, `identity.ts`; `domain:resource:action:scope` grammar), enforced by the Authorization Engine
- Crypto primitives via `@mosaix/adapter-crypto-node` (Node `crypto`) and `@mosaix/adapter-crypto-web` (Web Crypto API); port `@mosaix/ports-crypto`
- ID generation via `@mosaix/adapter-id-uuid` (`crypto.randomUUID`) and `@mosaix/adapter-id-ulid`; port `@mosaix/ports-id`

## Monitoring & Observability

**Error Tracking:**

- None configured

**Logs:**

- Console in demo/startup (`apps/identity/src/start.ts`); Pino or Winston adapters available for structured logging but not yet wired into apps

**Tracing/Metrics:**

- OpenTelemetry API adapters exist (`packages/adapters/tracing-otel`, `packages/adapters/metrics-otel`) but are not wired into the kernel or apps yet (README marks OTel as Phase 2 scope)

## CI/CD & Deployment

**Hosting:**

- None configured (no deployment manifests, no Docker)

**CI Pipeline:**

- GitHub Actions — `.github/workflows/ci.yml`
  - Trigger: push to `main`, pull requests
  - Steps: checkout → pnpm 11 (`pnpm/action-setup@v4`) → Node 22 (`actions/setup-node@v4` with pnpm cache) → `pnpm install --frozen-lockfile` → build → lint (incl. boundaries) → test → prettier check
  - Runner: `ubuntu-latest`, 15-min timeout

## Environment Configuration

**Required env vars:**

- None declared at repo level. No `.env.example` exists; `.env`/`.env.*` are gitignored
- Env-based adapters expect values keyed by whatever keys the consumer supplies:
  - `@mosaix/adapter-config-env` — `ConfigPort` reading from an env source (`packages/adapters/config-env`)
  - `@mosaix/adapter-secrets-env` — `SecretsPort` reading from `process.env` by default, overridable via constructor (`packages/adapters/secrets-env/src/index.ts`)
- Typed env access helpers (`env.string/number/boolean/float`) live in `@mosaix/config` (`packages/config/src/env.ts`)

**Secrets location:**

- Local environment variables only (gitignored `.env`). AWS SDKs use their standard credential chain; no hard-coded secrets anywhere in the repo

## Webhooks & Callbacks

**Incoming:**

- None. No HTTP server exists in the codebase (the `http` port + native-fetch adapter are client-side only; `apps/identity/src/start.ts` is a plain Node script, not a server)

**Outgoing:**

- None. `@mosaix/adapter-http-fetch` (`packages/adapters/http-fetch`) implements a client-side `HttpPort` for outbound calls but is not currently used by any app

## Integration Status Summary

| Capability      | Production adapter                                                                             | In-memory/dev alternative                     | Wired into apps?                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Database        | Postgres (`packages/adapters/database-postgres`), SQLite (`packages/adapters/database-sqlite`) | —                                             | No — apps use in-memory repos (`apps/identity/src/infrastructure/in-memory-user-repository.ts`) |
| Cache           | Redis (`packages/adapters/cache-redis`)                                                        | `cache-memory`                                | No                                                                                              |
| Storage         | S3 (`packages/adapters/storage-s3`)                                                            | `storage-local`                               | No                                                                                              |
| Email           | SES (`packages/adapters/email-ses`), SMTP (`packages/adapters/email-smtp`)                     | —                                             | No                                                                                              |
| SMS             | Twilio (`packages/adapters/sms-twilio`)                                                        | —                                             | No                                                                                              |
| Pub/Sub         | Kafka (`packages/adapters/kafka`), RabbitMQ (`packages/adapters/rabbitmq`)                     | `messagebus-mosaix` (in-memory, used by demo) | No                                                                                              |
| Search          | Elasticsearch (`packages/adapters/search-elasticsearch`)                                       | `search-memory`                               | No                                                                                              |
| Feature flags   | LaunchDarkly (`packages/adapters/featureflags-launchdarkly`)                                   | `featureflags-memory`                         | No                                                                                              |
| Tracing/Metrics | OpenTelemetry (`packages/adapters/tracing-otel`, `packages/adapters/metrics-otel`)             | —                                             | No                                                                                              |
| Logging         | Pino (`packages/adapters/logger-pino`), Winston (`packages/adapters/logger-winston`)           | —                                             | No                                                                                              |
| Config/Secrets  | env-based (`config-env`, `secrets-env`)                                                        | —                                             | Kernel config via constructor (`RuntimeKernel({}, { config })` in `demo/identity-sales.ts`)     |

All adapters are implemented and tested as standalone packages; none are yet composed into the running kernel/apps (Phase 1 is in-memory; wiring persistent adapters is planned for Phase 2 per `README.md`).

---

_Integration audit: 2026-08-08_
