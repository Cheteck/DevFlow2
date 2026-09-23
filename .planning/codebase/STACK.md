# Technology Stack

**Analysis Date:** 2026-08-08

## Languages

**Primary:**

- TypeScript ^5.7.0 - Entire codebase: kernel, SDK, ports, adapters, apps, demo, tooling configs (`packages/`, `apps/`, `src/`, `demo/`)

**Secondary:**

- HTML/CSS - Static shell landing template (`src/shell/templates/home.html`, 2158 lines, single-file inline styles; no framework, no CSS build)
- No other languages detected. No JSX/React components despite `"jsx": "react-jsx"` in `tsconfig.json`

## Runtime

**Environment:**

- Node.js 20+ (required per `README.md`); CI pins Node 22 (`apps/../.github/workflows/ci.yml`); local dev observed on v26.3.1
- All packages are ESM (`"type": "module"` in every `package.json`)
- Compile target: ES2022, module ESNext, moduleResolution Bundler (`tsconfig.json`)

**Package Manager:**

- pnpm — workspace monorepo; CI uses pnpm 11 (`pnpm/action-setup@v4` in `.github/workflows/ci.yml`), local observed v10.33.4
- Lockfile: `pnpm-lock.yaml` (lockfileVersion 9.0), installed via `pnpm install --frozen-lockfile` in CI
- Workspace globs (`pnpm-workspace.yaml`): `packages/*`, `packages/ports/*`, `packages/adapters/*`, `apps/*`
- `allowBuilds: esbuild: true`; `minimumReleaseAgeExclude` for `@aws-sdk/*` and `@mosaix/*`

## Frameworks

**Core:**

- No runtime framework. The "framework" is custom: `@mosaix/core` (Runtime Kernel — lifecycle, registries, event bus, authorization engine) and `@mosaix/sdk` (developer SDK with `MosaixApp`), both hand-rolled TypeScript (`packages/core/src/`, `packages/sdk/src/`)
- Zod ^3.24-3.25 — runtime validation; isolated in `@mosaix/schemas` and used by `apps/identity` (deliberately NOT imported by `@mosaix/core` per ADR-0001)

**Testing:**

- Vitest ^3.0.0 — unit tests, watch mode, v8 coverage (`vitest.config.ts`; config includes path aliases to workspace `src/index.ts` entry points)

**Build/Dev:**

- TypeScript project references (`tsc --build tsconfig.build.json`) — 60+ referenced projects across `packages/`, `apps/`, `src/`
- tsx ^4.19.0 — runs TypeScript directly for demo and single-app startup (`pnpm demo`, `pnpm start:identity`)
- ESLint ^9.0.0 + typescript-eslint ^8.0.0 + eslint-plugin-boundaries ^3.0.0 — lint + architectural boundary enforcement (`eslint.config.mjs`)
- Prettier ^3.3.0 — formatting (`prettier.config.json`: semi, double quotes, tabWidth 2, trailingComma es5, printWidth 100, LF)
- rimraf ^6.0.0 — clean script

## Key Dependencies

**Critical (workspace packages, all `workspace:*`):**

- `@mosaix/types` — zero-dep shared types, permissions, UUID v7 (`packages/types`)
- `@mosaix/contracts` — ABI layer: manifests, contracts, permissions, events (`packages/contracts`)
- `@mosaix/schemas` — Zod validators for contracts (`packages/schemas`)
- `@mosaix/core` — Runtime Kernel (`packages/core`)
- `@mosaix/sdk` — application SDK (`packages/sdk`)
- `@mosaix/config` — typed immutable config system with `createEnvHelper` (`.string/.number/.boolean/.float` accessors) (`packages/config/src/env.ts`)
- `@mosaix/migrations` — schema migration engine (`packages/migrations`)
- `@mosaix/ports-*` (19 ports) — hexagonal interfaces: cache, clock, config, crypto, database, email, event-store, feature-flags, http, id, logging, message-bus, metrics, pubsub, search, secrets, sms, storage, tracing (`packages/ports/`)
- `@mosaix/adapter-*` (29 adapters) — implementations of those ports (`packages/adapters/`)

**Infrastructure (external SDKs, one per adapter):**

- `ioredis` ^5.4.0 — Redis cache (`packages/adapters/cache-redis`)
- `@aws-sdk/client-s3` ^3.600.0 — object storage (`packages/adapters/storage-s3`)
- `@aws-sdk/client-ses` ^3.600.0 — email sending (`packages/adapters/email-ses`)
- `nodemailer` ^6.9.0 — SMTP email (`packages/adapters/email-smtp`)
- `twilio` ^5.0.0 — SMS (`packages/adapters/sms-twilio`)
- `kafkajs` ^2.2.0 — Kafka pub/sub (`packages/adapters/kafka`)
- `amqplib` ^0.10.0 — RabbitMQ pub/sub (`packages/adapters/rabbitmq`)
- `@elastic/elasticsearch` ^8.0.0 — search (`packages/adapters/search-elasticsearch`)
- `launchdarkly-node-server-sdk` ^7.0.0 — feature flags (`packages/adapters/featureflags-launchdarkly`)
- `@opentelemetry/api` ^1.9.0 — tracing + metrics (`packages/adapters/tracing-otel`, `packages/adapters/metrics-otel`)
- `pino` ^9.0.0 and `winston` ^3.0.0 — logging (`packages/adapters/logger-pino`, `packages/adapters/logger-winston`)

**Zero-dependency adapters (Node/Web built-ins or in-memory):**

- `database-sqlite` — `node:sqlite`; `database-postgres` — duck-typed pg-compatible client (no `pg` package); `http-fetch` — native fetch; `crypto-node` — `node:crypto`; `crypto-web` — Web Crypto API; `id-uuid` — `crypto.randomUUID`; `id-ulid` — in-house; plus in-memory/fake adapters (`cache-memory`, `storage-local`, `search-memory`, `featureflags-memory`, `messagebus-mosaix`, `clock-system`, `clock-fake`) and env adapters (`config-env`, `secrets-env`)

## Configuration

**Environment:**

- No `.env.example` file. `.env` and `.env.*` are gitignored (`apps/../.gitignore`)
- Env access is centralized through `createEnvHelper` in `@mosaix/config` (`packages/config/src/env.ts`) with typed accessors; adapters accept injected sources: e.g. `SecretsEnvAdapter` constructor `(customSource?: Record<string, string | undefined>)` defaults to `process.env` (`packages/adapters/secrets-env/src/index.ts`)
- No adapter reads `process.env` directly; config/secrets flow via constructor injection (duck-typed clients/config objects)

**Build:**

- `tsconfig.json` — strict base: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals/Parameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `exactOptionalPropertyTypes`, `isolatedModules`, `verbatimModuleSyntax`, `esModuleInterop: false`
- `tsconfig.build.json` — root project-reference graph (the source of truth for the package list)
- `vitest.config.ts` — test includes `packages/**`, `apps/**`, `demo/**`, `src/**`; v8 coverage provider
- `eslint.config.mjs` — element boundaries: `types → contracts → schemas → ports → adapters/migrations → core → sdk → apps → demo`, default `disallow`; direction is enforced as errors

## Platform Requirements

**Development:**

- Node.js 20+ and pnpm (`README.md`)
- Commands: `pnpm install`, `pnpm dev` (watch build), `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm check` (build + lint + test + format), `pnpm demo`, `pnpm start:identity`

**Production:**

- No deployment target configured — no Dockerfile, no docker-compose, no deployment manifests
- Runtime target is a Node.js process; kernel/apps are currently in-memory (Phase 1); persistent adapters (Postgres, Redis, S3, Kafka…) exist as packages but are not yet wired into any app

---

_Stack analysis: 2026-08-08_
